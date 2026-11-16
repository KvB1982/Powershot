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

// e  = wie hoch der Ball abspringt (0,75 = er kommt mit 75 % seines Tempos nach oben zurück)
// mu = wie stark der Boden den Ball bremst (Reibung). Sand "greift" stark, Rasen ist rutschig.
export const SURFACES = {
  hard: { e: 0.75, mu: 0.62 },
  clay: { e: 0.80, mu: 0.78 },
  grass: { e: 0.68, mu: 0.50 },
  indoor: { e: 0.74, mu: 0.57 },
};

const G = 9.81;
const H = 1 / 240;      // Rechenschritt
// --- Luft: Diese Zahlen kommen aus Messungen an echten Tennisbällen. ---
const LUFT = 0.0363;    // Luftdichte × Ballfläche ÷ (2 × Ballgewicht) – macht aus Tempo eine Kraft
const CW = 0.51;        // Luftwiderstand eines Tennisballs (der Filz bremst kräftig)
const RPM = Math.PI / 30;   // rechnet "Umdrehungen pro Minute" in "Bogenmaß pro Sekunde" um

// Der Drall (Spin) eines Balls hat drei Teile, alle in Umdrehungen pro Minute:
//   top   : + = Topspin (Ball dreht nach vorne, fällt schneller), − = Slice/Rückwärtsdrall (Ball schwebt)
//   seite : + = Ball biegt in der Luft nach rechts ab (in Flugrichtung gesehen), − = nach links
//   drall : + = Ball springt beim Aufkommen nach rechts weg (wie beim Kick-Aufschlag), − = nach links
export function spinVon(s) {
  if (typeof s === 'number') return { top: s, seite: 0, drall: 0 };
  return { top: (s && s.top) || 0, seite: (s && s.seite) || 0, drall: (s && s.drall) || 0 };
}

// Wie stark wird der Ball gerade beschleunigt? (Schwerkraft + Luftwiderstand + Magnus-Kraft)
// Magnus-Kraft: Ein drehender Ball zieht die Luft auf einer Seite mit. Dadurch wird er quer zur Flugrichtung
// weggedrückt – Topspin nach unten, Slice nach oben, Seitendrall zur Seite.
// Das Ergebnis wird in "out" geschrieben, damit nicht ständig neue Objekte entstehen.
function beschleunigung(v, spin, out) {
  const sp = Math.hypot(v.x, v.y, v.z), vh = Math.hypot(v.x, v.z);
  const k = LUFT * CW * sp;
  out.x = -k * v.x; out.y = -G - k * v.y; out.z = -k * v.z;
  const w = Math.hypot(spin.top, spin.seite) * RPM;      // Drehung, die in der Luft wirkt
  if (w > 1 && vh > 0.5) {
    // Je schneller sich der Ball im Vergleich zu seinem Flugtempo dreht, desto stärker die Magnus-Kraft
    const cl = 1 / (2 + sp / (COURT.BALL_R * w));
    const m = LUFT * cl * sp / w * RPM;
    const hx = v.x / vh, hz = v.z / vh;                  // Flugrichtung am Boden entlang
    // Topspin: drückt nach unten (und ein bisschen nach vorne, solange der Ball steigt)
    out.y -= m * spin.top * vh;
    out.x += m * spin.top * v.y * hx;
    out.z += m * spin.top * v.y * hz;
    // Seitendrall: drückt nach rechts (rechts von der Flugrichtung ist (−hz, hx))
    out.x += m * spin.seite * vh * -hz;
    out.z += m * spin.seite * vh * hx;
  }
  return out;
}
const A = { x: 0, y: 0, z: 0 };

export const netHeightAt = (x) =>
  COURT.NET_H + (COURT.NET_POST - COURT.NET_H) * Math.min(1, Math.abs(x) / COURT.NET_W);

export class Ball {
  constructor() {
    this.pos = { x: 0, y: 1, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.spin = spinVon(0);
    this.bounces = 0;
    this.lastHitter = -1;
    this.isServe = false;
    this.live = false;       // fliegt der Ball gerade?
    this.rest = 0;
  }

  clone() {
    const b = new Ball();
    b.pos = { ...this.pos }; b.vel = { ...this.vel };
    b.spin = { ...this.spin }; b.bounces = this.bounces; b.lastHitter = this.lastHitter;
    b.isServe = this.isServe; b.live = this.live; b.rolling = this.rolling;
    return b;
  }

  launch(pos, vel, spin, hitter, isServe = false) {
    this.pos = { ...pos }; this.vel = { ...vel };
    this.spin = spinVon(spin); this.bounces = 0; this.lastHitter = hitter; this.isServe = isServe;
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
    beschleunigung(v, this.spin, A);
    v.x += A.x * H; v.y += A.y * H; v.z += A.z * H;
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
      this.aufprall(surface);
      if (v.y < 0.7) {           // springt nicht mehr hoch: ab jetzt rollt er
        this.rolling = true;
        if (this.bounces < 2) {
          this.bounces = 2;
          events.push({ type: 'bounce', x: p.x, z: p.z, n: 2, speed: 0 });
        }
      }
    }
  }

