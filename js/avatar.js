// Powershot – die 3D-Spielerfigur.
// Die Figur ist ein Skelett aus Gelenken. Die Posen und Schlagbewegungen stehen in posen.js
// (wo sind die Hände, wie sind die Schultern gedreht …). Ellbogen und Knie werden hier ausgerechnet (ik).
// Angaben als [vor, seite, hoch] in Metern aus Sicht der Figur (seite: + = Schlaghand).

import * as THREE from 'three';
import { figureReady, makeFigure, REST, BONES } from './figur.js';
import { requisit } from './requisiten.js';
import { mocapClip, mocapFrame, mocapLoop, mocapGang } from './mocap.js';
import { SHOW, showFuer } from './showschlaege.js';
import { JUBEL, pose as namedPose, mixPose, strokePose, prepPose, strokeName, strokeFamily, strokeStart, strokeEnd } from './posen.js';

// Maße des Skeletts: einmal für die einfache Figur aus Kapseln, einmal für das realistische Modell
const DIM_SIMPLE = { upper: 0.30, fore: 0.28, reach: 0.57, thigh: 0.45, shin: 0.45, shW: 0.2, hipW: 0.1, shUp: 0.55, neckUp: 0.06, headUp: 0.21, ankle: 0 };
const DIM_REAL = { upper: 0.275, fore: 0.347, reach: 0.60, thigh: 0.42, shin: 0.425, shW: 0.192, hipW: 0.09, shUp: 0.48, neckUp: 0.145, headUp: 0.30, ankle: 0.02 };

// --- Knochen-Rahmen: Ursprung + drei Achsen, alles als [vor, seite, hoch] ---
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Rahmen mit y-Achse entlang "along"; "hint" legt fest, wie der Knochen um sich selbst gedreht ist
function frame(o, along, hint) {
  const ey = norm(along);
  const k = hint[0] * ey[0] + hint[1] * ey[1] + hint[2] * ey[2];
  let ex = [hint[0] - k * ey[0], hint[1] - k * ey[1], hint[2] - k * ey[2]];
  if (Math.hypot(ex[0], ex[1], ex[2]) < 1e-4) ex = cross(ey, [0.3, 0.5, 0.8]);
  ex = norm(ex);
  return { o, ex, ey, ez: cross(ex, ey) };
}
// Steht aufrecht und schaut nach vorn; yaw dreht um die Hochachse, nod nickt nach vorn
function upright(o, yaw = 0, nod = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cn = Math.cos(nod), sn = Math.sin(nod);
  const ex = [-sy, cy, 0];
  const ey = [cy * sn, sy * sn, cn];
  return { o, ex, ey, ez: cross(ex, ey) };
}
const ARM_BEND = [-0.4, 0.6, -1], KNEE_BEND = [1, 0.15, 0.2];
const mirror = (p) => [p[0], -p[1], p[2]];

// Alle 13 Knochen-Rahmen aus den Gelenkpunkten (J) berechnen. Dieselbe Funktion gilt für die
// Ruhe-Pose des Modells und für jede Pose im Spiel – so passt beides genau zusammen.
function boneFrames(J) {
  const F = {};
  F.pelvis = upright(J.hip, J.hipYaw || 0);
  F.chest = frame(J.hip, sub(J.neck, J.hip), sub(J.shR, J.shL));
  F.head = upright(J.neck, J.yaw || 0, J.nod || 0);
  if (J.headF) {
    // Kopf-Richtung aus einer Aufnahme: vorn (headF) und oben (headU)
    const ey = norm(J.headU), ex = norm(cross(ey, J.headF));
    F.head = { o: J.neck, ex, ey, ez: cross(ex, ey) };
  }
  for (const [s, m] of [['R', 1], ['L', -1]]) {
    const sh = J['sh' + s], el = J['el' + s], hd = J['hand' + s];
    const n = cross(J['armBend' + s], norm(sub(hd, sh)));
    F['upper' + s] = frame(sh, sub(el, sh), n);
    F['fore' + s] = frame(el, sub(hd, el), n);
    const hip = J['hip' + s], kn = J['knee' + s], ft = J['foot' + s];
    const k = cross(J['kneeBend' + s] || [KNEE_BEND[0], KNEE_BEND[1] * m, KNEE_BEND[2]], norm(sub(ft, hip)));
    F['thigh' + s] = frame(hip, sub(kn, hip), k);
    F['shin' + s] = frame(kn, sub(ft, kn), k);
    F['foot' + s] = upright(ft, J['footYaw' + s] || 0, J['footNod' + s] || 0);
  }
  return F;
}

// Die Ruhe-Pose (T-Pose) des Modells und ihre Umkehr-Matrizen
let restInverses = null;
function getRestInverses() {
  if (restInverses) return restInverses;
  const J = {
    hip: REST.hip, neck: REST.neck,
    shR: REST.sh, shL: mirror(REST.sh), elR: REST.elbow, elL: mirror(REST.elbow), handR: REST.grip, handL: mirror(REST.grip),
    armBendR: [-1, 0, 0], armBendL: [-1, 0, 0],
    hipR: REST.leg, hipL: mirror(REST.leg), kneeR: REST.knee, kneeL: mirror(REST.knee), footR: REST.ankle, footL: mirror(REST.ankle),
  };
  const F = boneFrames(J);
  const G = (p) => new THREE.Vector3(p[1], p[2], -p[0]);
  restInverses = BONES.map((name) => {
    const fr = F[name];
    return new THREE.Matrix4().makeBasis(G(fr.ex), G(fr.ey), G(fr.ez)).setPosition(G(fr.o)).invert();
  });
  return restInverses;
}

