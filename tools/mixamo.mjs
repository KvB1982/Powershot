// Powershot – Werkzeug: Bewegungen von Mixamo (mixamo.com, Adobe) auf unsere Tennisspieler umrechnen.
//
//   node tools/mixamo.mjs "/Pfad/zum/Ordner/Motion Capture"
//   node tools/mixamo.mjs "/Pfad/zum/Ordner" --info        zeigt nur, was in jeder Datei steckt
//
// Im Ordner liegen die FBX-Dateien, so wie Mixamo sie herausgibt (Figur „mit Haut“, Knochen heißen mixamorig…:Hips usw.).
// Aus jeder Datei in der Tabelle CLIPS wird 60-mal pro Sekunde gelesen, wo die Gelenke sind. Dann wie bei tools/gang.mjs:
// nur die Richtungen der Glieder übernehmen, die Längen kommen von unserer Figur (tools/figurmass.mjs).
// Bei Lauf-Bewegungen läuft die Mixamo-Figur wirklich vom Fleck. Das wird herausgerechnet (die Figur läuft dann wie auf
// einem Laufband) und gemerkt: weg = Meter je Doppelschritt, tempo = Meter pro Sekunde, richtung = wohin es geht.
// Jede Runde beginnt in dem Moment, in dem der rechte Fuß in Laufrichtung am weitesten vor dem linken ist –
// so laufen alle Aufnahmen im selben Takt und das Spiel darf sie mischen.
// Heraus kommt assets/lauf.json (gleiches Format wie assets/gang.json).
//
// Zum Lesen der FBX-Dateien braucht das Werkzeug three.js in node_modules (npm install three@0.160.0, wie tools/mocap.mjs).
// Liegt im Ordner schon _powershot/gelenke/<Name>.json (die ausgelesenen Gelenke), wird die genommen – dann geht es ohne three.js.
// Die FBX-Dateien selbst kommen NICHT ins Repository (Mixamo erlaubt, die Bewegungen im Spiel zu benutzen, aber nicht, die Dateien weiterzugeben).

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { MASS, KEYS, umrechner } from './figurmass.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDNER = process.argv.slice(2).find((x) => !x.startsWith('--'));
const INFO = process.argv.includes('--info');
const FPS = 60;
if (!ORDNER) { console.log('Aufruf: node tools/mixamo.mjs "<Ordner mit den FBX-Dateien>" [--info]'); process.exit(1); }

// Welche Datei wird welche Bewegung im Spiel? art 'lauf' = Runde mit Schritten (wird im Takt der Schritte abgespielt),
// art 'steh' = Runde auf der Stelle (läuft einfach mit der Zeit),
// art 'uebung' = eine Turn-Übung für die Mini-Spiele: Es wird nur der Weg von der Grundstellung (wo `mass` am kleinsten ist)
// bis ganz ausgeführt (wo `mass` am größten ist) gespeichert – das Mini-Spiel fährt darauf hin und her.
const CLIPS = {
  lauf:   { datei: 'Running-2', art: 'lauf' },             // lockerer, schneller Lauf geradeaus
  spurt:  { datei: 'Sprint', art: 'lauf' },                // voller Sprint
  seit_r: { datei: 'Jog Strafe Right', art: 'lauf' },      // seitwärts laufen nach rechts (Blick bleibt vorn)
  seit_l: { datei: 'Jog Strafe Left', art: 'lauf' },       // seitwärts laufen nach links
  steh:   { datei: 'Idle-2', art: 'steh' },                // locker dastehen und atmen
  hampel: { datei: 'Jumping Jacks', art: 'uebung', mass: (o) => o.handR[2] + o.handL[2] + o.footR[1] - o.footL[1] },   // Hampelmann: Hände hoch, Füße auseinander
  hocke:  { datei: 'Air Squat Bent Arms', art: 'uebung', mass: (o) => -o.hip[2] },                                   // Kniebeuge: Hüfte ganz unten
};

