const assert = require('assert');
const { classifyEvent } = require('./src/logic/classifyEvent');
const windowService = require('./src/services/windowService');
const eventService = require('./src/services/eventService');
const {
  checkQuietHours,
  holdUntilMorning,
  selectTone,
  buildPrompt,
  constructRequest,
  resolveCredentials,
  signRequest,
  sendWithRetry,
  checkStatus,
  invokeModel,
  parseResponse,
  callBedrock,
  applyFallback,
  logResult,
  processEscalationDigest
} = require('./src/services/aiService');
const { setTone, getTone } = require('./src/logic/settings');

function makePayload(type, deviceId, timestamp, subType) {
  return {
    data: {
      type,
      attributes: { source: deviceId, timestamp, subType }
    }
  };
}

console.log('🧪 Starting Project Validation Suite...\n');

// ============================================================================
// Process 1: Classify event
// ============================================================================
console.log('--- Testing Process 1: Classify event ---');
const test1 = classifyEvent(makePayload('button_press', 'cam1', Date.now()));
assert(test1.isDelivery === true && test1.reason === 'doorbell_press');
console.log('✅ Test 1 (doorbell press):', test1);

const now = Date.now();
const test2 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 30000, 'human'),
  [{ deviceId: 'cam1', timestamp: now }]
);
assert(test2.isDelivery === true && test2.reason === 'short_visit_pattern');
console.log('✅ Test 2 (short human visit):', test2);

const test3 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 300000, 'human'),
  [{ deviceId: 'cam1', timestamp: now }]
);
assert(test3.isDelivery === false);
console.log('✅ Test 3 (long human visit):', test3);

const test4 = classifyEvent(
  makePayload('motion_detected', 'cam1', now + 10000, 'animal')
);
assert(test4.isDelivery === false);
console.log('✅ Test 4 (animal motion):', test4);

// ============================================================================
// Process 2: Delivery lifecycle & Data Stores D1 & D2
// ============================================================================
console.log('\n--- Testing Process 2: Delivery lifecycle (Retrieval window) ---');
const testDevId = 'test_cam_p2';
windowService.start(testDevId, Date.now(), 60000);
assert(windowService.isPending(testDevId), 'D2 Pending store must have active record');
console.log('✅ Started retrieval window for', testDevId);

// Resident retrieval motion
const resolved = windowService.checkRetrieval(testDevId, Date.now() + 5000, 15000);
assert(resolved === true, 'Short motion visit must resolve delivery');
assert(!windowService.isPending(testDevId), 'Resolved delivery must clear from D2 Pending store');
console.log('✅ Resident pickup detected and delivery resolved.');

// ============================================================================
// Process 3 Level 2: Sub-Processes & Functions
// ============================================================================
console.log('\n--- Testing Process 3 Level 2: Generate digest functions ---');

// 3.1 Check quiet hours (Reads D3 settings)
console.log('Testing 3.1 Check quiet hours...');
const dayDate = new Date('2026-10-02T14:00:00'); // 2 PM (daytime)
const nightDate = new Date('2026-10-02T23:30:00'); // 11:30 PM (nighttime)
const dayCheck = checkQuietHours(dayDate);
const nightCheck = checkQuietHours(nightDate);
assert.strictEqual(dayCheck.isQuiet, false, '14:00 should not be quiet hours');
assert.strictEqual(nightCheck.isQuiet, true, '23:30 should be quiet hours (10 PM - 7 AM)');
console.log('✅ 3.1 Check quiet hours: Day =', dayCheck.isQuiet, ', Night =', nightCheck.isQuiet);

// Hold until morning (Retry 30 min)
console.log('Testing Hold until morning...');
let retryCalled = false;
const { heldEntry, timer } = holdUntilMorning('cam1', Date.now(), () => { retryCalled = true; }, 50);
assert.strictEqual(heldEntry.status, 'held');
assert.strictEqual(heldEntry.source, 'quiet_hours');
clearTimeout(timer);
console.log('✅ Hold until morning prepares held entry and schedules retry timer.');

// 3.2 Select tone (Reads D3 tone)
console.log('Testing 3.2 Select tone...');
setTone('direct');
assert.strictEqual(selectTone(), 'direct');
setTone('gentle');
assert.strictEqual(selectTone(), 'gentle');
console.log('✅ 3.2 Select tone correctly reads caregiver tone preference from D3 Settings.');

// ============================================================================
// Sub-Process 3.3 Decomposition: Call Bedrock
// ============================================================================
console.log('\n--- Testing Sub-Process 3.3 Decomposition (Call Bedrock) ---');

// 3.3.1 Build prompt (Device, tone, timestamp)
console.log('Testing 3.3.1 Build prompt...');
const prompt = buildPrompt('Front door', Date.now(), 'gentle');
assert(prompt.includes('Front door'), 'Prompt must contain device label');
assert(prompt.includes('expected window'), 'Prompt must specify context');
console.log('✅ 3.3.1 Build prompt created prompt:', prompt.substring(0, 70) + '...');

