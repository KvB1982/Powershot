// Powershot – baut ein Turniergelände in 3D aus seinem Lageplan (js/gelaende.js).
//
// Alles besteht aus einfachen Formen: Ein Stadion ist ein Ring mit schrägen Rängen, ein Haus ein Kasten mit Dach,
// ein Baum ein Stamm mit Kugel. Dinge, die oft vorkommen (Plätze, Bäume, Zuschauer), werden als EINE Form
// viele Male gezeichnet („InstancedMesh“). Das spart dem iPad viel Arbeit.
import * as THREE from 'three';
import { requisit } from './requisiten.js';
import { PLATZ_L, PLATZ_B } from './gelaende.js';
import { frei } from './wege.js';

const HALB = Math.PI / 2;

// Ein Schild mit Text (wird auf ein kleines Bild gemalt). art: 'ort' = weiß, 'info' = hellblau, 'name' = nur Beschriftung
export function schildBauen(text, art = 'ort') {
  const bild = document.createElement('canvas');
  bild.width = 512; bild.height = 96;
  const s = bild.getContext('2d');
  s.fillStyle = art === 'info' ? '#dff0ff' : art === 'name' ? 'rgba(20,28,48,0.72)' : '#fdfdf6';
  s.beginPath(); if (s.roundRect) s.roundRect(2, 2, 508, 92, 18); else s.rect(2, 2, 508, 92); s.fill();
  s.fillStyle = art === 'name' ? '#ffffff' : '#16203a'; s.font = 'bold 50px sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
  s.fillText((art === 'info' ? 'ℹ️ ' : '') + text, 256, 50, 490);
  const tex = new THREE.CanvasTexture(bild);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: art !== 'name' }));
  m.userData.eigen = true;
  m.userData.gross = art === 'name' ? 0.72 : 1;
  m.scale.set(4.6, 0.86, 1);
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