// ---- eine Datei lesen: Antwort { dauer, ruhe: Gelenke in der T-Pose, bilder: [Gelenke je Bild] }, alles [vor, seite, hoch] in Metern
const NAMEN = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', ...['Left', 'Right'].flatMap((S) => ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'HandMiddle1', 'UpLeg', 'Leg', 'Foot', 'ToeBase'].map((n) => S + n))];
let THREE = null, FBXLoader = null;
async function lies(name) {
  const fertig = path.join(ORDNER, '_powershot/gelenke', name + '.json');
  if (fs.existsSync(fertig)) return JSON.parse(fs.readFileSync(fertig, 'utf8'));
  if (!THREE) {
    // three.js läuft auch ohne Browser, braucht aber ein paar Platzhalter
    globalThis.self = globalThis; globalThis.window = globalThis;
    globalThis.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {}, getContext: () => null }) };
    console.warn = () => {};
    THREE = await import(pathToFileURL(path.join(ROOT, 'node_modules/three/build/three.module.js')).href);
    ({ FBXLoader } = await import(pathToFileURL(path.join(ROOT, 'node_modules/three/examples/jsm/loaders/FBXLoader.js')).href));
  }
  const buf = fs.readFileSync(path.join(ORDNER, name + '.fbx'));
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const B = {}; obj.traverse((o) => { const m = /^mixamorig\d*:?(.+)$/.exec(o.name); if (m && NAMEN.includes(m[1]) && !B[m[1]]) B[m[1]] = o; });
  for (const n of NAMEN) if (!B[n]) throw new Error('Knochen fehlt: ' + n);
  const clip = obj.animations.sort((a, b) => b.duration - a.duration)[0];
  const v = new THREE.Vector3();
  // (Mixamo: schaut nach +z, links ist +x, oben ist +y, Zentimeter)
  const bild = () => { obj.updateMatrixWorld(true); const f = {}; for (const n of NAMEN) { B[n].getWorldPosition(v); f[n] = [v.z / 100, -v.x / 100, v.y / 100]; } return f; };
  let haut = null; obj.traverse((o) => { if (o.isSkinnedMesh && !haut) haut = o; });
  if (!haut) throw new Error('Die Datei hat keine Figur („with skin“ bei Mixamo wählen)');
  haut.skeleton.pose(); const ruhe = bild();
  const mixer = new THREE.AnimationMixer(obj); mixer.clipAction(clip).play();
  const n = Math.round(clip.duration * FPS), bilder = [];
  for (let i = 0; i <= n; i++) { mixer.setTime(Math.min(clip.duration - 1e-5, i / FPS)); bilder.push(bild()); }
  return { dauer: clip.duration, ruhe, bilder };
}

if (INFO) {
  const namen = [...new Set([...fs.readdirSync(ORDNER).filter((x) => /\.fbx$/i.test(x)).map((x) => x.replace(/\.fbx$/i, '')),
    ...(fs.existsSync(path.join(ORDNER, '_powershot/gelenke')) ? fs.readdirSync(path.join(ORDNER, '_powershot/gelenke')).map((x) => x.replace(/\.json$/, '')) : [])])].sort();
  for (const n of namen) {
    const r = await lies(n), a = r.bilder[0], e = r.bilder[r.bilder.length - 1], h = r.bilder.map((b) => b.Hips[2]);
    console.log(n.padEnd(28), (r.dauer.toFixed(2) + ' s').padStart(7), '· läuft', (e.Hips[0] - a.Hips[0]).toFixed(2).padStart(5), 'm vor,', (e.Hips[1] - a.Hips[1]).toFixed(2).padStart(5), 'm zur Seite · Hüfte', Math.min(...h).toFixed(2), 'bis', Math.max(...h).toFixed(2), 'm hoch');
  }
  process.exit(0);
}

