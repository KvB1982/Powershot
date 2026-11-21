// Powershot – die Besucher auf dem Turniergelände. Sie sind selbst gebaut und bewegen sich wirklich:
// Sie gehen mit Armen und Beinen, bleiben stehen, schauen sich um, unterhalten sich oder tippen auf dem Handy.
//
// So geht das, ohne dass das iPad ins Schwitzen kommt: Jeder Besucher besteht aus 15 einfachen Teilen
// (Bauch, Kopf, Oberarm, Unterschenkel …). Alle Bäuche zusammen sind EINE Form, die ganz oft gezeichnet wird
// (InstancedMesh), alle Köpfe auch und so weiter. Für die Bewegung gibt es EIN unsichtbares Gelenk-Gerüst.
// Es wird für jeden Besucher kurz in seine Haltung gebogen, dann merkt sich jedes Teil, wo es hingehört.
//
// Seit 21.11.2026 sehen die Besucher wie echte Menschen aus: sieben Menschen aus MakeHuman (CC0, assets/besucher/b1.glb … b7.glb,
// siehe assets/QUELLEN_MENSCHEN.md). Auch sie haben im Spiel keine Knochen – jeder ist vorher in 13 Haltungen „gebacken“ worden
// (acht Bilder eines Doppelschritts, Stehen, Handy, Foto, Hände in den Hüften, Reden; tools/mensch/menge.mjs).
// Das Spiel zeigt für jeden Besucher immer die Form, die gerade passt. Bis die Dateien geladen sind, bei Qualität „niedrig“
// und mit ?altebesucher in der Adresse laufen die einfachen Figuren aus 15 Teilen herum.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { frei, naechsteFreie, weg } from './wege.js';

// ---- Zahlen zum Einstellen ----
const SCHRITT = 1.3;           // so viele Meter kommt ein Erwachsener mit einem Doppelschritt (links + rechts) voran
const BEIN_SCHWUNG = 0.37;     // so weit schwingt das Bein vor und zurück (im Bogenmaß, 0.37 ≈ 21 Grad)
const KNIE_BEUGE = 0.95;       // so stark knickt das Knie, wenn das Bein nach vorn schwingt
const ARM_SCHWUNG = 0.38;      // so weit schwingen die Arme mit
const WIPPEN = 0.022;          // so viele Meter geht der Körper bei jedem Schritt auf und ab
const DREH_TEMPO = 5;          // so schnell dreht sich jemand in seine Laufrichtung
const STEH_ZEIT = [5, 24];     // so lange bleibt jemand stehen, bevor er weitergeht (Sekunden, von … bis)
const PLAUDER_ZEIT = [18, 60]; // Leute, die sich unterhalten, bleiben länger

const HAUT = [0xf1c9a5, 0xe3b48c, 0xc8956c, 0x9a6a44, 0x6e4a30, 0xf6d7bd];
const HAAR = [0x1c1612, 0x3a2a1c, 0x5a3e24, 0x8a6a3a, 0xc8a868, 0xb8b4ae, 0x7a3a1e, 0xe8e2d8];
const HEMD = [0xf4f2ec, 0xf4f2ec, 0x24365a, 0x9cc0e4, 0xd8483c, 0x2e7a52, 0xf0d87a, 0xe8a8b8, 0x3a3e46, 0xdcd6c6, 0x4a8ac8, 0xf0f0f0, 0x8a2e3a, 0x6ab0a0];
const HOSE = [0xd8cdb4, 0x2a3450, 0x4a6a94, 0xf0eee8, 0x6a6e74, 0x3a3a3e, 0x8a7a5a, 0x5a6a4a];
const SCHUH = [0xf2f2f2, 0xf2f2f2, 0x2a2a2e, 0x6a4a30, 0x3a4a7a, 0xc84a3a];
const HUT = [0xf4f0e6, 0x24365a, 0xd8483c, 0xe8d8a8, 0x2e2e32, 0xd8c8a0];

