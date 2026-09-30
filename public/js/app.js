// Enhanced Frontend Application Logic for Package Whisperer

const AppState = {
  activeTab: 'caretaker',
  statusFilter: 'all',
  settings: {},
  stats: {},
  events: [],
  pendingDeliveries: [],
  latestByDevice: {},
  lastPendingCount: 0,
  countdownInterval: null,
  pollInterval: null,
  clockInterval: null
};

// Device metadata
const DEVICES = {
  cam1: { id: 'cam1', name: 'Front door', location: 'Main Porch', battery: '92%', signal: 'Strong', icon: '🚪' },
  cam2: { id: 'cam2', name: 'Back door', location: 'Garden Patio', battery: '85%', signal: 'Very Good', icon: '🌿' },
  cam3: { id: 'cam3', name: 'Garage porch', location: 'Side Driveway', battery: '78%', signal: 'Good', icon: '🚗' }
};

function getDeviceName(id) {
  return DEVICES[id]?.name || id;
}

// Format duration
function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Display toast message
function showToast(message, icon = 'ℹ️') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 320);
  }, 3500);
}

// Fetch live application state
async function fetchState() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();

    AppState.settings = data.settings || {};
    AppState.stats = data.stats || {};
    AppState.pendingDeliveries = data.pendingDeliveries || [];
    AppState.latestByDevice = data.latestByDevice || {};
    AppState.events = data.events || [];

    // Ambient body theme update
    const hasPending = AppState.pendingDeliveries.length > 0;
    document.body.classList.toggle('delivery-active', hasPending);

    // Audio cue if a new delivery arrived
    const currentPendingCount = AppState.pendingDeliveries.length;
    if (currentPendingCount > AppState.lastPendingCount && AppState.lastPendingCount !== -1) {
      window.soundFx?.playDeliveryChime();
      showToast('New package delivery detected at the door!', '📦');
    }
    AppState.lastPendingCount = currentPendingCount;

    render();
  } catch (err) {
    console.warn('Failed to poll status:', err);
  }
}

// Main render coordinator
function render() {
  renderTopBar();
  renderCaretakerView();
  renderResidentView();
  renderDeviceSidebar();
}

function renderTopBar() {
  // Sound button
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    const enabled = window.soundFx?.enabled;
    soundBtn.innerHTML = enabled ? '🔊' : '🔇';
    soundBtn.title = enabled ? 'Ambient Sound Enabled (Click to mute)' : 'Muted (Click to enable)';
  }

  // Quiet hours pill
  const qhPill = document.getElementById('quietHoursPill');
  if (qhPill && AppState.settings.quietHours) {
    const isNight = AppState.settings.isQuietHoursActive;
    qhPill.innerHTML = isNight
      ? `<span class="status-dot" style="background:#4A5568"></span> <span>Quiet hours active (${AppState.settings.quietHours.start}:00–${AppState.settings.quietHours.end}:00)</span>`
      : `<span class="status-dot pulse"></span> <span>Caretaker active</span>`;
  }
}

