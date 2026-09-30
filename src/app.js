// Express Application Factory & Pipeline Orchestrator
const express = require('express');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const windowService = require('./services/windowService');
const eventService = require('./services/eventService');
const { generateDigest } = require('./services/aiService');
const { classifyEvent } = require('./logic/classifyEvent');
const { getTone, isInsideQuietHours } = require('./logic/settings');

const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const viewRoutes = require('./routes/views');

// Track recent motion timestamps per device
const recentMotionByDevice = {};

/**
 * Handles package escalation when retrieval window timer elapses.
 */
async function handleEscalation(deviceId, deliveredAt) {
  const label = eventService.getDeviceLabel(deviceId);
  const tone = getTone();

  if (isInsideQuietHours()) {
    logger.quiet(`Quiet hours active (10 PM – 7 AM). Holding escalation for "${label}" until morning.`);
    eventService.log({
      deviceId,
      status: 'held',
      reason: 'Quiet hours active (10 PM – 7 AM). Alert paused until morning.',
      digest: null
    });
    // Check again in 30 minutes
    setTimeout(() => handleEscalation(deviceId, deliveredAt), 30 * 60 * 1000);
    return;
  }

  logger.info(`Escalation triggered for "${label}" (Tone: ${tone})`);
  try {
    const result = await generateDigest(label, deliveredAt, tone);
    const digestText = result.text || result.toString();

    eventService.log({
      deviceId,
      status: 'escalated',
      reason: 'Package not picked up within designated window',
      digest: digestText,
      source: result.source,
      tone: result.tone || tone,
      latencyMs: result.latencyMs
    });
  } catch (err) {
    logger.error('Failed to generate escalation digest:', err);
    const fallback = `A package delivered at ${label} on ${new Date(deliveredAt).toLocaleTimeString()} has not been picked up yet. Please check in when you have a moment.`;
    eventService.log({
      deviceId,
      status: 'escalated',
      reason: 'Package not picked up within designated window',
      digest: fallback,
      source: 'fallback',
      tone
    });
  }
}

/**
 * Main Ring event pipeline processor.
 */
function processRingEvent(payload) {
  const type = payload?.data?.type;
  const attributes = payload?.data?.attributes || {};
  const deviceId = attributes.source || 'cam1';
  const timestamp = attributes.timestamp || Date.now();
  const label = eventService.getDeviceLabel(deviceId);

  const previousMotion = recentMotionByDevice[deviceId];
  const visitDuration = payload._simulatedVisitDuration !== undefined
    ? payload._simulatedVisitDuration
    : (previousMotion ? timestamp - previousMotion : 0);

  // 1. Check if this motion represents resident retrieval
  if (type === 'motion_detected' && windowService.isPending(deviceId)) {
    const wasRetrieval = windowService.checkRetrieval(deviceId, timestamp, visitDuration);
    if (wasRetrieval) {
      recentMotionByDevice[deviceId] = timestamp;
      const durationSec = Math.round(visitDuration / 1000);
      logger.retrieval(label, durationSec);
      eventService.log({
        deviceId,
        status: 'retrieved',
        reason: 'Resident retrieved package within quiet window'
      });
      return { handled: true, event: 'retrieval' };
    }
  }

  // 2. Classify event against motion history
  let motionHistory = [];
  if (payload._simulatedVisitDuration !== undefined) {
    motionHistory = [{ deviceId, timestamp: timestamp - payload._simulatedVisitDuration }];
  } else if (previousMotion) {
    motionHistory = [{ deviceId, timestamp: previousMotion }];
  }
  recentMotionByDevice[deviceId] = timestamp;

  const result = classifyEvent(payload, motionHistory);
  logger.classifier(result, label);

  // 3. If delivery detected, start peaceful retrieval window
  if (result.isDelivery) {
    windowService.start(deviceId, timestamp);
    eventService.log({
      deviceId,
      status: 'pending',
      reason: result.reason === 'doorbell_press'
        ? 'Doorbell pressed by delivery courier'
        : 'Short courier visit pattern detected'
    });
    return { handled: true, event: 'delivery_started', classification: result };
  }

  return { handled: true, event: 'ignored', classification: result };
}

// Bind state machine events to handlers
windowService.on('escalate', ({ deviceId, deliveredAt }) => {
  handleEscalation(deviceId, deliveredAt);
});

windowService.on('retrieved', ({ deviceId, manual }) => {
  if (manual) {
    logger.retrieval(eventService.getDeviceLabel(deviceId));
  }
});

// Provide event processor to routes
apiRoutes.setEventProcessor(processRingEvent);
webhookRoutes.setEventProcessor(processRingEvent);

/**
 * Creates and configures Express application
 */
function createApp() {
  const app = express();

  // 1. Raw body buffering for HMAC signature verification
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // 2. HTTP request logging
  app.use(requestLogger);

  // 3. Static assets
  app.use(express.static(path.join(__dirname, '../public')));

  // 4. Mount route modules
  app.use('/webhook', webhookRoutes);
  app.use('/api', apiRoutes);
  app.use('/', viewRoutes);

  // 5. 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
  processRingEvent,
  handleEscalation,
  windowService,
  eventService
};