// ---- Die Menschen aus MakeHuman ----
const MAENNER = ['b1', 'b2', 'b3'], FRAUEN = ['b4', 'b5', 'b6'], KIND = 'b7';
const OHNE_FARBE = ['b4'];     // diese tragen fertig bunte Kleidung; bei allen anderen ist das Hemd weiß und bekommt bei jedem Besucher eine andere Farbe
const SCHRITT_BILDER = 8;      // die ersten acht Formen jeder Datei sind ein Doppelschritt, danach kommen:
const STEH = 8, HANDY = 9, FOTO = 10, HUEFTEN = 11, REDEN = 12;
const MENSCH_GROSS = 1.75 / 1.78;      // die Menschen sind 1,78 m groß gebaut, die Größe 1 der Besucher bedeutet 1,75 m
const ALTE_BESUCHER = typeof location !== 'undefined' && /[?&]altebesucher/.test(location.search);
let menschen = null;
// Lädt die sieben Dateien (nur einmal). Ergebnis: { b1: { bilder: [13 Formen], map }, … } oder null, wenn etwas fehlt.
function ladeMenschen() {
  if (!menschen) menschen = Promise.all([...MAENNER, ...FRAUEN, KIND].map((name) => new GLTFLoader().loadAsync(`assets/besucher/${name}.glb`).then((gltf) => {
    const bilder = []; let map = null;
    gltf.scene.traverse((o) => { if (o.isMesh) { bilder.push(o.geometry); map = o.material.map; } });
    return [name, { bilder, map }];
  }))).then((alle) => Object.fromEntries(alle)).catch((e) => { console.warn('Besucher-Menschen konnten nicht geladen werden:', e); return null; });
  return menschen;
}

