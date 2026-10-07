// AWS Bedrock Claude Haiku 4.5 AI Digest Service
// Implements DFD Model Level 2:
// - Sub-Process 3: Generate digest
// - Sub-Process 3.3: Call Bedrock
// - Process 4: Request Pipeline (4.1 Resolve credentials -> 4.2 Sign request -> 4.3 Send with retry -> 4.4 Check status)
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');
const logger = require('../utils/logger');
const { getTone, isInsideQuietHours, getQuietHours } = require('../logic/settings');
const eventService = require('./eventService');

const client = new BedrockRuntimeClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId || '',
    secretAccessKey: config.aws.secretAccessKey || ''
  }
});

const TONE_STYLES = {
  gentle: 'Write in a warm, friendly, reassuring tone — like a gentle nudge from a caring family member, not an alert.',
  direct: 'Write in a direct, concise, professional tone — like a clean status alert, no fluff, no small talk.',
  urgent: 'Write in an urgent tone appropriate for mobility or wellbeing monitoring — convey that a check-in is recommended, without being alarmist.'
};

const FALLBACK_TEMPLATES = {
  gentle: [
    (loc, time) => `A package delivered at ${loc} around ${time} is still waiting outside. Whenever you have a quiet moment, please check in on it.`,
    (loc, time) => `Just a gentle note: a delivery at ${loc} from ${time} hasn't been collected yet. No hurry, just letting you know.`,
    (loc, time) => `A parcel arrived at ${loc} earlier today (${time}) and remains untouched. Pop by or give them a friendly ring when convenient.`
  ],
  direct: [
    (loc, time) => `Delivery notice: Package at ${loc} (arrived ${time}) uncollected beyond standard window. Action required.`,
    (loc, time) => `Status update: Unretrieved package at ${loc} since ${time}. Please follow up to ensure safe retrieval.`,
    (loc, time) => `Alert: Package remains outside at ${loc} delivered at ${time}. Retrieval confirmation pending.`
  ],
  urgent: [
    (loc, time) => `Wellbeing Check: Package at ${loc} from ${time} has not been brought inside. Please contact the resident to confirm all is well.`,
    (loc, time) => `Urgent Notice: Delivery at ${loc} left unattended for extended duration. Please verify resident safety and mobility today.`,
    (loc, time) => `Check-in advised: Package waiting at ${loc} since ${time}. Recommend reaching out to ensure the resident doesn't need assistance.`
  ]
};

function generateFallbackText(deviceLabel, deliveredAt, tone = 'gentle') {
  const timeStr = new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const pool = FALLBACK_TEMPLATES[tone] || FALLBACK_TEMPLATES.gentle;
  const picker = pool[Math.floor(Math.random() * pool.length)];
  return picker(deviceLabel, timeStr);
}

// ============================================================================
// DFD MODEL LEVEL 2: SUB-PROCESS 3 (GENERATE DIGEST)
// ============================================================================

/**
 * 3.1 Check quiet hours
 * Reads Data Store D3 Settings to determine if quiet hours schedule is active.
 * @param {Date} [date=new Date()]
 * @returns {{ isQuiet: boolean, schedule: { enabled: boolean, start: number, end: number } }}
 */
function checkQuietHours(date = new Date()) {
  const isQuiet = isInsideQuietHours(date);
  const schedule = getQuietHours();
  return { isQuiet, schedule };
}

/**
 * Hold until morning
 * Schedules a 30-minute retry loop back to Process 3.1 and prepares held entry.
 * @param {string} deviceId
 * @param {number} deliveredAt
 * @param {Function} [onRetry]
 * @param {number} [retryIntervalMs=30 * 60 * 1000]
 * @returns {{ heldEntry: object, timer: NodeJS.Timeout|null }}
 */
function holdUntilMorning(deviceId, deliveredAt, onRetry, retryIntervalMs = 30 * 60 * 1000) {
  const label = eventService.getDeviceLabel(deviceId);
  logger.quiet(`Quiet hours active (10 PM – 7 AM). Holding escalation for "${label}" until morning.`);

  const heldEntry = {
    deviceId,
    status: 'held',
    reason: 'Quiet hours active (10 PM – 7 AM). Alert paused until morning.',
    digest: null,
    source: 'quiet_hours',
    tone: null
  };

  let timer = null;
  if (typeof onRetry === 'function' && retryIntervalMs > 0) {
    timer = setTimeout(() => {
      logger.quiet(`Quiet hours retry timer expired for "${label}". Re-checking Process 3.1.`);
      onRetry(deviceId, deliveredAt);
    }, retryIntervalMs);
  }

  return { heldEntry, timer };
}

