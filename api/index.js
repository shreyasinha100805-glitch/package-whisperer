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
  try {
    return app(req, res);
  } catch (err) {
    console.error('Unhandled Lambda Error in api/index:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Serverless invocation error'
        }
      });
    }
  }
};

module.exports.app = app;
module.exports.processRingEvent = processRingEvent;
module.exports.handleEscalation = handleEscalation;
module.exports.createApp = createApp;