const ergebnis = {
  quelle: 'Bewegungen von Mixamo (mixamo.com, Adobe), von Kristian heruntergeladen. Auf unsere Figur umgerechnet mit tools/mixamo.mjs – nur Gelenk-Punkte, nicht die Mixamo-Dateien.',
  keys: KEYS, clips: {},
};
for (const [name, def] of Object.entries(CLIPS)) {
  const roh = await lies(def.datei);
  const umrechnen = umrechner(roh.ruhe, 'HandMiddle1');
  const N = roh.bilder.length - 1, dauer = roh.dauer;                    // das letzte Bild ist wieder das erste (nur weiter gelaufen)
  // Wie weit ist die Figur in einer Runde gelaufen? Das wird gleichmäßig abgezogen: Laufband.
  const a = roh.bilder[0].Hips, e = roh.bilder[N].Hips, lauf = [e[0] - a[0], e[1] - a[1]];
  let B = [];
  for (let i = 0; i < N; i++) {
    const Q = {}; for (const k in roh.bilder[i]) Q[k] = [roh.bilder[i][k][0] - lauf[0] * i / N, roh.bilder[i][k][1] - lauf[1] * i / N, roh.bilder[i][k][2]];
    B.push(umrechnen(Q));
  }
  const weg = Math.hypot(lauf[0], lauf[1]) * umrechnen.kBein;
  const richtung = weg > 0.3 ? [lauf[0] / Math.hypot(...lauf), lauf[1] / Math.hypot(...lauf)] : [0, 0];
  // Beginn der Runde: der rechte Fuß ist in Laufrichtung am weitesten vor dem linken
  let start = 0, weit = -9;
  if (def.art === 'lauf') B.forEach((o, i) => { const w = (o.footR[0] - o.footL[0]) * richtung[0] + (o.footR[1] - o.footL[1]) * richtung[1]; if (w > weit) { weit = w; start = i; } });
  B = [...B.slice(start), ...B.slice(0, start)];
  const alle = B;
  if (def.art === 'uebung') {
    // Grundstellung und ganz ausgeführt suchen, dann nur die Bilder dazwischen behalten (in der Reihenfolge der Aufnahme)
    let von = 0, bis = 0;
    B.forEach((o, i) => { if (def.mass(o) < def.mass(B[von])) von = i; if (def.mass(o) > def.mass(B[bis])) bis = i; });
    const teil = []; for (let i = von; ; i = (i + 1) % N) { teil.push(B[i]); if (i === bis) break; }
    // (steht die Figur am Anfang noch eine Weile still, fällt das weg – sonst passiert im Mini-Spiel zuerst lange nichts)
    const m0 = def.mass(teil[0]), spanne = def.mass(teil[teil.length - 1]) - m0;
    while (teil.length > 3 && def.mass(teil[1]) - m0 < spanne * 0.02) teil.shift();
    B = teil;
  }
  // Auf den Boden stellen und in die Mitte rücken
  const tief = Math.min(...alle.map((o) => Math.min(o.footR[2], o.footL[2])));
  const mx = alle.reduce((s, o) => s + o.hip[0], 0) / N, my = alle.reduce((s, o) => s + o.hip[1], 0) / N;
  for (const o of alle) for (const k of KEYS) o[k] = [o[k][0] - mx, o[k][1] - my, o[k][2] - tief + MASS.knoechel];
  const frames = (def.art === 'uebung' ? B : [...B, B[0]]).map((o) => KEYS.flatMap((k) => o[k].map((x) => Math.round(x * 1000) / 1000)));
  const rund = (x, n = 1000) => Math.round(x * n) / n;
  ergebnis.clips[name] = def.art === 'lauf'
    ? { t0: 0, fps: FPS, loop: 1, gang: 1, schritte: 1, weg: rund(weg), tempo: rund(weg / dauer, 100), richtung: richtung.map((x) => rund(x)), frames }
    : def.art === 'uebung' ? { t0: 0, fps: frames.length - 1, frames }       // (so dauert der Weg genau „eine Sekunde“: 0 = Grundstellung, 1 = ganz ausgeführt)
      : { t0: 0, fps: FPS, loop: 1, frames };
  const hoch = B.map((o) => o.hip[2]);
  console.log(`  ${name.padEnd(7)} aus „${def.datei}“: ${frames.length} Bilder, ${dauer.toFixed(2)} s` + (def.art === 'lauf' ? `, ${weg.toFixed(2)} m je Doppelschritt = ${(weg / dauer).toFixed(2)} m/s, Richtung [${richtung.map((x) => x.toFixed(2))}]` : '') +
    ` · Hüfte ${Math.min(...hoch).toFixed(2)}–${Math.max(...hoch).toFixed(2)} m hoch · Fuß hebt bis ${Math.max(...B.map((o) => o.footR[2])).toFixed(2)} m`);
}
const ziel = path.join(ROOT, 'assets/lauf.json');
fs.writeFileSync(ziel, JSON.stringify(ergebnis));
console.log(`geschrieben: assets/lauf.json (${Math.round(fs.statSync(ziel).size / 1024)} KB)`);
