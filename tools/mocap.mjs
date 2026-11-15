// Powershot – Werkzeug: aufgezeichnete Bewegungen (Motion Capture, FBX mit Unreal-Skelett) umrechnen.
//
//   node tools/mocap.mjs            liest mocap/*.FBX und schreibt mocap/bewegungen.json
//   node tools/mocap.mjs --info     zeigt nur, was in den Dateien steckt
//
// Aus jeder Aufnahme werden 60-mal pro Sekunde die Positionen der wichtigen Gelenke gelesen
// (Schulter, Ellbogen, Hand, Hüfte, Knie, Fuß …) und so gedreht, dass "vorne" zum Netz zeigt.
// Zeit 0 ist der Treffpunkt: der Moment, in dem die Schlägerspitze am schnellsten ist.
// Das Spiel lädt mocap/bewegungen.json, wenn es sie gibt. Die gekauften Dateien und die
// Ausgabe bleiben im Ordner mocap/, der nicht ins öffentliche Repository hochgeladen wird.

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'mocap');
const INFO = process.argv.includes('--info');
const FPS = 60;

// Welche Datei ist welcher Schlag? vor/nach = wie viele Sekunden vor und nach dem Treffpunkt benutzt werden.
// yaw = Korrektur der Blickrichtung in Grad, falls die automatische Erkennung danebenliegt.
const CLIPS = {
  sv:    { file: 'Serving_in_Tennis', vor: 1.3, nach: 0.9, yaw: 0 },                 // Aufschlag
  bh_ts: { file: 'Swinging_a_Backhand_to_the_Right', vor: 0.9, nach: 0.8, yaw: 0 },  // Rückhand (einhändig, Hüfthöhe)
  bh_hi: { file: 'Swinging_Two_Handed_to_the_Left', vor: 0.9, nach: 0.8, yaw: 0 },   // hohe Rückhand (beidhändig, im Sprung)
  // 'Defending_a_Right_Side_Attack_in_Tennis' enthält keinen Schlag, 'Getting_Ready_in_Place_for_Tennis' ist nur Warten.
};

// three.js läuft auch ohne Browser, braucht aber ein paar Platzhalter
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }), createElement: () => ({ style: {}, getContext: () => null }) };
const quiet = console.warn; console.warn = () => {};
const THREE = await import(pathToFileURL(path.join(ROOT, 'node_modules/three/build/three.module.js')).href);
const { FBXLoader } = await import(pathToFileURL(path.join(ROOT, 'node_modules/three/examples/jsm/loaders/FBXLoader.js')).href);

