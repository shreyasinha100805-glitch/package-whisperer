const events = [];

function logEvent(entry) {
  events.unshift({ ...entry, timestamp: entry.timestamp || Date.now() });
  if (events.length > 50) events.pop();
}

function getEvents() {
  return events;
}

function getLatestStatusByDevice() {
  const latest = {};
  for (const e of events) {
    if (!latest[e.deviceId]) latest[e.deviceId] = e;
  }
  return latest;
}

function getStats() {
  const total = events.length;
  const escalated = events.filter(e => e.status === 'escalated').length;
  const retrieved = events.filter(e => e.status === 'retrieved').length;
  const resolvedRate = total > 0 ? Math.round((retrieved / total) * 100) : 0;
  return { total, escalated, retrieved, resolvedRate };
}

module.exports = { logEvent, getEvents, getLatestStatusByDevice, getStats };