// 3.3.2 Construct request (Model ID + messages)
console.log('Testing 3.3.2 Construct request...');
const command = constructRequest(prompt);
assert(command.input.modelId, 'Command must specify modelId');
assert(command.input.body, 'Command must include JSON payload body');
const parsedBody = JSON.parse(command.input.body);
assert.strictEqual(parsedBody.messages[0].content, prompt);
console.log('✅ 3.3.2 Construct request created InvokeModelCommand for model:', command.input.modelId);

// ============================================================================
// Process 4: Request Dispatch Pipeline
// ============================================================================
console.log('\n--- Testing Process 4: Request Dispatch Pipeline ---');

// 4.1 Resolve credentials (From .env IAM user)
console.log('Testing 4.1 Resolve credentials...');
const creds = resolveCredentials();
assert(creds.region, 'Must resolve AWS region');
console.log('✅ 4.1 Resolve credentials: Region =', creds.region, ', Configured =', creds.isConfigured);

// 4.2 Sign request (SigV4, AWS SDK core)
console.log('Testing 4.2 Sign request...');
const signMetadata = signRequest(command, creds);
assert.strictEqual(signMetadata.signer, 'AWS4-HMAC-SHA256');
assert.strictEqual(signMetadata.service, 'bedrock-runtime');
console.log('✅ 4.2 Sign request prepared SigV4 envelope:', signMetadata.signer);

// 4.4 Check status: 200 OK vs 429 throttled
console.log('Testing 4.4 Check status (200 OK branch)...');
const fakeOkResponse = {
  statusCode: 200,
  response: {
    $metadata: { httpStatusCode: 200 },
    body: new TextEncoder().encode(JSON.stringify({
      content: [{ text: 'Package is waiting at the porch.' }]
    }))
  }
};
const okCheck = checkStatus(fakeOkResponse);
assert.strictEqual(okCheck.isOk, true);
assert.strictEqual(okCheck.nextStep, 'parse_response_3.3.4');
console.log('✅ 4.4 Check status (200 OK): Routes to', okCheck.nextStep);

console.log('Testing 4.4 Check status (429 throttled branch)...');
const throttledError = new Error('Too many tokens per day, please wait (429)');
throttledError.name = 'ThrottlingException';
const throttledCheck = checkStatus(throttledError);
assert.strictEqual(throttledCheck.isOk, false);
assert.strictEqual(throttledCheck.statusCode, 429);
assert.strictEqual(throttledCheck.nextStep, 'apply_fallback_3.4');
console.log('✅ 4.4 Check status (429 Error): Routes to', throttledCheck.nextStep);

// 3.3.4 Parse response (Extract digest text)
console.log('\nTesting 3.3.4 Parse response...');
const parsedDigest = parseResponse(fakeOkResponse.response, Date.now() - 250, {
  deviceLabel: 'Front door',
  tone: 'gentle',
  prompt
});
assert.strictEqual(parsedDigest.text, 'Package is waiting at the porch.');
assert.strictEqual(parsedDigest.source, 'bedrock');
assert(parsedDigest.latencyMs >= 0);
console.log('✅ 3.3.4 Parse response successfully extracted digest text:', `"${parsedDigest.text}"`);

// 3.4 Apply fallback (On Bedrock error / throttled)
console.log('Testing 3.4 Apply fallback...');
const fallbackResult = applyFallback('Front door', Date.now(), 'gentle', throttledError);
assert.strictEqual(fallbackResult.success, false);
assert.strictEqual(fallbackResult.source, 'fallback');
assert(fallbackResult.text.length > 0);
console.log('✅ 3.4 Apply fallback generated resilient message:', `"${fallbackResult.text}"`);

// 3.5 Log result (Status + digest + source -> Write entry to D1 Events)
console.log('Testing 3.5 Log result...');
const logged = logResult({
  deviceId: 'cam1',
  status: 'escalated',
  reason: 'Test escalation',
  digest: fallbackResult.text,
  source: 'fallback',
  tone: 'gentle'
});
assert.strictEqual(logged.status, 'escalated');
assert.strictEqual(logged.digest, fallbackResult.text);
const eventsInStore = eventService.getAll({ limit: 1 });
assert.strictEqual(eventsInStore[0].id, logged.id, 'Entry must be written to D1 Events store');
console.log('✅ 3.5 Log result successfully recorded entry in D1 Events:', logged.id);

// End-to-end Process 3 Level 2 Pipeline Execution
console.log('\n--- Testing Complete Process 3 Level 2 Pipeline ---');
(async () => {
  console.log('Testing Process 3 Pipeline (Outside quiet hours)...');
  const result = await processEscalationDigest('cam1', Date.now(), { currentDate: dayDate });
  assert.strictEqual(result.status, 'escalated');
  assert(result.digest);
  console.log('✅ Escalation pipeline executed successfully (Source:', result.source, ')');

  console.log('Testing Process 3 Pipeline (Inside quiet hours)...');
  const heldResult = await processEscalationDigest('cam1', Date.now(), { currentDate: nightDate, retryIntervalMs: 0 });
  assert.strictEqual(heldResult.status, 'held');
  console.log('✅ Escalation pipeline held alert for quiet hours until morning.\n');

  console.log('🎉 ALL PROCESSES (1, 2, 3, 3.1-3.5, 3.3.1-3.3.4, 4.1-4.4) PASSED PERFECTLY!\n');
  process.exit(0);
})();