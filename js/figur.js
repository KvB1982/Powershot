// Powershot – die realistischen Spielermodelle (assets/spieler_a.glb … spieler_f.glb).
// Sechs Figuren mit verschiedenen Gesichtern, Frisuren und Kleidungsschnitten:
//   a = kurze Haare, T-Shirt        b = längere Haare mit Stirnband, Polohemd
//   c = Locken, ärmelloses Hemd     d = Bart, sehr kurze Haare, Schweißbänder
//   e = Kappe, Hemd mit Kragen      f = Haarknoten, Hemd mit V-Ausschnitt
// Die Modelle kommen aus einem 3D-Generator und stehen starr in der T-Pose. Hier wird es
// "geriggt": Jeder Punkt der Oberfläche bekommt Gewichte, die sagen, welchen Knochen er folgt
// (z. B. 70 % Oberarm, 30 % Unterarm am Ellbogen). Die Knochen bewegt dann avatar.js.
// Außerdem färbt ein kleines Shader-Stück Hemd, Hose, Haut und Haare je Spieler um.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SIZE = 1.83;                   // Körpergröße in Metern (das Modell selbst ist 1 Einheit hoch)

// Reihenfolge der Knochen
export const BONES = ['pelvis', 'chest', 'head', 'upperR', 'foreR', 'upperL', 'foreL',
  'thighR', 'shinR', 'thighL', 'shinL', 'footR', 'footL'];

// Gelenke des Modells in der T-Pose, als [vor, seite, hoch] in Metern (seite: + = rechts)
export const REST = {
  hip: [0, 0, 0.93], neck: [0, 0, 1.555],
  sh: [-0.05, 0.192, 1.411], elbow: [-0.06, 0.467, 1.411], grip: [0.02, 0.805, 1.40],
  leg: [0, 0.09, 0.93], knee: [-0.022, 0.124, 0.512], ankle: [-0.062, 0.146, 0.09],
};

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Gewichte für einen Punkt (s = seitlich, h = Höhe)
function weights(s, h) {
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
    const w = weights(pos.getX(i), pos.getY(i));
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
  if (!loading) loading = Promise.all(MODELS.map((k) => loadOne(k, `assets/spieler_${k}.glb`)));
  return loading;
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
