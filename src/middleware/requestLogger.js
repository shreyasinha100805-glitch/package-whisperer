// HTTP Request Logger Middleware
const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const url = req.originalUrl || req.url || req.path;

  // Don't clutter logs with static assets and health checks
  if (url.startsWith('/css/') || url.startsWith('/js/') || url === '/favicon.ico') {
    return next();
  }

  // Webhook logging is handled specially in auth middleware
  if (url.startsWith('/webhook')) {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Suppress repeated /api/status 200 logs to keep the terminal serene
    if (url === '/api/status' && status === 200) {
      return;
    }

    logger.system(`${req.method} ${url} ➔ ${status} (${duration}ms)`);
  });

  next();
}

module.exports = { requestLogger };
