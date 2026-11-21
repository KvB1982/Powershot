// Powershot – baut ein Turniergelände in 3D aus seinem Lageplan (js/gelaende.js).
//
// Zuerst besteht alles aus einfachen Formen: Ein Stadion ist ein Ring mit schrägen Rängen, ein Haus ein Kasten mit Dach,
// ein Baum ein Stamm mit Kugel. Dinge, die oft vorkommen (Plätze, Bäume, Zuschauer), werden als EINE Form
// viele Male gezeichnet („InstancedMesh“). Das spart dem iPad viel Arbeit.
//
// Sind die fertigen 3D-Modelle geladen (gelaendemodelle.js), nimmt der Bau sie statt der einfachen Formen:
// Häuser im Stil des Landes, die berühmten Stadien, Bäume, Besucher, Autos. Welche Modelle ein Gelände
// haben möchte, steht danach in „gewollt“ – anlage.js lädt sie und baut das Gelände dann noch einmal.
// In Häuser mit „Raum“ (plan.raeume) kann man hineingehen: Dort gibt es einen Fußboden, niedrige Wände und Möbel.
import * as THREE from 'three';
import { requisit } from './requisiten.js';
import { PLATZ_L, PLATZ_B } from './gelaende.js';
import { frei } from './wege.js';
import { modell, hausModell } from './gelaendemodelle.js';
import { moebelBauen } from './moebel.js';
import { umgebungBauen } from './umgebung.js';
import { hotelBauen, wegweiserBauen, absperrungBauen, pensionSchmuck } from './hotelbau.js';

const HALB = Math.PI / 2;

// Ein Schild mit Text (wird auf ein kleines Bild gemalt). art: 'ort' = weiß, 'info' = hellblau, 'name' = nur Beschriftung
// Das Bild ist genau so breit wie der Text – so wird ein langer Name nicht zusammengequetscht.
// Das Schild schwebt später über seinem „Anker“ (userData.anker = die Stelle, auf die es zeigt) und wird immer
// über allem anderen gemalt (depthTest: false), damit kein Dach es halb verdeckt. Wohin genau, rechnet anlage.js aus.
export function schildBauen(text, art = 'ort', anker = null) {
  const bild = document.createElement('canvas');
  const s = bild.getContext('2d');
  const schrift = 'bold 50px sans-serif', voll = (art === 'info' ? 'ℹ️ ' : '') + text;
  s.font = schrift;
  bild.width = Math.max(150, Math.min(900, Math.ceil(s.measureText(voll).width) + 48)); bild.height = 80;
  const B = bild.width;
  s.fillStyle = art === 'info' ? '#dff0ff' : art === 'name' ? 'rgba(20,28,48,0.9)' : '#fdfdf6';
  s.beginPath(); if (s.roundRect) s.roundRect(4, 4, B - 8, 72, 20); else s.rect(4, 4, B - 8, 72); s.fill();
  s.lineWidth = 5; s.strokeStyle = art === 'name' ? 'rgba(255,255,255,0.55)' : '#16203a'; s.stroke();      // ein Rand, damit sich das Schild von hellem Boden abhebt
  s.fillStyle = art === 'name' ? '#ffffff' : '#16203a'; s.font = schrift; s.textAlign = 'center'; s.textBaseline = 'middle';
  s.fillText(voll, B / 2, 43, B - 36);
  const tex = new THREE.CanvasTexture(bild);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, fog: false }));
  m.renderOrder = 21;
  m.userData.eigen = true;
  m.userData.gross = art === 'name' ? 0.8 : 1;
  m.userData.breit = B / 80;                       // wie viel breiter als hoch
  m.userData.nurName = art === 'name';
  m.userData.anker = anker;
  m.scale.set(0.86 * m.userData.breit, 0.86, 1);
  if (anker) m.position.set(anker.x, anker.y + 1.5, anker.z);
  return m;
}

