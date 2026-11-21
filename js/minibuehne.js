// Powershot – Die 3D-Bühne für die Mini-Spiele (Aufgaben vom Team).
//
// minispiele.js kennt die Regeln der Mini-Spiele (Zeiten, Punkte, Knöpfe). Diese Datei baut dazu das Bild in 3D:
// einen Raum oder den Trainingsplatz, die Geräte (alles aus einfachen Formen selbst gebaut) und deine echte Spielerfigur,
// die wie eine Gliederpuppe hingestellt wird (liegen, sitzen, hocken, heben …).
//
// So läuft es ab:  oeffne(art, opt)  baut die Bühne für ein Mini-Spiel
//                  zeige(g, z, dt)   stellt alles nach dem Spielstand z hin, rendert und kopiert das Bild auf die Malfläche g
//                  schliesse()       räumt wieder auf
// Gerendert wird mit dem großen Renderer des Spiels in eine Ecke seines Bildes – wie beim Pokal und bei der Anprobe (game3d.js).
//
// Posen: Eine Pose P sagt nur das Wichtigste – wo die Hüfte ist, wohin der Oberkörper zeigt, wo Hände und Füße sind.
// Alles als [vor, seite, hoch] in Metern aus Sicht der Figur (seite: + = ihre rechte Hand). Ellbogen und Knie rechnet `gelenke` aus.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { mocapClip, mocapFrame } from './mocap.js';
import { figureReady } from './figur.js';
import { moebelBauen } from './moebel.js';

const W = 900, H = 540;                  // Größe der Malfläche in minispiele.js
// Maße des Spielermodells (wie DIM_REAL in avatar.js)
const DIM = { upper: 0.275, fore: 0.347, reach: 0.60, thigh: 0.42, shin: 0.425, bein: 0.835, shW: 0.192, hipW: 0.09, shUp: 0.48, neckUp: 0.145 };

// ---------- Rechnen mit [vor, seite, hoch] ----------
const plus = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mal = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const laenge = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = laenge(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punkt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const misch = (a, b, t) => a + (b - a) * t;
const misch3 = (a, b, t) => [misch(a[0], b[0], t), misch(a[1], b[1], t), misch(a[2], b[2], t)];
const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));
const weich = (t) => { t = begrenzen(t, 0, 1); return t * t * (3 - 2 * t); };
// a so drehen, dass es genau quer zu n steht
const quer = (a, n) => { const q = plus(a, n, -punkt(a, n)); return laenge(q) < 1e-4 ? norm(kreuz(n, [0.3, 0.5, 0.8])) : norm(q); };
// Zwei Knochen (l1, l2) von a nach b: Wo ist das Gelenk dazwischen? `knick` sagt, wohin es zeigen soll.
function ik(a, b, l1, l2, knick) {
  const d = begrenzen(laenge(minus(b, a)), 0.02, l1 + l2 - 0.002), r = norm(minus(b, a));
  const lang = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - lang * lang));
  return plus(plus(a, r, lang), quer(knick, r), h);
}
const reichen = (a, b, max) => { const d = laenge(minus(b, a)); return d <= max ? b : plus(a, minus(b, a), max / d); };

// Aus einer Pose alle Gelenke ausrechnen (so, wie avatar.js sie haben möchte).
//   hip    Hüfte (Mitte)                    auf     wohin der Oberkörper zeigt (von der Hüfte zum Hals)
//   quer   wo die rechte Schulter ist       becken  wohin das Becken zeigt (sonst wie auf)
//   hR hL  Hände      eR eL  wohin die Ellbogen knicken
//   fR fL  Füße (Knöchel)   kR kL  wohin die Knie knicken   uR uL  wohin der Fuß „nach oben“ zeigt (sonst steht er flach)
//   blick  wohin der Kopf schaut            kopfAuf wo beim Kopf oben ist
export function gelenke(P = {}) {
  const hip = P.hip || [0, 0, 0.9];
  const up = norm(P.auf || [0, 0, 1]), q = quer(P.quer || [0, 1, 0], up), vor = kreuz(q, up);
  const bUp = norm(P.becken || up), bq = quer(P.hquer || q, bUp);
  const lokal = (v) => plus(plus(mal(vor, v[0]), q, v[1]), up, v[2]);
  const shM = plus(hip, up, DIM.shUp), neck = plus(hip, up, DIM.shUp + DIM.neckUp);
  const J = { hip, neck, hipUp: bUp, hipX: bq, footX: P.fussX || bq };
  J.headF = norm(P.blick || vor);
  J.headU = quer(P.kopfAuf || up, J.headF);
  for (const [s, m] of [['R', 1], ['L', -1]]) {
    const sh = J['sh' + s] = plus(shM, q, m * DIM.shW);
    const hand = J['hand' + s] = reichen(sh, P['h' + s] || plus(sh, lokal([0.07, m * 0.09, -0.57])), DIM.reach);
    const el = J['el' + s] = ik(sh, hand, DIM.upper, DIM.fore, P['e' + s] || lokal([-0.4, m * 0.6, -1]));
    J['armBend' + s] = plus(minus(el, sh), [-0.4, m * 0.6, -1], 0.02);
    const hf = J['hip' + s] = plus(hip, bq, m * DIM.hipW);
    const fuss = J['foot' + s] = reichen(hf, P['f' + s] || [0, m * 0.13, 0.09], DIM.bein);
    const knick = P['k' + s] || [1, m * 0.15, 0.2];
    const knie = J['knee' + s] = ik(hf, fuss, DIM.thigh, DIM.shin, knick);
    J['kneeBend' + s] = plus(minus(knie, hf), knick, 0.02);
    if (P['u' + s]) J['footUp' + s] = norm(P['u' + s]);
  }
  return J;
}
// Zwei fertige Gelenk-Sätze mischen (t = 0: a, t = 1: b)
function mischJ(a, b, t) {
  const o = {};
  for (const k in b) o[k] = a[k] ? misch3(a[k], b[k], t) : b[k];
  return o;
}

// ---------- Aussehen der anderen Figuren ----------
const TRAINERIN = { skin: 0xeac09a, hair: 0x5a4028, shirt: 0xe86a9a, shorts: 0x27324d, head: 'none', shoes: 0xffffff, racket: 0x202020, model: 'f' };
const PHYSIO = { skin: 0xe2b48c, hair: 0x2b1d14, shirt: 0x2aa6a0, shorts: 0x20262e, head: 'none', shoes: 0xf2f2f2, racket: 0x202020, model: 'd' };
const KOCH = { skin: 0xf0c8a0, hair: 0x3a2a1c, shirt: 0xf6f6f2, shorts: 0x30343c, head: 'none', shoes: 0x202020, racket: 0x202020, model: 'a' };
const KINDER = [
  { skin: 0xf3cfb0, hair: 0xb8935a, shirt: 0xf0c030, shorts: 0x3a5ac8, head: 'cap', model: 'e' },
  { skin: 0xc99872, hair: 0x1a1410, shirt: 0x3aa85a, shorts: 0xf2f2f2, head: 'none', model: 'c' },
  { skin: 0xeac09a, hair: 0x5a4028, shirt: 0xd84a3a, shorts: 0x27324d, head: 'band', model: 'b' },
  { skin: 0xf0c8a0, hair: 0x8a6a45, shirt: 0x8a5ac8, shorts: 0xf2f2f2, head: 'none', model: 'f' },
  { skin: 0xe6ba94, hair: 0x2b1d14, shirt: 0x30b8c0, shorts: 0x30343c, head: 'none', model: 'a' },
];
const REPORTER = [
  { skin: 0xe2b48c, hair: 0x3a2a1c, shirt: 0x4a5568, shorts: 0x20262e, head: 'none', model: 'a' },
  { skin: 0xf3cfb0, hair: 0xb8935a, shirt: 0x7a3a4a, shorts: 0x20262e, head: 'none', model: 'f' },
  { skin: 0xc99872, hair: 0x1a1410, shirt: 0x2e5a48, shorts: 0x20262e, head: 'none', model: 'd' },
];
const sauber = (l) => ({ shoes: 0xffffff, racket: 0x202020, ...l });

// Eine Figur auf der Bühne. setze(P, dt) stellt sie in die Pose P – weich, damit nichts ruckt.
class Puppe {
  constructor(B, look, o = {}) {
    this.av = new Avatar(sauber(look), 0, 1, true);
    if (o.gross) this.av.gross = o.gross;
    if (o.breit) this.av.breit = o.breit;
    this.o = { x: o.x || 0, y: o.y || 0, z: o.z || 0, face: o.face || 0 };
    this.J = null; this.flink = o.flink || 14;
    B.szene.add(this.av.group); B.puppen.push(this);
    this.setze({}, 0);
  }
  setze(P, dt, schlaeger = null) {
    const J = gelenke(P);
    this.J = this.J && dt > 0 ? mischJ(this.J, J, 1 - Math.exp(-dt * this.flink)) : J;
    // P.faust (0 = flache Hand … 1 = Faust) und P.stange (Richtung einer Stange in beiden Händen) gehen an die Hände weiter
    this.av.stelle(this.J, { ...this.o, schlaeger, faust: P.faust, stange: P.stange });
  }
  // Ein Punkt der Figur in der Welt, und umgekehrt: ein Punkt der Welt aus Sicht der Figur
  welt(p) { return this.av.welt(p); }
  zuMir(v) {
    const f = this.o.face, cf = Math.cos(f), sf = Math.sin(f), G = this.av.gross;
    const x = (v.x - this.o.x) / G, y = (v.y - this.o.y) / G, z = (v.z - this.o.z) / G;
    return [x * sf + z * cf, -x * cf + z * sf, y];
  }
}

// ---------- Bauen aus einfachen Formen ----------
// Alles wird in „Figur-Maßen“ gebaut: [vor, seite, hoch]. Die Gruppe wird später so gedreht wie die Figur – dann passt beides zusammen.
const ort = (p) => new THREE.Vector3(-p[1], p[2], p[0]);
function werkzeug(B, gruppe) {
  const material = (farbe, o = {}) => {
    const k = farbe + '|' + (o.rau ?? 0.75) + '|' + (o.metall ?? 0) + '|' + (o.durch ?? 1) + '|' + (o.leucht || 0);
    if (!B.stoffe.has(k)) B.stoffe.set(k, new THREE.MeshStandardMaterial({ color: farbe, roughness: o.rau ?? 0.75, metalness: o.metall ?? 0, transparent: o.durch != null, opacity: o.durch ?? 1, emissive: o.leucht ? farbe : 0x000000, emissiveIntensity: o.leucht || 0 }));
    return B.stoffe.get(k);
  };
  const rein = (geo, farbe, p, o = {}) => {
    const m = new THREE.Mesh(geo, o.stoff || material(farbe, o));
    m.position.copy(ort(p));
    if (o.dreh) m.rotation.set(o.dreh[0] || 0, o.dreh[1] || 0, o.dreh[2] || 0);
    m.castShadow = o.schatten !== false; m.receiveShadow = true;
    (o.in || gruppe).add(m);
    return m;
  };
  return {
    material,
    // Kiste: Farbe, Mitte [vor, seite, hoch], Größe [tief, breit, hoch]
    K: (farbe, p, g, o) => rein(new THREE.BoxGeometry(g[1], g[2], g[0]), farbe, p, o),
    // Rolle: Farbe, Mitte, Radius, Länge, Richtung 'h' (steht), 's' (liegt quer), 'v' (liegt längs)
    Z: (farbe, p, r, lang, achse = 'h', o = {}) => {
      const geo = new THREE.CylinderGeometry(o.oben ?? r, r, lang, o.ecken || 20);
      if (achse === 's') geo.rotateZ(Math.PI / 2); else if (achse === 'v') geo.rotateX(Math.PI / 2);
      return rein(geo, farbe, p, o);
    },
    // Kugel: Farbe, Mitte, Radius
    S: (farbe, p, r, o) => rein(new THREE.SphereGeometry(r, 24, 16), farbe, p, o),
    // Stange von a nach b (zum Beispiel ein Gestell-Rohr)
    R: (farbe, a, b, r, o = {}) => {
      const A = ort(a), Bv = ort(b), geo = new THREE.CylinderGeometry(r, r, A.distanceTo(Bv), o.ecken || 12);
      const m = rein(geo, farbe, [0, 0, 0], o);
      m.position.copy(A).lerp(Bv, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.sub(A).normalize());
      return m;
    },
    gruppe: (in_ = gruppe) => { const g = new THREE.Group(); in_.add(g); return g; },
  };
}
const EISEN = 0x2a2d33, STAHL = 0xb9bec6, GUMMI = 0x17181b, POLSTER = 0x1f3f77, ROT = 0xd8402f, HOLZ = 0xa87b4c, WEISS = 0xf3f1ea;

