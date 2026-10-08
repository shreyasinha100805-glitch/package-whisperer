// Global Error Handler & 404 Middleware
const logger = require('../utils/logger');
const indexHtml = require('../views/indexHtml');

function notFoundHandler(req, res) {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Cannot ${req.method} ${req.path}`
      }
    });
  }
  if (req.accepts('html')) {
    return res.status(200).type('html').send(indexHtml);
  }
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
}

function errorHandler(err, req, res, next) {
  logger.error(`Unhandled error on ${req.method} ${req.path}:`, err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
