// Powershot – Sound.
// Alle Geräusche sind kleine Aufnahmen im Ordner sounds/ (alle frei, Lizenz CC0 – wer sie gemacht hat, steht in sounds/QUELLEN.md).
// Solange sie noch laden (oder falls eine fehlt), wird das Geräusch im Browser erzeugt – das klingt einfacher, aber es bleibt nie still.
// Zum Anhören aller Geräusche: tools/sounds.html

// Welche Aufnahmen gibt es für welches Geräusch? Mehrere Dateien = es wird jedes Mal eine andere genommen, damit es echter klingt.
// Die Zahl hinter dem Dateinamen ist die Lautstärke (1 = so laut wie die Datei ist). Zu laut oder zu leise? Hier ändern.
// bus: 'raum' = Publikum und Umgebung (lässt sich in den Einstellungen leiser stellen), sonst zählt nur die Lautstärke.
import { dateienFuer, LINIE } from './stimme.js';
const D = new URL('../sounds/', import.meta.url).href;      // der Ordner sounds/ (liegt neben dem Ordner js/)
// Stimmen von Schiedsrichter und Linienrichtern (Aufnahmen in sounds/stimme/, was gesagt wird steht in js/stimme.js)
const STIMME_LAUT = 1.3;          // Lautstärke des Schiedsrichters (1 = so laut wie die Datei ist). Zu leise oder zu laut? Hier ändern.
const LINIE_LAUT = 1.0;           // Lautstärke der Linienrichter
const STIMME_LUECKE = 0.05;       // winzige Pause zwischen zwei Aufnahmen einer Ansage (Sekunden)
export const KLAENGE = {
  // --- Match ---
  schlag: { v: [1, 2, 3, 4, 5].map((n) => [`match/schlag_${n}.mp3`, 1]) },
  slice: { v: [1, 2, 3].map((n) => [`match/slice_${n}.mp3`, 1]) },
  aufschlag: { v: [1, 2, 3, 4].map((n) => [`match/aufschlag_${n}.mp3`, 1]) },
  aufprall: { v: [1, 2, 3, 4, 5].map((n) => [`match/aufprall_${n}.mp3`, 1]) },
  netz: { v: [1, 2, 3].map((n) => [`match/netz_${n}.mp3`, 0.5]) },
  quietschen: { v: [1, 2, 3, 4].map((n) => [`match/quietschen_${n}.mp3`, 0.12]) },
  rutschen: { v: [1, 2].map((n) => [`match/rutschen_${n}.mp3`, 0.25]) },
  // --- Publikum --- (Applaus: lang und laut / mittel / kurz)
  applausGross: { bus: 'raum', v: [['publikum/applaus_gross_1.mp3', 0.415], ['publikum/applaus_gross_2.mp3', 0.415]] },
  applausMittel: { bus: 'raum', v: [['publikum/applaus_mittel_1.mp3', 0.345], ['publikum/applaus_mittel_2.mp3', 0.752]] },
  applausKlein: { bus: 'raum', v: [['publikum/applaus_klein_1.mp3', 0.413], ['publikum/applaus_klein_2.mp3', 0.402], ['publikum/applaus_klein_3.mp3', 0.326]] },
  jubel: { bus: 'raum', v: [['publikum/jubel.mp3', 0.7]] },
  raunen: { bus: 'raum', v: [1, 2, 3].map((n) => [`publikum/raunen_${n}.mp3`, 0.5]) },
  schreck: { bus: 'raum', v: [1, 2, 3].map((n) => [`publikum/schreck_${n}.mp3`, 0.45]) },
  stadion: { bus: 'raum', v: [['publikum/stadion.mp3', 0.78]] },          // Schleife im Hintergrund
  // --- Turniergelände ---
  stimmen: { bus: 'raum', v: [['gelaende/stimmen.mp3', 0.3]] },              // Schleife
  park: { bus: 'raum', v: [['gelaende/park.mp3', 0.4]] },                    // Schleife
  schritt: { v: [1, 2, 3, 4, 5, 6].map((n) => [`gelaende/schritt_${n}.mp3`, 0.12]) },
  autotuer: { v: [['gelaende/autotuer.mp3', 0.4]] },
  auto: { v: [['gelaende/auto.mp3', 0.5]] },
  kamera: { v: [['gelaende/kamera.mp3', 0.4]] },
  // --- Menü und Mini-Spiele ---
  klick: { v: [['menue/klick.mp3', 0.25]] },
  zurueck: { v: [['menue/zurueck.mp3', 0.25]] },
  tipp: { v: [['menue/tipp.mp3', 0.25]] },
  schalter: { v: [['menue/schalter.mp3', 0.25]] },
  plopp: { v: [['menue/plopp.mp3', 0.3]] },
  frage: { v: [['menue/frage.mp3', 0.25]] },
  richtig: { v: [['menue/richtig.mp3', 0.3]] },
  falsch: { v: [['menue/falsch.mp3', 0.25]] },
  stern: { v: [['menue/stern.mp3', 0.35]] },
  geschafft: { v: [['menue/geschafft.mp3', 0.35]] },
  sieg: { v: [['menue/sieg.mp3', 0.4]] },
  kasse: { v: [['menue/kasse.mp3', 0.35]] },
  stift: { v: [['menue/stift.mp3', 0.4]] },
};
// In dieser Reihenfolge wird geladen: zuerst das Kleine fürs Menü, die langen Aufnahmen zum Schluss
const REIHENFOLGE = ['klick', 'zurueck', 'tipp', 'richtig', 'falsch', 'schlag', 'aufprall', 'aufschlag', 'slice', 'netz', 'stadion',
  'applausKlein', 'applausMittel', 'applausGross', 'raunen', 'schreck', 'quietschen', 'rutschen', 'kasse', 'stern', 'geschafft', 'sieg',
  'schalter', 'plopp', 'frage', 'stift', 'kamera', 'schritt', 'stimmen', 'park', 'autotuer', 'auto', 'jubel'];

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.stimme = 'aufnahme';     // Wer spricht? 'aufnahme' = die aufgenommenen Stimmen (Englisch), 'geraet' = Sprachausgabe des Geräts (Deutsch), 'aus'
    this.stimmen = {};            // geladene Stimmen-Aufnahmen: 'en/deuce' → Tonspur
    this.sprichtBis = 0;          // bis zu diesem Zeitpunkt redet der Schiedsrichter noch
    this.spricht = [];            // was der Schiedsrichter gerade sagt (damit man ihn unterbrechen kann)
    this.volume = 0.8;
    this.umgebung = 1;            // Publikum und Umgebung: 1 = normal, 0.5 = leise, 0 = aus
    this.puffer = {};             // geladene Aufnahmen: Dateiname → Tonspur
    this.schleifen = {};          // laufende Hintergrund-Schleifen (Stadion, Stimmen, Park)
    this.zuletzt = {};            // welche Aufnahme kam zuletzt? (damit nicht zweimal dieselbe kommt)
  }

  // Alle Aufnahmen laden, eine nach der anderen (zusammen etwa 2 MB)
  async loadSamples() {
    for (const name of REIHENFOLGE) {
      for (const [datei] of KLAENGE[name].v) {
        if (this.puffer[datei]) continue;
        try {
          const data = await (await fetch(D + datei)).arrayBuffer();
          this.puffer[datei] = await new Promise((ok, err) => this.ctx.decodeAudioData(data, ok, err));
        } catch (e) { console.warn('Sound fehlt:', datei, e); }
      }
      if (name === 'stadion' && this.crowdLevel != null) this.setCrowd(this.crowdLevel);     // ab jetzt das echte Stadion
    }
    this.fertigGeladen = true;
    this.stimmeLaden();                // zum Schluss schon einmal die Stimmen des Schiedsrichters holen – dann sind sie beim ersten Match da
  }

  // Eine Aufnahme abspielen. Gibt false zurück, wenn sie (noch) nicht da ist – dann nimmt der Aufrufer das erzeugte Geräusch.
  //   gain = lauter/leiser, rate = schneller und höher (über 1) oder langsamer und tiefer (unter 1),
  //   dumpf = alles über dieser Tonhöhe (Hertz) wird weggefiltert, when = erst in so vielen Sekunden
  play(name, { gain = 1, rate = 1, fadeIn = 0, fadeOut = 0, dumpf = 0, when = 0, pick = null } = {}) {
    const k = KLAENGE[name];
    if (!this.ctx || !k) return false;
    const da = k.v.filter((e) => this.puffer[e[0]]);
    if (!da.length) return false;
    let nr = pick === null ? Math.floor(Math.random() * da.length) : Math.min(pick, da.length - 1);
    if (pick === null && da.length > 1 && nr === this.zuletzt[name]) nr = (nr + 1) % da.length;
    this.zuletzt[name] = nr;
    const [datei, laut] = da[nr];
    const buf = this.puffer[datei];
    const t = this.ctx.currentTime + when, len = buf.duration / rate, g0 = gain * laut;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    if (fadeIn > 0) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(g0, t + fadeIn); } else g.gain.setValueAtTime(g0, t);
    if (fadeOut > 0) { g.gain.setValueAtTime(g0, t + Math.max(fadeIn, len - fadeOut)); g.gain.linearRampToValueAtTime(0.0001, t + len); }
    let kette = src;
    if (dumpf > 0) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = dumpf;
      kette = src.connect(f);
    }
    kette.connect(g).connect(k.bus === 'raum' ? this.raum : this.master);
    src.start(t);
    return true;
  }

  // Eine Hintergrund-Schleife leise oder laut stellen (0 = aus). Sie wird erst gestartet, wenn sie gebraucht wird.
  schleife(name, level) {
    if (!this.ctx) return;
    let s = this.schleifen[name];
    if (!s) {
      const [datei, laut] = KLAENGE[name].v[0];
      if (level <= 0 || !this.puffer[datei]) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.puffer[datei]; src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.raum);
      src.start(0, Math.random() * src.buffer.duration);
      s = this.schleifen[name] = { src, g, laut, level: -1 };
    }
    if (s.level === level) return;
    s.level = level;
    s.g.gain.setTargetAtTime(level * s.laut, this.ctx.currentTime, 0.6);
  }

  // Muss nach dem ersten Tippen/Klicken aufgerufen werden (Browser-Regel, auf dem iPad besonders streng:
  // ohne Tippen bleibt alles still). Wenn die App im Hintergrund war, weckt derselbe Aufruf den Ton wieder auf.
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }   // iOS kennt auch 'interrupted'
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Ganz am Ende sitzt ein „Begrenzer“: Wenn viele Geräusche zusammenkommen, wird es nicht kratzig
    const grenze = this.ctx.createDynamicsCompressor();
    grenze.threshold.value = -4; grenze.knee.value = 4; grenze.ratio.value = 16; grenze.attack.value = 0.002; grenze.release.value = 0.12;
    grenze.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(grenze);
    this.raum = this.ctx.createGain();              // Publikum und Umgebung haben einen eigenen Regler
    this.raum.gain.value = this.umgebung;
    this.raum.connect(this.master);
    this.noise = this.makeNoise(2);
    this.clapBuf = this.makeApplause(3.5);
    this.startCrowd();
    this.loadSamples();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.enabled ? v : 0; }
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.value = on ? this.volume : 0; }
  setUmgebung(v) { this.umgebung = v; if (this.raum) this.raum.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }

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
    src.connect(f).connect(this.crowdGain).connect(this.raum);
    src.start();
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

  // Wie laut ist das Stadion im Hintergrund? (0 = still, im Match etwa 0.02 bis 0.06)
  setCrowd(level) {
    if (!this.ctx) return;
    this.crowdLevel = level;
    const echt = !!this.puffer[KLAENGE.stadion.v[0][0]];
    // Mit der echten Aufnahme schweigt das erzeugte Rauschen
    this.crowdGain.gain.setTargetAtTime(echt ? 0 : level, this.ctx.currentTime, 0.6);
    if (echt) this.schleife('stadion', level);
  }

  // Geräusche auf dem Turniergelände: Stimmen der Besucher und Vögel. level 0 = aus, 1 = normal
  gelaende(level) {
    if (!this.ctx) return;
    this.schleife('stimmen', level);
    this.schleife('park', level);
  }

  // Schläger trifft Ball. power 0..1, art = Schlagart ('serve', 'smash', 'slice', 'drop', 'topspin', 'drive' …)
  hit(power = 0.6, art = '') {
    if (!this.ctx) return;
    if (art === true) art = 'serve';                 // alte Schreibweise: hit(power, true)
    const p = Math.max(0.2, Math.min(1, power));
    const serve = art === 'serve' || art === 'smash';
    const weich = art === 'slice' || art === 'drop';
    const zufall = 0.97 + Math.random() * 0.06;      // jedes Mal eine Spur höher oder tiefer
    // Harte Schläge lauter und etwas tiefer, weiche leiser und heller
    const laut = 0.5 + 0.85 * p;
    if (serve && this.play('aufschlag', { gain: laut, rate: 0.98 * zufall })) return;
    if (weich && this.play('slice', { gain: (art === 'drop' ? 0.55 : 0.85) * laut, rate: zufall })) return;
    const rate = art === 'topspin' ? 1.04 : art === 'lob' ? 0.94 : 1.1 - 0.16 * p;
    if (this.play('schlag', { gain: laut, rate: rate * zufall })) return;
    this.tone({ from: 260 + 200 * p, to: 90, dur: 0.09, gain: 0.5 * p + 0.2 });
    this.burst({ freq: 1900 + 900 * p, q: 0.9, dur: 0.05 + 0.03 * p, gain: 0.45 * p + 0.15 });
    this.burst({ freq: 5200, q: 2, dur: 0.03, gain: 0.18 * p });
    if (serve) this.burst({ freq: 700, q: 0.7, dur: 0.12, gain: 0.3 });
  }

  // Ball springt auf. Jeder Belag klingt anders: Hartplatz hell und knackig, Sand dumpf, Rasen ganz weich, Halle mit etwas mehr Wumms.
  bounce(speed = 15, surface = 'hard') {
    if (!this.ctx) return;
    const g = Math.max(0.08, Math.min(0.5, speed / 45));
    const soft = surface === 'clay' || surface === 'grass';
    const B = { hard: [1, 1, 0], indoor: [1.1, 0.94, 0], clay: [0.8, 0.86, 2600], grass: [0.6, 0.8, 1500] }[surface] || [1, 1, 0];
    if (this.play('aufprall', { gain: (0.12 + g * 0.9) * B[0], rate: B[1] * (0.95 + Math.random() * 0.1), dumpf: B[2] })) return;
    this.tone({ from: soft ? 150 : 210, to: 70, dur: 0.07, gain: g });
    this.burst({ freq: soft ? 500 : 900, q: 0.8, dur: 0.05, gain: g * 0.6, type: 'lowpass' });
  }

  net() {
    if (!this.ctx) return;
    if (this.play('netz', { rate: 0.95 + Math.random() * 0.1 })) return;
    this.burst({ freq: 380, q: 0.5, dur: 0.22, gain: 0.5, type: 'lowpass' });
    this.tone({ from: 120, to: 60, dur: 0.15, gain: 0.25 });
  }

  // Ein Spieler bremst scharf ab: Auf Hartplatz und in der Halle quietschen die Schuhe, auf Sand rutscht er. Auf Rasen hört man nichts.
  bremsen(surface = 'hard', staerke = 1) {
    if (!this.ctx) return;
    if (surface === 'clay') this.play('rutschen', { gain: staerke, rate: 0.9 + Math.random() * 0.2 });
    else if (surface !== 'grass') this.play('quietschen', { gain: staerke, rate: 0.9 + Math.random() * 0.25 });
  }

  // --- Menü ---
  click() {
    if (!this.ctx) return;
    if (this.play('klick')) return;
    this.tone({ from: 900, to: 600, dur: 0.05, gain: 0.15, type: 'triangle' });
  }
  zurueck() { if (this.ctx && !this.play('zurueck')) this.click(); }
  schalter() { if (this.ctx && !this.play('schalter')) this.click(); }
  tipp() { if (this.ctx && !this.play('tipp')) this.click(); }
  plopp() { if (this.ctx && !this.play('plopp')) this.click(); }

  // „Gut gemacht!“ – ein heller Zweiklang
  coin() {
    if (!this.ctx) return;
    if (this.play('richtig')) return;
    this.tone({ from: 1200, to: 1200, dur: 0.08, gain: 0.2, type: 'square' });
    this.tone({ from: 1700, to: 1700, dur: 0.18, gain: 0.2, type: 'square', when: 0.08 });
  }
  richtig() { this.coin(); }
  falsch() {
    if (!this.ctx) return;
    if (this.play('falsch')) return;
    this.tone({ from: 220, to: 140, dur: 0.25, gain: 0.18, type: 'sawtooth' });
  }
  // Etwas gekauft oder Preisgeld bekommen: die Kasse klingelt
  kasse() { if (this.ctx && !this.play('kasse')) this.coin(); }
  // Glücksball gefunden, Stern oder Stempel bekommen
  stern() { if (this.ctx && !this.play('stern')) this.coin(); }
  // Mini-Spiel gut geschafft / Turnier gewonnen: eine kleine Melodie
  geschafft() { if (this.ctx && !this.play('geschafft')) this.coin(); }
  sieg() { if (this.ctx && !this.play('sieg')) this.coin(); }
  stift() { if (this.ctx) this.play('stift'); }

  // --- Turniergelände ---
  schritt(joggt = false) { if (this.ctx) this.play('schritt', { gain: joggt ? 1 : 0.6, rate: (joggt ? 1 : 0.85) * (0.92 + Math.random() * 0.16) }); }
  autotuer() { if (this.ctx) this.play('autotuer'); }
  auto() { if (this.ctx) this.play('auto', { fadeOut: 1.5 }); }
  kamera() { if (this.ctx && !this.play('kamera')) this.click(); }

  // Applaus. strength 0..1, bei cheer jubelt das Publikum zusätzlich
  applause(strength = 0.6, cheer = false) {
    if (!this.ctx) return;
    // Echter Applaus aus der Aufnahme: je nach Stärke kurz, mittel oder lang
    const kind = strength > 0.85 ? 'applausGross' : strength > 0.55 ? 'applausMittel' : 'applausKlein';
    if (this.play(kind, { gain: 1.6 + 1.6 * strength })) {
      if (cheer && strength >= 0.95) this.play('jubel', { gain: 0.8, when: 0.15 });      // Satz oder Match gewonnen: das Stadion jubelt
      return;
    }
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.clapBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9 * strength, t + 0.25);
    g.gain.setTargetAtTime(0.0001, t + 1.2 + strength, 0.5);
    src.connect(g).connect(this.raum);
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
    src.connect(f).connect(g).connect(this.raum);
    src.start(t); src.stop(t + 3.5);
  }

  // Das Publikum erschrickt oder stöhnt (Fehler, knapp daneben)
  ooh() {
    if (!this.ctx) return;
    if (this.play('schreck', { fadeOut: 0.2 })) return;
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
    src.connect(f).connect(g).connect(this.raum);
    src.start(t); src.stop(t + 2);
  }

  // Das Publikum staunt („Ooh!“) – bei einem Ass oder einem tollen Gewinnschlag
  staunen() { if (this.ctx) this.play('raunen', { gain: 0.9, fadeOut: 0.3 }); }

  // Die Stimmen-Aufnahmen laden, die ein Match braucht (alle Ansagen, die Linienrichter und die Namen der beiden Spieler).
  // Was schon geladen ist, wird nicht noch einmal geholt. Alle Ansagen zusammen sind etwa 0,4 MB, ein Name etwa 4 KB.
  async stimmeLaden(names = []) {
    if (!this.ctx || this.stimme !== 'aufnahme') return;
    const holen = async (clip) => {
      try {
        const data = await (await fetch(D + 'stimme/' + clip + '.mp3')).arrayBuffer();
        this.stimmen[clip] = await new Promise((ok, err) => this.ctx.decodeAudioData(data, ok, err));
      } catch (e) { console.warn('Stimme fehlt:', clip, e); }
    };
    // Die Namen zuerst (es sind nur zwei), dann der Rest – immer acht Dateien gleichzeitig, damit es schnell geht
    const offen = dateienFuer(names).filter((clip) => this.stimmen[clip] === undefined);
    offen.sort((a, b) => b.startsWith('namen/') - a.startsWith('namen/'));
    for (const clip of offen) this.stimmen[clip] = null;          // null = wird gerade geholt
    for (let i = 0; i < offen.length; i += 8) await Promise.all(offen.slice(i, i + 8).map(holen));
  }

  // Der Schiedsrichter sagt etwas an.
  //   teile = Liste aus Aufnahmen und Pausen (siehe js/stimme.js), z. B. ['en/advantage', 'namen/sinner']
  //   text  = derselbe Satz auf Deutsch für die Stimme des Geräts (wenn die Aufnahmen aus sind oder eine fehlt)
  //   when  = erst nach so vielen Sekunden anfangen
  //   danach = true: den Schiedsrichter ausreden lassen und erst dann sprechen (sonst unterbricht die neue Ansage die alte)
  ansage(teile, text, when = 0, danach = false, versuch = 0) {
    if (!this.enabled || this.stimme === 'aus') return;
    const clips = teile ? teile.filter((t) => typeof t === 'string') : [];
    const alleDa = this.ctx && this.stimme === 'aufnahme' && clips.length > 0 && clips.every((c) => this.stimmen[c]);
    if (!alleDa) {
      // Wird eine Aufnahme gerade noch geholt? Dann kurz warten (höchstens 4-mal 0,4 Sekunden) und es noch einmal versuchen.
      if (this.ctx && this.stimme === 'aufnahme' && versuch < 4 && clips.some((c) => this.stimmen[c] === null)) {
        setTimeout(() => this.ansage(teile, text, Math.max(0, when - 0.4), danach, versuch + 1), 400);
        return;
      }
      if (text) { if (when > 0) setTimeout(() => this.say(text), when * 1000); else this.say(text); }
      return;
    }
    if (!danach) this.still();
    let t = this.ctx.currentTime + when;
    if (danach && this.sprichtBis > t - 0.3) t = this.sprichtBis + 0.3;
    for (const teil of teile) {
      if (typeof teil === 'number') { t += teil; continue; }
      const src = this.ctx.createBufferSource();
      src.buffer = this.stimmen[teil];
      const g = this.ctx.createGain();
      g.gain.value = STIMME_LAUT;
      src.connect(g).connect(this.master);
      src.start(t);
      this.spricht.push(src);
      t += src.buffer.duration + STIMME_LUECKE;
    }
    this.sprichtBis = t;
  }

  // Der Schiedsrichter hört mitten im Satz auf (weil schon die nächste Ansage kommt)
  still() {
    for (const src of this.spricht) { try { src.stop(); } catch (e) { /* war schon fertig */ } }
    this.spricht = []; this.sprichtBis = 0;
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* egal */ }
  }

  // Ein Linienrichter ruft: art = 'out' (Ball im Aus) oder 'fault' (Aufschlag im Aus). Jedes Mal ruft ein anderer.
  // Gibt true zurück, wenn wirklich eine Aufnahme gerufen hat.
  linienrichter(art) {
    if (!this.ctx || !this.enabled || this.stimme !== 'aufnahme' || !LINIE[art]) return false;
    let nr = 1 + Math.floor(Math.random() * LINIE[art]);
    if (nr === this.zuletzt['linie_' + art]) nr = nr % LINIE[art] + 1;
    this.zuletzt['linie_' + art] = nr;
    const buf = this.stimmen[`linie/${art}_${nr}`];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = LINIE_LAUT;
    src.connect(g).connect(this.master);
    src.start();
    return true;
  }

  // Die Stimme des Geräts spricht einen deutschen Satz (Sprachausgabe)
  say(text) {
    if (!this.enabled || this.stimme === 'aus' || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 1.05; u.pitch = 0.9; u.volume = Math.min(1, this.volume);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* Sprachausgabe nicht verfügbar */ }
  }
}