const PRE_SWING = 0.22;      // so viele Sekunden vor dem Treffpunkt beginnt der Schwung nach vorn
const HIGH_BALL = 1.25;      // ab dieser Ballhöhe wird eher angegriffen
const LOW_BALL = 0.75;       // darunter wird eher verteidigt
const SERVE_LEAD = 1.4;      // Dauer der Aufschlagbewegung, wenn das Match nichts anderes sagt
const FOOT_REST = 0.46;      // Neigung des Fußes im normalen Stand (Zehen tiefer als der Knöchel)
const FADE = 0.10;           // Überblenden, wenn die Bewegung wechselt
// --- Gehen beim Seitenwechsel: Hier kannst du einstellen, wie locker die Figur geht ---
// (Gibt es in mocap/bewegungen.json eine Aufnahme mit dem Namen 'walk', wird stattdessen die Aufnahme abgespielt.)
const GANG = {
  schritt: 0.66,      // Länge eines Schritts in Metern (größer = längere, langsamere Schritte)
  fussHoch: 0.07,     // so hoch hebt der Fuß beim Schritt ab (Meter) – zu viel sieht nach Marschieren aus
  wippen: 0.02,       // so weit sinkt die Hüfte, wenn beide Füße weit auseinander sind (Meter)
  huefte: 0.16,       // die Hüfte dreht mit dem vorderen Bein mit (Bogenmaß)
  schulter: 0.30,     // die Schultern drehen dagegen – das macht den Gang locker (Bogenmaß; 0.30 sind etwa 17 Grad)
  kippen: 0.022,      // die Schulter über dem Standbein sinkt etwas, die andere hebt sich (Meter)
  nicken: 0.012,      // der Oberkörper pendelt bei jedem Schritt ein wenig vor und zurück (Meter)
  wiegen: 0.03,       // der Körper wiegt sich über das Bein, das gerade steht (Meter)
  armFrei: 0.27,      // so weit schwingt der freie Arm vor und zurück (Meter)
  armSchlaeger: 0.16, // der Schlägerarm schwingt weniger – der Schläger ist ja schwer
  armAbstand: 0.12,   // so weit hängen die Hände seitlich neben der Schulter (Meter) – größer = Arme weiter weg vom Körper
  armBeugen: 0.10,    // vorn beugt sich der Ellbogen, die Hand kommt so viel höher (Meter)
  ferse: 0.5,         // so stark rollt der Fuß ab: hinten geht die Ferse hoch, vorn zeigen die Zehen hoch (Bogenmaß)
};
// --- Joggen auf dem Turniergelände (kommt zum Gehen dazu, je schneller die Figur läuft) ---
const JOGGEN = {
  schritt: 0.66,      // Schrittlänge beim Joggen in Metern …
  schrittTempo: 0.15, // … plus so viel für jeden Meter pro Sekunde Tempo (schneller = längere Schritte, nicht hektischere)
  fussHoch: 0.09,     // so viel höher hebt der Fuß ab als beim Gehen (Meter)
  ferseHoch: 0.34,    // hinten schwingt die Ferse hoch Richtung Po (Meter)
  huepfen: 0.055,     // der Körper hebt bei jedem Schritt etwas ab (Meter)
  vorlage: 0.07,      // der Oberkörper neigt sich leicht nach vorn (Meter)
  armHoch: 0.24,      // die Hände kommen so viel höher – dadurch sind die Ellbogen angewinkelt (Meter)
  armVor: 0.13,       // … und so viel weiter nach vorn (Meter)
  armSchwung: 0.05,   // die Arme schwingen etwas weiter als beim Gehen (Meter)
};
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (s) => { s = clamp(s, 0, 1); return s * s * (3 - 2 * s); };
const mix3 = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Zwei Knochen (Längen l1, l2) von a nach b: Wo ist das Gelenk dazwischen?
function ik(a, b, l1, l2, bend) {
  const d = clamp(dist3(a, b), 0.02, l1 + l2 - 0.002);
  const dir = [(b[0] - a[0]) / d, (b[1] - a[1]) / d, (b[2] - a[2]) / d];
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const dot = bend[0] * dir[0] + bend[1] * dir[1] + bend[2] * dir[2];
  let q = [bend[0] - dot * dir[0], bend[1] - dot * dir[1], bend[2] - dot * dir[2]];
  let ql = Math.hypot(q[0], q[1], q[2]);
  if (ql < 0.001) { q = [0, 0, 1]; ql = 1; }
  return [a[0] + dir[0] * along + q[0] / ql * h, a[1] + dir[1] * along + q[1] / ql * h, a[2] + dir[2] * along + q[2] / ql * h];
}

function limitReach(a, b, max) {
  const d = dist3(a, b);
  return d <= max ? b : mix3(a, b, max / d);
}

const stdMat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });

let stringTex = null;
function stringTexture() {
  if (stringTex) return stringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 1.2;
  for (let i = 4; i < 64; i += 7) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  stringTex = new THREE.CanvasTexture(c);
  return stringTex;
}

export class Avatar {
  // look: { skin, hair, shirt, shorts, head:'none'|'cap'|'band', shoes, racket }
  // real = true: das realistische Modell benutzen (wenn es geladen ist)
  constructor(look, side, hand = 1, real = true) {
    this.real = real && figureReady();
    this.dim = this.real ? DIM_REAL : DIM_SIMPLE;
    this.bh = look.bh === 1 ? 1 : 2;      // Rückhand: 1 = einhändig, 2 = beidhändig
    // Größe und Statur: Das Modell ist 1,83 m groß. gross = 1.08 heißt 8 % größer, breit = 1.06 heißt 6 % kräftiger.
    this.gross = clamp((look.groesse || 183) / 183, 0.9, 1.12);
    this.breit = look.statur === 'schlank' ? 0.95 : look.statur === 'kraeftig' ? 1.06 : 1;
    this.jubel = JUBEL[look.jubel] || JUBEL.faust;     // so freut sich dieser Spieler
    this.side = side;
    this.d = side === 0 ? 1 : -1;
    this.hand = hand;
    this.group = new THREE.Group();
    this.pos = { x: 0, z: side === 0 ? 12 : -12 };
    this.a = {
      run: 0, step: 0, dir: [1, 0], time: Math.random() * 5,
      prep: 0, art: 'fh_ts',            // Ausholen: wie weit (0…1) und für welchen Schlag
      swing: null, t: 0, contactY: 0.95, // laufender Schlag und seine Zeit (0 = Treffpunkt)
      pre: null,                         // Schwung nach vorn, bevor der Ball da ist
      src: '', last: null, from: null, fade: 1,   // Überblenden zwischen Bewegungen
      mood: null, moodK: 0,
      mw: 0, mf: null,                   // aufgezeichnete Bewegung: Gewicht (0…1) und letztes Bild
      mx: 1, mFrom: null,                // Überblenden von einer Aufnahme in die nächste
      rnd: Math.random(), rnd2: Math.random(),   // Zufall für die Wahl der Schlag-Variante (je Ball neu)
    };
    this.build(look);
    this.update(0, { x: this.pos.x, z: this.pos.z, vx: 0, vz: 0, prep: 0, stroke: 'fh' });
  }

