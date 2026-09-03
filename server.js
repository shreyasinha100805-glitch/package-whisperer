const express = require('express');
const crypto = require('crypto');
const { classifyEvent } = require('./src/logic/classifyEvent');
const { startRetrievalWindow, checkRetrieval } = require('./src/logic/retrievalWindow');
const { generateCaretakerDigest } = require('./src/aws/bedrockDigest');
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
    console.log(`📨 Caretaker digest: ${digest}`);
  } catch (err) {
    console.error('Failed to generate digest:', err.message);
  }
}

app.get('/link', (req, res) => res.send('Account link placeholder'));
app.get('/home', (req, res) => res.send('App homepage placeholder'));
app.post('/token', express.json(), (req, res) => res.json({ status: 'placeholder' }));

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
      return;
    }
  }

  const result = classifyEvent(payload);
  console.log('Event classified:', result);

  if (result.isDelivery) {
    startRetrievalWindow(deviceId, timestamp, handleEscalation);
    console.log(`📦 Delivery detected at ${deviceId}. Retrieval window started.`);
  }
});

app.listen(3000, () => console.log('Running on port 3000'));