function renderCaretakerView() {
  // Update stats with rolling odometer animations
  const elTotal = document.getElementById('statTotal');
  const elRate = document.getElementById('statResolvedRate');
  const elEscalated = document.getElementById('statEscalated');
  const elPending = document.getElementById('statPending');

  if (window.MotionDesign?.KineticType) {
    if (elTotal) window.MotionDesign.KineticType.animateCounter(elTotal, AppState.stats.total ?? 0);
    if (elRate) window.MotionDesign.KineticType.animateCounter(elRate, AppState.stats.resolvedRate ?? 100, '%');
    if (elEscalated) window.MotionDesign.KineticType.animateCounter(elEscalated, AppState.stats.escalated ?? 0);
    if (elPending) window.MotionDesign.KineticType.animateCounter(elPending, AppState.pendingDeliveries.length);
  } else {
    if (elTotal) elTotal.textContent = AppState.stats.total ?? 0;
    if (elRate) elRate.textContent = `${AppState.stats.resolvedRate ?? 100}%`;
    if (elEscalated) elEscalated.textContent = AppState.stats.escalated ?? 0;
    if (elPending) elPending.textContent = AppState.pendingDeliveries.length;
  }

  // Sync living porch diorama
  const porchParcel = document.getElementById('animatedPorchParcel');
  if (porchParcel) {
    if (AppState.pendingDeliveries.length > 0) {
      if (!porchParcel.classList.contains('visible') && !porchParcel.classList.contains('drop-in')) {
        porchParcel.classList.add('visible', 'floating');
      }
    } else {
      if (!porchParcel.classList.contains('retrieved-pop') && !porchParcel.classList.contains('drop-in')) {
        porchParcel.classList.remove('visible', 'floating');
      }
    }
  }

  // Active Pending Delivery Hero Banner with SVG Ring
  const heroSection = document.getElementById('activeDeliveriesSection');
  if (heroSection) {
    if (AppState.pendingDeliveries.length > 0) {
      const p = AppState.pendingDeliveries[0];
      const deviceLabel = getDeviceName(p.deviceId);

      // SVG Ring circumference: 2 * PI * 40 = 251.32
      const circumference = 251.32;
      const progress = p.windowMs > 0 ? (p.remainingMs / p.windowMs) : 0;
      const strokeOffset = circumference * (1 - progress);

      heroSection.innerHTML = `
        <div class="hero-pending-card">
          <div class="hero-content">
            <span class="hero-badge">⏳ Delivery Resting Outside</span>
            <h2 class="hero-title">Package resting at ${deviceLabel}</h2>
            <p class="hero-desc">The resident has an active quiet window to collect this parcel on their own. Caretaker escalation will only trigger if uncollected when the timer runs out.</p>
          </div>

          <div class="countdown-widget">
            <div class="countdown-ring-wrap">
              <svg class="countdown-svg" viewBox="0 0 90 90">
                <circle class="countdown-circle-bg" cx="45" cy="45" r="40" />
                <circle class="countdown-circle-progress" id="heroCountdownCircle" cx="45" cy="45" r="40"
                  style="stroke-dashoffset: ${strokeOffset};" />
              </svg>
              <span class="countdown-center-icon">📦</span>
            </div>
            <div class="countdown-text-col">
              <span class="countdown-label">Window Remaining</span>
              <div class="countdown-digits" id="heroCountdownDigits">${formatCountdown(p.remainingMs)}</div>
              <span class="countdown-sub">Before AI digest fires</span>
            </div>
          </div>

          <div class="hero-actions">
            <button class="btn-primary" onclick="markResolved('${p.deviceId}')">✓ Mark Retrieved</button>
            <button class="btn-secondary" onclick="fastForwardEscalation('${p.deviceId}')">⏩ Expire Timer Now</button>
          </div>
        </div>
      `;
    } else {
      heroSection.innerHTML = '';
    }
  }

  // Update Controls
  const toneSelect = document.getElementById('toneSelect');
  if (toneSelect && AppState.settings.tone && document.activeElement !== toneSelect) {
    toneSelect.value = AppState.settings.tone;
  }

  const qhCheckbox = document.getElementById('qhCheckbox');
  if (qhCheckbox && AppState.settings.quietHours && document.activeElement !== qhCheckbox) {
    qhCheckbox.checked = Boolean(AppState.settings.quietHours.enabled);
  }

  const windowSelect = document.getElementById('windowSelect');
  if (windowSelect && AppState.settings.retrievalWindowMinutes && document.activeElement !== windowSelect) {
    windowSelect.value = String(AppState.settings.retrievalWindowMinutes);
  }

  // Activity Feed
  renderEventList();
}

