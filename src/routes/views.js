// View & Navigation Routes
const express = require('express');
const path = require('path');
const router = express.Router();

const publicDir = path.join(__dirname, '../../public');

router.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

router.get('/resident', (req, res) => {
  res.redirect('/?view=resident');
});

router.get('/caretaker', (req, res) => {
  res.redirect('/?view=caretaker');
});

router.get('/simulator', (req, res) => {
  res.redirect('/?view=simulator');
});

// Backward compatibility for legacy stylesheet link
router.get('/styles.css', (req, res) => {
  res.sendFile(path.join(publicDir, 'css', 'styles.css'));
});

// Ring Account Linking Placeholders
router.get('/link', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Ring Account Linking endpoint ready for OAuth token exchange.'
  });
});

router.get('/home', (req, res) => {
  res.redirect('/');
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
