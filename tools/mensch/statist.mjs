// Statisten backen: macht aus einem Menschen von MakeHuman eine feste, kleine Figur in ihrer Haltung.
//   node tools/mensch/statist.mjs ballkind linienrichter
// Braucht: den Server (python3 tools/server.py), Playwright mit Chromium und npx (gltf-transform zum Verkleinern).
// Die Haltung und die Farben stehen in tools/mensch/statist.html (STATISTEN), der Mensch selbst in tools/mensch/rezepte.sh.
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { createRequire } from 'module';
const require = createRequire(fs.existsSync('/opt/node-tools/node_modules/') ? '/opt/node-tools/node_modules/' : import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DREIECKE = { ballkind: 5000, linienrichter: 5000 };       // so viele Dreiecke bleiben ungefähr übrig

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 740 } });
page.on('pageerror', (e) => console.log('FEHLER', e.message));
// three.js kommt im Test-Rechner aus der Kopie der iOS-App (jsDelivr ist dort nicht erreichbar)
await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => { const f = path.join(ROOT, 'ios/vendor/three', r.request().url().split('three@0.160.0/')[1]); fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'text/javascript' }) : r.continue(); });
const tmp = fs.mkdtempSync('/tmp/statist-');
for (const wer of process.argv.slice(2)) {
  await page.goto('http://localhost:8765/tools/mensch/statist.html?wer=' + wer);
  await page.waitForFunction('window.__statist', null, { timeout: 240000 });
  const D = await page.evaluate('__statist.daten()');
  await page.screenshot({ path: path.join(tmp, wer + '.png') });
  // ---- eine GLB-Datei von Hand zusammensetzen: Punkte, Richtungen, Bild-Stellen, Dreiecke und das Bild
  const teile = ['pos', 'nor', 'uv', 'idx'].map((k) => Buffer.from(D[k], 'base64')).concat(Buffer.from(D.bild.split(',')[1], 'base64'));
  const pos = new Float32Array(teile[0].buffer, teile[0].byteOffset, teile[0].length / 4), n = pos.length / 3;
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i++) { min[i % 3] = Math.min(min[i % 3], pos[i]); max[i % 3] = Math.max(max[i % 3], pos[i]); }
  let ab = 0; const sichten = teile.map((t) => { const s = { buffer: 0, byteOffset: ab, byteLength: t.length }; ab += Math.ceil(t.length / 4) * 4; return s; });
  const bin = Buffer.alloc(ab); teile.forEach((t, i) => t.copy(bin, sichten[i].byteOffset));
  const json = {
    asset: { version: '2.0', generator: 'Powershot tools/mensch/statist.mjs' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: wer }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 }, alphaMode: 'MASK', alphaCutoff: 0.45, doubleSided: true }],
    textures: [{ source: 0 }], images: [{ bufferView: 4, mimeType: 'image/png' }],
    accessors: [{ bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5126, count: n, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: n, type: 'VEC2' }, { bufferView: 3, componentType: 5125, count: teile[3].length / 4, type: 'SCALAR' }],
    bufferViews: sichten, buffers: [{ byteLength: ab }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const kopf = Buffer.alloc(12); kopf.writeUInt32LE(0x46546C67, 0); kopf.writeUInt32LE(2, 4); kopf.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const k1 = Buffer.alloc(8); k1.writeUInt32LE(js.length, 0); k1.writeUInt32LE(0x4E4F534A, 4);
  const k2 = Buffer.alloc(8); k2.writeUInt32LE(bin.length, 0); k2.writeUInt32LE(0x004E4942, 4);
  const roh = path.join(tmp, wer + '_roh.glb'), klein = path.join(tmp, wer + '_klein.glb'), ziel = path.join(ROOT, 'assets', wer + '.glb');
  fs.writeFileSync(roh, Buffer.concat([kopf, k1, js, k2, bin]));
  // ---- verkleinern: Punkte verschweißen, Dreiecke sparen, Bild als WebP
  const jetzt = teile[3].length / 12, anteil = Math.min(1, (DREIECKE[wer] || 5000) / jetzt).toFixed(3);
  const tu = (b) => execSync('npx --yes @gltf-transform/cli ' + b, { stdio: 'pipe' });
  tu(`weld ${roh} ${klein}`); tu(`simplify ${klein} ${klein} --ratio ${anteil} --error 0.01`); tu(`webp ${klein} ${ziel} --quality 85`);
  console.log(wer, '→', path.relative(ROOT, ziel), fs.statSync(ziel).size, 'Bytes, vorher', jetzt, 'Dreiecke; Bild:', path.join(tmp, wer + '.png'));
}
await browser.close();