// Die Verbindungs-Pfeile von den Schildern hinunter zu ihrem Ort. Alle Pfeile sind zusammen EINE Form.
// Ihre Ecken werden gleich in Bildschirm-Maßen angegeben (−1 … +1), deshalb ist der kleine Malplan („Shader“) unten so kurz.
// eckenSetzen(liste) bekommt für jeden Pfeil { x0, y0 (Anfang am Schild), x1, y1 (Spitze), dick } und baut dunklen Rand + helle Mitte + Pfeilspitze.
export function pfeileBauen(hoechstens = 260) {
  const ECKEN = 18;                                 // je Pfeil: 2 × (Strich = 2 Dreiecke, Spitze = 1 Dreieck)
  const geo = new THREE.BufferGeometry();
  const ort = new Float32Array(hoechstens * ECKEN * 3), farbe = new Float32Array(hoechstens * ECKEN * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(ort, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('farbe', new THREE.BufferAttribute(farbe, 3));
  for (let i = 0; i < hoechstens * ECKEN; i++) { const hell = i % ECKEN >= 9; farbe.set(hell ? [0.99, 0.99, 0.95] : [0.07, 0.11, 0.2], i * 3); }
  const stoff = new THREE.ShaderMaterial({
    vertexShader: 'attribute vec3 farbe; varying vec3 f; void main() { f = farbe; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec3 f; void main() { gl_FragColor = vec4(f, 0.92); }',
    depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, stoff);
  m.frustumCulled = false; m.renderOrder = 20; m.userData.eigen = true;
  geo.setDrawRange(0, 0);
  // B, H = Breite und Höhe des Bildes in Bildpunkten; alle Angaben in Bildpunkten, y von oben
  m.userData.eckenSetzen = (liste, B, H) => {
    let n = 0;
    const p = (x, y) => { ort[n++] = x / B * 2 - 1; ort[n++] = 1 - y / H * 2; ort[n++] = 0; };
    for (const a of liste.slice(0, hoechstens)) {
      // Richtung des Pfeils (rx, ry) und quer dazu (qx, qy)
      const weit = Math.hypot(a.x1 - a.x0, a.y1 - a.y0) || 1, rx = (a.x1 - a.x0) / weit, ry = (a.y1 - a.y0) / weit, qx = -ry, qy = rx;
      for (const rand of [1.3, 0]) {                // zuerst etwas dicker in Dunkel (der Rand), dann schmaler in Hell darüber
        const d = a.dick / 2 + rand, sp = a.dick * 2.2 + rand * 1.5;
        const lang = Math.min(a.dick * 5, Math.max(2, weit));                  // so lang ist die Pfeilspitze
        const ex = a.x1 - rx * lang, ey = a.y1 - ry * lang;                    // hier hört der Strich auf und die Spitze fängt an
        p(a.x0 - qx * d, a.y0 - qy * d); p(a.x0 + qx * d, a.y0 + qy * d); p(ex + qx * d, ey + qy * d);         // der Strich …
        p(a.x0 - qx * d, a.y0 - qy * d); p(ex + qx * d, ey + qy * d); p(ex - qx * d, ey - qy * d);
        p(ex - rx * rand - qx * sp, ey - ry * rand - qy * sp); p(ex - rx * rand + qx * sp, ey - ry * rand + qy * sp); p(a.x1 + rx * rand * 1.8, a.y1 + ry * rand * 1.8);   // … und die Spitze
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, n / 3);
  };
  return m;
}

const hex = (f) => '#' + f.toString(16).padStart(6, '0');

// Bild eines Tennisplatzes von oben: außen der Auslauf, innen das Feld mit weißen Linien
function platzBild(innen, aussen) {
  const b = document.createElement('canvas');
  b.width = 112; b.height = 208;                       // 16 Bildpunkte pro Meter
  const s = b.getContext('2d'), mx = 56, my = 104;
  s.fillStyle = hex(aussen); s.fillRect(0, 0, 112, 208);
  const fl = 138, fb = 64, eb = 48;                    // Feld lang, Feld breit (Doppel), Einzelfeld breit
  s.fillStyle = hex(innen); s.fillRect(mx - fb / 2, my - fl / 2, fb, fl);
  s.strokeStyle = '#ffffff'; s.lineWidth = 2;
  s.strokeRect(mx - fb / 2, my - fl / 2, fb, fl);
  s.strokeRect(mx - eb / 2, my - fl / 2, eb, fl);
  s.strokeRect(mx - eb / 2, my - 37, eb, 74);          // Aufschlagfelder
  s.beginPath(); s.moveTo(mx, my - 37); s.lineTo(mx, my + 37); s.stroke();
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Bild für Hauswände: helle Wand mit einem dunklen Fenster (wird oft nebeneinander wiederholt)
function fensterBild() {
  const b = document.createElement('canvas');
  b.width = b.height = 64;
  const s = b.getContext('2d');
  s.fillStyle = '#ffffff'; s.fillRect(0, 0, 64, 64);
  s.fillStyle = '#5a6e84'; s.fillRect(14, 16, 36, 30);
  s.fillStyle = '#8fa6bc'; s.fillRect(14, 16, 36, 8);
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Bild für die Ränge: viele bunte Punkte = Zuschauer
function publikumBild() {
  const b = document.createElement('canvas');
  b.width = 128; b.height = 64;
  const s = b.getContext('2d');
  s.fillStyle = '#d8d8d8'; s.fillRect(0, 0, 128, 64);
  for (let y = 0; y < 64; y += 8) { s.fillStyle = 'rgba(0,0,0,0.16)'; s.fillRect(0, y, 128, 2); }       // Sitzreihen
  const farben = ['#ffffff', '#f4e8d0', '#e84a3a', '#3a6ae8', '#f0d040', '#3aa85a', '#f0f0f0', '#e89ac0', '#404858'];
  let z = 12345;
  const zf = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return z / 0x7fffffff; };
  for (let i = 0; i < 520; i++) { s.fillStyle = farben[Math.floor(zf() * farben.length)]; s.fillRect(Math.floor(zf() * 64) * 2, Math.floor(zf() * 8) * 8 + 3, 2, 4); }
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Ein fein gesprenkeltes Bild für Böden: So sehen Pflaster und Wiese nicht wie eine glatte Plastikfläche aus
// und passen besser zu den Modellen mit ihren gemalten Oberflächen.
function koernBild() {
  const b = document.createElement('canvas');
  b.width = b.height = 128;
  const s = b.getContext('2d');
  s.fillStyle = '#f2f2f2'; s.fillRect(0, 0, 128, 128);
  let z = 2024;
  const zf = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return z / 0x7fffffff; };
  for (let i = 0; i < 2600; i++) { const hell = zf() < 0.5; s.fillStyle = hell ? `rgba(255,255,255,${0.25 + zf() * 0.5})` : `rgba(0,0,0,${0.04 + zf() * 0.1})`; const gr = 1 + Math.floor(zf() * 3); s.fillRect(Math.floor(zf() * 128), Math.floor(zf() * 128), gr, gr); }
  for (let i = 0; i < 14; i++) { s.fillStyle = `rgba(0,0,0,${0.03 + zf() * 0.04})`; s.beginPath(); s.arc(zf() * 128, zf() * 128, 8 + zf() * 18, 0, 6.3); s.fill(); }
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// Bild für die Außenwand eines Stadions: Pfeiler, dazwischen helle Felder mit einem Fensterband, unten ein dunkler Eingang
function fassadeBild() {
  const b = document.createElement('canvas');
  b.width = 64; b.height = 128;
  const s = b.getContext('2d');
  s.fillStyle = '#e9e9e9'; s.fillRect(0, 0, 64, 128);
  s.fillStyle = '#ffffff'; s.fillRect(0, 0, 9, 128); s.fillRect(55, 0, 9, 128);                 // Pfeiler
  s.fillStyle = 'rgba(0,0,0,0.18)'; s.fillRect(9, 0, 2, 128); s.fillRect(53, 0, 2, 128);        // Schatten neben den Pfeilern
  s.fillStyle = '#5d6f82'; s.fillRect(14, 18, 36, 26);                                           // Fensterband
  s.fillStyle = '#93a9bf'; s.fillRect(14, 18, 36, 7);
  s.fillStyle = 'rgba(0,0,0,0.22)'; s.fillRect(0, 60, 64, 3);                                    // Kante zwischen den Stockwerken
  s.fillStyle = '#cfcfcf'; s.fillRect(11, 63, 42, 65);
  s.fillStyle = '#3a4350'; s.fillRect(18, 84, 28, 44);                                           // dunkle Öffnung unten
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// Holzdielen für die Fußböden in den Häusern
function dielenBild() {
  const b = document.createElement('canvas');
  b.width = b.height = 128;
  const s = b.getContext('2d');
  let z = 77;
  const zf = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return z / 0x7fffffff; };
  for (let i = 0; i < 8; i++) {
    const hell = 150 + Math.floor(zf() * 26);
    s.fillStyle = `rgb(${hell + 38},${hell},${hell - 48})`; s.fillRect(0, i * 16, 128, 16);
    s.fillStyle = 'rgba(60,40,20,0.35)'; s.fillRect(0, i * 16, 128, 1); s.fillRect(Math.floor(zf() * 120), i * 16, 1, 16);
  }
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const BODEN_METER = { gras: 6, pflaster: 4, asphalt: 9, kopfstein: 3 };   // so breit ist ein Bodenbild in Metern, bevor es sich wiederholt
const NAH_BAEUME = 26;         // so viele Bäume (die nächsten an den Türen) sind echte Modelle, die übrigen flache Bilder
// Bild eines Baums für die Ferne: [Breite, Höhe] der Bildtafel, wenn der Baum 1 hoch ist
const FLACH = { laub: [0.98, 1.47], palme: [0.7, 1.05], pinie: [0.98, 1.47], zypresse: [0.667, 1], fichte: [0.667, 1] };
const BAUM_HOCH = { laub: 6.6, palme: 7.2, pinie: 8, zypresse: 7, fichte: 8 };
const WAND_DREH = { s: 0, o: HALB, n: Math.PI, w: -HALB };

// Baut das ganze Gelände. plan = planVon(id) aus gelaende.js · gitter = wo man laufen kann (für die Besucher) ·
// namen = { court: 'Centre Court', … } Namen und Texte der Orte, falls der Plan keinen eigenen Namen hat
export function baueGelaende(plan, gitter, { schatten = true, namen = {}, wenig = false } = {}) {
  const g = plan.g, G = new THREE.Group(), klick = [];
  const bilder = { fenster: fensterBild(), publikum: publikumBild(), koern: koernBild(), dielen: dielenBild(), fassade: fassadeBild(), platz: {} };
  // ---- Fertige Modelle ----
  const gewollt = new Set();                      // diese Modelle hätte das Gelände gern
  const M = (name) => { if (wenig || !name) return null; gewollt.add(name); return modell(name); };
  // Ein Modell einmal hinstellen (mal = Größe, einzeln für breit/hoch/tief möglich)
  const stueck = (m, x, z, dreh = 0, mx = 1, my = mx, mz = mx, wirft = true, wohin = G) => {
    const me = new THREE.Mesh(m.geo, m.mat);
    me.position.set(x, 0, z); me.rotation.y = dreh; me.scale.set(mx, my, mz);
    me.castShadow = wirft && schatten; me.receiveShadow = true;
    wohin.add(me);
    return me;
  };
  // Ein Modell in einen Kasten einpassen (b breit, t tief, h hoch). seite = dorthin zeigt die Vorderseite.
  // Würde das Modell dabei arg verzerrt (ein langes Haus in einen quer liegenden Kasten), wird es um eine Vierteldrehung gedreht.
  const einpassen = (m, x, z, b, t, h, seite) => {
    let dreh = WAND_DREH[seite] ?? 0, quer = Math.abs(Math.sin(dreh)) > 0.5;
    const verzerrt = (q) => { const fx = (q ? t : b) / m.gr.x, fz = (q ? b : t) / m.gr.z; return Math.max(fx / fz, fz / fx); };
    if (verzerrt(quer) > 1.9 && verzerrt(!quer) < verzerrt(quer)) { dreh += HALB; quer = !quer; }
    return stueck(m, x, z, dreh, (quer ? t : b) / m.gr.x, h / m.gr.y, (quer ? b : t) / m.gr.z);
  };
  // Ein Modell viele Male: liste = [[x, y, z, drehung, größe, farbton], …]
  const vieleM = (m, liste, wirft = true) => {
    if (!liste.length) return null;
    const im = new THREE.InstancedMesh(m.geo, m.mat, liste.length), o = new THREE.Object3D(), c = new THREE.Color();
    liste.forEach(([x, y, z, dreh = 0, gr = 1, ton], i) => { o.position.set(x, y, z); o.rotation.set(0, dreh, 0); o.scale.setScalar(gr); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (ton !== undefined) im.setColorAt(i, c.setHex(ton)); });
    im.castShadow = wirft && schatten; im.receiveShadow = true;
    im.frustumCulled = false;
    G.add(im);
    return im;
  };
  const raumVon = new Map((plan.raeume || []).map((r) => [r.teil, r]));
  const raeume = [];                               // begehbare Häuser: { r, aussen: [Formen], innen: Gruppe }
  const mat = (farbe, o = {}) => new THREE.MeshStandardMaterial({ color: farbe, roughness: o.rau ?? 0.88, metalness: o.metall ?? 0, side: o.beide ? THREE.DoubleSide : THREE.FrontSide,
    map: o.bild || null, transparent: !!o.durch, opacity: o.durch ?? 1, depthWrite: !o.durch, flatShading: !!o.kantig });
  const neu = (geo, material, x, y, z, wirft = false) => {
    const m = new THREE.Mesh(geo, material);
    m.userData.eigen = true;
    m.position.set(x, y, z);
    m.castShadow = wirft && schatten; m.receiveShadow = true;
    G.add(m);
    return m;
  };
  // Welches Bodenbild passt zu dieser Farbe? Grün = Gras, dunkles Grau = Asphalt, alles andere Helle = Pflaster
  // (im Städtchen Kopfsteinpflaster). Die Bilder sind grau, die Farbe kommt weiter aus dem Lageplan.
  // Sind die Bilder noch nicht geladen (oder Qualität „niedrig“), bleibt das gesprenkelte Bild von früher.
  const bodenBild = (farbe, b, t, nurGras = false) => {
    const hsl = new THREE.Color(farbe).getHSL({}, THREE.SRGBColorSpace);
    const blau = hsl.s > 0.16 && hsl.h >= 0.47 && hsl.h < 0.75;         // Wasser und blaue Flächen bleiben, wie sie sind
    const art = hsl.s > 0.16 && hsl.h > 0.17 && hsl.h < 0.47 ? 'gras' : hsl.s < 0.2 && hsl.l < 0.52 ? 'asphalt' : blau ? null : (g.zuFuss ? 'kopfstein' : 'pflaster');
    const fertig = art && (art === 'gras' || !nurGras) && M('boden_' + art);      // nurGras: Schnee und Wüste im Umland sind kein Pflaster
    const bild = (fertig || bilder.koern).clone(); bild.needsUpdate = true;
    const meter = fertig ? BODEN_METER[art] : 7;                       // so viele Meter ist das Bild in echt breit
    bild.repeat.set(Math.max(1, b / meter), Math.max(1, t / meter));
    return bild;
  };
  // Eine flache Fläche auf dem Boden. e = Ebene (höhere liegen über niedrigeren)
  const flach = (x, z, b, t, farbe, e = 1, rund = false, o = {}) => {
    if (!o.bild && !o.durch && Math.max(b, t) < 900) o = { ...o, bild: o.glatt ? Object.assign(bilder.koern.clone(), { needsUpdate: true }) : bodenBild(farbe, b, t) };
    const geo = rund ? new THREE.CircleGeometry(0.5, 40).rotateX(-HALB).scale(b, 1, t) : new THREE.PlaneGeometry(b, t).rotateX(-HALB);
    const m = neu(geo, mat(farbe, o), x, 0.05 * e, z);
    Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: (5 - e) * 2, polygonOffsetUnits: (5 - e) * 30 });
    return m;
  };
  // Viele gleiche Dinge auf einmal: liste = [[x, y, z, drehung, größe], …]
  const viele = (geo, material, liste, wirft = false) => {
    if (!liste.length) { geo.dispose(); material.dispose(); return null; }
    const im = new THREE.InstancedMesh(geo, material, liste.length), o = new THREE.Object3D();
    liste.forEach(([x, y, z, dreh = 0, gr = 1], i) => { o.position.set(x, y, z); o.rotation.set(0, dreh, 0); o.scale.setScalar(gr); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.userData.eigen = true;
    im.castShadow = wirft && schatten; im.receiveShadow = true;
    im.frustumCulled = false;                 // die Kopien stehen überall verteilt, also immer zeichnen
    G.add(im);
    return im;
  };
  const dunkler = (f, k) => new THREE.Color(f).multiplyScalar(k).getHex();

  // ---- Boden: weit draußen das Umland, darauf das Gelände ----
  const r = g.rand, mx = (r.x0 + r.x1) / 2, mz = (r.z0 + r.z1) / 2;
  const umBild = bodenBild(g.umland, 2400, 2400, true);
  const boden = neu(new THREE.PlaneGeometry(2400, 2400).rotateX(-HALB), mat(g.umland, { bild: umBild }), mx, 0, mz);
  Object.assign(boden.material, { polygonOffset: true, polygonOffsetFactor: 12, polygonOffsetUnits: 200 });
  flach(mx, mz, r.x1 - r.x0 + 6, r.z1 - r.z0 + 6, g.boden, 0.8);

  const plaetze = {};        // Farbe → Liste aller Plätze dieser Farbe
  const netze = [], baeume = { laub: [], palme: [], pinie: [], zypresse: [] }, statuen = [], schirme = {}, zelte = [];
  const autos = [], masten = [], stuehle = [], baenke = [], fahnenMasten = [], fahnen = [], laternen = [], gitterTeile = [], wiesen = [], kuebel = [], tonnen = [], bistros = [];
  // Straßen: weiße Striche [x, z, breit, tief], Bordsteine, Schranken, und die Fahrbahnen, auf denen draußen Autos fahren
  const striche = [], gelbe = [], bordsteine = [], fahrbahnen = [], wartende = [];
  let dienst = null;          // der Wagen vom Fahrdienst – anlage.js lässt ihn bei der Fahrt ins Hotel losfahren
  const ASPHALT_DUNKEL = 0x5c5d62;
  const strasseMalen = (el, laengs, mitte = true) => {
    // Randlinien und ein gestrichelter Mittelstreifen
    const lang = laengs === 'x' ? el.b : el.t, breit = laengs === 'x' ? el.t : el.b, n = Math.min(160, Math.floor(lang / 7));
    const rein = (l, q, lb, qb) => striche.push(laengs === 'x' ? [el.x + l, el.z + q, lb, qb] : [el.x + q, el.z + l, qb, lb]);
    for (const s of [-1, 1]) rein(0, s * (breit / 2 - 0.25), lang, 0.14);
    if (mitte) for (let i = 0; i < n; i++) rein((i - (n - 1) / 2) * 7, 0, 3, 0.14);
  };
  const tuerenVon = (nr) => plan.orte.filter((o) => o.teil === nr);
  const tuerBauen = (o, breit = 1.3, hoch = 2.1) => {
    const quer = o.seite === 'o' || o.seite === 'w';
    neu(new THREE.BoxGeometry(quer ? 0.14 : breit, hoch, quer ? breit : 0.14), mat(0x1a1a22), o.wx, hoch / 2, o.wz);
  };

  plan.teile.forEach((el, nr) => {
    const tueren = tuerenVon(nr), vorher = G.children.length;
    let haupt = null, hoehe = el.h || 0;

    if (el.a === 'stadion') {
      // ---- Stadion: außen die Wand, innen schräge Ränge mit Zuschauern, unten der Platz, oben vielleicht ein Dach ----
      const sm = M(el.modell);
      if (sm) {
        // Für dieses Stadion gibt es ein eigenes Modell (z. B. Centre Court von Wimbledon mit Efeu)
        haupt = einpassen(sm, el.x, el.z, el.b, el.t, el.h * 1.12);
      } else {
      // ---- Selbst gebautes Stadion: Fassade mit Pfeilern, echte Sitzstufen mit Zuschauern, Umgang oben, Dach, Anzeigetafel ----
      const ecken = { oval: 40, rund: 40, acht: 8, eckig: 4 }[el.form || 'oval'], eckig = ecken <= 8;
      const dreh = eckig ? Math.PI / ecken : 0, k = eckig ? 1 / Math.cos(Math.PI / ecken) : 1;        // k: damit die geraden Seiten genau auf dem Rand liegen
      const hb = el.b / 2, ht = el.t / 2, h = el.h, INNEN = 0.44, OBEN = 0.9;
      const form = (geo) => geo.rotateY(dreh).scale(hb, 1, ht);
      // Eine Form, die entsteht, wenn man eine Linie im Kreis herumdreht: punkte = [[Abstand von der Mitte, Höhe], …]
      const dreh3d = (punkte) => form(new THREE.LatheGeometry(punkte.map(([rr, y]) => new THREE.Vector2(rr * k, y)), ecken));
      const umfang = (el.b + el.t) * (eckig ? 2 : 1.6), wand = el.farbe || 0xd0d0d0;
      // Fassade: Pfeiler und Fensterbänder, unten ein dunkler Sockel
      const fas = bilder.fassade.clone(); fas.needsUpdate = true; fas.repeat.set(Math.max(4, Math.round(umfang / 5)), Math.max(1, Math.round(h / 4.5)));
      haupt = neu(dreh3d([[1, 0], [1, h]]), mat(wand, { beide: true, bild: fas }), el.x, 0, el.z, true);
      neu(dreh3d([[1.012, 0], [1.012, Math.min(1.1, h * 0.2)]]), mat(dunkler(wand, 0.62)), el.x, 0, el.z);
      // Die Ränge: Stufe für Stufe nach oben, auf jeder Stufe eine Reihe Zuschauer
      const reihen = Math.max(3, Math.min(16, Math.round(h / 0.8))), y0 = Math.min(1.1, h * 0.25), dr = (OBEN - INNEN) / reihen, dy = (h - 0.3 - y0) / reihen;
      const stufen = [[INNEN, 0.3], [INNEN, y0]];
      for (let i = 0; i < reihen; i++) stufen.push([INNEN + (i + 1) * dr, y0 + i * dy], [INNEN + (i + 1) * dr, y0 + (i + 1) * dy]);
      const pub = bilder.publikum.clone(); pub.needsUpdate = true; pub.repeat.set(Math.round(umfang / 5), reihen / 8 + 0.02);
      neu(dreh3d(stufen), mat(el.sitz || 0x8a8a90, { beide: true, bild: pub, kantig: true }), el.x, 0, el.z);
      // Oben der Umgang mit Geländer
      neu(dreh3d([[OBEN, h - 0.3], [1.03, h - 0.3], [1.03, h + 0.15], [1.0, h + 0.15], [1.0, h + 0.75]]), mat(dunkler(wand, 1.12), { beide: true, kantig: true }), el.x, 0, el.z, true);
      const feld = el.feld || g.feld;
      neu(form(new THREE.CircleGeometry(k * INNEN, ecken).rotateX(-HALB)), mat(el.wiese ? 0x4a9a3c : feld[1]), el.x, 0.3, el.z);
      if (!el.wiese || el.ort) {
        const quer = el.b > el.t * 1.2, platzB = (quer ? ht : hb) * INNEN * 2, platzL = (quer ? hb : ht) * INNEN * 2;
        const gr = Math.min(platzL * 0.9 / PLATZ_L, platzB * 0.9 / PLATZ_B) * (el.wiese ? 0.62 : 1);
        const key = feld[0] + '_' + feld[1];
        bilder.platz[key] = bilder.platz[key] || platzBild(feld[0], feld[1]);
        const p = neu(new THREE.PlaneGeometry(PLATZ_B * gr, PLATZ_L * gr).rotateX(-HALB), mat(0xffffff, { bild: bilder.platz[key] }), el.x, 0.36, el.z);
        if (quer) p.rotation.y = HALB;
        const netz = neu(new THREE.BoxGeometry(PLATZ_B * gr * 0.62, 0.5, 0.06), mat(0x20242c), el.x, 0.62, el.z);
        if (quer) netz.rotation.y = HALB;
      }
      const dachFarbe = el.dachFarbe || 0xf0f0f0, dm = () => mat(dachFarbe, { beide: true, rau: 0.55, kantig: eckig });
      // Ein Vordach rundherum: außen niedrig, nach innen ansteigend, darunter ein dunkles Band aus Stahlträgern
      const vordach = (innen, hoch = Math.max(1.6, h * 0.22)) => {
        neu(dreh3d([[1.0, h + 0.75], [1.05, h + hoch]]), mat(0x4a5058, { beide: true, kantig: true }), el.x, 0, el.z);
        neu(dreh3d([[1.07, h + hoch], [innen, h + hoch * 1.55], [innen, h + hoch * 1.55 + 0.25], [1.07, h + hoch + 0.3]]), dm(), el.x, 0, el.z, true);
        return h + hoch * 1.55;
      };
      if (el.dach === 'ring') hoehe = vordach(0.6);
      else if (el.dach === 'schieb') {
        // Schiebedach: zwei Hälften auf Schienen, halb aufgefahren, damit man den Platz sieht
        const dy2 = vordach(0.68);
        for (const s of [-1, 1]) {
          neu(new THREE.BoxGeometry(hb * 0.42, 0.45, ht * 1.36), mat(dachFarbe, { rau: 0.5 }), el.x + s * hb * 0.5, dy2 + 0.55, el.z, true);
          neu(new THREE.BoxGeometry(hb * 2.1, 0.5, 0.7), mat(0x4a5058), el.x, dy2 + 0.15, el.z + s * ht * 0.7, true);        // die Schienen
        }
        hoehe = dy2 + 0.8;
      } else if (el.dach === 'zu' || el.dach === 'glas') {
        const glas = el.dach === 'glas', hoch = Math.max(1.6, h * 0.2);
        neu(dreh3d([[1.0, h + 0.75], [1.05, h + hoch]]), mat(0x4a5058, { beide: true, kantig: true }), el.x, 0, el.z);
        neu(dreh3d([[1.07, h + hoch], [0.6, h + hoch * 1.7], [0.001, h + hoch * 1.95]]), glas ? mat(0xcfe4f0, { beide: true, durch: 0.28, rau: 0.2 }) : dm(), el.x, 0, el.z, !glas);
        hoehe = h + hoch * 2;
      } else if (el.dach === 'blume') {
        // Acht Blätter wie bei einer Blume, leicht verdreht und halb geöffnet
        for (let i = 0; i < 8; i++) neu(new THREE.RingGeometry(0.36, 1.07, 5, 1, i * Math.PI / 4 + 0.05, Math.PI / 4 - 0.16).rotateX(-HALB).scale(hb, 1, ht), mat(dachFarbe, { beide: true, rau: 0.5 }), el.x, h + 1 + (i % 2) * 0.35, el.z, true);
        hoehe = h + 1.6;
      } else if (h >= 7) {
        // Offenes Stadion: vier Flutlicht-Masten an den Ecken
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) masten.push([el.x + sx * (hb + 1.2), 0, el.z + sz * (ht + 1.2)]);
        hoehe = h + 0.8;
      } else hoehe = h + 0.8;
      // Anzeigetafel auf dem oberen Rand (bei Stadien ohne geschlossenes Dach)
      if (h >= 5 && el.dach !== 'zu' && el.dach !== 'glas' && !el.wiese) {
        const breit = Math.min(9, hb * 0.5), ty = h + 0.75 + breit * 0.22;
        neu(new THREE.BoxGeometry(breit, breit * 0.42, 0.5), mat(0x15181e), el.x, ty, el.z - ht * 0.97, true);
        const bild = new THREE.Mesh(new THREE.PlaneGeometry(breit * 0.92, breit * 0.34), new THREE.MeshBasicMaterial({ color: 0x1c4f9a }));
        bild.userData.eigen = true; bild.position.set(el.x, ty, el.z - ht * 0.97 + 0.27); G.add(bild);
        for (let i = 0; i < 2; i++) { const zeile = new THREE.Mesh(new THREE.PlaneGeometry(breit * 0.8, breit * 0.07), new THREE.MeshBasicMaterial({ color: 0xf2f2e6 })); zeile.userData.eigen = true; zeile.position.set(el.x, ty + (i ? -1 : 1) * breit * 0.07, el.z - ht * 0.97 + 0.29); G.add(zeile); }
      }
      if (el.spitzen) for (const sx of [-1, 1]) for (const sz of [-1, 1]) neu(new THREE.CylinderGeometry(0.5, 1.1, h * 1.75, 8), mat(0xf4f4f4), el.x + sx * hb * 0.86, h * 0.875, el.z + sz * ht * 0.86, true);
      }
      for (const o of tueren) tuerBauen(o, 2.4, 2.8);
    } else if (el.a === 'haus') {
      // ---- Haus: Kasten mit Fenstern, Dach und Tür ----
      const glas = el.dach === 'glas';
      // Das Ziel im Städtchen (Pension oder Zuhause) bauen wir selbst: Ein fertiges Haus würde auf 24 m Breite gezogen komisch aussehen.
      const hm = el.ort === 'ziel' ? null : M(hausModell(el, g.stil));
      if (el.ort === 'ziel') G.add(pensionSchmuck(el, { mat, schatten }));
      if (hm) {
        // Ein fertiges Haus im Stil des Landes, in die Maße des Lageplans eingepasst. Die Vorderseite zeigt zur ersten Tür.
        hoehe = el.h * (el.dach === 'sattel' ? 1.3 : 1.08);
        haupt = einpassen(hm, el.x, el.z, el.b, el.t, hoehe, (tueren[0] || {}).seite || el.tuer || 's');
      } else {
      const geo = new THREE.BoxGeometry(el.b, el.h, el.t), uv = geo.attributes.uv;
      const wu = Math.max(1, Math.round(Math.max(el.b, el.t) / 3.4)), wv = Math.max(1, Math.round(el.h / 3.1));
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wu, uv.getY(i) * wv);
      haupt = neu(geo, glas ? mat(0xbfe4e8, { durch: 0.5, rau: 0.15 }) : mat(el.farbe || 0xd8d0c0, { bild: bilder.fenster }), el.x, el.h / 2, el.z, !glas);
      const df = el.dachFarbe || (glas ? 0xf4f8f8 : 0xf0ece4);
      if (el.dach === 'sattel' || glas) {
        // Dach mit Giebel: ein Dreieck, in die Länge gezogen
        const lang = Math.max(el.b, el.t) + 0.6, kurz = Math.min(el.b, el.t) + 0.6, hd = glas ? 1.6 : Math.min(3.2, kurz * 0.3);
        const dreieck = new THREE.Shape([new THREE.Vector2(-kurz / 2, 0), new THREE.Vector2(kurz / 2, 0), new THREE.Vector2(0, hd)]);
        const dg = new THREE.ExtrudeGeometry(dreieck, { depth: lang, bevelEnabled: false }).translate(0, 0, -lang / 2);
        if (el.b >= el.t) dg.rotateY(HALB);
        neu(dg, glas ? mat(df, { durch: 0.55, rau: 0.2 }) : mat(df), el.x, el.h, el.z, !glas);
        hoehe = el.h + hd;
      } else if (el.dach === 'zelt') {
        neu(new THREE.ConeGeometry(1, el.h * 0.55, 4).rotateY(Math.PI / 4).scale((el.b + 0.8) / 1.414, 1, (el.t + 0.8) / 1.414), mat(0xfafaf4), el.x, el.h + el.h * 0.275, el.z, true);
        hoehe = el.h * 1.55;
      } else neu(new THREE.BoxGeometry(el.b + 0.6, 0.28, el.t + 0.6), mat(df), el.x, el.h + 0.14, el.z, true);
      }
      for (const o of tueren) if (!o.info) tuerBauen(o);
      // Laternen neben den Türen
      for (const o of tueren) if (!o.info) { const quer = o.seite === 'o' || o.seite === 'w'; laternen.push([o.wx + (quer ? (o.seite === 'o' ? 0.5 : -0.5) : -2.3), 0, o.wz + (quer ? -2.3 : (o.seite === 's' ? 0.5 : -0.5)), WAND_DREH[o.seite]]);
        // … und auf der anderen Seite der Tür ein Blumenkübel, im Städtchen und bei kleinen Vereinen steht bei der Laterne noch eine Mülltonne
        kuebel.push([o.wx + (quer ? (o.seite === 'o' ? 0.6 : -0.6) : 2.3), 0, o.wz + (quer ? 2.3 : (o.seite === 's' ? 0.6 : -0.6)), (o.wx * 3 + o.wz) % 6.28]);
        if (g.zuFuss || (g.klein && g.stufe <= 1)) tonnen.push([o.wx + (quer ? (o.seite === 'o' ? 0.6 : -0.6) : -3.3), 0, o.wz + (quer ? -3.3 : (o.seite === 's' ? 0.6 : -0.6)), WAND_DREH[o.seite] + HALB]);
        // Vor dem Restaurant stehen zwei kleine Tische mit Stühlen (kleine Vereine haben dort schon ihre Schirm-Tische)
        if (o.id === 'essen' && !g.klein) for (const s of [-1, 1]) bistros.push([o.wx + (quer ? (o.seite === 'o' ? 1.6 : -1.6) : s * 5), 0, o.wz + (quer ? s * 5 : (o.seite === 's' ? 1.6 : -1.6)), WAND_DREH[o.seite] + HALB]);
      }
    } else if (el.a === 'plaetze') {
      // ---- Mehrere Tennisplätze nebeneinander (gezeichnet werden sie weiter unten alle auf einmal) ----
      const feld = el.feld || g.feld, key = feld[0] + '_' + feld[1];
      (plaetze[key] = plaetze[key] || { feld, liste: [] });
      haupt = flach(el.x, el.z, el.b + 1.4, el.t + 1.4, dunkler(feld[1], 0.72), 3, false, { glatt: true });
      for (let i = 0; i < el.nx; i++) for (let k = 0; k < el.nz; k++) {
        const x = el.x + (i - (el.nx - 1) / 2) * el.lx, z = el.z + (k - (el.nz - 1) / 2) * el.lz;
        plaetze[key].liste.push([x, 0.2, z, el.quer ? HALB : 0]);
        netze.push([x, 0.47, z, el.quer ? HALB : 0]);
        // Kleinigkeiten an jedem Platz: Schiedsrichterstuhl am Netz und zwei Bänke für die Spieler
        const qx = el.quer ? 0 : 1, qz = el.quer ? 1 : 0, seite = PLATZ_B * 0.36;
        stuehle.push([x + qx * seite, 0.2, z + qz * seite]);
        for (const s of [-1, 1]) baenke.push([x + qx * seite + qz * s * 1.8, 0.2, z + qz * seite + qx * s * 1.8, el.quer ? HALB : 0]);
      }
      // Flutlicht-Masten an den vier Ecken der Platzgruppe
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) masten.push([el.x + sx * (el.b / 2 + 0.3), 0, el.z + sz * (el.t / 2 + 0.3)]);
      if (el.ort === 'training') {
        const maschine = requisit('ballmaschine');
        if (maschine) { maschine.position.set(el.x - (el.nx - 1) / 2 * el.lx, 0.2, el.z - (el.nz - 1) / 2 * el.lz + (el.quer ? 0 : 4)); if (el.quer) maschine.position.x += 4; G.add(maschine); }
      }
      hoehe = 1.2;
    } else if (el.a === 'flaeche') {
      flach(el.x, el.z, el.b, el.t, el.farbe, el.e || 1, el.rund, el.wasser ? { rau: 0.2, metall: 0.15, glatt: true } : {});
      if (el.strasse) { strasseMalen(el, el.strasse); fahrbahnen.push({ laengs: el.strasse, x: el.x, z: el.z, breit: Math.min(el.b, el.t) }); }
      if (el.e === 2 && !el.wasser && !el.rund && (el.farbe === 0x5c9a4c || el.farbe === 0x4f8a45) && Math.min(el.b, el.t) >= 10) wiesen.push(el);
      if (el.modell) { const bm = M(el.modell); if (bm) stueck(bm, el.x, el.z, 0, (el.gr || 1)); }
      if (el.wasser && el.e) neu(el.rund ? new THREE.TorusGeometry(0.5, 0.012, 6, 40).rotateX(HALB).scale(el.b, 14, el.t) : new THREE.BoxGeometry(el.b + 0.5, 0.3, el.t + 0.5), mat(0xd8d4c8), el.x, el.rund ? 0.12 : -0.02, el.z);       // Beckenrand
    } else if (el.a === 'baeume') {
      for (const [x, z, gr] of plan.punkte.get(nr) || []) baeume[el.art].push([x, 0, z, x * 7 + z, gr]);
    } else if (el.a === 'statuen') {
      for (const [x, z] of plan.punkte.get(nr) || []) statuen.push([x, 0, z, Math.atan2(el.x - x, el.z - z)]);
    } else if (el.a === 'schirme') {
      (schirme[el.farbe] = schirme[el.farbe] || []).push(...(plan.punkte.get(nr) || []).map(([x, z, gr]) => [x, 0, z, 0, gr]));
    } else if (el.a === 'zelte') {
      for (const [x, z] of plan.punkte.get(nr) || []) zelte.push([x, 0, z]);
    } else if (el.a === 'autos') {
      for (const [x, z, f] of plan.punkte.get(nr) || []) autos.push([x, 0, z, 0, 1, f]);
    } else if (el.a === 'hecke') {
      const laub = M('boden_gras') ? Object.assign(M('boden_gras').clone(), { needsUpdate: true }) : null;      // das Gras-Bild, dunkelgrün gefärbt, sieht aus wie Blätter
      if (laub) laub.repeat.set(Math.max(1, Math.max(el.b, el.t) / 2.5), 0.5);
      neu(new THREE.BoxGeometry(el.b, 1.2, el.t), mat(laub ? 0x3c8240 : 0x2f6a34, { bild: laub }), el.x, 0.6, el.z, true);
    } else if (el.a === 'fahnen') {
      // Fahnenmasten in einer Reihe, jede Fahne hat ihre Farbe
      for (let i = 0; i < el.n; i++) { fahnenMasten.push([el.x + i * 1.6, 0, el.z]); fahnen.push([el.x + i * 1.6 + 0.62, 5.3, el.z, 0, 1, el.farben[i % el.farben.length]]); }
    } else if (el.a === 'huegel') {
      haupt = neu(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, HALB).scale(el.b, el.h * 2, el.t), mat(el.farbe), el.x, 0, el.z, true);
    } else if (el.a === 'meer') {
      flach(mx, el.ab + 600, 2400, 1200, 0x2a7ab8, 0.9, false, { rau: 0.18, metall: 0.2, glatt: true });
      flach(mx, el.ab + 1.5, 2400, 3, 0xe8dcc0, 0.95, false, { glatt: true });                                    // heller Strand-Streifen
    } else if (el.a === 'kugel') {
      if (el.voll) { neu(new THREE.CylinderGeometry(el.r * 1.3, el.r * 1.5, 0.6, 20), mat(0xe8e4dc), el.x, 0.3, el.z); haupt = neu(new THREE.SphereGeometry(el.r, 20, 14), mat(0xf4f0e8, { rau: 0.4 }), el.x, el.r + 0.6, el.z, true); }
      else if (M('mal_weltkugel')) {
        const km = M('mal_weltkugel');
        haupt = stueck(km, el.x, el.z, 0, (el.r * 2 + 3) / km.gr.y);
      } else {
        // Die Weltkugel aus Stahl: ein Gitter aus Längen- und Breitenkreisen auf drei Beinen
        haupt = neu(new THREE.SphereGeometry(el.r, 16, 10), new THREE.MeshStandardMaterial({ color: 0xc8d0d8, wireframe: true, roughness: 0.4, metalness: 0.6 }), el.x, el.r + 3, el.z);
        haupt.rotation.z = 0.4;
        neu(new THREE.CylinderGeometry(el.r * 0.12, el.r * 0.4, 3.4, 3), mat(0xa8b0b8, { metall: 0.5 }), el.x, 1.7, el.z);
      }
      hoehe = el.r * 2 + 3;
    } else if (el.a === 'bogen') {
      // Ein riesiger Würfel mit Loch: zwei Seitenwände, Deckel und Boden
      const w = 0xf2f0ec, bm = M('mal_arche');
      if (bm) einpassen(bm, el.x, el.z, el.b, el.t, el.h, 'w');
      else {
        for (const s of [-1, 1]) neu(new THREE.BoxGeometry(el.b * 0.17, el.h, el.t), mat(w), el.x, el.h / 2, el.z + s * el.t * 0.415, true);
        neu(new THREE.BoxGeometry(el.b * 0.9, el.h * 0.16, el.t), mat(w), el.x, el.h * 0.92, el.z, true);
        neu(new THREE.BoxGeometry(el.b * 0.9, 1.2, el.t), mat(w), el.x, 0.6, el.z);
      }
    } else if (el.a === 'tuerme') {
      el.p.forEach(([x, z, b, t, h], i) => {
        // Häuser und Hochhäuser der Stadt drumherum: als Modell, wenn es eines gibt
        const tm = el.spitz ? null : M(el.modell || (g.stil === 'england' && h < 14 ? 'haus_backstein' : h > 1.6 * Math.max(b, t) || i % 2 ? 'hochhaus_wohnblock' : 'hochhaus_glas'));
        if (tm) { einpassen(tm, x, z, b, t, h); return; }
        if (el.spitz) { neu(new THREE.ConeGeometry(b * 2.4, h, 4, 1).rotateY(Math.PI / 4), mat(el.farbe, { kantig: true }), x, h / 2, z, true); return; }
        const geo = new THREE.BoxGeometry(b, h, t), uv = geo.attributes.uv, wu = Math.max(1, Math.round(Math.max(b, t) / 3.4)), wv = Math.max(1, Math.round(h / 3.1));
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wu, uv.getY(i) * wv);
        neu(geo, mat(el.farbe, { bild: bilder.fenster }), x, h / 2, z, true);
        neu(new THREE.BoxGeometry(b + 0.4, 0.5, t + 0.4), mat(el.dach || 0x6a7078), x, h + 0.25, z);
      });
    } else if (el.a === 'obelisk') {
      const om = M('mal_obelisk');
      if (om) haupt = stueck(om, el.x, el.z, 0, (el.h + 1) / om.gr.y);
      else {
        neu(new THREE.BoxGeometry(2.4, 1, 2.4), mat(0xe8e4dc), el.x, 0.5, el.z);
        haupt = neu(new THREE.CylinderGeometry(0.3, 0.85, el.h, 4).rotateY(Math.PI / 4), mat(0xf6f2ea, { kantig: true }), el.x, 1 + el.h / 2, el.z, true);
      }
      hoehe = Math.min(8, el.h);
    } else if (el.a === 'leinwand') {
      if (el.b > 1) {
        // Große Leinwand auf zwei Pfosten
        const lw = new THREE.Group();
        lw.userData.eigen = false;
        lw.position.set(el.x, 0, el.z); lw.rotation.y = (el.dreh || 0) * Math.PI / 180;
        G.add(lw);
        const rahmen = new THREE.Mesh(new THREE.BoxGeometry(el.b, el.h, 0.5), mat(0x20242c)); rahmen.position.y = 2 + el.h / 2;
        const bild = new THREE.Mesh(new THREE.PlaneGeometry(el.b - 0.5, el.h - 0.5), new THREE.MeshBasicMaterial({ color: 0x3a7ad8 })); bild.position.set(0, 2 + el.h / 2, 0.27);
        const platz = new THREE.Mesh(new THREE.PlaneGeometry(el.b * 0.5, el.h * 0.5), new THREE.MeshBasicMaterial({ color: 0x4ab04a })); platz.position.set(0, 2 + el.h * 0.42, 0.29);
        const fuss = [-1, 1].map((s) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), mat(0x30343c)); f.position.set(s * el.b * 0.35, 1, 0); return f; });
        for (const m of [rahmen, bild, platz, ...fuss]) { m.userData.eigen = true; m.castShadow = schatten; lw.add(m); }
        haupt = rahmen; hoehe = 2 + el.h;
      } else hoehe = 1.2;
    } else if (el.a === 'glasdach') {
      neu(new THREE.BoxGeometry(el.b, 0.3, el.t), mat(0xcfe4f0, { durch: 0.3, rau: 0.2 }), el.x, el.h, el.z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) neu(new THREE.BoxGeometry(0.4, el.h, 0.4), mat(0xb8bcc4), el.x + sx * (el.b / 2 - 0.2), el.h / 2, el.z + sz * (el.t / 2 - 0.2));
    } else if (el.a === 'strasse') {
      // ---- Straßen für den Fahrdienst (wo sie liegen, rechnet strassenFuer in gelaende.js aus) ----
      if (el.art === 'aussen') {
        flach(el.x, el.z, el.b, el.t, ASPHALT_DUNKEL, 1.5);
        strasseMalen(el, el.laengs);
        fahrbahnen.push({ laengs: el.laengs, x: el.x, z: el.z, breit: Math.min(el.b, el.t) });
      } else if (el.art === 'zufahrt' || el.art === 'wende') {
        flach(el.x, el.z, el.b, el.t, ASPHALT_DUNKEL, 3, el.rund);
        if (el.art === 'zufahrt') for (const s of [-1, 1]) bordsteine.push([el.x + s * (el.b / 2 + 0.1), el.z, 0.2, el.t]);
        else neu(new THREE.CylinderGeometry(1.5, 1.5, 0.22, 20), mat(0x6a9a52), el.x, 0.11, el.z);       // die kleine Grün-Insel in der Mitte des Wendeplatzes
      } else if (el.art === 'bucht') {
        flach(el.x, el.z, el.b, el.t, ASPHALT_DUNKEL, 3);
        // Bordstein an der Seite, an der man einsteigt, und eine gelb umrandete Haltebucht für den Wagen
        const [ax, az] = el.auto;
        bordsteine.push([el.x, el.z + el.t / 2 + 0.1, el.b, 0.2]);
        striche.push([el.x, el.z - el.t / 2 + 0.2, el.b, 0.12]);
        const blick = (plan.teile.find((e) => e.a === 'auto') || {}).blick || 1;                  // der zweite Wagen wartet hinter dem ersten
        for (const [dx, dz, b, t] of [[0, -1.25, 13.4, 0.12], [-6.7, 0, 0.12, 2.5], [6.7, 0, 0.12, 2.5]]) gelbe.push([ax - blick * 3.4 + dx, az + dz, b, t]);
        // Zebrastreifen: Hier gehen die Besucher über die Vorfahrt
        const zx = ax + (el.x + el.b / 2 - ax > 9 ? 7.5 : -9.5);
        if (Math.abs(zx - el.x) < el.b / 2 - 1.5) for (let i = 0; i < 5; i++) striche.push([zx + (i - 2) * 0.9, el.z, 0.5, el.t - 0.5]);
        // Der Name auf der Straße
        const sb = strassenSchrift('FAHRDIENST');
        const sm = neu(new THREE.PlaneGeometry(6.2, 1.1).rotateX(-HALB), new THREE.MeshBasicMaterial({ map: sb, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -40 }), ax - 0.4, 0.19, el.z - 1.25);
        sm.rotation.y = Math.PI;
      } else if (el.art === 'schranke') {
        // Eine offene Schranke am Rand des Geländes: Pfosten, rot-weißer Balken (steht schräg nach oben) und ein Wachhäuschen
        const quer = el.laengs === 'x', halb = (quer ? el.t : el.b) / 2 + 0.5;
        const px = el.x + (quer ? 0 : -halb), pz = el.z + (quer ? -halb : 0);
        neu(new THREE.BoxGeometry(0.35, 1.1, 0.35), mat(0xd8d8d8), px, 0.55, pz, true);
        const balken = neu(new THREE.BoxGeometry(4.6, 0.12, 0.12).translate(2.3, 0, 0), mat(0xffffff, { bild: schrankenBild() }), px, 1.05, pz, true);
        balken.rotation.set(0, quer ? -HALB : 0, 1.05);
        neu(new THREE.BoxGeometry(1.6, 2.4, 1.6), mat(0xe8e6de), el.x + (quer ? 0 : halb + 1), 1.2, el.z + (quer ? halb + 1 : 0), true);
        neu(new THREE.BoxGeometry(1.9, 0.14, 1.9), mat(0x3a4048), el.x + (quer ? 0 : halb + 1), 2.47, el.z + (quer ? halb + 1 : 0), true);
        neu(new THREE.BoxGeometry(quer ? 1.62 : 1.1, 0.8, quer ? 1.1 : 1.62), mat(0x8ab4d0, { rau: 0.2 }), el.x + (quer ? 0 : halb + 1), 1.6, el.z + (quer ? halb + 1 : 0));
      } else if (el.art === 'hotelweg') {
        flach(el.x, el.z, el.b, el.t, ASPHALT_DUNKEL, 3);                                         // die Vorfahrt vor dem Hotel
      } else if (el.art === 'wagen') {
        wartende.push([el.x, el.z, el.blick || 1]);
      } else if (el.art === 'warten') {
        // Wartehäuschen: Glasdach auf vier Pfosten, Rückwand aus Glas, eine Bank und ein Schild
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) neu(new THREE.BoxGeometry(0.1, 2.4, 0.1), mat(0x3a4048, { metall: 0.4, rau: 0.5 }), el.x + sx * (el.b / 2 - 0.1), 1.2, el.z + sz * (el.t / 2 - 0.1), true);
        neu(new THREE.BoxGeometry(el.b + 0.5, 0.1, el.t + 0.7), mat(0x3a4048, { metall: 0.3, rau: 0.5 }), el.x, 2.45, el.z, true);
        neu(new THREE.BoxGeometry(el.b - 0.2, 1.9, 0.05), mat(0xbfdcea, { durch: 0.35, rau: 0.15 }), el.x, 1.25, el.z + el.t / 2 - 0.1);
        neu(new THREE.BoxGeometry(el.b - 1, 0.08, 0.45), mat(0x8a6a44), el.x, 0.5, el.z + 0.2, true);
        for (const sx of [-1, 1]) neu(new THREE.BoxGeometry(0.08, 0.5, 0.4), mat(0x3a4048), el.x + sx * (el.b / 2 - 0.8), 0.25, el.z + 0.2);
        hoehe = 2.5;
      }
    } else if (el.a === 'auto') {
      // Das Auto vom Fahrdienst: bei den großen Turnieren eine schwarze Limousine, sonst ein großer Geländewagen oder ein Kleinbus
      const am = M(g.klein ? (g.stufe >= 2 ? 'auto_suv' : 'auto_van') : 'auto_limousine');
      if (am) dienst = haupt = stueck(am, el.x, el.z, HALB * (el.blick || 1));
      else {
        // Ohne Modell: zwei Klötze und vier Räder. Sie hängen an einer Gruppe, damit der Wagen als Ganzes fahren kann (vorn = +z).
        dienst = new THREE.Group();
        dienst.position.set(el.x, 0, el.z); dienst.rotation.y = HALB * (el.blick || 1);
        G.add(dienst);
        haupt = neu(new THREE.BoxGeometry(el.t, 0.8, el.b), mat(0xe8e8ee), 0, 0.75, 0, true);
        const teile = [haupt, neu(new THREE.BoxGeometry(el.t * 0.9, 0.65, el.b * 0.55), mat(0x9ab8d8), 0, 1.45, 0, true)];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) teile.push(neu(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateZ(HALB), mat(0x1a1a1a), sx * el.t * 0.5, 0.36, sz * el.b * 0.3));
        for (const t of teile) dienst.add(t);
      }
      hoehe = 1.6;
    } else if (el.a === 'hotel') {
      // ---- Das Spieler-Hotel draußen an der Straße (hotelbau.js) ----
      const hb = hotelBauen(el, { mat, bilder, schatten });
      G.add(hb.gruppe);
      for (const [x, z] of hb.palmen) baeume.palme.push([x, 0, z, x * 7 + z, 1.1]);
      hoehe = hb.hoehe;
    } else if (el.a === 'wegweiser') {
      G.add(wegweiserBauen(el, { mat, schatten }));
    } else if (el.a === 'absperrung') {
      G.add(absperrungBauen(el, { mat, schatten }));
    } else if (el.a === 'zaun') {
      // Autogramm-Zaun mit drei wartenden Kindern
      haupt = neu(new THREE.BoxGeometry(el.b, 1.0, 0.08), mat(0x3a4a5a), el.x, 0.5, el.z, true);
      if (M('absperrgitter')) { haupt.visible = false; for (const s of [-1, 1]) gitterTeile.push([el.x + s, 0, el.z, HALB]); }
      for (let i = 0; i < 3; i++) {
        const kind = requisit('ballkind', { farbe: [0xe8442a, 0xe8f04a, 0x2a8af0][i], hell: [0.3, 0.72] });
        if (!kind) break;
        kind.position.set(el.x - 1.2 + i * 1.2, 0, el.z - 0.7);
        G.add(kind);
      }
      hoehe = 1.5;
    }

    else if (el.a === 'modell') {
      // Ein einzelnes Schmuckstück (z. B. eine Yacht im Hafen)
      const em = M(el.modell);
      if (em) stueck(em, el.x, el.z, (el.dreh || 0) * Math.PI / 180, el.gr || 1);
    }
    // ---- Begehbares Haus: alles, was bis hier gebaut wurde, ist „außen“ (wird versteckt, wenn man drinnen ist) ----
    const raum = raumVon.get(nr);
    if (raum) {
      const aussen = G.children.slice(vorher), innen = new THREE.Group();
      innen.visible = false;
      const drin = (form, material, x, y, z) => { const m = new THREE.Mesh(form, material); m.userData.eigen = true; m.position.set(x, y, z); m.receiveShadow = true; innen.add(m); return m; };
      const holz = bilder.dielen.clone(); holz.needsUpdate = true; holz.repeat.set(raum.b / 4, raum.t / 4);
      const fb = drin(new THREE.PlaneGeometry(raum.b, raum.t).rotateX(-HALB), mat(0xffffff, { bild: holz }), raum.x, 0.07, raum.z);
      Object.assign(fb.material, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -60 });
      const wandMat = mat(0xece6da);
      for (const w of raum.waende) drin(new THREE.BoxGeometry(w.b + (w.b < 1 ? 0.1 : 0), 1.15, w.t + (w.t < 1 ? 0.1 : 0)), wandMat, w.x, 0.575, w.z);
      for (const mo of raum.moebel) {
        const mm = M(mo.name);
        if (mm) stueck(mm, mo.x, mo.z, mo.dreh, 1, 1, 1, false, innen);
        else drin(new THREE.BoxGeometry(1.4, 0.9, 0.9), mat(0x8a7a66), mo.x, 0.45, mo.z).rotation.y = mo.dreh;
      }
      if (raum.sachen && raum.sachen.length) innen.add(moebelBauen(raum.sachen));       // alles Selbstgebaute: Regale, Tische, Pflanzen …
      G.add(innen);
      raeume.push({ r: raum, aussen, innen });
    }

    // ---- Schilder, gelbe Kreise und Antippen ----
    tueren.forEach((o, i) => {
      const vorgabe = namen[o.id] || {};
      // Name der Tür: bei den Orten für den Turniertag steht vorn, was man dort tut („Physio · Aorangi-Pavillon“)
      if (o.name0 === undefined) o.name0 = o.name || '';
      const eigen = o.name0, schlicht = /^(Besaiter|Presse|Spieler-Rest|Training|Kraftraum|Physio|Autogramm|Fahrdienst)/.test(eigen);
      if (o.info || o.id === 'court') o.name = eigen || vorgabe.name || el.name || '';
      else o.name = eigen && !schlicht ? `${vorgabe.name.replace('Fahrdienst zum Hotel', 'Fahrdienst')} · ${eigen}` : (vorgabe.name || eigen);
      o.text = o.text || vorgabe.text || '';
      // Gehört die Tür als einzige zum Baustein, hängt das Schild oben in der Mitte – sonst über der Tür
      const allein = tueren.length === 1 && (el.a === 'stadion' || el.a === 'haus') && Math.max(el.b, el.t) < 60;
      // Der Anker ist die Stelle, auf die der Pfeil des Schilds zeigt: Dachmitte oder die Wand über der Tür
      o.schild = schildBauen(o.name, o.info ? 'info' : 'ort', allein ? new THREE.Vector3(el.x, hoehe + 0.1, el.z) : new THREE.Vector3(o.wx, Math.min(hoehe, 3.2) + 0.1, o.wz));
      G.add(o.schild);
      o.kreis = neu(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-HALB), mat(o.info ? 0x6ac8f0 : 0xe8f04a), o.tx, 0.24, o.tz);
      o.kreis.material.polygonOffset = true; o.kreis.material.polygonOffsetFactor = -4; o.kreis.material.polygonOffsetUnits = -40;
    });
    if (haupt && tueren.length) { haupt.userData.ort = tueren[0]; klick.push(haupt); }
    // Bausteine mit Namen, aber ohne Tür, bekommen nur eine kleine Beschriftung
    if (el.name && !el.ort && !el.info) {
      const s = schildBauen(el.name, 'name', new THREE.Vector3(el.x, hoehe + 0.1, el.z));
      G.add(s);
      plan.namen = plan.namen || []; plan.namen.push(s);
    }
  });

  // ---- Alle Tennisplätze auf einmal ----
  for (const key of Object.keys(plaetze)) {
    const { feld, liste } = plaetze[key];
    bilder.platz[key] = bilder.platz[key] || platzBild(feld[0], feld[1]);
    viele(new THREE.PlaneGeometry(PLATZ_B, PLATZ_L).rotateX(-HALB), mat(0xffffff, { bild: bilder.platz[key] }), liste);
  }
  viele(new THREE.BoxGeometry(PLATZ_B * 0.62, 0.5, 0.06), mat(0x20242c), netze);

  // ---- Bäume: Stamm und Krone ----
  const BAUM = {
    laub: [new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6).translate(0, 0.9, 0), 0x6a4a2a, new THREE.SphereGeometry(1.6, 8, 6).translate(0, 3.0, 0), 0x2f7a3a],
    palme: [new THREE.CylinderGeometry(0.13, 0.2, 5.2, 6).translate(0, 2.6, 0), 0x8a7458, new THREE.SphereGeometry(1.7, 7, 4).scale(1, 0.32, 1).translate(0, 5.4, 0), 0x3a8a3a],
    pinie: [new THREE.CylinderGeometry(0.2, 0.3, 5.6, 6).translate(0, 2.8, 0), 0x6a4a34, new THREE.SphereGeometry(2.7, 9, 5).scale(1, 0.36, 1).translate(0, 6.2, 0), 0x2a5a30],
    zypresse: [new THREE.CylinderGeometry(0.14, 0.18, 1, 5).translate(0, 0.5, 0), 0x5a4030, new THREE.ConeGeometry(0.75, 6, 7).translate(0, 3.6, 0), 0x1f4a2a],
  };
  // ---- Die Landschaft rundherum: Berge, Wald, Vororte, Stadt, Felder (umgebung.js). Ihre Bäume kommen mit in die Baum-Listen. ----
  umgebungBauen({ g, plan, bilder, mat, neu, flach, G, baeume, wenig });
  // Mit Modellen: Die Bäume nah an den Türen sind echte Modelle (viele Dreiecke), alle anderen zwei gekreuzte Bilder desselben Baums.
  const nahGrenze = (() => {
    const weiten = [];
    for (const art of Object.keys(BAUM)) for (const b of baeume[art]) { b[5] = Math.min(...plan.orte.map((o) => Math.hypot(o.tx - b[0], o.tz - b[2]))); weiten.push(b[5]); }
    weiten.sort((a, b) => a - b);
    return weiten.length > NAH_BAEUME ? weiten[NAH_BAEUME] : Infinity;
  })();
  for (const art of Object.keys(BAUM)) {
    const [stamm, sf, krone, kf] = BAUM[art];
    const name = art === 'zypresse' && g.fichte ? 'fichte' : art, bm = M('baum_' + name), bild = M('baum_' + name + '_flach');
    if (bm && bild) {
      vieleM(bm, baeume[art].filter((b) => b[5] < nahGrenze).map(([x, y, z, dreh, gr]) => [x, y, z, dreh, gr]));
      const fern = baeume[art].filter((b) => b[5] >= nahGrenze), [fb, fh] = FLACH[name], h = BAUM_HOCH[name];
      const fm = new THREE.MeshBasicMaterial({ map: bild, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color().setScalar(1.45) });
      viele(new THREE.PlaneGeometry(fb * h, fh * h).translate(0, fh * h / 2, 0), fm, fern.map(([x, y, z, dreh, gr]) => [x, y, z, dreh, gr]));
      viele(new THREE.PlaneGeometry(fb * h, fh * h).translate(0, fh * h / 2, 0).rotateY(HALB), fm.clone(), fern.map(([x, y, z, dreh, gr]) => [x, y, z, dreh, gr]));
      continue;
    }
    viele(stamm, mat(sf), baeume[art], true);
    viele(krone, mat(kf, { kantig: true }), baeume[art], true);
  }
  // ---- Statuen aus Marmor: Sockel und Figur ----
  const st1 = M('mal_statue_rom'), st2 = M('mal_statue_rom2');
  if (st1 && st2) { vieleM(st1, statuen.filter((_, i) => i % 2 === 0)); vieleM(st2, statuen.filter((_, i) => i % 2 === 1)); }
  else {
    viele(new THREE.BoxGeometry(0.8, 0.9, 0.8).translate(0, 0.45, 0), mat(0xe4e0d8), statuen);
    viele(new THREE.CapsuleGeometry(0.26, 1.3, 2, 6).translate(0, 1.85, 0), mat(0xf8f6f0, { rau: 0.5 }), statuen, true);
  }
  // ---- Sonnenschirme und Zelte ----
  const hell = (f) => new THREE.Color(f).lerp(new THREE.Color(0xffffff), 0.45).getHex();
  const schirmM = M('schirmtisch'), zeltM = M('zelt'), standM = M('stand');
  for (const farbe of Object.keys(schirme)) {
    if (schirmM) { vieleM(schirmM, schirme[farbe].map(([x, y, z, d, gr], i) => [x, y, z, i * 1.3, gr, hell(+farbe)])); continue; }
    viele(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5).translate(0, 1.15, 0), mat(0x8a8a8a), schirme[farbe]);
    viele(new THREE.ConeGeometry(1.5, 0.6, 8).translate(0, 2.5, 0), mat(+farbe), schirme[farbe], true);
  }
  if (zeltM) {
    // Jedes dritte Zelt ist ein Imbiss-Stand
    vieleM(zeltM, zelte.filter((_, i) => !standM || i % 3 !== 1));
    if (standM) vieleM(standM, zelte.filter((_, i) => i % 3 === 1).map(([x, y, z]) => [x, y, z, 0]));
  } else {
    viele(new THREE.BoxGeometry(3.6, 2.2, 3.6).translate(0, 1.1, 0), mat(0xf4f2ec), zelte, true);
    viele(new THREE.ConeGeometry(2.9, 1.4, 4).rotateY(Math.PI / 4).translate(0, 2.9, 0), mat(0xffffff), zelte, true);
  }

  // ---- Geparkte Autos (Karosserie in sechs Farben, darauf das dunkle Dach mit den Fenstern) ----
  const farbig = (im, liste) => { if (!im) return; const c = new THREE.Color(); liste.forEach((e, i) => im.setColorAt(i, c.setHex(e[5]))); };
  const LACK = [0xd8d8dc, 0x30343c, 0xb83a2a, 0x2a4a8a, 0x8a8e96, 0xe8e4d8];
  const a1 = M('auto_kompakt'), a2 = M('auto_kombi');
  if (a1 && a2) {
    // Ganz normale Autos der Besucher, in verschiedenen Lackfarben (manche stehen andersherum in der Parklücke)
    const lack = autos.map(([x, y, z, d, gr, f], i) => [x, y, z, i % 3 === 0 ? Math.PI : 0, 1, hell(LACK[f])]);
    vieleM(a1, lack.filter((_, i) => i % 2 === 0)); vieleM(a2, lack.filter((_, i) => i % 2 === 1));
  } else {
    farbig(viele(new THREE.BoxGeometry(1.8, 0.75, 4.2).translate(0, 0.7, 0), mat(0xffffff, { rau: 0.4 }), autos, true), autos.map((a) => [0, 0, 0, 0, 0, LACK[a[5]]]));
    viele(new THREE.BoxGeometry(1.6, 0.55, 2.2).translate(0, 1.35, -0.2), mat(0x2a3440, { rau: 0.3 }), autos);
  }
  // ---- Straßen: Striche, Bordsteine, der zweite wartende Wagen und die Autos, die draußen vorbeifahren ----
  const streifen = (liste, farbe, y, hoch = 0) => {
    if (!liste.length) return;
    const geo = hoch ? new THREE.BoxGeometry(1, hoch, 1) : new THREE.PlaneGeometry(1, 1).rotateX(-HALB);
    const im = new THREE.InstancedMesh(geo, hoch ? mat(farbe) : new THREE.MeshBasicMaterial({ color: farbe, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -30 }), liste.length), o = new THREE.Object3D();
    liste.forEach(([x, z, b, t], i) => { o.position.set(x, y, z); o.scale.set(b, 1, t); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.userData.eigen = true; im.frustumCulled = false; im.receiveShadow = !!hoch;
    G.add(im);
  };
  streifen(striche, 0xeeeeea, 0.2); streifen(gelbe, 0xf0c832, 0.2); streifen(bordsteine, 0xb8b6ae, 0.09, 0.18);
  const dienstM = M(g.klein ? 'auto_van' : 'auto_suv');
  for (const [x, z, blick] of wartende) {
    if (dienstM) stueck(dienstM, x, z, HALB * blick);
    else { neu(new THREE.BoxGeometry(4.4, 0.8, 1.9), mat(0x22242a, { rau: 0.4 }), x, 0.75, z, true); neu(new THREE.BoxGeometry(2.6, 0.6, 1.7), mat(0x39424e, { rau: 0.3 }), x - 0.2, 1.4, z, true); }
  }
  // Fahrende Autos: Auf jeder Straße draußen sind ein paar unterwegs, auf jeder Spur in ihre Richtung (bewegt werden sie in anlage.js)
  const fahrer = [];
  if (!wenig) fahrbahnen.slice(0, 3).forEach((bahn, b) => {
    for (let i = 0; i < 3; i++) {
      const hin = (i + b) % 2 === 0, m3 = [a1, a2, dienstM][(i + b) % 3];
      let wagen;
      if (m3) { wagen = stueck(m3, 0, 0, 0); if (m3 !== dienstM) { wagen.material = m3.mat.clone(); wagen.material.color.setHex(hell(LACK[(i * 2 + b) % LACK.length])); wagen.userData.nurStoff = true; } }
      else {
        wagen = new THREE.Group(); G.add(wagen);
        const unten = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 4.2).translate(0, 0.7, 0), mat(LACK[(i * 2 + b) % LACK.length], { rau: 0.4 })), oben = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.2).translate(0, 1.35, -0.2), mat(0x2a3440, { rau: 0.3 }));
        for (const t of [unten, oben]) { t.userData.eigen = true; t.castShadow = schatten; wagen.add(t); }
      }
      // Rechtsverkehr: Wer nach Osten (+x) fährt, fährt auf der südlichen Spur; wer nach Süden (+z) fährt, auf der westlichen
      const spur = Math.min(1.9, bahn.breit / 4) * (hin ? 1 : -1);
      fahrer.push({ wagen, laengs: bahn.laengs, mitte: bahn.laengs === 'x' ? bahn.x : bahn.z, quer: bahn.laengs === 'x' ? bahn.z + spur : bahn.x - spur, hin, tempo: 9 + ((i * 7 + b * 3) % 5), weg: (i * 131 + b * 77) % 460, lang: 460 });
    }
  });
  // ---- Flutlicht, Schiedsrichterstühle, Bänke, Fahnen ----
  const lichtM = masten.length <= 24 ? M('flutlicht') : null;        // das Flutlicht-Modell hat viele Dreiecke: nur, wenn es wenige Masten sind
  if (lichtM) vieleM(lichtM, masten.map(([x, y, z], i) => [x, y, z, x < mx ? HALB : -HALB]), false);
  else {
    viele(new THREE.CylinderGeometry(0.09, 0.14, 9, 5).translate(0, 4.5, 0), mat(0x9a9ea6), masten);
    viele(new THREE.BoxGeometry(1.3, 0.5, 0.5).translate(0, 9.1, 0), mat(0xf4f4e8), masten);
  }
  // In alten Städten (England, Europa, Alpen, Mittelmeer) und im Städtchen steht eine alte Laterne aus Gusseisen
  const altStadt = g.zuFuss || ['england', 'europa', 'alpen', 'mittelmeer'].includes(g.stil);
  const latM = (altStadt && M('laterne_alt')) || M('laterne'), gitM = M('absperrgitter');
  if (latM) vieleM(latM, laternen, false);
  const kuebelM = M('pflanzkuebel'), tonneM = M('muelltonne'), bistroM = M('bistro');
  if (kuebelM) vieleM(kuebelM, kuebel);
  if (tonneM) vieleM(tonneM, tonnen);
  if (bistroM) vieleM(bistroM, bistros);
  if (gitM) vieleM(gitM, gitterTeile);
  // ---- Leben auf den Wiesen: Picknick-Gruppen und Liegestühle (nur wo rundherum genug Platz zum Vorbeilaufen bleibt) ----
  const pickM = M('picknick'), liegeM = M('liegestuhl');
  if (pickM && liegeM) {
    let zw = 99;
    const zf = () => { zw = (zw * 16807) % 2147483647; return zw / 2147483647; };
    const pick = [], liege = [], tische = [], tischM = M('picknicktisch');
    for (const el of wiesen) {
      const n = Math.min(7, Math.round(el.b * el.t / 90));
      for (let i = 0, versuch = 0; i < n && versuch < 60; versuch++) {
        const x = el.x + (zf() - 0.5) * (el.b - 5), z = el.z + (zf() - 0.5) * (el.t - 5);
        let platz = pick.concat(liege, tische).every((p) => Math.hypot(p[0] - x, p[2] - z) > 4.5) && plan.orte.every((o) => Math.hypot(o.tx - x, o.tz - z) > 5);
        for (let dx = -3; dx <= 3 && platz; dx++) for (let dz = -3; dz <= 3; dz++) if (!frei(gitter, x + dx, z + dz)) { platz = false; break; }
        if (!platz) continue;
        (tischM && i % 3 === 2 ? tische : i % 2 ? liege : pick).push([x, 0.06, z, zf() * 6.28]);      // jeder dritte Fleck: ein leerer Picknick-Tisch
        // Die Stelle im Wege-Gitter sperren, damit niemand durch die Picknick-Decke läuft
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const ix = Math.floor((x + dx * 0.8 - gitter.x0) / gitter.zelle), iz = Math.floor((z + dz * 0.8 - gitter.z0) / gitter.zelle); if (ix >= 0 && iz >= 0 && ix < gitter.nx && iz < gitter.nz) gitter.zu[iz * gitter.nx + ix] = 1; }
        i++;
      }
    }
    vieleM(pickM, pick); vieleM(liegeM, liege); if (tischM) vieleM(tischM, tische);
  }
  viele(new THREE.BoxGeometry(0.5, 1.5, 0.5).translate(0, 0.75, 0), mat(0x2a5a3a), stuehle);
  // Bänke für die Spieler: bei kleinen Turnieren weiße Plastikstühle wie in jedem Tennisverein, sonst eine schlichte Bank
  const stuhlM = g.klein && g.stufe <= 1 ? M('plastikstuhl') : null;
  if (stuhlM) vieleM(stuhlM, baenke.map(([x, y, z, quer]) => [x, y, z, quer ? Math.PI : -HALB]));
  else viele(new THREE.BoxGeometry(0.4, 0.42, 1.3).translate(0, 0.21, 0), mat(0xe8e4d8), baenke);
  viele(new THREE.CylinderGeometry(0.05, 0.06, 6, 5).translate(0, 3, 0), mat(0xd8d8d8), fahnenMasten);
  farbig(viele(new THREE.BoxGeometry(1.2, 0.8, 0.04), mat(0xffffff, { beide: true }), fahnen), fahnen);

  bilder.fenster.userData.weg = bilder.publikum.userData.weg = true;
  fahrerSetzen(fahrer, 0);
  return { gruppe: G, klick, boden, bilder, gewollt, raeume, fahrer, dienst };
}

