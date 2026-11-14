// Powershot – Sound. Alle Geräusche werden im Browser erzeugt (keine Sounddateien).

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = true;
    this.volume = 0.8;
  }

  // Muss nach dem ersten Tippen/Klicken aufgerufen werden (Browser-Regel)
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(2);
    this.clapBuf = this.makeApplause(3.5);
    this.startCrowd();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.enabled ? v : 0; }
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; }

  makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Applaus: viele einzelne Klatscher übereinander
  makeApplause(sec) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * sec);
    const buf = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const claps = 900;
      for (let c = 0; c < claps; c++) {
        const start = Math.floor(Math.pow(Math.random(), 1.6) * (n - 2000));
        const len = 300 + Math.floor(Math.random() * 500);
        const amp = (0.25 + Math.random() * 0.5) * (1 - start / n) ** 0.7;
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          lp += (w - lp) * 0.55;
          d[start + i] += (w - lp) * amp * Math.exp(-i / (len * 0.22));
        }
      }
      for (let i = 0; i < n; i++) d[i] = Math.max(-1, Math.min(1, d[i] * 0.35));
    }
    return buf;
  }

  startCrowd() {
    // Leises Publikums-Gemurmel im Hintergrund
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.0;
    src.connect(f).connect(this.crowdGain).connect(this.master);
    src.start();
  }

  setCrowd(level) {
    if (!this.ctx) return;
    this.crowdGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
  }

  burst({ freq = 1500, q = 1, dur = 0.08, gain = 0.5, type = 'bandpass', when = 0 }) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  tone({ from = 200, to = 100, dur = 0.1, gain = 0.5, type = 'sine', when = 0 }) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Schläger trifft Ball. power 0..1
  hit(power = 0.6, serve = false) {
    if (!this.ctx) return;
    const p = Math.max(0.2, Math.min(1, power));
    this.tone({ from: 260 + 200 * p, to: 90, dur: 0.09, gain: 0.5 * p + 0.2 });
    this.burst({ freq: 1900 + 900 * p, q: 0.9, dur: 0.05 + 0.03 * p, gain: 0.45 * p + 0.15 });
    this.burst({ freq: 5200, q: 2, dur: 0.03, gain: 0.18 * p });
    if (serve) this.burst({ freq: 700, q: 0.7, dur: 0.12, gain: 0.3 });
  }

  bounce(speed = 15, surface = 'hard') {
    if (!this.ctx) return;
    const g = Math.max(0.08, Math.min(0.5, speed / 45));
    const soft = surface === 'clay' || surface === 'grass';
    this.tone({ from: soft ? 150 : 210, to: 70, dur: 0.07, gain: g });
    this.burst({ freq: soft ? 500 : 900, q: 0.8, dur: 0.05, gain: g * 0.6, type: 'lowpass' });
  }

  net() {
    if (!this.ctx) return;
    this.burst({ freq: 380, q: 0.5, dur: 0.22, gain: 0.5, type: 'lowpass' });
    this.tone({ from: 120, to: 60, dur: 0.15, gain: 0.25 });
  }

  click() {
    if (!this.ctx) return;
    this.tone({ from: 900, to: 600, dur: 0.05, gain: 0.15, type: 'triangle' });
  }

  coin() {
    if (!this.ctx) return;
    this.tone({ from: 1200, to: 1200, dur: 0.08, gain: 0.2, type: 'square' });
    this.tone({ from: 1700, to: 1700, dur: 0.18, gain: 0.2, type: 'square', when: 0.08 });
  }

  // Applaus. strength 0..1, bei cheer jubelt das Publikum zusätzlich
  applause(strength = 0.6, cheer = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.clapBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * strength, t + 0.25);
    g.gain.setTargetAtTime(0.0001, t + 1.2 + strength, 0.5);
    src.connect(g).connect(this.master);
    src.start(t);
    if (cheer) this.cheer(strength);
  }

  cheer(strength = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1100, t + 0.35);
    f.frequency.linearRampToValueAtTime(750, t + 1.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5 * strength, t + 0.3);
    g.gain.setTargetAtTime(0.0001, t + 1.0, 0.45);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 3.5);
  }

  // Raunen im Publikum (knapp daneben)
  ooh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(520, t);
    f.frequency.linearRampToValueAtTime(330, t + 0.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.15);
    g.gain.setTargetAtTime(0.0001, t + 0.5, 0.25);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 2);
  }

  // Der Schiedsrichter spricht (Sprachausgabe des Geräts)
  say(text) {
    if (!this.enabled || !this.voice || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 1.05; u.pitch = 0.9; u.volume = Math.min(1, this.volume);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* Sprachausgabe nicht verfügbar */ }
  }
}