// Eine Hantelscheibe (liegt quer auf der Stange): Gummi außen, bunter Ring, Stahl in der Mitte
function scheibe(T, in_, s, r, farbe = ROT, dick = 0.045) {
  T.Z(GUMMI, [0, s, 0], r, dick, 's', { in: in_, ecken: 28, rau: 0.9 });
  T.Z(farbe, [0, s + Math.sign(s) * (dick / 2 + 0.001), 0], r * 0.72, 0.004, 's', { in: in_, ecken: 28, rau: 0.5 });
  T.Z(STAHL, [0, s + Math.sign(s) * (dick / 2 + 0.003), 0], r * 0.2, 0.006, 's', { in: in_, metall: 0.8, rau: 0.3 });
}
// Eine Langhantel: Stange 2 m, je Seite zwei Scheiben. Mitte der Gruppe = Mitte der Stange.
function langhantel(T, r = 0.225, farbe = ROT) {
  const g = T.gruppe();
  T.Z(STAHL, [0, 0, 0], 0.014, 2.0, 's', { in: g, metall: 0.85, rau: 0.25 });
  for (const m of [-1, 1]) {
    T.Z(STAHL, [0, m * 0.82, 0], 0.024, 0.36, 's', { in: g, metall: 0.85, rau: 0.3 });
    scheibe(T, g, m * 0.70, r, farbe); scheibe(T, g, m * 0.755, r * 0.8, 0x2f6fd0, 0.035);
    T.Z(STAHL, [0, m * 0.80, 0], 0.035, 0.03, 's', { in: g, metall: 0.8, rau: 0.3 });
  }
  return g;
}
function kurzhantel(T) {
  const g = T.gruppe();
  T.Z(STAHL, [0, 0, 0], 0.014, 0.3, 's', { in: g, metall: 0.85, rau: 0.25 });
  for (const m of [-1, 1]) { T.Z(GUMMI, [0, m * 0.1, 0], 0.075, 0.05, 's', { in: g, ecken: 8, rau: 0.9 }); T.Z(GUMMI, [0, m * 0.15, 0], 0.062, 0.04, 's', { in: g, ecken: 8, rau: 0.9 }); }
  return g;
}

// ---------- Bilder zum Aufkleben (auf einer kleinen Malfläche gemalt) ----------
function gemalt(B, b, h, malen, wdh = null) {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  malen(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (wdh) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(wdh[0], wdh[1]); }
  B.bilder.push(t);
  return t;
}
const holzBoden = (g, b, h) => {
  g.fillStyle = '#b98a58'; g.fillRect(0, 0, b, h);
  for (let i = 0; i < 8; i++) {
    const y = i * h / 8;
    for (let k = 0; k < 3; k++) { const x = ((i * 97 + k * 190) % b); g.fillStyle = `rgba(${90 + (i * 37 + k * 11) % 60},${60 + (i * 13) % 30},30,${0.10 + ((i + k) % 3) * 0.05})`; g.fillRect(x, y, 170, h / 8); }
    g.fillStyle = 'rgba(60,40,20,.5)'; g.fillRect(0, y, b, 2);
    for (let k = 0; k < 3; k++) g.fillRect((i * 97 + k * 190) % b, y, 2, h / 8);
  }
};
const gummiBoden = (g, b, h) => {
  g.fillStyle = '#34373e'; g.fillRect(0, 0, b, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + (i * 53) % 100},${150 + (i * 31) % 100},${160 + (i * 17) % 90},.22)`; g.fillRect((i * 7919) % b, (i * 104729) % h, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, b, h);
};
const fliesen = (hell, fuge) => (g, b, h) => {
  g.fillStyle = hell; g.fillRect(0, 0, b, h); g.strokeStyle = fuge; g.lineWidth = 4; g.strokeRect(0, 0, b, h);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(6, 6, b - 12, h / 2);
};
// Ein Poster: Hintergrund, großes Zeichen, Schrift
const poster = (farbe, zeichen, wort) => (g, b, h) => {
  g.fillStyle = farbe; g.fillRect(0, 0, b, h);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(b * 0.5, h * 0.4, b * 0.34, 0, 7); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `${b * 0.42}px system-ui, sans-serif`; g.fillText(zeichen, b / 2, h * 0.54);
  g.font = `800 ${b * 0.13}px system-ui, sans-serif`; g.fillText(wort, b / 2, h * 0.88);
};

const SZENEN = {};

// ---------- Die Bühne ----------
export class MiniBuehne {
  constructor(renderer) {
    this.renderer = renderer;
    this.szene = null; this.spiel = null;
    this.puppen = []; this.stoffe = new Map(); this.bilder = [];
    this.kamera = new THREE.PerspectiveCamera(28, W / H, 0.1, 120);
    this.strahl = new THREE.Raycaster();
  }

  // Gibt es für dieses Mini-Spiel eine Bühne – und sind die Spielermodelle geladen?
  kann(art) { return !!this.renderer && figureReady() && !!SZENEN[art]; }

  oeffne(art, opt = {}) {
    this.schliesse();
    if (!this.kann(art)) return false;
    try {
      this.szene = new THREE.Scene();
      this.look = opt.look || { skin: 0xeac09a, hair: 0x3a2a1c, shirt: 0x37c3ff, shorts: 0x27324d, head: 'none' };
      this.zeit = 0;
      this.spiel = SZENEN[art](this, opt);
      this.blick(...(this.spiel.kamera || [[0, 1.5, 6.2], [0, 1.0, 0], 26]));
      this.spiel.zeige(this.spiel.anfang || {}, 0);
      return true;
    } catch (e) {
      console.warn('3D-Bühne für das Mini-Spiel geht nicht, es wird in 2D gemalt:', e);
      this.schliesse();
      return false;
    }
  }

  // Kamera: wo sie steht, wohin sie schaut, wie weit ihr Blickwinkel ist (Grad)
  blick(wo, wohin, winkel) {
    const k = this.kamera;
    k.position.set(...wo); k.fov = winkel; k.updateProjectionMatrix();
    k.lookAt(...wohin); k.updateMatrixWorld(true);
    this.blickJetzt = [wo.slice(), wohin.slice(), winkel];
  }
  // … und weich von einer Einstellung zur nächsten fahren
  blickZu(wo, wohin, winkel, dt, flink = 3) {
    const [a, b, c] = this.blickJetzt, t = 1 - Math.exp(-dt * flink);
    this.blick(misch3(a, wo, t), misch3(b, wohin, t), misch(c, winkel, t));
  }

  // Welcher Punkt der Welt liegt unter dem Bildpunkt (px, py)? Gesucht wird auf einer Ebene: { y: Höhe } oder { z: Tiefe }.
  ebene(px, py, e) {
    this.strahl.setFromCamera(new THREE.Vector2(px / W * 2 - 1, 1 - py / H * 2), this.kamera);
    const s = this.strahl.ray, t = e.y != null ? (e.y - s.origin.y) / s.direction.y : (e.z - s.origin.z) / s.direction.z;
    return s.origin.clone().addScaledVector(s.direction, t);
  }
  // … und umgekehrt: Wo im Bild ist dieser Punkt der Welt?
  bildOrt(v) { const p = v.clone().project(this.kamera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; }

  zeige(g, z, dt) {
    if (!this.spiel) return false;
    this.zeit += dt;
    this.spiel.zeige(z || {}, dt);
    const r = this.renderer, pr = r.getPixelRatio(), el = r.domElement, cw = el.width / pr, ch = el.height / pr;
    const w = Math.floor(Math.min(W, cw, ch * W / H)), h = Math.floor(w * H / W);
    r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true);
    r.render(this.szene, this.kamera);
    r.setScissorTest(false);
    g.drawImage(el, 0, el.height - h * pr, w * pr, h * pr, 0, 0, W, H);
    r.setViewport(0, 0, cw, ch);
    return true;
  }

  schliesse() {
    for (const p of this.puppen) p.av.dispose();
    this.puppen = [];
    const eigene = new Set(this.stoffe.values());
    if (this.szene && this.szene.background && this.szene.background.isColor) this.szene.background = null;
    if (this.szene) this.szene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !eigene.has(o.material)) { if (o.material.map && !this.bilder.includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); } });
    for (const m of this.stoffe.values()) m.dispose();
    for (const t of this.bilder) t.dispose();
    this.stoffe.clear(); this.bilder = []; this.szene = null; this.spiel = null;
  }

  // ---------- Licht ----------
  licht(o = {}) {
    const S = this.szene;
    S.add(new THREE.HemisphereLight(o.himmel ?? 0xffffff, o.boden ?? 0x6a6258, o.hell ?? 1.5));
    const sonne = new THREE.DirectionalLight(o.sonne ?? 0xfff2dc, o.stark ?? 2.3);
    sonne.position.set(...(o.von || [3.5, 6, 4.5]));
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(1536, 1536);
    const c = sonne.shadow.camera; c.left = -5; c.right = 5; c.top = 5; c.bottom = -5; c.near = 0.5; c.far = 22;
    sonne.shadow.bias = -0.0006; sonne.shadow.normalBias = 0.03; sonne.shadow.radius = 4;
    S.add(sonne, sonne.target);
    const gegen = new THREE.DirectionalLight(0xbcd4ff, o.gegen ?? 0.5); gegen.position.set(-4, 3, -2); S.add(gegen);
  }

  // ---------- Ein Zimmer: Boden, Rückwand, Seitenwände, Fenster, Poster, Möbel ----------
  raum(o) {
    const S = this.szene, T = werkzeug(this, S);
    S.background = new THREE.Color(o.wand).multiplyScalar(0.55);
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: gemalt(this, 512, 512, o.bodenBild, o.bodenWdh || [8, 6]), roughness: o.bodenRau ?? 0.7 }));
    boden.rotation.x = -Math.PI / 2; boden.position.z = 2; boden.receiveShadow = true; S.add(boden);
    const zw = o.tief ?? -3.2;                                    // dort steht die Rückwand
    T.K(o.wand, [zw - 0.1, 0, 1.8], [0.2, 16, 3.6], { rau: 0.95, schatten: false });
    T.K(o.sockel ?? 0xe8e4da, [zw + 0.02, 0, 0.06], [0.06, 16, 0.12], { schatten: false });
    if (o.streifen) T.K(o.streifen, [zw + 0.012, 0, 1.05], [0.02, 16, 0.5], { rau: 0.9, schatten: false });
    for (const m of [-1, 1]) T.K(o.wand2 ?? o.wand, [zw + 5, m * 6.6, 1.8], [10, 0.2, 3.6], { rau: 0.95, schatten: false });
    // Fenster: heller Kasten mit Rahmen und Sprossen – dahinter „scheint die Sonne“
    for (const [x, b] of o.fenster || []) {
      T.K(0xdff1ff, [zw + 0.02, -x, 2.0], [0.02, b, 1.5], { leucht: 0.85, schatten: false, rau: 1 });
      T.K(0x9fd0a0, [zw + 0.03, -x, 1.55], [0.02, b, 0.6], { leucht: 0.5, schatten: false, rau: 1 });
      for (const s of [-b / 2, 0, b / 2]) T.K(WEISS, [zw + 0.05, -x + s, 2.0], [0.05, 0.06, 1.6], { schatten: false });
      for (const hh of [1.24, 2.0, 2.78]) T.K(WEISS, [zw + 0.05, -x, hh], [0.05, b + 0.06, 0.06], { schatten: false });
      T.K(WEISS, [zw + 0.12, -x, 1.2], [0.22, b + 0.2, 0.04], { schatten: false });
    }
    for (const [x, hh, b, bild] of o.poster || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b, b * 1.35), new THREE.MeshStandardMaterial({ map: gemalt(this, 256, 346, bild), roughness: 0.8 }));
      m.position.set(x, hh, zw + 0.015); S.add(m);
      T.K(0x20242c, [zw + 0.008, -x, hh], [0.012, b + 0.05, b * 1.35 + 0.05], { schatten: false });
    }
    if (o.moebel) { const m = moebelBauen(o.moebel.map((s) => ({ ...s, z: s.z ?? zw + 0.45 }))); m.traverse((k) => { if (k.isMesh) k.castShadow = true; }); S.add(m); }
    this.licht(o.licht);
    return T;
  }

  // ---------- Draußen: der Trainingsplatz mit Zaun, Bande, Netz und Bäumen ----------
  platz(o = {}) {
    const S = this.szene, T = werkzeug(this, S);
    const abend = !!o.abend;
    S.background = gemalt(this, 16, 256, (g, b, h) => { const v = g.createLinearGradient(0, 0, 0, h); if (abend) { v.addColorStop(0, '#31406e'); v.addColorStop(0.55, '#e58a5c'); v.addColorStop(1, '#f6c98a'); } else { v.addColorStop(0, '#3f8fdc'); v.addColorStop(0.6, '#a8d6f5'); v.addColorStop(1, '#e4f2fb'); } g.fillStyle = v; g.fillRect(0, 0, b, h); });
    S.fog = new THREE.Fog(abend ? 0xe9a878 : 0xcfe6f6, 26, 70);
    // Hartplatz: blaues Feld mit weißen Linien, drumherum grün
    const feld = gemalt(this, 1024, 1024, (g, b, h) => {
      g.fillStyle = '#2f7a55'; g.fillRect(0, 0, b, h);
      g.fillStyle = '#2b62a8'; g.fillRect(b * 0.14, 0, b * 0.72, h);
      for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(255,255,255,${0.012 + (i % 5) * 0.006})`; g.fillRect((i * 7919) % b, (i * 104729) % h, 3, 3); }
      g.strokeStyle = '#f4f6f8'; g.lineWidth = 7;
      g.strokeRect(b * 0.14, -20, b * 0.72, h + 40); g.strokeRect(b * 0.23, -20, b * 0.54, h + 40);
      g.beginPath(); g.moveTo(b * 0.23, h * 0.56); g.lineTo(b * 0.77, h * 0.56); g.moveTo(b * 0.5, h * 0.56); g.lineTo(b * 0.5, 0); g.stroke();
    });
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(15.2, 15.2), new THREE.MeshStandardMaterial({ map: feld, roughness: 0.92 }));
    boden.rotation.x = -Math.PI / 2; boden.position.set(0, 0, -2.6); boden.receiveShadow = true; S.add(boden);
    const wiese = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x4f8a4a, roughness: 1 }));
    wiese.rotation.x = -Math.PI / 2; wiese.position.y = -0.02; S.add(wiese);
    // Netz quer über den Platz (hinter den Figuren)
    const zn = -3.0;
    const netz = gemalt(this, 256, 64, (g, b, h) => { g.clearRect(0, 0, b, h); g.strokeStyle = 'rgba(20,24,30,.85)'; g.lineWidth = 1.5; for (let i = 0; i <= b; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); } for (let i = 0; i <= h; i += 8) { g.beginPath(); g.moveTo(0, i); g.lineTo(b, i); g.stroke(); } }, [12, 1]);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(12.8, 0.95), new THREE.MeshBasicMaterial({ map: netz, transparent: true, side: THREE.DoubleSide }));
    nm.position.set(0, 0.5, zn); S.add(nm);
    T.K(WEISS, [zn, 0, 0.985], [0.03, 12.8, 0.06], { rau: 0.8 });
    for (const m of [-1, 1]) T.Z(0x2c5c44, [zn, m * 6.4, 0.54], 0.045, 1.08, 'h');
    // Zaun hinten mit dunkelgrünem Windschutz und einer erfundenen Werbebande
    const zz = -10.2;
    T.K(0x1f4a38, [zz, 0, 1.7], [0.06, 26, 3.4], { rau: 0.95, schatten: false });
    for (let i = -6; i <= 6; i++) T.Z(0x8a9098, [zz + 0.08, i * 2, 1.8], 0.04, 3.6, 'h', { metall: 0.6 });
    const bande = gemalt(this, 2048, 128, (g, b, h) => {
      const woerter = ['POWERSHOT', 'Bergquell Wasser', 'Sonnenhof Hotel', 'Saitenwerk', 'Alpenmilch', 'POWERSHOT', 'Rasenkönig', 'Lindenbäcker'];
      woerter.forEach((w, i) => { const x = i * b / 8; g.fillStyle = ['#12305c', '#f4f6f8', '#1d6b4a', '#e8f04a', '#b8322a', '#12305c', '#f4f6f8', '#2a2f3a'][i]; g.fillRect(x, 0, b / 8, h); g.fillStyle = ['#fff', '#12305c', '#fff', '#12305c', '#fff', '#e8f04a', '#1d6b4a', '#fff'][i]; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(w, x + b / 16, 80, b / 8 - 20); });
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(24, 0.9), new THREE.MeshStandardMaterial({ map: bande, roughness: 0.7 }));
    bm.position.set(0, 0.5, zz + 0.12); S.add(bm);
    for (const m of [-1, 1]) T.K(0x1f4a38, [-3, m * 13, 1.7], [15, 0.06, 3.4], { rau: 0.95, schatten: false });
    // Bäume hinter dem Zaun
    for (let i = 0; i < 11; i++) {
      const x = -15 + i * 3 + (i % 3) * 0.6, hh = 5 + (i * 7 % 4), z = -13.5 - (i % 2) * 2.5;
      T.Z(0x5a4630, [z, x, hh * 0.3], 0.22, hh * 0.6, 'h', { schatten: false });
      T.S([0x2f6a3a, 0x3a7a42, 0x2a5f36][i % 3], [z, x, hh * 0.75], hh * 0.34, { schatten: false, rau: 1 }).scale.set(1, 1.25, 1);
    }
    // Bank, Balleimer und Handtuch am Rand
    if (o.bank !== false) {
      const bx = o.bankX ?? 3.3;
      T.K(HOLZ, [-1.6, -bx, 0.46], [0.42, 1.7, 0.05]); T.K(HOLZ, [-1.82, -bx, 0.78], [0.05, 1.7, 0.28]);
      for (const s of [-0.7, 0.7]) { T.K(EISEN, [-1.62, -bx + s, 0.23], [0.4, 0.05, 0.46]); T.K(EISEN, [-1.82, -bx + s, 0.62], [0.05, 0.05, 0.44]); }
      T.K(0xf2f2f2, [-1.55, -bx - 0.45, 0.5], [0.3, 0.42, 0.04]); T.K(0x2f6fd0, [-1.55, -bx - 0.45, 0.525], [0.3, 0.1, 0.012]);
      const korb = T.gruppe(); korb.position.copy(ort([-1.3, -bx + 1.45, 0]));
      for (let i = 0; i < 4; i++) { const w = i * Math.PI / 2 + 0.78; T.R(STAHL, [Math.cos(w) * 0.2, Math.sin(w) * 0.2, 0], [Math.cos(w) * 0.17, Math.sin(w) * 0.17, 0.62], 0.008, { in: korb, metall: 0.7 }); }
      T.Z(STAHL, [0, 0, 0.62], 0.22, 0.3, 'h', { in: korb, durch: 0.35, metall: 0.6, oben: 0.24, ecken: 14 });
      for (let i = 0; i < 9; i++) T.S(0xd8ee3a, [Math.cos(i * 2.4) * 0.12, Math.sin(i * 2.4) * 0.12, 0.6 + (i % 3) * 0.06], 0.033, { in: korb, rau: 0.95 });
    }
    this.licht({ himmel: abend ? 0xffd9b0 : 0xdff0ff, boden: 0x5a7a56, hell: abend ? 1.25 : 1.5, sonne: abend ? 0xffb070 : 0xfff4dc, stark: abend ? 2.6 : 2.9, von: abend ? [-6, 3.4, 4] : [4, 7, 5], gegen: 0.45 });
    return T;
  }
}