const zwischen = (a, b, t) => a + (b - a) * t;
const klemm = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- Die 15 Formen. Jede hat ihren Nullpunkt genau im Gelenk und zeigt von dort nach unten (oder oben). ----
function formen() {
  const zyl = (oben, unten, lang, ecken = 7) => new THREE.CylinderGeometry(oben, unten, lang, ecken, 1).translate(0, -lang / 2, 0);
  const rumpf = mergeGeometries([
    new THREE.CylinderGeometry(0.205, 0.165, 0.4, 10, 1).scale(1, 1, 0.64).translate(0, 0.26, 0),                 // Brust und Bauch
    new THREE.SphereGeometry(0.205, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.34, 0.64).translate(0, 0.46, 0),   // runde Schultern
  ]);
  const becken = new THREE.CylinderGeometry(0.168, 0.172, 0.24, 10, 1).scale(1, 1, 0.68).translate(0, -0.01, 0);
  const rock = new THREE.CylinderGeometry(0.165, 0.27, 0.46, 10, 1, true).scale(1, 1, 0.8).translate(0, -0.15, 0);
  const kopf = mergeGeometries([
    new THREE.SphereGeometry(0.105, 10, 8).scale(0.92, 1.14, 1).translate(0, 0.19, 0.01),
    new THREE.CylinderGeometry(0.045, 0.052, 0.1, 6, 1).translate(0, 0.05, 0),                                  // Hals
  ]);
  const haarKurz = new THREE.SphereGeometry(0.112, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(0.94, 1.14, 1.02).rotateX(-0.42).translate(0, 0.195, 0.004);
  const haarLang = mergeGeometries([
    new THREE.SphereGeometry(0.114, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.96, 1.14, 1.04).rotateX(-0.38).translate(0, 0.195, 0.002),
    new THREE.CylinderGeometry(0.1, 0.085, 0.24, 8, 1, false, Math.PI * 0.5, Math.PI).scale(1, 1, 0.9).translate(0, 0.1, -0.03),   // fällt hinten über den Nacken
  ]);
  const kappe = mergeGeometries([
    new THREE.SphereGeometry(0.115, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.95, 0.9, 1.04).translate(0, 0.235, 0.008),
    new THREE.BoxGeometry(0.15, 0.012, 0.12).translate(0, 0.24, 0.15),                                           // der Schirm
  ]);
  const sonnenhut = mergeGeometries([
    new THREE.CylinderGeometry(0.085, 0.108, 0.09, 10, 1).translate(0, 0.295, 0.005),
    new THREE.CylinderGeometry(0.21, 0.22, 0.014, 14, 1).translate(0, 0.252, 0.005),                              // die breite Krempe
  ]);
  const rucksack = new THREE.BoxGeometry(0.26, 0.34, 0.13).translate(0, 0.27, -0.17);
  const fuss = mergeGeometries([new THREE.BoxGeometry(0.088, 0.065, 0.2).translate(0, -0.048, 0.05), new THREE.BoxGeometry(0.08, 0.045, 0.07).translate(0, -0.058, 0.17)]);
  return {
    rumpf, becken, rock, kopf, haarKurz, haarLang, kappe, sonnenhut, rucksack,
    oarm: zyl(0.056, 0.045, 0.29, 7), uarm: zyl(0.043, 0.034, 0.25, 7), hand: new THREE.SphereGeometry(0.043, 6, 5).scale(0.8, 1.25, 1).translate(0, -0.05, 0),
    osch: zyl(0.09, 0.064, 0.44, 8), usch: zyl(0.061, 0.043, 0.43, 8), fuss,
  };
}

// ---- Das Gelenk-Gerüst (unsichtbar): wie eine Gliederpuppe ----
function geruest() {
  const k = (eltern, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.position.set(x, y, z); if (eltern) eltern.add(o); return o; };
  const wurzel = k(null);
  const huefte = k(wurzel, 0, 0.94, 0);
  const rumpf = k(huefte, 0, 0.06, 0);
  const kopf = k(rumpf, 0, 0.5, 0);
  const seite = (s) => {
    const schulter = k(rumpf, 0.215 * s, 0.44, 0), ellbogen = k(schulter, 0, -0.29, 0), hand = k(ellbogen, 0, -0.25, 0);
    const bein = k(huefte, 0.092 * s, -0.02, 0), knie = k(bein, 0, -0.44, 0), fuss = k(knie, 0, -0.43, 0);
    return { schulter, ellbogen, hand, bein, knie, fuss };
  };
  return { wurzel, huefte, rumpf, kopf, l: seite(-1), r: seite(1) };
}

export class Besucher {
  // plan = Lageplan · gitter = wo man laufen kann · n = wie viele · schatten = werfen sie Schatten?
  constructor(plan, gitter, n, schatten = true) {
    this.plan = plan; this.gitter = gitter; this.n = n; this.schatten = schatten;
    this.echt = null;        // die Menschen aus MakeHuman, sobald sie geladen sind (siehe menschenBauen)
    this.gruppe = new THREE.Group();
    this.g = geruest();
    this.zeit = 0;
    let z = 4711;
    const zf = this.zf = () => { z = (z * 16807) % 2147483647; return z / 2147483647; };
    const aus = (liste) => liste[Math.floor(zf() * liste.length)];

    // Die Formen: Arme, Beine, Hände und Füße gibt es doppelt (links und rechts)
    const F = formen(), stoff = new THREE.MeshLambertMaterial({ color: 0xffffff }), offen = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.teil = {};
    for (const [name, geo] of Object.entries(F)) {
      const doppelt = ['oarm', 'uarm', 'hand', 'osch', 'usch', 'fuss'].includes(name);
      const m = new THREE.InstancedMesh(geo, name === 'rock' ? offen : stoff, doppelt ? n * 2 : n);
      m.frustumCulled = false;                       // die Besucher stehen überall – nachrechnen, ob man sie sieht, lohnt nicht
      m.castShadow = schatten && !['hand', 'haarKurz', 'haarLang', 'kappe', 'sonnenhut', 'fuss'].includes(name);
      m.userData.eigen = true;
      this.teil[name] = m;
      this.gruppe.add(m);
    }
    const nichts = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color();
    for (const m of Object.values(this.teil)) for (let i = 0; i < m.count; i++) m.setMatrixAt(i, nichts);      // erst einmal unsichtbar (auf Größe 0 geschrumpft)
    const farbe = (name, i, hex) => this.teil[name].setColorAt(i, c.setHex(hex));

    // ---- Jeden Besucher auswürfeln: Größe, Kleidung, Frisur, und wo er am Anfang steht ----
    this.leute = [];
    const orte = plan.orte, raeume = plan.raeume || [];
    this.imHaus = (x, zz) => raeume.some((h) => Math.abs(x - h.x) < h.b / 2 + 0.5 && Math.abs(zz - h.z) < h.t / 2 + 0.5);
    const stelle = () => {
      for (let v = 0; v < 40; v++) {
        const o = aus(orte), w = zf() * 6.283, weit = 3.5 + zf() * 22, x = o.tx + Math.sin(w) * weit, zz = o.tz + Math.cos(w) * weit;
        if (!frei(gitter, x, zz) || !frei(gitter, x + 0.6, zz) || !frei(gitter, x - 0.6, zz) || !frei(gitter, x, zz + 0.6) || !frei(gitter, x, zz - 0.6)) continue;
        if (orte.some((p) => Math.hypot(p.tx - x, p.tz - zz) < 2.4) || this.imHaus(x, zz)) continue;      // nicht vor den Türen im Weg und nicht in den Häusern
        return { x, z: zz, o };
      }
      return null;
    };
    for (let i = 0; i < n; i++) {
      const kind = zf() < 0.1, frau = zf() < 0.5;
      const p = {
        i, x: 0, z: 0, dreh: zf() * 6.283, zielDreh: 0, tempo: 0, gang: 0, takt: zf() * 6.283, pfad: null, warte: 0, plaudert: null,
        gross: kind ? 0.62 + zf() * 0.18 : (frau ? 0.92 : 0.98) + zf() * 0.1,            // 1 = 1,75 m
        breit: (frau ? 0.88 : 1) * (0.92 + zf() * 0.22) * (kind ? 0.9 : 1),
        kopfGross: kind ? 1.22 : 1,
        lauf: (kind ? 1.25 : 1.05) + zf() * 0.4,                                          // Meter pro Sekunde beim Schlendern
        geste: Math.floor(zf() * 6),                                                      // was die Arme beim Stehen tun
        eigen: zf() * 100,                                                                // damit nicht alle im gleichen Takt wackeln
        da: true,
      };
      p.wer = kind ? KIND : aus(frau ? FRAUEN : MAENNER);
      const haut = aus(HAUT), hemd = p.hemd = aus(HEMD), hose = aus(HOSE), kleid = frau && !kind && zf() < 0.28, kurz = kleid || zf() < 0.55, aermel = zf() < 0.2;
      farbe('rumpf', i, hemd); farbe('becken', i, kleid ? hemd : hose); farbe('kopf', i, haut);
      farbe('rock', i, hemd); p.rock = kleid;
      for (const s of [0, 1]) {
        farbe('oarm', i * 2 + s, hemd); farbe('uarm', i * 2 + s, aermel ? hemd : haut); farbe('hand', i * 2 + s, haut);
        farbe('osch', i * 2 + s, kleid ? haut : hose); farbe('usch', i * 2 + s, kurz ? haut : hose); farbe('fuss', i * 2 + s, 0xffffff);
      }
      const schuh = aus(SCHUH); farbe('fuss', i * 2, schuh); farbe('fuss', i * 2 + 1, schuh);
      const haar = aus(HAAR), hut = zf();
      p.haar = frau && zf() < 0.75 ? 'haarLang' : 'haarKurz';
      p.hut = hut < 0.2 ? 'kappe' : hut < 0.32 ? 'sonnenhut' : null;
      p.rucksack = zf() < 0.16;
      farbe('haarKurz', i, haar); farbe('haarLang', i, haar); farbe('kappe', i, aus(HUT)); farbe('sonnenhut', i, aus([0xf0e6c8, 0xe8d8a8, 0xf6f2e8, 0xd8c090])); farbe('rucksack', i, aus([0x2a2e36, 0x8a2e2e, 0x2e4a6a, 0x4a5a3a, 0x9a8a6a]));

      // Startplatz. Jeder Dritte stellt sich zu jemandem dazu, dann unterhalten sich die beiden.
      const partner = i > 0 && zf() < 0.34 ? this.leute[Math.floor(zf() * i)] : null;
      let ok = false;
      if (partner && partner.da && !partner.pfad) {
        const w = zf() * 6.283, x = partner.x + Math.sin(w) * 0.95, zz = partner.z + Math.cos(w) * 0.95;
        if (frei(gitter, x, zz)) {
          p.x = x; p.z = zz; p.dreh = p.zielDreh = Math.atan2(partner.x - x, partner.z - zz); p.plaudert = partner;
          if (!partner.plaudert) { partner.plaudert = p; partner.dreh = partner.zielDreh = Math.atan2(x - partner.x, zz - partner.z); }
          p.warte = partner.warte = zwischen(...PLAUDER_ZEIT, zf()); ok = true;
        }
      }
      if (!ok) {
        const s = stelle();
        if (s) { p.x = s.x; p.z = s.z; p.zielDreh = p.dreh = zf() < 0.6 ? Math.atan2(s.o.tx - s.x, s.o.tz - s.z) + (zf() - 0.5) : p.dreh; p.warte = zf() < 0.45 ? zf() * 2 : zwischen(...STEH_ZEIT, zf()); }
        else p.da = false;
      }
      this.leute.push(p);
    }
    for (const m of Object.values(this.teil)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.bewege(0);
    // Die echten Menschen nachladen (nicht bei Qualität „niedrig“ – dort ist schatten aus – und nicht mit ?altebesucher)
    if (schatten && !ALTE_BESUCHER) ladeMenschen().then((M) => { if (M && this.gruppe.parent) this.menschenBauen(M); });
  }

  // Die Menschen sind da: Für jeden Menschen und jede seiner 13 Haltungen gibt es eine Form, die ganz oft gezeichnet werden kann.
  // Die 15 einfachen Teile werden unsichtbar.
  menschenBauen(M) {
    const zahl = {};
    for (const p of this.leute) zahl[p.wer] = (zahl[p.wer] || 0) + 1;
    this.echt = {}; this.echtMat = [];
    const weiss = new THREE.Color(1, 1, 1);
    for (const [name, n] of Object.entries(zahl)) {
      const mat = new THREE.MeshLambertMaterial({ map: M[name].map, alphaTest: 0.45, side: THREE.DoubleSide });
      // Die Farbe des Besuchers kommt nur aufs Hemd. Das Hemd erkennt man an seiner Stelle im Bild (wie bei den Spielern in figur.js).
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `
          #ifdef USE_COLOR
          { vec2 f = vec2(vMapUv.x, 1.0 - vMapUv.y); if (f.x >= 0.5 && f.x <= 0.75 && f.y >= 0.5) diffuseColor.rgb *= vColor; }
          #endif`);
      };
      this.echtMat.push(mat);
      this.echt[name] = M[name].bilder.map((geo) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.setColorAt(0, weiss); m.count = 0; m.frustumCulled = false; m.castShadow = this.schatten;
        this.gruppe.add(m);
        return m;
      });
    }
    for (const m of Object.values(this.teil)) m.visible = false;
    this.hilf = new THREE.Object3D(); this.farbe = new THREE.Color();
    this.bewege(0);
  }

  // Einen Besucher als Menschen zeigen: die passende Haltung aussuchen und an seine Stelle setzen
  zeige(p, t) {
    let bild = STEH;
    if (p.gang > 0.5) bild = Math.floor((((p.takt / 6.283) % 1) + 1) % 1 * SCHRITT_BILDER) % SCHRITT_BILDER;
    else if (p.plaudert) bild = p.geste % 2 ? REDEN : STEH;
    else if (p.geste === 1) bild = HUEFTEN;
    else if (p.geste === 2) bild = HANDY;
    else if (p.geste === 3) bild = Math.sin((t + p.eigen) * 0.35) > 0.2 ? FOTO : STEH;
    const m = this.echt[p.wer][bild], h = this.hilf, k = p.gross * MENSCH_GROSS;
    const b = 0.93 + 0.14 * (p.eigen % 1);      // ein bisschen schmaler oder breiter
    h.position.set(p.x, 0, p.z); h.rotation.y = p.dreh; h.scale.set(k * b, k, k * b); h.updateMatrix();
    m.setMatrixAt(m.count, h.matrix);
    m.setColorAt(m.count, OHNE_FARBE.includes(p.wer) ? this.farbe.setRGB(1, 1, 1) : this.farbe.setHex(p.hemd));
    m.count++;
  }

  // Ein neues Ziel für einen Besucher: meistens eine Tür in der Nähe, manchmal eine ganz woanders
  neuesZiel(p) {
    const orte = this.plan.orte;
    let ziel = orte[Math.floor(Math.random() * orte.length)];
    if (Math.random() < 0.65) for (let v = 0; v < 2; v++) { const o = orte[Math.floor(Math.random() * orte.length)]; if (Math.hypot(o.tx - p.x, o.tz - p.z) < Math.hypot(ziel.tx - p.x, ziel.tz - p.z)) ziel = o; }
    const w = Math.random() * 6.283, r = 3 + Math.random() * 9;
    const s = naechsteFreie(this.gitter, ziel.tx + Math.sin(w) * r, ziel.tz + Math.cos(w) * r);
    if (!s || this.imHaus(s.x, s.z) || Math.hypot(s.x - p.x, s.z - p.z) < 4) return false;
    p.pfad = weg(this.gitter, p.x, p.z, s.x, s.z);
    p.zielOrt = ziel;
    return !!p.pfad;
  }

  // Alle Besucher ein Stück weiterbewegen und ihre Teile an die richtige Stelle setzen (einmal pro Bild)
  bewege(dt) {
    this.zeit += dt;
    const g = this.g, T = this.teil, t = this.zeit;
    let gesucht = false;
    if (this.echt) for (const bilder of Object.values(this.echt)) for (const m of bilder) m.count = 0;
    for (const p of this.leute) {
      if (!p.da) continue;
      // ---- Wohin? ----
      let geht = false;
      if (p.pfad) {
        const n = p.pfad[0], dx = n.x - p.x, dz = n.z - p.z, weit = Math.hypot(dx, dz);
        if (weit < 0.35) {
          p.pfad.shift();
          if (!p.pfad.length) {      // angekommen: stehen bleiben und zum Gebäude schauen
            p.pfad = null; p.warte = zwischen(...STEH_ZEIT, Math.random()); p.geste = Math.floor(Math.random() * 6);
            if (p.zielOrt && Math.random() < 0.7) p.zielDreh = Math.atan2(p.zielOrt.tx - p.x, p.zielOrt.tz - p.z) + (Math.random() - 0.5) * 0.8;
          }
        } else {
          p.tempo = Math.min(p.lauf, p.tempo + dt * 2.2);
          p.x += dx / weit * p.tempo * dt; p.z += dz / weit * p.tempo * dt;
          p.zielDreh = Math.atan2(dx, dz); geht = true;
        }
      } else if (dt > 0) {
        p.warte -= dt;
        if (p.warte <= 0 && !gesucht) {       // pro Bild sucht nur EINER einen neuen Weg – das Suchen kostet Rechenzeit
          gesucht = true;
          if (p.plaudert) { if (p.plaudert.plaudert === p) p.plaudert.plaudert = null; p.plaudert = null; }
          if (!this.neuesZiel(p)) p.warte = 1.5 + Math.random() * 3;
        }
      }
      if (!geht) p.tempo = Math.max(0, p.tempo - dt * 4);
      // sanft in die neue Richtung drehen (nicht ruckartig)
      let dw = p.zielDreh - p.dreh; dw = Math.atan2(Math.sin(dw), Math.cos(dw));
      p.dreh += dw * Math.min(1, dt * (geht ? DREH_TEMPO : 2.5));
      p.gang += ((geht ? 1 : 0) - p.gang) * Math.min(1, dt * 6);                // 0 = steht, 1 = geht (weicher Übergang)
      p.takt += dt * p.tempo / (SCHRITT * p.gross) * 6.283;
      if (this.echt) { this.zeige(p, t); continue; }      // als Mensch aus MakeHuman – das Gerüst für die einfachen Teile braucht es dann nicht

      // ---- Haltung: erst das Gehen, dann das Stehen, gemischt nach p.gang ----
      const G = p.gang, S = 1 - G, s = Math.sin(p.takt), c = Math.cos(p.takt), e = t + p.eigen;
      g.wurzel.position.set(p.x, 0, p.z); g.wurzel.rotation.y = p.dreh; g.wurzel.scale.setScalar(p.gross);
      const gewicht = Math.sin(e * 0.45) * S;                                   // im Stehen: das Gewicht wandert von einem Bein aufs andere
      g.huefte.position.set(gewicht * 0.025, 0.94 + G * WIPPEN * Math.cos(p.takt * 2) - G * 0.012, 0);
      g.huefte.rotation.set(G * 0.04, G * 0.07 * s, gewicht * 0.035);
      g.rumpf.rotation.set(G * 0.03 + S * Math.sin(e * 0.8) * 0.012, -G * 0.16 * s, -gewicht * 0.03);
      g.rumpf.scale.set(p.breit, 1, p.breit);
      // Kopf: beim Gehen ruhig, beim Stehen schaut man sich um
      let kopfDreh = S * (Math.sin(e * 0.31) * 0.55 + Math.sin(e * 0.83) * 0.18), kopfNick = S * Math.sin(e * 0.5) * 0.06;
      // Arme
      let lS = ARM_SCHWUNG * s * G, rS = -ARM_SCHWUNG * s * G, lE = -(0.22 + 0.25 * Math.max(0, -s)) * G, rE = -(0.22 + 0.25 * Math.max(0, s)) * G, lZ = -0.07, rZ = 0.07, lY = 0, rY = 0;
      if (S > 0.01) {
        const ruhe = Math.sin(e * 0.7) * 0.03;
        let a = { lS: ruhe, rS: -ruhe, lE: -0.12, rE: -0.12, lZ: -0.07, rZ: 0.07, lY: 0, rY: 0 };
        if (p.plaudert) {                                     // reden mit den Händen
          const red = Math.max(0, Math.sin(e * 0.9)) * (0.6 + 0.4 * Math.sin(e * 5.1));
          a.rS = -0.25 - red * 0.35; a.rE = -1.1 - red * 0.5; a.rY = -0.3; kopfDreh *= 0.25; kopfNick = S * Math.sin(e * 2.2) * 0.05;
          if (p.geste % 2) { a.lS = -0.1; a.lE = -1.5; a.lY = 0.9; }      // die andere Hand liegt am Bauch
        } else if (p.geste === 1) { a.lZ = -0.5; a.rZ = 0.5; a.lE = a.rE = -1.75; a.lY = 1.25; a.rY = -1.25; a.lS = a.rS = 0.3; }      // Hände in die Hüften
        else if (p.geste === 2) { a.rS = -0.55; a.rE = -1.85; a.rY = -0.35; kopfNick = S * 0.42; kopfDreh *= 0.15; }                   // aufs Handy schauen
        else if (p.geste === 3) { const hoch = Math.max(0, Math.sin(e * 0.35)); a.lS = a.rS = -1.25 * hoch; a.lE = a.rE = -0.12 - 1.55 * hoch; a.lY = 0.5 * hoch; a.rY = -0.5 * hoch; kopfDreh *= 1 - hoch; }      // ein Foto machen
        else if (p.geste === 4) { a.lS = a.rS = -0.12; a.lE = a.rE = -1.45; a.lY = 1.0; a.rY = -1.0; }                                // Arme vor dem Bauch verschränkt
        lS += a.lS * S; rS += a.rS * S; lE += a.lE * S; rE += a.rE * S; lZ = zwischen(lZ, a.lZ, S); rZ = zwischen(rZ, a.rZ, S); lY = a.lY * S; rY = a.rY * S;
      }
      g.kopf.rotation.set(kopfNick, kopfDreh + G * 0.1 * s, 0); g.kopf.scale.set(p.kopfGross / p.breit, p.kopfGross, p.kopfGross / p.breit);
      g.l.schulter.rotation.set(lS, lY, lZ); g.r.schulter.rotation.set(rS, rY, rZ);
      g.l.ellbogen.rotation.x = lE; g.r.ellbogen.rotation.x = rE;
      // Beine: links schwingt mit sin, rechts genau entgegengesetzt. Das Knie knickt, während das Bein nach vorn kommt.
      const bein = (b, sn, cs) => {
        const hueft = -BEIN_SCHWUNG * sn * G + 0.05 * G, knie = (0.06 + KNIE_BEUGE * Math.max(0, cs) ** 1.3 + 0.12 * Math.max(0, -sn)) * G;
        b.bein.rotation.x = hueft; b.knie.rotation.x = knie;
        b.fuss.rotation.x = klemm(-(hueft + knie) * 0.75 + 0.3 * Math.max(0, cs) * G, -0.5, 0.6);       // Fuß bleibt fast flach, die Ferse setzt zuerst auf
      };
      bein(g.l, s, c); bein(g.r, -s, -c);
      g.l.bein.rotation.z = -gewicht * 0.03 - 0.02 * S; g.r.bein.rotation.z = -gewicht * 0.03 + 0.02 * S;
      g.wurzel.updateMatrixWorld(true);

      // ---- Die Teile dorthin setzen, wo das Gerüst gerade ist ----
      const i = p.i;
      T.rumpf.setMatrixAt(i, g.rumpf.matrixWorld); T.becken.setMatrixAt(i, g.huefte.matrixWorld); T.kopf.setMatrixAt(i, g.kopf.matrixWorld);
      T[p.haar].setMatrixAt(i, g.kopf.matrixWorld);
      if (p.hut) T[p.hut].setMatrixAt(i, g.kopf.matrixWorld);
      if (p.rock) T.rock.setMatrixAt(i, g.huefte.matrixWorld);
      if (p.rucksack) T.rucksack.setMatrixAt(i, g.rumpf.matrixWorld);
      for (const [k, b] of [[0, g.l], [1, g.r]]) {
        const j = i * 2 + k;
        T.oarm.setMatrixAt(j, b.schulter.matrixWorld); T.uarm.setMatrixAt(j, b.ellbogen.matrixWorld); T.hand.setMatrixAt(j, b.hand.matrixWorld);
        T.osch.setMatrixAt(j, b.bein.matrixWorld); T.usch.setMatrixAt(j, b.knie.matrixWorld); T.fuss.setMatrixAt(j, b.fuss.matrixWorld);
      }
    }
    if (this.echt) { for (const bilder of Object.values(this.echt)) for (const m of bilder) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } return; }
    for (const m of Object.values(T)) m.instanceMatrix.needsUpdate = true;
  }

  // Aufräumen, wenn man das Gelände verlässt
  weg() {
    for (const m of Object.values(this.teil)) m.geometry.dispose();
    this.teil.rumpf.material.dispose(); this.teil.rock.material.dispose();
    for (const m of this.echtMat || []) m.dispose();      // (die Formen und Bilder der Menschen bleiben geladen – sie werden beim nächsten Gelände wieder gebraucht)
    this.gruppe.removeFromParent();
  }
}