// Baut das ganze Gelände. plan = planVon(id) aus gelaende.js · gitter = wo man laufen kann (für die Besucher) ·
// namen = { court: 'Centre Court', … } Namen und Texte der Orte, falls der Plan keinen eigenen Namen hat
export function baueGelaende(plan, gitter, { schatten = true, namen = {}, wenig = false } = {}) {
  const g = plan.g, G = new THREE.Group(), klick = [];
  const bilder = { fenster: fensterBild(), publikum: publikumBild(), platz: {} };
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
  // Eine flache Fläche auf dem Boden. e = Ebene (höhere liegen über niedrigeren)
  const flach = (x, z, b, t, farbe, e = 1, rund = false, o = {}) => {
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
  const boden = neu(new THREE.PlaneGeometry(2400, 2400).rotateX(-HALB), mat(g.umland), mx, 0, mz);
  Object.assign(boden.material, { polygonOffset: true, polygonOffsetFactor: 12, polygonOffsetUnits: 200 });
  flach(mx, mz, r.x1 - r.x0 + 6, r.z1 - r.z0 + 6, g.boden, 0.8);

  const plaetze = {};        // Farbe → Liste aller Plätze dieser Farbe
  const netze = [], baeume = { laub: [], palme: [], pinie: [], zypresse: [] }, statuen = [], schirme = {}, zelte = [];
  const autos = [], masten = [], stuehle = [], baenke = [], fahnenMasten = [], fahnen = [];
  const tuerenVon = (nr) => plan.orte.filter((o) => o.teil === nr);
  const tuerBauen = (o, breit = 1.3, hoch = 2.1) => {
    const quer = o.seite === 'o' || o.seite === 'w';
    neu(new THREE.BoxGeometry(quer ? 0.14 : breit, hoch, quer ? breit : 0.14), mat(0x1a1a22), o.wx, hoch / 2, o.wz);
  };

  plan.teile.forEach((el, nr) => {
    const tueren = tuerenVon(nr);
    let haupt = null, hoehe = el.h || 0;

    if (el.a === 'stadion') {
      // ---- Stadion: außen die Wand, innen schräge Ränge mit Zuschauern, unten der Platz, oben vielleicht ein Dach ----
      const ecken = { oval: 36, rund: 36, acht: 8, eckig: 4 }[el.form || 'oval'], eckig = ecken <= 8;
      const dreh = eckig ? Math.PI / ecken : 0, k = eckig ? 1 / Math.cos(Math.PI / ecken) : 1;        // k: damit die geraden Seiten genau auf dem Rand liegen
      const hb = el.b / 2, ht = el.t / 2, h = el.h, INNEN = 0.44;
      const form = (geo) => geo.rotateY(dreh).scale(hb, 1, ht);
      haupt = neu(form(new THREE.CylinderGeometry(k, k, h, ecken, 1, true)), mat(el.farbe || 0xd0d0d0, { beide: true }), el.x, h / 2, el.z, true);
      const pub = bilder.publikum.clone(); pub.needsUpdate = true; pub.repeat.set(Math.round((el.b + el.t) / 5), Math.max(1, Math.round(h / 3.5)));
      neu(form(new THREE.CylinderGeometry(k * 0.985, k * INNEN, h * 0.9, ecken, 1, true)), mat(el.sitz || 0x8a8a90, { beide: true, bild: pub }), el.x, 0.3 + h * 0.45, el.z);
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
      const dachFarbe = el.dachFarbe || 0xf0f0f0, dy = h + 0.25;
      const ring = (innen) => neu(form(new THREE.RingGeometry(k * innen, k * 1.04, ecken, 1).rotateX(-HALB)), mat(dachFarbe, { beide: true, rau: 0.6 }), el.x, dy, el.z, true);
      if (el.dach === 'ring') ring(0.6);
      else if (el.dach === 'schieb') {
        // Schiebedach: zwei Hälften, in der Mitte offen, damit man den Platz sieht
        ring(0.66);
        for (const s of [-1, 1]) neu(new THREE.BoxGeometry(hb * 0.36, 0.5, ht * 1.3), mat(dachFarbe, { rau: 0.6 }), el.x + s * hb * 0.5, dy + 0.5, el.z, true);
      } else if (el.dach === 'zu') neu(form(new THREE.CircleGeometry(k * 1.04, ecken).rotateX(-HALB)), mat(dachFarbe, { beide: true }), el.x, dy, el.z, true);
      else if (el.dach === 'glas') neu(form(new THREE.CircleGeometry(k * 1.02, ecken).rotateX(-HALB)), mat(0xcfe4f0, { beide: true, durch: 0.15, rau: 0.2 }), el.x, dy, el.z);
      else if (el.dach === 'blume') {
        // Acht Blätter wie bei einer Blume, leicht verdreht und halb geöffnet
        for (let i = 0; i < 8; i++) neu(new THREE.RingGeometry(0.36, 1.07, 5, 1, i * Math.PI / 4 + 0.05, Math.PI / 4 - 0.16).rotateX(-HALB).scale(hb, 1, ht), mat(dachFarbe, { beide: true, rau: 0.5 }), el.x, dy + (i % 2) * 0.35, el.z, true);
      }
      if (el.spitzen) for (const sx of [-1, 1]) for (const sz of [-1, 1]) neu(new THREE.CylinderGeometry(0.5, 1.1, h * 1.75, 8), mat(0xf4f4f4), el.x + sx * hb * 0.86, h * 0.875, el.z + sz * ht * 0.86, true);
      for (const o of tueren) tuerBauen(o, 2.4, 2.8);
    } else if (el.a === 'haus') {
      // ---- Haus: Kasten mit Fenstern, Dach und Tür ----
      const glas = el.dach === 'glas';
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
      for (const o of tueren) tuerBauen(o);
    } else if (el.a === 'plaetze') {
      // ---- Mehrere Tennisplätze nebeneinander (gezeichnet werden sie weiter unten alle auf einmal) ----
      const feld = el.feld || g.feld, key = feld[0] + '_' + feld[1];
      (plaetze[key] = plaetze[key] || { feld, liste: [] });
      haupt = flach(el.x, el.z, el.b + 1.4, el.t + 1.4, dunkler(feld[1], 0.72), 3);
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
      flach(el.x, el.z, el.b, el.t, el.farbe, el.e || 1, el.rund, el.wasser ? { rau: 0.2, metall: 0.15 } : {});
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
      neu(new THREE.BoxGeometry(el.b, 1.2, el.t), mat(0x2f6a34), el.x, 0.6, el.z, true);
    } else if (el.a === 'fahnen') {
      // Fahnenmasten in einer Reihe, jede Fahne hat ihre Farbe
      for (let i = 0; i < el.n; i++) { fahnenMasten.push([el.x + i * 1.6, 0, el.z]); fahnen.push([el.x + i * 1.6 + 0.62, 5.3, el.z, 0, 1, el.farben[i % el.farben.length]]); }
    } else if (el.a === 'huegel') {
      haupt = neu(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, HALB).scale(el.b, el.h * 2, el.t), mat(el.farbe), el.x, 0, el.z, true);
    } else if (el.a === 'berge') {
      // Berge am Horizont: eine Reihe aus großen, kantigen Kegeln
      let z = 7;
      const zf = () => { z = (z * 16807) % 2147483647; return z / 2147483647; };
      for (let i = -5; i <= 5; i++) {
        const weit = 230 + zf() * 80, quer = i * 95 + (zf() - 0.5) * 50, hh = el.h * (0.6 + zf() * 0.5), rr = 80 + zf() * 50;
        const px = el.seite === 'w' ? r.x0 - weit : el.seite === 'o' ? r.x1 + weit : mx + quer;
        const pz = el.seite === 'n' ? r.z0 - weit : el.seite === 's' ? r.z1 + weit : mz + quer;
        neu(new THREE.ConeGeometry(rr, hh, 6, 1).rotateY(zf() * 3), mat(dunkler(el.farbe, 0.85 + zf() * 0.3), { kantig: true }), px, hh / 2 - 1, pz);
      }
    } else if (el.a === 'meer') {
      flach(mx, el.ab + 600, 2400, 1200, 0x2a7ab8, 0.9, false, { rau: 0.18, metall: 0.2 });
      flach(mx, el.ab + 1.5, 2400, 3, 0xe8dcc0, 0.95);                                    // heller Strand-Streifen
    } else if (el.a === 'kugel') {
      if (el.voll) { neu(new THREE.CylinderGeometry(el.r * 1.3, el.r * 1.5, 0.6, 20), mat(0xe8e4dc), el.x, 0.3, el.z); haupt = neu(new THREE.SphereGeometry(el.r, 20, 14), mat(0xf4f0e8, { rau: 0.4 }), el.x, el.r + 0.6, el.z, true); }
      else {
        // Die Weltkugel aus Stahl: ein Gitter aus Längen- und Breitenkreisen auf drei Beinen
        haupt = neu(new THREE.SphereGeometry(el.r, 16, 10), new THREE.MeshStandardMaterial({ color: 0xc8d0d8, wireframe: true, roughness: 0.4, metalness: 0.6 }), el.x, el.r + 3, el.z);
        haupt.rotation.z = 0.4;
        neu(new THREE.CylinderGeometry(el.r * 0.12, el.r * 0.4, 3.4, 3), mat(0xa8b0b8, { metall: 0.5 }), el.x, 1.7, el.z);
      }
      hoehe = el.r * 2 + 3;
    } else if (el.a === 'bogen') {
      // Ein riesiger Würfel mit Loch: zwei Seitenwände, Deckel und Boden
      const w = 0xf2f0ec;
      for (const s of [-1, 1]) neu(new THREE.BoxGeometry(el.b * 0.17, el.h, el.t), mat(w), el.x, el.h / 2, el.z + s * el.t * 0.415, true);
      neu(new THREE.BoxGeometry(el.b * 0.9, el.h * 0.16, el.t), mat(w), el.x, el.h * 0.92, el.z, true);
      neu(new THREE.BoxGeometry(el.b * 0.9, 1.2, el.t), mat(w), el.x, 0.6, el.z);
    } else if (el.a === 'tuerme') {
      for (const [x, z, b, t, h] of el.p) {
        if (el.spitz) { neu(new THREE.ConeGeometry(b * 2.4, h, 4, 1).rotateY(Math.PI / 4), mat(el.farbe, { kantig: true }), x, h / 2, z, true); continue; }
        const geo = new THREE.BoxGeometry(b, h, t), uv = geo.attributes.uv, wu = Math.max(1, Math.round(Math.max(b, t) / 3.4)), wv = Math.max(1, Math.round(h / 3.1));
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wu, uv.getY(i) * wv);
        neu(geo, mat(el.farbe, { bild: bilder.fenster }), x, h / 2, z, true);
        neu(new THREE.BoxGeometry(b + 0.4, 0.5, t + 0.4), mat(el.dach || 0x6a7078), x, h + 0.25, z);
      }
    } else if (el.a === 'obelisk') {
      neu(new THREE.BoxGeometry(2.4, 1, 2.4), mat(0xe8e4dc), el.x, 0.5, el.z);
      haupt = neu(new THREE.CylinderGeometry(0.3, 0.85, el.h, 4).rotateY(Math.PI / 4), mat(0xf6f2ea, { kantig: true }), el.x, 1 + el.h / 2, el.z, true);
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
    } else if (el.a === 'auto') {
      // Das Auto vom Fahrdienst: zwei Klötze und vier Räder
      haupt = neu(new THREE.BoxGeometry(el.b, 0.8, el.t), mat(0xe8e8ee), el.x, 0.75, el.z, true);
      neu(new THREE.BoxGeometry(el.b * 0.55, 0.65, el.t * 0.9), mat(0x9ab8d8), el.x, 1.45, el.z, true);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) neu(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateX(HALB), mat(0x1a1a1a), el.x + sx * el.b * 0.3, 0.36, el.z + sz * el.t * 0.5);
      hoehe = 1.6;
    } else if (el.a === 'zaun') {
      // Autogramm-Zaun mit drei wartenden Kindern
      haupt = neu(new THREE.BoxGeometry(el.b, 1.0, 0.08), mat(0x3a4a5a), el.x, 0.5, el.z, true);
      for (let i = 0; i < 3; i++) {
        const kind = requisit('ballkind', { farbe: [0xe8442a, 0xe8f04a, 0x2a8af0][i], hell: [0.3, 0.72] });
        if (!kind) break;
        kind.position.set(el.x - 1.2 + i * 1.2, 0, el.z - 0.7);
        G.add(kind);
      }
      hoehe = 1.5;
    }

    // ---- Schilder, gelbe Kreise und Antippen ----
    tueren.forEach((o, i) => {
      const vorgabe = namen[o.id] || {};
      // Name der Tür: bei den Orten für den Turniertag steht vorn, was man dort tut („Physio · Aorangi-Pavillon“)
      const eigen = o.name || '', schlicht = /^(Besaiter|Presse|Spieler-Rest|Training|Kraftraum|Physio|Autogramm|Fahrdienst)/.test(eigen);
      if (o.info || o.id === 'court') o.name = eigen || vorgabe.name || el.name || '';
      else o.name = eigen && !schlicht ? `${vorgabe.name.replace('Fahrdienst zum Hotel', 'Fahrdienst')} · ${eigen}` : (vorgabe.name || eigen);
      o.text = o.text || vorgabe.text || '';
      // Gehört die Tür als einzige zum Baustein, hängt das Schild oben in der Mitte – sonst über der Tür
      const allein = tueren.length === 1 && (el.a === 'stadion' || el.a === 'haus') && Math.max(el.b, el.t) < 60;
      o.schild = schildBauen(o.name, o.info ? 'info' : 'ort');
      o.schild.position.set(allein ? el.x : o.wx, allein ? hoehe + 1.6 : Math.min(hoehe, 3.2) + 1.5 + (i % 2) * 0.01, allein ? el.z : o.wz);
      G.add(o.schild);
      o.kreis = neu(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-HALB), mat(o.info ? 0x6ac8f0 : 0xe8f04a), o.tx, 0.24, o.tz);
      o.kreis.material.polygonOffset = true; o.kreis.material.polygonOffsetFactor = -4; o.kreis.material.polygonOffsetUnits = -40;
    });
    if (haupt && tueren.length) { haupt.userData.ort = tueren[0]; klick.push(haupt); }
    // Bausteine mit Namen, aber ohne Tür, bekommen nur eine kleine Beschriftung
    if (el.name && !el.ort && !el.info) {
      const s = schildBauen(el.name, 'name');
      s.position.set(el.x, hoehe + 1.3, el.z);
      s.userData.nurName = true;
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
  for (const art of Object.keys(BAUM)) {
    const [stamm, sf, krone, kf] = BAUM[art];
    viele(stamm, mat(sf), baeume[art], true);
    viele(krone, mat(kf, { kantig: true }), baeume[art], true);
  }
  // ---- Statuen aus Marmor: Sockel und Figur ----
  viele(new THREE.BoxGeometry(0.8, 0.9, 0.8).translate(0, 0.45, 0), mat(0xe4e0d8), statuen);
  viele(new THREE.CapsuleGeometry(0.26, 1.3, 2, 6).translate(0, 1.85, 0), mat(0xf8f6f0, { rau: 0.5 }), statuen, true);
  // ---- Sonnenschirme und Zelte ----
  for (const farbe of Object.keys(schirme)) {
    viele(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5).translate(0, 1.15, 0), mat(0x8a8a8a), schirme[farbe]);
    viele(new THREE.ConeGeometry(1.5, 0.6, 8).translate(0, 2.5, 0), mat(+farbe), schirme[farbe], true);
  }
  viele(new THREE.BoxGeometry(3.6, 2.2, 3.6).translate(0, 1.1, 0), mat(0xf4f2ec), zelte, true);
  viele(new THREE.ConeGeometry(2.9, 1.4, 4).rotateY(Math.PI / 4).translate(0, 2.9, 0), mat(0xffffff), zelte, true);

  // ---- Geparkte Autos (Karosserie in sechs Farben, darauf das dunkle Dach mit den Fenstern) ----
  const farbig = (im, liste) => { if (!im) return; const c = new THREE.Color(); liste.forEach((e, i) => im.setColorAt(i, c.setHex(e[5]))); };
  const LACK = [0xd8d8dc, 0x30343c, 0xb83a2a, 0x2a4a8a, 0x8a8e96, 0xe8e4d8];
  farbig(viele(new THREE.BoxGeometry(1.8, 0.75, 4.2).translate(0, 0.7, 0), mat(0xffffff, { rau: 0.4 }), autos, true), autos.map((a) => [0, 0, 0, 0, 0, LACK[a[5]]]));
  viele(new THREE.BoxGeometry(1.6, 0.55, 2.2).translate(0, 1.35, -0.2), mat(0x2a3440, { rau: 0.3 }), autos);
  // ---- Flutlicht, Schiedsrichterstühle, Bänke, Fahnen ----
  viele(new THREE.CylinderGeometry(0.09, 0.14, 9, 5).translate(0, 4.5, 0), mat(0x9a9ea6), masten);
  viele(new THREE.BoxGeometry(1.3, 0.5, 0.5).translate(0, 9.1, 0), mat(0xf4f4e8), masten);
  viele(new THREE.BoxGeometry(0.5, 1.5, 0.5).translate(0, 0.75, 0), mat(0x2a5a3a), stuehle);
  viele(new THREE.BoxGeometry(0.4, 0.42, 1.3).translate(0, 0.21, 0), mat(0xe8e4d8), baenke);
  viele(new THREE.CylinderGeometry(0.05, 0.06, 6, 5).translate(0, 3, 0), mat(0xd8d8d8), fahnenMasten);
  farbig(viele(new THREE.BoxGeometry(1.2, 0.8, 0.04), mat(0xffffff, { beide: true }), fahnen), fahnen);

  // ---- Besucher: bunte Figuren, die in der Nähe der Türen herumstehen ----
  if (!wenig) {
    let z = 4711;
    const zf = () => { z = (z * 16807) % 2147483647; return z / 2147483647; };
    const leute = [], n = g.leute ?? 110;
    for (let i = 0, versuch = 0; i < n && versuch < n * 20; versuch++) {
      const o = plan.orte[Math.floor(zf() * plan.orte.length)], w = zf() * 6.283, weit = 3.5 + zf() * 22;
      const x = o.tx + Math.sin(w) * weit, zz = o.tz + Math.cos(w) * weit;
      if (!frei(gitter, x, zz) || !frei(gitter, x + 0.6, zz) || !frei(gitter, x - 0.6, zz) || plan.orte.some((p) => Math.hypot(p.tx - x, p.tz - zz) < 2.4)) continue;
      leute.push([x, 0, zz, w, 0.9 + zf() * 0.2]); i++;
    }
    const koerper = viele(new THREE.CapsuleGeometry(0.2, 0.95, 2, 6).translate(0, 0.72, 0), mat(0xffffff), leute, true);
    const kopf = viele(new THREE.SphereGeometry(0.16, 8, 6).translate(0, 1.55, 0), mat(0xffffff), leute);
    const kleider = [0xe84a3a, 0x3a6ae8, 0xf0d040, 0x3aa85a, 0xf4f4f0, 0xe89ac0, 0x404858, 0xf08a3a, 0x8a5ac8, 0x3ab8c8], haut = [0xf0c8a0, 0xd8a078, 0xa87850, 0x7a5236, 0xf4d8b8];
    const c = new THREE.Color();
    leute.forEach((_, i) => { koerper.setColorAt(i, c.setHex(kleider[Math.floor(zf() * kleider.length)])); kopf.setColorAt(i, c.setHex(haut[Math.floor(zf() * haut.length)])); });
  }
  bilder.fenster.userData.weg = bilder.publikum.userData.weg = true;
  return { gruppe: G, klick, boden, bilder };
}

// Besucher, die über das Gelände LAUFEN (die anderen stehen nur herum). Gibt zwei Formen zurück: Körper und Köpfe.
// Bewegt werden sie in anlage.js.
export function laeuferBauen(n, schatten = true) {
  const koerper = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.95, 2, 6).translate(0, 0.72, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), n);
  const kopf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6).translate(0, 1.55, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), n);
  const kleider = [0xe84a3a, 0x3a6ae8, 0xf0d040, 0x3aa85a, 0xf4f4f0, 0xe89ac0, 0xf08a3a, 0x8a5ac8, 0x3ab8c8], haut = [0xf0c8a0, 0xd8a078, 0xa87850, 0x7a5236, 0xf4d8b8], c = new THREE.Color();
  for (let i = 0; i < n; i++) { koerper.setColorAt(i, c.setHex(kleider[i % kleider.length])); kopf.setColorAt(i, c.setHex(haut[(i * 3) % haut.length])); }
  for (const m of [koerper, kopf]) { m.userData.eigen = true; m.frustumCulled = false; m.castShadow = schatten; }
  return { koerper, kopf };
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