// Die Autos auf den Straßen draußen ein Stück weiterfahren lassen. Am Ende der Straße tauchen sie am Anfang wieder auf.
// vor = { x, z } der Wagen vom Fahrdienst, wenn er gerade auf der Straße fährt: Wer dicht hinter ihm ist, bremst und wartet.
export function fahrerSetzen(fahrer, dt, vor = null) {
  for (const f of fahrer) {
    if (vor) {
      const p = f.wagen.position, r = f.hin ? 1 : -1, laengs = f.laengs === 'x';
      const voraus = ((laengs ? vor.x - p.x : vor.z - p.z)) * r, daneben = Math.abs(laengs ? vor.z - p.z : vor.x - p.x);
      if (voraus > 0 && voraus < 10 && daneben < 1.7) continue;
    }
    f.weg = (f.weg + f.tempo * dt) % f.lang;
    const l = f.mitte + (f.hin ? 1 : -1) * (f.weg - f.lang / 2);
    if (f.laengs === 'x') { f.wagen.position.set(l, 0, f.quer); f.wagen.rotation.y = f.hin ? HALB : -HALB; }
    else { f.wagen.position.set(f.quer, 0, l); f.wagen.rotation.y = f.hin ? 0 : Math.PI; }
  }
}
// Weiße Schrift, die auf die Straße gemalt ist
function strassenSchrift(text) {
  const b = document.createElement('canvas'); b.width = 512; b.height = 96;
  const s = b.getContext('2d');
  s.fillStyle = '#f0f0ea'; s.font = 'bold 78px sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
  s.fillText(text, 256, 52, 500);
  const bild = new THREE.CanvasTexture(b); bild.colorSpace = THREE.SRGBColorSpace; bild.anisotropy = 4;
  return bild;
}
// Rot-weiße Streifen für die Schranke
function schrankenBild() {
  const b = document.createElement('canvas'); b.width = 64; b.height = 8;
  const s = b.getContext('2d');
  for (let i = 0; i < 8; i++) { s.fillStyle = i % 2 ? '#f4f4f0' : '#d0302a'; s.fillRect(i * 8, 0, 8, 8); }
  const bild = new THREE.CanvasTexture(b); bild.colorSpace = THREE.SRGBColorSpace;
  return bild;
}
// Der goldene Glücksball mit einem leuchtenden Ring auf dem Boden
export function gluecksballBauen() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xc88a00, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 }));
  ball.position.y = 0.9; ring.position.y = 0.26;
  ball.userData.eigen = ring.userData.eigen = true;
  g.add(ball, ring);
  g.userData.ball = ball;
  return g;
}
