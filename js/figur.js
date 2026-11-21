// Powershot – die realistischen Spielermodelle (assets/spieler_a.glb … spieler_f.glb).
// Sechs Figuren mit verschiedenen Gesichtern, Frisuren und Kleidungsschnitten:
//   a = kurze Haare, T-Shirt        b = längere Haare mit Stirnband, Polohemd
//   c = Locken, ärmelloses Hemd     d = Bart, sehr kurze Haare, Schweißbänder
//   e = Kappe, Hemd mit Kragen      f = Haarknoten, Hemd mit V-Ausschnitt
// Die Modelle kommen aus einem 3D-Generator und stehen starr in der T-Pose. Hier wird es
// "geriggt": Jeder Punkt der Oberfläche bekommt Gewichte, die sagen, welchen Knochen er folgt
// (z. B. 70 % Oberarm, 30 % Unterarm am Ellbogen). Die Knochen bewegt dann avatar.js.
// Außerdem färbt ein kleines Shader-Stück Hemd, Hose, Haut und Haare je Spieler um.
//
// Neu: Menschen aus MakeHuman (assets/mensch_a.glb …), gebaut mit tools/mensch/mensch.py – so wie die Leute im
// Schwester-Spiel Police Quest. Gibt es für einen Buchstaben so eine Datei, nimmt das Spiel sie statt des alten Modells.
// Diese Menschen bringen ihre Gewichte schon mit (aus MakeHuman, viel sauberer als unsere Rechnung unten) und
// haben ein Bild mit festen Feldern (FELDER): daran erkennt der Shader Haut, Hemd, Hose und Haare.
// Mit ?altefiguren in der Adresse sieht man zum Vergleich die alten Modelle.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SIZE = 1.83;                   // Körpergröße in Metern (das Modell selbst ist 1 Einheit hoch)

// Reihenfolge der Knochen. Die ersten 13 sind der Körper, danach kommen je Arm sieben Knochen für die Hand:
//   dreh = das vordere Stück vom Unterarm (dreht sich mit der Hand mit), hand = Handfläche,
//   fin…1/2/3 = die drei Glieder der vier Finger (alle vier Finger krümmen sich gemeinsam), daum…1/2 = Daumen
export const BONES = ['pelvis', 'chest', 'head', 'upperR', 'foreR', 'upperL', 'foreL',
  'thighR', 'shinR', 'thighL', 'shinL', 'footR', 'footL',
  'drehR', 'handR', 'finR1', 'finR2', 'finR3', 'daumR1', 'daumR2',
  'drehL', 'handL', 'finL1', 'finL2', 'finL3', 'daumL1', 'daumL2'];

// Gelenke des Modells in der T-Pose, als [vor, seite, hoch] in Metern (seite: + = rechts)
export const REST = {
  hip: [0, 0, 0.93], neck: [0, 0, 1.555],
  sh: [-0.05, 0.192, 1.411], elbow: [-0.06, 0.467, 1.411], grip: [0.02, 0.805, 1.40],
  leg: [0, 0.09, 0.93], knee: [-0.022, 0.124, 0.512], ankle: [-0.062, 0.146, 0.09],
};

// Die Hand des Modells in der T-Pose: Sie liegt flach, die Finger zeigen zur Seite, der Daumen nach vorn.
// Alle Zahlen sind Abstände von der Körpermitte zur Seite in Metern (an Modell a ausgemessen).
export const HAND = {
  gelenk: 0.745,                 // hier sitzt das Handgelenk
  finger: [0.835, 0.865, 0.89],  // Knöchel, mittleres Gelenk, vorderes Gelenk der Finger
  daumen: [0.775, 0.045],        // Wurzel des Daumens: [zur Seite, nach vorn]
  daumenKnick: [0.798, 0.078],   // Gelenk in der Mitte des Daumens
};

