# Feature Requests: Package Whisperer
> **Amazon Developer Hackathon (Build, Ship, Shape) — Ring Track & AWS Builder Mini Challenge**

This document details prioritized developer feature requests for the **Ring Developer Platform** and **Amazon Bedrock Runtime** discovered while building Package Whisperer.

---

### 1. Standardized Ring Webhook TypeScript Types & JSON Schema
* **Priority:** Important
* **Target:** Ring Developer Platform / Webhooks
* **Why it matters:** Webhook payloads can vary slightly between device models and firmware generations (e.g., top-level `device_id` vs. nested `attributes` objects). An official npm package (`@ring/types`) or strict JSON schema would eliminate defensive type checking and accelerate safe development.

---

### 2. Ring Local CLI Webhook Emulator (`ring trigger`)
* **Priority:** Important
* **Target:** Ring Developer Tooling
* **Why it matters:** Currently, local testing of event-driven architectures requires physical devices or third-party reverse-proxy tunnels (like ngrok). A native CLI command like `ring trigger motion_detected` or `ring trigger button_press` with automatic signature generation would dramatically improve onboarding and local development speed.

---

### 3. Expose Ring AI Package Detection in Webhook Metadata
* **Priority:** Nice-to-have
* **Target:** Ring Webhooks API
* **Why it matters:** Ring doorbell hardware and cloud cameras already detect packages in the consumer mobile app. Exposing an explicit `is_package: true` attribute on developer webhook payloads would enable seamless ambient eldercare and smart delivery management without needing secondary heuristics.

---

### 4. Structured Error Sub-Codes for Bedrock Quota Limits
* **Priority:** Nice-to-have
* **Target:** Amazon Bedrock Runtime SDK
* **Why it matters:** `ThrottlingException` is currently raised for both momentary rate limits (which should be retried with exponential backoff) and account-level quota exhaustion (which should immediately trigger offline fallbacks). Adding a structured field or header would allow smarter client-side fallback handling.
