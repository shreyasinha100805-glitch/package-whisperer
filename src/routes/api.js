// API Routes for Package Whisperer
const express = require('express');
const router = express.Router();

const config = require('../config');
const logger = require('../utils/logger');
const windowService = require('../services/windowService');
const eventService = require('../services/eventService');
const { generateDigest } = require('../services/aiService');
const {
  setTone,
  getTone,
  setQuietHours,
  getQuietHours,
  isInsideQuietHours,
  setRetrievalWindowMinutes,
  getRetrievalWindowMinutes,
  getAllSettings
} = require('../logic/settings');

// Dependency injection or event processor hook
let processRingEventFn = null;
router.setEventProcessor = (fn) => { processRingEventFn = fn; };

/**
 * Health check & diagnostic status
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    environment: config.env,
    memoryUsage: process.memoryUsage(),
    aws: {
      configured: config.aws.isConfigured,
      region: config.aws.region,
      model: config.aws.bedrockModelId
    },
    ring: {
      hmacConfigured: config.ring.hasSigningKey
    }
  });
});

/**
 * Full state snapshot for frontend polling
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    settings: getAllSettings(),
    stats: eventService.getStats(),
    pendingDeliveries: windowService.getAllPending(),
    latestByDevice: eventService.getLatestStatusByDevice(),
    events: eventService.getAll({ limit: 40 })
  });
});

/**
 * Query event history
 */
router.get('/events', (req, res) => {
  const events = eventService.getAll(req.query);
  res.json({ success: true, count: events.length, events });
});

/**
 * Query active pending deliveries
 */
router.get('/pending', (req, res) => {
  res.json({ success: true, pendingDeliveries: windowService.getAllPending() });
});

/**
 * Resident manual resolution ("Got it, thanks!")
 */
router.post('/resident/resolve', (req, res) => {
  const deviceId = req.body.deviceId || 'cam1';
  windowService.resolve(deviceId);
  eventService.log({
    deviceId,
    status: 'retrieved',
    reason: 'Resident marked package as collected'
  });
  logger.retrieval(eventService.getDeviceLabel(deviceId));
  res.json({ success: true, deviceId, status: 'retrieved' });
});

/**
 * Update AI tone setting
 */
router.post('/settings/tone', (req, res) => {
  const { tone } = req.body;
  setTone(tone);
  logger.info(`Caretaker tone updated to "${getTone()}"`);
  res.json({ success: true, tone: getTone() });
});

/**
 * Update Quiet Hours
 */
router.post('/settings/quiet-hours', (req, res) => {
  const { enabled, start, end } = req.body;
  setQuietHours(enabled, start, end);
  logger.quiet(`Quiet hours configuration updated: ${enabled ? 'ENABLED' : 'DISABLED'} (${getQuietHours().start}:00–${getQuietHours().end}:00)`);
  res.json({
    success: true,
    quietHours: getQuietHours(),
    isQuietHoursActive: isInsideQuietHours()
  });
});

/**
 * Update Retrieval Window Duration
 */
router.post('/settings/window', (req, res) => {
  const { minutes } = req.body;
  setRetrievalWindowMinutes(minutes);
  logger.info(`Retrieval window updated to ${getRetrievalWindowMinutes()} minutes`);
  res.json({
    success: true,
    minutes: getRetrievalWindowMinutes(),
    windowMs: Math.round(getRetrievalWindowMinutes() * 60 * 1000)
  });
});

/**
 * Fast-forward active delivery window
 */
router.post('/test/fast-forward', (req, res) => {
  const deviceId = req.body.deviceId || 'cam1';
  const escalated = windowService.fastForward(deviceId);
  res.json({ success: true, escalated, deviceId });
});

/**
 * Clear and seed demo data
 */
router.post('/test/clear-history', (req, res) => {
  windowService.clearAll();
  eventService.seedDemoEvents();
  res.json({ success: true, message: 'Demo data re-seeded' });
});

/**
 * Force generate AI digest preview
 */
