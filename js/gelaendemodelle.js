// Powershot – die fertigen 3D-Modelle für die Turniergelände (Ordner assets/gelaende/).
//
// Die Modelle kommen aus 3D AI Studio: Bäume, Autos, Häuser für jedes Land, berühmte Stadien, Möbel.
// Ein paar Kleinteile und die Bodenbilder kommen von Poly Haven (polyhaven.com, frei nutzbar, Lizenz CC0) –
// welche das sind und wo sie herkommen, steht in assets/gelaende/QUELLEN.md.
// Sie werden erst geladen, wenn ein Gelände sie braucht – und nur die, die dort wirklich vorkommen.
// Bis sie da sind, zeigt das Gelände seine einfachen Formen (Klötze, Kugeln). Danach wird es neu gebaut.
//
// Jedes Modell wird beim Laden einmal zurechtgerückt: Es steht mit den Füßen auf dem Boden (y = 0),
// seine Mitte liegt bei x = 0 und z = 0, und „vorn“ zeigt nach +z (nach Süden auf der Karte).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ORDNER = 'assets/gelaende/';
const V = Math.PI / 2;         // eine Vierteldrehung

// name: { h: so hoch in Metern · l: ODER so lang ist die längste Seite am Boden · dreh: Drehung, damit vorn nach +z zeigt · beide: dünne Teile von beiden Seiten zeichnen }
// Modelle ohne h und l werden später in einen Kasten eingepasst (Häuser, Stadien).
export const MODELLE = {
  // Bäume
  baum_laub: { h: 6.6, beide: true }, baum_palme: { h: 7.2, beide: true }, baum_pinie: { h: 8, beide: true }, baum_zypresse: { h: 7, beide: true }, baum_fichte: { h: 8, beide: true },
  // Auf den Wiesen (die Besucher selbst sind keine fertigen Modelle mehr – sie bewegen sich, siehe besucher.js)
  picknick: { l: 2.4 }, liegestuhl: { l: 1.5 },
  // Autos: die drei schwarzen sind der Fahrdienst für die Spieler
  auto_limousine: { l: 5.2 }, auto_suv: { l: 4.8 }, auto_van: { l: 5.1 }, auto_kompakt: { l: 3.9, dreh: -V }, auto_kombi: { l: 4.7, dreh: -V },
  // Fan-Dorf und Kleinteile
  zelt: { l: 4.2, beide: true }, stand: { h: 2.7, dreh: -V }, schirmtisch: { h: 2.7, beide: true }, laterne: { h: 4.2 }, flutlicht: { h: 10, beide: true }, absperrgitter: { l: 2, beide: true },
  // Von Poly Haven (CC0): Blumenkübel, alte Laterne, Bistro-Tisch mit zwei Stühlen, Picknick-Tisch, Mülltonne, Plastikstuhl
  pflanzkuebel: { h: 1.05 }, laterne_alt: { h: 3.9 }, bistro: { l: 1.84 }, picknicktisch: { l: 3 }, muelltonne: { h: 0.95 }, plastikstuhl: { h: 0.88 },
  mal_statue_rom: { h: 2.9 }, mal_statue_rom2: { h: 2.9 }, mal_brunnen: { l: 8 }, mal_yacht: { l: 30, dreh: V },
  // Möbel für drinnen (in den Dateien zeigt die Vorderseite nach +x)
  innen_kraft: { h: 2.2, dreh: -V }, innen_laufband: { h: 1.6, dreh: -V }, innen_liege: { l: 2, dreh: -V }, innen_bespann: { h: 1.5, dreh: -V }, innen_tisch: { l: 2, dreh: -V }, innen_buffet: { l: 2.6, dreh: -V }, innen_empfang: { l: 3, dreh: -V },
  innen_sofa: { l: 3.4, dreh: -V }, innen_podium: { l: 3, dreh: -V }, innen_stuehle: { l: 2.2, dreh: -V }, innen_vitrine: { h: 2, dreh: -V }, innen_spinde: { l: 2.4, dreh: -V },
};

// Welches Haus-Modell passt in welche Gegend? Je drei: kleines Haus, mittleres, großes.
export const HAUS_STIL = {
  modern: ['clubhaus_klein', 'haus_glas', 'clubhaus_gross'],
  europa: ['clubhaus_klein', 'haus_backstein', 'clubhaus_gross'],
  england: ['haus_england', 'haus_backstein', 'haus_backstein'],
  mittelmeer: ['clubhaus_klein', 'haus_mittelmeer', 'haus_mittelmeer'],
  wueste: ['haus_wueste', 'haus_wueste', 'clubhaus_gross'],
  usa: ['haus_usa', 'clubhaus_klein', 'clubhaus_gross'],
  asien: ['clubhaus_klein', 'haus_asien', 'haus_asien'],
  alpen: ['haus_chalet', 'haus_chalet', 'haus_chalet'],
};
// Welches Modell bekommt dieses Haus? (null = es bleibt ein einfacher Kasten)
export function hausModell(el, stil = 'modern') {
  if (el.modell) return el.modell;
  if (el.dach === 'zelt') return null;                                  // das kleine Besaiter-Zelt bleibt, wie es ist
  if (el.dach === 'glas') return 'mal_gewaechshaus';
  const lang = Math.max(el.b, el.t), kurz = Math.min(el.b, el.t);
  if (kurz < 3 || lang / kurz > 4.5) return null;                       // Mauern und sehr lange, schmale Häuser
  if (/Hotel/.test(el.name || '') && el.h >= 9) return 'haus_hotel';
  if (/halle/i.test(el.name || '')) return 'haus_halle';
  const liste = HAUS_STIL[stil] || HAUS_STIL.modern;
  return liste[lang < 9 ? 0 : lang < 19 ? 1 : 2];
}

