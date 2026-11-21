// Prüft die Geräusche: Gibt es jede Datei aus der Tabelle in js/audio.js? Steht bei jeder Datei, woher sie kommt (sounds/quellen.json)?
// Liegt eine Datei im Ordner, die niemand benutzt? Aufruf: node tools/sounds.mjs
import fs from 'node:fs';
import path from 'node:path';
import { KLAENGE } from '../js/audio.js';

const ordner = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'sounds');
const quellen = JSON.parse(fs.readFileSync(path.join(ordner, 'quellen.json'), 'utf8'));
const mitQuelle = new Map(quellen.map((q) => [q.datei.replace('sounds/', ''), q]));
let fehler = 0, anzahl = 0, bytes = 0;
const benutzt = new Set();
const meckern = (text) => { fehler++; console.log('✗ ' + text); };

for (const [name, k] of Object.entries(KLAENGE)) {
  if (!k.v.length) meckern(`${name}: keine Aufnahme eingetragen`);
  for (const [datei, laut] of k.v) {
    benutzt.add(datei); anzahl++;
    const voll = path.join(ordner, datei);
    if (!fs.existsSync(voll)) { meckern(`${name}: Datei fehlt – ${datei}`); continue; }
    bytes += fs.statSync(voll).size;
    const q = mitQuelle.get(datei);
    if (!q) meckern(`${name}: ${datei} steht nicht in quellen.json`);
    else if (q.lizenz !== 'CC0 1.0') meckern(`${name}: ${datei} hat die Lizenz „${q.lizenz}“ – erlaubt ist nur CC0`);
    else if (!/^https:\/\/(freesound\.org|kenney\.nl)\//.test(q.url)) meckern(`${name}: ${datei} hat keine Adresse der Quelle`);
    if (!(laut > 0 && laut <= 2)) meckern(`${name}: ${datei} hat eine merkwürdige Lautstärke (${laut})`);
  }
}
// Dateien im Ordner, die in keiner Tabelle stehen
const alle = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alle(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const f of alle(ordner)) {
  const rel = path.relative(ordner, f).split(path.sep).join('/');
  if (rel.endsWith('.mp3') && !benutzt.has(rel)) meckern(`${rel} liegt im Ordner, wird aber nicht benutzt`);
}
for (const d of mitQuelle.keys()) if (!benutzt.has(d)) meckern(`${d} steht in quellen.json, wird aber nicht benutzt`);

console.log(`${Object.keys(KLAENGE).length} Geräusche, ${anzahl} Aufnahmen, zusammen ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(fehler ? `${fehler} Fehler` : '✓ Alles da, alles CC0, bei allem steht die Quelle');
process.exit(fehler ? 1 : 0);
