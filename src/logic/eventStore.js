// Backwards-compatible facade forwarding to eventService
const eventService = require('../services/eventService');
const config = require('../config');

function logEvent(entry) {
  return eventService.log(entry);
}

function getEvents(filter) {
  return eventService.getAll(filter);
}

function getLatestStatusByDevice() {
  return eventService.getLatestStatusByDevice();
}

function getStats() {
  return eventService.getStats();
}

function clearEvents() {
  return eventService.clear();
}

function seedDemoEvents() {
  return eventService.seedDemoEvents();
}

function deviceLabel(id) {
  return eventService.getDeviceLabel(id);
}

module.exports = {
  logEvent,
  getEvents,
  getLatestStatusByDevice,
  getStats,
  clearEvents,
  seedDemoEvents,
  deviceLabel,
  DEVICE_LABELS: config.devices,
  eventService
};