  build(look) {
    const M = this.m = {};
    if (this.real) {
      const fig = makeFigure(look, this.hand, getRestInverses());
      this.bones = fig.bones;
      this.group.add(fig.mesh, ...fig.bones);
      this.buildRacket(look);
      return;
    }
    const skin = stdMat(look.skin, 0.7), shirt = stdMat(look.shirt), shorts = stdMat(look.shorts);
    const shoe = stdMat(look.shoes ?? 0xffffff, 0.6);
    const add = (name, geo, mat) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.group.add(mesh);
      M[name] = mesh;
      return mesh;
    };
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

    add('torso', cap(0.155, 0.30), shirt).scale.set(1.22, 1, 0.78);
    add('hips', new THREE.SphereGeometry(0.17, 12, 10), shorts).scale.set(1.15, 0.8, 0.85);
    add('neck', cap(0.05, 0.08), skin);
    for (const s of ['L', 'R']) {
      add('upper' + s, cap(0.046, 0.30), skin);
      add('sleeve' + s, cap(0.062, 0.12), shirt);
      add('fore' + s, cap(0.04, 0.28), skin);
      add('hand' + s, new THREE.SphereGeometry(0.05, 8, 8), skin);
      add('thigh' + s, cap(0.075, 0.45), skin);
      add('short' + s, cap(0.092, 0.2), shorts);
      add('shin' + s, cap(0.055, 0.45), skin);
      add('sock' + s, cap(0.058, 0.08), stdMat(0xffffff));
      add('shoe' + s, new THREE.BoxGeometry(0.11, 0.09, 0.29), shoe);
    }

