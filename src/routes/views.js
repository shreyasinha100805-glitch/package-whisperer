// View & Navigation Routes
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

function getPublicDir() {
  const candidates = [
    path.join(__dirname, '../../public'),
    path.join(process.cwd(), 'public'),
    path.join(__dirname, '../public'),
    path.join(__dirname, 'public')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(process.cwd(), 'public');
}

const publicDir = getPublicDir();

router.get('/', (req, res) => {
  const file = path.join(publicDir, 'index.html');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.redirect('/index.html');
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

router.get('/architecture', (req, res) => {
  res.redirect('/?view=architecture');
});

// Backward compatibility for legacy stylesheet link
router.get('/styles.css', (req, res) => {
  const file = path.join(publicDir, 'css', 'styles.css');
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  res.redirect('/css/styles.css');
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
