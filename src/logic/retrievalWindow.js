// Backwards-compatible facade forwarding to windowService
const windowService = require('../services/windowService');
const { getRetrievalWindowMs } = require('./settings');

function startRetrievalWindow(deviceId, deliveredAt = Date.now(), onEscalate, customWindowMs = null) {
  if (typeof onEscalate === 'function') {
    windowService.once('escalate', (data) => {
      if (data.deviceId === deviceId) {
        onEscalate(data.deviceId, data.deliveredAt);
      }
    });
  }
  return windowService.start(deviceId, deliveredAt, customWindowMs);
}

function checkRetrieval(deviceId, motionTimestamp = Date.now(), visitDurationMs = 0) {
  return windowService.checkRetrieval(deviceId, motionTimestamp, visitDurationMs);
}

function manualResolve(deviceId) {
  return windowService.resolve(deviceId);
}

function fastForward(deviceId) {
  return windowService.fastForward(deviceId);
}

function getPendingDeliveries() {
  return windowService.getAllPending();
}

function isPending(deviceId) {
  return windowService.isPending(deviceId);
}

module.exports = {
  startRetrievalWindow,
  checkRetrieval,
  manualResolve,
  fastForward,
  getPendingDeliveries,
  isPending,
  SHORT_VISIT_THRESHOLD_MS: windowService.SHORT_VISIT_THRESHOLD_MS,
  windowService
};