// Prüft die Fahrt ins Hotel und den Fußweg zum Hotel, ohne Grafik:
//   - Turniere mit Fahrdienst: Hat das Hotel einen Platz an der Straße gefunden? Wie lang ist die Fahrt? Ragt das Hotel in nichts hinein?
//   - Kleine Turniere: Gibt es in jedem Städtchen einen Weg vom Start zum Hotel und zu jedem Wegweiser-Ort?
// Aufruf: node tools/hotel.mjs          (mit „laut“ dahinter: jedes Gelände einzeln)
import { GELAENDE_LISTE, planVon, planAus, gelaendeFuer } from '../js/gelaende.js';
import { KLEINE_TURNIERE, LIGA } from '../js/kleinetour.js';
import { hotelArt, streckeBauen, ortAuf } from '../js/hotelfahrt.js';
import { stadtGelaende } from '../js/hotelweg.js';
import { gitterBauen, frei, weg } from '../js/wege.js';

const laut = process.argv.includes('laut');
let fehler = 0;
const sag = (t) => { console.log('  ✗ ' + t); fehler++; };
const alle = GELAENDE_LISTE.map((id) => [id, planVon(id), null, true]);
const gesehen = new Set();
for (const def of [...KLEINE_TURNIERE, LIGA]) {
  const key = def.city + '|' + def.cat + '|' + def.surface;
  if (gesehen.has(key)) continue;
  gesehen.add(key);
  alle.push([`${def.name} (${def.surface})`, planAus(gelaendeFuer(def), key), def, false]);
}
const zahl = { fahrt: 0, ohne: 0, fuss: 0, hier: 0, heim: 0 };
let kurz = 1e9, lang = 0, wegKurz = 1e9, wegLang = 0;
for (const [id, plan, def, gross] of alle) {
  const g = plan.g, art = hotelArt(g);
  if (art === 'fahrt') {
    const h = plan.hotel;
    if (!h) { zahl.ohne++; if (gross || laut) console.log(`  – ${id}: kein Platz für das Hotel an der Straße (dann gibt es nur einen Bildwechsel)`); if (gross) fehler++; continue; }
    zahl.fahrt++;
    const st = streckeBauen(h.start, h.mittel);
    kurz = Math.min(kurz, st.lang); lang = Math.max(lang, st.lang);
    // Die Strecke darf nirgends einen Sprung haben, und der Wagen darf nicht durch ein Haus oder Stadion fahren
    for (let i = 1; i < st.p.length; i++) if (!(st.p[i].s - st.p[i - 1].s < 400)) sag(`${id}: Sprung in der Strecke`);
    const fest = plan.teile.filter((e) => ['stadion', 'haus', 'plaetze', 'hotel'].includes(e.a));
    for (let s = 0; s <= st.lang; s += 2) {
      const o = ortAuf(st, s), drin = fest.find((e) => Math.abs(o.x - e.x) < e.b / 2 + 0.9 && Math.abs(o.z - e.z) < e.t / 2 + 0.9);
      if (drin) { sag(`${id}: Der Wagen fährt nach ${Math.round(s)} m durch „${drin.name || drin.a}“`); break; }
    }
    // Das Hotel darf in keinem anderen Baustein stehen
    for (const e of plan.teile) {
      if (e === h.teil || !['stadion', 'haus', 'plaetze'].includes(e.a) && !(e.a === 'flaeche' && e.wasser)) continue;
      if (Math.abs(e.x - h.teil.x) < (e.b + h.teil.b) / 2 && Math.abs(e.z - h.teil.z) < (e.t + h.teil.t) / 2) sag(`${id}: Hotel steht in „${e.name || e.a}“`);
    }
    if (gross || laut) console.log(`  ${id}: ${h.name} (${h.art}, ${h.teil.h} m hoch) – Fahrt ${Math.round(st.lang)} m, etwa ${Math.round(st.lang / 11 + 8)} s`);
  } else if (art === 'fuss' || art === 'heim') {
    zahl[art]++;
    const S = stadtGelaende(def, g), p = planAus(S), G = gitterBauen(S.rand, p.sperren);
    const start = p.orte.find((o) => o.id === 'start'), ziel = p.orte.find((o) => o.id === 'ziel');
    if (!start || !ziel) { sag(`${id}: Start oder Hotel fehlt im Städtchen`); continue; }
    for (const o of p.orte) {
      if (!frei(G, o.tx, o.tz)) { sag(`${id}: „${o.name || o.id}“ im Städtchen ist zugebaut`); continue; }
      const w = weg(G, start.tx, start.tz, o.tx, o.tz);
      if (!w) { sag(`${id}: kein Weg vom Start zu „${o.name || o.id}“`); continue; }
      if (o !== ziel) continue;
      let l = 0, px = start.tx, pz = start.tz;
      for (const q of w) { l += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
      const luft = Math.hypot(ziel.tx - start.tx, ziel.tz - start.tz);
      wegKurz = Math.min(wegKurz, l); wegLang = Math.max(wegLang, l);
      if (laut) console.log(`  ${id}: ${S.ziel.name} – Fußweg ${Math.round(l)} m (Luftlinie ${Math.round(luft)} m), ${p.teile.filter((e) => e.a === 'haus').length} Häuser`);
    }
  } else zahl.hier++;
}
console.log(`${alle.length} Gelände geprüft.`);
console.log(`Fahrdienst: ${zahl.fahrt} mit sichtbarer Fahrt (${Math.round(kurz)} bis ${Math.round(lang)} m), ${zahl.ohne} ohne Platz für das Hotel.`);
console.log(`Zu Fuß: ${zahl.fuss} Städtchen und ${zahl.heim}-mal der Heimweg (Fußweg ${Math.round(wegKurz)} bis ${Math.round(wegLang)} m), ${zahl.hier} Urlaubshotels (Zimmer auf der Anlage).`);
console.log(fehler ? `\n${fehler} Fehler` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
