const { app } = require('@azure/functions');
const { sql, db, json, bad, secured, clean } = require('../shared');

// GET list, POST add a new trainee
app.http('employees', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'employees',
  handler: secured(async (req, ctx, user) => {
    const pool = await db();
    if (req.method === 'GET') {
      const all = req.query.get('all') === '1' && user.isAdmin;
      const r = await pool.request().query(`
        SELECT e.EmployeeId AS id, e.FirstName AS first, e.LastName AS last, e.Active AS active,
               COUNT(t.Id) AS total, CONVERT(char(10), MAX(t.LogDate), 23) AS lastDate,
               (SELECT STRING_AGG(x.TrainerEmail, ',') FROM (SELECT DISTINCT TrainerEmail FROM dbo.TaskLog WHERE EmployeeId = e.EmployeeId) x) AS trainerEmails,
               (SELECT STRING_AGG(x.TrainerName, ', ') FROM (SELECT DISTINCT TrainerName FROM dbo.TaskLog WHERE EmployeeId = e.EmployeeId) x) AS trainerNames
        FROM dbo.Employees e LEFT JOIN dbo.TaskLog t ON t.EmployeeId = e.EmployeeId
        ${all ? '' : 'WHERE e.Active = 1'}
        GROUP BY e.EmployeeId, e.FirstName, e.LastName, e.Active
        ORDER BY e.LastName, e.FirstName`);
      return json(200, r.recordset.map(e => ({ ...e, trainerEmails: (e.trainerEmails || '').toLowerCase().split(',').filter(Boolean), trainerNames: e.trainerNames || '' })));
    }
    const b = await req.json().catch(() => ({}));
    const id = clean(b.id, 20), first = clean(b.first, 60), last = clean(b.last, 60);
    if (!first || !last) return bad('Enter a first and last name.');
    if (!id || !/^\d{4,20}$/.test(id)) return bad('Employee ID must be numbers only, at least 4 digits.');
    const exists = await pool.request().input('id', sql.VarChar(20), id)
      .query('SELECT FirstName, LastName FROM dbo.Employees WHERE EmployeeId = @id');
    if (exists.recordset.length) {
      const e = exists.recordset[0];
      return json(409, { error: `ID ${id} already belongs to ${e.FirstName} ${e.LastName}.` });
    }
    await pool.request()
      .input('id', sql.VarChar(20), id).input('f', sql.NVarChar(60), first)
      .input('l', sql.NVarChar(60), last).input('by', sql.NVarChar(200), user.email)
      .query('INSERT INTO dbo.Employees (EmployeeId, FirstName, LastName, CreatedBy) VALUES (@id, @f, @l, @by)');
    return json(201, { id, first, last, active: true, total: 0, lastDate: null, trainerEmails: [], trainerNames: '' });
  })
});

// PUT edit a trainee (supervisors only)
app.http('employeeEdit', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'employees/{id}',
  handler: secured(async (req, ctx, user) => {
    if (!user.isAdmin) return json(403, { error: 'Only supervisors can edit trainee details.' });
    const b = await req.json().catch(() => ({}));
    const first = clean(b.first, 60), last = clean(b.last, 60);
    if (!first || !last) return bad('Enter a first and last name.');
    const r = await (await db()).request()
      .input('id', sql.VarChar(20), req.params.id).input('f', sql.NVarChar(60), first)
      .input('l', sql.NVarChar(60), last).input('a', sql.Bit, b.active ? 1 : 0)
      .query('UPDATE dbo.Employees SET FirstName=@f, LastName=@l, Active=@a WHERE EmployeeId=@id');
    if (!r.rowsAffected[0]) return json(404, { error: 'That trainee no longer exists.' });
    return json(200, { ok: true });
  })
});

// GET one trainee's full record: counts per task plus every entry
app.http('employeeSummary', {
  methods: ['GET'], authLevel: 'anonymous', route: 'employees/{id}/summary',
  handler: secured(async req => {
    const pool = await db();
    const id = req.params.id;
    const e = await pool.request().input('id', sql.VarChar(20), id)
      .query('SELECT EmployeeId AS id, FirstName AS first, LastName AS last, Active AS active FROM dbo.Employees WHERE EmployeeId=@id');
    if (!e.recordset.length) return json(404, { error: 'No trainee has that ID.' });
    const rows = await pool.request().input('id', sql.VarChar(20), id).query(`
      SELECT Id AS id, CONVERT(char(10), LogDate, 23) AS date, TaskCode AS task, Phase AS io, Week AS week,
             Gate AS gate, Flight AS flight, Tail AS tail, Notes AS notes, TrainerName AS trainer, TrainerEmail AS trainerEmail
      FROM dbo.TaskLog WHERE EmployeeId=@id ORDER BY LogDate DESC, Id DESC`);
    const recs = rows.recordset, counts = {};
    recs.forEach(r => { counts[r.task] = (counts[r.task] || 0) + 1; });
    return json(200, {
      employee: e.recordset[0],
      counts,
      records: recs,
      latestWeek: recs.length ? recs[0].week : null,
      firstDate: recs.length ? recs[recs.length - 1].date : null,
      trainers: [...new Set(recs.map(r => r.trainer))]
    });
  })
});
