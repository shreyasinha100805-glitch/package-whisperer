let currentTone = 'gentle';
let quietHours = { enabled: true, start: 22, end: 7 }; // 10pm–7am, 24hr format
let retrievalWindowMinutes = 240; // 4 hours by default
let soundEnabled = true;

function setTone(tone) {
  if (['gentle', 'direct', 'urgent'].includes(tone)) {
    currentTone = tone;
  }
}

function getTone() {
  return currentTone;
}

function setQuietHours(enabled, start, end) {
  quietHours = {
    enabled: Boolean(enabled),
    start: Number(start ?? quietHours.start),
    end: Number(end ?? quietHours.end)
  };
}

function getQuietHours() {
  return { ...quietHours };
}

function isInsideQuietHours(date = new Date()) {
  if (!quietHours.enabled) return false;
  const hour = date.getHours();
  const { start, end } = quietHours;
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

function setRetrievalWindowMinutes(minutes) {
  const num = Number(minutes);
  if (!isNaN(num) && num > 0) {
    retrievalWindowMinutes = num;
  }
}

function getRetrievalWindowMinutes() {
  return retrievalWindowMinutes;
}

function getRetrievalWindowMs() {
  return Math.round(retrievalWindowMinutes * 60 * 1000);
}

function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
}

function isSoundEnabled() {
  return soundEnabled;
}

function getAllSettings() {
  return {
    tone: currentTone,
    quietHours: { ...quietHours },
    isQuietHoursActive: isInsideQuietHours(),
    retrievalWindowMinutes,
    retrievalWindowMs: getRetrievalWindowMs(),
    soundEnabled
  };
}

module.exports = {
  setTone,
  getTone,
  setQuietHours,
  getQuietHours,
  isInsideQuietHours,
  setRetrievalWindowMinutes,
  getRetrievalWindowMinutes,
  getRetrievalWindowMs,
  setSoundEnabled,
  isSoundEnabled,
  getAllSettings
};