const express = require('express');
const crypto = require('crypto');
const { classifyEvent } = require('./src/logic/classifyEvent');
const { startRetrievalWindow, checkRetrieval, manualResolve } = require('./src/logic/retrievalWindow');
const { generateCaretakerDigest } = require('./src/aws/bedrockDigest');
const { logEvent, getEvents, getLatestStatusByDevice, getStats } = require('./src/logic/eventStore');
const { setTone, getTone } = require('./src/logic/settings');
require('dotenv').config();

const app = express();
const SIGNING_KEY = process.env.RING_HMAC_KEY;

const recentMotionByDevice = {};

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', SIGNING_KEY).update(rawBody).digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function deviceLabel(id) {
  const known = { cam1: 'Front door' };
  return known[id] || id;
}

async function handleEscalation(deviceId, deliveredAt) {
  const label = deviceLabel(deviceId);
  const tone = getTone();
  console.log(`⚠️  ESCALATION: Package at ${label} not retrieved. Generating caretaker digest (tone: ${tone})...`);
  try {
    const digest = await generateCaretakerDigest(label, deliveredAt, tone);
    console.log(`📨 Caretaker digest (AI-generated): ${digest}`);
    logEvent({ deviceId, status: 'escalated', digest, source: 'bedrock' });
  } catch (err) {
    console.error('Bedrock call failed, using fallback digest:', err.message);
    const fallback = `A package delivered at ${label} on ${new Date(deliveredAt).toLocaleString()} has not been picked up yet. Please check when you get a chance.`;
    console.log(`📨 Caretaker digest (fallback): ${fallback}`);
    logEvent({ deviceId, status: 'escalated', digest: fallback, source: 'fallback' });
  }
}

