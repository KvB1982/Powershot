// Powershot – Werkzeug: Gehen und Sprinten aus dem Schwester-Spiel „Blaulicht über Möwenbrück“ (KvB1982/Police-Quest) holen.
//
//   node tools/gang.mjs ../Police-Quest/assets/modelle/polizist.glb
//
// In der Polizisten-Figur stecken zwei Bewegungs-Aufnahmen (ein Doppelschritt „gehen“, ein Doppelschritt „laufen“ = Sprint).
// Die Aufnahmen hat Kristian selbst mit DeepMotion SayMotion erzeugt; sie liegen schon im öffentlichen Police-Quest-Repository.
// Der Polizist hat andere Knochen und andere Maße als unsere Tennisspieler. Deshalb wird umgerechnet:
//   1. Für jedes Bild ausrechnen, wo die Gelenke des Polizisten sind (Knochen für Knochen von der Hüfte nach außen).
//   2. Nur die RICHTUNGEN von Oberschenkel, Unterschenkel, Oberarm, Unterarm, Rumpf übernehmen –
//      die LÄNGEN kommen von unserer Figur (MASS unten). So wird kein Bein langgezogen.
//   3. So hinstellen, dass der tiefste Fuß genau am Boden ist, und die Runde mit dem rechten Fuß ganz vorn beginnen lassen.
// Heraus kommt assets/gang.json (Gelenke als [vor, seite, hoch] in Metern, 60 Bilder pro Sekunde) –
// dasselbe Format wie mocap/bewegungen.json, nur dass diese Datei ins Repository darf.
// Braucht kein three.js und keine anderen Pakete.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASS, KEYS, add, umrechner } from './figurmass.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = process.argv[2] || path.join(ROOT, '../Police-Quest/assets/modelle/polizist.glb');
const FPS = 60;

// Welche Aufnahme wird welche Bewegung im Spiel?
const CLIPS = { walk: 'gehen', sprint: 'laufen' };

// ---- kleine Rechen-Helfer
// Drehungen sind vier Zahlen [x, y, z, w] (ein „Quaternion“)
const qMal = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qDreh = (q, v) => { const u = [q[0], q[1], q[2]], t = [2 * (u[1] * v[2] - u[2] * v[1]), 2 * (u[2] * v[0] - u[0] * v[2]), 2 * (u[0] * v[1] - u[1] * v[0])];
  return [v[0] + q[3] * t[0] + u[1] * t[2] - u[2] * t[1], v[1] + q[3] * t[1] + u[2] * t[0] - u[0] * t[2], v[2] + q[3] * t[2] + u[0] * t[1] - u[1] * t[0]]; };
const qMix = (a, b, t) => { const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1; const q = a.map((x, i) => x + (s * b[i] - x) * t); const l = Math.hypot(...q); return q.map((x) => x / l); };

// ---- die GLB-Datei lesen (ein Stück Text mit der Beschreibung, dahinter die Zahlen)
const buf = fs.readFileSync(QUELLE);
const textLang = buf.readUInt32LE(12);
const G = JSON.parse(buf.slice(20, 20 + textLang).toString());
const bin = buf.slice(20 + textLang + 8);
function zahlen(nr) {
  const a = G.accessors[nr], v = G.bufferViews[a.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const ab = (v.byteOffset || 0) + (a.byteOffset || 0), aus = [];
  for (let i = 0; i < a.count; i++) { const z = []; for (let k = 0; k < n; k++) z.push(bin.readFloatLE(ab + (i * n + k) * 4)); aus.push(n === 1 ? z[0] : z); }
  return aus;
}
const eltern = {};
G.nodes.forEach((n, i) => (n.children || []).forEach((k) => { eltern[k] = i; }));
const nr = Object.fromEntries(G.nodes.map((n, i) => [n.name, i]));

// Wo sind alle Gelenke? spuren = Bewegung (oder null = Ruhe-Haltung, die T-Pose), t = Zeit in Sekunden.
// Antwort: Name → [vor, seite, hoch] in Metern. (Polizist: schaut nach +z, links ist +x, oben ist +y, Zentimeter.)
function gelenke(spuren, t) {
  const lokal = G.nodes.map((n, i) => {
    let p = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1];
    for (const s of (spuren && spuren[i]) || []) {
      const T = s.zeiten, ende = T[T.length - 1], x = Math.max(0, Math.min(ende, t));
      let k = 0; while (k < T.length - 2 && T[k + 1] <= x) k++;
      const u = (x - T[k]) / (T[k + 1] - T[k]);
      if (s.art === 'rotation') q = qMix(s.werte[k], s.werte[k + 1], u); else p = s.werte[k].map((w, j) => w + (s.werte[k + 1][j] - w) * u);
    }
    return { p, q };
  });
  const welt = {};
  const rechne = (i) => {
    if (welt[i]) return welt[i];
    const e = eltern[i] !== undefined ? rechne(eltern[i]) : { p: [0, 0, 0], q: [0, 0, 0, 1] };
    return (welt[i] = { p: add(e.p, qDreh(e.q, lokal[i].p)), q: qMal(e.q, lokal[i].q) });
  };
  const aus = {};
  for (const [name, i] of Object.entries(nr)) { const p = rechne(i).p; aus[name] = [p[2] / 100, -p[0] / 100, p[1] / 100]; }
  return aus;
}

