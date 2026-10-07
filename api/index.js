// Vercel Serverless Function Entry Point for Package Whisperer
const { createApp, processRingEvent, handleEscalation } = require('../src/app');

const app = createApp();

app.processRingEvent = processRingEvent;
app.handleEscalation = handleEscalation;
app.createApp = createApp;

// Export as a standard 2-argument HTTP request listener (req, res).
// Express 5 has app.length === 3 which causes AWS Lambda / Vercel Node runtime
// to misinterpret it as a callback-style handler (event, context, callback),
// causing FUNCTION_INVOCATION_FAILED.
module.exports = (req, res) => {
  return app(req, res);
};

module.exports.app = app;
module.exports.processRingEvent = processRingEvent;
module.exports.handleEscalation = handleEscalation;
module.exports.createApp = createApp;
