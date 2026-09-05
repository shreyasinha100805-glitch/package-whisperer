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

async function generateCaretakerDigest(deviceLabel, deliveredAt) {
  const prompt = `A package was delivered at "${deviceLabel}" at ${new Date(deliveredAt).toLocaleString()}. It has not been retrieved within the expected window. Write a short, warm, plain-language 1-2 sentence notification for a family caretaker, letting them know the package is still waiting and hasn't been picked up. Do not be alarming, just informative. Respond with ONLY the notification text — no headers, no titles, no markdown formatting, just the plain sentence(s).`;

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