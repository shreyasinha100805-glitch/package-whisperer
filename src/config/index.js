// Central Configuration for Package Whisperer
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  ring: {
    clientId: process.env.RING_CLIENT_ID || null,
    clientSecret: process.env.RING_CLIENT_SECRET || null,
    signingKey: process.env.RING_HMAC_KEY || null,
    hasSigningKey: Boolean(process.env.RING_HMAC_KEY)
  },

  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    bedrockModelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    isConfigured: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  },

  defaults: {
    retrievalWindowMinutes: 240, // 4 hours
    quietHours: {
      enabled: true,
      start: 22, // 10 PM
      end: 7     // 7 AM
    },
    tone: 'gentle',
    shortVisitThresholdMs: 60 * 1000
  },

  devices: {
    cam1: { id: 'cam1', name: 'Front door', location: 'Main Entrance' },
    cam2: { id: 'cam2', name: 'Back door', location: 'Garden Patio' },
    cam3: { id: 'cam3', name: 'Garage porch', location: 'Side Driveway' }
  }
};

module.exports = config;
