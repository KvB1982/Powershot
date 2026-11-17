// Powershot – die Requisiten: fertige 3D-Modelle für Dinge, die am Platz herumstehen
// (Schiedsrichterstuhl, Bank, Ballkind, Linienrichter, Ballmaschine, Pokale) und der Schläger.
// Die Modelle kommen aus 3D AI Studio und liegen als GLB-Dateien im Ordner assets/.
// Alle Gesichter sind erfunden, nirgends stehen Logos oder Markennamen.
//
// Jedes Modell wird nur EINMAL geladen. Braucht das Spiel es mehrfach (zwei Bänke, sechs Ballkinder),
// bekommt jede Kopie dieselbe Form – das spart Speicher auf dem iPad.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// name: [Datei, Größe in Metern (längste Seite), Drehung, damit "vorne" nach +z zeigt]
const LISTE = {
  schiedsrichter: ['schiedsrichter.glb', 2.75, Math.PI],
  bank:           ['bank.glb', 2.3, -Math.PI / 2],
  ballkind:       ['ballkind.glb', 1.5, -Math.PI / 2],
  linienrichter:  ['linienrichter.glb', 1.55, -Math.PI / 2],
  ballmaschine:   ['ballmaschine.glb', 1.4, 0],
  pokal_silber:   ['pokal_silber.glb', 0.6, 0],
  pokal_gold:     ['pokal_gold.glb', 0.6, 0],
  pokal_stern:    ['pokal_stern.glb', 0.6, 0],
  schlaeger:      ['schlaeger.glb', 1, 0],          // der Schläger wird in avatar.js zurechtgerückt
};

const fertig = {};      // name → { geo, map }
let laden = null;

// Alle Modelle laden. Fehlt eins (z. B. kein Internet), baut das Spiel dafür die alten Klötzchen.
export function ladeRequisiten() {
  if (!laden) {
    laden = Promise.all(Object.keys(LISTE).map((name) => {
      const [datei, groesse, dreh] = LISTE[name];
      return new GLTFLoader().loadAsync('assets/' + datei).then((gltf) => {
        let src = null;
        gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
        const geo = src.geometry.clone();
        geo.rotateY(dreh);
        geo.scale(groesse, groesse, groesse);
        if (name !== 'schlaeger') {
          // auf den Boden stellen und in die Mitte rücken
          geo.computeBoundingBox();
          const b = geo.boundingBox;
          geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
        }
        geo.userData.shared = true;          // nicht wegwerfen, wenn das Stadion neu gebaut wird
        const map = src.material.map;
        if (map) map.userData.shared = true;
        fertig[name] = { geo, map };
      }).catch((e) => { console.warn('Requisit konnte nicht geladen werden:', datei, e); });
    }));
  }
  return laden;
}

export const requisitDa = (name) => !!fertig[name];

// Eine Kopie eines Modells. opts.farbe färbt helle, graue Stellen um (Kleidung der Ballkinder, Lack des Schlägers);
// opts.abY: nur oberhalb dieser Höhe umfärben (beim Schläger bleibt so das Griffband weiß).
export function requisit(name, opts = {}) {
  const f = fertig[name];
  if (!f) return null;
  const mat = new THREE.MeshStandardMaterial({ map: f.map, roughness: opts.rau ?? 0.8, metalness: opts.metall ?? 0 });
  if (opts.farbe != null) faerben(mat, opts.farbe, opts.abY ?? -1e9, opts.hell ?? [0.3, 0.8]);
  const mesh = new THREE.Mesh(f.geo, mat);
  mesh.castShadow = opts.schatten ?? true;
  mesh.receiveShadow = false;
  return mesh;
}

// Kleines Shader-Stück: Stellen ohne eigene Farbe (grau) in der passenden Helligkeit bekommen die neue Farbe.
// Haut, Haare, schwarze und weiße Teile bleiben, wie sie sind.
function faerben(mat, farbe, abY, hell) {
  const u = { uFarbe: { value: new THREE.Color(farbe) }, uAbY: { value: abY }, uHell: { value: new THREE.Vector2(hell[0], hell[1]) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHoch;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoch = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHoch;\nuniform vec3 uFarbe;\nuniform float uAbY;\nuniform vec2 uHell;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float grau = 1.0 - smoothstep(0.10, 0.22, (mx - mn) / max(mx, 0.001));
          float k = grau * smoothstep(uHell.x - 0.08, uHell.x, mx) * (1.0 - smoothstep(uHell.y, uHell.y + 0.08, mx)) * step(uAbY, vHoch);
          diffuseColor.rgb = mix(c, uFarbe * (mx / ((uHell.x + uHell.y) * 0.5)), k);
        }`);
  };
  mat.userData.farbe = u.uFarbe;
}
