// Event Store and Metrics Service
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const DATA_FILE = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join('/tmp', 'events.json')
  : path.join(__dirname, '../../data/events.json');

class EventService {
  constructor() {
    this.events = [];
    this.loadPersistedEvents();
  }

  getDeviceLabel(id) {
    return config.devices[id]?.name || id;
  }

  loadPersistedEvents() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed;
        }
      }
    } catch (e) {
      // Ignore cache read errors
    }

    if (this.events.length === 0) {
      this.seedDemoEvents();
    }
  }

  persist() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.events.slice(0, 100), null, 2));
    } catch (e) {
      // Fail silently, in-memory works
    }
  }

  log(entry) {
    const timestamp = entry.timestamp || Date.now();
    const id = entry.id || `evt_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    const label = entry.deviceLabel || this.getDeviceLabel(entry.deviceId);

    const record = {
      id,
      deviceId: entry.deviceId || 'cam1',
      deviceLabel: label,
      status: entry.status || 'pending', // 'pending' | 'retrieved' | 'escalated' | 'held'
      timestamp,
      reason: entry.reason || null,
      digest: entry.digest || null,
      source: entry.source || null,
      tone: entry.tone || null,
      latencyMs: entry.latencyMs || null
    };

    this.events.unshift(record);
    if (this.events.length > 100) this.events.pop();

    this.persist();
    return record;
  }

  getAll(filter = {}) {
    let list = [...this.events];
    if (filter.status && filter.status !== 'all') {
      list = list.filter(e => e.status === filter.status);
    }
    if (filter.deviceId && filter.deviceId !== 'all') {
      list = list.filter(e => e.deviceId === filter.deviceId);
    }
    if (filter.limit) {
      list = list.slice(0, Number(filter.limit));
    }
    return list;
  }

  getLatestStatusByDevice() {
    const latest = {};
    for (const [id, dev] of Object.entries(config.devices)) {
      latest[id] = {
        deviceId: id,
        deviceLabel: dev.name,
        status: 'retrieved',
        timestamp: Date.now(),
        digest: null
      };
    }

    for (const e of this.events) {
      if (latest[e.deviceId]) {
        if (latest[e.deviceId].status === 'retrieved' && e.status !== 'retrieved') {
          latest[e.deviceId] = e;
        } else if (!latest[e.deviceId].timestamp || e.timestamp >= latest[e.deviceId].timestamp) {
          latest[e.deviceId] = e;
        }
      } else {
        latest[e.deviceId] = e;
      }
    }

    return latest;
  }

  getStats() {
    const total = this.events.length;
    const escalated = this.events.filter(e => e.status === 'escalated').length;
    const retrieved = this.events.filter(e => e.status === 'retrieved').length;
    const held = this.events.filter(e => e.status === 'held').length;
    const pending = this.events.filter(e => e.status === 'pending').length;
    const resolvedRate = total > 0 ? Math.round((retrieved / total) * 100) : 100;

    return { total, escalated, retrieved, held, pending, resolvedRate };
  }

  clear() {
    this.events = [];
    this.persist();
    logger.info('Event history cleared.');
  }

  seedDemoEvents() {
    const now = Date.now();
    this.events = [
      {
        id: 'demo_1',
        deviceId: 'cam1',
        deviceLabel: 'Front door',
        status: 'retrieved',
        timestamp: now - 35 * 60 * 1000,
        reason: 'Resident retrieved package within quiet window',
        digest: null,
        source: null,
        tone: null
      },
      {
        id: 'demo_2',
        deviceId: 'cam2',
        deviceLabel: 'Back door',
        status: 'retrieved',
        timestamp: now - 2 * 60 * 60 * 1000,
        reason: 'Doorbell delivery retrieved',
        digest: null,
        source: null,
        tone: null
      },
      {
        id: 'demo_3',
        deviceId: 'cam1',
        deviceLabel: 'Front door',
        status: 'escalated',
        timestamp: now - 5 * 60 * 60 * 1000,
        reason: 'Package uncollected past retrieval window',
        digest: 'A package arrived at the front door earlier today and is still outside. Whenever you have a free moment, please check in on it.',
        source: 'bedrock',
        tone: 'gentle',
        latencyMs: 740
      }
    ];
    this.persist();
    logger.info('Demo seed data loaded.');
  }
}

const eventService = new EventService();
module.exports = eventService;
