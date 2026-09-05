const events = [];

function logEvent(entry) {
  events.unshift({ ...entry, timestamp: entry.timestamp || Date.now() });
  if (events.length > 50) events.pop();
}

function getEvents() {
  return events;
}

module.exports = { logEvent, getEvents };