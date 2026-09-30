/**
 * Package Whisperer — Motion & Kinetic Typography Engine
 * "Animation Type Design" System
 *
 * Implements:
 * 1. KineticType: Character-by-character typewriter for Bedrock AI & rolling digit odometers
 * 2. ParticleSystem: Canvas-based celebratory confetti & floating sparkle bursts
 * 3. PorchStage: Living vector animated porch diorama (drops, door, doorbell, courier, resident, sky)
 * 4. AudioEqualizer: Visual soundwave sync
 * 5. TactilePhysics: Squash & stretch ripple physics on interactions
 */

const MotionDesign = {
  mode: localStorage.getItem('motionMode') || 'lively', // 'lively' or 'calm'
  canvas: null,
  ctx: null,
  particles: [],
  animFrameId: null,

  init() {
    this.setupCanvas();
    this.setupTactileRipple();
    this.PorchStage.init();
    this.AudioEqualizer.init();
    window.addEventListener('resize', () => this.resizeCanvas());
  },

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem('motionMode', mode);
    document.body.classList.toggle('calm-motion-mode', mode === 'calm');
    const pill = document.getElementById('motionModeBtn');
    if (pill) {
      pill.innerHTML = mode === 'lively'
        ? '<span>✨</span> <span>Motion: Lively</span>'
        : '<span>🌿</span> <span>Motion: Gentle</span>';
    }
  },

  toggleMode() {
    const newMode = this.mode === 'lively' ? 'calm' : 'lively';
    this.setMode(newMode);
    if (window.showToast) {
      window.showToast(newMode === 'lively' ? 'Lively Animation & Kinetic Type enabled!' : 'Gentle Muted Motion enabled', '✨');
    }
  },

  // -------------------------------------------------------------
  // CANVAS PARTICLES & CONFETTI ENGINE
  // -------------------------------------------------------------
  setupCanvas() {
    let cvs = document.getElementById('motionFxCanvas');
    if (!cvs) {
      cvs = document.createElement('canvas');
      cvs.id = 'motionFxCanvas';
      document.body.appendChild(cvs);
    }
    this.canvas = cvs;
    this.ctx = cvs.getContext('2d');
    this.resizeCanvas();
    this.loopParticles();
  },

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  burstConfetti(originX, originY) {
    if (this.mode === 'calm') return;
    const x = originX !== undefined ? originX : window.innerWidth / 2;
    const y = originY !== undefined ? originY : window.innerHeight / 2;

    const colors = ['#2D6A4F', '#52B788', '#F59E0B', '#FBBF24', '#38BDF8', '#E11D48', '#8B5CF6'];
    const count = 48;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 8 + 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // upward boost
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.012,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        w: Math.random() * 8 + 6,
        h: Math.random() * 4 + 4
      });
    }
  },

  burstSparkles(originX, originY) {
    const x = originX !== undefined ? originX : window.innerWidth / 2;
    const y = originY !== undefined ? originY : window.innerHeight / 2;
    const symbols = ['✨', '⭐', '🌱', '💛'];

    for (let i = 0; i < 7; i++) {
      const el = document.createElement('div');
      el.className = 'celebrate-burst';
      el.textContent = symbols[i % symbols.length];
      el.style.left = `${x + (Math.random() - 0.5) * 60}px`;
      el.style.top = `${y + (Math.random() - 0.5) * 30}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1100);
    }
  },

  loopParticles() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98; // drag
      p.rotation += p.rotSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > this.canvas.height + 20) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    requestAnimationFrame(() => this.loopParticles());
  },

  // -------------------------------------------------------------
  // TACTILE SQUASH & SPRING PHYSICS FOR BUTTONS
  // -------------------------------------------------------------
  setupTactileRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .tab-btn, .sim-btn-row, .porch-tool-btn, .pill-badge');
      if (!btn) return;

      // Spring squash
      btn.classList.remove('btn-spring-press');
      void btn.offsetWidth; // trigger reflow
      btn.classList.add('btn-spring-press');

      // Click ripple
      const rect = btn.getBoundingClientRect();
      const circle = document.createElement('span');
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('ripple-circle');

      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    });
  }
};

// ====================================================================
// KINETIC TYPOGRAPHY & ANIMATED TEXT SUBSYSTEM
// ====================================================================
MotionDesign.KineticType = {
  activeTimeouts: new Map(),

  /**
   * Character-by-character animated typewriter with blinking amber cursor
   */
  typewrite(element, fullText, speedMs = 18, onComplete = null) {
    if (!element) return;

    // Clear existing animation on this element
    if (this.activeTimeouts.has(element)) {
      clearTimeout(this.activeTimeouts.get(element));
      this.activeTimeouts.delete(element);
    }

    element.innerHTML = '';
    const textNode = document.createTextNode('');
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';

    element.appendChild(textNode);
    element.appendChild(cursor);

    let idx = 0;
    const totalChars = fullText.length;

    const step = () => {
      if (idx < totalChars) {
        textNode.textContent += fullText.charAt(idx);
        idx++;
        // Slight organic variation in keystroke timing
        const variance = Math.random() * 8 - 4;
        const timerId = setTimeout(step, Math.max(8, speedMs + variance));
        this.activeTimeouts.set(element, timerId);
      } else {
        this.activeTimeouts.delete(element);
        // Leave cursor for a short moment then fade it
        setTimeout(() => {
          cursor.style.transition = 'opacity 0.4s ease';
          cursor.style.opacity = '0';
          setTimeout(() => cursor.remove(), 400);
        }, 1500);

        if (typeof onComplete === 'function') onComplete();
      }
    };

    step();
  },

  /**
   * Smooth number odometer rolling animation
   */
  animateCounter(element, targetNum, suffix = '') {
    if (!element) return;
    const currentText = element.textContent.replace(/[^0-9.-]/g, '');
    const startNum = parseFloat(currentText) || 0;
    const endNum = parseFloat(targetNum) || 0;

    if (startNum === endNum) {
      element.textContent = `${endNum}${suffix}`;
      return;
    }

    element.classList.remove('counter-animating');
    void element.offsetWidth;
    element.classList.add('counter-animating');

    const duration = 600;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(startNum + (endNum - startNum) * ease);

      element.textContent = `${val}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = `${endNum}${suffix}`;
      }
    };

    requestAnimationFrame(update);
  }
};