// Menschen aus MakeHuman: Bei ihnen sitzt die Schulter ein Stück weiter vorn als beim alten Modell (so sind echte
// Menschen gebaut). Der ganze Arm ist deshalb in der T-Pose um SCHULTER_VOR nach vorn geschoben.
const SCHULTER_VOR = 0.07;
const nachVorn = (p) => [p[0] + SCHULTER_VOR, p[1], p[2]];
export const REST_MENSCH = { ...REST, sh: nachVorn(REST.sh), elbow: nachVorn(REST.elbow), grip: nachVorn(REST.grip) };
// Welche Buchstaben gibt es schon als Mensch aus MakeHuman? (Dateien assets/mensch_<Buchstabe>.glb)
export const MENSCHEN = [];
const ALTE_FIGUREN = typeof location !== 'undefined' && /[?&]altefiguren/.test(location.search);

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Gewichte für einen Punkt (s = seitlich, h = Höhe, v = nach vorn)
function weights(s, h, v) {
  const w = new Array(BONES.length).fill(0);
  const scale = (f) => { for (let i = 0; i < w.length; i++) w[i] *= f; };
  const chest = ss(0.98, 1.18, h);
  w[0] = 1 - chest; w[1] = chest;
  const head = Math.abs(s) < 0.2 ? ss(1.50, 1.60, h) : 0;
  scale(1 - head); w[2] = head;
  const arm = ss(0.15, 0.25, Math.abs(s)) * ss(1.20, 1.30, h);
  if (arm > 0) {
    const fore = ss(0.41, 0.53, Math.abs(s));
    scale(1 - arm);
    const o = s > 0 ? 3 : 5;
    w[o] = arm * (1 - fore); w[o + 1] = arm * fore;
    // Unterarm und Hand: Zum Handgelenk hin folgt der Unterarm immer mehr der Drehung der Hand (wie in echt:
    // Elle und Speiche drehen sich umeinander). Ab dem Handgelenk gehört der Punkt zur Hand.
    const a = Math.abs(s), q = s > 0 ? 13 : 20;
    const dreh = ss(0.50, 0.73, a), hand = ss(HAND.gelenk - 0.022, HAND.gelenk + 0.018, a);
    const unter = w[o + 1];
    w[o + 1] = unter * (1 - dreh);
    w[q] = unter * dreh * (1 - hand);
    let rest = unter * dreh * hand;
    if (rest > 0) {
      // Daumen: alles, was vorn über die Handkante hinausragt (die Kante läuft schräg, deshalb die Rechnung mit a)
      const kante = 0.052 + (a - 0.76) * 0.12;
      const daum = ss(kante - 0.012, kante + 0.012, v) * (1 - ss(0.826, 0.842, a));
      const spitze = ss(-0.008, 0.008, (a - HAND.daumenKnick[0]) * 0.55 + (v - HAND.daumenKnick[1]) * 0.83);
      w[q + 5] = rest * daum * (1 - spitze); w[q + 6] = rest * daum * spitze;
      rest *= 1 - daum;
      // Finger: drei Glieder hintereinander
      const f1 = ss(HAND.finger[0] - 0.012, HAND.finger[0] + 0.012, a);
      const f2 = ss(HAND.finger[1] - 0.008, HAND.finger[1] + 0.008, a);
      const f3 = ss(HAND.finger[2] - 0.007, HAND.finger[2] + 0.007, a);
      w[q + 1] = rest * (1 - f1); w[q + 2] = rest * f1 * (1 - f2); w[q + 3] = rest * f1 * f2 * (1 - f3); w[q + 4] = rest * f1 * f2 * f3;
    }
  }
  const leg = 1 - ss(0.76, 1.0, h);
  if (leg > 0) {
    const width = 0.05 * ss(0.74, 0.86, h);
    const right = width > 0 ? ss(-width, width, s) : (s > 0 ? 1 : 0);
    const shin = 1 - ss(0.45, 0.57, h), foot = 1 - ss(0.07, 0.15, h);
    scale(1 - leg);
    for (const [o, f, k] of [[7, 11, right], [9, 12, 1 - right]]) {
      w[o] = leg * k * (1 - shin);
      w[o + 1] = leg * k * shin * (1 - foot);
      w[f] = leg * k * shin * foot;
    }
  }
  return w;
}

