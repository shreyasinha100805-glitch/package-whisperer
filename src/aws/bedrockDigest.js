// Backwards-compatible facade forwarding to aiService
// Exposes DFD Model Level 2 functions (Sub-Process 3 & 3.3 decomposition & Process 4 Request Pipeline)
const {
  generateDigest,
  generateFallbackText,
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
  checkQuietHours,
  holdUntilMorning,
  selectTone,
  logResult,
  processEscalationDigest,
  TONE_STYLES
} = require('../services/aiService');

async function generateCaretakerDigest(deviceLabel, deliveredAt, tone = 'gentle') {
  return generateDigest(deviceLabel, deliveredAt, tone);
}

module.exports = {
  generateCaretakerDigest,
  generateFallbackDigest: generateFallbackText,
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
  checkQuietHours,
  holdUntilMorning,
  selectTone,
  logResult,
  processEscalationDigest,
  TONE_STYLES
};