// =====================================================================
// Die Posen
// =====================================================================
const sp = (p) => [p[0], -p[1], p[2]];                         // dieselbe Stelle auf der anderen Körperseite
const SCH = 1.38, ARM = 0.58;                                  // Schulterhöhe im Stehen, Länge des gestreckten Arms
// Locker stehen und atmen
const steh = (t = 0, o = {}) => ({ hip: [0, 0, 0.9 + 0.004 * Math.sin(t * 1.7)], auf: [0.02, 0.012 * Math.sin(t * 0.7), 1], ...o });

// Eine Übung aus einer Aufnahme (assets/lauf.json, von tools/mixamo.mjs): s = 0 (Grundstellung) … 1 (ganz ausgeführt).
// Aus den Gelenken der Aufnahme wird eine Pose, wie die Puppe sie versteht. Fehlt die Aufnahme, kommt null – dann gilt die gebaute Pose.
function ausAufnahme(name, s) {
  const c = mocapClip(name);
  if (!c) return null;
  const m = mocapFrame(c, c.t0 + begrenzen(s, 0, 1) * (c.tEnd - c.t0));
  return { hip: m.hip, auf: minus(m.neck, m.hip), quer: minus(m.shR, m.shL), becken: [0, 0, 1], hquer: minus(m.hipR, m.hipL),
    hR: m.handR, hL: m.handL, eR: minus(m.elR, m.shR), eL: minus(m.elL, m.shL), fR: m.footR, fL: m.footL, kR: minus(m.kneeR, m.hipR), kL: minus(m.kneeL, m.hipL) };
}

// Die vier Übungen beim Warmmachen. s = 0 (Grundstellung) … 1 (ganz ausgeführt), t = Zeit
const WARM = [
  // Hampelmann: Beine auseinander, Arme seitlich über den Kopf
  (s) => { const echt = ausAufnahme('hampel', s); if (echt) return echt; const a = s * 2.8, hR = [0.03, 0.19 + Math.sin(a) * ARM, SCH - Math.cos(a) * ARM]; return { hip: [0, 0, 0.9 - 0.03 * s + 0.07 * Math.sin(s * Math.PI)], fR: [0, 0.13 + 0.27 * s, 0.09 + 0.05 * Math.sin(s * Math.PI)], fL: [0, -0.13 - 0.27 * s, 0.09 + 0.05 * Math.sin(s * Math.PI)], hR, hL: sp(hR), eR: [-0.3, 0.2, 0.3], eL: [-0.3, -0.2, 0.3] }; },
  // Kniebeuge: Po nach hinten unten, Arme nach vorn
  (s) => { const echt = ausAufnahme('hocke', s); if (echt) return echt; const hip = [-0.24 * s, 0, 0.9 - 0.4 * s], auf = norm([0.42 * s, 0, 1]), sh = plus(hip, auf, DIM.shUp); const hR = misch3([sh[0] + 0.07, 0.28, sh[2] - 0.57], [sh[0] + 0.54, 0.2, sh[2] + 0.03], s); return { hip, auf, fR: [0.02, 0.21, 0.09], fL: [0.02, -0.21, 0.09], kR: [1, 0.45, 0.1], kL: [1, -0.45, 0.1], hR, hL: sp(hR) }; },
  // Knie hoch: auf der Stelle laufen, die Knie bis zur Hüfte
  (s, t) => { const k = Math.min(1, s * 3), l = Math.max(0, Math.sin(t * 9)) * k, r = Math.max(0, -Math.sin(t * 9)) * k; return { hip: [0, 0, 0.9 + 0.03 * Math.abs(Math.sin(t * 9)) * k], fL: [0.1 + 0.2 * l, -0.12, 0.09 + 0.5 * l], fR: [0.1 + 0.2 * r, 0.12, 0.09 + 0.5 * r], hR: [0.12 + 0.24 * l - 0.1 * r, 0.24, 0.98 + 0.24 * l], hL: [0.12 + 0.24 * r - 0.1 * l, -0.24, 0.98 + 0.24 * r], eR: [-1, 0.3, -0.3], eL: [-1, -0.3, -0.3] }; },
  // Arme kreisen: beide Arme gestreckt in großen Kreisen
  (s, t) => { const k = Math.min(1, s * 3), w = t * 6, kreis = (w0, m) => misch3([0.07, m * 0.28, SCH - 0.57], [Math.sin(w0) * ARM, m * (0.19 + 0.05), SCH + Math.cos(w0) * ARM], k); return { hR: kreis(w, 1), hL: kreis(w + Math.PI, -1), eR: [-0.3, 0.3, 0.2], eL: [-0.3, -0.3, 0.2] }; },
];

