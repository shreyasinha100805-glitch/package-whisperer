// Ring Webhook Route with Cryptographic HMAC Signature Verification
const express = require('express');
const router = express.Router();
const { verifyRingSignature } = require('../middleware/auth');

let processRingEventFn = null;
router.setEventProcessor = (fn) => { processRingEventFn = fn; };

/**
 * POST /webhook
 * Ingests raw Ring webhook event payloads with HMAC-SHA256 signature verification.
 */
router.post('/', verifyRingSignature, (req, res) => {
  // Acknowledge immediately to Ring with 200 OK
  res.sendStatus(200);

  // Asynchronously process the event through the pipeline
  if (processRingEventFn) {
    try {
      processRingEventFn(req.body);
    } catch (err) {
      console.error('Error processing Ring webhook event:', err);
    }
  }
});

module.exports = router;
