const express = require('express');
const crypto = require('crypto');
const { classifyEvent } = require('./src/logic/classifyEvent');
const { startRetrievalWindow, checkRetrieval } = require('./src/logic/retrievalWindow');
const { generateCaretakerDigest } = require('./src/aws/bedrockDigest');
const { logEvent, getEvents } = require('./src/logic/eventStore');
require('dotenv').config();

const app = express();
const SIGNING_KEY = process.env.RING_HMAC_KEY;

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', SIGNING_KEY).update(rawBody).digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function handleEscalation(deviceId, deliveredAt) {
  console.log(`⚠️  ESCALATION: Package at ${deviceId} not retrieved. Generating caretaker digest...`);
  try {
    const digest = await generateCaretakerDigest(deviceId, deliveredAt);
    console.log(`📨 Caretaker digest (AI-generated): ${digest}`);
    logEvent({ deviceId, status: 'escalated', digest });
  } catch (err) {
    console.error('Bedrock call failed, using fallback digest:', err.message);
    const fallback = `A package delivered at ${deviceId} on ${new Date(deliveredAt).toLocaleString()} has not been picked up yet. Please check when you get a chance.`;
    console.log(`📨 Caretaker digest (fallback): ${fallback}`);
    logEvent({ deviceId, status: 'escalated', digest: fallback });
  }
}

app.get('/link', (req, res) => res.send('Account link placeholder'));
app.get('/home', (req, res) => res.send('App homepage placeholder'));
app.post('/token', express.json(), (req, res) => res.json({ status: 'placeholder' }));

app.get('/dashboard', (req, res) => {
  const events = getEvents();
  const rows = events.map(e => `
    <tr>
      <td>${new Date(e.timestamp).toLocaleString()}</td>
      <td>${e.deviceId}</td>
      <td class="status-${e.status}">${e.status}</td>
      <td>${e.digest || '-'}</td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Package Whisperer Dashboard</title>
      <meta http-equiv="refresh" content="5">
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f7f7f8; }
        h1 { color: #2d2d2d; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #2d2d2d; color: white; }
        .status-pending { color: #b8860b; font-weight: 600; }
        .status-retrieved { color: #2e7d32; font-weight: 600; }
        .status-escalated { color: #c62828; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>📦 Package Whisperer</h1>
      <p>Live activity feed — auto-refreshes every 5 seconds</p>
      <table>
        <tr><th>Time</th><th>Device</th><th>Status</th><th>Caretaker Digest</th></tr>
        ${rows || '<tr><td colspan="4">No events yet</td></tr>'}
      </table>
    </body>
    </html>
  `);
});

app.post('/webhook', express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}), (req, res) => {
  const signature = req.headers['x-signature'];
  if (!verifySignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.sendStatus(200);

  const payload = req.body;
  const deviceId = payload.data.attributes.source;
  const timestamp = payload.data.attributes.timestamp;

  if (payload.data.type === 'motion_detected') {
    const visitDuration = 30000;
    const wasRetrieval = checkRetrieval(deviceId, timestamp, visitDuration);
    if (wasRetrieval) {
      console.log(`✅ Package at ${deviceId} retrieved. Logged, no alert.`);
      logEvent({ deviceId, status: 'retrieved' });
      return;
    }
  }

  const result = classifyEvent(payload);
  console.log('Event classified:', result);

  if (result.isDelivery) {
    startRetrievalWindow(deviceId, timestamp, handleEscalation);
    console.log(`📦 Delivery detected at ${deviceId}. Retrieval window started.`);
    logEvent({ deviceId, status: 'pending' });
  }
});

app.listen(3000, () => console.log('Running on port 3000'));