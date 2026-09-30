// Ring HMAC-SHA256 Webhook Verification Middleware
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

function verifyRingSignature(req, res, next) {
  const signatureHeader = req.headers['x-signature'];
  const signingKey = config.ring.signingKey;

  // In development without a key set, allow requests with a warning
  if (!signingKey) {
    logger.warn('RING_HMAC_KEY is not configured — webhook signature check bypassed in dev.');
    return next();
  }

  if (!signatureHeader) {
    logger.webhook(req.method, req.originalUrl || req.path, 401, '(Missing X-Signature header)');
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_SIGNATURE',
        message: 'Missing required X-Signature header'
      }
    });
  }

  try {
    const rawBody = req.rawBody || Buffer.from('');
    const expected = crypto.createHmac('sha256', signingKey).update(rawBody).digest('hex');
    const received = signatureHeader.replace(/^sha256=/, '');

    const bufExpected = Buffer.from(expected, 'utf8');
    const bufReceived = Buffer.from(received, 'utf8');

    if (bufExpected.length !== bufReceived.length || !crypto.timingSafeEqual(bufExpected, bufReceived)) {
      logger.webhook(req.method, req.originalUrl || req.path, 401, '(Invalid HMAC signature)');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'HMAC signature verification failed'
        }
      });
    }

    logger.webhook(req.method, req.originalUrl || req.path, 200, '(Signature verified ✓)');
    next();
  } catch (err) {
    logger.error('Error during signature verification:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SIGNATURE_CHECK_ERROR',
        message: 'Internal error verifying webhook signature'
      }
    });
  }
}

module.exports = { verifyRingSignature };
