// Powershot – Steuerung. Drei Arten:
//   klassik : wie in der Python-Version (Mausrad/Pfeile zielen, linke Maustaste halten = Kraft)
//   touch   : für iPad/Handy (links Joystick, rechts wischen)
//   profi   : Tastatur, selbst laufen, verschiedene Schläge, Richtung beim Treffen
//
// Das Match fragt die Steuerung ab:
//   move()        -> { x, f }   Laufrichtung (-1..1), f = nach vorne
//   peek(serve)   -> aktuelle Eingabe (für die Ziel-Anzeige) oder null
//   consume()     -> Eingabe für den Schlag abholen (oder null, wenn nichts gedrückt wurde)
//   takeServe()   -> Eingabe für den Aufschlag, sobald sie abgeschickt wurde

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const POWER_MAX = 1.4;
export const POWER_LIMIT = 1.08;       // darüber fliegt der Ball zu lang
const CHARGE_TIME = 0.75;              // Sekunden bis volle Kraft (klassik)
const DOUBLE = 0.32;                   // Zeitfenster für Doppelklick / Doppeltipp

export class Controls {
  constructor(el, stickEl) {
    this.el = el;                 // Fläche, auf der getippt/geklickt wird
    this.stickEl = stickEl;       // Anzeige für den Joystick
    this.mode = 'klassik';
    this.enabled = false;
    this.keys = {};
    this.ctx = 'idle';
    this.reset();
    this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 };
    this.swipe = null;
    this.lastTap = -9;
    this.lastClick = -9;
    this.time = 0;
    this.bind();
  }

  reset() {
    this.aim = 0;
    this.power = 0;
    this.charging = false;
    this.committed = null;      // fertige Eingabe
    this.serveOut = null;
    this.type = 'drive';
    this.live = null;           // Eingabe, die gerade entsteht (Finger noch auf dem Bildschirm)
  }

  setMode(mode) { this.mode = mode; this.reset(); this.showStick(false); }

  // ctx: 'serve' | 'rally'
  begin(ctx) {
    const keepAim = this.mode === 'klassik' && ctx === 'rally' ? 0 : 0;
    this.ctx = ctx;
    this.reset();
    this.aim = keepAim;
  }

  bind() {
    const el = this.el;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    el.addEventListener('wheel', (e) => {
      if (!this.enabled || this.mode !== 'klassik') return;
      e.preventDefault();
      this.aim = clamp(this.aim + (e.deltaY < 0 ? -0.14 : 0.14), -1, 1);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  // ---------------------------------------------------------------
  // Tastatur
  // ---------------------------------------------------------------
  onKey(e, down) {
    if (!this.enabled) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (this.keys[k] === down) return;
    this.keys[k] = down;
    if (this.mode !== 'profi') return;
    const shot = { ' ': 'drive', j: 'drive', k: 'slice', l: 'lob', i: 'drop' }[k];
    if (!shot) return;
    if (down) {
      this.charging = true; this.power = 0; this.type = shot; this.committed = null;
    } else if (this.charging && this.type === shot) {
      this.charging = false;
      this.committed = { type: shot, power: this.power };
      if (this.ctx === 'serve') this.serveOut = this.profiRaw(this.committed);
    }
  }

  profiRaw(c) {
    const K = this.keys;
    const lr = (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0);
    const ud = (K.ArrowUp || K.w ? 1 : 0) - (K.ArrowDown || K.s ? 1 : 0);
    if (this.ctx === 'serve') return { type: 'serve', aim: lr * 0.85, power: c.power, committed: true };
    return { type: c.type, aimMode: 'abs', aim: lr * 0.88, depth: 0.78 + ud * 0.16, power: clamp(c.power, 0.2, 1), committed: true };
  }

  // ---------------------------------------------------------------
  // Maus und Finger
  // ---------------------------------------------------------------
  onDown(e) {
    if (!this.enabled) return;
    if (this.mode === 'klassik') {
      if (e.pointerType === 'touch') return;
      if (e.button === 2) { this.commitClassic('lob'); return; }
      if (e.button !== 0) return;
      if (this.ctx === 'rally' && this.time - this.lastClick <= DOUBLE) {
        this.commitClassic('lob');
      } else {
        this.charging = true; this.power = 0; this.type = 'drive'; this.committed = null;
      }
      this.lastClick = this.time;
      return;
    }
    if (this.mode !== 'touch') return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < r.width * 0.42 && this.stick.id === null) {
      this.stick = { id: e.pointerId, x0: x, y0: y, x: 0, f: 0 };
      this.showStick(true, x, y, 0, 0);
    } else if (!this.swipe) {
      this.swipe = { id: e.pointerId, x0: x, y0: y, x, y, t0: this.time, w: r.width };
    }
  }

  onMove(e) {
    if (!this.enabled || this.mode !== 'touch') return;
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (e.pointerId === this.stick.id) {
      const R = 55;
      let dx = (x - this.stick.x0) / R, dy = (y - this.stick.y0) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stick.x = dx; this.stick.f = -dy;
      this.showStick(true, this.stick.x0, this.stick.y0, dx * R, dy * R);
    } else if (this.swipe && e.pointerId === this.swipe.id) {
      this.swipe.x = x; this.swipe.y = y;
      this.live = this.swipeRaw(this.swipe, false);
    }
  }

  onUp(e) {
    if (this.mode === 'klassik') {
      if (!this.enabled || e.button !== 0 || !this.charging) return;
      this.commitClassic('drive');
      return;
    }
    if (this.mode !== 'touch') return;
    if (e.pointerId === this.stick.id) {
      this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 };
      this.showStick(false);
    } else if (this.swipe && e.pointerId === this.swipe.id) {
      const raw = this.enabled ? this.swipeRaw(this.swipe, true) : null;
      this.swipe = null;
      this.live = null;
      if (!raw) return;
      this.committed = raw;
      if (this.ctx === 'serve') this.serveOut = raw;
    }
  }

  commitClassic(type) {
    this.charging = false;
    this.type = type;
    this.committed = { type, power: type === 'lob' ? 0.6 : this.power };
    if (this.ctx === 'serve') this.serveOut = this.classicRaw(true);
  }

  classicRaw(committed) {
    const c = this.committed;
    const power = c ? c.power : this.power;
    const idle = !c && !this.charging;       // noch nichts gedrückt: nur die Richtung zeigen
    if (this.ctx === 'serve') return { type: 'serve', aim: this.aim, power, committed, idle };
    return { type: c ? c.type : this.type, aimMode: 'angle', aim: this.aim, power, committed, idle };
  }

  // Aus einer Wischbewegung wird ein Schlag
  swipeRaw(s, final) {
    const dx = s.x - s.x0, dy = s.y - s.y0;
    const len = Math.hypot(dx, dy);
    const serve = this.ctx === 'serve';
    const aim = clamp(dx / 110, -1, 1);
    if (len < 18) {
      if (!final) return null;
      const tapAim = clamp((s.x0 - s.w * 0.71) / (s.w * 0.2), -1, 1) * 0.7;
      if (serve) return { type: 'serve', aim: tapAim, power: 0.55, committed: true };
      const double = this.time - this.lastTap <= DOUBLE;
      this.lastTap = this.time;
      if (double) return { type: 'lob', aimMode: 'abs', aim: tapAim, power: 0.6, committed: true };
      return { type: 'drive', aimMode: 'abs', aim: tapAim, depth: 0.7, power: 0.5, committed: true };
    }
    const power = clamp((len - 40) / 200, 0.15, 1.15);
    if (serve) return { type: 'serve', aim, power, committed: final };
    if (dy > 18 && Math.abs(dy) > Math.abs(dx) * 0.6) {
      return { type: 'drop', aimMode: 'abs', aim, power: 0.4, committed: final };
    }
    if (Math.abs(dx) > Math.abs(dy) * 2.5) {
      return { type: 'slice', aimMode: 'abs', aim: Math.sign(dx) * 0.85, depth: 0.8, power: 0.6, committed: final };
    }
    return { type: 'drive', aimMode: 'abs', aim, depth: 0.45 + 0.5 * power, power: Math.min(1, power), committed: final };
  }

  showStick(on, x = 0, y = 0, kx = 0, ky = 0) {
    const s = this.stickEl;
    if (!s) return;
    s.style.display = on ? 'block' : 'none';
    if (!on) return;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.firstElementChild.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  // ---------------------------------------------------------------
  // Abfragen durch das Match
  // ---------------------------------------------------------------
  update(dt) {
    this.time += dt;
    if (!this.enabled) return;
    const K = this.keys;
    if (this.mode === 'klassik') {
      const lr = (K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0);
      this.aim = clamp(this.aim + lr * 1.5 * dt, -1, 1);
      if (this.charging) this.power = Math.min(POWER_MAX, this.power + dt / CHARGE_TIME);
    } else if (this.mode === 'profi') {
      if (this.charging) this.power = Math.min(this.ctx === 'serve' ? 1.25 : 1, this.power + dt / 0.5);
    }
  }

  move() {
    const K = this.keys;
    if (this.mode === 'klassik') return { x: 0, f: (K.ArrowUp ? 1 : 0) - (K.ArrowDown ? 1 : 0) };
    if (this.mode === 'profi') {
      return {
        x: (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0),
        f: (K.ArrowUp || K.w ? 1 : 0) - (K.ArrowDown || K.s ? 1 : 0),
      };
    }
    return { x: this.stick.x, f: this.stick.f };
  }

  peek() {
    if (this.mode === 'klassik') return this.classicRaw(!!this.committed);
    if (this.mode === 'profi') {
      if (this.committed) return this.profiRaw(this.committed);
      if (this.charging) return { ...this.profiRaw({ type: this.type, power: this.power }), committed: false };
      return null;
    }
    return this.committed || this.live;
  }

  consume() {
    let raw = null;
    if (this.mode === 'klassik') {
      if (this.committed || this.charging) raw = this.classicRaw(true);
    } else if (this.mode === 'profi') {
      if (this.committed) raw = this.profiRaw(this.committed);
      else if (this.charging) raw = this.profiRaw({ type: this.type, power: this.power });
    } else {
      raw = this.committed;
    }
    this.committed = null; this.charging = false; this.power = 0; this.live = null;
    return raw;
  }

  takeServe() {
    const r = this.serveOut;
    this.serveOut = null;
    if (r) { this.committed = null; this.charging = false; this.power = 0; }
    return r;
  }

  // Für den Kraftbalken auf dem Bildschirm
  hud() {
    const show = this.mode !== 'touch' && (this.charging || !!this.committed);
    const p = this.committed ? this.committed.power : this.power;
    return { show, power: p, max: POWER_MAX, limit: POWER_LIMIT, charging: this.charging, type: this.committed ? this.committed.type : this.type };
  }
}
