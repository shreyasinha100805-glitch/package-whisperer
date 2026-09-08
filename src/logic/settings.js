let currentTone = 'gentle';

function setTone(tone) {
  if (['gentle', 'direct', 'urgent'].includes(tone)) {
    currentTone = tone;
  }
}

function getTone() {
  return currentTone;
}

module.exports = { setTone, getTone };