// Die drei Dehnungen
const DEHN = [
  // Ausfallschritt: linkes Bein vorn gebeugt, rechtes Bein weit hinten
  () => ({ hip: [0, 0, 0.56], auf: [0.1, 0, 1], fL: [0.5, -0.13, 0.09], kL: [1, -0.1, 0.4], fR: [-0.74, 0.13, 0.16], kR: [0.3, 0, -1], uR: [0.75, 0, 0.66], hR: [0.1, 0.25, 0.66], hL: [0.1, -0.25, 0.66], eR: [-1, 0.6, 0], eL: [-1, -0.6, 0], blick: [1, 0, 0.05] }),
  // Seitbeuge: Beine breit, rechter Arm im Bogen über den Kopf nach links
  () => ({ hip: [0, 0.03, 0.89], auf: [0, -0.36, 0.93], quer: [0, 0.93, 0.36], becken: [0, 0, 1], hquer: [0, 1, 0], fR: [0, 0.27, 0.09], fL: [0, -0.27, 0.09], hR: [0.03, -0.5, 1.7], eR: [0.1, 0.5, 1], hL: [0.03, -0.3, 0.7], blick: [1, -0.1, 0] }),
  // Vorbeuge: Beine gestreckt, Oberkörper klappt nach unten, Hände zu den Füßen
  () => ({ hip: [-0.13, 0, 0.9], auf: [0.84, 0, -0.54], becken: [0.5, 0, 0.85], fR: [0, 0.11, 0.09], fL: [0, -0.11, 0.09], hR: [0.2, 0.14, 0.14], hL: [0.2, -0.14, 0.14], blick: [0.2, 0, -1], kopfAuf: [1, 0, 0] }),
];

// =====================================================================
// Warmmachen: links die Trainerin, rechts du – auf dem Trainingsplatz
// =====================================================================
SZENEN.nachmachen = (B) => {
  const T = B.platz({ bankX: 4.3 });
  const tr = new Puppe(B, TRAINERIN, { x: -0.95, flink: 18 }), ich = new Puppe(B, B.look, { x: 0.95, flink: 18 });
  // ein paar Hütchen und eine Koordinationsleiter – wie beim echten Aufwärmen
  for (const [x, z] of [[-2.6, 0.9], [-2.1, 1.5], [2.5, 1.2], [3.0, 0.5]]) T.Z(0xff7a2a, [z, -x, 0.11], 0.11, 0.22, 'h', { oben: 0.02, ecken: 14 });
  for (let i = 0; i < 6; i++) T.K(0xe8f04a, [1.9, -(-1.1 + i * 0.44), 0.006], [0.5, 0.03, 0.012], { schatten: false });
  for (const s of [-0.25, 0.25]) T.K(0xe8f04a, [1.9 + s, 0, 0.006], [0.03, 2.24, 0.012], { schatten: false });
  return {
    zeige(z, dt) {
      tr.setze(z.trainer >= 0 ? WARM[z.trainer](z.ts, z.tt) : steh(B.zeit, { blick: [1, 0.25, 0] }), dt);
      ich.setze(z.ich >= 0 ? WARM[z.ich](z.is, z.it) : steh(B.zeit + 1.3, { blick: [1, -0.3, 0.02] }), dt);
    },
  };
};

// =====================================================================
// Ball hochhalten: Du hältst den Schläger flach, der Ball springt darauf
// =====================================================================
// Die Rechnung läuft in minispiele.js in Bildpunkten. Hier wird jeder Bildpunkt auf eine Scheibe im Raum gelegt (z = ZB),
// damit Ball und Schläger in 3D genau dort sind, wo das Spiel sie rechnet.
SZENEN.hochhalten = (B) => {
  const T = B.platz({ bankX: 4.6 }), ZB = 0.3;
  const ich = new Puppe(B, B.look, { z: -0.12, flink: 30 });
  const ball = T.S(0xd8ee3a, [0, 0, 1.5], 0.043, { rau: 0.95 });
  const schatten = T.Z(0x000000, [ZB, 0, 0.012], 0.06, 0.004, 'h', { durch: 0.3, schatten: false });
  let fx = 0;
  return {
    kamera: [[0, 1.617, 7.3], [0, 1.617, 0.3], 14.7],
    zeige(z, dt) {
      const k = B.ebene(z.x ?? W / 2, 440, { z: ZB });
      fx = dt > 0 ? misch(fx, k.x - 0.33, 1 - Math.exp(-dt * 12)) : k.x - 0.33;      // der Körper kommt dem Schläger einen Moment später nach
      ich.o.x = fx;
      const b = z.ball ? B.ebene(z.ball.x, z.ball.y, { z: ZB }) : new THREE.Vector3(k.x, 1.6, ZB);
      ball.position.copy(b); ball.rotation.x += dt * 5;
      schatten.position.set(b.x, 0.012, ZB);
      const hand = ich.zuMir(new THREE.Vector3(k.x - 0.49, k.y, ZB));
      const zumBall = ich.zuMir(b);
      ich.setze({ hip: [0, begrenzen((fx - (k.x - 0.33)) * 0.5, -0.12, 0.12), 0.88], auf: [0.1, 0, 1], hR: hand, eR: [-0.5, 0.6, -1], hL: [0.2, -0.32, 1.02], eL: [-0.6, -0.5, -0.6], blick: norm(minus(zumBall, [0.1, 0, 1.62])) }, dt, { d: [0, -1, 0], n: [0, 0, 1] });
    },
  };
};

