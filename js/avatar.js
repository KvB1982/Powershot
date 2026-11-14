// Powershot – die 3D-Spielerfigur.
// Die Figur ist ein Skelett aus Gelenken. Für jede Pose steht in POSES, wo die Hände
// sind und wohin der Schläger zeigt. Ellbogen und Knie werden ausgerechnet (ik).
// Angaben als [vor, seite, hoch] in Metern aus Sicht der Figur (seite: + = Schlaghand).

import * as THREE from 'three';
import { figureReady, makeFigure, REST, BONES } from './figur.js';

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
  F.pelvis = upright(J.hip);
  F.chest = frame(J.hip, sub(J.neck, J.hip), sub(J.shR, J.shL));
  F.head = upright(J.neck, J.yaw || 0, J.nod || 0);
  for (const [s, m] of [['R', 1], ['L', -1]]) {
    const sh = J['sh' + s], el = J['el' + s], hd = J['hand' + s];
    const n = cross(J['armBend' + s], norm(sub(hd, sh)));
    F['upper' + s] = frame(sh, sub(el, sh), n);
    F['fore' + s] = frame(el, sub(hd, el), n);
    const hip = J['hip' + s], kn = J['knee' + s], ft = J['foot' + s];
    const k = cross([KNEE_BEND[0], KNEE_BEND[1] * m, KNEE_BEND[2]], norm(sub(ft, hip)));
    F['thigh' + s] = frame(hip, sub(kn, hip), k);
    F['shin' + s] = frame(kn, sub(ft, kn), k);
    F['foot' + s] = upright(ft);
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

const POSES = {
  ready:     { r: [0.34, 0.10, 0.98], d: [0.35, -0.75, 0.55], l: [0.36, -0.14, 1.04] },
  fh_back:   { r: [-0.30, 0.52, 1.12], d: [-0.75, 0.45, 0.48], l: [0.30, -0.22, 1.18] },
  fh_hit:    { r: [0.46, 0.50, 0.95], d: [0.28, 0.92, 0.22], l: [0.12, -0.38, 1.10] },
  fh_follow: { r: [0.26, -0.30, 1.62], d: [-0.35, -0.6, 0.72], l: [0.10, -0.36, 1.02] },
  bh_back:   { r: [-0.26, -0.36, 1.08], d: [-0.72, -0.6, 0.33], l: [-0.14, -0.42, 1.10] },
  bh_hit:    { r: [0.44, -0.28, 0.95], d: [0.28, -0.92, 0.22], l: [0.36, -0.36, 0.98] },
  bh_follow: { r: [0.22, 0.50, 1.55], d: [0.2, 0.7, 0.7], l: [-0.10, -0.38, 1.02] },
  sv_back:   { r: [-0.22, 0.26, 1.62], d: [-0.5, 0.1, 0.85], l: [0.22, -0.18, 2.10] },
  sv_hit:    { r: [0.14, 0.18, 2.18], d: [0.12, 0, 1], l: [0.14, -0.32, 1.15] },
  sv_follow: { r: [0.42, -0.24, 0.78], d: [0.5, -0.5, -0.7], l: [0.10, -0.36, 1.02] },
  cheer:     { r: [0.05, 0.30, 2.0], d: [0, 0.25, 1], l: [0.10, -0.30, 1.45] },
  sad:       { r: [0.10, 0.25, 0.75], d: [0.2, 0.1, -1], l: [0.05, -0.25, 0.80] },
};
const T_HIT = 0.06, T_FOLLOW = 0.26, T_END = 0.6;   // Zeiten einer Schlagbewegung (Sekunden)
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (s) => { s = clamp(s, 0, 1); return s * s * (3 - 2 * s); };
const mix3 = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
const mixPose = (a, b, s) => ({ r: mix3(a.r, b.r, s), d: mix3(a.d, b.d, s), l: mix3(a.l, b.l, s) });
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
    this.side = side;
    this.d = side === 0 ? 1 : -1;
    this.hand = hand;
    this.group = new THREE.Group();
    this.pos = { x: 0, z: side === 0 ? 12 : -12 };
    this.a = { run: 0, step: 0, dir: [1, 0], prep: 0, art: 'fh', swing: null, t: 0, contactY: 0.95, mood: null, moodK: 0, time: Math.random() * 5 };
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

    this.buildRacket(look);
  }

  // Schläger: Griff, Hals, Rahmen und Saiten. Der Griff zeigt in +Y, die Fläche schaut nach +Z.
  buildRacket(look) {
    const M = this.m;
    const rk = M.racket = new THREE.Group();
    this.group.add(rk);
    const frameMat = stdMat(look.racket ?? 0x202020, 0.4);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.2, 8), stdMat(0xf2f2f2, 0.9));
    grip.position.y = 0.08;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 6, 26), frameMat);
    frame.scale.set(1, 1.28, 1); frame.position.y = 0.5;
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 22),
      new THREE.MeshBasicMaterial({ map: stringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    strings.scale.set(1, 1.28, 1); strings.position.y = 0.5;
    rk.add(grip, frame, strings);
    for (const sx of [-1, 1]) {
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.19, 6), frameMat);
      throat.position.set(sx * 0.035, 0.265, 0); throat.rotation.z = -sx * 0.36;
      rk.add(throat);
    }
    rk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // Schlagbewegung starten: kind = 'fh' | 'bh' | 'sv'
  swing(kind, contactY = 0.95) {
    this.a.swing = kind;
    this.a.t = 0;
    this.a.contactY = contactY;
    this.a.mood = null;
  }

  currentPose() {
    const a = this.a;
    let pose;
    if (a.swing) {
      const k = a.swing, t = a.t;
      const hit = { ...POSES[k + '_hit'] };
      if (k !== 'sv') hit.r = [hit.r[0], hit.r[1], clamp(a.contactY, 0.45, 1.7)];
      if (t < T_HIT) pose = mixPose(POSES[k + '_back'], hit, smooth(t / T_HIT));
      else if (t < T_FOLLOW) pose = mixPose(hit, POSES[k + '_follow'], smooth((t - T_HIT) / (T_FOLLOW - T_HIT)));
      else pose = mixPose(POSES[k + '_follow'], POSES.ready, smooth((t - T_FOLLOW) / (T_END - T_FOLLOW)));
    } else {
      pose = mixPose(POSES.ready, POSES[a.art + '_back'], smooth(a.prep));
    }
    if (a.moodK > 0.001 && a.mood) pose = mixPose(pose, POSES[a.mood], smooth(a.moodK));
    return pose;
  }

  // st: { x, z, vx, vz, prep, stroke, mood, ball:{x,z} }
  update(dt, st) {
    const a = this.a, d = this.d, hand = this.hand;
    a.time += dt;
    this.pos.x = st.x; this.pos.z = st.z;

    // Laufen
    const sp = Math.hypot(st.vx || 0, st.vz || 0);
    if (sp > 0.4) {
      a.dir = [-(st.vz) * d / sp, (st.vx) * d * hand / sp];
      a.step += sp * dt * 2.5;
    }
    a.run += (clamp(sp / 3.2, 0, 1) - a.run) * Math.min(1, dt * 10);

    // Schlag / Ausholen / Stimmung
    if (a.swing) {
      a.t += dt;
      if (a.t >= T_END) { a.swing = null; a.prep = 0; }
    } else {
      if (st.stroke) a.art = st.stroke;
      a.prep += ((st.prep || 0) - a.prep) * Math.min(1, dt * 12);
    }
    a.mood = st.mood || a.mood;
    a.moodK += ((st.mood ? 1 : 0) - a.moodK) * Math.min(1, dt * 5);
    if (!st.mood && a.moodK < 0.01) a.mood = null;

    const pose = this.currentPose();
    const run = a.run;
    const bob = Math.sin(a.time * 4) * 0.012 * (1 - run);
    const crouch = 0.05 + 0.06 * (a.art !== 'sv' ? a.prep : 0) + (a.mood === 'sad' ? 0.04 * a.moodK : 0);
    const hipH = 0.90 - crouch + bob + run * Math.abs(Math.sin(a.step)) * 0.035;
    const dm = this.dim;
    const shH = hipH + dm.shUp;
    const lean = 0.05 + 0.07 * run;

    let twist = clamp(pose.r[0] / 0.85, -0.6, 0.6);
    if (pose.r[1] < -0.15) twist = -twist * 0.5;
    const shR = [lean + dm.shW * Math.sin(twist), dm.shW * Math.cos(twist), shH];
    const shL = [lean - dm.shW * Math.sin(twist), -dm.shW * Math.cos(twist), shH];
    const neck = [lean, 0, shH + dm.neckUp];
    const headP = [lean + 0.03, 0, shH + dm.headUp - (a.mood === 'sad' ? 0.03 * a.moodK : 0)];
    const hipMid = [0, 0, hipH];
    const hipR = [0, dm.hipW, hipH], hipL = [0, -dm.hipW, hipH];

    const stance = 0.17 + 0.06 * a.prep;
    const swingLeg = Math.sin(a.step) * 0.4 * run;
    const lift = Math.cos(a.step) * 0.24 * run;
    const footR = [a.dir[0] * swingLeg, stance + a.dir[1] * swingLeg, 0.07 + dm.ankle + Math.max(0, lift)];
    const footL = [-a.dir[0] * swingLeg, -stance - a.dir[1] * swingLeg, 0.07 + dm.ankle + Math.max(0, -lift)];
    const kneeR = ik(hipR, footR, dm.thigh, dm.shin, [1, 0.15, 0.2]);
    const kneeL = ik(hipL, footL, dm.thigh, dm.shin, [1, -0.15, 0.2]);

    const handR = limitReach(shR, pose.r, dm.reach);
    const handL = limitReach(shL, pose.l, dm.reach);
    const armBendR = ARM_BEND, armBendL = mirror(ARM_BEND);
    const elR = ik(shR, handR, dm.upper, dm.fore, armBendR);
    const elL = ik(shL, handL, dm.upper, dm.fore, armBendL);

    // --- In die Welt umrechnen und die Körperteile hinsetzen ---
    const px = this.pos.x, pz = this.pos.z;
    const W = (p) => new THREE.Vector3(px + p[1] * hand * d, p[2], pz - p[0] * d);
    const D = (p) => new THREE.Vector3(p[1] * hand * d, p[2], -p[0] * d);
    const M = this.m;
    let yaw = 0;
    if (st.ball) yaw = clamp(Math.atan2((st.ball.x - px) * d, Math.abs(st.ball.z - pz) + 2), -0.7, 0.7);
    if (this.real) {
      // Realistisches Modell: nur die Knochen einstellen, die Oberfläche folgt von allein
      const F = boneFrames({
        hip: hipMid, neck, shR, shL, elR, elL, handR, handL, armBendR, armBendL, hipR, hipL, kneeR, kneeL, footR, footL,
        yaw: yaw * hand, nod: a.mood === 'sad' ? 0.35 * a.moodK : 0,
      });
      for (let i = 0; i < BONES.length; i++) {
        const fr = F[BONES[i]], b = this.bones[i];
        b.matrix.makeBasis(D(fr.ex), D(fr.ey), D(fr.ez)).setPosition(W(fr.o));
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
    X.crossVectors(Y, Z).normalize();
    M.racket.position.copy(W(handR));
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
