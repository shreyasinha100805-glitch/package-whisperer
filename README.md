# Package Whisperer 📦
> **Thoughtful, Dignified Caretaking for Ring — Powered by Amazon Bedrock**  
> *Built by Shreya Sinha for the **Ring Track** of the Amazon Developer Hackathon (Build, Ship, Shape)*

[![Ring Track](https://img.shields.io/badge/Track-Ring-0073EC?style=flat-square&logo=ring&logoColor=white)](https://ring.com)
[![Amazon Bedrock](https://img.shields.io/badge/AWS-Amazon_Bedrock-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Claude Haiku 4.5](https://img.shields.io/badge/Model-Claude_Haiku_4.5-D97706?style=flat-square&logo=anthropic&logoColor=white)](https://aws.amazon.com/bedrock/claude/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)

---

## 🙋‍♀️ Why I Built Package Whisperer

Smart video doorbells are incredible pieces of technology, but if you've ever watched an elderly family member live with one, you quickly notice something frustrating: **they are ridiculously loud, intrusive, and anxiety-inducing.**

Every time a courier drops a parcel on the porch, two things happen at once:
1. **The in-home chime blares:** The resident jumps, feels startled, or rushes to the front door before they've even put their slippers on.
2. **The remote caregiver's phone buzzes:** The daughter or son gets an alert 100 miles away. They immediately worry: *"Who is at Mom's door? Did she order something? Did she fall trying to pick it up?"* They text or call immediately, stripping their parent of dignity over a simple cardboard box.

I wanted to fix this. I didn't want to build another military-sounding surveillance algorithm with a name like `PerimeterGuard-v3`. 

I named my project **Package Whisperer** because a good caregiver shouldn't yell—they should whisper. 

Package Whisperer integrates directly with **Ring Doorbell & Camera webhooks**. It quietly notices when a delivery arrives, gives the resident a peaceful 4-hour window to retrieve their package at their own pace with zero noisy alarms, and only reaches out to family caregivers if the package remains uncollected. And when it does reach out, it uses **Amazon Bedrock (Claude Haiku 4.5)** to write a warm, empathetic check-in note instead of an alarming push notification.

---

## 📦 What It Actually Does (The 5-Step Pipeline)

Here is how the entire system works from front door to caregiver notification:

1. **Ingests Ring Webhooks in Real Time:** When someone rings the doorbell (`button_press`) or steps onto the porch (`motion_detected`), the Ring webhook hits my server. I verify the cryptographic HMAC-SHA256 signature to guarantee the request came from Ring.
2. **Filters Out Noise & Animals:** My classifier checks the event pattern. If it's a neighborhood dog, a raccoon, or a passerby walking their dog, it's ignored. If it's a doorbell ring or a short courier drop-off (<60 seconds), it starts a delivery window.
3. **Starts a Peaceful Grace Period (No Sirens!):** Instead of blaring alarms, the app enters a silent grace period (default 4 hours, or 30 seconds in demo mode). The in-home ambient tablet (`/resident`) displays a warm, gentle message: *"A delivery is resting on the porch."*
4. **Detects Independent Pickup:** When the resident picks up the package (or taps the single tactile *"Got it, thank you!"* button on their tablet), the delivery resolves peacefully with a soothing sound. It logs an **Independence Score** showing they handled it themselves.
5. **Quiet Hours & Bedrock AI Escalation:** If the package is still outside when the window closes, Package Whisperer checks **Quiet Hours (10 PM – 7 AM)**. If it's nighttime, it holds the alert until morning so caregivers can sleep. During daytime, it invokes **Amazon Bedrock (Claude Haiku 4.5)** to compose an empathetic, human-sounding notification in the caregiver's chosen tone (*Gentle*, *Direct*, or *Urgent*).

---

## 🛠️ Built With

I built Package Whisperer around the **Ring Track** requirements and paired it with AWS intelligence:

| Tool / API | Role in My Project | Why I Chose It |
|---|---|---|
| **Ring API & Webhooks** *(Required Track Tool)* | Ingests real-time doorbell presses (`button_press`), motion alerts, and visit telemetry. | Ring is installed on millions of homes; turning it into a proactive caretaking device has immediate real-world utility. |
| **Amazon Bedrock (Claude Haiku 4.5)** | Generates personalized, empathetic caretaker digests. | Blazing fast inference (~300ms), exceptional prompt adherence, and zero customer data used for training. |
| **Node.js (v22) & Express 5.x** | Core backend state machine, timer scheduler, and REST API. | Native async error handling and sub-10ms response times. |
| **Web Audio API** | Generates calming ambient audio cues for the resident tablet UI. | Plays pleasant chords without needing external MP3 audio assets. |
| **Vercel** | Serverless deployment and cloud hosting. | Instant global distribution for remote caregivers on mobile devices. |
| **Cursor & Claude 3.7** | AI pair programming assistant. | Helped me quickly write unit test suites, refine CSS layouts, and structure HMAC security middleware. |

---

## 💬 My Product Feedback for the Teams Building Ring & AWS Bedrock

*As part of the Build, Ship, Shape submission, here is my honest, detailed developer feedback based on building this app from scratch:*

### 1. Feedback for the Ring Team (Ring API & Webhooks)

* **What I used it for:**  
  I used Ring Webhooks to capture doorbell rings (`button_press`) and front porch motion events (`motion_detected`) in real time, validating every payload with HMAC-SHA256 signatures (`X-Signature`).

* **What worked really well:**  
  - **Speed:** Webhook delivery was almost instantaneous (<350ms from physical event to server receipt).
  - **Motion Subtypes:** Having `human` vs `animal` motion tags in the payload was huge—it allowed me to filter out neighborhood pets and prevent false alarms with simple logic.
  - **HMAC Verification:** The cryptographic signature approach is clean, secure, and easy to verify using Node's built-in `crypto` library.

* **What needs work (constructive feedback):**  
  - **Standardized Webhook Schemas:** Depending on which Ring device model fires the webhook, the property names sometimes shift (e.g. `source` vs `device_id`, or nested `attributes` objects). A typed JSON schema or official TypeScript package would save builders a lot of defensive parsing code.
  - **Local Webhook Testing CLI:** Testing webhooks locally currently requires setting up third-party tunnels like ngrok. If Ring had a local CLI like Stripe (`ring trigger button_press`), zero-to-hello-world onboarding would be 5x faster.
  - **Exposing Package Detection in Webhooks:** Ring cameras already have package detection in the official consumer app, but that metadata isn't always exposed as a clean boolean on developer webhooks. Having an explicit `is_package: true` flag would make caretaking apps even more powerful.

* **How onboarding felt (zero to hello world):**  
  **4 / 5.** Creating my developer app and receiving the first webhook took under 20 minutes. The hardest part was finding the exact header naming convention for HMAC verification, which was tucked away in forum threads rather than the front page of the docs.

* **Would I build with it again?**  
  **Yes, definitely.** Ring has the hardware reliability and massive install base that makes building real-world consumer apps exciting.

---

### 2. Feedback for the AWS Bedrock Team (Bedrock Runtime & Claude Haiku 4.5)

* **What I used it for:**  
  I used Amazon Bedrock to run **Anthropic Claude Haiku 4.5** (`us.anthropic.claude-haiku-4-5-20251001-v1:0`). When a package is uncollected, Bedrock turns raw timestamp data into an empathetic, one-sentence digest calibrated to the caregiver's selected tone (*Gentle*, *Direct*, or *Urgent*).

* **What worked really well:**  
  - **Inference Latency:** Haiku 4.5 consistently responded in **250ms – 400ms**. That’s fast enough to feel like a native local service.
  - **Negative Constraint Adherence:** When I instructed the model: *"Respond with ONLY the notification text — no headers, no quotes, no markdown"*, it followed it 100% of the time. It never added annoying preamble like *"Here is your notification:"*.
  - **Security & Privacy:** Knowing AWS Bedrock does not use customer prompts for training is a crucial selling point for any healthcare or eldercare product.

* **What needs work (constructive feedback):**  
  - **Throttling Error Clarity:** When an AWS account hits a daily token quota (`ThrottlingException`), the SDK error object doesn't clearly distinguish between a momentary 1-second rate limit (which can be retried with backoff) and an account-level daily quota exhaustion. I had to write custom regex checks on `err.message` so my app wouldn't waste retries and could switch straight to my fallback engine.
  - **Inference Profile ARNs:** When using cross-region inference profiles (`us.anthropic...`), IAM policy errors can be cryptic if the policy expects regional ARNs. A clearer guide in the console for inference profile permissions would save hours of trial and error.

* **How onboarding felt (zero to hello world):**  
  **4.5 / 5.** The modular `@aws-sdk/client-bedrock-runtime` npm package is great. Once my IAM user had Bedrock permissions, making my first `InvokeModelCommand` call was simple.

* **Would I build with it again?**  
  **100% yes.** Bedrock is my favorite way to run Claude models in production because of AWS IAM integration, enterprise privacy, and predictable latency.

---

## 🎥 My 3-Minute Video Pitch (Script & Walkthrough)

*Here is the exact pitch script I followed for my 3-minute submission video:*

* **[0:00 - 0:40] The Problem:**  
  *"Hi judges! Today, millions of seniors live independently at home. But traditional smart doorbells create a huge dilemma: every single courier drop-off triggers loud chimes inside the house and frantic push notifications on their children's phones. The senior feels startled and hurried, and the caregiver gets overwhelmed with alert fatigue. Smart home tech is supposed to bring peace of mind, but right now, it causes anxiety."*

* **[0:40 - 1:10] Who It's For & My Solution:**  
  *"I built **Package Whisperer** for the **Ring Track** to change that. Package Whisperer turns your Ring doorbell from an intrusive alarm into a quiet, respectful guardian. It gives the resident a peaceful 4-hour grace period to bring packages inside on their own schedule without any chimes, and only notifies family caregivers if a package has truly been left outside."*

* **[1:10 - 2:20] Live Working Demo:**  
  *"Let's see it in action:  
  1. In my **Simulator**, a courier arrives. Ring sends a signed webhook, and my backend confirms the courier drop-off pattern.  
  2. Look at the **Resident Screen** on this tablet. Notice how there's no siren? Just a peaceful ambient card: 'A delivery is resting on the porch.' If the resident brings it in, they tap 'Got it, thank you!', hear a soothing tone, and their independence score goes up.  
  3. Now let's fast forward the timer to simulate an uncollected package. Notice that it checks **Quiet Hours** first—if it's night, alerts are held until morning.  
  4. When escalation is needed, it calls **Amazon Bedrock** running Claude Haiku 4.5. On the **Caretaker Hub**, look at the notification: instead of a scary red alert, Bedrock crafted an empathetic, human message: 'A package from 2:15 PM is still resting outside. Whenever you have a quiet moment, give mom a friendly check-in.' Seamless, warm, and thoughtful."*

* **[2:20 - 3:00] Wrap-up & Impact:**  
  *"Package Whisperer includes complete HMAC webhook verification, rate-limit fallback protection, customizable tone settings, and zero hardcoded secrets. It proves that smart home AI can protect peace of mind and honor resident dignity. Thank you!"*

---

## 🔒 Security & API Key Safety

I followed strict security practices to keep credentials safe:
- **Zero API Keys in Source Code:** All secrets are read dynamically from `process.env`.
- **Protected by `.gitignore`:** My `.env` file is excluded from git tracking. I committed a clean [`.env.example`](file:///.env.example) template for anyone running the project.
- **HMAC-SHA256 Webhook Verification:** All incoming requests to `/webhook` are validated against `RING_HMAC_KEY` using constant-time string comparisons to stop timing attacks.
- **Resilient Fallback Engine:** If AWS credentials are not provided or Bedrock hits a token limit, the app automatically switches to an internal tone engine so it never crashes.

---

## 🖥️ The User Interfaces I Built

Package Whisperer includes 3 responsive web views that can be opened in any browser:

| Interface | URL | What It Does |
|---|---|---|
| **🛡️ Caretaker Hub** | `http://localhost:3000/caretaker` | Live delivery cards with active countdown timers, independence rate metrics (%), AI tone selector (*Gentle*, *Direct*, *Urgent*), and delivery event logs. |
| **🏡 Resident Calm Screen** | `http://localhost:3000/resident` | Designed for an in-home wall tablet. Features soft ambient colors, zero distractions, a single tap *"Got it, thank you!"* confirmation button, and calming Web Audio synthesizer chords. |
| **⚡ Testing Simulator** | `http://localhost:3000/simulator` | Interactive testing console. Let judges trigger Ring doorbell presses, courier drop-offs, resident pickups, or fast-forward delivery timers with one click. |

---

## 🚀 How to Run It Locally

### 1. Clone the repo and install dependencies
```bash
git clone https://github.com/shreyasinha100805-glitch/package-whisperer.git
cd package-whisperer
npm install
```

### 2. Configure environment variables
Copy `.env.example` to create your `.env` file:
```bash
cp .env.example .env
```
Fill in your details (or leave AWS keys blank to run in local fallback mode!):
```env
PORT=3000
RING_HMAC_KEY=my_local_test_key
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
```

### 3. Start the application
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing

I wrote automated unit and integration tests covering the entire pipeline:
```bash
npm test
```
The test suite validates:
- Doorbell and courier short-visit classification
- Animal motion filtering
- Grace period timers and resident pickup resolution
- Quiet Hours scheduling (10 PM – 7 AM)
- Amazon Bedrock SigV4 request signing and fallback resilience

---

## 📡 Key API Endpoints

- `GET /api/status` — Live system state, active delivery countdowns, and resident stats.
- `POST /api/resident/resolve` — Resident marks a package as collected.
- `POST /api/settings/tone` — Updates AI digest tone (`gentle`, `direct`, `urgent`).
- `POST /api/test/trigger-event` — Dispatches simulated Ring webhook events.
- `POST /api/test/fast-forward` — Instantly expires delivery windows for quick demos.
- `POST /webhook` — Ring Webhook ingestion endpoint with HMAC-SHA256 signature verification.

---

## 📄 License

ISC License. Built for the Amazon Developer Hackathon: *Build, Ship, Shape*.
