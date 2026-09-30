// Event-Driven Retrieval Window State Machine
const { EventEmitter } = require('events');
const config = require('../config');
const logger = require('../utils/logger');
const { getRetrievalWindowMs } = require('../logic/settings');

class WindowService extends EventEmitter {
  constructor() {
    super();
    this.pending = new Map();
    this.SHORT_VISIT_THRESHOLD_MS = config.defaults.shortVisitThresholdMs;
  }

  /**
   * Starts a retrieval countdown window for a specific device.
   */
  start(deviceId, deliveredAt = Date.now(), customWindowMs = null) {
    if (this.pending.has(deviceId)) {
      const existing = this.pending.get(deviceId);
      if (existing.timer) clearTimeout(existing.timer);
    }

    const windowMs = customWindowMs || getRetrievalWindowMs();

    const timer = setTimeout(() => {
      if (this.pending.has(deviceId)) {
        this.pending.delete(deviceId);
        logger.window(`Window expired for ${deviceId}. Triggering escalation event.`);
        this.emit('escalate', { deviceId, deliveredAt });
      }
    }, windowMs);

    const record = {
      deviceId,
      deliveredAt,
      windowMs,
      timer
    };

    this.pending.set(deviceId, record);

    const mins = Math.round(windowMs / 60000);
    logger.window(`Started ${mins}m window for ${deviceId}`, `(Expires at ${new Date(deliveredAt + windowMs).toLocaleTimeString()})`);

    this.emit('start', { deviceId, deliveredAt, windowMs, expiresAt: deliveredAt + windowMs });
    return record;
  }

  /**
   * Checks if incoming motion represents resident pickup.
   */
  checkRetrieval(deviceId, motionTimestamp = Date.now(), visitDurationMs = 0) {
    const item = this.pending.get(deviceId);
    if (!item) return false;

    const isShortVisit = visitDurationMs > 0 && visitDurationMs <= this.SHORT_VISIT_THRESHOLD_MS;
    const isAfterDelivery = motionTimestamp >= item.deliveredAt;

    if (isShortVisit && isAfterDelivery) {
      if (item.timer) clearTimeout(item.timer);
      this.pending.delete(deviceId);

      const elapsedSec = Math.round((motionTimestamp - item.deliveredAt) / 1000);
      this.emit('retrieved', { deviceId, deliveredAt: item.deliveredAt, elapsedSec });
      return true;
    }

    return false;
  }

  /**
   * Manual resolution (e.g. resident taps "Got it, thanks!")
   */
  resolve(deviceId) {
    const item = this.pending.get(deviceId);
    if (!item) return false;

    if (item.timer) clearTimeout(item.timer);
    this.pending.delete(deviceId);

    this.emit('retrieved', { deviceId, deliveredAt: item.deliveredAt, manual: true });
    return true;
  }

  /**
   * Fast-forward escalation (useful for demos and testing)
   */
  fastForward(deviceId) {
    const item = this.pending.get(deviceId);
    if (!item) return false;

    if (item.timer) clearTimeout(item.timer);
    this.pending.delete(deviceId);

    logger.window(`Fast-forwarding escalation for ${deviceId}`);
    this.emit('escalate', { deviceId, deliveredAt: item.deliveredAt, fastForwarded: true });
    return true;
  }

  isPending(deviceId) {
    return this.pending.has(deviceId);
  }

  /**
   * Returns active pending deliveries with remaining times.
   */
  getAllPending() {
    const list = [];
    const now = Date.now();

    for (const [deviceId, item] of this.pending.entries()) {
      const elapsedMs = Math.max(0, now - item.deliveredAt);
      const remainingMs = Math.max(0, item.windowMs - elapsedMs);
      list.push({
        deviceId,
        deliveredAt: item.deliveredAt,
        windowMs: item.windowMs,
        elapsedMs,
        remainingMs,
        expiresAt: item.deliveredAt + item.windowMs,
        progressPercent: Math.min(100, Math.round((elapsedMs / item.windowMs) * 100))
      });
    }

    return list;
  }

  clearAll() {
    for (const item of this.pending.values()) {
      if (item.timer) clearTimeout(item.timer);
    }
    this.pending.clear();
  }
}

const windowService = new WindowService();
module.exports = windowService;
