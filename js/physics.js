// Powershot – Ballphysik in Metern.
// Koordinaten: x = quer (rechts +), y = Höhe, z = längs. Netz bei z = 0.
// Seite 0 (du) spielt bei z > 0, Seite 1 (Gegner) bei z < 0.

export const COURT = {
  L: 11.885,      // halbe Platzlänge (Netz bis Grundlinie)
  W: 4.115,       // halbe Breite Einzelfeld
  WD: 5.485,      // halbe Breite Doppelfeld
  SL: 6.40,       // Netz bis Aufschlaglinie
  NET_H: 0.914,   // Netzhöhe in der Mitte
  NET_POST: 1.07, // Netzhöhe am Pfosten
  NET_W: 6.4,     // halbe Netzbreite
  BALL_R: 0.033,
};

// e = wie hoch der Ball abspringt, f = wie viel Tempo er beim Aufprall behält
export const SURFACES = {
  hard: { e: 0.75, f: 0.72 },
  clay: { e: 0.80, f: 0.62 },
  grass: { e: 0.68, f: 0.80 },
  indoor: { e: 0.74, f: 0.75 },
};

const G = 9.81;
const DRAG = 0.016;     // Luftwiderstand
const SPIN = 0.10;      // Topspin drückt den Ball nach unten, Slice lässt ihn schweben
const H = 1 / 240;      // Rechenschritt

export const netHeightAt = (x) =>
  COURT.NET_H + (COURT.NET_POST - COURT.NET_H) * Math.min(1, Math.abs(x) / COURT.NET_W);