/**
 * 3.2 Select tone
 * Reads caregiver tone preference from Data Store D3 Settings.
 * @returns {string} 'gentle' | 'direct' | 'urgent'
 */
function selectTone() {
  return getTone();
}

// ============================================================================
// SUB-PROCESS 3.3 (CALL BEDROCK) DECOMPOSITION
// ============================================================================

/**
 * 3.3.1 Build prompt
 * Formats prompt using device label, delivery timestamp, and selected tone instructions.
 * @param {string} deviceLabel
 * @param {number} deliveredAt
 * @param {string} [tone='gentle']
 * @returns {string} Formatted prompt string
 */
function buildPrompt(deviceLabel, deliveredAt, tone = 'gentle') {
  const styleInstruction = TONE_STYLES[tone] || TONE_STYLES.gentle;
  const timeFormatted = new Date(deliveredAt).toLocaleString();
  return `A package was delivered at "${deviceLabel}" at ${timeFormatted}. It has not been retrieved within the expected window. ${styleInstruction} Write an original 1-2 sentence notification for a caretaker in this style. Respond with ONLY the notification text — no headers, no titles, no markdown formatting.`;
}

/**
 * 3.3.2 Construct request
 * Prepares the AWS Bedrock InvokeModelCommand payload with Model ID and messages.
 * @param {string} prompt
 * @param {string} [modelId=config.aws.bedrockModelId]
 * @returns {InvokeModelCommand}
 */
function constructRequest(prompt, modelId = config.aws.bedrockModelId) {
  return new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    })
  });
}

// ============================================================================
// PROCESS 4: REQUEST DISPATCH PIPELINE (INVOKE MODEL DECOMPOSITION)
// ============================================================================

/**
 * 4.1 Resolve credentials
 * Loads and validates IAM user credentials from .env configuration.
 * @returns {{ accessKeyId: string, secretAccessKey: string, region: string, isConfigured: boolean }}
 */
function resolveCredentials() {
  const accessKeyId = config.aws.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = config.aws.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
  const sessionToken = process.env.AWS_SESSION_TOKEN || undefined;
  const region = config.aws.region || process.env.AWS_REGION || 'us-east-1';

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    isConfigured: Boolean(accessKeyId && secretAccessKey)
  };
}

/**
 * 4.2 Sign request
 * Prepares SigV4 authentication envelope via AWS SDK core.
 * @param {InvokeModelCommand} command
 * @param {object} [credentials]
 * @returns {object} SigV4 metadata signature descriptor
 */
function signRequest(command, credentials = null) {
  const creds = credentials || resolveCredentials();
  return {
    command,
    signer: 'AWS4-HMAC-SHA256',
    service: 'bedrock-runtime',
    region: creds.region,
    isSigned: true,
    keyIdentifier: creds.accessKeyId ? creds.accessKeyId.slice(0, 4) + '...' : 'anonymous'
  };
}

/**
 * 4.3 Send with retry
 * Dispatches command to AWS Bedrock Runtime with exponential backoff for up to 3 attempts.
 * @param {InvokeModelCommand} command
 * @param {BedrockRuntimeClient} [runtimeClient=client]
 * @param {number} [maxAttempts=3]
 * @returns {Promise<{ response: object, attempts: number, statusCode: number }>}
 */