router.post('/test/force-digest', async (req, res) => {
  const deviceId = req.body.deviceId || 'cam1';
  const customTone = req.body.tone || getTone();
  const label = eventService.getDeviceLabel(deviceId);

  try {
    const result = await generateDigest(label, Date.now() - 4 * 60 * 60 * 1000, customTone);
    const digestText = result.text || result.toString();

    eventService.log({
      deviceId,
      status: 'escalated',
      reason: 'Manual test escalation triggered',
      digest: digestText,
      source: result.source,
      tone: result.tone || customTone,
      latencyMs: result.latencyMs
    });

    res.json({
      success: true,
      digest: digestText,
      source: result.source === 'bedrock' ? 'AWS Bedrock (Claude Haiku 4.5)' : 'Intelligent Tone Fallback',
      model: result.model,
      tone: customTone,
      latencyMs: result.latencyMs,
      prompt: result.prompt,
      error: result.error || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Simulator event dispatcher
 */
router.post('/test/trigger-event', (req, res) => {
  const { deviceId = 'cam1', type = 'button_press' } = req.body;
  if (!processRingEventFn) {
    return res.status(500).json({ success: false, error: 'Event processor not initialized' });
  }

  const now = Date.now();
  let payload;
  let message = '';

  switch (type) {
    case 'button_press':
      payload = {
        data: {
          type: 'button_press',
          attributes: { source: deviceId, source_type: 'devices', timestamp: now }
        }
      };
      message = `Doorbell rang at ${eventService.getDeviceLabel(deviceId)}. Quiet window started.`;
      processRingEventFn(payload);
      break;

    case 'courier_dropoff':
      payload = {
        data: {
          type: 'motion_detected',
          attributes: { source: deviceId, source_type: 'devices', timestamp: now, subType: 'human' }
        },
        _simulatedVisitDuration: 20000
      };
      message = `Courier visit (20s) detected at ${eventService.getDeviceLabel(deviceId)}. Delivery window started.`;
      processRingEventFn(payload);
      break;

    case 'resident_retrieval':
      payload = {
        data: {
          type: 'motion_detected',
          attributes: { source: deviceId, source_type: 'devices', timestamp: now, subType: 'human' }
        },
        _simulatedVisitDuration: 15000
      };
      const retRes = processRingEventFn(payload);
      if (retRes && retRes.event === 'retrieval') {
        message = `Resident picked up parcel from ${eventService.getDeviceLabel(deviceId)}. Resolved peacefully.`;
      } else {
        message = `Motion detected at ${eventService.getDeviceLabel(deviceId)} (no active delivery waiting).`;
      }
      break;

    case 'animal_motion':
      payload = {
        data: {
          type: 'motion_detected',
          attributes: { source: deviceId, source_type: 'devices', timestamp: now, subType: 'animal' }
        }
      };
      processRingEventFn(payload);
      message = `Animal motion filtered out at ${eventService.getDeviceLabel(deviceId)}. No alert triggered.`;
      break;

    case 'passerby_motion':
      payload = {
        data: {
          type: 'motion_detected',
          attributes: { source: deviceId, source_type: 'devices', timestamp: now, subType: 'human' }
        },
        _simulatedVisitDuration: 95000
      };
      processRingEventFn(payload);
      message = `Passerby motion (>60s) ignored at ${eventService.getDeviceLabel(deviceId)}.`;
      break;

    default:
      return res.status(400).json({ success: false, error: 'Unknown event type' });
  }

  res.json({ success: true, message, type, deviceId });
});

// Backward-compatible trigger webhook
router.post('/test/trigger-webhook', (req, res) => {
  const deviceId = req.body.deviceId || 'cam1';
  const payload = {
    data: {
      type: 'button_press',
      attributes: { source: deviceId, source_type: 'devices', timestamp: Date.now() }
    }
  };
  if (processRingEventFn) processRingEventFn(payload);
  res.json({ success: true, message: 'Test webhook processed' });
});

module.exports = router;