    // Kopf mit Haaren, Kappe oder Stirnband und Augen
    const head = M.head = new THREE.Group();
    this.group.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), skin);
    skull.scale.set(0.92, 1.05, 1); skull.castShadow = true;
    head.add(skull);
    const hairMat = stdMat(look.hair, 0.95);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
    hair.rotation.x = -0.35; hair.scale.set(0.95, 1.05, 1.02);
    head.add(hair);
    const eyeMat = stdMat(0x1a1a1a, 0.4);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeMat);
      eye.position.set(sx * 0.042, 0.015, 0.105);
      head.add(eye);
    }
    if (look.head === 'cap') {
      const capMat = stdMat(0xffffff, 0.7);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.127, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), capMat);
      crown.rotation.x = -0.12; crown.scale.set(0.96, 1.02, 1.03);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.11), capMat);
      visor.position.set(0, 0.045, 0.15); visor.rotation.x = 0.15;
      head.add(crown, visor);
    } else if (look.head === 'band') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.016, 6, 20), stdMat(look.shirt));
      band.rotation.x = Math.PI / 2 - 0.15; band.position.y = 0.05;
      head.add(band);
    }

    // Einfache Figur: alle Teile mit der Körpergröße mitwachsen lassen
    for (const k in M) M[k].scale.multiplyScalar(this.gross);
    this.buildRacket(look);
  }

  // Schläger: Griff, Hals, Rahmen und Saiten. Der Griff zeigt in +Y, die Fläche schaut nach +Z.
  buildRacket(look) {
    const M = this.m;
    const rk = M.racket = new THREE.Group();
    this.group.add(rk);
    const saiten = new THREE.MeshBasicMaterial({ map: stringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    // Das fertige Schläger-Modell (assets/schlaeger.glb): Der Lack bekommt die Farbe des Schlägers aus dem Shop,
    // das Griffband bleibt weiß. Das Modell ist 1 Einheit lang und liegt mit der Fläche quer – deshalb drehen und strecken.
    const modell = requisit('schlaeger', { farbe: look.racket ?? 0x202020, abY: -0.24, hell: [0.35, 0.95], rau: 0.4 });
    if (modell) {
      modell.rotation.y = Math.PI / 2;
      modell.scale.set(0.42, 0.69, 0.59);          // dünner, 69 cm lang, Kopf etwas schmaler
      modell.position.y = 0.325;                   // das Griffende liegt in der Hand
      const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 22), saiten);
      strings.scale.set(0.98, 1.4, 1); strings.position.y = 0.487;
      rk.add(modell, strings);
      rk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return;
    }
    // Ersatz, falls das Modell nicht geladen werden konnte: Ring, Scheibe und Stäbchen
    const frameMat = stdMat(look.racket ?? 0x202020, 0.4);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.2, 8), stdMat(0xf2f2f2, 0.9));
    grip.position.y = 0.08;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 6, 26), frameMat);
    frame.scale.set(1, 1.28, 1); frame.position.y = 0.5;
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 22), saiten);
    strings.scale.set(1, 1.28, 1); strings.position.y = 0.5;
    rk.add(grip, frame, strings);
    for (const sx of [-1, 1]) {
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.19, 6), frameMat);
      throat.position.set(sx * 0.035, 0.265, 0); throat.rotation.z = -sx * 0.36;
      rk.add(throat);
    }
    rk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // Schlagbewegung starten (im Moment des Treffens): kind = 'fh' | 'bh' | 'sv', type = Art des Schlags
  swing(kind, contactY = 0.95, type = 'drive') {
    const a = this.a;
    // Passt der Schwung, der schon läuft, zur Schlagart? Dann bleibt es bei dieser Variante.
    const base = strokeName(kind, type);
    const name = a.pre !== null && strokeFamily(a.art) === base ? a.art : this.pickStroke(kind, type, contactY, this.sit || {});
    a.rnd = Math.random(); a.rnd2 = Math.random();
    // Lief der Schwung schon (pre), geht er nahtlos weiter – sonst holt er das letzte Stück schnell auf
    a.t = a.pre !== null && a.art === name ? Math.max(a.pre, -0.3) : -0.05;
    a.swing = name;
    a.contactY = contactY;
    a.pre = null;
    a.mood = null;
  }

  // Welche Bewegung passt zur Spielsituation?
  //   Vorhand:  Topspin (Standard) · Angriffsschlag bei hohen Bällen oder wenn der Spieler im Feld steht
  //   Rückhand: beidhändig (Standard) · Angriffsschlag bei hohen/kurzen Bällen · Abwehrschlag aus den Knien bei tiefen Bällen
  //             oder in Bedrängnis. Einhändige Spieler schlagen immer die einhändige Rückhand.
  //   Dazu etwas Zufall, damit nicht jeder Schlag gleich aussieht. Slice, Volley und Schmetterball ergeben sich aus dem Schlag.
  pickStroke(kind, type, y, sit) {
    const a = this.a, name = strokeName(kind, type);
    // Show-Schlag (siehe showschlaege.js)? Nur wenn es dafür eine eigene Aufnahme gibt – sonst bleibt alles wie immer.
    a.show = this.real ? showFuer(name, { ...sit, y, volley: type === 'volley' }, (clip) => !!mocapClip(clip)) : null;
    a.showBasis = name;
    if (a.show) return name;
    const attack = y > HIGH_BALL || sit.inside, defend = y < LOW_BALL || sit.defend;
    if (name === 'fh_ts') {
      if (this.clipFor('fh_at') && a.rnd < (attack && !defend ? 0.75 : 0.12)) return 'fh_at';
    } else if (name === 'bh_ts' && this.bh === 2) {
      if (this.clipFor('bh_df') && defend && a.rnd < 0.8) return 'bh_df';
      if (this.clipFor('bh_at') && a.rnd2 < (attack && !defend ? 0.75 : 0.1)) return 'bh_at';
      if (this.clipFor('bh_df') && a.rnd < 0.1) return 'bh_df';
    }
    return name;
  }

  // Gibt es für diese Bewegung eine Aufnahme? Einhändige Spieler bekommen für jede Rückhand die einhändige Aufnahme.
  clipFor(name) {
    if (!this.real) return null;
    // Läuft gerade ein Show-Schlag, ersetzt seine Aufnahme die normale Bewegung
    if (this.a.show && name === this.a.showBasis) return mocapClip(SHOW[this.a.show].clip);
    if (this.bh === 1 && strokeFamily(name) === 'bh_ts') return mocapClip('bh_sl');
    return mocapClip(name);
  }

  // Welche Pose gilt gerade? Gibt auch zurück, aus welcher Bewegung sie stammt (für das Überblenden).
  currentPose(dt, st) {
    const a = this.a;
    let p, src;
    if (a.swing) {
      a.t += dt * (a.t < -0.02 ? 3 : 1);      // war der Schwung zu spät dran, holt er schnell auf
      p = strokePose(a.swing, a.t, a.contactY);
      src = 'schlag';
      const clip = this.clipFor(a.swing);
      if (a.t >= (clip ? clip.tEnd : strokeEnd(a.swing))) { a.swing = null; a.prep = 0; a.pre = null; }
    } else if (st.serveK !== undefined && st.serveK !== null) {
      // Aufschlag: der Ballwurf (0…1) steuert die Bewegung, kurz vor dem Treffen beginnt der Schlag
      const k = st.serveK;
      a.art = 'sv';
      const clip = this.clipFor('sv');
      if (clip) {
        // Aufgezeichneter Aufschlag: der Ballwurf spult die Aufnahme bis zum Treffpunkt vor
        const T = Math.min(-clip.t0, st.serveT || SERVE_LEAD);
        a.pre = -T + k * T;
        p = k > 0.9 ? strokePose('sv', Math.max(a.pre, strokeStart('sv'))) : prepPose('sv', k);
      } else if (k > 0.9) { a.pre = strokeStart('sv') + (k - 0.9) / 0.1 * (-0.03 - strokeStart('sv')); p = strokePose('sv', a.pre); }
      else { a.pre = null; p = prepPose('sv', k); }
      src = 'schlag';
    } else {
      // Ausholen. Wenn bekannt ist, wann der Ball da ist (tHit), richtet sich alles danach.
      if (st.stroke && st.stroke !== 'sv') {
        const type = st.planY > 2.0 ? 'smash' : st.volley ? 'volley' : (st.hint || 'drive');
        // (nicht mehr wechseln, wenn der Schwung schon läuft – sonst springt die Figur)
        this.sit = { inside: st.inside, defend: st.defend, weg: st.weg };
        if (a.pre === null) a.art = this.pickStroke(st.stroke, type, st.planY ?? 0.95, this.sit);
      } else if (a.art === 'sv') a.art = 'fh_ts';
      const known = st.tHit !== undefined && st.tHit !== null;
      // Aufgezeichnete Schläge holen länger aus – sie beginnen entsprechend früher
      const clip = this.clipFor(a.art);
      const lead = clip ? Math.min(-clip.t0, 1.0) : PRE_SWING;
      const want = known ? clamp(1 - (st.tHit - PRE_SWING) / 0.55, 0, 1) : (st.prep || 0);
      a.prep += (want - a.prep) * Math.min(1, dt * 14);
      if (known && st.tHit < lead && (clip || a.prep > 0.6)) {
        a.pre = Math.min(-0.02, Math.max(a.pre ?? -lead, -st.tHit, -lead));
        // (die berechnete Pose darunter holt weiter aus, bis ihr eigener Schwung beginnt)
        p = a.pre < strokeStart(a.art) ? prepPose(a.art, a.prep, st.planY ?? 0.95) : strokePose(a.art, a.pre, st.planY ?? 0.95);
      } else {
        a.pre = null;
        p = prepPose(a.art, a.prep, st.planY ?? 0.95);
      }
      src = a.art;
    }
    // Überblenden, wenn die Bewegung gewechselt hat (z. B. vom Topspin-Ausholen zum Slice)
    if (src !== a.src) { a.from = a.last; a.fade = a.from ? 0 : 1; a.src = src; }
    if (a.fade < 1) {
      a.fade = Math.min(1, a.fade + dt / FADE);
      p = mixPose(a.from, p, smooth(a.fade));
    }
    a.last = p;
    if (a.moodK > 0.001 && a.mood) {
      let mp = namedPose(a.mood);
      if (a.mood === 'cheer') {
        // Jeder Spieler jubelt auf seine Art (siehe JUBEL in posen.js)
        const j = this.jubel, t = a.moodT || 0;
        mp = namedPose(j.pose);
        let dz = 0, dv = 0;
        if (j.pumpen) dz = Math.sin(Math.min(t, 0.9) * 14) * 0.07;           // die Faust geht zweimal kurz hoch und runter
        if (j.auflegen) { const s = smooth((t - 1.0) / 0.22); dz = -0.62 * s; dv = 0.22 * s; }   // „Hörer auflegen“
        if (dz || dv) mp = { ...mp, l: [mp.l[0] + dv, mp.l[1], mp.l[2] + dz] };
      }
      p = mixPose(p, mp, smooth(a.moodK));
    }
    // Ball prellen vor dem Aufschlag: vorbeugen, die freie Hand geht mit dem Ball ein Stück auf und ab
    a.pk = clamp((a.pk || 0) + (st.prellK != null ? dt : -dt) / 0.22, 0, 1);
    if (a.pk > 0.001) {
      const pp = namedPose('sv_prell'), up = (st.prellK ?? a.prellLast ?? 1) * 0.14;
      a.prellLast = st.prellK ?? a.prellLast;
      p = mixPose(p, { ...pp, l: [pp.l[0], pp.l[1], pp.l[2] - 0.14 + up] }, smooth(a.pk));
    }
    return p;
  }

  // st: { x, z, vx, vz, prep, stroke, tHit, planY, volley, hint, serveK, mood, ball:{x,z} }
  update(dt, st) {
    const a = this.a, d = this.d, hand = this.hand;
    a.time += dt;
    this.pos.x = st.x; this.pos.z = st.z;

    // Laufen
    // Schrittlänge und Takt passen zum Tempo: Der Fuß, der am Boden ist, bleibt dort stehen, während der Körper
    // darüber hinweggeht. Gehen = kurze Schritte, Sprint = lange Schritte.
    const sp = Math.hypot(st.vx || 0, st.vz || 0);
    const moving = sp > 0.3;
    a.walkK = clamp((a.walkK || 0) + (st.walk ? dt : -dt) / 0.35, 0, 1);
    const walkK = smooth(a.walkK);
    // Gibt es eine Aufnahme vom Gehen? Dann bestimmt sie auch die Schrittlänge (weg = Meter für zwei Schritte).
    const gang = this.real && walkK > 0 ? mocapClip('walk') : null;
    // Joggen (auf dem Turniergelände): lockeres Laufen ohne Schläger. jog = 0 (gehen) … 1 (joggen). Die Schritte werden länger,
    // die Füße heben höher ab, die Arme sind angewinkelt und schwingen mit.
    a.jogK = (a.jogK || 0) + ((st.jog || 0) - (a.jogK || 0)) * Math.min(1, dt * 5);
    const jog = a.jogK;
    const stepRun = 0.5 + 0.18 * sp, stepWalk = (gang && gang.weg > 0.6 ? gang.weg / 2 : GANG.schritt) + jog * Math.max(0, JOGGEN.schritt + JOGGEN.schrittTempo * sp - GANG.schritt);
    const stepLen = stepRun + (stepWalk - stepRun) * walkK;
    // Beim Gehen dreht sich der ganze Körper in Laufrichtung (sonst schaut die Figur immer zum Netz).
    // An der Bank angekommen, dreht sie sich zum Platz um.
    if (st.walk && moving) a.walked = true; else if (!st.walk) a.walked = false;
    // (st.face: Bei der Siegerehrung und auf der Turnieranlage sagt das Spiel selbst, wohin die Figur schaut –
    //  im Stehen, und mit st.faceFest auch im Laufen.)
    const faceTo = st.face != null && (!moving || st.faceFest) ? st.face : !st.walk ? 0 : moving ? Math.atan2(st.vx * d, -st.vz * d) : a.walked ? Math.atan2(-Math.sign(st.x || -1) * d, 0.5) : (a.face || 0);
    let turn = faceTo - (a.face || 0);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    a.face = (a.face || 0) + turn * Math.min(1, dt * 6);
    const cf = Math.cos(a.face), sf = Math.sin(a.face);
    if (moving) {
      // Laufrichtung aus Sicht der Figur: [vor, seite]
      const wx = st.vx * d / sp, wz = -st.vz * d / sp;                 // Welt: rechts / vor (ohne Körperdrehung)
      a.dir = [wz * cf + wx * sf, (wx * cf - wz * sf) * hand];
      a.step += Math.PI * sp / stepLen * dt;
    }
    a.amp = (a.amp || 0) + ((moving ? stepLen / 2 : 0) - (a.amp || 0)) * Math.min(1, dt * 10);
    a.run += (clamp(sp / 3.2, 0, 1) - a.run) * Math.min(1, dt * 10);
    a.legK = (a.legK || 0) + (smooth((sp - 0.6) / 1.4) - (a.legK || 0)) * Math.min(1, dt * 8);

    // Stimmung nach dem Punkt. Der Jubel dauert nur einen Moment: Faust ballen, zweimal kurz pumpen, weiter.
    a.mood = st.mood || a.mood;
    a.moodT = st.mood ? (a.moodT || 0) + dt : 0;
    const moodOn = st.mood && !(st.mood === 'cheer' && a.moodT > this.jubel.dauer);
    a.moodK += ((moodOn ? 1 : 0) - a.moodK) * Math.min(1, dt * (moodOn ? 9 : 5));
    if (!st.mood && a.moodK < 0.01) a.mood = null;

    let pose = this.currentPose(dt, st);
    // --- Gehen (Seitenwechsel) ---
    // gehK = wie stark gerade gegangen wird (0…1), stehK = die Figur steht locker an der Bank (0…1)
    const sinS = Math.sin(a.step), cosS = Math.cos(a.step);
    const gehK = walkK * Math.min(1, a.amp * 3), stehK = walkK - gehK;
    const armS = Math.sin(a.step - 0.35);                 // die Arme schwingen einen Moment später als die Beine
    if (walkK > 0.001) {
      // aufrecht, der Schläger hängt locker nach vorn unten und pendelt ein wenig mit
      const wp = namedPose('walk');
      pose = mixPose(pose, { ...wp, d: [wp.d[0] - 0.08 * armS * gehK, wp.d[1], wp.d[2]] }, walkK);
    }
    const run = a.run, still = 1 - run;
    const bob = Math.sin(a.time * 4) * 0.012 * still;
    // Beim Rennen hebt der Körper ab, wenn die Beine auseinander sind. Beim Gehen ist es umgekehrt:
    // Die Hüfte ist am höchsten, wenn ein Bein gerade unter dem Körper steht.
    const hipH = 0.90 - pose.cr + pose.jp + bob + run * Math.abs(sinS) * 0.035 * (1 - walkK) - gehK * GANG.wippen * (1 - Math.cos(2 * a.step)) * (1 - jog) + gehK * jog * JOGGEN.huepfen * Math.abs(sinS);
    const dm = this.dim;
    const shH = hipH + dm.shUp;
    const lean = (0.05 + 0.07 * run) * (1 - 0.7 * walkK) + pose.ln + GANG.nicken * Math.cos(2 * a.step) * gehK + JOGGEN.vorlage * jog * gehK;
    // Der Körper wiegt sich über das Standbein; im Stehen verlagert er ab und zu gemütlich das Gewicht
    const wiegen = -cosS * GANG.wiegen * gehK + Math.sin(a.time * 0.8) * 0.03 * stehK;

    // Schultern und Hüfte drehen sich mit dem Schlag (die Hüfte etwa halb so weit).
    // Beim Gehen dreht die Hüfte mit dem vorderen Bein, die Schultern drehen dagegen.
    const twist = pose.tw - GANG.schulter * sinS * gehK + Math.sin(a.time * 0.5) * 0.06 * stehK;
    const hipTw = pose.tw * 0.45 + GANG.huefte * sinS * gehK;
    // Die Schultern wiegen sich noch etwas weiter als die Hüfte, der Kopf bleibt ruhiger.
    // Die Schulter über dem Standbein sinkt, die Hüfte dort hebt sich – so "schlendert" die Figur.
    const obenSeite = wiegen * 1.3, kippen = cosS * GANG.kippen * gehK;
    let shR = [lean + dm.shW * Math.sin(twist), obenSeite + dm.shW * Math.cos(twist), shH + kippen];
    let shL = [lean - dm.shW * Math.sin(twist), obenSeite - dm.shW * Math.cos(twist), shH - kippen];
    let neck = [lean, obenSeite, shH + dm.neckUp];
    let headP = [lean + 0.03, wiegen * 0.8, shH + dm.headUp - (a.mood === 'sad' ? 0.03 * a.moodK : 0)];
    let hipMid = [0, wiegen, hipH];
    let hipR = [dm.hipW * Math.sin(hipTw), wiegen + dm.hipW * Math.cos(hipTw), hipH - kippen * 0.5];
    let hipL = [-dm.hipW * Math.sin(hipTw), wiegen - dm.hipW * Math.cos(hipTw), hipH + kippen * 0.5];

    // Füße: Schrittstellung beim Schlag (st), Schritte beim Laufen, Abheben beim Sprung
    const stance = (0.17 + 0.25 * Math.max(0, pose.cr)) * (1 - 0.45 * walkK);
    const stepR = -pose.st * 0.14 * still, stepL = pose.st * 0.20 * still, air = pose.jp * 0.85;
    // Beim Gehen bleibt der Fuß am Boden wirklich stehen (gerade Linie statt Welle), sonst rutscht er.
    const schwung = sinS + (2 / Math.PI * Math.asin(sinS) - sinS) * 0.8 * walkK;      // −1 = Fuß hinten … +1 = Fuß vorn
    const swingLeg = schwung * a.amp;
    const liftH = 0.07 + 0.17 * run;
    const lift = cosS * (liftH + (GANG.fussHoch + JOGGEN.fussHoch * jog - liftH) * walkK) * Math.min(1, a.amp * 4);
    // Abrollen: Ist der Fuß hinten, geht die Ferse hoch; ist er vorn, zeigen die Zehen nach oben.
    const hintenR = Math.max(0, -schwung) ** 2 * gehK, hintenL = Math.max(0, schwung) ** 2 * gehK;
    let footR = [stepR + a.dir[0] * swingLeg, stance + a.dir[1] * swingLeg, 0.07 + dm.ankle + air + Math.max(0, lift) + (0.05 + JOGGEN.ferseHoch * jog) * hintenR];
    let footL = [stepL - a.dir[0] * swingLeg, -stance - a.dir[1] * swingLeg, 0.07 + dm.ankle + air + Math.max(0, -lift) + (0.05 + JOGGEN.ferseHoch * jog) * hintenL];
    let kneeR = ik(hipR, footR, dm.thigh, dm.shin, [1, 0.15, 0.2]);
    let kneeL = ik(hipL, footL, dm.thigh, dm.shin, [1, -0.15, 0.2]);

    let handR = limitReach(shR, pose.r, dm.reach);
    let handL = limitReach(shL, pose.l, dm.reach);
    if (walkK > 0.001) {
      // Gehen: Die Arme hängen an den Schultern und pendeln wie ein Pendel – der freie Arm vor, wenn das andere Bein vor geht.
      // Vorn beugt sich der Ellbogen etwas (die Hand kommt höher).
      const vorL = armS * gehK, vorR = -armS * gehK;
      // Die Hände hängen ein Stück neben dem Körper; vorn schwingen sie leicht nach innen, hinten nach außen.
      const ab = GANG.armAbstand;
      // Ohne Schläger (auf dem Turniergelände) schwingen beide Arme gleich. Beim Joggen sind die Ellbogen angewinkelt: Die Hände kommen höher und weiter nach vorn.
      const frei = st.ohneSchlaeger, weitR = frei ? GANG.armFrei : GANG.armSchlaeger, hoch = JOGGEN.armHoch * jog, vor = JOGGEN.armVor * jog;
      const gehL = add3(shL, [0.04 + vor + (GANG.armFrei + JOGGEN.armSchwung * jog) * vorL, -(ab - 0.04 * vorL), -0.535 + hoch + GANG.armBeugen * Math.max(0, vorL)]);
      const gehR = add3(shR, [(frei ? 0.04 : 0.06) + vor + (weitR + JOGGEN.armSchwung * jog) * vorR, ab - (frei ? 0.04 : 0.03) * vorR, (frei ? -0.535 : -0.51) + hoch + GANG.armBeugen * (frei ? 1 : 0.5) * Math.max(0, vorR)]);
      handL = mix3(handL, limitReach(shL, gehL, dm.reach), walkK);
      handR = mix3(handR, limitReach(shR, gehR, dm.reach), walkK);
    }
    // (beim Gehen zeigen die Ellbogen nach hinten statt nach außen – sonst sieht es nach Muskelprotz aus)
    const beuge = mix3(ARM_BEND, [-1, 0.3, -0.3], walkK);
    let elR = ik(shR, handR, dm.upper, dm.fore, beuge);
    let elL = ik(shL, handL, dm.upper, dm.fore, mirror(beuge));

    // --- Aufgezeichnete Bewegung: Gibt es für diesen Schlag eine Aufnahme, ersetzen ihre Gelenke die berechneten ---
    const mName = a.swing || (a.pre !== null ? a.art : null), mT = a.swing ? a.t : a.pre;
    const clip = mName ? this.clipFor(mName) : null;
    const mOn = clip && mT >= clip.t0 && mT <= clip.tEnd - 0.3;
    if (mOn) {
      let m = mocapFrame(clip, mT);
      if (clip.ik) {
        // Gespiegelte Aufnahme: Die Schlaghand folgt dem Griff, der Ellbogen wird neu berechnet; die andere Hand bleibt frei
        m.handR = limitReach(m.shR, m.handR, dm.reach);
        m.elR = ik(m.shR, m.handR, dm.upper, dm.fore, ARM_BEND);
        m.handL = add3(m.shL, [0.22, -0.12, -0.32]);
        m.elL = ik(m.shL, m.handL, dm.upper, dm.fore, mirror(ARM_BEND));
      }
      // Wechselt die Aufnahme mitten in der Bewegung (z. B. Topspin ausgeholt, dann doch Slice), wird weich übergeblendet
      if (a.mClip && a.mClip !== clip && a.mw > 0.05 && a.mf) { a.mFrom = a.mf; a.mx = 0; }
      a.mClip = clip; a.mName = mName; a.mT = mT;
      // Die Aufnahme trifft den Ball immer auf derselben Höhe – die Hand geht rund um den Treffpunkt zur echten Ballhöhe
      if (mName !== 'sv' && mName !== 'sm') {
        const ballY = a.swing ? a.contactY : (st.planY ?? clip.hitY);
        const dy = clamp(ballY - clip.hitY, -0.45, 0.45) * Math.exp(-((mT / 0.22) ** 2));
        if (Math.abs(dy) > 0.01) {
          const bend = sub(m.elR, m.shR);
          m.handR = limitReach(m.shR, [m.handR[0], m.handR[1], m.handR[2] + dy], dm.reach);
          m.elR = ik(m.shR, m.handR, dm.upper, dm.fore, bend);
          if (clip.two) { const bl = sub(m.elL, m.shL); m.handL = limitReach(m.shL, [m.handL[0], m.handL[1], m.handL[2] + dy], dm.reach); m.elL = ik(m.shL, m.handL, dm.upper, dm.fore, bl); }
        }
      }
      if (a.mx < 1 && a.mFrom) {
        a.mx = Math.min(1, a.mx + dt / 0.16);
        const u = smooth(a.mx), from = a.mFrom, out = {};
        for (const k in m) out[k] = from[k] ? mix3(from[k], m[k], u) : m[k];
        m = out;
      }
      a.mf = m;
    }
    a.mw = clamp(a.mw + (mOn ? dt / 0.14 : -dt / 0.3), 0, 1);
    const mw = a.mf ? smooth(a.mw) * (1 - smooth(a.moodK)) * (1 - smooth(a.pk || 0)) : 0;
    // Warten auf den Ball: aufgezeichnete Bereitschaftsstellung als Schleife, solange die Figur steht und nicht ausholt
    const idle = this.real ? mocapClip('ready') : null;
    const idleOn = idle && !a.swing && a.pre === null && (st.serveK === undefined || st.serveK === null);
    a.iw = clamp((a.iw || 0) + (idleOn ? dt : -dt) / 0.25, 0, 1);
    const iw = idle ? smooth(a.iw) * still * (1 - smooth(a.prep)) * (1 - smooth(a.moodK)) * (1 - walkK) : 0;
    if (iw > 0.001) a.idf = mocapLoop(idle, a.time);
    let footYawR = 0, footYawL = 0, headF = null, headU = null;
    let footNodR = GANG.ferse * (hintenR - 0.55 * Math.max(0, schwung) ** 2 * gehK);
    let footNodL = GANG.ferse * (hintenL - 0.55 * Math.max(0, -schwung) ** 2 * gehK);
    const look = st.ball ? clamp(Math.atan2((st.ball.x - this.pos.x) * d, Math.abs(st.ball.z - this.pos.z) + 2), -0.7, 0.7) * hand : 0;
    const layers = [];
    if (iw > 0.001 && a.idf) layers.push([a.idf, iw, false]);
    if (mw > 0.001) layers.push([a.mf, mw, true]);
    // Aufnahme vom Gehen (falls vorhanden): ersetzt den gebauten Gang, Beine inklusive. Der Schläger bleibt, wie er ist.
    if (gang && gehK > 0.001) layers.push([mocapGang(gang, a.step), gehK, false, true]);
    for (const [m, w, head, gehen] of layers) {
      // Läuft der Spieler, kommen die Beine weiter aus der Laufbewegung – nur Oberkörper, Arme und Schläger folgen der Aufnahme.
      // (Sonst würde die Figur mit den Beinen der Aufnahme über den Platz rutschen.) Die Geh-Aufnahme bringt ihre Beine selbst mit.
      const wl = gehen ? w : w * (1 - a.legK);
      const hipNew = mix3(hipMid, m.hip, wl);
      const up = (q) => [hipNew[0] + q[0] - m.hip[0], hipNew[1] + q[1] - m.hip[1], hipNew[2] + q[2] - m.hip[2]];
      const L = (p, q) => mix3(p, up(q), w), B = (p, q) => mix3(p, q, wl), K = (x, y) => x + (y - x) * wl;
      hipMid = hipNew; neck = L(neck, m.neck); headP = L(headP, [m.head[0], m.head[1], m.head[2] + 0.08]);
      shR = L(shR, m.shR); shL = L(shL, m.shL); elR = L(elR, m.elR); elL = L(elL, m.elL); handR = L(handR, m.handR); handL = L(handL, m.handL);
      hipR = B(hipR, m.hipR); hipL = B(hipL, m.hipL); kneeR = B(kneeR, m.kneeR); kneeL = B(kneeL, m.kneeL); footR = B(footR, m.footR); footL = B(footL, m.footL);
      footYawR = K(footYawR, Math.atan2(m.toeR[1] - m.footR[1], m.toeR[0] - m.footR[0]));
      footYawL = K(footYawL, Math.atan2(m.toeL[1] - m.footL[1], m.toeL[0] - m.footL[0]));
      // Fuß auf den Zehenspitzen oder flach? Kopf: schaut dem Ball nach wie in der Aufnahme
      const nod = (f, t) => Math.atan2(f[2] - t[2], Math.hypot(t[0] - f[0], t[1] - f[1])) - FOOT_REST;
      footNodR = K(footNodR, nod(m.footR, m.toeR)); footNodL = K(footNodL, nod(m.footL, m.toeL));
      // (beim Warten schaut der Kopf weiter zum Ball, beim Schlag wie in der Aufnahme)
      if (head) { headF = mix3(headF || [Math.cos(look), Math.sin(look), 0], m.hf, w); headU = mix3(headU || [0, 0, 1], m.hu, w); }
      // Beidhändige Spieler, für die es nur eine einhändige Aufnahme gibt: die zweite Hand bleibt bis kurz nach dem Treffen am Griff
      if (false) {
        const g = 1 - smooth((a.mT - 0.10) / 0.22);
        if (g > 0) {
          const grip = limitReach(shL, add3(handR, m.d, 0.11), dm.reach);
          handL = mix3(handL, grip, g * mw);
          elL = ik(shL, handL, dm.upper, dm.fore, sub(elL, shL));
        }
      }
    }
    // Die Ebene, in der sich Arm und Bein beugen, ergibt sich aus Ellbogen und Knie
    const armBendR = add3(sub(elR, shR), ARM_BEND, 0.02), armBendL = add3(sub(elL, shL), mirror(ARM_BEND), 0.02);
    const kneeBendR = add3(sub(kneeR, hipR), KNEE_BEND, 0.02), kneeBendL = add3(sub(kneeL, hipL), KNEE_BEND, 0.02);
    const hipYaw = layers.length ? Math.atan2(hipR[0] - hipL[0], hipR[1] - hipL[1]) * -1 : -hipTw;

    // --- In die Welt umrechnen und die Körperteile hinsetzen ---
    const px = this.pos.x, pz = this.pos.z;
    // (G = Körpergröße: Alle Punkte der Figur rücken von den Füßen aus gesehen um diesen Faktor weiter weg)
    const G = this.gross, GB = G * this.breit;
    const W = (p) => { const s = p[1] * hand; return new THREE.Vector3(px + G * d * (p[0] * sf + s * cf), G * p[2], pz + G * d * (s * sf - p[0] * cf)); };
    const D = (p) => { const s = p[1] * hand; return new THREE.Vector3(d * (p[0] * sf + s * cf), p[2], d * (s * sf - p[0] * cf)); };
    const M = this.m;
    let yaw = 0;
    if (st.ball) yaw = clamp(Math.atan2((st.ball.x - px) * d, Math.abs(st.ball.z - pz) + 2), -0.7, 0.7);
    // Beim Seitenwechsel schaut niemand dem Ball nach: Der Kopf schaut geradeaus und sieht sich gemütlich etwas um.
    yaw = yaw * (1 - walkK) + Math.sin(a.time * 0.6 + a.rnd * 6) * 0.22 * walkK;
    if (this.real) {
      // Realistisches Modell: nur die Knochen einstellen, die Oberfläche folgt von allein
      const F = boneFrames({
        hip: hipMid, neck, shR, shL, elR, elL, handR, handL, armBendR, armBendL, hipR, hipL, kneeR, kneeL, footR, footL,
        kneeBendR, kneeBendL, footYawR, footYawL, footNodR, footNodL, headF, headU,
        hipYaw, yaw: yaw * hand, nod: a.mood === 'sad' ? 0.35 * a.moodK : 0,
      });
      for (let i = 0; i < BONES.length; i++) {
        const fr = F[BONES[i]], b = this.bones[i];
        // Jeder Knochen wird so lang wie die Körpergröße verlangt – und je nach Statur etwas dicker oder dünner (Kopf und Füße nicht)
        const dick = i === 2 || i > 10 ? G : GB;
        b.matrix.makeBasis(D(fr.ex).multiplyScalar(dick), D(fr.ey).multiplyScalar(G), D(fr.ez).multiplyScalar(dick)).setPosition(W(fr.o));
        b.matrixWorldNeedsUpdate = true;
      }
      this.handLWorld = W(handL);
    } else {
    const limb = (mesh, a3, b3, t0 = 0, t1 = 1) => {
      const A = W(a3), B = W(b3);
      const P = A.clone().lerp(B, t0), Q = A.clone().lerp(B, t1);
      mesh.position.copy(P).lerp(Q, 0.5);
      mesh.quaternion.setFromUnitVectors(UP, Q.sub(P).normalize());
    };

    limb(M.upperR, shR, elR); limb(M.sleeveR, shR, elR, 0, 0.5); limb(M.foreR, elR, handR);
    limb(M.upperL, shL, elL); limb(M.sleeveL, shL, elL, 0, 0.5); limb(M.foreL, elL, handL);
    M.handR.position.copy(W(handR)); M.handL.position.copy(W(handL));
    limb(M.thighR, hipR, kneeR); limb(M.shortR, hipR, kneeR, 0, 0.5); limb(M.shinR, kneeR, footR); limb(M.sockR, kneeR, footR, 0.78, 0.98);
    limb(M.thighL, hipL, kneeL); limb(M.shortL, hipL, kneeL, 0, 0.5); limb(M.shinL, kneeL, footL); limb(M.sockL, kneeL, footL, 0.78, 0.98);
    limb(M.neck, neck, headP, 0, 0.6);

    const facing = this.side === 0 ? Math.PI : 0;
    for (const [mesh, f] of [[M.shoeR, footR], [M.shoeL, footL]]) {
      mesh.position.copy(W([f[0] + 0.07, f[1], f[2] - 0.025]));
      mesh.rotation.set(0, facing, 0);
    }

    // Oberkörper: zwischen Hüfte und Hals, gedreht wie die Schultern
    const A = W(hipMid), B = W(neck);
    const yAxis = B.clone().sub(A).normalize();
    let xAxis = W(shR).sub(W(shL)).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    M.torso.position.copy(A).lerp(B, 0.55);
    M.torso.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    M.hips.position.copy(W([0, 0, hipH - 0.02]));
    M.hips.rotation.set(0, facing, 0);

    // Kopf schaut leicht zum Ball
    M.head.position.copy(W(headP));
    M.head.rotation.set(a.mood === 'sad' ? 0.35 * a.moodK : 0, facing - yaw, 0);
    this.handLWorld = M.handL.position;
    }

    // Schläger
    const rl = Math.hypot(pose.d[0], pose.d[1], pose.d[2]) || 1;
    const r1 = [pose.d[0] / rl, pose.d[1] / rl, pose.d[2] / rl];
    let r2 = [0, r1[2], -r1[1]];
    const r2l = Math.hypot(r2[1], r2[2]);
    r2 = r2l < 0.2 ? [0, 1, 0] : [0, r2[1] / r2l, r2[2] / r2l];
    const Y = D(r1).normalize();
    const X = D(r2).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
    for (const [m, w, , gehen] of layers) {
      if (gehen) continue;
      // Schläger aus der Aufnahme: Richtung des Griffs (d) und der Schlagfläche (n)
      const Zm = D(m.n);
      if (Zm.dot(Z) < 0) Zm.negate();
      Y.lerp(D(m.d), w).normalize();
      Z.lerp(Zm, w).normalize();
    }
    X.crossVectors(Y, Z).normalize();
    Z.crossVectors(X, Y).normalize();
    M.racket.position.copy(W(handR));
    M.racket.visible = !st.ohneSchlaeger;          // bei der Siegerehrung liegt der Schläger in der Tasche
    this.handRWorld = M.racket.position;
    M.racket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) { if (!o.geometry.userData.shared) o.geometry.dispose(); if (o.material.map !== stringTex) o.material.dispose(); }
      if (o.isSkinnedMesh) o.skeleton.dispose();
    });
    this.group.removeFromParent();
  }
}