function renderEventList() {
  const container = document.getElementById('eventsList');
  if (!container) return;

  let filtered = AppState.events;
  if (AppState.statusFilter !== 'all') {
    filtered = filtered.filter(e => e.status === AppState.statusFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 48px; text-align: center; color: var(--ink-soft);">
        <p style="font-size: 28px; margin-bottom: 8px;">🕊️</p>
        <p style="font-size: 15.5px; font-weight: 600; color: var(--ink);">No activity for this filter</p>
        <p style="font-size: 13px; color: var(--ink-faint); margin-top: 4px;">Use the Simulator tab to trigger a delivery!</p>
      </div>`;
    return;
  }

  const statusMap = {
    pending: { label: 'Waiting', class: 'pending', icon: '⏳' },
    retrieved: { label: 'Retrieved', class: 'retrieved', icon: '✓' },
    escalated: { label: 'Needs attention', class: 'escalated', icon: '⚠️' },
    held: { label: 'Held (Quiet)', class: 'held', icon: '🌙' }
  };

  container.innerHTML = filtered.map(e => {
    const s = statusMap[e.status] || { label: e.status, class: 'pending', icon: '•' };
    const timeFormatted = new Date(e.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const dateFormatted = new Date(e.timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    });

    const isBedrock = e.source === 'bedrock';
    const isEscalated = e.status === 'escalated';

    return `
      <div class="event-item">
        <div class="event-time">
          <div style="font-weight: 500;">${timeFormatted}</div>
          <div style="font-size: 11px; opacity: 0.7;">${dateFormatted}</div>
        </div>
        <div>
          <div class="event-device">🚪 ${e.deviceLabel || getDeviceName(e.deviceId)}</div>
          <div style="margin-top: 6px;">
            <span class="event-status-badge ${s.class}">
              ${s.icon} ${s.label}
            </span>
          </div>
        </div>
        <div class="event-details">
          ${e.reason ? `<div style="font-size: 13.5px; color: var(--ink-soft);">${e.reason}</div>` : ''}
          ${e.digest ? `
            <div class="event-digest ${isEscalated ? 'escalated' : ''}">
              \u201C${e.digest}\u201D
            </div>
          ` : ''}
          <div class="event-meta">
            ${e.source ? `
              <span class="ai-badge ${isBedrock ? 'bedrock' : 'fallback'}">
                ✨ ${isBedrock ? 'AWS Bedrock Claude Haiku 4.5' : 'Resilient Tone Engine'}
              </span>
            ` : ''}
            ${e.tone ? `<span>Tone: <strong>${e.tone}</strong></span>` : ''}
            ${e.latencyMs ? `<span>${e.latencyMs}ms</span>` : ''}
          </div>
        </div>
        <div>
          ${e.status === 'pending' ? `
            <button class="btn-secondary" style="font-size: 11px; padding: 5px 12px;" onclick="markResolved('${e.deviceId}')">Resolve</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderDeviceSidebar() {
  const container = document.getElementById('deviceList');
  if (!container) return;

  container.innerHTML = Object.values(DEVICES).map(d => {
    const activePending = AppState.pendingDeliveries.find(p => p.deviceId === d.id);
    const hasDelivery = Boolean(activePending);
    const statusText = hasDelivery ? 'Package Waiting' : 'Clear';
    const badgeClass = hasDelivery ? 'pending' : 'retrieved';
    const cardClass = hasDelivery ? 'porch-camera-card active-waiting' : 'porch-camera-card';

    return `
      <div class="${cardClass}" onclick="selectSimulatorDevice('${d.id}')" title="Click to test this door in simulator">
        <div class="camera-preview-icon">${hasDelivery ? '📦' : d.icon}</div>
        <div class="camera-meta-col">
          <div class="camera-title">${d.name}</div>
          <div class="camera-sub">
            <span>${d.location}</span> &bull; 
            <span class="signal-bar">📶 ${d.signal}</span> &bull; 
            <span>🔋 ${d.battery}</span>
          </div>
        </div>
        <div>
          <span class="event-status-badge ${badgeClass}" style="font-size: 10px;">
            ${statusText}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function selectSimulatorDevice(id) {
  const select = document.getElementById('simDeviceSelect');
  if (select) {
    select.value = id;
    switchTab('simulator');
    showToast(`Switched target camera to ${getDeviceName(id)}`, '🚪');
  }
}

function renderResidentView() {
  const container = document.getElementById('residentContainer');
  if (!container) return;

  const activePending = AppState.pendingDeliveries;
  const hasDelivery = activePending.length > 0;

  // Local time & greeting calculation
  const now = new Date();
  const hours = now.getHours();
  let greeting = 'Good evening';
  if (hours < 12) greeting = 'Good morning';
  else if (hours < 18) greeting = 'Good afternoon';

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (hasDelivery) {
    const item = activePending[0];
    const location = getDeviceName(item.deviceId);

    container.innerHTML = `
      <div class="ambient-clock-bar">
        <span>${greeting}</span> &bull;
        <span class="ambient-clock-digits">${timeStr}</span>
      </div>

      <div class="calm-plaque waiting">
        <div class="calm-badge">
          <span>📦</span>
          <span>Delivery Resting Outside</span>
        </div>
        <div class="calm-icon-halo">📦</div>
        <h1 class="calm-heading">Something has arrived at the ${location}.</h1>
        <p class="calm-support">
          A package was placed outside. Take all the time you need \u2014 no notifications have been sent to anyone.
        </p>
        <button class="btn-got-it-hero" onclick="markResolved('${item.deviceId}')">
          <span>✓</span>
          <span>Got it, thank you!</span>
        </button>
        <div class="calm-footer-bar">
          <span>Tap when brought inside</span> &bull;
          <button class="calm-footer-link" onclick="window.soundFx?.playDeliveryChime()">Hear friendly chime</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="ambient-clock-bar">
        <span>${greeting}</span> &bull;
        <span class="ambient-clock-digits">${timeStr}</span>
      </div>

      <div class="calm-plaque clear">
        <div class="calm-badge">
          <span class="status-dot pulse"></span>
          <span>Porch is peaceful</span>
        </div>
        <div class="calm-icon-halo">🏡</div>
        <h1 class="calm-heading">All clear.</h1>
        <p class="calm-support">
          There are no packages waiting outside. Relax and enjoy your peaceful day.
        </p>
        <div class="calm-footer-bar">
          <span>Package Whisperer is quietly keeping watch</span> &bull;
          <button class="calm-footer-link" onclick="window.soundFx?.playRetrievedChime()">Test chime</button>
        </div>
      </div>
    `;
  }
}

// Action Handlers
async function markResolved(deviceId = 'cam1') {
  window.soundFx?.playClick();
  window.MotionDesign?.PorchStage?.residentPickup();
  window.MotionDesign?.burstConfetti();
  try {
    const res = await fetch('/api/resident/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
    if (res.ok) {
      window.soundFx?.playRetrievedChime();
      showToast(`Package at ${getDeviceName(deviceId)} marked as retrieved!`, '🌱');
      fetchState();
    }
  } catch (err) {
    showToast('Failed to mark resolved: ' + err.message, '⚠️');
  }
}

async function fastForwardEscalation(deviceId = 'cam1') {
  window.soundFx?.playClick();
  try {
    showToast('Fast-forwarding window timer...', '⏩');
    const res = await fetch('/api/test/fast-forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
    const data = await res.json();
    if (data.success) {
      window.soundFx?.playEscalationTone();
      showToast('Escalation triggered! Caretaker digest generated.', '📨');
      fetchState();
    }
  } catch (err) {
    showToast('Fast forward failed: ' + err.message, '⚠️');
  }
}

async function triggerSimulatorEvent(type, extra = {}) {
  window.soundFx?.playClick();
  const deviceId = document.getElementById('simDeviceSelect')?.value || 'cam1';

  // Live motion visual triggers on porch diorama
  if (type === 'button_press') {
    window.MotionDesign?.PorchStage?.ringDoorbell();
    window.MotionDesign?.PorchStage?.dropPackage();
  } else if (type === 'courier_dropoff') {
    window.MotionDesign?.PorchStage?.dropPackage();
  } else if (type === 'resident_retrieval') {
    window.MotionDesign?.PorchStage?.residentPickup();
  }

  try {
    showToast(`Simulating ${type}...`, '⚡');
    const res = await fetch('/api/test/trigger-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, type, ...extra })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Event processed!', '✅');
      fetchState();
    } else {
      showToast(data.error || 'Event error', '⚠️');
    }
  } catch (err) {
    showToast('Simulation failed: ' + err.message, '⚠️');
  }
}

async function runBedrockTest() {
  window.soundFx?.playClick();
  const deviceId = document.getElementById('simDeviceSelect')?.value || 'cam1';
  const tone = document.getElementById('toneSelect')?.value || 'gentle';
  const outputEl = document.getElementById('aiInspectorOutput');

  if (outputEl) {
    outputEl.textContent = '✨ Connecting to Amazon Bedrock (Claude Haiku 4.5)...';
  }

  try {
    const res = await fetch('/api/test/force-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, tone })
    });
    const data = await res.json();
    if (outputEl) {
      if (window.MotionDesign?.KineticType) {
        window.MotionDesign.KineticType.typewrite(outputEl, JSON.stringify(data, null, 2), 10);
      } else {
        outputEl.textContent = JSON.stringify(data, null, 2);
      }
    }
    showToast(`Digest generated (${data.source})`, '✨');
    fetchState();
  } catch (err) {
    if (outputEl) outputEl.textContent = 'Error: ' + err.message;
    showToast('AI call failed: ' + err.message, '⚠️');
  }
}

async function updateToneSetting() {
  window.soundFx?.playClick();
  const tone = document.getElementById('toneSelect')?.value;
  try {
    await fetch('/api/settings/tone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tone })
    });
    showToast(`Caretaker tone updated to "${tone}"`, '💬');
    fetchState();
  } catch (err) {
    showToast('Failed to update tone', '⚠️');
  }
}

async function updateQuietHoursSetting() {
  window.soundFx?.playClick();
  const enabled = document.getElementById('qhCheckbox')?.checked;
  try {
    await fetch('/api/settings/quiet-hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    showToast(`Quiet hours ${enabled ? 'enabled' : 'disabled'}`, '🌙');
    fetchState();
  } catch (err) {
    showToast('Failed to update quiet hours', '⚠️');
  }
}

async function updateRetrievalWindowSetting() {
  window.soundFx?.playClick();
  const minutes = document.getElementById('windowSelect')?.value;
  try {
    await fetch('/api/settings/window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes })
    });
    showToast(`Retrieval window updated to ${minutes} min`, '⏱️');
    fetchState();
  } catch (err) {
    showToast('Failed to update window', '⚠️');
  }
}

async function resetDemoData() {
  window.soundFx?.playClick();
  if (!confirm('Reset events to initial demonstration state?')) return;
  try {
    await fetch('/api/test/clear-history', { method: 'POST' });
    showToast('Demo data seeded successfully!', '✨');
    fetchState();
  } catch (err) {
    showToast('Failed to reset data', '⚠️');
  }
}

function switchTab(tabName) {
  window.soundFx?.playClick();
  AppState.activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = view.id === `tab-${tabName}` ? 'block' : 'none';
  });

  render();
}

function setStatusFilter(status) {
  window.soundFx?.playClick();
  AppState.statusFilter = status;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === status);
  });
  renderEventList();
}

