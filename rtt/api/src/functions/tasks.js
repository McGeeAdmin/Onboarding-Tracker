const { app } = require('@azure/functions');
const { json, secured } = require('../shared');
const TASKS = require('../taskList');

app.http('tasks', {
  methods: ['GET'], authLevel: 'anonymous', route: 'tasks',
  handler: secured(async () => json(200, TASKS.filter(t => !t.hidden).map(({ code, label, phase }) => ({ code, label, phase }))))
});
