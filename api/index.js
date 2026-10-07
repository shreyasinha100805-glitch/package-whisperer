// Vercel Serverless Function Entry Point for Package Whisperer
const fs = require('fs');
const path = require('path');
const { createApp, processRingEvent, handleEscalation } = require('../src/app');

const app = createApp();

app.processRingEvent = processRingEvent;
app.handleEscalation = handleEscalation;
app.createApp = createApp;

function getIndexHtml() {
  const candidates = [
    path.join(__dirname, '../public/index.html'),
    path.join(__dirname, '../index.html'),
    path.join(process.cwd(), 'public/index.html'),
    path.join(process.cwd(), 'index.html'),
    path.join('/var/task/public/index.html'),
    path.join('/var/task/index.html')
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        return fs.readFileSync(f, 'utf8');
      } catch (e) {}
    }
  }
  return null;
}

let cachedHtml = getIndexHtml();

// Export as a standard 2-argument HTTP request listener (req, res).
// Express 5 has app.length === 3 which causes AWS Lambda / Vercel Node runtime
// to misinterpret it as a callback-style handler (event, context, callback),
// causing FUNCTION_INVOCATION_FAILED.
module.exports = (req, res) => {
  try {
    const rawUrl = req.url || '';
    const pathname = rawUrl.split('?')[0];

    // If root or index requested through function invocation, serve static HTML immediately
    if (pathname === '/' || pathname === '' || pathname === '/index.html') {
      if (!cachedHtml) cachedHtml = getIndexHtml();
      if (cachedHtml) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return res.end(cachedHtml);
      }
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
