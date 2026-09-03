# Package Whisperer

A Ring-integrated caretaking app that reduces alert fatigue for remote caretakers.

Built for the **Ring track** of the Amazon Developer Hackathon, with **AWS Builder** (Amazon Bedrock) as a mini-challenge integration.

## What it does

Package Whisperer watches for delivery events on a Ring doorbell/camera. Instead of alerting a caretaker immediately, it:

1. Detects a likely delivery (doorbell press, or a short human motion visit)
2. Gives the resident a window to retrieve it themselves — no alarm, no notification noise
3. If the package isn't retrieved within the window, generates a short, plain-language digest via **AWS Bedrock (Claude Haiku 4.5)** and notifies a remote caretaker

## Architecture

- **Ring API** — webhook-based real-time event delivery, HMAC-SHA256 signature verification
- **Event classifier** (`src/logic/classifyEvent.js`) — infers "likely delivery" from Ring's raw event types
- **Retrieval window** (`src/logic/retrievalWindow.js`) — state machine tracking pending deliveries and escalation timers
- **AWS Bedrock** (`src/aws/bedrockDigest.js`) — generates the caretaker-facing digest using Claude Haiku 4.5

## Setup

1. Clone this repo, run `npm install`
2. Create a `.env` file with your Ring and AWS credentials (see `.env.example` if provided)
3. Run `node server.js`
4. Expose locally with ngrok and register the URLs in Ring Developer Console

## Testing

- `node test.js` — classifier unit tests
- `node sendTestEvent.js` — simulate a delivery webhook
- `node sendRetrievalEvent.js` — simulate a retrieval
- `node testBedrock.js` — test Bedrock digest generation
