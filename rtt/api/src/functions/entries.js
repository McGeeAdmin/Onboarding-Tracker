const { app } = require('@azure/functions');
const crypto = require('crypto');
const { sql, db, json, bad, secured, clean, isDate } = require('../shared');
const TASKS = require('../taskList');

app.http('entries', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'entries',
  handler: secured(async (req, ctx, user) => {
    const pool = await db();

    if (req.method === 'GET') {
      const q = k => req.query.get(k) || '';
      const r = pool.request();
      const where = [];
      if (q('mine') === '1') { where.push('t.TrainerEmail = @me'); r.input('me', sql.NVarChar(200), user.email); }
      if (q('trainer')) { where.push('t.TrainerName = @tr'); r.input('tr', sql.NVarChar(120), q('trainer')); }
      if (q('task')) { where.push('t.TaskCode = @task'); r.input('task', sql.VarChar(40), q('task')); }
      if (isDate(q('from'))) { where.push('t.LogDate >= @from'); r.input('from', sql.Date, q('from')); }
      if (isDate(q('to'))) { where.push('t.LogDate <= @to'); r.input('to', sql.Date, q('to')); }
      if (q('who')) {
        where.push("(t.EmployeeId LIKE @who OR (e.FirstName + ' ' + e.LastName) LIKE @who)");
        r.input('who', sql.NVarChar(130), '%' + q('who').replace(/[%_[]/g, '[$&]') + '%');
      }
      const top = Math.min(Math.max(parseInt(q('top'), 10) || 500, 1), 5000);
      r.input('top', sql.Int, top);
      const res = await r.query(`
        SELECT TOP (@top) t.Id AS id, t.EntryGroupId AS grp, CONVERT(char(5), t.CreatedAt, 108) AS timeUtc, CONVERT(char(10), t.LogDate, 23) AS date, t.EmployeeId AS eid,
               e.FirstName + ' ' + e.LastName AS trainee, t.TaskCode AS task, t.Phase AS io, t.Week AS week,
               t.Gate AS gate, t.Flight AS flight, t.Tail AS tail, t.Notes AS notes,
               t.TrainerName AS trainer, t.TrainerEmail AS trainerEmail
        FROM dbo.TaskLog t JOIN dbo.Employees e ON e.EmployeeId = t.EmployeeId
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY t.LogDate DESC, t.Id DESC`);
      const trainers = await pool.request().query('SELECT DISTINCT TrainerName AS name FROM dbo.TaskLog ORDER BY TrainerName');
      return json(200, { rows: res.recordset, trainers: trainers.recordset.map(t => t.name) });
    }

    // POST: one form submission -> one row per selected task
    const b = await req.json().catch(() => ({}));
    const tasks = Array.isArray(b.tasks) ? [...new Set(b.tasks.map(String))] : [];
    const gate = clean(b.gate, 10), flight = clean(b.flight, 10), tail = clean(b.tail, 12);
    if (!isDate(b.date)) return bad('Pick a date.');
    if (!clean(b.employeeId, 20)) return bad('Pick a trainee.');
    if (!['IN', 'OUT'].includes(b.phase)) return bad('Choose arrival or departure.');
    if (![1, 2].includes(Number(b.week))) return bad('Choose week 1 or week 2.');
    if (!gate) return bad('Enter the gate.');
    if (!flight && !tail) return bad('Enter the flight number or tail number.');
    if (!tasks.length) return bad('Select at least one task.');

    const codes = new Set(TASKS.filter(t => !t.hidden).map(t => t.code));
    if (tasks.some(t => !codes.has(t))) return bad('One of the selected tasks is no longer on the list. Reload the page and try again.');

    const emp = await pool.request().input('id', sql.VarChar(20), b.employeeId)
      .query('SELECT 1 FROM dbo.Employees WHERE EmployeeId = @id');
    if (!emp.recordset.length) return bad('That trainee is not on the list. Add them first.');

    const group = crypto.randomUUID();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const task of tasks) {
        await new sql.Request(tx)
          .input('g', sql.UniqueIdentifier, group).input('d', sql.Date, b.date)
          .input('e', sql.VarChar(20), b.employeeId).input('t', sql.VarChar(40), task)
          .input('p', sql.Char(3), b.phase).input('w', sql.TinyInt, Number(b.week))
          .input('gate', sql.NVarChar(10), gate.toUpperCase())
          .input('fl', sql.NVarChar(10), flight && flight.toUpperCase().replace(/^AS/, ''))
          .input('tail', sql.NVarChar(12), tail && tail.toUpperCase())
          .input('n', sql.NVarChar(500), clean(b.notes, 500))
          .input('te', sql.NVarChar(200), user.email).input('tn', sql.NVarChar(120), user.name)
          .query(`INSERT INTO dbo.TaskLog (EntryGroupId, LogDate, EmployeeId, TaskCode, Phase, Week, Gate, Flight, Tail, Notes, TrainerEmail, TrainerName)
                  VALUES (@g, @d, @e, @t, @p, @w, @gate, @fl, @tail, @n, @te, @tn)`);
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
    return json(201, { saved: tasks.length, group });
  })
});

// DELETE one line: the trainer who logged it, or a supervisor
app.http('entryDelete', {
  methods: ['DELETE'], authLevel: 'anonymous', route: 'entries/{id}',
  handler: secured(async (req, ctx, user) => {
    const pool = await db();
    const id = parseInt(req.params.id, 10);
    if (!id) return bad('Invalid line.');
    const r = await pool.request().input('id', sql.Int, id).query('SELECT TrainerEmail FROM dbo.TaskLog WHERE Id = @id');
    if (!r.recordset.length) return json(404, { error: 'That line was already deleted.' });
    if (!user.isAdmin && r.recordset[0].TrainerEmail.toLowerCase() !== user.email)
      return json(403, { error: 'You can only delete lines you logged. Ask a supervisor to delete this one.' });
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.TaskLog WHERE Id = @id');
    return json(200, { ok: true });
  })
});

// DELETE a whole submission (every task saved together): the trainer who logged it, or a supervisor
app.http('submissionDelete', {
  methods: ['DELETE'], authLevel: 'anonymous', route: 'submissions/{grp}',
  handler: secured(async (req, ctx, user) => {
    const grp = String(req.params.grp || '');
    if (!/^[0-9a-f-]{36}$/i.test(grp)) return bad('Invalid submission.');
    const pool = await db();
    const r = await pool.request().input('g', sql.UniqueIdentifier, grp)
      .query('SELECT TOP 1 TrainerEmail FROM dbo.TaskLog WHERE EntryGroupId = @g');
    if (!r.recordset.length) return json(404, { error: 'That submission was already deleted.' });
    if (!user.isAdmin && r.recordset[0].TrainerEmail.toLowerCase() !== user.email)
      return json(403, { error: 'You can only delete submissions you made. Ask a supervisor to delete this one.' });
    const d = await pool.request().input('g', sql.UniqueIdentifier, grp).query('DELETE FROM dbo.TaskLog WHERE EntryGroupId = @g');
    return json(200, { deleted: d.rowsAffected[0] });
  })
});