// ---- Maße des Polizisten in der Ruhe-Haltung
const R = gelenke(null, 0);
const umrechnen = umrechner(R), { beinQ, kBein, rumpfQ } = umrechnen;

const ergebnis = {
  quelle: 'Gehen und Sprinten aus KvB1982/Police-Quest (assets/modelle/polizist.glb): Aufnahmen von DeepMotion SayMotion, von Kristian erzeugt. Umgerechnet mit tools/gang.mjs.',
  keys: KEYS, clips: {},
};
console.log(`Polizist: Bein ${beinQ.toFixed(3)} m (unsere Figur ${(MASS.ober + MASS.unter).toFixed(3)} m, also mal ${kBein.toFixed(3)}), Hüfte bis Hals ${rumpfQ.toFixed(3)} m`);
for (const [name, quelle] of Object.entries(CLIPS)) {
  const anim = G.animations.find((a) => a.name === quelle);
  if (!anim) { console.log(`  ${name}: Bewegung „${quelle}“ fehlt in der Datei`); continue; }
  const spuren = {}; let dauer = 0;
  for (const c of anim.channels) {
    const s = anim.samplers[c.sampler], zeiten = zahlen(s.input);
    dauer = Math.max(dauer, zeiten[zeiten.length - 1]);
    (spuren[c.target.node] = spuren[c.target.node] || []).push({ art: c.target.path, zeiten, werte: zahlen(s.output) });
  }
  // Die Runde in gleich lange Bilder teilen (die Aufnahme ist schon eine Schleife: Ende = Anfang)
  const N = Math.round(dauer * FPS);
  let B = []; for (let i = 0; i < N; i++) B.push(umrechnen(gelenke(spuren, i / N * dauer)));
  // Beginn der Runde: der rechte Fuß ist am weitesten vor dem linken
  let start = 0, weit = -9;
  B.forEach((o, i) => { const w = o.footR[0] - o.footL[0]; if (w > weit) { weit = w; start = i; } });
  B = [...B.slice(start), ...B.slice(0, start)];
  // Auf den Boden stellen: Der tiefste Knöchel der ganzen Runde ist so hoch wie bei einem flach stehenden Fuß.
  // Seitlich und nach vorn bleibt die Figur im Mittel genau über ihrem Platz.
  const tief = Math.min(...B.map((o) => Math.min(o.footR[2], o.footL[2])));
  const mx = B.reduce((s, o) => s + o.hip[0], 0) / N, my = B.reduce((s, o) => s + o.hip[1], 0) / N;
  for (const o of B) for (const k of KEYS) o[k] = [o[k][0] - mx, o[k][1] - my, o[k][2] - tief + MASS.knoechel];
  // Wie weit kommt man mit einem Doppelschritt? Solange ein Fuß am Boden steht, wandert er (von der Hüfte aus gesehen)
  // nach hinten – genau so schnell läuft die Figur nach vorn.
  // (Beim Sprint ist zwischendurch gar kein Fuß am Boden, deshalb zählt nur das mittlere Tempo der Füße, die gerade stehen.)
  const tempi = [];
  for (let i = 0; i < N; i++) for (const s of ['footR', 'footL']) {
    const a = B[i], b = B[(i + 1) % N];
    if (a[s][2] < MASS.knoechel + 0.02 && b[s][2] < MASS.knoechel + 0.02) tempi.push(((a[s][0] - a.hip[0]) - (b[s][0] - b.hip[0])) * N / dauer);
  }
  const weg = tempi.reduce((s, x) => s + x, 0) / tempi.length * dauer;
  const frames = [...B, B[0]].map((o) => KEYS.flatMap((k) => o[k].map((x) => Math.round(x * 1000) / 1000)));
  ergebnis.clips[name] = { t0: 0, fps: FPS, loop: 1, gang: 1, schritte: 1, weg: Math.round(weg * 1000) / 1000, tempo: Math.round(weg / dauer * 100) / 100, frames };
  const hoch = B.map((o) => o.hip[2]);
  console.log(`  ${name.padEnd(6)} aus „${quelle}“: ${N} Bilder, ${dauer.toFixed(2)} s je Doppelschritt, ${weg.toFixed(2)} m weit = ${(weg / dauer).toFixed(2)} m/s · ` +
    `Hüfte ${Math.min(...hoch).toFixed(2)}–${Math.max(...hoch).toFixed(2)} m hoch · Fuß hebt bis ${Math.max(...B.map((o) => o.footR[2])).toFixed(2)} m · Füße ${weit.toFixed(2)} m auseinander`);
}
const ziel = path.join(ROOT, 'assets/gang.json');
fs.writeFileSync(ziel, JSON.stringify(ergebnis));
console.log(`geschrieben: assets/gang.json (${Math.round(fs.statSync(ziel).size / 1024)} KB)`);
