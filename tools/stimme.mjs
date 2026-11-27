// Prüft die Stimmen von Schiedsrichter und Linienrichtern (js/stimme.js, Aufnahmen in sounds/stimme/).
//   1. Gibt es zu jeder Ansage, jedem Linienrichter-Ruf und jedem Namen eine Datei – und liegt keine Datei herum, die niemand benutzt?
//   2. Hat jeder der 200 Profis und jeder Nachwuchsspieler eine Namens-Aufnahme?
//   3. Viele Matches werden Punkt für Punkt durchgezählt: Für jeden Spielstand muss eine Ansage herauskommen, die nur vorhandene Aufnahmen benutzt.
// Aufruf: node tools/stimme.mjs        (mit "laut" zeigt es die Ansagen eines Beispiel-Matches)
import fs from 'node:fs';
import path from 'node:path';
import { ANSAGEN, LINIE, NAMEN, nameClip, nameKuerzel, punktAnsage, standTeile, dateienFuer } from '../js/stimme.js';
import { MatchScore } from '../js/rules.js';
import { PLAYERS } from '../js/data.js';
import { NACHWUCHS } from '../js/kleinetour.js';

const ordner = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'sounds', 'stimme');
const laut = process.argv.includes('laut');
let fehler = 0;
const meckern = (text) => { fehler++; console.log('✗ ' + text); };

// 1. Dateien
const soll = new Set([...dateienFuer(), ...[...NAMEN].map((k) => 'namen/' + k)]);
let bytes = 0;
for (const clip of soll) {
  const f = path.join(ordner, clip + '.mp3');
  if (!fs.existsSync(f)) meckern(`Datei fehlt: sounds/stimme/${clip}.mp3`);
  else { const n = fs.statSync(f).size; bytes += n; if (n < 1500) meckern(`${clip}.mp3 ist verdächtig klein (${n} Bytes)`); if (n > 20000) meckern(`${clip}.mp3 ist verdächtig groß (${n} Bytes)`); }
}
for (const unter of fs.readdirSync(ordner, { withFileTypes: true })) {
  if (!unter.isDirectory()) continue;
  for (const f of fs.readdirSync(path.join(ordner, unter.name))) {
    const clip = unter.name + '/' + f.replace(/\.mp3$/, '');
    if (f.endsWith('.mp3') && !soll.has(clip)) meckern(`sounds/stimme/${clip}.mp3 liegt im Ordner, wird aber nicht benutzt`);
  }
}

// 2. Namen
for (const p of PLAYERS) if (!nameClip(p.short)) meckern(`Kein Name aufgenommen für ${p.name} (Kürzel „${nameKuerzel(p.short)}“)`);
for (const p of NACHWUCHS) if (!nameClip(p.short)) meckern(`Kein Name aufgenommen für Nachwuchsspieler ${p.name}`);
if (nameClip('Kristian')) meckern('Ein Name ohne Aufnahme darf keine Aufnahme liefern');

// 3. Matches durchzählen (fester Zufall, damit immer dasselbe herauskommt)
let z = 12345;
const zufall = () => { z = (z * 1103515245 + 12345) % 2147483648; return z / 2147483648; };
const da = (teile) => teile.filter((t) => typeof t === 'string').every((t) => soll.has(t));
const alsText = (teile) => (teile ? teile.map((t) => (typeof t === 'number' ? '·' : t.split('/')[1])).join(' ') : '(Stimme des Geräts)');
let punkte = 0, ohne = 0;
const gesehen = new Set();
const paare = [['Sinner', 'Alcaraz'], ['Zverev', 'J. Kessler'], ['Max', 'J. M. Cerundolo'], ['Max', 'Moritz']];
for (let m = 0; m < 400; m++) {
  const names = paare[m % paare.length];
  const sc = new MatchScore({ sets: m % 3 ? 2 : 1, games: m % 5 ? 6 : 3, tiebreak: true });
  const stark = 0.35 + 0.3 * zufall();
  let n = 0;
  while (sc.winner === null && n++ < 2000) {
    const w = zufall() < stark ? 0 : 1;
    const events = sc.pointTo(w);
    const reason = ['aus', 'netz', 'doppelfehler', 'ass', 'winner'][Math.floor(zufall() * 5)];
    const an = punktAnsage({ winner: w, reason, events }, sc, names, { finale: m % 7 === 0, netz: zufall() < 0.5 });
    punkte++;
    if (!an.teile) { ohne++; if (!sc.tiebreak) meckern(`Keine Ansage für einen normalen Spielstand (${sc.points})`); continue; }
    if (!an.teile.length) meckern('Leere Ansage');
    if (!da(an.teile)) meckern(`Ansage benutzt eine Aufnahme, die es nicht gibt: ${alsText(an.teile)}`);
    if (reason === 'aus' && an.linie !== 'out') meckern('Bei „Aus“ muss der Linienrichter rufen');
    if (an.linie && !LINIE[an.linie]) meckern(`Unbekannter Linienrichter-Ruf: ${an.linie}`);
    an.teile.forEach((t) => typeof t === 'string' && gesehen.add(t));
    if (laut && m === 0) console.log(`  ${names[w].padEnd(8)} ${reason.padEnd(13)} ${an.linie ? '[' + an.linie + '!] ' : ''}${alsText(an.teile)}`);
  }
  if (sc.winner === null) meckern('Match wurde nicht fertig');
}
// Kam jede Punkte-Ansage mindestens einmal vor? (Die Zahlen des Tiebreaks und "Play", "Time", "Quiet", "Fault", "Welcome" kommen woanders her.)
const immer = ANSAGEN.filter((k) => /^p\d\d$|^deuce|^adv|^game|^tiebreak|^double|_point$/.test(k));
for (const k of immer) if (!gesehen.has('en/' + k)) meckern(`Die Ansage „${k}“ kam in 400 Matches nie vor`);
// Der Stand im Tiebreak ohne Namens-Aufnahme: nur die Zahlen
const tb = new MatchScore({ sets: 1, games: 6, tiebreak: true }); tb.tiebreak = true; tb.points = [3, 2];
if (alsText(standTeile(tb, ['Max', 'Moritz'])) !== 'n3 n2') meckern('Tiebreak ohne Namen: erwartet „n3 n2“, bekommen ' + alsText(standTeile(tb, ['Max', 'Moritz'])));

console.log(`${ANSAGEN.length} Ansagen, ${LINIE.out + LINIE.fault} Rufe der Linienrichter, ${NAMEN.size} Namen, zusammen ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`${punkte} Punkte in 400 Matches angesagt, davon ${ohne} ohne Aufnahme (sehr langer Tiebreak – dann spricht die Stimme des Geräts)`);
console.log(fehler ? `${fehler} Fehler` : '✓ Jede Ansage hat ihre Aufnahmen, jeder Spieler hat seinen Namen');
process.exit(fehler ? 1 : 0);
