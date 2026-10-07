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
    path.join(__dirname, 'public'),
    path.resolve('public'),
    path.join('/var/task/public')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return path.join(process.cwd(), 'public');
}

const publicDir = getPublicDir();

function resolveIndexFile() {
  const candidates = [
    path.join(publicDir, 'index.html'),
    path.join(process.cwd(), 'public', 'index.html'),
    path.join(__dirname, '../../public/index.html'),
    path.join('/var/task/public/index.html'),
    path.resolve('public/index.html'),
    path.resolve('index.html')
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}

router.get('/', (req, res) => {
  const file = resolveIndexFile();
  if (file) {
    return res.sendFile(path.resolve(file));
  }
  res.status(200).send('<h1>Package Whisperer</h1><p>Initializing...</p>');
});

router.get('/index.html', (req, res) => {
  const file = resolveIndexFile();
  if (file) {
    return res.sendFile(path.resolve(file));
  }
  res.redirect('/');
});

router.get('/landing', (req, res) => {
  res.redirect('/');
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
