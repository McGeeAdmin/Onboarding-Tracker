const { app } = require('@azure/functions');
const { json, secured } = require('../shared');

app.http('me', {
  methods: ['GET'], authLevel: 'anonymous', route: 'me',
  handler: secured(async (req, ctx, user) => json(200, user))
});
