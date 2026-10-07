/**
 * Package Whisperer — Server Entry Point
 * Built for Amazon Developer Hackathon (Ring Track + AWS Bedrock Integration)
 */
const { createApp, processRingEvent, handleEscalation } = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const app = createApp();

// Attach helper functions directly to app
app.processRingEvent = processRingEvent;
app.handleEscalation = handleEscalation;
app.createApp = createApp;

// Only start the HTTP listener when executed directly (not when imported as a serverless function)
if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.banner({
      port: config.port,
      nodeVersion: process.version,
      region: config.aws.region,
      hasHmac: config.ring.hasSigningKey
    });
  });

  // Graceful shutdown
  function shutdown(signal) {
    logger.system(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.success('HTTP server closed. Exiting process.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  app.server = server;
}

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