// =====================================================================
// Krafttraining: fünf Geräte im Kraftraum
// =====================================================================
// Jede Übung baut ihr Gerät in „Figur-Maßen“ und sagt für p = 0 (unten) … 1 (oben), wie die Figur gerade aussieht.
SZENEN.kraft = (B) => {
  B.raum({
    wand: 0x4a5266, wand2: 0x434a5c, streifen: 0xd84a3a, bodenBild: gummiBoden, bodenWdh: [16, 12], bodenRau: 0.9, fenster: [[4.2, 1.6]],
    poster: [[-5.0, 2.1, 0.9, poster('#b8322a', '💪', 'KRAFT')], [1.3, 2.25, 0.8, poster('#1d4f8a', '🎾', 'TEAM')]],
    moebel: [{ art: 'spiegel', x: -2.9 }, { art: 'hantelregal', x: -0.6 }, { art: 'sprossen', x: 2.5 }, { art: 'gymbaelle', x: 5.4 }, { art: 'rad', x: -4.6, z: -1.6, dreh: 0.7 }, { art: 'wasser', x: 6.4 }],
    licht: { hell: 1.35, stark: 2.4, von: [3, 6, 5] },
  });
  const ich = new Puppe(B, B.look, { flink: 40 });
  const station = (face, x, z) => { const g = new THREE.Group(); g.rotation.y = face; g.position.set(x, 0, z); g.visible = false; B.szene.add(g); return { g, T: werkzeug(B, g), face, x, z }; };
  const matte = (S, lang = 2.2, breit = 1.5) => S.T.K(0x23262c, [0.1, 0, 0.012], [lang, breit, 0.024], { rau: 0.95 });
  const U = [];

  // --- Bankdrücken ---
  { const S = station(Math.PI / 2 - 0.5, -0.45, 0.5), T = S.T; matte(S, 2.3, 1.6);
    T.K(POLSTER, [0, 0, 0.44], [1.3, 0.3, 0.085], { rau: 0.6 }); T.K(EISEN, [0, 0, 0.385], [1.2, 0.08, 0.05]);
    for (const v of [-0.5, 0.52]) { T.K(EISEN, [v, 0, 0.19], [0.06, 0.06, 0.38]); T.K(EISEN, [v, 0, 0.03], [0.07, 0.56, 0.05]); }
    for (const m of [-1, 1]) { T.K(EISEN, [-0.5, m * 0.56, 0.6], [0.06, 0.06, 1.2]); T.K(EISEN, [-0.5, m * 0.56, 0.03], [0.5, 0.07, 0.05]); T.K(STAHL, [-0.44, m * 0.56, 1.02], [0.1, 0.05, 0.03], { metall: 0.7 }); T.K(STAHL, [-0.4, m * 0.56, 1.05], [0.02, 0.05, 0.08], { metall: 0.7 }); }
    T.K(EISEN, [-0.5, 0, 0.3], [0.05, 1.12, 0.05]);
    const hantel = langhantel(T);
    U.push({ S, pose: (p) => ({ faust: 0.9, stange: [0, 1, 0], hip: [0.25, 0, 0.585], auf: [-1, 0, 0], hR: [-0.22, 0.34, 0.81 + 0.36 * p], hL: [-0.22, -0.34, 0.81 + 0.36 * p], eR: [0.25, 1, -0.5], eL: [0.25, -1, -0.5], fR: [0.8, 0.25, 0.09], fL: [0.8, -0.25, 0.09], kR: [0.3, 0.3, 1], kL: [0.3, -0.3, 1], blick: [0, 0, 1], kopfAuf: [-1, 0, 0] }),
      nach(J) { hantel.position.copy(ort(plus(misch3(J.handR, J.handL, 0.5), [0, 0, 0.03]))); } }); }

  // --- Kreuzheben ---
  { const S = station(Math.PI / 2 - 0.62, -0.4, 0.5), T = S.T; matte(S, 1.5, 2.5);
    for (const m of [-1, 1]) T.K(HOLZ, [0.16, m * 0.72, 0.03], [0.6, 0.5, 0.03]);
    const hantel = langhantel(T);
    U.push({ S, pose: (p) => { const q = weich(p); return { faust: 0.9, stange: [0, 1, 0], hip: misch3([-0.31, 0, 0.56], [0, 0, 0.9], q), auf: norm(misch3([0.8, 0, 0.6], [0.02, 0, 1], q)), hR: [0.17, 0.27, misch(0.26, 0.8, q)], hL: [0.17, -0.27, misch(0.26, 0.8, q)], fR: [0, 0.15, 0.09], fL: [0, -0.15, 0.09], kR: [1, 0.3, 0.1], kL: [1, -0.3, 0.1], blick: norm([1, 0, misch(-0.25, 0, q)]) }; },
      nach(J) { const m = misch3(J.handR, J.handL, 0.5); hantel.position.copy(ort([m[0] + 0.01, 0, Math.max(0.225, m[2] - 0.02)])); } }); }

  // --- Kniebeuge mit Stange ---
  { const S = station(Math.PI / 2 - 0.8, -0.4, 0.4), T = S.T; matte(S, 1.8, 1.8);
    for (const m of [-1, 1]) { T.K(EISEN, [-0.42, m * 0.62, 0.95], [0.07, 0.07, 1.9]); T.K(EISEN, [-0.2, m * 0.62, 0.03], [0.9, 0.08, 0.05]); T.R(EISEN, [-0.42, m * 0.62, 0.9], [0.2, m * 0.62, 0.04], 0.02); T.K(STAHL, [-0.35, m * 0.62, 1.42], [0.12, 0.05, 0.03], { metall: 0.7 }); T.K(ROT, [-0.1, m * 0.62, 0.55], [0.6, 0.05, 0.05]); }
    T.K(EISEN, [-0.42, 0, 1.88], [0.07, 1.3, 0.07]);
    const hantel = langhantel(T);
    let stange = [0, 0, 1.45];
    U.push({ S, pose: (p) => { const q = weich(p), hip = misch3([-0.27, 0, 0.5], [0, 0, 0.9], q), auf = norm(misch3([0.52, 0, 0.86], [0.03, 0, 1], q)), vor = [auf[2], 0, -auf[0]]; stange = plus(plus(hip, auf, 0.56), vor, -0.115); return { faust: 0.9, stange: [0, 1, 0], hip, auf, hR: plus(stange, [0.03, 0.4, -0.03]), hL: plus(stange, [0.03, -0.4, -0.03]), eR: [-0.2, 0.25, -1], eL: [-0.2, -0.25, -1], fR: [0.02, 0.23, 0.09], fL: [0.02, -0.23, 0.09], kR: [1, 0.55, 0.1], kL: [1, -0.55, 0.1], blick: [1, 0, 0.05] }; },
      nach() { hantel.position.copy(ort(stange)); } }); }

  // --- Beinpresse ---
  { const S = station(Math.PI / 2 + 0.55, -1.0, 0.9), T = S.T; matte(S, 2.6, 1.5);
    const dir = norm([0.87, 0, 0.5]), auf = norm([-0.62, 0, 0.78]), hip = [0, 0, 0.43];
    T.K(POLSTER, [0.09, 0, 0.31], [0.5, 0.48, 0.1], { dreh: [0.22, 0, 0], rau: 0.6 });
    T.K(POLSTER, [-0.345, 0, 0.67], [0.09, 0.48, 0.78], { dreh: [-0.672, 0, 0], rau: 0.6 });
    T.K(POLSTER, [-0.66, 0, 1.1], [0.1, 0.26, 0.2], { dreh: [-0.672, 0, 0], rau: 0.6 });
    for (const m of [-1, 1]) {
      T.R(EISEN, [0.1, m * 0.42, 0.1], [1.75, m * 0.42, 1.05], 0.035);                       // die schrägen Schienen
      T.R(EISEN, [1.75, m * 0.42, 0], [1.75, m * 0.42, 1.08], 0.035); T.R(EISEN, [-0.7, m * 0.42, 0.05], [1.8, m * 0.42, 0.05], 0.03);
      T.R(EISEN, [-0.62, m * 0.3, 0.05], [-0.6, m * 0.3, 0.95], 0.03); T.R(STAHL, [0.0, m * 0.33, 0.3], [0.02, m * 0.33, 0.47], 0.016, { metall: 0.7 }); T.Z(GUMMI, [0.02, m * 0.33, 0.49], 0.022, 0.12, 'v');
    }
    T.K(EISEN, [1.75, 0, 1.06], [0.07, 0.9, 0.07]); T.K(EISEN, [-0.62, 0, 0.05], [0.07, 0.66, 0.06]);
    const schlitten = T.gruppe(), basis = plus(hip, dir, 0.55);
    T.K(STAHL, [0, 0, 0.04], [0.04, 0.62, 0.56], { in: schlitten, dreh: [-Math.PI / 6, 0, 0], metall: 0.5, rau: 0.4 });
    T.K(GUMMI, [-0.012, 0, 0.03], [0.03, 0.56, 0.5], { in: schlitten, dreh: [-Math.PI / 6, 0, 0], rau: 0.95 });
    T.K(EISEN, [0.06, 0, -0.05], [0.1, 0.9, 0.1], { in: schlitten, dreh: [-Math.PI / 6, 0, 0] });
    for (const m of [-1, 1]) { const h = T.gruppe(schlitten); h.position.copy(ort([0.1, 0, 0.0])); for (let i = 0; i < 3; i++) scheibe(T, h, m * (0.5 + i * 0.05), 0.2 - i * 0.012, i % 2 ? 0x2f6fd0 : ROT); }
    U.push({ S, pose: (p) => { const d = 0.46 + 0.3 * p, f = plus(hip, dir, d); return { hip, auf, fR: plus(f, [0, 0.14, 0.03]), fL: plus(f, [0, -0.14, 0.03]), uR: mal(dir, -1), uL: mal(dir, -1), kR: [0.2, 0.35, 1], kL: [0.2, -0.35, 1], hR: [0.03, 0.33, 0.5], hL: [0.03, -0.33, 0.5], eR: [-1, 0.3, 0.2], eL: [-1, -0.3, 0.2], blick: norm([0.8, 0, 0.5]) }; },
      nach(J, p) { schlitten.position.copy(ort(plus(basis, dir, 0.3 * p))); } }); }

  // --- Schulterdrücken mit Kurzhanteln (im Sitzen) ---
  { const S = station(0.55, -0.4, 0.5), T = S.T; matte(S, 1.6, 1.6);
    T.K(POLSTER, [-0.02, 0, 0.44], [0.42, 0.4, 0.09], { rau: 0.6 }); T.K(POLSTER, [-0.25, 0, 0.82], [0.08, 0.36, 0.62], { dreh: [-0.1, 0, 0], rau: 0.6 });
    T.K(EISEN, [-0.05, 0, 0.2], [0.07, 0.07, 0.4]); T.K(EISEN, [-0.05, 0, 0.03], [0.6, 0.5, 0.05]); T.K(EISEN, [-0.28, 0, 0.6], [0.05, 0.06, 1.0], { dreh: [-0.1, 0, 0] });
    const hR = kurzhantel(T), hL = kurzhantel(T);
    U.push({ S, pose: (p) => { const q = weich(p), h = [misch(0.08, 0.03, q), misch(0.37, 0.25, q), misch(1.12, 1.6, q)]; return { faust: 0.9, hip: [0, 0, 0.575], auf: [-0.04, 0, 1], hR: h, hL: sp(h), eR: [0.1, 1, -0.5], eL: [0.1, -1, -0.5], fR: [0.42, 0.2, 0.09], fL: [0.42, -0.2, 0.09], kR: [0.3, 0.2, 1], kL: [0.3, -0.2, 1], blick: [1, 0, 0.03] }; },
      nach(J) { hR.position.copy(ort(plus(J.handR, [0, 0, 0.02]))); hL.position.copy(ort(plus(J.handL, [0, 0, 0.02]))); } }); }

  let alt = -1;
  return {
    kamera: [[2.1, 1.6, 5.3], [-0.05, 0.85, 0.3], 27],
    zeige(z, dt) {
      const nr = z.ue ?? 0, u = U[nr], p = begrenzen(z.p ?? 0, 0, 1);
      if (nr !== alt) { U.forEach((x, i) => { x.S.g.visible = i === nr; }); ich.o = { x: u.S.x, y: 0, z: u.S.z, face: u.S.face }; ich.J = null; alt = nr; }
      // ganz oben zittern die Arme ein wenig – das Gewicht ist schwer
      const P = u.pose(p), zit = Math.sin(B.zeit * 38) * 0.004 * weich((p - 0.8) * 5);
      if (zit) { P.hR = plus(P.hR, [zit, 0, 0]); P.hL = plus(P.hL, [-zit, 0, 0]); }
      ich.setze(P, dt);
      u.nach(ich.J, p);
    },
  };
};

// =====================================================================
// Massage: Du liegst auf der Liege, die Physiotherapeutin lockert die harten Stellen
// =====================================================================
SZENEN.massage = (B) => {
  B.raum({
    wand: 0xd6e6e2, wand2: 0xc8dcd8, streifen: 0x2aa6a0, sockel: 0xf6f6f2, bodenBild: fliesen('#e9e6de', '#c9c4b8'), bodenWdh: [16, 12], bodenRau: 0.5, tief: -2.3, fenster: [[-3.3, 1.5]],
    poster: [[2.6, 2.15, 0.85, poster('#1f6f66', '🦵', 'MUSKELN')]],
    moebel: [{ art: 'schrank', x: 4.3 }, { art: 'regal', x: 0.9 }, { art: 'pflanze', x: -5.0 }, { art: 'hocker', x: -1.6, z: -1.3 }, { art: 'eiswanne', x: -6.0, z: -0.6, dreh: 1.57 }],
    licht: { hell: 1.7, stark: 1.9, von: [2.5, 6, 3.5] },
  });
  // Die Liege (in Figur-Maßen gebaut; die Figur liegt mit dem Kopf nach links)
  const g = new THREE.Group(); g.rotation.y = -Math.PI / 2; B.szene.add(g);
  const T = werkzeug(B, g);
  T.K(0x1f6f66, [-0.3, 0, 0.68], [1.75, 0.72, 0.09], { rau: 0.55 }); T.K(0x1f6f66, [0.78, 0, 0.7], [0.4, 0.5, 0.08], { rau: 0.55, dreh: [-0.08, 0, 0] });
  T.K(0xf6f6f2, [0.74, 0, 0.75], [0.3, 0.34, 0.05], { rau: 0.9 });
  T.Z(0xf6f6f2, [-0.98, 0, 0.78], 0.07, 0.6, 's', { rau: 0.95 });                             // Handtuchrolle unter den Füßen
  T.K(0x8a9098, [-0.3, 0, 0.6], [1.7, 0.6, 0.06], { metall: 0.5 });
  for (const v of [-1.0, 0.7]) for (const m of [-1, 1]) T.R(0xb9bec6, [v, m * 0.28, 0.6], [v + (v < 0 ? 0.08 : -0.08), m * 0.33, 0.0], 0.022, { metall: 0.7 });
  const ich = new Puppe(B, B.look, { face: -Math.PI / 2 });
  const lage = { hip: [-0.25, 0, 0.835], auf: [1, 0, 0], fR: [-1.06, 0.13, 0.86], fL: [-1.06, -0.13, 0.86], kR: [0, 0.1, -1], kL: [0, -0.1, -1], uR: [0.8, 0, -0.6], uL: [0.8, 0, -0.6], hR: [0.0, 0.43, 0.79], hL: [0.0, -0.43, 0.79], eR: [0.2, 1, 0.1], eL: [0.2, -1, 0.1], blick: [0.15, -1, -0.25], kopfAuf: [1, 0, 0] };
  ich.setze(lage, 0);
  const physio = new Puppe(B, PHYSIO, { x: 0.05, z: -0.52, flink: 22 });
  // Wo die neun Stellen am Körper sind (gleiche Reihenfolge wie STELLEN in minispiele.js)
  const mitte = (a, b, t = 0.5) => misch3(a, b, t), hoch = (p, h) => plus(p, [0, 0, h]);
  const stellen3 = () => { const J = ich.J; return [hoch(J.neck, 0.07), hoch(J.shL, 0.08), hoch(J.shR, 0.08), hoch(mitte(J.hip, J.neck, 0.62), 0.12), hoch(mitte(J.hip, J.neck, 0.18), 0.11), hoch(mitte(J.hipL, J.kneeL), 0.09), hoch(mitte(J.hipR, J.kneeR), 0.09), hoch(mitte(J.kneeL, J.footL, 0.45), 0.07), hoch(mitte(J.kneeR, J.footR, 0.45), 0.07)]; };
  return {
    kamera: [[0, 3.25, 2.75], [0, 0.82, -0.08], 29],
    stellen() { return stellen3().map((p) => B.bildOrt(ich.welt(p))); },
    zeige(z, dt) {
      ich.setze({ ...lage, hip: [-0.25, 0, 0.835 + 0.004 * Math.sin(B.zeit * 1.5)] }, dt);
      // Die Hände der Physiotherapeutin folgen deinem Finger; sonst warten sie über der nächsten harten Stelle
      let ziel = null;
      if (z.zeiger) ziel = B.ebene(z.zeiger[0], z.zeiger[1], { y: 0.99 });
      else if (z.wo) ziel = B.ebene(z.wo[0], z.wo[1], { y: 1.08 });
      const P = { hip: [0, 0, 0.92], auf: [0.5, 0, 0.87], fR: [-0.05, 0.16, 0.09], fL: [-0.05, -0.16, 0.09] };
      if (ziel) { const h = physio.zuMir(ziel); P.hR = plus(h, [0, 0.07, 0]); P.hL = plus(h, [0.02, -0.09, 0.01]); P.blick = norm(minus(h, [0.3, 0, 1.6])); P.auf = norm([0.5, begrenzen(h[1] * 0.25, -0.2, 0.2), 0.87]); }
      else { P.hR = [0.42, 0.16, 1.05]; P.hL = [0.42, -0.16, 1.05]; P.blick = [0.6, 0, -0.8]; }
      physio.setze(P, dt);
    },
  };
};

