const { app } = require('@azure/functions');
const { db, json, secured } = require('../shared');

// Counts per trainee per task, for the all-trainees grid
app.http('progress', {
  methods: ['GET'], authLevel: 'anonymous', route: 'progress',
  handler: secured(async () => {
    const r = await (await db()).request().query(`
      SELECT t.EmployeeId AS eid, t.TaskCode AS task, COUNT(*) AS n
      FROM dbo.TaskLog t JOIN dbo.Employees e ON e.EmployeeId = t.EmployeeId
      WHERE e.Active = 1
      GROUP BY t.EmployeeId, t.TaskCode`);
    return json(200, r.recordset);
  })
});
