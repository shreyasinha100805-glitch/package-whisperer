const pendingDeliveries = new Map(); // deviceId -> { deliveredAt, timer }

const RETRIEVAL_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const SHORT_VISIT_THRESHOLD_MS = 60 * 1000; // 60 seconds

function startRetrievalWindow(deviceId, deliveredAt, onEscalate) {
  // Clear any existing timer for this device first
  if (pendingDeliveries.has(deviceId)) {
    clearTimeout(pendingDeliveries.get(deviceId).timer);
  }

  const timer = setTimeout(() => {
    if (pendingDeliveries.has(deviceId)) {
      pendingDeliveries.delete(deviceId);
      onEscalate(deviceId, deliveredAt);
    }
  }, RETRIEVAL_WINDOW_MS);

  pendingDeliveries.set(deviceId, { deliveredAt, timer });
}

function checkRetrieval(deviceId, motionTimestamp, visitDurationMs) {
  const pending = pendingDeliveries.get(deviceId);
  if (!pending) return false; // no delivery was waiting on this device

  const isShortVisit = visitDurationMs > 0 && visitDurationMs <= SHORT_VISIT_THRESHOLD_MS;
  const isAfterDelivery = motionTimestamp > pending.deliveredAt;

  if (isShortVisit && isAfterDelivery) {
    clearTimeout(pending.timer);
    pendingDeliveries.delete(deviceId);
    return true; // retrieved
  }

  return false;
}

function manualResolve(deviceId) {
  const pending = pendingDeliveries.get(deviceId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingDeliveries.delete(deviceId);
  return true;
}

module.exports = { startRetrievalWindow, checkRetrieval, manualResolve, RETRIEVAL_WINDOW_MS };