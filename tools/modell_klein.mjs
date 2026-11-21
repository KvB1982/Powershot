// Powershot – macht aus einem heruntergeladenen 3D-Modell (glTF, z. B. von polyhaven.com) ein kleines Modell für das Spiel:
// nur das Farbbild, alle Teile ein Netz mit einem Material (mehrere Farbbilder kommen nebeneinander in ein Sammelbild), wenige Dreiecke.
//
// Einmal vorher (in einem Ordner außerhalb des Spiels): npm install @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
// Aufruf: node modell_klein.mjs <ein.gltf> <aus.glb> <dreiecke> [nur,diese,knoten]
// Beispiel: node modell_klein.mjs potted_plant_04.gltf pflanzkuebel.glb 2200
// Woher die Modelle sind, steht in assets/gelaende/QUELLEN.md.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, simplify, prune, dedup, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [,, ein, aus, zielStr, nurStr] = process.argv;
const ziel = +zielStr, nur = nurStr ? nurStr.split(',') : null, FELD = +(process.env.FELD || 512);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(ein), root = doc.getRoot();
if (nur) for (const n of root.listNodes()) if (n.getMesh() && !nur.includes(n.getName())) n.dispose();
await doc.transform(prune());
// 1. Sammelbild aus den Farbbildern aller Materialien
const mats = root.listMaterials(), bilder = [];
for (const m of mats) { const t = m.getBaseColorTexture(); if (t && !bilder.includes(t)) bilder.push(t); }
const sp = Math.ceil(Math.sqrt(bilder.length)), ze = Math.ceil(bilder.length / sp);
const teile = [];
for (let i = 0; i < bilder.length; i++) teile.push({ input: await sharp(Buffer.from(bilder[i].getImage())).removeAlpha().resize(FELD, FELD).toBuffer(), left: (i % sp) * FELD, top: Math.floor(i / sp) * FELD });
const sammel = await sharp({ create: { width: sp * FELD, height: ze * FELD, channels: 3, background: '#808080' } }).composite(teile).jpeg({ quality: 82 }).toBuffer();
const tex = doc.createTexture('farbe').setImage(sammel).setMimeType('image/jpeg');
const mat = doc.createMaterial('alles').setBaseColorTexture(tex).setRoughnessFactor(0.88).setMetallicFactor(0);
let draussen = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const i = bilder.indexOf(p.getMaterial()?.getBaseColorTexture()), uv = p.getAttribute('TEXCOORD_0');
  if (uv && i >= 0) {
    const neu = uv.clone(), a = [0, 0];
    for (let k = 0; k < neu.getCount(); k++) {
      neu.getElement(k, a);
      if (a[0] < -0.01 || a[0] > 1.01 || a[1] < -0.01 || a[1] > 1.01) draussen++;
      const u = Math.min(0.998, Math.max(0.002, a[0])), v = Math.min(0.998, Math.max(0.002, a[1]));
      neu.setElement(k, [((i % sp) + u) / sp, (Math.floor(i / sp) + v) / ze]);
    }
    p.setAttribute('TEXCOORD_0', neu);
  }
  for (const s of p.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(s)) p.setAttribute(s, null);
  p.setMaterial(mat);
}
await doc.transform(prune(), flatten(), join(), weld());
await MeshoptSimplifier.ready;
const zaehl = () => root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const vorher = zaehl();
if (vorher > ziel) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: ziel / vorher, error: 0.05, lockBorder: false }));
await doc.transform(prune(), dedup(), quantize());
await io.write(aus, doc);
console.log(aus.split('/').pop(), 'Dreiecke', vorher, '→', zaehl(), '· Netze', root.listMeshes().length, '· Teile', root.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0), '· Bilder', bilder.length, draussen ? '· UV außerhalb: ' + draussen : '');
