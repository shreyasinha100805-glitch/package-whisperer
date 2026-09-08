const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
require('dotenv').config();

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const TONE_STYLES = {
  gentle: 'Write in a warm, friendly, reassuring tone — like a gentle nudge from a caring family member, not an alert.',
  direct: 'Write in a direct, concise, professional tone — like a clean status alert, no fluff, no small talk.',
  urgent: 'Write in an urgent tone appropriate for mobility or wellbeing monitoring — convey that a check-in is recommended, without being alarmist.'
};

async function generateCaretakerDigest(deviceLabel, deliveredAt, tone = 'gentle') {
  const styleInstruction = TONE_STYLES[tone] || TONE_STYLES.gentle;
  const prompt = `A package was delivered at "${deviceLabel}" at ${new Date(deliveredAt).toLocaleString()}. It has not been retrieved within the expected window. ${styleInstruction} Write an original 1-2 sentence notification for a caretaker in this style. Respond with ONLY the notification text — no headers, no titles, no markdown formatting.`;

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
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
  return responseBody.content[0].text;
}

module.exports = { generateCaretakerDigest };