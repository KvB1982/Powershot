// Besucher für das Turniergelände backen: aus den Menschen b1 … b7 (tools/mensch/bau.sh b1 b2 …) werden kleine Dateien
// assets/besucher/b1.glb … – jede mit 13 festen Haltungen (acht Schritt-Bilder, Stehen, Handy, Foto, Hüften, Reden).
//   node tools/mensch/menge.mjs b1 b2 b3 b4 b5 b6 b7
// Braucht: den Server (python3 tools/server.py), Playwright mit Chromium und npx (gltf-transform zum Verkleinern).
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process'; import { createRequire } from 'module';
const require = createRequire(fs.existsSync('/opt/node-tools/node_modules/') ? '/opt/node-tools/node_modules/' : import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DREIECKE = 1800;       // so viele Dreiecke hat ein Besucher ungefähr (ein Spieler hat 28.000)

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1300, height: 560 } });
page.on('pageerror', (e) => console.log('FEHLER', e.message));
await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (r) => { const f = path.join(ROOT, 'ios/vendor/three', r.request().url().split('three@0.160.0/')[1]); fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'text/javascript' }) : r.continue(); });
const tmp = fs.mkdtempSync('/tmp/menge-'), S = path.join(ROOT, 'tools/mensch/statisten');
fs.mkdirSync(path.join(S, 'klein'), { recursive: true }); fs.mkdirSync(path.join(ROOT, 'assets/besucher'), { recursive: true });
const tu = (b) => execSync('npx --yes @gltf-transform/cli ' + b, { stdio: 'pipe' }).toString();
for (const wer of process.argv.slice(2)) {
  // ---- 1. klein rechnen (die Gewichte für die Knochen bleiben dabei an den Punkten hängen)
  const gross = path.join(S, wer + '.glb'), klein = path.join(S, 'klein', wer + '.glb');
  if (fs.existsSync(gross)) {
    const vorher = +(/TRIANGLES[^\d]+\d+[^\d]+([\d,]+)/.exec(tu(`inspect ${gross}`).replace(/\x1b\[\d+m/g, '')) || [0, '28000'])[1].replace(/,/g, '');
    tu(`weld ${gross} ${klein}`); tu(`simplify ${klein} ${klein} --ratio ${(DREIECKE / vorher).toFixed(4)} --error 0.03`); tu(`resize ${klein} ${klein} --width 512 --height 256`);
  }
  // ---- 2. in allen Haltungen backen (tools/mensch/menge.html)
  await page.goto('http://localhost:8765/tools/mensch/menge.html?wer=' + wer);
  await page.waitForFunction('window.__menge', null, { timeout: 240000 });
  const D = await page.evaluate('__menge.daten()');
  await page.screenshot({ path: path.join(tmp, wer + '.png') });
  // ---- 3. eine GLB-Datei von Hand zusammensetzen: je Haltung eine Form; Bild-Stellen und Dreiecke teilen sich alle
  const B = (s) => Buffer.from(s, 'base64'), uv = B(D.uv), idx = B(D.idx), bild = B(D.bild.split(',')[1]), n = uv.length / 8;
  const teile = [], sichten = [], accessors = [], meshes = []; let ab = 0;
  const sicht = (buf, extra = {}) => { teile.push(buf); sichten.push({ buffer: 0, byteOffset: ab, byteLength: buf.length, ...extra }); ab += Math.ceil(buf.length / 4) * 4; return sichten.length - 1; };
  accessors.push({ bufferView: sicht(uv, { target: 34962 }), componentType: 5126, count: n, type: 'VEC2' });
  accessors.push({ bufferView: sicht(idx, { target: 34963 }), componentType: 5123, count: idx.length / 2, type: 'SCALAR' });
  for (const b of D.bilder) {
    const pb = B(b.pos), pos = new Float32Array(pb.buffer, pb.byteOffset, n * 3), min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let i = 0; i < pos.length; i++) { min[i % 3] = Math.min(min[i % 3], pos[i]); max[i % 3] = Math.max(max[i % 3], pos[i]); }
    accessors.push({ bufferView: sicht(pb, { target: 34962 }), componentType: 5126, count: n, type: 'VEC3', min, max });
    accessors.push({ bufferView: sicht(B(b.nor), { target: 34962, byteStride: 4 }), componentType: 5120, normalized: true, count: n, type: 'VEC3' });
    meshes.push({ name: b.name, primitives: [{ attributes: { POSITION: accessors.length - 2, NORMAL: accessors.length - 1, TEXCOORD_0: 0 }, indices: 1, material: 0 }] });
  }
  const bildSicht = sicht(bild), bin = Buffer.alloc(ab); teile.forEach((t, i) => t.copy(bin, sichten[i].byteOffset));
  const json = {
    asset: { version: '2.0', generator: 'Powershot tools/mensch/menge.mjs' }, extensionsUsed: ['KHR_mesh_quantization', 'EXT_texture_webp'], extensionsRequired: ['KHR_mesh_quantization', 'EXT_texture_webp'],
    scene: 0, scenes: [{ nodes: meshes.map((m, i) => i) }], nodes: meshes.map((m, i) => ({ mesh: i, name: m.name })), meshes,
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.85 }, alphaMode: 'MASK', alphaCutoff: 0.45, doubleSided: true }],
    textures: [{ extensions: { EXT_texture_webp: { source: 0 } } }], images: [{ bufferView: bildSicht, mimeType: 'image/webp' }],
    accessors, bufferViews: sichten, buffers: [{ byteLength: ab }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const kopf = Buffer.alloc(12); kopf.writeUInt32LE(0x46546C67, 0); kopf.writeUInt32LE(2, 4); kopf.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const k1 = Buffer.alloc(8); k1.writeUInt32LE(js.length, 0); k1.writeUInt32LE(0x4E4F534A, 4);
  const k2 = Buffer.alloc(8); k2.writeUInt32LE(bin.length, 0); k2.writeUInt32LE(0x004E4942, 4);
  const ziel = path.join(ROOT, 'assets/besucher', wer + '.glb');
  fs.writeFileSync(ziel, Buffer.concat([kopf, k1, js, k2, bin]));
  console.log(wer, '→', path.relative(ROOT, ziel), fs.statSync(ziel).size, 'Bytes,', n, 'Punkte,', idx.length / 6, 'Dreiecke; Bild:', path.join(tmp, wer + '.png'));
}
await browser.close();
