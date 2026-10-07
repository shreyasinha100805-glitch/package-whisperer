// Express Application Factory & Pipeline Orchestrator
const express = require('express');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const windowService = require('./services/windowService');
const eventService = require('./services/eventService');
const { processEscalationDigest, generateDigest } = require('./services/aiService');
const { classifyEvent } = require('./logic/classifyEvent');
const { getTone, isInsideQuietHours } = require('./logic/settings');

const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const viewRoutes = require('./routes/views');

// Track recent motion timestamps per device
const recentMotionByDevice = {};

/**
 * Handles package escalation when retrieval window timer elapses.
 * Sub-Process 3 (DFD Level 2): Generate digest pipeline
 * Flow: 3.1 Check quiet hours -> (Hold until morning / 3.2 Select tone -> 3.3 Call Bedrock / 3.4 Fallback) -> 3.5 Log result -> D1 Events
 */
async function handleEscalation(deviceId, deliveredAt) {
  return processEscalationDigest(deviceId, deliveredAt);
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