// Tick down active countdown timers smoothly every second
function startCountdownTicker() {
  if (AppState.countdownInterval) clearInterval(AppState.countdownInterval);

  AppState.countdownInterval = setInterval(() => {
    if (AppState.pendingDeliveries.length > 0) {
      const now = Date.now();
      AppState.pendingDeliveries.forEach(p => {
        const elapsed = now - p.deliveredAt;
        p.remainingMs = Math.max(0, p.windowMs - elapsed);
      });

      const p0 = AppState.pendingDeliveries[0];
      const digitsEl = document.getElementById('heroCountdownDigits');
      if (digitsEl && p0) {
        digitsEl.textContent = formatCountdown(p0.remainingMs);
      }

      // Update circular SVG stroke dash offset
      const circleEl = document.getElementById('heroCountdownCircle');
      if (circleEl && p0 && p0.windowMs > 0) {
        const circumference = 251.32;
        const progress = Math.max(0, Math.min(1, p0.remainingMs / p0.windowMs));
        circleEl.style.strokeDashoffset = circumference * (1 - progress);
      }
    }
  }, 1000);
}

// ====================================================================
// REDUCED & ANIMATED PIPELINE JOURNEY (Simple vs Tech Mode)
// ====================================================================
const PipelineAnim = {
  currentStep: 1,
  isPlaying: false,
  timer: null,
  mode: 'simple'
};