export class Ball {
  constructor() {
    this.pos = { x: 0, y: 1, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = 0;
    this.bounces = 0;
    this.lastHitter = -1;
    this.isServe = false;
    this.live = false;       // fliegt der Ball gerade?
    this.rest = 0;
  }

  clone() {
    const b = new Ball();
    b.pos = { ...this.pos }; b.vel = { ...this.vel };
    b.spin = this.spin; b.bounces = this.bounces; b.lastHitter = this.lastHitter;
    b.isServe = this.isServe; b.live = this.live; b.rolling = this.rolling;
    return b;
  }

  launch(pos, vel, spin, hitter, isServe = false) {
    this.pos = { ...pos }; this.vel = { ...vel };
    this.spin = spin; this.bounces = 0; this.lastHitter = hitter; this.isServe = isServe;
    this.live = true; this.rolling = false; this.rest = 0;
  }

  // Bewegt den Ball um dt Sekunden. Gibt Ereignisse zurück:
  // {type:'bounce', x, z, n} oder {type:'net'} oder {type:'cord'}
  step(dt, surface, events = []) {
    if (!this.live) return events;
    let t = dt + this.rest;
    while (t >= H) {
      t -= H;
      this.sub(surface, events);
    }
    this.rest = t;
    return events;
  }

  sub(surface, events) {
    const p = this.pos, v = this.vel;
    if (this.rolling) {          // Ball rollt nur noch aus
      v.x *= 1 - 2.5 * H; v.z *= 1 - 2.5 * H; v.y = 0;
      p.x += v.x * H; p.z += v.z * H; p.y = COURT.BALL_R;
      if (Math.hypot(v.x, v.z) < 0.25) this.live = false;
      return;
    }
    const sp = Math.hypot(v.x, v.y, v.z);
    const vh = Math.hypot(v.x, v.z);
    v.x += -DRAG * sp * v.x * H;
    v.z += -DRAG * sp * v.z * H;
    v.y += (-G - DRAG * sp * v.y - this.spin * SPIN * vh) * H;
    const oz = p.z;
    p.x += v.x * H; p.y += v.y * H; p.z += v.z * H;

    // Netz: fliegt der Ball gerade über die Mittellinie?
    if ((oz > 0) !== (p.z > 0) && Math.abs(p.x) < COURT.NET_W) {
      const nh = netHeightAt(p.x);
      if (p.y < nh + COURT.BALL_R) {
        if (p.y > nh - 0.04) {
          // Netzkante: Ball tropft drüber
          v.z *= 0.45; v.x *= 0.6; v.y = 1.2;
          events.push({ type: 'cord' });
        } else {
          p.z = oz > 0 ? 0.06 : -0.06;
          v.z = -v.z * 0.07; v.x *= 0.15; v.y = Math.min(v.y, 0) * 0.3;
          events.push({ type: 'net' });
        }
      }
    }

    // Boden
    if (p.y <= COURT.BALL_R && v.y < 0) {
      p.y = COURT.BALL_R;
      this.bounces++;
      events.push({ type: 'bounce', x: p.x, z: p.z, n: this.bounces, speed: sp });
      const e = surface.e * (this.spin < 0 ? 0.85 : 1);
      const f = Math.min(0.9, surface.f * (this.spin > 0 ? 1.07 : 0.95));
      v.y = -v.y * e;
      v.x *= f; v.z *= f;
      this.spin *= 0.35;
      if (v.y < 0.7) {           // springt nicht mehr hoch: ab jetzt rollt er
        this.rolling = true;
        if (this.bounces < 2) {
          this.bounces = 2;
          events.push({ type: 'bounce', x: p.x, z: p.z, n: 2, speed: 0 });
        }
      }
    }
  }
}

// Wie muss der Ball starten, damit er bei "target" landet?
// vh = waagerechtes Tempo beim Start. Gesucht wird das passende Tempo nach oben.
// Rückgabe: { vel, clearance (Abstand über dem Netz), time }
export function solveShot(p0, target, vh, spin) {
  const dx = target.x - p0.x, dz = target.z - p0.z;
  const D = Math.max(0.5, Math.hypot(dx, dz));
  const ux = dx / D, uz = dz / D;
  const crosses = (p0.z > 0) !== (target.z > 0);
  const sNet = crosses && Math.abs(uz) > 1e-4 ? Math.abs(p0.z / uz) : -1;

  // Flug in 2D nachrechnen: s = Strecke, y = Höhe
  const fly = (vy0) => {
    let s = 0, y = p0.y, vs = vh, vy = vy0, t = 0, yNet = null;
    const h = 1 / 120;
    while (t < 8) {
      const sp = Math.hypot(vs, vy);
      vs += -DRAG * sp * vs * h;
      vy += (-G - DRAG * sp * vy - spin * SPIN * vs) * h;
      const os = s;
      s += vs * h; y += vy * h; t += h;
      if (sNet >= 0 && os < sNet && s >= sNet) yNet = y;
      if (y <= COURT.BALL_R && vy < 0) break;
    }
    return { s, yNet, t };
  };

  let lo = -25, hi = 30, res = null;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    res = fly(mid);
    if (res.s < D) lo = mid; else hi = mid;
  }
  const vy = (lo + hi) / 2;
  res = fly(vy);
  const xNet = sNet >= 0 ? p0.x + ux * sNet : 0;
  return {
    vel: { x: ux * vh, y: vy, z: uz * vh },
    clearance: res.yNet === null ? 99 : res.yNet - netHeightAt(xNet),
    time: res.t,
  };
}

// Wie solveShot, aber nimmt so lange Tempo raus, bis der Ball sicher übers Netz geht.
export function solveSafe(p0, target, vh, spin, minClear) {
  let sol = solveShot(p0, target, vh, spin);
  for (let i = 0; i < 14 && sol.clearance < minClear; i++) {
    vh *= 0.93;
    sol = solveShot(p0, target, vh, spin);
  }
  sol.vh = vh;
  return sol;
}

// Sagt die Flugbahn voraus. Gibt Stützpunkte und den ersten Aufprall zurück.
export function predict(ball, surface, maxT = 5) {
  const b = ball.clone();
  b.rest = 0;
  const pts = [];
  let first = null, t = 0, net = false;
  const dt = 1 / 60;
  while (t < maxT && b.live) {
    const ev = b.step(dt, surface);
    t += dt;
    for (const e of ev) {
      if (e.type === 'bounce' && !first) first = { x: e.x, z: e.z, t };
      if (e.type === 'net') net = true;
    }
    pts.push({ t, x: b.pos.x, y: b.pos.y, z: b.pos.z, b: b.bounces });
    if (b.bounces >= 2) break;
  }
  return { pts, first, net };
}

// Normalverteilte Zufallszahl (für Streuung der Schläge)
export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
