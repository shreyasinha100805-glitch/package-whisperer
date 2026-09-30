// Backwards-compatible facade forwarding to aiService
const { generateDigest, generateFallbackText, TONE_STYLES } = require('../services/aiService');

async function generateCaretakerDigest(deviceLabel, deliveredAt, tone = 'gentle') {
  return generateDigest(deviceLabel, deliveredAt, tone);
}

module.exports = {
  generateCaretakerDigest,
  generateFallbackDigest: generateFallbackText,
  TONE_STYLES
};