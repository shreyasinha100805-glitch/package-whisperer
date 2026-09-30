/**
 * Package Whisperer — Server Entry Point
 * Built for Amazon Developer Hackathon (Ring Track + AWS Bedrock Integration)
 */
const { createApp, processRingEvent, handleEscalation } = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');

const app = createApp();

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

module.exports = { app, server, processRingEvent, handleEscalation };