const crypto = require('crypto');
require('dotenv').config();

const SIGNING_KEY = process.env.RING_HMAC_KEY;

const payload = {
  meta: {
    version: '1.1',
    time: new Date().toISOString(),
    request_id: 'test-request-001',
    account_id: 'test-account'
  },
  data: {
    id: 'cam1_button_press_123',
    type: 'button_press',
    attributes: {
      source: 'cam1',
      source_type: 'devices',
      timestamp: Date.now()
    }
  }
};

const body = JSON.stringify(payload);
const signature = 'sha256=' + crypto.createHmac('sha256', SIGNING_KEY).update(body).digest('hex');

fetch('http://localhost:3000/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature
  },
  body
}).then(res => console.log('Response status:', res.status));