// =====================================================================
// Buffet: Das Essen fährt auf dem Band vorbei, vorn steht dein Tablett
// =====================================================================
SZENEN.buffet = (B) => {
  const T = B.raum({
    wand: 0xe9dcc6, wand2: 0xdccdb4, streifen: 0x9a3a36, bodenBild: holzBoden, bodenWdh: [5, 4], bodenRau: 0.55, fenster: [[-4.4, 1.7], [4.4, 1.7]],
    poster: [[0, 2.3, 0.8, poster('#2f7a3f', '🥗', 'GUTES ESSEN')]],
    moebel: [{ art: 'kuehlschrank', x: -2.2 }, { art: 'regal', x: 2.1 }, { art: 'pflanze', x: 6.0 }, { art: 'pflanze', x: -6.2 }],
    licht: { hell: 1.6, stark: 2.0, von: [2, 6, 4] },
  });
  B.blick([0, 2.55, 3.5], [0, 0.95, 0.0], 30);
  const HT = 0.93, band0 = B.ebene(W / 2, 256, { y: HT }), tab0 = B.ebene(W / 2, 452, { y: HT });
  // Theke mit dem Band
  const vorn = tab0.z + 0.32, hinten = band0.z - 0.42;
  T.K(0x7a5636, [(vorn + hinten) / 2, 0, HT / 2 - 0.03], [vorn - hinten, 11, HT - 0.06], { rau: 0.6 });
  T.K(0xf0ece2, [(vorn + hinten) / 2, 0, HT - 0.03], [vorn - hinten + 0.06, 11, 0.045], { rau: 0.35 });
  const laufBild = gemalt(B, 256, 64, (g, b, h) => { g.fillStyle = '#3b4252'; g.fillRect(0, 0, b, h); g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(0, 0, 8, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, b, 5); g.fillRect(0, h - 5, b, 5); }, [22, 1]);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.5), new THREE.MeshStandardMaterial({ map: laufBild, roughness: 0.6 }));
  band.rotation.x = -Math.PI / 2; band.position.set(0, HT + 0.001, band0.z); band.receiveShadow = true; B.szene.add(band);
  for (const m of [-1, 1]) T.K(STAHL, [band0.z + m * 0.27, 0, HT + 0.012], [0.04, 11, 0.03], { metall: 0.7, rau: 0.3 });
  // Glasscheibe hinter dem Band und Wärmelampen darüber
  T.K(0xcfe8f4, [band0.z - 0.34, 0, HT + 0.28], [0.02, 11, 0.5], { durch: 0.25, rau: 0.1, schatten: false });
  for (let i = -3; i <= 3; i++) { T.R(STAHL, [band0.z - 0.1, i * 1.4, 2.6], [band0.z - 0.1, i * 1.4, 1.95], 0.012, { metall: 0.7, schatten: false }); T.Z(0xd8732a, [band0.z - 0.1, i * 1.4, 1.88], 0.17, 0.16, 'h', { oben: 0.05, schatten: false }); T.S(0xfff0c0, [band0.z - 0.1, i * 1.4, 1.83], 0.05, { leucht: 1.2, schatten: false }); }
  // Dein Tablett
  T.K(0x8a5a3a, [tab0.z, -tab0.x, HT + 0.012], [0.42, 1.78, 0.02], { rau: 0.5 });
  T.K(0x6e452a, [tab0.z, -tab0.x, HT + 0.004], [0.46, 1.82, 0.012], { rau: 0.5 });
  // Teller und Essen: ein Vorrat, der immer wieder benutzt wird
  const essenBild = new Map();
  const bildVon = (zeichen) => {
    if (!essenBild.has(zeichen)) essenBild.set(zeichen, gemalt(B, 128, 128, (g) => { g.clearRect(0, 0, 128, 128); g.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(zeichen, 64, 70); }));
    return essenBild.get(zeichen);
  };
  const tellerGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.022, 28), tellerStoff = T.material(0xfbfaf6, { rau: 0.3 });
  const mache = (r = 1) => {
    const g = new THREE.Group(), t = new THREE.Mesh(tellerGeo, tellerStoff); t.scale.setScalar(r); t.castShadow = true; t.receiveShadow = true;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); s.scale.setScalar(0.33 * r); s.position.y = 0.14 * r;
    g.add(t, s); g.visible = false; B.szene.add(g);
    return { g, s, zeige(zeichen, v) { g.visible = !!zeichen; if (zeichen) { g.position.copy(v); if (s.material.map !== bildVon(zeichen)) { s.material.map = bildVon(zeichen); s.material.needsUpdate = true; } } } };
  };
  const aufBand = Array.from({ length: 12 }, () => mache()), aufTablett = Array.from({ length: 5 }, () => mache(0.85));
  // Der Koch hinter der Theke
  const koch = new Puppe(B, KOCH, { x: 2.3, z: hinten - 0.45, flink: 5 });
  const muetze = new THREE.Group(); B.szene.add(muetze);
  const TM = werkzeug(B, muetze); TM.Z(0xfdfdfb, [0, 0, 0.07], 0.105, 0.14, 'h', { rau: 0.9 }); TM.S(0xfdfdfb, [0, 0, 0.17], 0.135, { rau: 0.9 }).scale.set(1, 0.6, 1);
  return {
    zeige(z, dt) {
      laufBild.offset.x = (z.lauf || 0) * 22 / 11 * (band0.x - B.ebene(W / 2 - 1, 256, { y: HT }).x);       // das Band läuft so schnell wie die Teller
      const liste = z.band || [];
      aufBand.forEach((t, i) => { const b = liste[i]; t.zeige(b && b[1], b && B.ebene(b[0], 256, { y: HT + 0.012 })); });
      const meins = z.teller || [];
      aufTablett.forEach((t, i) => t.zeige(meins[i], B.ebene(W / 2 - 5 * 45 + 45 + i * 90, 452, { y: HT + 0.035 })));
      const w = Math.sin(B.zeit * 0.6);
      koch.setze({ hip: [0, 0.03 * w, 0.9], auf: [0.06, 0.02 * w, 1], hR: [0.36, 0.2, 0.99], hL: [0.36, -0.2, 0.99], blick: norm([1, 0.5 * w, -0.35]) }, dt);
      muetze.position.copy(koch.welt(plus(koch.J.neck, [0.02, 0, 0.27])));
    },
  };
};

// =====================================================================
// Besaitungsmaschine: erst von oben ganz nah (flechten), dann von der Seite (spannen)
// =====================================================================
SZENEN.bespannen = (B) => {
  const T = B.raum({
    wand: 0x5b5470, wand2: 0x4f4962, streifen: 0x6a4ac8, bodenBild: holzBoden, bodenWdh: [5, 4], bodenRau: 0.6, tief: -2.4, fenster: [[-4.0, 1.5]],
    poster: [[3.6, 2.2, 0.8, poster('#6a4ac8', '🎾', 'SAITEN')]],
    moebel: [{ art: 'schlaegerwand', x: 1.6 }, { art: 'werkbank', x: -1.5 }, { art: 'rollen', x: 4.6 }, { art: 'regal', x: -5.2 }],
    licht: { hell: 1.5, stark: 2.3, von: [2, 6, 3] },
  });
  const NAH = [[0, 2.36, 0.56], [0, 1.05, 0.12], 26], HR = 1.05, QUER = 6, LAENGS = 8, A = 0.118, Bh = 0.158, DX = 0.026, DZ = 0.04;
  B.blick(...NAH);
  const C = B.ebene(330, 250, { y: HR });                                  // dort ist die Mitte des Schlägerkopfs (wie im 2D-Bild)
  const WEIT = [[C.x + 1.55, 2.0, C.z + 2.5], [C.x + 0.22, 1.08, C.z - 0.05], 30];
  const g = new THREE.Group(); g.position.set(C.x, 0, C.z); B.szene.add(g);
  const M = werkzeug(B, g);                                               // hier gilt: [vor, seite, hoch] mit vor = zur Kamera, seite = nach links
  // Der Schläger: Rahmen als Rohr um eine Ellipse, Herz, Griff
  const rahmenFarbe = typeof B.look.racket === 'number' && B.look.racket !== 0x202020 ? B.look.racket : 0xe8c82a;
  const rund = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => { const w = i / 40 * Math.PI * 2; return new THREE.Vector3(Math.sin(w) * (A + 0.01), HR, Math.cos(w) * (Bh + 0.01)); }), true);
  const rahmen = new THREE.Mesh(new THREE.TubeGeometry(rund, 80, 0.0105, 10, true), M.material(rahmenFarbe, { rau: 0.35 })); rahmen.castShadow = true; g.add(rahmen);
  for (const m of [-1, 1]) M.R(rahmenFarbe, [Bh - 0.02, m * 0.075, HR], [Bh + 0.17, m * 0.012, HR], 0.009, { rau: 0.35 });
  M.Z(rahmenFarbe, [Bh + 0.2, 0, HR], 0.014, 0.08, 'v', { rau: 0.35 }); M.Z(0xf4f4f0, [Bh + 0.33, 0, HR], 0.0165, 0.2, 'v', { rau: 0.9, ecken: 8 }); M.Z(0x20242c, [Bh + 0.435, 0, HR], 0.019, 0.012, 'v', { ecken: 8 });
  // Längssaiten (weiß) – die sind schon drin
  const halbLang = (dx) => Bh * Math.sqrt(Math.max(0, 1 - (dx / A) ** 2)), halbBreit = (dz) => A * Math.sqrt(Math.max(0, 1 - (dz / Bh) ** 2));
  const lx = (i) => (i - (LAENGS - 1) / 2) * DX, qz = (r) => (r - (QUER - 1) / 2) * DZ;
  const saiteWeiss = M.material(0xf6f6f2, { rau: 0.5 }), saiteOrange = M.material(0xffa22e, { rau: 0.5 });
  for (let i = 0; i < LAENGS; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.0024, 2 * halbLang(lx(i))), saiteWeiss); m.position.set(lx(i), HR, 0); g.add(m); }
  // Quersaiten (orange): für jede Kreuzung ein kleines Stück, das über oder unter der Längssaite liegt
  const stuecke = [];
  for (let r = 0; r < QUER; r++) {
    const w = halbBreit(qz(r)); stuecke.push([]);
    for (let i = 0; i < LAENGS; i++) {
      const xa = i === 0 ? -w : lx(i) - DX / 2, xb = i === LAENGS - 1 ? w : lx(i) + DX / 2, oben = (r + i) % 2 === 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.0024, 0.0026), saiteOrange); m.position.set((xa + xb) / 2, HR + (oben ? 0.0026 : -0.0026), qz(r)); m.visible = false; g.add(m);
      stuecke[r].push(m);
    }
  }
  // das lose Ende der Saite, das du gerade durchfädelst
  const lose = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 1, 6), saiteOrange); B.szene.add(lose);
  // Die Maschine: Säule, Drehtisch mit zwei Haltern, vier Seitenstützen, rechts der Spannkopf mit Hebel
  M.Z(0x3a3f4a, [0.02, 0, 0.02], 0.3, 0.04, 'h', { ecken: 28 }); M.Z(0x596070, [0.02, 0, 0.47], 0.05, 0.9, 'h', { metall: 0.4 });
  M.K(0x3a3f4a, [0.03, 0, 0.93], [0.62, 0.09, 0.05], { metall: 0.3 }); M.K(0x3a3f4a, [0.03, -0.2, 0.91], [0.12, 0.62, 0.05], { metall: 0.3 });
  for (const v of [-Bh - 0.035, Bh + 0.045]) { M.K(0x596070, [v, 0, 0.99], [0.03, 0.05, 0.1], { metall: 0.4 }); M.K(0xe04a3a, [v + (v < 0 ? 0.012 : -0.012), 0, HR], [0.02, 0.06, 0.03], { rau: 0.5 }); }
  for (const v of [-0.075, 0.075]) for (const m of [-1, 1]) { M.K(0x596070, [v, m * (A + 0.045), 0.985], [0.025, 0.03, 0.1], { metall: 0.4 }); M.K(0x20242c, [v, m * (A + 0.026), HR], [0.03, 0.014, 0.026], { rau: 0.9 }); M.K(0x3a3f4a, [v, m * 0.1, 0.945], [0.03, 0.2, 0.03]); }
  const kopf = M.gruppe(); kopf.position.copy(ort([0.0, -0.5, 0]));
  M.K(0x2a2f3a, [0, 0, 0.99], [0.15, 0.2, 0.12], { in: kopf, rau: 0.5 }); M.K(0x101520, [0.076, 0, 1.0], [0.004, 0.13, 0.06], { in: kopf, leucht: 0 });
  M.K(0x43e07a, [0.079, 0.02, 1.0], [0.002, 0.07, 0.025], { in: kopf, leucht: 1.0, schatten: false });
  M.Z(0xb9bec6, [0, 0.11, HR], 0.012, 0.05, 's', { in: kopf, metall: 0.8, rau: 0.3 });                     // hier wird die Saite eingeklemmt
  const hebel = M.gruppe(kopf); hebel.position.copy(ort([0, -0.04, 1.05]));
  M.R(0xb9bec6, [0, 0, 0], [0, -0.26, 0.1], 0.011, { in: hebel, metall: 0.8, rau: 0.3 }); M.S(0xe04a3a, [0, -0.27, 0.105], 0.028, { in: hebel, rau: 0.4 });
  const zug = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 1, 6), saiteOrange); B.szene.add(zug);     // die Saite vom Schläger zum Spannkopf
  const ich = new Puppe(B, B.look, { x: C.x - 0.03, z: C.z - 0.52, flink: 16 });
  const zwischen = (mesh, a, b) => { mesh.position.copy(a).lerp(b, 0.5); mesh.scale.set(1, Math.max(0.001, a.distanceTo(b)), 1); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); };
  const kreuzung = (r, i) => new THREE.Vector3(C.x + lx(i), HR, C.z + qz(r));
  let weit = 0;
  return {
    kreuz(r, i) { return B.bildOrt(kreuzung(Math.min(r, QUER - 1), Math.min(i, LAENGS - 1))); },
    zeige(z, dt) {
      const spannen = z.teil === 'spannen', reihe = z.reihe || 0, nr = z.nr || 0;
      weit = begrenzen(weit + (spannen ? dt : -dt) / 1.2, 0, 1);
      const k = weich(weit);
      B.blick(misch3(NAH[0], WEIT[0], k), misch3(NAH[1], WEIT[1], k), misch(NAH[2], WEIT[2], k));
      for (let r = 0; r < QUER; r++) for (let i = 0; i < LAENGS; i++) stuecke[r][i].visible = spannen || r < reihe || (r === reihe && i < nr);
      const P = { hip: [0, 0, 0.93], auf: [0.44, 0, 0.9], fR: [-0.02, 0.17, 0.09], fL: [-0.02, -0.17, 0.09] };
      if (!spannen) {
        // Die linke Hand (im Bild rechts) zieht das lose Ende der Saite am Rahmen entlang – mal höher (drüber), mal tiefer (drunter).
        // Die rechte Hand hält den Rahmen fest. So bleibt der Blick auf die Saiten frei.
        const r = Math.min(reihe, QUER - 1), w = halbBreit(qz(r)), ziel = kreuzung(r, Math.min(nr, LAENGS - 1));
        const oben = (r + nr) % 2 === 0, hand = new THREE.Vector3(C.x + A + 0.075, HR + (oben ? 0.05 : 0.012) + 0.005 * Math.sin(B.zeit * 7), C.z + qz(r) + 0.01);
        const start = nr > 0 ? new THREE.Vector3(C.x + lx(nr - 1) + DX / 2, HR, C.z + qz(r)) : new THREE.Vector3(C.x - w, HR, C.z + qz(r));
        lose.visible = true; zwischen(lose, start, hand.clone().add(new THREE.Vector3(-0.03, 0, 0)));
        zug.visible = false;
        P.hL = plus(ich.zuMir(hand), [0.03, -0.05, 0.02]); P.hR = ich.zuMir(new THREE.Vector3(C.x - A - 0.07, HR + 0.03, C.z - 0.02)); P.blick = norm(minus(ich.zuMir(ziel), [0.25, 0, 1.6]));
      } else {
        // Spannen: Die linke Hand zieht den Hebel herunter, je mehr Kilogramm, desto weiter
        const winkel = begrenzen(((z.kg ?? 8) - 8) / 27, 0, 1) * 0.9;
        hebel.rotation.z = winkel;
        hebel.updateWorldMatrix(true, false);
        const griff = new THREE.Vector3(0.27, 0.105, 0).applyMatrix4(hebel.matrixWorld);
        lose.visible = false; zug.visible = true;
        zwischen(zug, new THREE.Vector3(C.x + A, HR, C.z), new THREE.Vector3(C.x + 0.39, HR, C.z));
        P.hL = plus(ich.zuMir(griff), [0, 0, 0.03]); P.hR = ich.zuMir(new THREE.Vector3(C.x - A - 0.03, HR + 0.05, C.z + 0.03)); P.blick = norm([0.7, -0.5, -0.5]);
        P.auf = [0.36, -0.1, 0.92];
      }
      ich.setze(P, dt);
    },
  };
};