  // Der Ball trifft den Boden. Hier entscheidet sich, wie er wegspringt:
  //  - Nach oben kommt er mit dem Anteil "e" seines Falltempos zurück. Wer steil herunterkommt (Topspin!), springt hoch.
  //  - Die Unterseite des Balls rutscht über den Boden, und die Reibung bremst dieses Rutschen.
  //    Topspin: Die Unterseite dreht nach hinten, der Ball rutscht wenig → er behält viel Tempo und schießt nach vorne weg.
  //    Slice:   Die Unterseite dreht nach vorne, der Ball rutscht stark → er wird gebremst. Kommt er flach an, bleibt er flach.
  //    Stoppball: steil und mit viel Rückwärtsdrall → er bleibt fast stehen oder springt sogar zurück.
  //    Kick:    Der Ball dreht auch um die Flugrichtung → er springt zur Seite weg.
  aufprall(surface) {
    const v = this.vel, s = this.spin, r = COURT.BALL_R;
    const vh = Math.hypot(v.x, v.z);
    const hx = vh > 0.01 ? v.x / vh : 0, hz = vh > 0.01 ? v.z / vh : -1;
    const fall = -v.y;
    // So schnell rutscht die Unterseite des Balls über den Boden: nach vorne und zur Seite (rechts)
    const rutschV = vh - r * s.top * RPM;
    const rutschS = r * s.drall * RPM;
    const rutsch = Math.hypot(rutschV, rutschS);
    if (rutsch > 0.01) {
      // Die Reibung kann höchstens so viel bremsen, wie der Boden hergibt – oder bis der Ball nicht mehr rutscht, sondern rollt
      const j = Math.min(surface.mu * (1 + surface.e) * fall, rutsch / 2.5);
      const jv = j * rutschV / rutsch, js = j * rutschS / rutsch;
      const neuV = vh - jv;                   // Tempo nach vorne (kann beim Stoppball negativ werden = zurück)
      v.x = hx * neuV + -hz * js;
      v.z = hz * neuV + hx * js;
      // Die Reibung dreht den Ball: Nach dem Aufprall hat fast jeder Ball Topspin
      s.top += 1.5 * jv / r / RPM;
      s.drall -= 1.5 * js / r / RPM;
    }
    s.seite *= 0.7;
    v.y = fall * surface.e;
  }
}

// Wie muss der Ball starten, damit er bei "target" landet?
// vh = waagerechtes Tempo beim Start, spin = Drall (Zahl = nur Topspin/Slice, oder { top, seite, drall }).
// Gesucht werden das passende Tempo nach oben und – bei Seitendrall – wie weit man vorhalten muss,
// weil der Ball in der Luft eine Kurve fliegt.
// Rückgabe: { vel, clearance (Abstand über dem Netz), time }
export function solveShot(p0, target, vh, spin) {
  spin = spinVon(spin);
  const dx = target.x - p0.x, dz = target.z - p0.z;
  const D = Math.max(0.5, Math.hypot(dx, dz));
  const ziel = Math.atan2(dx, dz);          // Richtung zum Ziel
  const crosses = (p0.z > 0) !== (target.z > 0);
  const v = { x: 0, y: 0, z: 0 }, a = { x: 0, y: 0, z: 0 };

  // Flug nachrechnen: Start in Richtung "winkel" mit Tempo "vy0" nach oben
  const fly = (winkel, vy0) => {
    let x = p0.x, y = p0.y, z = p0.z, t = 0, yNet = null, xNet = 0;
    v.x = Math.sin(winkel) * vh; v.y = vy0; v.z = Math.cos(winkel) * vh;
    const h = 1 / 120;
    while (t < 8) {
      beschleunigung(v, spin, a);
      v.x += a.x * h; v.y += a.y * h; v.z += a.z * h;
      const oz = z;
      x += v.x * h; y += v.y * h; z += v.z * h; t += h;
      if (crosses && yNet === null && (oz > 0) !== (z > 0)) { yNet = y; xNet = x; }
      if (y <= COURT.BALL_R && v.y < 0) break;
    }
    return { s: Math.hypot(x - p0.x, z - p0.z), winkel: Math.atan2(x - p0.x, z - p0.z), yNet, xNet, t };
  };

  let winkel = ziel, vy = 0, res = null;
  // Ohne Seitendrall fliegt der Ball geradeaus – dann reicht ein Durchgang.
  const runden = Math.abs(spin.seite) > 1 ? 3 : 1;
  for (let k = 0; k < runden; k++) {
    let lo = -25, hi = 30;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      res = fly(winkel, mid);
      if (res.s < D) lo = mid; else hi = mid;
    }
    vy = (lo + hi) / 2;
    res = fly(winkel, vy);
    winkel += ziel - res.winkel;            // um so viel hat die Kurve den Ball abgelenkt: beim nächsten Mal vorhalten
  }
  if (runden > 1) { winkel -= ziel - res.winkel; }
  return {
    vel: { x: Math.sin(winkel) * vh, y: vy, z: Math.cos(winkel) * vh },
    clearance: res.yNet === null ? 99 : res.yNet - netHeightAt(res.xNet),
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

// Für gefühlvolle Schläge (Stoppball, Aufschlag von unten): Hier ist nicht das Tempo vorgegeben,
// sondern wie hoch der Ball über das Netz gehen soll ("bogen", in Metern). Gesucht wird das Tempo, das dazu passt.
export function solveBogen(p0, target, spin, bogen) {
  let lo = 4, hi = 45, sol = null;
  for (let i = 0; i < 12; i++) {
    const vh = (lo + hi) / 2;
    sol = solveShot(p0, target, vh, spin);
    if (sol.clearance > bogen) lo = vh; else hi = vh;      // zu hoch über dem Netz: schneller und flacher spielen
  }
  sol = solveShot(p0, target, lo, spin);
  sol.vh = lo;
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
