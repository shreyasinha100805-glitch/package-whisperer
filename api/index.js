// Vercel Serverless Function Entry Point for Package Whisperer
const indexHtml = require('../src/views/indexHtml');
const { createApp, processRingEvent, handleEscalation } = require('../src/app');

const app = createApp();

app.processRingEvent = processRingEvent;
app.handleEscalation = handleEscalation;
app.createApp = createApp;

// Export as a standard 2-argument HTTP request listener (req, res).
module.exports = (req, res) => {
  try {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    // API & Webhook routes are handled by Express
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/webhook') ||
      pathname === '/token' ||
      pathname === '/link'
    ) {
      return app(req, res);
    }

    // Root API ping
    if (pathname === '/api' || pathname === '/api/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        success: true,
        service: 'Package Whisperer API',
        endpoints: {
          health: '/api/health',
          status: '/api/status',
          events: '/api/events',
          pending: '/api/pending'
        }
      }));
    }

    // Serve the application directly at the root path.
    if (pathname === '/' || pathname === '') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.end(indexHtml);
    }

    // For all other routes (/, /landing, /caretaker, /resident, /simulator, /architecture, etc.),
    // immediately serve the in-memory application HTML with 200 OK!
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.end(indexHtml);
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
