// Powershot – die 3D-Spielerfigur.
// Die Figur ist ein Skelett aus Gelenken. Die Posen und Schlagbewegungen stehen in posen.js
// (wo sind die Hände, wie sind die Schultern gedreht …). Ellbogen und Knie werden hier ausgerechnet (ik).
// Angaben als [vor, seite, hoch] in Metern aus Sicht der Figur (seite: + = Schlaghand).

import * as THREE from 'three';
import { figureReady, makeFigure, REST, BONES, HAND } from './figur.js';
import { requisit } from './requisiten.js';
import { mocapClip, mocapFrame, mocapLoop, mocapLauf, mocapStufe, mocapWeg, mocapMix, mocapGang, mocapRunde } from './mocap.js';
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

// --- Hände: Hier kannst du einstellen, wie die Hand greift ---
const GRIFF = {
  schraeg: 0.35,       // der Schlägergriff liegt schräg in der Hand (Bogenmaß; 0 = genau quer zu den Fingern)
  drehMax: 1.9,        // so weit kann sich der Unterarm mit der Hand drehen (Bogenmaß, etwa 110°)
  knickMax: 0.95,      // so weit kann das Handgelenk abknicken (etwa 55°)
  finger: [1.35, 1.6, 1.1],   // so weit krümmen sich die drei Fingerglieder bei einer Faust (Bogenmaß)
  daumen: [1.2, 0.7],  // Daumen: so weit klappt er zur Handfläche und knickt in der Mitte
  mitte: [0.066, 0.032],      // Mitte der Faust: so weit vor dem Handgelenk und so weit unter der Handfläche (Meter)
  fest: 0.9,           // Hand am Schläger: fast ganz zu
  locker: 0.3,         // freie Hand: Finger leicht gekrümmt
  ball: 0.5,           // Hand mit Ball oder am Schlägerhals: halb zu
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const plus = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const stufe = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
// Einen Pfeil v um die Achse k (Länge 1) um den Winkel w drehen
function drehe(v, k, w) {
  const c = Math.cos(w), s = Math.sin(w), kv = cross(k, v), kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}
// Der Unterarm in der T-Pose (damit die Hand weiß, wie sie „gerade“ am Arm sitzt)
const ruheArm = {};
function ruheUnterarm(s) {
  if (!ruheArm[s]) {
    const m = s === 'R' ? 1 : -1, sp = (p) => (m > 0 ? p : mirror(p));
    const n = cross([-1, 0, 0], norm(sub(sp(REST.grip), sp(REST.sh))));
    ruheArm[s] = frame(sp(REST.elbow), sub(sp(REST.grip), sp(REST.elbow)), n);
  }
  return ruheArm[s];
}
const HAND_AB = (HAND.gelenk - REST.elbow[1]) / (REST.grip[1] - REST.elbow[1]) * Math.hypot(REST.grip[0] - REST.elbow[0], REST.grip[1] - REST.elbow[1]);

// Die sieben Knochen einer Hand. In J darf stehen:
//   faustR / faustL = wie weit die Hand zu ist (0 = flach, 1 = Faust)
//   griffR / griffL = { y: Richtung des Schlägergriffs, k: 0…1, an: true = an den Griff der anderen Hand rücken }
//   glatt = { R, L, k } – die Drehung des Unterarms vom letzten Bild (damit nichts springt)
function handRahmen(F, J, s, m) {
  const el = J['el' + s], fo = F['fore' + s], ru = ruheUnterarm(s), e = fo.ey;
  // Richtung aus der T-Pose in die jetzige Pose mitnehmen (so, als wäre die Hand steif am Unterarm)
  const mit = (v) => { const a = dot(v, ru.ex), b = dot(v, ru.ey), c = dot(v, ru.ez); return [fo.ex[0] * a + fo.ey[0] * b + fo.ez[0] * c, fo.ex[1] * a + fo.ey[1] * b + fo.ez[1] * c, fo.ex[2] * a + fo.ey[2] * b + fo.ez[2] * c]; };
  let X = mit([1, 0, 0]), Y = mit([0, m, 0]);       // X = zum Daumen hin, Y = wohin die Finger zeigen
  let gelenk = plus(el, e, HAND_AB);
  const g = J['griff' + s], gk = g ? g.k : 0;
  const ca = Math.cos(GRIFF.schraeg), sa = Math.sin(GRIFF.schraeg);
  // 1. Der Unterarm dreht sich, bis der Griff möglichst gut in der Hand liegt
  let dreh = 0;
  if (gk > 0) {
    const a0 = [X[0] * ca + Y[0] * sa, X[1] * ca + Y[1] * sa, X[2] * ca + Y[2] * sa];
    const ap = plus(a0, e, -dot(a0, e)), yp = plus(g.y, e, -dot(g.y, e));
    dreh = Math.atan2(dot(e, cross(ap, yp)), dot(ap, yp)) * stufe(0.12, 0.4, Math.hypot(yp[0], yp[1], yp[2]));
    dreh = Math.max(-GRIFF.drehMax, Math.min(GRIFF.drehMax, dreh)) * gk;
  }
  if (J.glatt) {
    if (J.glatt[s] != null) dreh = J.glatt[s] + (dreh - J.glatt[s]) * J.glatt.k;
    J.glatt[s] = dreh;
  }
  if (dreh) { X = drehe(X, e, dreh); Y = drehe(Y, e, dreh); }
  F['dreh' + s] = frame(el, e, X);
  // 2. Den Rest macht das Handgelenk: Es knickt ab, so weit es kann
  if (gk > 0) {
    const a1 = [X[0] * ca + Y[0] * sa, X[1] * ca + Y[1] * sa, X[2] * ca + Y[2] * sa];
    const ax = cross(a1, g.y), sl = Math.hypot(ax[0], ax[1], ax[2]);
    if (sl > 1e-4) {
      const w = Math.min(Math.atan2(sl, dot(a1, g.y)), GRIFF.knickMax) * gk, k = [ax[0] / sl, ax[1] / sl, ax[2] / sl];
      X = drehe(X, k, w); Y = drehe(Y, k, w);
    }
  }
  X = norm(plus(X, Y, -dot(X, Y)));
  const Z = cross(X, Y), innen = [-Z[0] * m, -Z[1] * m, -Z[2] * m];      // innen = wohin die Handfläche schaut
  let mitte = plus(plus(gelenk, Y, GRIFF.mitte[0]), innen, GRIFF.mitte[1]);
  // Zweite Hand am Griff: Sie rückt das letzte Stück an den Schläger heran
  if (gk > 0 && g.an && F.faustR) {
    const ziel = plus(F.faustR, g.y, Math.max(0.085, dot(sub(mitte, F.faustR), g.y)));
    let weg = sub(ziel, mitte);
    const l = Math.hypot(weg[0], weg[1], weg[2]);
    if (l > 0.05) weg = [weg[0] * 0.05 / l, weg[1] * 0.05 / l, weg[2] * 0.05 / l];
    gelenk = plus(gelenk, weg, gk); mitte = plus(mitte, weg, gk);
  }
  F['hand' + s] = { o: gelenk, ex: X, ey: Y, ez: Z };
  F['faust' + s] = mitte;
  // Finger: drei Glieder, jedes krümmt sich ein Stück weiter zur Handfläche
  const zu = J['faust' + s] || 0;
  let o = plus(gelenk, Y, HAND.finger[0] - HAND.gelenk), w = 0;
  for (let i = 0; i < 3; i++) {
    w += GRIFF.finger[i] * zu;
    const c = Math.cos(w), si = Math.sin(w), ey = [Y[0] * c + innen[0] * si, Y[1] * c + innen[1] * si, Y[2] * c + innen[2] * si];
    F['fin' + s + (i + 1)] = { o, ex: X, ey, ez: cross(X, ey) };
    if (i < 2) o = plus(o, ey, HAND.finger[i + 1] - HAND.finger[i]);
  }
  // Daumen: klappt zur Handfläche und knickt in der Mitte
  const d1 = GRIFF.daumen[0] * zu, c1 = Math.cos(d1), s1 = Math.sin(d1);
  const dx = [X[0] * c1 + innen[0] * s1, X[1] * c1 + innen[1] * s1, X[2] * c1 + innen[2] * s1];
  const o1 = plus(plus(gelenk, Y, HAND.daumen[0] - HAND.gelenk), X, HAND.daumen[1]);
  F['daum' + s + '1'] = { o: o1, ex: dx, ey: Y, ez: cross(dx, Y) };
  const o2 = plus(plus(o1, Y, HAND.daumenKnick[0] - HAND.daumen[0]), dx, HAND.daumenKnick[1] - HAND.daumen[1]);
  const d2 = d1 + GRIFF.daumen[1] * zu, c2 = Math.cos(d2), s2 = Math.sin(d2);
  const dx2 = [X[0] * c2 + innen[0] * s2, X[1] * c2 + innen[1] * s2, X[2] * c2 + innen[2] * s2];
  F['daum' + s + '2'] = { o: o2, ex: dx2, ey: Y, ez: cross(dx2, Y) };
}

// Alle Knochen-Rahmen aus den Gelenkpunkten (J) berechnen. Dieselbe Funktion gilt für die
// Ruhe-Pose des Modells und für jede Pose im Spiel – so passt beides genau zusammen.
function boneFrames(J) {
  const F = {};
  F.pelvis = upright(J.hip, J.hipYaw || 0);
  // (Mini-Spiele: Liegt oder sitzt die Figur, sagt hipUp, wohin das Becken zeigt, und hipX, wo rechts ist)
  if (J.hipUp) F.pelvis = frame(J.hip, J.hipUp, J.hipX || [0, 1, 0]);
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
    handRahmen(F, J, s, m);
    const hip = J['hip' + s], kn = J['knee' + s], ft = J['foot' + s];
    const k = cross(J['kneeBend' + s] || [KNEE_BEND[0], KNEE_BEND[1] * m, KNEE_BEND[2]], norm(sub(ft, hip)));
    F['thigh' + s] = frame(hip, sub(kn, hip), k);
    F['shin' + s] = frame(kn, sub(ft, kn), k);
    F['foot' + s] = upright(ft, J['footYaw' + s] || 0, J['footNod' + s] || 0);
    if (J['footUp' + s]) F['foot' + s] = frame(ft, J['footUp' + s], J.footX || [0, 1, 0]);
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
// (Diese Zahlen gelten nur noch als Rückfall. Normalerweise spielt die Figur die Aufnahmen 'walk' und 'sprint' aus assets/gang.json ab –
//  die kommen aus dem Schwester-Spiel Police Quest, siehe tools/gang.mjs. Zum Vergleichen: Adresse mit ?altergang öffnen.)
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
// Beim Joggen ist ein Fuß nur kurz am Boden, danach fliegt er in einem Bogen wieder nach vorn. Die Schritte sind
// deshalb länger als die Beine reichen – den Rest "fliegt" die Figur. (Früher wurde der Fuß einfach so weit nach vorn
// und hinten gestellt, wie der Schritt lang ist. Dafür waren die Beine zu kurz – also wurden sie langgezogen.)
const JOGGEN = {
  schritt: 0.66,      // Schrittlänge beim Joggen in Metern …
  schrittTempo: 0.15, // … plus so viel für jeden Meter pro Sekunde Tempo (schneller = längere Schritte, nicht hektischere)
  vorn: 0.24,         // so weit vor der Hüfte setzt der Fuß auf (Meter)
  hinten: 0.36,       // so weit hinter der Hüfte drückt er sich ab (Meter)
  abdruck: 0.10,      // beim Abdrücken rollt der Fuß auf die Zehen, der Knöchel kommt so viel höher (Meter)
  // Der Weg des Fußes durch die Luft, in sechs Stationen vom Abdrücken bis zum Aufsetzen:
  flugVor: [0, -0.12, -0.20, 0.20, 0.34, 0],     // vor (+) oder hinter (−) der Hüfte; erste und letzte Zahl werden aus hinten/vorn berechnet
  flugHoch: [0, 0.30, 0.36, 0.22, 0.07, 0],      // Höhe über dem Boden: hinten schwingt die Ferse hoch, vorn kommt das Knie hoch
  flugFuss: [0.7, 1.1, 0.8, 0.3, -0.1, -0.1],    // Neigung des Fußes (+ = Ferse oben, Zehen zeigen nach unten)
  tief: 0.035,        // beim Joggen sind die Knie etwas gebeugt, die Hüfte ist so viel tiefer (Meter)
  huepfen: 0.05,      // der Körper hebt bei jedem Schritt etwas ab (Meter)
  vorlage: 0.07,      // der Oberkörper neigt sich leicht nach vorn (Meter)
  // Die Arme sind beim Joggen angewinkelt (Ellbogen etwa im rechten Winkel). Wo die Hand ist, von der Schulter aus gemessen:
  armVor: 0.12,       // in der Mitte des Schwungs so weit vor der Schulter (Meter) …
  armSchwung: 0.17,   // … und so weit schwingt sie von dort vor und zurück
  armTief: 0.26,      // in der Mitte des Schwungs so weit unter der Schulter (Meter) …
  armHub: 0.13,       // … vorn kommt sie so viel höher (Richtung Brust), hinten so viel tiefer (Richtung Hüfte)
  armInnen: 0.06,     // vorn schwingt die Hand so weit zur Körpermitte (Meter)
};
// --- Schläger tragen beim Gehen (Seitenwechsel): Der Schläger hängt locker in der Hand, Kante nach unten ---
const TRAGEN = {
  winkel: 0.72,       // so weit zeigt der Schläger vom hängenden Unterarm aus nach vorn (Bogenmaß; 0.72 sind etwa 40 Grad)
  mit: 0.7,           // so stark folgt der Schläger dem Schwingen des Unterarms (1 = ganz, 0 = hängt immer gleich)
  innen: -0.06,       // der Schlägerkopf zeigt ein klein wenig zur Körpermitte (−) oder nach außen (+)
  kippen: 0.3,        // so stark kippt die Fläche mit, wenn der Schläger schräg zur Seite zeigt
  hochMax: -0.2,      // höher als so (0 = waagerecht, −1 = senkrecht nach unten) zeigt der Schlägerkopf nie – er hängt immer etwas
  armRuhig: 0.55,     // der Schlägerarm schwingt nur so stark mit wie der freie Arm (1 = gleich stark) – der Schläger ist ja schwer
  traege: 0.14,       // so viele Sekunden hängt der Schläger dem Arm hinterher (größer = träger)
};
// Weiche Kurve durch vier Punkte (zwischen p1 und p2, t = 0…1)
const kurve = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
// Wo ist ein Fuß beim Joggen? u = 0…1 ist eine ganze Runde des Beins (0 = Fuß setzt vorn auf),
// boden = Anteil der Runde, in dem der Fuß am Boden ist. Antwort: [vor, hoch, Neigung des Fußes]
function joggFuss(u, boden) {
  const J = JOGGEN, weg = J.vorn + J.hinten;
  // Am Boden: Der Fuß bleibt stehen, der Körper läuft darüber weg – aus Sicht der Hüfte wandert er gleichmäßig nach hinten.
  const amBoden = (t) => [J.vorn - weg * t, J.abdruck * smooth((t - 0.6) / 0.4), -0.1 + 0.8 * smooth((t - 0.45) / 0.55)];
  if (u < boden) return amBoden(u / boden);
  // In der Luft: weich durch die sechs Stationen
  const n = J.flugVor.length - 1, s = (u - boden) / (1 - boden) * n, i = Math.min(n - 1, Math.floor(s)), t = s - i;
  const dt = (1 - boden) / n / boden;                       // eine Station weiter, gemessen in "Boden-Zeit"
  const davor = amBoden(1 - dt), danach = amBoden(dt);      // damit der Fuß ohne Ruck abhebt und aufsetzt
  const P = (k, liste, erst, letzt) => i + k < 0 ? davor[erst] : i + k > n ? danach[erst] : i + k === 0 ? letzt[0] : i + k === n ? letzt[1] : liste[i + k];
  const wert = (liste, erst, letzt) => kurve(P(-1, liste, erst, letzt), P(0, liste, erst, letzt), P(1, liste, erst, letzt), P(2, liste, erst, letzt), t);
  return [wert(J.flugVor, 0, [-J.hinten, J.vorn]), Math.max(0, wert(J.flugHoch, 1, [J.abdruck, 0])), wert(J.flugFuss, 2, [J.flugFuss[0], J.flugFuss[n]])];
}
// Zum Vergleichen: Mit ?altergang in der Adresse geht und joggt die Figur wieder mit den gebauten Bewegungen (GANG, JOGGEN).
// Die Lauf-Leiter: Aufnahmen vom Gehen bis zum Sprint, nach Tempo sortiert (walk und sprint aus Police Quest, lauf und spurt von Mixamo).
// Je nach Tempo der Figur wird zwischen zwei Nachbarn gemischt.
const LEITER = ['walk', 'sprint', 'lauf', 'spurt'];
let leiterAlt = null, leiterListe = null;
function laufLeiter() {
  const gehen = mocapClip('walk');
  if (!gehen || !gehen.tempo) return null;
  if (leiterAlt !== gehen) { leiterAlt = gehen; leiterListe = LEITER.map(mocapClip).filter((c) => c && c.tempo && c.gang).sort((x, y) => x.tempo - y.tempo); }
  return leiterListe;
}
// Beine im Ballwechsel (dort schaut die Figur immer zum Netz): nach vorn laufen = Lauf-Leiter, zur Seite = Seitwärts-Aufnahmen.
// Rückwärts gibt es keine Aufnahme, da bleibt der gebaute Schritt.
const BEINE = {
  wechsel: 8,                    // so schnell wird zwischen vor, rechts und links umgeblendet (pro Sekunde)
  schrittMin: 0.6, schrittMax: 1.25,   // Seitwärts-Schritte dürfen so viel kürzer oder länger werden als in der Aufnahme
  hocke: 0.6,                    // so viel von der Hocke eines Schlags (pose.cr) bleibt beim Laufen übrig
};
// (in welcher Mitte pendelt jeder Fuß seitlich? einmal je Aufnahme ausrechnen)
function fussMitte(clip) {
  if (!clip.fm) {
    const i = clip.keys.indexOf('footR') * 3 + 1, j = clip.keys.indexOf('footL') * 3 + 1, n = clip.frames.length - 1;
    let r = 0, l = 0; for (let k = 0; k < n; k++) { r += clip.frames[k][i]; l += clip.frames[k][j]; }
    clip.fm = [r / n, l / n];
  }
  return clip.fm;
}
const ALTER_GANG = typeof location !== 'undefined' && /[?&]altergang/.test(location.search || '');
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
    const leiter = this.real && !ALTER_GANG ? laufLeiter() : null;
    const gang = this.real && walkK > 0 && !ALTER_GANG ? mocapClip('walk') : null;
    // Gibt es die Lauf-Leiter (gehen → laufen → sprinten)? Dann wird je nach Tempo gemischt.
    // laufK = Stelle auf der Leiter (0 = gehen, 1 = die nächste Aufnahme …). Große Spieler machen größere Schritte (this.gross).
    const renn = gang && leiter && leiter[0] === gang ? leiter : null;
    const laufSoll = leiter ? mocapStufe(leiter, sp / this.gross) : 0;
    a.laufK = (a.laufK || 0) + (laufSoll - (a.laufK || 0)) * Math.min(1, dt * 5);
    const gangWeg = gang ? (renn ? mocapWeg(renn, a.laufK) : gang.weg) * this.gross : 0;
    // Joggen (auf dem Turniergelände): lockeres Laufen ohne Schläger. jog = 0 (gehen) … 1 (joggen). Die Schritte werden länger,
    // die Füße heben höher ab, die Arme sind angewinkelt und schwingen mit.
    a.jogK = (a.jogK || 0) + ((st.jog || 0) - (a.jogK || 0)) * Math.min(1, dt * 5);
    const jog = a.jogK;
    // (im Ballwechsel: Kommen die Beine aus einer Aufnahme, bestimmt sie die Schrittlänge – sonst rutschen die Füße)
    const stepRun = 0.5 + 0.18 * sp + ((a.beinWeg || 1) * this.gross / 2 - 0.5 - 0.18 * sp) * (a.beinK || 0), stepWalk = renn ? gangWeg / 2 : (gang && gang.weg > 0.6 ? gang.weg / 2 : GANG.schritt) + jog * Math.max(0, JOGGEN.schritt + JOGGEN.schrittTempo * sp - GANG.schritt);
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
    // --- Beine im Ballwechsel aus Aufnahmen: Wohin läuft die Figur gerade (von ihr aus gesehen)? ---
    let bein = null, beinW = 0;
    const seitR = leiter ? mocapClip('seit_r') : null, seitL = leiter ? mocapClip('seit_l') : null;
    if (seitR && seitL && walkK < 0.999) {
      const B = a.bein || (a.bein = [0, 0, 0]);                          // Anteile: vor, zur Schlaghand, zur anderen Seite
      const soll = moving ? [Math.max(0, a.dir[0]) ** 2, Math.max(0, a.dir[1]) ** 2, Math.max(0, -a.dir[1]) ** 2] : B;
      for (let i = 0; i < 3; i++) B[i] += (soll[i] - B[i]) * Math.min(1, dt * BEINE.wechsel);
      const summe = B[0] + B[1] + B[2];
      a.beinK = Math.min(1, summe) * a.legK;
      if (summe > 0.02 && a.legK > 0.001) {
        let weg = 0;
        const teile = [];
        if (B[0] > 0.01) { teile.push([mocapLauf(leiter, a.step, a.laufK), B[0]]); weg += B[0] * mocapWeg(leiter, a.laufK); }
        for (const [clip, anteil] of [[seitR, B[1]], [seitL, B[2]]]) {
          if (anteil <= 0.01) continue;
          // Seitwärts: Bei wenig Tempo werden die Schritte kürzer, bei viel Tempo länger (und schneller)
          const k = clamp(Math.sqrt(sp / this.gross / clip.tempo), BEINE.schrittMin, BEINE.schrittMax), fm = fussMitte(clip);
          const f = mocapGang(clip, a.step);
          for (const [fuss, zeh, knie, m] of [['footR', 'toeR', 'kneeR', fm[0]], ['footL', 'toeL', 'kneeL', fm[1]]]) {
            const neu = m + (f[fuss][1] - m) * k, schub = neu - f[fuss][1];
            f[fuss] = [f[fuss][0], neu, f[fuss][2]]; f[zeh] = [f[zeh][0], f[zeh][1] + schub, f[zeh][2]]; f[knie] = [f[knie][0], f[knie][1] + schub * 0.5, f[knie][2]];
          }
          teile.push([f, anteil]); weg += anteil * clip.weg * k;
        }
        let ges = 0;
        for (const [f, anteil] of teile) { ges += anteil; bein = bein ? mocapMix(bein, f, anteil / ges) : f; }
        a.beinWeg = weg / ges;
        beinW = a.beinK * (1 - walkK);
      }
    } else a.beinK = 0;

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
    // Joggen: Wo in seiner Runde ist das rechte Bein (0 = setzt gerade vorn auf)? Und wie lange bleibt ein Fuß am Boden?
    // Je länger der Schritt, desto kürzer ist der Fuß am Boden – der Rest ist Flug.
    const joggU = ((a.step - Math.PI / 2) / (2 * Math.PI) % 1 + 1) % 1;
    const joggBoden = clamp((JOGGEN.vorn + JOGGEN.hinten) / (2 * stepLen), 0.2, 0.5);
    const bob = Math.sin(a.time * 4) * 0.012 * still;
    // Beim Rennen hebt der Körper ab, wenn die Beine auseinander sind. Beim Gehen ist es umgekehrt:
    // Die Hüfte ist am höchsten, wenn ein Bein gerade unter dem Körper steht.
    const hipH0 = 0.90 - pose.cr + pose.jp + bob + run * Math.abs(sinS) * 0.035 * (1 - walkK) - gehK * GANG.wippen * (1 - Math.cos(2 * a.step)) * (1 - jog) + gehK * jog * (JOGGEN.huepfen * 0.5 * (1 - Math.cos(4 * Math.PI * (joggU - joggBoden / 2))) - JOGGEN.tief);
    const dm = this.dim;
    // (laufen die Beine nach einer Aufnahme, kommt auch das Auf und Ab der Hüfte von dort)
    const hipH = beinW > 0.001 ? hipH0 + (bein.hip[2] - pose.cr * BEINE.hocke + pose.jp - hipH0) * beinW : hipH0;
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
    const lift = cosS * (liftH + (GANG.fussHoch - liftH) * walkK) * Math.min(1, a.amp * 4);
    // Abrollen: Ist der Fuß hinten, geht die Ferse hoch; ist er vorn, zeigen die Zehen nach oben.
    const hintenR = Math.max(0, -schwung) ** 2 * gehK, hintenL = Math.max(0, schwung) ** 2 * gehK;
    let footR = [stepR + a.dir[0] * swingLeg, stance + a.dir[1] * swingLeg, 0.07 + dm.ankle + air + Math.max(0, lift) + 0.05 * hintenR];
    let footL = [stepL - a.dir[0] * swingLeg, -stance - a.dir[1] * swingLeg, 0.07 + dm.ankle + air + Math.max(0, -lift) + 0.05 * hintenL];
    // Joggen: Die Füße laufen ihre eigene Runde (kurz am Boden, dann im Bogen durch die Luft nach vorn).
    const jw = jog * gehK;
    let joggR = null, joggL = null;
    if (jw > 0.001) {
      joggR = joggFuss(joggU, joggBoden); joggL = joggFuss((joggU + 0.5) % 1, joggBoden);
      const boden = 0.07 + dm.ankle;
      footR = mix3(footR, [a.dir[0] * joggR[0], stance + a.dir[1] * joggR[0], boden + joggR[1]], jw);
      footL = mix3(footL, [a.dir[0] * joggL[0], -stance + a.dir[1] * joggL[0], boden + joggL[1]], jw);
    }
    // Ein Bein kann nicht länger werden: Ist der Fuß weiter weg, als das Bein reicht, kommt er näher zur Hüfte.
    footR = limitReach(hipR, footR, dm.thigh + dm.shin - 0.004);
    footL = limitReach(hipL, footL, dm.thigh + dm.shin - 0.004);
    let kneeR = ik(hipR, footR, dm.thigh, dm.shin, [1, 0.15, 0.2]);
    let kneeL = ik(hipL, footL, dm.thigh, dm.shin, [1, -0.15, 0.2]);
    if (beinW > 0.001) {
      // Beine aus der Aufnahme: Die Füße stehen so weit neben und vor der Hüfte wie dort und genauso hoch über dem Boden.
      // Die Hüfte selbst bleibt, wo der Schlag sie haben will – die Knie werden dazu passend neu ausgerechnet.
      const H = bein.hip, ort = (q) => [q[0] - H[0], hipMid[1] + q[1] - H[1], q[2] + air];
      const hueft = (q) => [q[0] - H[0], hipMid[1] + q[1] - H[1], hipH + q[2] - H[2]];
      hipR = mix3(hipR, hueft(bein.hipR), beinW); hipL = mix3(hipL, hueft(bein.hipL), beinW);
      footR = limitReach(hipR, mix3(footR, ort(bein.footR), beinW), dm.thigh + dm.shin - 0.004);
      footL = limitReach(hipL, mix3(footL, ort(bein.footL), beinW), dm.thigh + dm.shin - 0.004);
      kneeR = ik(hipR, footR, dm.thigh, dm.shin, mix3([1, 0.15, 0.2], sub(bein.kneeR, bein.hipR), beinW));
      kneeL = ik(hipL, footL, dm.thigh, dm.shin, mix3([1, -0.15, 0.2], sub(bein.kneeL, bein.hipL), beinW));
    }

    let handR = limitReach(shR, pose.r, dm.reach);
    let handL = limitReach(shL, pose.l, dm.reach);
    if (walkK > 0.001) {
      // Gehen: Die Arme hängen an den Schultern und pendeln wie ein Pendel – der freie Arm vor, wenn das andere Bein vor geht.
      // Vorn beugt sich der Ellbogen etwas (die Hand kommt höher).
      const vorL = armS * gehK, vorR = -armS * gehK;
      // Die Hände hängen ein Stück neben dem Körper; vorn schwingen sie leicht nach innen, hinten nach außen.
      const ab = GANG.armAbstand;
      // Ohne Schläger (auf dem Turniergelände) schwingen beide Arme gleich. Beim Joggen sind die Ellbogen angewinkelt: Die Hände kommen höher und weiter nach vorn.
      const frei = st.ohneSchlaeger, weitR = frei ? GANG.armFrei : GANG.armSchlaeger;
      let gehL = add3(shL, [0.04 + GANG.armFrei * vorL, -(ab - 0.04 * vorL), -0.535 + GANG.armBeugen * Math.max(0, vorL)]);
      let gehR = add3(shR, [(frei ? 0.04 : 0.06) + weitR * vorR, ab - (frei ? 0.04 : 0.03) * vorR, (frei ? -0.535 : -0.51) + GANG.armBeugen * (frei ? 1 : 0.5) * Math.max(0, vorR)]);
      if (jog > 0.001) {
        const J = JOGGEN;
        gehL = mix3(gehL, add3(shL, [J.armVor + J.armSchwung * vorL, -(ab - J.armInnen * vorL), -J.armTief + J.armHub * vorL]), jog);
        gehR = mix3(gehR, add3(shR, [J.armVor + J.armSchwung * vorR, ab - J.armInnen * vorR, -J.armTief + J.armHub * vorR]), jog);
      }
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
    if (joggR) { footNodR += (joggR[2] - footNodR) * jw; footNodL += (joggL[2] - footNodL) * jw; }
    const look = st.ball ? clamp(Math.atan2((st.ball.x - this.pos.x) * d, Math.abs(st.ball.z - this.pos.z) + 2), -0.7, 0.7) * hand : 0;
    if (beinW > 0.001) {
      // Füße aus der Aufnahme: wohin die Zehen zeigen und ob der Fuß flach steht oder abrollt
      const nick = (f, t) => Math.atan2(f[2] - t[2], Math.hypot(t[0] - f[0], t[1] - f[1])) - FOOT_REST;
      footYawR += (Math.atan2(bein.toeR[1] - bein.footR[1], bein.toeR[0] - bein.footR[0]) - footYawR) * beinW;
      footYawL += (Math.atan2(bein.toeL[1] - bein.footL[1], bein.toeL[0] - bein.footL[0]) - footYawL) * beinW;
      footNodR += (nick(bein.footR, bein.toeR) - footNodR) * beinW; footNodL += (nick(bein.footL, bein.toeL) - footNodL) * beinW;
    }
    const layers = [];
    if (iw > 0.001 && a.idf) layers.push([a.idf, iw, false]);
    if (mw > 0.001) layers.push([a.mf, mw, true]);
    // Aufnahme vom Gehen (falls vorhanden): ersetzt den gebauten Gang, Beine inklusive. Der Schläger bleibt, wie er ist.
    // Der Schlägerarm schwingt ruhiger als der freie Arm: Die Hand bleibt näher an ihrer Mitte neben der Hüfte.
    const schlaegerArm = (m) => {
      if (st.ohneSchlaeger) return m;
      const r = sub(m.handR, m.shR), ruhe = [0.03, 0.11, -0.56], k = TRAGEN.armRuhig;
      const ellbogen = sub(m.elR, m.shR);
      m.handR = limitReach(m.shR, add3(m.shR, mix3(ruhe, r, k)), dm.reach);
      m.elR = ik(m.shR, m.handR, dm.upper, dm.fore, [ellbogen[0] - 0.3, ellbogen[1], ellbogen[2]]);
      return m;
    };
    if (gang && gehK > 0.001) {
      const m = renn ? mocapLauf(renn, a.step, a.laufK) : mocapGang(gang, a.step);
      const zwischen = a.laufK % 1;
      if (renn && zwischen > 0.001 && zwischen < 0.999) {
        // Beim Mischen zweier Aufnahmen würden Arme und Beine ein wenig kürzer – Knie und Ellbogen deshalb neu ausrechnen
        for (const s of ['R', 'L']) {
          m['knee' + s] = ik(m['hip' + s], m['foot' + s], dm.thigh, dm.shin, sub(m['knee' + s], m['hip' + s]));
          m['el' + s] = ik(m['sh' + s], m['hand' + s], dm.upper, dm.fore, sub(m['el' + s], m['sh' + s]));
        }
      }
      layers.push([schlaegerArm(m), gehK, false, true]);
    }
    // Stehen (an der Bank, auf dem Gelände): eine Aufnahme vom lockeren Dastehen und Atmen
    const steh = gang && stehK > 0.001 ? mocapClip('steh') : null;
    if (steh) layers.push([schlaegerArm(mocapRunde(steh, a.time + a.rnd * 9)), stehK * (1 - smooth(a.moodK)), false, true]);
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
    // Schläger: wohin der Griff zeigt (Y) und wohin die Bespannung schaut (Z)
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
    // --- Schläger tragen beim Gehen ---
    // Niemand trägt den Schläger wie eine Bratpfanne (Fläche nach oben, steif nach vorn). In echt hängt der Arm locker,
    // die Handfläche zeigt zum Bein, und der Schläger hängt mit der KANTE nach unten schräg nach vorn – die Bespannung
    // schaut zur Seite. Er hängt am Unterarm: Schwingt der Arm, schwingt der Schläger mit, aber etwas träger (er ist schwer).
    if (walkK > 0.001 && !st.ohneSchlaeger) {
      const T = TRAGEN, arm = norm(sub(handR, elR));
      // Unterarm-Richtung etwas beruhigen (zum Teil einfach "nach unten"), dann um die Quer-Achse nach vorn kippen
      const ruhig = norm([arm[0] * T.mit, arm[1] * T.mit, arm[2] * T.mit - (1 - T.mit)]);
      const c = Math.cos(T.winkel), si = Math.sin(T.winkel);
      let ziel = norm([ruhig[0] * c - ruhig[2] * si, ruhig[1] * 0.5 + T.innen, ruhig[2] * c + ruhig[0] * si]);
      // Der Schlägerkopf hängt immer ein Stück nach unten (auch beim Laufen mit angewinkeltem Arm)
      if (ziel[2] > T.hochMax) ziel = norm([ziel[0], ziel[1], T.hochMax * Math.hypot(ziel[0], ziel[1]) / Math.sqrt(1 - T.hochMax * T.hochMax)]);
      // träge nachschwingen
      a.trag = a.trag ? norm(mix3(a.trag, ziel, Math.min(1, dt / T.traege))) : ziel;
      const t = a.trag, kante = norm([-t[1] * T.kippen, 1, 0]);      // die Bespannung schaut zur Seite (ganz leicht mitgekippt)
      const Yt = D(t).normalize(), Zt = D(kante).normalize();
      if (Zt.dot(Z) < 0 && walkK < 0.5) Zt.negate();
      Y.lerp(Yt, walkK).normalize();
      Z.lerp(Zt, walkK).normalize();
    } else a.trag = null;
    X.crossVectors(Y, Z).normalize();
    Z.crossVectors(X, Y).normalize();
    let faustMitte = null;
    if (this.real) {
      // Hände: Die Schlaghand greift den Schläger. Die andere Hand ist locker, greift mit zu (beidhändige Rückhand),
      // stützt den Schläger am Hals, hält den Ball oder ballt beim Jubeln die Faust.
      const mitSchlaeger = !st.ohneSchlaeger;
      const yF = [(Y.x * sf - Y.z * cf) * d, (Y.x * cf + Y.z * sf) * d * hand, Y.y];     // Griff-Richtung aus Sicht der Figur
      const zurHand = sub(handL, handR), lang = dot(zurHand, yF);
      const quer = Math.hypot(zurHand[0] - yF[0] * lang, zurHand[1] - yF[1] * lang, zurHand[2] - yF[2] * lang);
      const amSchlaeger = mitSchlaeger && lang > 0 && lang < 0.45 ? 1 - stufe(0.05, 0.12, quer) : 0;
      const amGriff = amSchlaeger * (1 - stufe(0.16, 0.24, lang));
      let zuL = GRIFF.locker + (GRIFF.fest - GRIFF.locker) * amGriff + (GRIFF.ball - GRIFF.locker) * (amSchlaeger - amGriff);
      if (st.serveK != null || st.prellK != null) zuL = Math.max(zuL, GRIFF.ball);     // der Ball liegt in der Hand
      if (a.mood === 'cheer' && this.jubel.pose !== 'cheer_ohr') zuL += (1 - zuL) * smooth(a.moodK);   // Faust!
      if (!mitSchlaeger) zuL = GRIFF.locker + 0.25 * jw;
      const zuR = mitSchlaeger ? GRIFF.fest : zuL;
      const flink = Math.min(1, dt * 14);
      a.zuL = a.zuL == null ? zuL : a.zuL + (zuL - a.zuL) * flink;
      a.zuR = a.zuR == null ? zuR : a.zuR + (zuR - a.zuR) * flink;
      a.glatt = a.glatt || { R: null, L: null, k: 1 };
      a.glatt.k = dt > 0 ? Math.min(1, dt * 20) : 1;
      // Realistisches Modell: nur die Knochen einstellen, die Oberfläche folgt von allein
      const F = boneFrames({
        faustR: a.zuR, faustL: a.zuL, glatt: a.glatt,
        griffR: mitSchlaeger ? { y: yF, k: 1 } : null, griffL: amGriff > 0.01 ? { y: yF, k: amGriff, an: true } : null,
        hip: hipMid, neck, shR, shL, elR, elL, handR, handL, armBendR, armBendL, hipR, hipL, kneeR, kneeL, footR, footL,
        kneeBendR, kneeBendL, footYawR, footYawL, footNodR, footNodL, headF, headU,
        hipYaw, yaw: yaw * hand, nod: a.mood === 'sad' ? 0.35 * a.moodK : 0,
      });
      for (let i = 0; i < BONES.length; i++) {
        const fr = F[BONES[i]], b = this.bones[i];
        // Jeder Knochen wird so lang wie die Körpergröße verlangt – und je nach Statur etwas dicker oder dünner (Kopf und Füße nicht)
        const dick = i === 2 || i === 11 || i === 12 ? G : GB;
        b.matrix.makeBasis(D(fr.ex).multiplyScalar(dick), D(fr.ey).multiplyScalar(G), D(fr.ez).multiplyScalar(dick)).setPosition(W(fr.o));
        b.matrixWorldNeedsUpdate = true;
      }
      this.handLWorld = W(handL);
      faustMitte = W(F.faustR);
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

    // Der Griff liegt mitten in der Faust (das Griffende schaut unten ein Stück heraus)
    if (faustMitte) M.racket.position.copy(faustMitte).addScaledVector(Y, -0.03);
    else M.racket.position.copy(W(handR));
    M.racket.visible = !st.ohneSchlaeger;          // bei der Siegerehrung liegt der Schläger in der Tasche
    this.handRWorld = M.racket.position;
    M.racket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  }

  // ---------------------------------------------------------------
  // Für die Mini-Spiele: Die Figur wird wie eine Gliederpuppe hingestellt.
  // ---------------------------------------------------------------
  // J = alle Gelenke als [vor, seite, hoch] (seite: + = rechte Hand), ausgerechnet in minibuehne.js.
  // o = { x, y, z: wo die Figur steht · face: wohin sie schaut (0 = zur Kamera, also nach +z) ·
  //       schlaeger: { d: Richtung Griff → Kopf, n: wohin die Bespannung zeigt } oder nichts = ohne Schläger }
  // So kann die Figur auch liegen, sitzen oder hocken – das kann update() nicht.
  stelle(J, o = {}) {
    if (!this.real) return;
    const f = o.face || 0, cf = Math.cos(f), sf = Math.sin(f), G = this.gross, GB = G * this.breit;
    const bx = o.x || 0, by = o.y || 0, bz = o.z || 0;
    const D = (p) => new THREE.Vector3(p[0] * sf - p[1] * cf, p[2], p[0] * cf + p[1] * sf);
    const W = (p) => D(p).multiplyScalar(G).add(new THREE.Vector3(bx, by, bz));
    this.welt = W; this.richtung = D;
    // Hände: locker, wenn die Pose nichts anderes sagt (J.faustR / J.faustL: 0 = flach, 1 = Faust); mit Schläger greift die rechte Hand zu
    // o.faust = Zahl oder [rechts, links]; o.stange = Richtung einer Stange, die beide Hände von oben greifen (Daumen zeigen zueinander)
    const griff = o.schlaeger ? norm(o.schlaeger.d) : null, st = o.stange ? norm(o.stange) : null;
    const zu = Array.isArray(o.faust) ? o.faust : [o.faust, o.faust];
    this.glattS = this.glattS || { R: null, L: null, k: 0.35 };
    const F = boneFrames({
      ...J, glatt: this.glattS,
      faustR: zu[0] ?? (griff ? GRIFF.fest : GRIFF.locker), faustL: zu[1] ?? GRIFF.locker,
      griffR: griff ? { y: griff, k: 1 } : st ? { y: [-st[0], -st[1], -st[2]], k: 1 } : null, griffL: st ? { y: st, k: 1 } : null,
    });
    for (let i = 0; i < BONES.length; i++) {
      const fr = F[BONES[i]], b = this.bones[i];
      const dick = i === 2 || i === 11 || i === 12 ? G : GB;
      b.matrix.makeBasis(D(fr.ex).multiplyScalar(dick), D(fr.ey).multiplyScalar(G), D(fr.ez).multiplyScalar(dick)).setPosition(W(fr.o));
      b.matrixWorldNeedsUpdate = true;
    }
    const rk = this.m.racket;
    rk.visible = !!o.schlaeger;
    if (o.schlaeger) {
      const Y = D(o.schlaeger.d).normalize(), Z = D(o.schlaeger.n || [0, 0, 1]);
      const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
      Z.crossVectors(X, Y).normalize();
      rk.position.copy(W(F.faustR)).addScaledVector(Y, -0.03);
      rk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) { if (!o.geometry.userData.shared) o.geometry.dispose(); if (o.material.map !== stringTex) o.material.dispose(); }
      if (o.isSkinnedMesh) o.skeleton.dispose();
    });
    this.group.removeFromParent();
  }
}
