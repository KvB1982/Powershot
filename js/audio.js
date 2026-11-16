// Powershot – Sound.
// Schlag, Aufprall, Applaus und Stadion-Atmosphäre kommen aus den Aufnahmen im Ordner sounds/.
// Solange die noch laden (oder falls sie fehlen), werden die Geräusche im Browser erzeugt.

// Welche Datei wofür? Die Zeiten (Sekunden) sind die Stellen in der Aufnahme, die benutzt werden.
const FILES = {
  hit: 'sounds/soundreality-tennis-ball-hit-151257.mp3',
  bounce: 'sounds/freesound_community-bouncing-ball-46683.mp3',
  match: 'sounds/freesound_community-tennis-match-51533.mp3',
  match2: 'sounds/freesound_community-43-tennis-57477.mp3',
};
const CLIPS = {
  hit: [['hit', 0.02, 0.32]],
  bounce: [['bounce', 0.425, 0.15], ['bounce', 5.88, 0.13], ['bounce', 1.68, 0.15]],
  // Applaus: lang und laut / mittel / kurz
  applauseBig: [['match', 121.8, 8.6], ['match', 287.6, 8.2]],
  applauseMid: [['match', 193.6, 6.2], ['match2', 91.6, 6.2]],
  applauseSmall: [['match', 21.6, 4.6], ['match', 157.6, 4.6], ['match', 89.6, 4.6]],
};
const AMBIENCE = ['match', 54.5, 67.5];      // ruhige Stelle im Stadion, läuft als Schleife

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = true;
    this.volume = 0.8;
    this.samples = {};            // geladene Aufnahmen
  }

  // Die Aufnahmen laden (klein zuerst, die große Stadion-Aufnahme zum Schluss)
  async loadSamples() {
    for (const [name, url] of Object.entries(FILES)) {
      try {
        const data = await (await fetch(url)).arrayBuffer();
        this.samples[name] = await new Promise((ok, err) => this.ctx.decodeAudioData(data, ok, err));
        if (name === AMBIENCE[0]) this.startAmbience();
      } catch (e) { console.warn('Sound fehlt:', url, e); }
    }
  }

  // Ein Stück aus einer Aufnahme abspielen. Gibt false zurück, wenn sie (noch) nicht da ist.
  clip(kind, { gain = 1, rate = 1, fadeIn = 0.005, fadeOut = 0.03, pick = null } = {}) {
    const list = (CLIPS[kind] || []).filter((c) => this.samples[c[0]]);
    if (!list.length) return false;
    const [name, off, dur] = list[pick === null ? Math.floor(Math.random() * list.length) : Math.min(pick, list.length - 1)];
    const t = this.ctx.currentTime, len = dur / rate;
    const src = this.ctx.createBufferSource();
    src.buffer = this.samples[name];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + fadeIn);
    g.gain.setValueAtTime(gain, t + Math.max(fadeIn, len - fadeOut));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g).connect(this.master);
    src.start(t, off, dur);
    return true;
  }

  // Echte Stadion-Atmosphäre als Schleife; ersetzt das erzeugte Gemurmel
  startAmbience() {
    const [name, a, b] = AMBIENCE;
    const src = this.ctx.createBufferSource();
    src.buffer = this.samples[name];
    src.loop = true; src.loopStart = a; src.loopEnd = b;
    const level = this.crowdGain.gain.value;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.master);
    src.start(0, a);
    this.crowdGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.crowdGain = g;
    this.crowdBoost = 9;          // die Aufnahme ist viel leiser als das erzeugte Rauschen
    this.setCrowd(this.crowdLevel ?? level);
  }

  // Muss nach dem ersten Tippen/Klicken aufgerufen werden (Browser-Regel)
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }   // iOS kennt auch 'interrupted'
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(2);
    this.clapBuf = this.makeApplause(3.5);
    this.startCrowd();
    this.loadSamples();
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
    this.crowdLevel = level;
    this.crowdGain.gain.setTargetAtTime(level * (this.crowdBoost || 1), this.ctx.currentTime, 0.6);
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
    // Aufnahme: harte Schläge lauter und etwas tiefer, weiche leiser und heller
    if (this.clip('hit', { gain: 0.5 + 1.1 * p, rate: (serve ? 0.86 : 1.12 - 0.2 * p) * (0.97 + Math.random() * 0.06) })) return;
    this.tone({ from: 260 + 200 * p, to: 90, dur: 0.09, gain: 0.5 * p + 0.2 });
    this.burst({ freq: 1900 + 900 * p, q: 0.9, dur: 0.05 + 0.03 * p, gain: 0.45 * p + 0.15 });
    this.burst({ freq: 5200, q: 2, dur: 0.03, gain: 0.18 * p });
    if (serve) this.burst({ freq: 700, q: 0.7, dur: 0.12, gain: 0.3 });
  }

  bounce(speed = 15, surface = 'hard') {
    if (!this.ctx) return;
    const g = Math.max(0.08, Math.min(0.5, speed / 45));
    const soft = surface === 'clay' || surface === 'grass';
    if (this.clip('bounce', { gain: Math.min(1.6, 0.5 + g * 3) * (soft ? 0.7 : 1), rate: (soft ? 0.85 : 1) * (0.95 + Math.random() * 0.1) })) return;
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
    // Echter Applaus aus der Aufnahme: je nach Stärke kurz, mittel oder lang
    const kind = strength > 0.85 ? 'applauseBig' : strength > 0.55 ? 'applauseMid' : 'applauseSmall';
    if (this.clip(kind, { gain: 1.6 + 1.6 * strength, fadeIn: 0.35, fadeOut: 1.6 })) return;
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