const JOINTS = ['pelvis', 'neck_01', 'head', 'upperarm_r', 'upperarm_l', 'lowerarm_r', 'lowerarm_l', 'hand_r', 'hand_l',
  'thigh_r', 'thigh_l', 'calf_r', 'calf_l', 'foot_r', 'foot_l', 'ball_r', 'ball_l',
  'middle_01_r', 'middle_01_l', 'index_01_r', 'pinky_01_r'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Eine FBX-Datei laden und alle Gelenke für jedes Bild auslesen. Ergebnis in Metern als [vor, seite, hoch]
// (Unreal: z = oben, −y = vorne, −x = rechts, Zentimeter).
function read(file) {
  const buf = fs.readFileSync(file);
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const clip = obj.animations[0];
  const mixer = new THREE.AnimationMixer(obj);
  mixer.clipAction(clip).play();
  const bones = {};
  for (const n of JOINTS) { bones[n] = obj.getObjectByName(n); if (!bones[n]) throw new Error('Knochen fehlt: ' + n); }
  const frames = [], v = new THREE.Vector3();
  const n = Math.floor(clip.duration * FPS);
  for (let i = 0; i <= n; i++) {
    mixer.setTime(i / FPS);
    obj.updateMatrixWorld(true);
    const f = {};
    for (const k of JOINTS) { bones[k].getWorldPosition(v); f[k] = [-v.y / 100, -v.x / 100, v.z / 100]; }
    frames.push(f);
  }
  return { frames, duration: clip.duration };
}

// Aus den rohen Gelenken das ableiten, was die Spielfigur braucht
function derive(f) {
  const o = {};
  o.hip = f.pelvis; o.neck = f.neck_01; o.head = f.head;
  o.shR = f.upperarm_r; o.shL = f.upperarm_l; o.elR = f.lowerarm_r; o.elL = f.lowerarm_l;
  // Griffpunkt: etwas vor dem Handgelenk, in der Handfläche
  o.handR = add(f.hand_r, sub(f.middle_01_r, f.hand_r), 0.75);
  o.handL = add(f.hand_l, sub(f.middle_01_l, f.hand_l), 0.75);
  o.hipR = f.thigh_r; o.hipL = f.thigh_l; o.kneeR = f.calf_r; o.kneeL = f.calf_l; o.footR = f.foot_r; o.footL = f.foot_l;
  o.toeR = f.ball_r; o.toeL = f.ball_l;
  // Schläger: liegt quer in der Hand, vom kleinen Finger zum Zeigefinger; die Fläche schaut wie die Handfläche
  o.d = norm(sub(f.index_01_r, f.pinky_01_r));
  o.n = norm(cross(o.d, sub(f.middle_01_r, f.hand_r)));
  return o;
}

const KEYS = ['hip', 'neck', 'head', 'shR', 'shL', 'elR', 'elL', 'handR', 'handL', 'hipR', 'hipL', 'kneeR', 'kneeL', 'footR', 'footL', 'toeR', 'toeL'];

function convert(name, cfg) {
  const file = path.join(DIR, cfg.file + '.FBX');
  if (!fs.existsSync(file)) { console.log(`  ${name}: Datei fehlt (${cfg.file}.FBX)`); return null; }
  const { frames, duration } = read(file);
  const D = frames.map(derive);
  const tip = D.map((o) => add(o.handR, o.d, 0.55));
  // Treffpunkt = schnellste Schlägerspitze
  let best = 1, bs = 0;
  const speed = [];
  for (let i = 1; i < D.length - 1; i++) {
    const s = len(sub(tip[i + 1], tip[i - 1])) * FPS / 2;
    speed.push(s);
    if (s > bs) { bs = s; best = i; }
  }
  // Blickrichtung: wohin fliegt die Schlägerspitze im Treffpunkt (nur waagerecht)?
  const vel = sub(tip[Math.min(D.length - 1, best + 2)], tip[Math.max(0, best - 2)]);
  let yaw = Math.atan2(vel[1], vel[0]) + (cfg.yaw || 0) * Math.PI / 180;
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const rot = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  const hands = len(sub(D[best].handR, D[best].handL));
  const info = `${name.padEnd(6)} ${cfg.file.padEnd(42)} Dauer ${duration.toFixed(2)} s · Treffpunkt bei ${(best / FPS).toFixed(2)} s · Tempo ${bs.toFixed(1)} m/s · ` +
    `Spitze ${tip[best][2].toFixed(2)} m hoch · Hand ${D[best].handR[2].toFixed(2)} m · Hände ${hands.toFixed(2)} m auseinander · Richtung ${(yaw * 180 / Math.PI).toFixed(0)}°`;
  console.log('  ' + info);
  if (INFO) {
    // Verlauf: Tempo der Schlägerspitze in Zehntelsekunden
    const row = [];
    for (let i = 0; i < speed.length; i += 6) row.push(Math.round(Math.max(...speed.slice(i, i + 6))));
    console.log('         Tempo je 0,1 s: ' + row.join(' '));
  }
  // Ausschnitt um den Treffpunkt
  const i0 = Math.max(0, best - Math.round(cfg.vor * FPS)), i1 = Math.min(D.length - 1, best + Math.round(cfg.nach * FPS));
  // Die Figur soll auf der Stelle bleiben: geglättete Position der Hüfte abziehen (das Laufen macht das Spiel)
  const W = Math.round(0.3 * FPS);
  const out = [];
  for (let i = i0; i <= i1; i++) {
    let cx = 0, cy = 0, cnt = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(D.length - 1, i + W); k++) { cx += D[k].hip[0]; cy += D[k].hip[1]; cnt++; }
    const center = [cx / cnt, cy / cnt, 0];
    const o = D[i], row = [];
    for (const k of KEYS) row.push(...rot(sub(o[k], center)));
    row.push(...rot(o.d), ...rot(o.n));
    out.push(row.map((x) => Math.round(x * 1000) / 1000));
  }
  return { t0: (i0 - best) / FPS, fps: FPS, hitY: Math.round(D[best].handR[2] * 1000) / 1000, two: hands < 0.2 ? 1 : 0, frames: out };
}

console.log('Aufnahmen im Ordner mocap/:');
const result = { keys: [...KEYS, 'd', 'n'], clips: {} };
for (const [name, cfg] of Object.entries(CLIPS)) {
  const r = convert(name, cfg);
  if (r) result.clips[name] = r;
}
console.warn = quiet;
if (!INFO) {
  const out = path.join(DIR, 'bewegungen.json');
  fs.writeFileSync(out, JSON.stringify(result));
  console.log(`geschrieben: mocap/bewegungen.json (${Math.round(fs.statSync(out).size / 1024)} KB, ${Object.keys(result.clips).length} Bewegungen)`);
}