const fertig = new Map();      // name → { geo, mat, gr } oder ein Bild (für die flachen Bäume in der Ferne)
const laeuft = new Map();
let lader = null;

// Rechnet die gepackten Zahlen einer Form in normale Kommazahlen um (damit man sie drehen und schieben kann)
function auspacken(geo) {
  const neu = new THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const a = geo.attributes[name];
    if (!a) continue;
    const z = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { z[i * n] = a.getX(i); z[i * n + 1] = a.getY(i); if (n === 3) z[i * n + 2] = a.getZ(i); }
    neu.setAttribute(name, new THREE.BufferAttribute(z, n));
  }
  neu.setIndex(geo.index);
  return neu;
}

function ladeEins(name) {
  if (fertig.has(name)) return Promise.resolve();
  if (laeuft.has(name)) return laeuft.get(name);
  let p;
  if (name.endsWith('_flach')) {
    // Ein Bild von einem Baum (für Bäume weit hinten: zwei gekreuzte Bildtafeln statt 6000 Dreiecken)
    p = new THREE.TextureLoader().loadAsync(ORDNER + name + '.webp').then((bild) => { bild.colorSpace = THREE.SRGBColorSpace; fertig.set(name, bild); });
  } else if (name.startsWith('boden_')) {
    // Ein Bild für den Boden (Gras, Pflaster, Asphalt, Kopfsteinpflaster). Es ist grau – die Farbe gibt das Gelände dazu.
    p = new THREE.TextureLoader().loadAsync(ORDNER + name + '.jpg').then((bild) => { bild.colorSpace = THREE.SRGBColorSpace; bild.wrapS = bild.wrapT = THREE.RepeatWrapping; bild.anisotropy = 4; fertig.set(name, bild); });
  } else {
    lader = lader || new GLTFLoader();
    p = lader.loadAsync(ORDNER + name + '.glb').then((gltf) => {
      let netz = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((m) => { if (m.isMesh && !netz) netz = m; });
      const info = MODELLE[name] || {};
      const geo = auspacken(netz.geometry).applyMatrix4(netz.matrixWorld);
      if (info.dreh) geo.rotateY(info.dreh);
      geo.computeBoundingBox();
      const k = geo.boundingBox, gr = k.getSize(new THREE.Vector3());
      geo.translate(-(k.min.x + k.max.x) / 2, -k.min.y, -(k.min.z + k.max.z) / 2);
      // Feste Größe? Dann gleich auf Meter bringen
      const mal = info.h ? info.h / gr.y : info.l ? info.l / Math.max(gr.x, gr.z) : 1;
      if (mal !== 1) { geo.scale(mal, mal, mal); gr.multiplyScalar(mal); }
      geo.computeBoundingSphere();
      const bild = netz.material.map, rillen = netz.material.normalMap || null;
      if (bild) bild.anisotropy = rillen ? 8 : 4;
      // Die großen Stadien bringen ein zweites Bild mit: Es sagt dem Licht, wo feine Rillen und Kanten sind (Normal-Map).
      // Dadurch sehen Sitzreihen und Träger scharf aus, obwohl sie gar nicht aus Dreiecken gebaut sind.
      const mat = new THREE.MeshStandardMaterial({ map: bild, normalMap: rillen, roughness: 0.88, metalness: 0, side: info.beide ? THREE.DoubleSide : THREE.FrontSide });
      fertig.set(name, { geo, mat, gr });
    });
  }
  p = p.catch(() => { fertig.set(name, null); });       // Datei fehlt oder kein Internet: dann bleibt die einfache Form
  laeuft.set(name, p);
  return p;
}

// Lädt alle genannten Modelle. Fertig, wenn alle da sind (oder nicht zu bekommen waren).
export const ladeModelle = (namen) => Promise.all([...namen].map(ladeEins));
// Das geladene Modell – oder null, wenn es (noch) nicht da ist
export const modell = (name) => fertig.get(name) || null;
// Fehlt von diesen Namen noch etwas, das man laden könnte?
export const fehltNoch = (namen) => [...namen].some((n) => !fertig.has(n));
