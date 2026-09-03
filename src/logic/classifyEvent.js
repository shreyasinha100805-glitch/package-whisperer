function classifyEvent(payload, recentMotionEvents = []) {
  const type = payload.data.type;
  const deviceId = payload.data.attributes.source;
  const timestamp = payload.data.attributes.timestamp;
  const subType = payload.data.attributes.subType;

  if (type === 'button_press') {
    return { isDelivery: true, confidence: 'high', reason: 'doorbell_press' };
  }

  if (type === 'motion_detected') {
    if (subType && subType !== 'human') {
      return { isDelivery: false, confidence: 'low', reason: `motion_${subType}_not_human` };
    }

    const relatedMotion = recentMotionEvents.filter((e) => e.deviceId === deviceId);
    const visitDurationMs = relatedMotion.length ? timestamp - relatedMotion[0].timestamp : 0;
    const SHORT_VISIT_THRESHOLD_MS = 60 * 1000;

    if (visitDurationMs > 0 && visitDurationMs <= SHORT_VISIT_THRESHOLD_MS) {
      return { isDelivery: true, confidence: 'medium', reason: 'short_visit_pattern' };
    }
    return { isDelivery: false, confidence: 'low', reason: 'motion_only_no_pattern' };
  }

  return { isDelivery: false, confidence: 'n/a', reason: 'unhandled_event_type' };
}

module.exports = { classifyEvent };