// =====================================================================
// Autogramme: Die Kinder stehen an der Absperrung, eines hält dir etwas ganz nah hin
// =====================================================================
// Die Sachen werden in Bildpunkten gebaut (wie im 2D-Bild) und dann auf die richtige Größe verkleinert –
// so liegt das weiße Feld zum Unterschreiben genau auf der Sache.
SZENEN.autogramm = (B) => {
  const T = B.platz({ bank: false });
  B.blick([0, 1.25, 5.2], [0, 1.2, 0], 30);
  // Absperrgitter
  for (let i = -3; i <= 3; i++) { T.Z(STAHL, [0.42, i * 1.2, 0.5], 0.02, 1.0, 'h', { metall: 0.7 }); T.K(0x3a3f4a, [0.42, i * 1.2, 0.02], [0.4, 0.08, 0.04]); }
  for (const h of [0.98, 0.2]) T.Z(STAHL, [0.42, 0, h], 0.018, 7.4, 's', { metall: 0.7 });
  for (let i = -17; i <= 17; i++) T.Z(STAHL, [0.42, i * 0.2 + 0.1, 0.59], 0.007, 0.78, 'h', { metall: 0.7, ecken: 6, schatten: false });
  const kinder = KINDER.map((l, i) => new Puppe(B, l, { x: -1.7 + i * 0.85, z: -0.02 - (i % 2) * 0.12, gross: [0.7, 0.98, 0.64, 0.9, 0.74, 0.68][i % 6], flink: 12 }));
  // Die Sachen (Reihenfolge wie SACHEN in minispiele.js)
  const ZS = 3.75, mitte = B.ebene(W / 2, H / 2, { z: ZS }), k = mitte.distanceTo(B.ebene(W / 2 + 100, H / 2, { z: ZS })) / 100;
  const halter = new THREE.Group(); halter.position.copy(mitte); halter.scale.setScalar(k * 1.22); B.szene.add(halter);
  const stoff = (f, rau = 0.7) => T.material(f, { rau });
  const P = (x, y, zz = 0) => new THREE.Vector3(x - 450, 270 - y, zz);
  const naht = (r) => { const pts = Array.from({ length: 60 }, (_, i) => { const t = i / 60 * Math.PI * 2, a = 0.72, b = 0.28; return new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), 2 * Math.sqrt(a * b) * Math.sin(2 * t)).normalize().multiplyScalar(r * 1.004); }); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, r * 0.028, 6, true), stoff(0xfafaf4, 0.9)); m.rotation.set(0.5, 0.2, 0.9); return m; };
  const ballBauen = (r, y) => { const g = new THREE.Group(), s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), stoff(0xd3ea34, 0.95)); g.add(s, naht(r)); g.position.copy(P(450, y, -r * 0.92)); return g; };
  const bauer = [
    () => ballBauen(190, 265),
    () => { const g = new THREE.Group(); const kuppel = new THREE.Mesh(new THREE.SphereGeometry(190, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), stoff(0x2a5ac8, 0.85)); const schirm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 12, 40), stoff(0x1f478f, 0.8)); schirm.scale.set(215, 1, 150); schirm.position.set(0, -4, 120); const knopf = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 8), stoff(0xffffff)); knopf.position.y = 190; const rand = new THREE.Mesh(new THREE.TorusGeometry(190, 7, 8, 40), stoff(0x1f478f)); rand.rotation.x = Math.PI / 2; g.add(kuppel, schirm, knopf, rand); g.position.copy(P(450, 300, -150)); g.rotation.x = 0.28; return g; },
    () => { const g = new THREE.Group(); const blatt = new THREE.Mesh(new THREE.BoxGeometry(360, 380, 6), stoff(0xffffff, 0.6)); const foto = new THREE.Mesh(new THREE.PlaneGeometry(320, 235), new THREE.MeshStandardMaterial({ roughness: 0.5, map: gemalt(B, 320, 235, (c, b, h) => { const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#4f9ee0'); v.addColorStop(0.7, '#bfe0f6'); c.fillStyle = v; c.fillRect(0, 0, b, h); c.fillStyle = '#2b62a8'; c.fillRect(0, h * 0.7, b, h * 0.3); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h * 0.82); c.lineTo(b, h * 0.82); c.stroke(); c.strokeStyle = '#e8b48a'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(150, 170); c.lineTo(160, 200); c.moveTo(172, 170); c.lineTo(168, 200); c.moveTo(150, 110); c.lineTo(118, 80); c.moveTo(172, 112); c.lineTo(200, 128); c.stroke(); c.strokeStyle = '#37c3ff'; c.lineWidth = 26; c.beginPath(); c.moveTo(161, 110); c.lineTo(161, 158); c.stroke(); c.fillStyle = '#e8b48a'; c.beginPath(); c.arc(161, 84, 15, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 5; c.beginPath(); c.ellipse(104, 60, 15, 20, 0.5, 0, 7); c.stroke(); c.fillStyle = '#d8ee3a'; c.beginPath(); c.arc(70, 40, 7, 0, 7); c.fill(); }) })); foto.position.set(0, 52, 3.5); g.add(blatt, foto); g.position.copy(P(450, 270, 0)); g.rotation.set(-0.06, 0.05, 0.02); return g; },
    () => { const s = new THREE.Shape(); const pkt = [[320, 90], [200, 150], [240, 230], [310, 200], [310, 470], [590, 470], [590, 200], [660, 230], [700, 150], [580, 90]]; pkt.forEach(([x, y], i) => (i ? s.lineTo(x - 450, 270 - y) : s.moveTo(x - 450, 270 - y))); s.quadraticCurveTo(0, 270 - 150, 320 - 450, 270 - 90); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 18, bevelEnabled: true, bevelSize: 6, bevelThickness: 6, bevelSegments: 3 }), stoff(0xe8503a, 0.9)); const g = new THREE.Group(); const kragen = new THREE.Mesh(new THREE.TorusGeometry(62, 9, 8, 30, Math.PI), stoff(0xc03a28, 0.9)); kragen.rotation.z = Math.PI; kragen.position.set(0, 270 - 100, 24); g.add(m, kragen); g.position.z = -20; return g; },
    () => { const g = new THREE.Group(); const deckel = new THREE.Mesh(new THREE.BoxGeometry(380, 410, 22), stoff(0x3a4a6a, 0.7)); const seite = new THREE.Mesh(new THREE.BoxGeometry(340, 370, 8), stoff(0xf4f2ec, 0.9)); seite.position.set(10, 0, 13); g.add(deckel, seite); for (let i = 0; i < 7; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 3.2, 8, 20), T.material(0xa8aeb8, { metall: 0.8, rau: 0.3 })); ring.rotation.y = Math.PI / 2; ring.position.set(-170, 150 - i * 52, 12); g.add(ring); } g.position.copy(P(450, 275, -12)); g.rotation.set(-0.05, -0.04, 0); return g; },
    () => ballBauen(105, 265),
  ];
  const sachen = bauer.map((f) => { const g = f(); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); g.visible = false; halter.add(g); return g; });
  return {
    zeige(z, dt) {
      const nr = z.sache ?? 0, schieb = z.schieb || 0, dran = (z.nr || 0) % kinder.length;
      sachen.forEach((g, i) => { g.visible = i === nr; });
      halter.position.set(mitte.x + schieb * k, mitte.y, mitte.z);
      kinder.forEach((kd, i) => {
        const t = B.zeit * (2.2 + i * 0.3) + i * 1.7, ich = i === dran, hupf = ich ? Math.abs(Math.sin(B.zeit * 6)) * 0.07 : Math.max(0, Math.sin(t * 0.9)) * 0.03;
        const P0 = { hip: [0, 0, 0.9 + hupf], fR: [0, 0.12, 0.09 + hupf], fL: [0, -0.12, 0.09 + hupf], blick: norm([1, (0 - kd.o.x) * 0.25, 0.12]) };
        if (ich) { P0.hR = [0.5, 0.14, 1.36]; P0.hL = [0.5, -0.14, 1.36]; }                       // hält dir etwas hin
        else if (i % 2) { P0.hR = [0.12, 0.3 + 0.12 * Math.sin(t * 2.4), 1.86]; P0.eR = [0, 1, -0.3]; }     // winkt
        else { P0.hR = [0.34, 0.2, 1.42 + 0.05 * Math.sin(t * 2)]; P0.hL = [0.34, -0.2, 1.42 + 0.05 * Math.sin(t * 2 + 1)]; }   // streckt die Arme übers Gitter
        kd.setze(P0, dt);
      });
    },
  };
};