// ====================================================================
// PORCH MOTION STAGE (LIVING VECTOR DIORAMA)
// ====================================================================
MotionDesign.PorchStage = {
  isNight: false,
  isBusy: false,

  init() {
    this.createStars();
    this.syncSkyWithTime();
  },

  createStars() {
    const starContainer = document.getElementById('porchStarCluster');
    if (!starContainer) return;
    starContainer.innerHTML = '';

    for (let i = 0; i < 28; i++) {
      const star = document.createElement('div');
      star.className = 'star-twinkle';
      star.style.left = `${Math.random() * 95}%`;
      star.style.top = `${Math.random() * 85}%`;
      star.style.animationDelay = `${Math.random() * 2.5}s`;
      star.style.animationDuration = `${1.5 + Math.random() * 2}s`;
      starContainer.appendChild(star);
    }
  },

  syncSkyWithTime() {
    const hours = new Date().getHours();
    const isNightTime = hours >= 22 || hours < 7;
    this.setNightMode(isNightTime);
  },

  setNightMode(night) {
    this.isNight = night;
    const viewport = document.getElementById('porchViewport');
    const badge = document.getElementById('porchSkyBadge');
    if (viewport) {
      viewport.classList.toggle('night-sky', night);
    }
    if (badge) {
      badge.innerHTML = night ? '🌙 Night Guard (Quiet Hours)' : '☀️ Daytime Vigil';
    }
  },

  toggleSky() {
    this.setNightMode(!this.isNight);
    if (window.soundFx) window.soundFx.playClick();
  },

  // 1. Ring Doorbell Wave & Chime Animation
  ringDoorbell() {
    const btn = document.getElementById('ringDoorbellBtn');
    const sonar1 = document.getElementById('sonarRing1');
    const sonar2 = document.getElementById('sonarRing2');
    const sonar3 = document.getElementById('sonarRing3');

    if (btn) {
      btn.classList.add('ringing');
      setTimeout(() => btn.classList.remove('ringing'), 1400);
    }

    [sonar1, sonar2, sonar3].forEach(ring => {
      if (ring) {
        ring.classList.remove('active');
        void ring.offsetWidth;
        ring.classList.add('active');
      }
    });

    if (window.soundFx) window.soundFx.playDeliveryChime();
    MotionDesign.AudioEqualizer.triggerPulse();
  },

  // 2. Spawn and Drop Delivery Parcel
  dropPackage() {
    const parcel = document.getElementById('animatedPorchParcel');
    if (!parcel) return;

    parcel.classList.remove('floating', 'retrieved-pop', 'drop-in');
    parcel.classList.add('visible', 'drop-in');

    this.ringDoorbell();

    setTimeout(() => {
      parcel.classList.remove('drop-in');
      parcel.classList.add('floating');
    }, 650);

    const rect = parcel.getBoundingClientRect();
    MotionDesign.burstSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  },

  // 3. Resident Pickup Animation
  residentPickup() {
    const parcel = document.getElementById('animatedPorchParcel');
    const door = document.getElementById('porchFrontDoor');
    const resident = document.getElementById('porchResident');

    if (door) door.classList.add('door-open');
    if (resident) resident.classList.add('step-out');

    if (window.soundFx) window.soundFx.playRetrievedChime();
    MotionDesign.AudioEqualizer.triggerPulse();

    setTimeout(() => {
      if (parcel && parcel.classList.contains('visible')) {
        parcel.classList.remove('floating');
        parcel.classList.add('retrieved-pop');

        const rect = parcel.getBoundingClientRect();
        MotionDesign.burstConfetti(rect.left + rect.width / 2, rect.top);
        MotionDesign.burstSparkles(rect.left + rect.width / 2, rect.top);

        setTimeout(() => {
          parcel.classList.remove('visible', 'retrieved-pop');
        }, 750);
      }
    }, 400);

    // Resident steps back in & closes door
    setTimeout(() => {
      if (resident) resident.classList.remove('step-out');
      if (door) door.classList.remove('door-open');
    }, 1500);
  },

  // 4. Play Full Delivery Journey Story
  playFullStory() {
    if (this.isBusy) return;
    this.isBusy = true;

    const van = document.getElementById('porchDeliveryVan');
    const courier = document.getElementById('porchCourier');
    const parcel = document.getElementById('animatedPorchParcel');

    // Step A: Van drives in
    if (van) {
      van.classList.remove('drive-out');
      van.classList.add('drive-in');
      van.querySelectorAll('.van-wheel').forEach(w => w.classList.add('rolling'));
    }

    setTimeout(() => {
      if (van) van.querySelectorAll('.van-wheel').forEach(w => w.classList.remove('rolling'));
      // Step B: Courier walks up
      if (courier) courier.classList.add('walk-in');
    }, 1200);

    setTimeout(() => {
      // Step C: Courier drops box and rings doorbell
      this.dropPackage();
    }, 2000);

    setTimeout(() => {
      // Step D: Courier walks back
      if (courier) {
        courier.classList.remove('walk-in');
        courier.classList.add('walk-out');
      }
    }, 2800);

    setTimeout(() => {
      // Step E: Van drives off
      if (van) {
        van.classList.remove('drive-in');
        van.classList.add('drive-out');
        van.querySelectorAll('.van-wheel').forEach(w => w.classList.add('rolling'));
      }
    }, 3400);

    setTimeout(() => {
      // Step F: Resident comes out peacefully and picks up package
      this.residentPickup();
      this.isBusy = false;
    }, 4800);
  }
};

// ====================================================================
// AUDIO EQUALIZER / SOUNDWAVE VISUALIZER
// ====================================================================
MotionDesign.AudioEqualizer = {
  bars: [],

  init() {
    this.bars = document.querySelectorAll('.eq-bar');
  },

  triggerPulse() {
    this.bars.forEach(bar => {
      bar.classList.add('active');
    });
    setTimeout(() => {
      this.bars.forEach(bar => bar.classList.remove('active'));
    }, 1400);
  }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MotionDesign.init());
} else {
  MotionDesign.init();
}

// Global exposure
window.MotionDesign = MotionDesign;