// Shared processing logic — used by both the real signed webhook and the internal test trigger
function processRingEvent(payload) {
  const deviceId = payload.data.attributes.source;
  const timestamp = payload.data.attributes.timestamp;

  if (payload.data.type === 'motion_detected') {
    const lastMotion = recentMotionByDevice[deviceId];
    const visitDuration = lastMotion ? timestamp - lastMotion : 0;
    recentMotionByDevice[deviceId] = timestamp;

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
}

app.get('/link', (req, res) => res.send('Account link placeholder'));
app.get('/home', (req, res) => res.send('App homepage placeholder'));
app.post('/token', express.json(), (req, res) => res.json({ status: 'placeholder' }));

// Manual resident self-resolution
app.post('/api/resident/resolve', express.json(), (req, res) => {
  const deviceId = req.body.deviceId || 'cam1';
  manualResolve(deviceId);
  logEvent({ deviceId, status: 'retrieved' });
  res.status(200).json({ success: true });
});

// Test-only: simulate an incoming Ring webhook without needing a real signed request
app.post('/api/test/trigger-webhook', express.json(), (req, res) => {
  const deviceId = 'cam1';
  const payload = {
    data: {
      type: 'button_press',
      attributes: { source: deviceId, source_type: 'devices', timestamp: Date.now() }
    }
  };
  processRingEvent(payload);
  res.status(200).json({ success: true });
});

app.post('/api/test/force-digest', express.json(), async (req, res) => {
  try {
    const deviceId = 'cam1';
    await handleEscalation(deviceId, Date.now());
    const events = getEvents();
    const latest = events[0];
    res.status(200).json({
      success: true,
      digest: latest.digest,
      source: latest.source === 'bedrock' ? 'Bedrock (Claude Haiku 4.5)' : 'Resilient Fallback'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings/tone', express.json(), (req, res) => {
  setTone(req.body.tone);
  res.status(200).json({ success: true, tone: getTone() });
});

app.get('/styles.css', (req, res) => {
  res.set('Content-Type', 'text/css');
  res.send(`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

    :root {
      --paper: #EFEEE9;
      --ink: #24231F;
      --ink-soft: #6B6A62;
      --sage: #5B7A5E;
      --amber: #C98A2C;
      --brick: #A8462F;
      --sky: #3F6C86;
      --line: #DAD7CC;
    }
    * { box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans', sans-serif; background: var(--paper); color: var(--ink); margin: 0; }
    a { color: var(--ink-soft); text-decoration: none; border-bottom: 1px solid var(--line); }
    a:hover { border-color: var(--ink-soft); }
    a:focus-visible, button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  `);
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Package Whisperer</title>
      <link rel="stylesheet" href="/styles.css">
      <style>
        .page { max-width: 640px; margin: 0 auto; padding: 80px 24px 60px; }
        .wordmark { font-size: 14px; letter-spacing: 0.02em; color: var(--ink-soft); margin: 0 0 48px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 42px; line-height: 1.15; margin: 0 0 20px; max-width: 16ch; }
        .lede { font-size: 17px; line-height: 1.6; color: var(--ink-soft); max-width: 46ch; margin: 0 0 40px; }
        .entries { display: grid; gap: 12px; margin-bottom: 56px; }
        .entry { display: block; border: 1px solid var(--line); border-radius: 6px; padding: 20px 22px; }
        .entry:hover { background: white; }
        .entry .label { font-weight: 600; font-size: 15px; color: var(--ink); display: block; margin-bottom: 4px; }
        .entry .desc { font-size: 14px; color: var(--ink-soft); }
        .steps { border-top: 1px solid var(--line); padding-top: 32px; }
        .steps h2 { font-size: 13px; font-weight: 600; color: var(--ink-soft); margin: 0 0 24px; }
        .step { display: flex; gap: 16px; margin-bottom: 20px; }
        .step .num { font-family: 'Fraunces', serif; font-size: 20px; color: var(--amber); width: 24px; flex-shrink: 0; }
        .step p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--ink); }
        .step p span { color: var(--ink-soft); }
        footer { margin-top: 56px; font-size: 13px; color: var(--ink-soft); }
      </style>
    </head>
    <body>
      <div class="page">
        <p class="wordmark">Package Whisperer</p>
        <h1>Some things don\u2019t need an alarm.</h1>
        <p class="lede">Package Whisperer watches your front door through Ring, and gives you time to grab a delivery yourself before it tells anyone else. No noise, no notifications \u2014 just a quiet plan for when you can\u2019t get there in time.</p>
        <div class="entries">
          <a class="entry" href="/resident"><span class="label">See the resident view</span><span class="desc">What the person at home sees \u2014 calm, and only when it matters.</span></a>
          <a class="entry" href="/caretaker"><span class="label">See the caretaker view</span><span class="desc">The activity log a family member checks in on remotely.</span></a>
        </div>
        <div class="steps">
          <h2>How it works</h2>
          <div class="step"><span class="num">1</span><p><span>Detect \u2014</span> a delivery arrives at the door, picked up from Ring\u2019s motion and doorbell events.</p></div>
          <div class="step"><span class="num">2</span><p><span>Wait \u2014</span> the resident gets a window to retrieve it themselves. Nothing is sent yet.</p></div>
          <div class="step"><span class="num">3</span><p><span>Notify \u2014</span> if it\u2019s still there after the window, a caretaker gets a short, plain-language note.</p></div>
        </div>
        <footer>Built on Ring and AWS Bedrock for the Amazon Developer Hackathon.</footer>
      </div>
    </body>
    </html>
  `);
});

app.get('/resident', (req, res) => {
  const latest = getLatestStatusByDevice();
  const devices = Object.values(latest);

  const plaques = devices.map(e => {
    const isClear = e.status === 'retrieved';
    const statusWord = isClear ? 'All clear' : 'Something\u2019s waiting';
    const supportLine = isClear
      ? 'Nothing at the door right now.'
      : 'A delivery arrived. Grab it whenever suits you \u2014 no rush.';
    const gotItButton = isClear ? '' : `<button class="got-it" onclick="markResolved('${e.deviceId}')">Got it, thanks!</button>`;
    return `
      <div class="plaque ${isClear ? 'clear' : 'waiting'}">
        <p class="location">${deviceLabel(e.deviceId)}</p>
        <p class="status-word">${statusWord}</p>
        <p class="support">${supportLine}</p>
        ${gotItButton}
      </div>`;
  }).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Package Whisperer \u2014 Home</title>
      <meta http-equiv="refresh" content="5">
      <link rel="stylesheet" href="/styles.css">
      <style>
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: radial-gradient(circle at 50% 35%, #f7f3ea 0%, var(--paper) 60%); }
        .wrap { width: 100%; max-width: 420px; padding: 24px; text-align: center; }
        .plaque { background: white; border: 1px solid var(--line); border-radius: 6px; padding: 48px 32px; margin-bottom: 16px; position: relative; }
        .plaque.clear { border-top: 3px solid var(--sage); box-shadow: 0 0 60px -20px rgba(91,122,94,0.35); }
        .plaque.waiting { border-top: 3px solid var(--amber); box-shadow: 0 0 60px -20px rgba(201,138,44,0.4); }
        .location { font-size: 13px; color: var(--ink-soft); margin: 0 0 20px; letter-spacing: 0.02em; }
        .status-word { font-family: 'Fraunces', serif; font-size: 34px; font-weight: 500; line-height: 1.15; margin: 0 0 12px; }
        .plaque.clear .status-word { color: var(--sage); }
        .plaque.waiting .status-word { color: var(--amber); }
        .support { color: var(--ink-soft); font-size: 15px; line-height: 1.5; margin: 0 0 20px; max-width: 32ch; margin-inline: auto; }
        .got-it { font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; font-weight: 600; background: var(--sage); color: white; border: none; border-radius: 5px; padding: 10px 20px; cursor: pointer; }
        .got-it:hover { opacity: 0.9; }
        .switch { display: block; margin-top: 8px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        ${plaques || '<div class="plaque clear"><p class="status-word">All clear</p><p class="support">No deliveries yet.</p></div>'}
        <a class="switch" href="/caretaker">Switch to caretaker view</a>
      </div>
      <script>
        async function markResolved(deviceId) {
          await fetch('/api/resident/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
          });
          location.reload();
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/caretaker', (req, res) => {
  const events = getEvents();
  const stats = getStats();
  const currentTone = getTone();
  const statusLabelMap = { pending: 'Waiting', retrieved: 'Retrieved', escalated: 'Needs attention' };

  const rows = events.map(e => `
    <tr>
      <td class="time">${new Date(e.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${deviceLabel(e.deviceId)}</td>
      <td><span class="dot ${e.status}"></span>${statusLabelMap[e.status] || e.status}</td>
      <td class="digest">
        ${e.digest ? `\u201C${e.digest}\u201D` : '\u2014'}
        ${e.source ? `<span class="badge ${e.source}">${e.source === 'bedrock' ? 'Bedrock' : 'Fallback'}</span>` : ''}
      </td>
    </tr>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Package Whisperer \u2014 Caretaker log</title>
      <meta http-equiv="refresh" content="8">
      <link rel="stylesheet" href="/styles.css">
      <style>
        .page { max-width: 780px; margin: 56px auto; padding: 0 24px; }
        h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
        .sub { color: var(--ink-soft); font-size: 14px; margin: 0 0 28px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat { background: white; border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; }
        .stat .num { font-family: 'Fraunces', serif; font-size: 26px; display: block; margin-bottom: 2px; }
        .stat .label { font-size: 12px; color: var(--ink-soft); }
        .stat.total .num { color: var(--sky); }
        .stat.resolved .num { color: var(--sage); }
        .stat.escalated .num { color: var(--brick); }

        .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; background: white; border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px; margin-bottom: 24px; }
        .controls button {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 600;
          border: none; border-radius: 4px; padding: 9px 16px; cursor: pointer; color: white;
        }
        #forceBtn { background: var(--amber); }
        #webhookBtn { background: var(--sky); }
        .controls button:hover { opacity: 0.9; }
        .controls button:disabled { opacity: 0.6; cursor: default; }
        .controls select {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; padding: 8px 10px;
          border: 1px solid var(--line); border-radius: 4px; background: var(--paper); color: var(--ink);
        }
        .controls .ok { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 3px; }
        .controls .ok.bedrock { background: rgba(63,108,134,0.12); color: var(--sky); }
        .controls .ok.fallback { background: rgba(107,106,98,0.12); color: var(--ink-soft); }
        .controls .divider { width: 1px; align-self: stretch; background: var(--line); margin: 0 4px; }

        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 12px; font-weight: 500; color: var(--ink-soft); padding: 0 12px 10px; border-bottom: 1px solid var(--line); }
        td { padding: 14px 12px; border-bottom: 1px solid var(--line); font-size: 14px; vertical-align: top; }
        .time { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink-soft); white-space: nowrap; }
        .digest { color: var(--ink-soft); max-width: 340px; }
        .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 8px; }
        .dot.pending { background: var(--amber); }
        .dot.retrieved { background: var(--sage); }
        .dot.escalated { background: var(--brick); }
        .badge { display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 3px; letter-spacing: 0.02em; }
        .badge.bedrock { background: rgba(63,108,134,0.12); color: var(--sky); }
        .badge.fallback { background: rgba(107,106,98,0.12); color: var(--ink-soft); }
        .empty { color: var(--ink-soft); padding: 24px 12px; }
      </style>
    </head>
    <body>
      <div class="page">
        <h1>Caretaker log</h1>
        <p class="sub">Front door activity \u00b7 <a href="/resident">See resident view</a></p>

        <div class="stats">
          <div class="stat total"><span class="num">${stats.total}</span><span class="label">Total events</span></div>
          <div class="stat resolved"><span class="num">${stats.resolvedRate}%</span><span class="label">Self-resolved</span></div>
          <div class="stat escalated"><span class="num">${stats.escalated}</span><span class="label">Needed a nudge</span></div>
        </div>

        <div class="controls">
          <button id="webhookBtn" onclick="triggerWebhook()">Trigger test webhook</button>
          <div class="divider"></div>
          <button id="forceBtn" onclick="forceDigest()">Force Bedrock escalation</button>
          <select id="toneSelect" onchange="updateTone()">
            <option value="gentle" ${currentTone === 'gentle' ? 'selected' : ''}>Gentle reminder</option>
            <option value="direct" ${currentTone === 'direct' ? 'selected' : ''}>Direct & concise</option>
            <option value="urgent" ${currentTone === 'urgent' ? 'selected' : ''}>Urgent / wellbeing check</option>
          </select>
          <span id="forceResult"></span>
        </div>

        <table>
          <tr><th>Time</th><th>Location</th><th>Status</th><th>Note</th></tr>
          ${rows || '<tr><td class="empty" colspan="4">No activity yet.</td></tr>'}
        </table>
      </div>

      <script>
        async function triggerWebhook() {
          const btn = document.getElementById('webhookBtn');
          btn.disabled = true;
          btn.textContent = 'Sending\u2026';
          await fetch('/api/test/trigger-webhook', { method: 'POST' });
          setTimeout(() => location.reload(), 600);
        }

        async function updateTone() {
          const tone = document.getElementById('toneSelect').value;
          await fetch('/api/settings/tone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tone })
          });
        }

        async function forceDigest() {
          const btn = document.getElementById('forceBtn');
          const result = document.getElementById('forceResult');
          btn.disabled = true;
          btn.textContent = 'Generating\u2026';
          result.textContent = '';

          try {
            const res = await fetch('/api/test/force-digest', { method: 'POST' });
            const data = await res.json();
            result.textContent = data.success ? 'Mode: ' + data.source : 'Error: ' + data.error;
            result.className = data.source && data.source.includes('Bedrock') ? 'ok bedrock' : 'ok fallback';
          } catch (e) {
            result.textContent = 'Request failed';
            result.className = 'ok fallback';
          }

          btn.disabled = false;
          btn.textContent = 'Force Bedrock escalation';
          setTimeout(() => location.reload(), 1200);
        }
      </script>
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
  processRingEvent(req.body);
});

app.listen(3000, () => console.log('Running on port 3000'));