# Package Whisperer 📦

A Ring-integrated caretaking app that protects resident independence and eliminates alert fatigue for remote caregivers and families.

Built for the **Ring track** of the Amazon Developer Hackathon, with **AWS Builder** (Amazon Bedrock — Claude Haiku 4.5) as the intelligence engine.

---

## 💡 What it does

Most smart cameras trigger blaring chimes and phone buzzes for every passing courier, delivery truck, or neighbor walking a dog. For elderly residents and remote caregivers, this creates intense alert fatigue and anxiety.

**Package Whisperer** watches for front door deliveries and quietly handles them:

1. **Detects legitimate drop-offs** (doorbell rings or short courier human visits under 60 seconds).
2. **Gives the resident a peaceful retrieval window** (customizable, default 4 hours; or 30s demo mode) to bring packages inside on their own. No siren, no frantic alarms.
3. **If picked up**, the state machine resolves peacefully and logs independence metrics.
4. **If unretrieved**, checks **Quiet Hours** (10 PM – 7 AM). If active, notifications are held until morning.
5. **Generates an empathetic AI digest** using **Amazon Bedrock (Claude Haiku 4.5)** calibrated to the caregiver's tone preference (*Gentle family reminder*, *Direct & concise*, or *Urgent wellbeing check-in*).

---

## 🎨 Beautiful Frontend & User Experience

- **🛡️ Caretaker Hub (`/caretaker`)**:
  - Live active delivery card with a real-time countdown timer before escalation.
  - Key performance metrics: Deliveries Watched, Self-Resolved Rate %, Caregiver Escalations, Active Windows.
  - Interactive activity timeline with filtering (All, Retrieved, Waiting, Escalated, Quiet).
  - Multi-tone AI tone selector with instant persistence.
  - Non-blocking real-time polling (zero screen flicker or page reloads).
- **🏡 Resident Calm Screen (`/resident`)**:
  - Distraction-free ambient UI designed for in-home wall displays or smart tablets.
  - Gentle pulsing status indicator ("Porch is peaceful" vs "Delivery resting outside").
  - Tactile, one-tap **"✓ Got it, thank you!"** button with soothing synthesized audio cues (Web Audio API).
- **⚡ Simulator & Lab (`/simulator`)**:
  - Full interactive test console to trigger Doorbell rings, Courier drop-offs, Resident pickups, Animal motions, and Passerby walk-bys.
  - Fast-forward button to immediately expire delivery windows for live hackathon demos.
  - Live Amazon Bedrock payload and response inspector.
- **📐 Architecture & Flow (`/?view=architecture`)**:
  - Visual interactive breakdown of the end-to-end ingestion and AI pipeline.

---

## 🏛️ Architecture & Backend Feasibility

- **Ring API Webhook Ingestion**: Cryptographic HMAC-SHA256 signature verification (`X-Signature` header vs `RING_HMAC_KEY`).
- **Event Classifier (`src/logic/classifyEvent.js`)**: Robust heuristics filtering out pets, animal motion, and long passerby visits.
- **Retrieval State Machine (`src/logic/retrievalWindow.js`)**: Real-time timer tracking, active countdown calculations, and fast-forward escalation support.
- **Quiet Hours Interceptor (`src/logic/settings.js`)**: Pauses nighttime alerts until morning to prevent caregiver sleep disruption.
- **Resilient Bedrock Engine (`src/aws/bedrockDigest.js`)**: Invokes Anthropic Claude Haiku 4.5 on Amazon Bedrock. Includes automatic fallback engine protecting against 429 token quota throttling.
- **Persistent Event Store (`src/logic/eventStore.js`)**: Fast in-memory state with local JSON persistence for surviving restarts.

---

## 🚀 Getting Started

### 1. Installation

```bash
git clone https://github.com/shreyasinha100805-glitch/package-whisperer.git
cd package-whisperer
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
RING_CLIENT_ID=your_ring_client_id
RING_CLIENT_SECRET=your_ring_client_secret
RING_HMAC_KEY=your_hmac_secret_key

AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
PORT=3000
```

### 3. Start Server

```bash
node server.js
```

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Simulation

| Command | Purpose |
|---|---|
| `node test.js` | Runs unit tests for the event classifier |
| `node testBedrock.js` | Tests Amazon Bedrock Claude Haiku 4.5 digest generation |
| `node sendTestEvent.js` | Sends an HMAC-signed test Ring webhook (`button_press`) |
| `node sendRetrievalEvent.js` | Sends an HMAC-signed resident pickup webhook |
| **Interactive UI Simulator** | Access `http://localhost:3000/simulator` to test every scenario with one click |

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | Comprehensive real-time system state, active countdowns, settings, and stats |
| `/api/events` | GET | Filterable event history log |
| `/api/resident/resolve` | POST | Resident marks a package as collected |
| `/api/settings/tone` | POST | Set AI digest tone (`gentle`, `direct`, `urgent`) |
| `/api/settings/quiet-hours` | POST | Toggle or update quiet hours schedule |
| `/api/settings/window` | POST | Set retrieval window minutes (e.g. 0.5 for 30s demo mode, 240 for 4 hours) |
| `/api/test/trigger-event` | POST | Simulator event dispatcher (`button_press`, `courier_dropoff`, `resident_retrieval`, `animal_motion`) |
| `/api/test/fast-forward` | POST | Instantly expires active delivery window for demoing caregiver escalation |
| `/api/test/force-digest` | POST | Generates Bedrock AI digest immediately with prompt and latency metrics |
| `/webhook` | POST | Ring Webhook endpoint with HMAC-SHA256 verification |
