// Prüft die Lagepläne der Turniergelände (js/gelaende.js), ohne Grafik:
//   - Hat jedes Gelände alle neun Orte (Centre Court, Trainingsplatz, Kraftraum …)?
//   - Stehen Stadien, Häuser und Plätze nicht ineinander?
//   - Liegt jede Tür frei, und kommt man vom Fahrdienst zu Fuß überall hin?
// Aufruf: node tools/gelaende.mjs
import { GELAENDE_LISTE, planVon, planAus, gelaendeFuer, PFLICHT_ORTE } from '../js/gelaende.js';
import { KLEINE_TURNIERE, LIGA } from '../js/kleinetour.js';
import { gitterBauen, frei, weg } from '../js/wege.js';

let fehler = 0;
const sag = (t) => { console.log('  ✗ ' + t); fehler++; };
// Die großen Gelände einzeln, dazu jedes kleine Turnier (jede Stadt und Turnier-Stufe einmal) und das Liga-Spiel
const alle = GELAENDE_LISTE.map((id) => [id, planVon(id), true]);
const gesehen = new Set();
for (const def of [...KLEINE_TURNIERE, LIGA]) {
  const key = def.city + '|' + def.cat + '|' + def.surface;
  if (gesehen.has(key)) continue;
  gesehen.add(key);
  alle.push([`${def.name} (${def.surface})`, planAus(gelaendeFuer(def), key), false]);
}
for (const [id, plan, laut] of alle) {
  const g = plan.g, vorher = fehler;
  if (laut) console.log(`${id}: ${g.name} – ${plan.teile.length} Bausteine, ${plan.orte.length} Türen`);
  for (const o of PFLICHT_ORTE) { const n = plan.orte.filter((x) => x.id === o).length; if (n !== 1) sag(`Ort „${o}“ gibt es ${n}-mal (soll: 1)`); }
  // Überschneidungen von festen Bausteinen (als Rechtecke gerechnet), nur innerhalb des Geländes
  const fest = plan.teile.filter((e) => ['stadion', 'haus', 'plaetze'].includes(e.a) && e.x > g.rand.x0 && e.x < g.rand.x1 && e.z > g.rand.z0 && e.z < g.rand.z1);
  for (let i = 0; i < fest.length; i++) for (let k = i + 1; k < fest.length; k++) {
    const a = fest[i], b = fest[k];
    if (Math.abs(a.x - b.x) < (a.b + b.b) / 2 - 0.01 && Math.abs(a.z - b.z) < (a.t + b.t) / 2 - 0.01) sag(`„${a.name || a.a}“ und „${b.name || b.a}“ stehen ineinander`);
  }
  for (const e of fest) if (e.x - e.b / 2 < g.rand.x0 || e.x + e.b / 2 > g.rand.x1 || e.z - e.t / 2 < g.rand.z0 || e.z + e.t / 2 > g.rand.z1) sag(`„${e.name || e.a}“ ragt über den Rand`);
  const G = gitterBauen(g.rand, plan.sperren);
  const start = plan.orte.find((o) => o.id === 'hotel');
  let laengster = 0;
  for (const o of plan.orte) {
    if (!frei(G, o.tx, o.tz)) { sag(`Tür „${o.name || o.id}“ (${o.tx.toFixed(1)}, ${o.tz.toFixed(1)}) ist zugebaut`); continue; }
    if (!start || !frei(G, start.tx, start.tz)) continue;
    const w = weg(G, start.tx, start.tz, o.tx, o.tz);
    if (!w) { sag(`Kein Weg vom Fahrdienst zu „${o.name || o.id}“`); continue; }
    let l = 0, px = start.tx, pz = start.tz;
    for (const p of w) { l += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
    laengster = Math.max(laengster, l);
  }
  if (laut) console.log(`  längster Weg vom Fahrdienst: ${Math.round(laengster)} m`);
  else if (fehler > vorher) console.log(`  ↑ in: ${id}`);
}
console.log(`${alle.length} Gelände geprüft (${GELAENDE_LISTE.length} große, ${alle.length - GELAENDE_LISTE.length} kleine).`);
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
