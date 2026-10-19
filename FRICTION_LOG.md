# Friction Log: Package Whisperer
> **Amazon Developer Hackathon (Build, Ship, Shape) — Ring Track & AWS Builder Mini Challenge**

This document records the specific developer experience friction, error handling edge-cases, and constructive feedback encountered while building **Package Whisperer** with the **Ring API / Webhooks** and **Amazon Bedrock Runtime SDK**.

---

## Friction Entry 1: Ring Webhook HMAC Header & Secret Documentation
- **Task Attempted:** Verifying incoming Ring webhooks with cryptographic HMAC-SHA256 signatures in Node.js.
- **Steps Taken:** 
  1. Configured the webhook endpoint `/webhook`.
  2. Inspected incoming headers on incoming Ring payloads.
  3. Checked Ring developer documentation for signature header keys and hashing algorithms.
- **Expected vs. Actual Result:** 
  - *Expected:* A clear code snippet on the main webhooks page showing the exact header key (e.g. `X-Signature` or `X-Ring-Signature`) and payload format.
  - *Actual:* Header formatting was mentioned inconsistently across older forum threads rather than prominently in the API quickstart.
- **Severity Rating:** Medium
- **Workaround Used:** Logged raw headers during a simulated webhook event and built a custom constant-time crypto comparison middleware with Node's built-in `crypto.timingSafeEqual()`.
- **Actionable Suggestion:** Add a 5-line Node.js / Python webhook signature verification snippet on the front page of the Ring Webhooks developer documentation.

---

## Friction Entry 2: Bedrock SDK Throttling Error Differentiation
- **Task Attempted:** Implementing retry & backoff logic for Amazon Bedrock Claude Haiku 4.5 (`@aws-sdk/client-bedrock-runtime`).
- **Steps Taken:** Implemented exponential backoff on SDK exceptions, including `ThrottlingException`.
- **Expected vs. Actual Result:**
  - *Expected:* The SDK error object would distinguish between a temporary per-second rate limit (retryable) and an account-level token quota exhaustion (non-retryable).
  - *Actual:* Both returned a generic `ThrottlingException`, causing the client to waste retry attempts when the account quota was exhausted.
- **Severity Rating:** Low
- **Workaround Used:** Parsed the raw `err.message` string with regular expressions to detect daily quota exhaustion and immediately trigger local tone fallback templates.
- **Actionable Suggestion:** Provide a structured error sub-code or header (e.g., `is_quota_exhausted: boolean`) on Bedrock runtime responses.

---

## Friction Entry 3: Local Webhook Emulation & Testing
- **Task Attempted:** Testing Ring event triggers (doorbell presses and motion detection) locally without requiring physical door hardware.
- **Steps Taken:** Set up a third-party tunnel (ngrok) and manual curl requests.
- **Expected vs. Actual Result:**
  - *Expected:* A first-party Ring developer CLI tool (similar to `stripe trigger` or `gh webhook`).
  - *Actual:* Had to build a custom in-app testing harness (`/simulator`) to trigger simulated signed webhook events.
- **Severity Rating:** Medium
- **Workaround Used:** Built an interactive web testing simulator (`http://localhost:3000/simulator`) that dispatches synthetic Ring webhooks locally.
- **Actionable Suggestion:** Release an official Ring CLI for developers to mock and dispatch event payloads directly to localhost.
