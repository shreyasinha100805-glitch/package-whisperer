// Vercel Serverless Function Entry Point for Package Whisperer
const indexHtml = require('../src/views/indexHtml');
const { createApp, processRingEvent, handleEscalation } = require('../src/app');

const app = createApp();

app.processRingEvent = processRingEvent;
app.handleEscalation = handleEscalation;
app.createApp = createApp;

// Set of static view routes
const HTML_ROUTES = new Set([
  '/',
  '',
  '/index.html',
  '/landing',
  '/caretaker',
  '/resident',
  '/simulator',
  '/architecture'
]);

// Export as a standard 2-argument HTTP request listener (req, res).
module.exports = (req, res) => {
  try {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    // If root or any view route is requested, serve in-memory HTML immediately
    if (HTML_ROUTES.has(pathname)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.end(indexHtml);
    }

    return app(req, res);
  } catch (err) {
    console.error('Unhandled Lambda Error in api/index:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Serverless invocation error'
        }
      }));
    }
  }
};

module.exports.app = app;
module.exports.processRingEvent = processRingEvent;
module.exports.handleEscalation = handleEscalation;
module.exports.createApp = createApp;
