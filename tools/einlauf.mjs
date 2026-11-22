// Prüft die Einlaufszene ohne Bildschirm:  node tools/einlauf.mjs  (mit "laut" zeigt es jeden Schlag)
// Geprüft wird: Die Szene läuft durch alle Teile, jeder Ball fliegt über das Netz und springt im Feld auf,
// die Spieler stehen rechtzeitig am Ball, am Ende stehen beide dort, wo das Match beginnt – und der Steckbrief ist vollständig.
import { Einlauf, steckbrief, TEILE, ZAHLEN } from '../js/einlauf.js';
import { COURT as C } from '../js/physics.js';
import { PLAYERS, TOP_PLAYERS } from '../js/data.js';

const laut = process.argv.includes('laut');
let fehler = 0;
const pruef = (ok, text) => { if (!ok) { fehler++; console.log('  ✗ ' + text); } };

// Ein Zufall, der immer gleich ist (damit ein Fehler wiederkommt)
function zufallAus(saat) { let s = saat; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

function lauf(art, paar, saat) {
  const teile = [], schlaege = [];
  let beimSteckbrief = 0;
  let fertig = false, flugVorher = null, knapp = 9, tief = 9;
  const E = new Einlauf({ art, spieler: paar, zufall: zufallAus(saat) }, (name, info, E) => {
    if (name === 'teil') teile.push([info.teil, +E.zeit.toFixed(2)]);
    if (name === 'schlag') {
      // Stand der Spieler richtig, als er traf? (Der Ball soll etwa eine Armlänge neben ihm sein.)
      const p = E.leute[info.side], ab = Math.abs(E.ball.x - p.x);
      schlaege.push(info.kind);
      if (/^steckbrief/.test(E.teil)) beimSteckbrief++;
      if (laut) console.log(`    ${E.zeit.toFixed(2)} s  Seite ${info.side} ${info.kind}  Ball ${E.ball.x.toFixed(2)}  Spieler ${p.x.toFixed(2)}`);
      pruef(ab > 0.35 && ab < 0.95, `Schlag ${schlaege.length}: Ball ${ab.toFixed(2)} m neben dem Spieler (soll etwa 0,62 m sein)`);
    }
    if (name === 'aufprall') pruef(Math.abs(info.x) < C.W / 2 && Math.abs(info.z) < C.L && Math.abs(info.z) > C.SL, `Ball springt nicht hinten im Feld auf (${info.x.toFixed(2)}, ${info.z.toFixed(2)})`);
    if (name === 'fertig') fertig = true;
  });
  let zeit = 0;
  while (E.an && zeit < 90) {
    const zVor = E.ball.z, yVor = E.ball.y, da = E.ball.da && E.flug;
    E.update(1 / 60); zeit += 1 / 60;
    // Fliegt der Ball gerade über das Netz? Dann muss er hoch genug sein.
    if (da && E.flug === flugVorher && Math.sign(zVor) !== Math.sign(E.ball.z)) knapp = Math.min(knapp, Math.min(yVor, E.ball.y) - ZAHLEN.netHeightAt(E.ball.x));
    flugVorher = E.flug;
    for (const p of E.leute) {
      pruef(Math.hypot(p.vx, p.vz) <= ZAHLEN.LAUF_MAX + 0.01, 'Spieler läuft zu schnell');
      pruef(Math.abs(p.x) < 10 && Math.abs(p.z) < 19, 'Spieler steht außerhalb des Platzes');
    }
    if (E.ball.da) tief = Math.min(tief, E.ball.y);
    pruef(E.kamera.von.every(Number.isFinite) && E.kamera.nach.every(Number.isFinite), 'Kamera hat keine gültige Stelle');
  }
  pruef(fertig, 'Szene wird nicht fertig');
  pruef(teile.map((t) => t[0]).join() === TEILE[art].join(), 'Teile fehlen: ' + teile.map((t) => t[0]).join());
  for (const p of E.leute) pruef(p.x === 0 && Math.abs(p.z) === ZAHLEN.HEIM_Z && !p.walk, 'Spieler steht am Ende nicht am Match-Anfang');
  pruef(beimSteckbrief >= 4, `nur ${beimSteckbrief} Schläge, während die Steckbriefe gezeigt werden`);
  if (art === 'an') {
    pruef(schlaege.length - beimSteckbrief === ZAHLEN.BAELLE, `${schlaege.length - beimSteckbrief} Schläge beim Einspielen statt ${ZAHLEN.BAELLE}`);
    pruef(knapp > 0.3 && knapp < 3, `Ball fliegt ${knapp.toFixed(2)} m über dem Netz`);
    pruef(tief > 0, 'Ball unter dem Boden');
  }
  return { zeit, teile, schlaege, knapp };
}

console.log('Einlaufszene');
let summe = 0, n = 0, vh = 0, rh = 0;
for (let i = 0; i < 40; i++) {
  const paar = [PLAYERS[(i * 7) % 60], PLAYERS[(i * 11 + 3) % 200]];
  const r = lauf('an', paar, 1000 + i * 77);
  summe += r.zeit; n++;
  for (const s of r.schlaege) if (s === 'fh') vh++; else rh++;
  if (i === 0) console.log('  Ablauf: ' + r.teile.map((t) => `${t[0]} ab ${t[1]} s`).join(' · ') + ` · Ende nach ${r.zeit.toFixed(1)} s · Ball ${r.knapp.toFixed(2)} m über dem Netz`);
}
console.log(`  40 ganze Szenen: im Schnitt ${(summe / n).toFixed(1)} s, ${vh} Vorhände, ${rh} Rückhände`);
const k = lauf('kurz', [PLAYERS[0], PLAYERS[1]], 5);
console.log(`  nur Steckbrief: ${k.zeit.toFixed(1)} s`);

// Überspringen mitten im Einspielen und Weiter-Tippen durch alle Teile
{
  let fertig = 0;
  const E = new Einlauf({ art: 'an', spieler: [PLAYERS[0], PLAYERS[1]] }, (name) => { if (name === 'fertig') fertig++; });
  for (let i = 0; i < 500; i++) E.update(1 / 60);
  E.ueberspringen(); E.ueberspringen(); E.weiter(); E.update(1 / 60);
  pruef(fertig === 1 && !E.an && E.leute[0].z === ZAHLEN.HEIM_Z, 'Überspringen klappt nicht');
  const F = new Einlauf({ art: 'an', spieler: [PLAYERS[0], PLAYERS[1]] }, (name) => { if (name === 'fertig') fertig++; });
  for (let i = 0; i < 4; i++) { F.update(0.5); F.weiter(); }
  pruef(fertig === 2 && !F.an, 'Weiter-Tippen kommt nicht bis zum Ende');
}

// Steckbrief: Jeder Spieler bekommt eine vollständige Karte
for (const p of PLAYERS) {
  const s = steckbrief(p);
  pruef(s.name && s.land && s.platz >= 1 && s.zeilen.length >= 4 && s.zeilen.every((z) => z[0] && z[1] && !/undefined|NaN/.test(z[1])), 'Steckbrief unvollständig: ' + p.name);
}
for (const p of TOP_PLAYERS) pruef(!p.stil || (p.stil.jahr > 1980 && p.stil.jahr < 2010), 'Jahrgang fehlt: ' + p.name);
const ich = steckbrief({ name: 'Mia Muster', country: 'GER', hand: -1, look: { bh: 1 }, stats: PLAYERS[150].stats }, { platz: 1834, punkte: 12, titel: 0, du: true });
pruef(ich.du && ich.platz === 1834 && ich.zeilen.some((z) => z[1].includes('mit links')), 'Steckbrief für die eigene Figur stimmt nicht');
if (laut) { console.log(steckbrief(PLAYERS[1], { bilanz: [2, 1] })); console.log(ich); }

console.log(fehler ? `\n${fehler} Fehler` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