function rig(geo) {
  const pos = geo.attributes.position, n = pos.count;
  const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = weights(pos.getX(i), pos.getY(i), -pos.getZ(i));
    const best = w.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const sum = best.reduce((a, b) => a + b[0], 0) || 1;
    best.forEach(([v, k], j) => { idx[i * 4 + j] = k; wt[i * 4 + j] = v / sum; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
}

export const MODELS = ['a', 'b', 'c', 'd', 'e', 'f'];
const models = {};     // je Buchstabe: { geo: { 1: Rechtshänder, -1: gespiegelt }, map, normalMap }
let loading = null;

export const figureReady = () => !!models.a;

// Welches Modell passt zum Aussehen? (look.model, sonst nach Kappe / Stirnband)
export function modelKey(look) {
  const k = look.model || (look.head === 'cap' ? 'e' : look.head === 'band' ? 'b' : 'a');
  return models[k] ? k : 'a';
}

export function loadFigure() {
  if (!loading) loading = Promise.all(MODELS.map((k) => (MENSCHEN.includes(k) && !ALTE_FIGUREN
    ? loadMensch(k, `assets/mensch_${k}.glb`).catch(() => loadOne(k, `assets/spieler_${k}.glb`))      // klappt der Mensch nicht, kommt das alte Modell
    : loadOne(k, `assets/spieler_${k}.glb`))));
  return loading;
}

// Die T-Pose, in der dieses Modell gebaut ist (avatar.js rechnet daraus die Knochen in Ruhe)
export function restFor(look) {
  const m = models[modelKey(look)];
  return m && m.mensch ? REST_MENSCH : REST;
}

// Einen Menschen aus MakeHuman laden. Die Datei ist schon fertig fürs Spiel: richtig gedreht, in Metern,
// und jeder Punkt kennt seine vier Knochen (_skini = Nummern in BONES, _skinw = Gewichte).
function loadMensch(key, url) {
  return new GLTFLoader().loadAsync(url).then((gltf) => {
    let src = null;
    gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    const geo = src.geometry.clone();
    const ni = geo.getAttribute('_skini'), nw = geo.getAttribute('_skinw'), n = geo.attributes.position.count;
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) { idx[i] = Math.round(ni.array[i]); wt[i] = nw.array[i]; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    geo.deleteAttribute('_skini'); geo.deleteAttribute('_skinw');
    geo.userData.shared = true;
    const flip = geo.clone();
    const ix = flip.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    flip.userData.shared = true;
    const map = src.material.map;
    if (map) map.anisotropy = 4;
    models[key] = { geo: { 1: geo, '-1': flip }, map, mensch: true };
  });
}

function loadOne(key, url) {
  return new GLTFLoader().loadAsync(url).then((gltf) => {
    let src = null;
    gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    const geo = src.geometry.clone();
    // Modell: x = vorne, y = Höhe (−0.5 … 0.5), z = rechts  →  Spiel: x = rechts, y = Höhe, z = hinten
    geo.applyMatrix4(new THREE.Matrix4().set(0, 0, SIZE, 0, 0, SIZE, 0, SIZE / 2, -SIZE, 0, 0, 0, 0, 0, 0, 1));
    // Schaut die Figur in die richtige Richtung? Die Zehen müssen nach vorn (−z) zeigen – sonst umdrehen.
    const pos = geo.attributes.position;
    let front = 0, back = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.06) { front = Math.max(front, -pos.getZ(i)); back = Math.max(back, pos.getZ(i)); }
    if (back > front) geo.rotateY(Math.PI);
    rig(geo);
    geo.userData.shared = true;
    // Für Linkshänder wird die Figur gespiegelt; damit die Vorderseiten vorne bleiben, drehen wir die Dreiecke um
    const flip = geo.clone();
    const ix = flip.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    flip.userData.shared = true;
    models[key] = { geo: { 1: geo, '-1': flip }, map: src.material.map, normalMap: src.material.normalMap };
  }).catch((e) => { console.warn('Spielermodell konnte nicht geladen werden:', url, e); });
}

// Farben der Vorlage (im Bild: hellgraue Kleidung, mittlerer Hautton)
const REF_SKIN = new THREE.Color(0xad8068);

// Muster der Kleidung (look.pattern): 0 = einfarbig, 1 = Bruststreifen, 2 = farbige Ärmel,
// 3 = Seitenstreifen, 4 = Schulterpartie in zweiter Farbe. Die zweite Farbe ist look.trim.
function material(model, look, hand) {
  if (model.mensch) return materialMensch(model, look);
  const mat = new THREE.MeshStandardMaterial({ map: model.map, normalMap: model.normalMap, roughness: 0.78, metalness: 0 });
  if (hand < 0) mat.normalScale.set(-1, 1);
  const skin = new THREE.Color(look.skin ?? 0xe2b48c);
  const u = {
    uShirt: { value: new THREE.Color(look.shirt ?? 0xffffff) },
    uShorts: { value: new THREE.Color(look.shorts ?? 0xffffff) },
    uHair: { value: new THREE.Color(look.hair ?? 0x2b1d14) },
    uTrim: { value: new THREE.Color(look.trim ?? look.shorts ?? 0xffffff) },
    uPattern: { value: look.pattern || 0 },
    uSkin: { value: new THREE.Vector3(skin.r / REF_SKIN.r, skin.g / REF_SKIN.g, skin.b / REF_SKIN.b).clampScalar(0.25, 1.7) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform vec3 uShirt, uShorts, uHair, uSkin, uTrim;\nuniform int uPattern;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float sat = (mx - mn) / max(mx, 0.001);
          float h = vRest.y;
          // Kleidung: helle, farblose Stellen zwischen Socken und Hals
          float cloth = (1.0 - smoothstep(0.10, 0.24, sat)) * smoothstep(0.22, 0.42, mx) * smoothstep(0.40, 0.46, h) * (1.0 - step(1.54, h));
          float shirt = smoothstep(0.90, 0.95, h), ax = abs(vRest.x);
          float trim = 0.0;
          if (uPattern == 1) trim = shirt * step(1.17, h) * (1.0 - step(1.26, h)) * (1.0 - step(0.21, ax));
          else if (uPattern == 2) trim = shirt * step(0.215, ax) + (1.0 - shirt) * step(0.155, ax);
          else if (uPattern == 3) trim = shirt * step(0.125, ax) * (1.0 - step(1.30, h)) + (1.0 - shirt) * step(0.155, ax);
          else if (uPattern == 4) trim = shirt * smoothstep(1.24, 1.28, h);
          vec3 tint = mix(mix(uShorts, uShirt, shirt), uTrim, trim);
          // Haare: sehr dunkle Stellen am Kopf
          float hair = (1.0 - smoothstep(0.02, 0.09, mx)) * step(1.52, h);
          float skin = smoothstep(0.16, 0.30, sat) * (1.0 - hair);
          c = mix(c, c * uSkin, skin);
          c = mix(c, c / 0.68 * tint, cloth);
          c = mix(c, uHair * (0.45 + mx * 9.0), hair);
          diffuseColor.rgb = c;
        }`);
  };
  return mat;
}

// Material für einen Menschen aus MakeHuman. Im Bild hat jedes Teil sein festes Feld (wie in tools/mensch/mensch.py, FELDER):
//   linke Hälfte = Haut · rechts oben = Hemd und Hose · rechts unten links = Haare · der Rest = Schuhe, Augen, Brauen, Wimpern, Extras
// Kleidung und Haare sind im Bild grau, Haut hat einen mittleren Ton – die Farben des Spielers malt der Shader darüber.
function materialMensch(model, look) {
  const mat = new THREE.MeshStandardMaterial({ map: model.map, roughness: 0.8, metalness: 0, alphaTest: 0.45, side: THREE.DoubleSide });
  const skin = new THREE.Color(look.skin ?? 0xe2b48c);
  const u = {
    uShirt: { value: new THREE.Color(look.shirt ?? 0xffffff) },
    uShorts: { value: new THREE.Color(look.shorts ?? 0xffffff) },
    uHair: { value: new THREE.Color(look.hair ?? 0x2b1d14) },
    uTrim: { value: new THREE.Color(look.trim ?? look.shorts ?? 0xffffff) },
    uShoes: { value: new THREE.Color(look.shoes ?? 0xffffff) },
    uPattern: { value: look.pattern || 0 },
    uSkin: { value: new THREE.Vector3(skin.r / REF_SKIN.r, skin.g / REF_SKIN.g, skin.b / REF_SKIN.b).clampScalar(0.25, 1.7) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform vec3 uShirt, uShorts, uHair, uSkin, uTrim, uShoes;\nuniform int uPattern;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          vec2 f = vec2(vMapUv.x, 1.0 - vMapUv.y);      // Stelle im Bild, von unten links gezählt
          float h = vRest.y, ax = abs(vRest.x);
          if (f.x < 0.5) c *= uSkin;                                    // Haut
          else if (f.y >= 0.5) {                                        // Hemd (links) und Hose (rechts)
            float shirt = step(f.x, 0.75);
            float trim = 0.0;
            if (uPattern == 1) trim = shirt * step(1.17, h) * (1.0 - step(1.26, h)) * (1.0 - step(0.21, ax));
            else if (uPattern == 2) trim = shirt * step(0.215, ax) + (1.0 - shirt) * step(0.155, ax);
            else if (uPattern == 3) trim = shirt * step(0.125, ax) * (1.0 - step(1.30, h)) + (1.0 - shirt) * step(0.155, ax);
            else if (uPattern == 4) trim = shirt * smoothstep(1.24, 1.28, h);
            c = c / 0.68 * mix(mix(uShorts, uShirt, shirt), uTrim, trim);
          }
          else if (f.x < 0.75) c = c / 0.68 * uHair * 1.6;             // Haare
          else if (f.y >= 0.25 && f.x < 0.875) c = c / 0.68 * uShoes;  // Schuhe
          else if (f.y < 0.125 && f.x >= 0.8125 && f.x < 0.875) c = c / 0.68 * uHair * 1.2;   // Augenbrauen
          diffuseColor.rgb = c;
        }`);
  };
  return mat;
}

// Eine neue Figur: SkinnedMesh + Knochen (die Knochen stellt avatar.js jedes Bild neu ein)
export function makeFigure(look, hand, inverses) {
  const model = models[modelKey(look)];
  const mesh = new THREE.SkinnedMesh(model.geo[hand < 0 ? -1 : 1], material(model, look, hand));
  const bones = BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    b.matrixAutoUpdate = false;
    return b;
  });
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return { mesh, bones };
}
