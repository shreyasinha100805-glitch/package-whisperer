// AWS Bedrock Claude Haiku 4.5 AI Digest Service
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');
const logger = require('../utils/logger');

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

/**
 * Generates an empathetic caretaker digest using Bedrock Claude Haiku 4.5
 * with automatic fallback engine if rate-limited (HTTP 429).
 */
async function generateDigest(deviceLabel, deliveredAt, tone = 'gentle') {
  const startTime = Date.now();
  const styleInstruction = TONE_STYLES[tone] || TONE_STYLES.gentle;
  const prompt = `A package was delivered at "${deviceLabel}" at ${new Date(deliveredAt).toLocaleString()}. It has not been retrieved within the expected window. ${styleInstruction} Write an original 1-2 sentence notification for a caretaker in this style. Respond with ONLY the notification text — no headers, no titles, no markdown formatting.`;

  try {
    const command = new InvokeModelCommand({
      modelId: config.aws.bedrockModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content[0].text.trim();
    const latencyMs = Date.now() - startTime;

    logger.ai('bedrock', `Generated digest for "${deviceLabel}" (${tone})`, latencyMs);

    return {
      text,
      source: 'bedrock',
      model: 'Bedrock (Claude Haiku 4.5)',
      tone,
      latencyMs,
      prompt,
      toString() { return this.text; }
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isThrottled = err.name === 'ThrottlingException' || err.message?.includes('429') || err.message?.includes('tokens per day');
    const fallbackText = generateFallbackText(deviceLabel, deliveredAt, tone);

    logger.ai(
      'fallback',
      `Using tone engine for "${deviceLabel}" (${isThrottled ? '429 Token Quota Protected' : err.name})`,
      latencyMs
    );

    return {
      text: fallbackText,
      source: 'fallback',
      model: isThrottled ? 'Claude Haiku 4.5 (Quota 429 Fallback Engine)' : 'Resilient Tone Fallback Engine',
      tone,
      latencyMs,
      error: err.message,
      prompt,
      toString() { return this.text; }
    };
  }
}

module.exports = {
  generateDigest,
  generateFallbackText,
  TONE_STYLES
};