// =====================================================================
// Dehnen: auf der Matte am Platz, abends nach dem Match
// =====================================================================
SZENEN.dehnen = (B) => {
  const T = B.platz({ abend: true, bankX: 3.6 });
  T.K(0x2f8f7a, [0, 0, 0.012], [2.1, 0.8, 0.024], { rau: 0.9, dreh: [0, 0.75, 0] });
  T.Z(0x2a6fd0, [0.5, -1.3, 0.11], 0.035, 0.22, 'h'); T.Z(0xf2f2f2, [0.5, -1.3, 0.235], 0.014, 0.03, 'h');       // Trinkflasche
  const ich = new Puppe(B, B.look, { face: 0.75, flink: 5 });
  return {
    kamera: [[0, 1.3, 5.7], [0, 0.92, 0], 26],
    zeige(z, dt) {
      const m = z.m || 0;
      ich.setze({ ...DEHN[Math.min(z.nr || 0, DEHN.length - 1)]() }, dt);
      ich.av.group.rotation.z = -m * 0.17;                                // du wackelst: Die ganze Figur kippt ein wenig um die Füße
      ich.av.group.rotation.x = Math.sin(B.zeit * 9) * 0.006 * Math.abs(m);
    },
  };
};

// =====================================================================
// Pressekonferenz: Du sitzt am Tisch vor der Sponsorenwand, vorn sitzen die Reporter
// =====================================================================
const sitz = (o = {}) => ({ hip: [0, 0, 0.53], auf: [0.04, 0, 1], fR: [0.4, 0.15, 0.09], fL: [0.4, -0.15, 0.09], kR: [0.3, 0.2, 1], kL: [0.3, -0.2, 1], ...o });
SZENEN.presse = (B) => {
  const T = B.raum({ wand: 0x16284a, wand2: 0x1b2f55, sockel: 0x0f1b33, bodenBild: fliesen('#3a4258', '#2c3346'), bodenWdh: [16, 12], bodenRau: 0.7, tief: -1.9, licht: { hell: 1.25, stark: 2.3, von: [1.5, 5, 6] } });
  // Sponsorenwand (alles erfunden)
  const wand = gemalt(B, 1024, 512, (g, b, h) => { g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, b, h); const w = ['POWERSHOT OPEN', 'Bergquell', 'Saitenwerk', 'Sonnenhof']; for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) { const x = c * 205 + (r % 2) * 100 - 40, y = r * 86 + 52, i = (r + c * 3) % 4; g.fillStyle = ['#12305c', '#1d6b4a', '#6a4ac8', '#b8322a'][i]; g.font = `800 ${i ? 30 : 26}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(w[i], x + 100, y); if (!i) { g.fillStyle = '#c8de2a'; g.beginPath(); g.arc(x - 16, y - 9, 11, 0, 7); g.fill(); } } });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), new THREE.MeshStandardMaterial({ map: wand, roughness: 0.8 })); wm.position.set(0, 1.6, -1.78); B.szene.add(wm);
  // Tisch mit Tuch, Mikrofonen, Flasche und Namensschild
  T.K(0x1d3f7a, [0.02, 0, 0.39], [0.75, 3.2, 0.78], { rau: 0.9 }); T.K(0x244a8c, [0.02, 0, 0.785], [0.8, 3.26, 0.02], { rau: 0.85 });
  for (const s of [-0.2, 0.16]) { T.R(EISEN, [0.25, s, 0.8], [0.12, s * 0.7, 1.0], 0.008); T.Z(GUMMI, [0.25, s, 0.805], 0.045, 0.012, 'h'); T.S(0x30343c, [0.1, s * 0.66, 1.02], 0.032, { rau: 1 }); }
  T.Z(0x8fd0f0, [0.2, 0.55, 0.9], 0.03, 0.2, 'h', { durch: 0.6, rau: 0.1 }); T.Z(0x2a6fd0, [0.2, 0.55, 1.01], 0.014, 0.025, 'h');
  T.K(0xf6f6f2, [0.34, -0.55, 0.84], [0.02, 0.3, 0.09], { dreh: [-0.3, 0, 0] });
  T.K(0x30343c, [-0.62, 0, 0.45], [0.45, 0.48, 0.05]); T.K(0x30343c, [-0.84, 0, 0.75], [0.05, 0.48, 0.6]);       // dein Stuhl
  const ich = new Puppe(B, B.look, { z: -0.6, flink: 8 });
  // Reporter von hinten, auf Stühlen
  const leute = REPORTER.map((l, i) => { const x = [-1.62, -0.72, 1.42][i], z = 2.1 + (i % 2) * 0.3; T.K(0x20242c, [z + 0.02, -x, 0.44], [0.42, 0.44, 0.04]); T.K(0x20242c, [z + 0.22, -x, 0.7], [0.04, 0.44, 0.5]); for (const a of [-0.18, 0.18]) for (const c of [-0.16, 0.2]) T.Z(0x8a9098, [z + c, -x + a, 0.22], 0.012, 0.44, 'h', { metall: 0.6 }); return new Puppe(B, l, { x, z, face: Math.PI, flink: 6 }); });
  const blitz = new THREE.PointLight(0xffffff, 0, 9); blitz.position.set(0, 1.5, 2.6); B.szene.add(blitz);
  let bT = 1.5, an = 0;
  return {
    kamera: [[0.55, 1.78, 5.3], [0.05, 0.98, 0], 24],
    zeige(z, dt) {
      const t = B.zeit, red = z.spricht ? 1 : 0;
      ich.setze(sitz({ auf: [0.1 + 0.03 * Math.sin(t * 1.3), 0.02 * Math.sin(t * 0.9), 1], hR: red ? [0.42 + 0.06 * Math.sin(t * 5), 0.2 + 0.08 * Math.sin(t * 3.1), 1.0 + 0.07 * Math.sin(t * 4.3)] : [0.42, 0.14, 0.83], hL: [0.42, -0.16, 0.83], eR: [-0.3, 1, -0.5], eL: [-0.3, -1, -0.5], blick: norm([1, 0.25 * Math.sin(t * 0.5), -0.04]) }), dt);
      leute.forEach((r, i) => {
        const fragt = !red && z.fragt === i;
        r.setze(sitz({ auf: [0.08, 0.03 * Math.sin(t * 0.8 + i * 2), 1], hR: fragt ? [0.15, 0.25, 1.62 + 0.03 * Math.sin(t * 6)] : [0.3, 0.12, 0.72], eR: fragt ? [0.3, 1, -0.4] : undefined, hL: [0.32, -0.1, 0.7], blick: [1, -(0 - r.o.x) * -0.2, 0.03] }), dt);
      });
      // Blitzlicht der Fotografen
      bT -= dt; an -= dt;
      if (bT <= 0) { bT = 0.6 + Math.random() * 2.2; an = 0.07; blitz.position.x = (Math.random() - 0.5) * 3; }
      blitz.intensity = an > 0 ? 40 : 0;
    },
  };
};

// =====================================================================
// Tennis-Quiz: Die Trainerin steht an der Taktik-Tafel, du sitzt auf der Bank
// =====================================================================
SZENEN.quiz = (B) => {
  const T = B.raum({ wand: 0x3f5a7a, wand2: 0x385170, streifen: 0xe8f04a, bodenBild: holzBoden, bodenWdh: [5, 4], tief: -1.7, fenster: [[4.6, 1.5]], poster: [[-4.4, 2.1, 0.8, poster('#1d6b4a', '🏆', 'WISSEN')]], moebel: [{ art: 'pflanze', x: -3.0 }, { art: 'regal', x: 6.3 }], licht: { hell: 1.5, stark: 2.1, von: [2.5, 6, 5] } });
  // Die Tafel mit einem Tennisplatz und Pfeilen
  const tafel = gemalt(B, 512, 384, (g, b, h) => { g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, b, h); g.strokeStyle = '#1d6b4a'; g.lineWidth = 5; g.strokeRect(130, 40, 250, 304); g.strokeRect(160, 40, 190, 304); g.beginPath(); g.moveTo(160, 112); g.lineTo(350, 112); g.moveTo(160, 272); g.lineTo(350, 272); g.moveTo(255, 112); g.lineTo(255, 272); g.stroke(); g.strokeStyle = '#222'; g.lineWidth = 6; g.beginPath(); g.moveTo(118, 192); g.lineTo(392, 192); g.stroke(); g.strokeStyle = '#d8402f'; g.lineWidth = 5; g.setLineDash([12, 8]); g.beginPath(); g.moveTo(300, 330); g.quadraticCurveTo(200, 200, 185, 70); g.stroke(); g.setLineDash([]); g.fillStyle = '#d8402f'; g.beginPath(); g.moveTo(185, 58); g.lineTo(172, 84); g.lineTo(200, 82); g.fill(); g.fillStyle = '#2f6fd0'; g.beginPath(); g.arc(300, 330, 11, 0, 7); g.fill(); g.font = '700 30px system-ui, sans-serif'; g.fillText('?', 430, 80); g.fillText('!', 60, 300); });
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.275), new THREE.MeshStandardMaterial({ map: tafel, roughness: 0.4 })); tm.position.set(-0.25, 1.5, -1.57); B.szene.add(tm);
  T.K(0xb9bec6, [-1.6, 0.25, 1.5], [0.04, 1.78, 1.36], { metall: 0.5, schatten: false }); T.K(0xb9bec6, [-1.53, 0.25, 0.84], [0.1, 1.5, 0.03], { metall: 0.5 });
  // Bank
  T.K(HOLZ, [-0.45, -1.75, 0.45], [0.42, 1.5, 0.05]); for (const s of [-0.6, 0.6]) T.K(EISEN, [-0.45, -1.75 + s, 0.22], [0.38, 0.05, 0.44]);
  const tr = new Puppe(B, TRAINERIN, { x: -1.5, z: -0.85, face: 0.35, flink: 6 }), ich = new Puppe(B, B.look, { x: 1.75, z: -0.45, face: -0.5, flink: 7 });
  return {
    kamera: [[0.2, 1.4, 4.9], [0.1, 1.08, 0], 24],
    zeige(z, dt) {
      const t = B.zeit, gut = z.stimmung === 'gut', schlecht = z.stimmung === 'schlecht';
      tr.setze(steh(t, { hR: z.stimmung ? [0.3, 0.2, 1.25] : [0.2, -0.38 + 0.03 * Math.sin(t * 2), 1.55], eR: [-0.4, 0.4, -1], hL: gut ? [0.3, -0.2, 1.25] : [0.12, -0.3, 0.95], blick: z.stimmung ? [1, -0.9, 0] : [1, -0.4 + 0.3 * Math.sin(t * 0.7), 0] }), dt);
      ich.setze(sitz({ auf: schlecht ? [0.3, 0, 0.95] : [0.08, 0, 1], hR: gut ? [0.2, 0.25, 1.62 + 0.05 * Math.sin(t * 9)] : z.denkt ? [0.2, 0.02, 1.2] : [0.38, 0.16, 0.66], eR: gut ? [0.2, 1, -0.2] : [-0.2, 0.6, -1], hL: [0.38, -0.16, 0.66], blick: schlecht ? [0.7, 0, -0.7] : [1, 0.5, 0.08] }), dt);
    },
  };
};
