// View & Navigation Routes
const express = require('express');
const indexHtml = require('../views/indexHtml');
const router = express.Router();

router.get(['/', '/index.html', '/landing', '/resident', '/caretaker', '/simulator', '/architecture'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(indexHtml);
});

// Ring Account Linking Placeholders
router.get('/link', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Ring Account Linking endpoint ready for OAuth token exchange.'
  });
});

router.get('/home', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(indexHtml);
});

router.post('/token', (req, res) => {
  res.json({
    status: 'ok',
    token: `token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    token_type: 'Bearer',
    expires_in: 3600
  });
});

module.exports = router;