function setPipelineMode(mode) {
  window.soundFx?.playClick();
  PipelineAnim.mode = mode;
  document.body.classList.toggle('pipeline-tech-mode', mode === 'tech');

  const btnSimple = document.getElementById('btnModeSimple');
  const btnTech = document.getElementById('btnModeTech');
  if (btnSimple && btnTech) {
    btnSimple.classList.toggle('active', mode === 'simple');
    btnTech.classList.toggle('active', mode === 'tech');
  }

  showToast(mode === 'tech' ? 'Switched to Technical Architecture Spec' : 'Switched to Simple Story', mode === 'tech' ? '⚙️' : '🌿');
}

function focusPipelineStep(stepNum) {
  window.soundFx?.playClick();
  PipelineAnim.currentStep = stepNum;
  updatePipelineVisuals();
}

function updatePipelineVisuals() {
  const step = PipelineAnim.currentStep;

  // Update cards active states
  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById(`pipeStep${i}`);
    if (card) {
      card.classList.toggle('active-step', i === step);
      card.classList.toggle('passed-step', i < step);
    }
  }

  // Update connecting line width (0% at step 1, 33% at 2, 66% at 3, 100% at 4)
  const line = document.getElementById('pipelineProgressLine');
  if (line) {
    const percent = Math.round(((step - 1) / 3) * 100);
    line.style.width = `${percent}%`;
  }

  // Update traveler icon emoji
  const traveler = document.getElementById('pipelineTraveler');
  if (traveler) {
    const emojis = ['📦', '⏳', '🌙', '💌'];
    traveler.textContent = emojis[step - 1] || '📦';
  }

  // Update status text
  const statusEl = document.getElementById('animStatusText');
  const stepDescriptions = [
    'Step 1: Doorstep Drop-off — Ring motion classified quietly 📦',
    'Step 2: Quiet Window — Resident gets time to pick it up in peace ⏳',
    'Step 3: Night Guard — Quiet hours pause midnight notifications 🌙',
    'Step 4: Thoughtful Nudge — Bedrock AI generates empathetic note 💌'
  ];
  if (statusEl && stepDescriptions[step - 1]) {
    statusEl.textContent = stepDescriptions[step - 1];
  }
}