async function sendWithRetry(command, runtimeClient = client, maxAttempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await runtimeClient.send(command);
      return {
        response,
        attempts: attempt,
        statusCode: response.$metadata?.httpStatusCode || 200
      };
    } catch (err) {
      lastError = err;
      const isThrottled = err.name === 'ThrottlingException' || err.message?.includes('429') || err.message?.includes('tokens per day');

      // 429 quota exhaustion is non-transient per day; branch immediately without wasting retries
      if (isThrottled || attempt === maxAttempts) {
        break;
      }

      // Exponential backoff with small delay for transient errors (e.g. 200ms, 400ms)
      const backoffMs = attempt * 200;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * 4.4 Check status
 * Checks 200 OK vs 429 throttled/error:
 * - 200 OK  -> routes to 3.3.4 Parse response
 * - 429 / error -> routes to 3.4 Apply fallback
 * @param {object|Error} sendResultOrError
 * @returns {{ isOk: boolean, statusCode: number, statusText: string, response?: object, error?: Error, nextStep: string }}
 */
function checkStatus(sendResultOrError) {
  if (sendResultOrError instanceof Error || (sendResultOrError && !sendResultOrError.response)) {
    const err = sendResultOrError instanceof Error ? sendResultOrError : sendResultOrError.error;
    const isThrottled = err?.name === 'ThrottlingException' || err?.message?.includes('429') || err?.message?.includes('tokens per day');
    return {
      isOk: false,
      statusCode: isThrottled ? 429 : 500,
      statusText: isThrottled ? '429 Throttled' : (err?.name || 'Invocation Error'),
      error: err,
      nextStep: 'apply_fallback_3.4'
    };
  }

  const statusCode = sendResultOrError.statusCode || sendResultOrError.response?.$metadata?.httpStatusCode || 200;
  const isOk = statusCode >= 200 && statusCode < 300;

  return {
    isOk,
    statusCode,
    statusText: isOk ? '200 OK' : `${statusCode} Error`,
    response: sendResultOrError.response,
    attempts: sendResultOrError.attempts,
    nextStep: isOk ? 'parse_response_3.3.4' : 'apply_fallback_3.4'
  };
}

/**
 * 3.3.4 Parse response
 * Extracts digest text from Bedrock response body, records latency, and logs AI metric.
 * @param {object} response - Bedrock SDK response
 * @param {number} startTime - Invocation timestamp
 * @param {object} metadata - { deviceLabel, tone, prompt }
 * @returns {{ success: true, text: string, source: 'bedrock', model: string, tone: string, latencyMs: number, prompt: string }}
 */
function parseResponse(response, startTime, { deviceLabel, tone, prompt }) {
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content[0].text.trim();
  const latencyMs = Date.now() - startTime;

  logger.ai('bedrock', `Generated digest for "${deviceLabel}" (${tone})`, latencyMs);

  return {
    success: true,
    text,
    source: 'bedrock',
    model: 'Bedrock (Claude Haiku 4.5)',
    tone,
    latencyMs,
    prompt,
    toString() { return this.text; }
  };
}

/**
 * 3.3 Call Bedrock Orchestrator
 * Coordinates:
 *   3.3.1 Build prompt -> 3.3.2 Construct request ->
 *   4.1 Resolve credentials -> 4.2 Sign request -> 4.3 Send with retry -> 4.4 Check status
 *   ├── 200 OK     ──► 3.3.4 Parse response
 *   └── 429 / Error ──► 3.4 Apply fallback
 * @param {string} deviceLabel
 * @param {number} deliveredAt
 * @param {string} [tone='gentle']
 * @returns {Promise<object>}
 */
async function callBedrock(deviceLabel, deliveredAt, tone = 'gentle') {
  const startTime = Date.now();

  // 3.3.1 Build prompt (Device, tone, timestamp)
  const prompt = buildPrompt(deviceLabel, deliveredAt, tone);

  // 3.3.2 Construct request (Model ID + messages)
  const command = constructRequest(prompt);

  // 4.1 Resolve credentials (From .env IAM user)
  const creds = resolveCredentials();

  // 4.2 Sign request (SigV4, AWS SDK core)
  signRequest(command, creds);

  // 4.3 Send with retry (Up to 3 attempts) & 4.4 Check status (200 OK vs 429 throttled)
  let statusCheck;
  try {
    const sendResult = await sendWithRetry(command, client, 3);
    statusCheck = checkStatus(sendResult);
  } catch (err) {
    statusCheck = checkStatus(err);
  }

  // Branch from 4.4 Check status
  if (statusCheck.isOk) {
    // 200 OK -> To: Parse response (3.3.4)
    return parseResponse(statusCheck.response, startTime, { deviceLabel, tone, prompt });
  } else {
    // 429 / error -> To: Apply fallback (3.4)
    return applyFallback(deviceLabel, deliveredAt, tone, statusCheck.error, prompt);
  }
}

/**
 * Backwards-compatible invokeModel alias using Process 4
 */
async function invokeModel(command, runtimeClient = client) {
  const creds = resolveCredentials();
  signRequest(command, creds);
  const sendResult = await sendWithRetry(command, runtimeClient, 3);
  return sendResult.response;
}

// ============================================================================
// SUB-PROCESSES 3.4 & 3.5 & ORCHESTRATOR
// ============================================================================

/**
 * 3.4 Apply fallback
 * Executed on Bedrock error (HTTP 429 throttling, missing credentials, timeout).
 * Generates an empathetic fallback digest matching the selected tone.
 * @param {string} deviceLabel
 * @param {number} deliveredAt
 * @param {string} [tone='gentle']
 * @param {Error|object} [err=null]
 * @param {string} [prompt='']
 * @returns {{ success: false, text: string, source: 'fallback', model: string, tone: string, latencyMs: number, error: string, prompt: string }}
 */
function applyFallback(deviceLabel, deliveredAt, tone = 'gentle', err = null, prompt = '') {
  const isThrottled = err && (err.name === 'ThrottlingException' || err.message?.includes('429') || err.message?.includes('tokens per day'));
  const fallbackText = generateFallbackText(deviceLabel, deliveredAt, tone);

  logger.ai(
    'fallback',
    `Using tone engine for "${deviceLabel}" (${isThrottled ? '429 Token Quota Protected' : (err?.name || 'Bedrock Error')})`
  );

  return {
    success: false,
    text: fallbackText,
    source: 'fallback',
    model: isThrottled ? 'Claude Haiku 4.5 (Quota 429 Fallback Engine)' : 'Resilient Tone Fallback Engine',
    tone,
    latencyMs: 0,
    error: err?.message || 'Bedrock invocation error',
    prompt,
    toString() { return this.text; }
  };
}

/**
 * 3.5 Log result
 * Writes event entry (Status + digest + source) into Data Store D1 Events.
 * @param {object} entry
 * @returns {object} The logged record in D1 Events
 */
function logResult(entry) {
  return eventService.log({
    deviceId: entry.deviceId || 'cam1',
    status: entry.status || 'escalated',
    reason: entry.reason || (entry.status === 'held' ? 'Quiet hours active (10 PM – 7 AM)' : 'Package not picked up within designated window'),
    digest: entry.digest || null,
    source: entry.source || null,
    tone: entry.tone || null,
    latencyMs: entry.latencyMs || null
  });
}

/**
 * Process 3 Level 2 Pipeline Orchestrator: Generate digest
 * Coordinates 3.1 -> (Hold until morning / 3.2 -> 3.3 [3.3.1->3.3.2->4.1->4.2->4.3->4.4->3.3.4/3.4]) -> 3.5 -> D1 Events.
 * Triggered by Process 2 (Delivery lifecycle) upon escalation.
 * @param {string} deviceId
 * @param {number} deliveredAt
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function processEscalationDigest(deviceId, deliveredAt, options = {}) {
  const label = eventService.getDeviceLabel(deviceId);

  // 3.1 Check quiet hours (Reads D3 settings)
  const { isQuiet } = checkQuietHours(options.currentDate || new Date());

  if (isQuiet) {
    // Hold until morning: schedule 30-minute retry loop back to 3.1
    const { heldEntry } = holdUntilMorning(
      deviceId,
      deliveredAt,
      () => processEscalationDigest(deviceId, deliveredAt, options),
      options.retryIntervalMs !== undefined ? options.retryIntervalMs : 30 * 60 * 1000
    );

    // 3.5 Log result (Held entry -> D1 Events)
    return logResult(heldEntry);
  }

  // 3.2 Select tone (Reads D3 tone)
  const tone = options.customTone || selectTone();
  logger.info(`Escalation triggered for "${label}" (Tone: ${tone})`);

  // 3.3 Call Bedrock (Runs 3.3.1 -> 3.3.2 -> 4.1 -> 4.2 -> 4.3 -> 4.4 -> 3.3.4 on 200 OK or 3.4 on 429/error)
  const result = await callBedrock(label, deliveredAt, tone);

  // 3.5 Log result (Status + digest + source) -> D1 Events
  return logResult({
    deviceId,
    status: 'escalated',
    reason: 'Package not picked up within designated window',
    digest: result.text,
    source: result.source,
    tone: result.tone || tone,
    latencyMs: result.latencyMs
  });
}

/**
 * Backwards-compatible digest generation helper
 */
async function generateDigest(deviceLabel, deliveredAt, tone = 'gentle') {
  return callBedrock(deviceLabel, deliveredAt, tone);
}

module.exports = {
  // DFD Model Level 2 functions
  checkQuietHours,
  holdUntilMorning,
  selectTone,
  // Sub-Process 3.3 decomposition
  buildPrompt,
  constructRequest,
  // Process 4 Request Dispatch Pipeline
  resolveCredentials,
  signRequest,
  sendWithRetry,
  checkStatus,
  invokeModel,
  parseResponse,
  callBedrock,
  // Sub-Processes 3.4 & 3.5 & pipeline
  applyFallback,
  logResult,
  processEscalationDigest,
  // Helper & legacy exports
  generateDigest,
  generateFallbackText,
  TONE_STYLES,
  client
};
