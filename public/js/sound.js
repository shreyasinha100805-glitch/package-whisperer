// Ambient Web Audio Synthesizer for Package Whisperer
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = localStorage.getItem('soundEnabled') !== 'false';
    this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.7');
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('soundEnabled', this.enabled);
    if (this.enabled) {
      this.playClick();
    }
    return this.enabled;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('soundVolume', this.volume);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  // Soft tactile click for UI button taps
  playClick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // Audio fail silent
    }
  }

  // Soft warm wooden chime for delivery arrival
  playDeliveryChime() {
    if (!this.enabled) return;
    try {
      window.MotionDesign?.AudioEqualizer?.triggerPulse();
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // D5 and A5 notes with gentle harmonics
      const notes = [
        { freq: 587.33, start: 0, decay: 1.1 },
        { freq: 880.00, start: 0.16, decay: 1.3 }
      ];

      notes.forEach(({ freq, start, decay }) => {
        // Fundamental
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.linearRampToValueAtTime(0.14, now + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + start);
        osc.stop(now + start + decay + 0.05);

        // Soft overtone
        const overtone = this.ctx.createOscillator();
        const otGain = this.ctx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 2.76, now + start);

        otGain.gain.setValueAtTime(0.001, now + start);
        otGain.gain.linearRampToValueAtTime(0.02, now + start + 0.02);
        otGain.gain.exponentialRampToValueAtTime(0.0005, now + start + 0.5);

        overtone.connect(otGain);
        otGain.connect(this.masterGain);

        overtone.start(now + start);
        overtone.stop(now + start + 0.55);
      });
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  }

  // Harmonic warm chords when parcel is retrieved
  playRetrievedChime() {
    if (!this.enabled) return;
    try {
      window.MotionDesign?.AudioEqualizer?.triggerPulse();
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio

      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0.001, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.09 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.85);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.9);
      });
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  }

  // Gentle notification tone for escalation
  playEscalationTone() {
    if (!this.enabled) return;
    try {
      window.MotionDesign?.AudioEqualizer?.triggerPulse();
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(370, now + 0.45);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  }
}

window.soundFx = new SoundEffects();