function playPipelineJourney() {
  window.soundFx?.playClick();
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');

  if (PipelineAnim.isPlaying) {
    // Pause
    clearInterval(PipelineAnim.timer);
    PipelineAnim.isPlaying = false;
    if (playIcon) playIcon.textContent = '▶';
    if (playText) playText.textContent = 'Play Animated Flow';
    return;
  }

  PipelineAnim.isPlaying = true;
  if (playIcon) playIcon.textContent = '⏸';
  if (playText) playText.textContent = 'Pause Journey';

  PipelineAnim.currentStep = 1;
  updatePipelineVisuals();
  window.soundFx?.playDeliveryChime();

  PipelineAnim.timer = setInterval(() => {
    if (PipelineAnim.currentStep < 4) {
      PipelineAnim.currentStep++;
      updatePipelineVisuals();
      if (PipelineAnim.currentStep === 2) window.soundFx?.playRetrievedChime();
      else if (PipelineAnim.currentStep === 4) window.soundFx?.playEscalationTone();
      else window.soundFx?.playClick();
    } else {
      // Finished loop
      clearInterval(PipelineAnim.timer);
      PipelineAnim.isPlaying = false;
      if (playIcon) playIcon.textContent = '▶';
      if (playText) playText.textContent = 'Replay Animated Flow';
      showToast('Completed end-to-end delivery journey flow!', '✨');
    }
  }, 1900);
}

// Initialization & Keyboard Shortcuts
document.addEventListener('DOMContentLoaded', () => {
  // Setup sound button toggle
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      window.soundFx?.init();
      const enabled = window.soundFx?.toggle();
      soundBtn.innerHTML = enabled ? '🔊' : '🔇';
      showToast(enabled ? 'Ambient sound enabled' : 'Ambient sound muted', enabled ? '🔊' : '🔇');
    });
  }

  // Setup tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Setup filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setStatusFilter(btn.dataset.filter));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === '1') switchTab('caretaker');
    if (e.key === '2') switchTab('resident');
    if (e.key === '3') switchTab('simulator');
    if (e.key === '4') switchTab('architecture');
  });

  // Handle URL route query parameter or pathname
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const pathParam = window.location.pathname.replace(/^\//, '').split('/')[0];
  const targetView = viewParam || (['caretaker', 'resident', 'simulator', 'architecture'].includes(pathParam) ? pathParam : null);
  if (targetView && ['caretaker', 'resident', 'simulator', 'architecture'].includes(targetView)) {
    switchTab(targetView);
  }

  // First fetch & start polling
  fetchState();
  AppState.pollInterval = setInterval(fetchState, 1800);
  startCountdownTicker();

  // Clock updater for resident view
  AppState.clockInterval = setInterval(() => {
    if (AppState.activeTab === 'resident') {
      renderResidentView();
    }
  }, 30000);
});
