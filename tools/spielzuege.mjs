// Prüft die taktischen Spielzüge (js/spielzuege.js) ohne Grafik:
//   1. Erkennt der Zähler richtig gespielte Spielzüge – und lehnt falsche ab?
//   2. Durchschaut der Gegner einen Spielzug, der zu oft kommt?
//   3. Bringt es im Match wirklich etwas? Computer gegen Computer, einmal mit und einmal ohne Spielzüge.
// Aufruf:  node tools/spielzuege.mjs [Anzahl Matches, Standard 30]
import { ZUEGE, ZUG_IDS, ZugZaehler, pruefe, zielfeld, zielPunkt, stufe, offen, gelernte, eintragen, lieblingsZuege } from '../js/spielzuege.js';
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';
import { achtWerte } from '../js/faehigkeiten.js';

let fehler = 0;
const ok = (wahr, text) => { if (!wahr) { fehler++; console.log('  FEHLER:', text); } };

// Ein Schlag aus Sicht des Schlägers. Was nicht angegeben ist, bekommt harmlose Werte.
const S = (o) => ({ aufschlag: false, ret: false, typ: 'drive', hand: 'fh', haendig: 1, vonU: 0, landU: 0, landD: 10, drin: true, gegnerU: 0, gegnerD: 12, feld: 1, ...o });
const alle = Object.fromEntries(ZUG_IDS.map((id) => [id, 1]));
// Spielt eine Reihe von Schlägen und sagt, welcher Spielzug am Ende fertig wurde
function spiele(schlaege, erlaubt = alle) {
  const z = new ZugZaehler({ erlaubt });
  let letzter = null;
  for (const s of schlaege) letzter = z.schlag(S(s));
  return letzter.fertig ? letzter.fertig.id : null;
}

console.log('1. Erkennen');
// Zu jedem Spielzug eine richtige Folge von Schlägen
const RICHTIG = {
  aufschlag_plus1: [{ aufschlag: true, landU: 3.5, landD: 5.5 }, { vonU: 1, gegnerU: 3, landU: -3, landD: 9 }],
  t_ecke: [{ aufschlag: true, landU: 0.6, landD: 5.8 }, { landU: -3.2, landD: 10 }],
  aufschlag_volley: [{ aufschlag: true, landU: 2, landD: 5 }, { typ: 'volley', gegnerU: -2.5, landU: 2.8, landD: 8 }],
  return_mitte: [{ ret: true, landU: 0.4, landD: 10.5 }, { landU: 3, landD: 9 }],
  chip_charge: [{ ret: true, typ: 'slice', landU: 1, landD: 9.5 }, { typ: 'volley', landU: -2, landD: 7 }],
  cross_cross_line: [{ vonU: 2, landU: -3, landD: 9 }, { vonU: -2.5, landU: 2.5, landD: 9 }, { vonU: 2, landU: 3, landD: 10 }],
  scheibenwischer: [{ landU: 3, landD: 9 }, { landU: -3, landD: 9 }, { landU: 3, landD: 9 }],
  kurz_cross: [{ vonU: 2, landU: -2.5, landD: 10 }, { vonU: 2.5, landU: -3.3, landD: 5.5 }],
  gegen_lauf: [{ landU: 3, landD: 9 }, { landU: -3, landD: 9 }, { gegnerU: 0.5, landU: -3.2, landD: 9 }],
  inside_out: [{ hand: 'fh', vonU: -1.5, landU: 3, landD: 9 }, { vonU: 0.5, gegnerU: 3, landU: -3, landD: 9 }],
  angriff_volley: [{ vonU: 2, landU: 3, landD: 10.5 }, { typ: 'volley', gegnerU: 3, landU: -2.5, landD: 7 }],
  stopp_lob: [{ typ: 'drop', landU: 1, landD: 2.5 }, { typ: 'lob', gegnerD: 3, landU: 0, landD: 10 }],
  stopp_pass: [{ typ: 'drop', landU: 1, landD: 2.5 }, { typ: 'flach', gegnerU: 1, gegnerD: 3, landU: -3, landD: 9 }],
};
for (const id of ZUG_IDS) {
  ok(RICHTIG[id], `für ${id} fehlt die Probe`);
  if (!RICHTIG[id]) continue;
  ok(spiele(RICHTIG[id], { [id]: 1 }) === id, `${id} wird nicht erkannt`);
  // Mitten im Ballwechsel (nach einem anderen Schlag davor) müssen Ballwechsel-Spielzüge auch gehen
  if (ZUEGE[id].start === 'ballwechsel') ok(spiele([{ landU: 0, landD: 8, vonU: 0 }, ...RICHTIG[id]], { [id]: 1 }) === id, `${id} wird mitten im Ballwechsel nicht erkannt`);
  // Geht der letzte Schlag ins Aus, zählt es nicht
  const aus = RICHTIG[id].map((s, i, a) => (i === a.length - 1 ? { ...s, drin: false } : s));
  ok(spiele(aus, { [id]: 1 }) === null, `${id} zählt, obwohl der letzte Ball im Aus war`);
  // Ein Spielzug, den man nicht gelernt hat, zählt nicht
  ok(spiele(RICHTIG[id], {}) === null, `${id} zählt, obwohl er nicht gelernt ist`);
  // Das Zielfeld jedes Schritts liegt im Feld, und der Zielpunkt des Computers liegt im Zielfeld
  ZUEGE[id].schritte.forEach((st, i) => {
    const lage = { vonU: 2, gegnerU: 2, gegnerD: 3, feld: 1 };
    const f = zielfeld(st, lage, 1), p = zielPunkt(st, lage, 1);
    ok(f.u0 < f.u1 && f.d0 < f.d1 && f.u0 >= -4.2 && f.u1 <= 4.2 && f.d1 <= 11.9, `${id} Schritt ${i + 1}: Zielfeld seltsam ${JSON.stringify(f)}`);
    ok(p.u >= f.u0 && p.u <= f.u1 && (st.wer === 'aufschlag' || (p.d >= f.d0 && p.d <= f.d1)), `${id} Schritt ${i + 1}: Zielpunkt liegt nicht im Zielfeld`);
  });
}
// Falsche Folgen
ok(spiele([{ aufschlag: true, landU: 0.5, landD: 5 }, { gegnerU: 3, landU: -3 }], { aufschlag_plus1: 1 }) === null, 'Aufschlag + 1 zählt mit T-Aufschlag');
ok(spiele([{ aufschlag: true, landU: 3.5, landD: 5 }, { gegnerU: 3, landU: 2.5 }], { aufschlag_plus1: 1 }) === null, 'Aufschlag + 1 zählt, obwohl der Ball zum Gegner ging');
ok(spiele([{ vonU: 2, landU: -3 }, { vonU: -2, landU: -3 }, { vonU: 2, landU: 3 }], { cross_cross_line: 1 }) === null, 'cross-cross-Linie zählt mit einem Longline in der Mitte');
ok(spiele([{ typ: 'drop', landD: 2.5 }, { typ: 'lob', gegnerD: 11, landD: 10 }], { stopp_lob: 1 }) === null, 'Stoppball + Lob zählt, obwohl der Gegner hinten steht');
ok(spiele([{ aufschlag: true, landU: 2 }, { typ: 'drive', gegnerU: -2.5, landU: 2.8 }], { aufschlag_volley: 1 }) === null, 'Aufschlag + Volley zählt ohne Volley');
ok(pruefe(ZUEGE.stopp_lob.schritte[0], S({ typ: 'drive', landD: 2.5 })) !== null, 'Stoppball-Schritt nimmt einen normalen Schlag an');
// Linkshänder: Die Rückhand-Ecke ist rechts
ok(spiele([{ hand: 'fh', haendig: -1, vonU: 1.5, landU: -3 }, { gegnerU: -3, landU: 3 }], { inside_out: 1 }) === 'inside_out', 'Inside-out für Linkshänder wird nicht erkannt');

console.log('2. Durchschauen');
{
  const z = new ZugZaehler({ erlaubt: { aufschlag_plus1: 1 }, klug: 0.5 });
  const druck = [];
  for (let i = 0; i < 5; i++) { z.neuerPunkt(); let r; for (const s of RICHTIG.aufschlag_plus1) r = z.schlag(S(s)); druck.push(+r.druck.toFixed(2)); }
  console.log('  fünfmal derselbe Spielzug, Druck auf den Gegner:', druck.join('  '));
  ok(druck[0] > druck[1] && druck[1] > druck[2], 'der Druck wird bei Wiederholung nicht kleiner');
  ok(druck[4] < 0, 'nach fünfmal ist der Spielzug nicht durchschaut');
  // Abwechslung hilft: Nach anderen Spielzügen wirkt er wieder
  const z2 = new ZugZaehler({ erlaubt: alle, klug: 0.5 });
  const folge = ['aufschlag_plus1', 't_ecke', 'scheibenwischer', 'aufschlag_plus1'];
  let r;
  for (const id of folge) { z2.neuerPunkt(); for (const s of RICHTIG[id]) r = z2.schlag(S(s)); }
  ok(r.fertig && r.fertig.wirkung >= 0.6, 'mit Abwechslung wirkt der Spielzug nicht mehr gut');
}

console.log('3. Lernen und Freischalten');
{
  const stand = {};
  ok(stufe(stand, 'aufschlag_plus1') === 0 && offen(stand, 'aufschlag_plus1') && !offen(stand, 'stopp_lob'), 'Anfangsstand stimmt nicht');
  eintragen(stand, 'aufschlag_plus1', 't'); eintragen(stand, 'aufschlag_plus1', 't');
  ok(eintragen(stand, 'aufschlag_plus1', 't') === true && stufe(stand, 'aufschlag_plus1') === 1, 'dreimal im Training = gelernt klappt nicht');
  ok(offen(stand, 't_ecke') && Object.keys(gelernte(stand)).length === 1, 'nach dem ersten gelernten Spielzug öffnet sich kein neuer');
  for (let i = 0; i < 8; i++) eintragen(stand, 'aufschlag_plus1', 'm');
  ok(stufe(stand, 'aufschlag_plus1') === 2, 'achtmal im Match = Stufe 2 klappt nicht');
  const beispiel = [0, 5, 60, 150].map((n) => `${PLAYERS[n].short}: ${lieblingsZuege(achtWerte(PLAYERS[n].stats)).map((id) => ZUEGE[id].name).join(', ')}`);
  console.log('  Lieblings-Spielzüge (aus den Fähigkeiten berechnet):\n   ', beispiel.join('\n    '));
}

console.log('4. Im Match (Computer gegen Computer, zwei gleich starke Spieler)');
function matches(n, spielzuege) {
  const a = PLAYERS[10], b = { ...PLAYERS[10], id: 'zwilling', short: 'Zwilling' };
  let punkte = [0, 0], siege = [0, 0], fertig = [0, 0], haengt = 0;
  for (let i = 0; i < n; i++) {
    const fx = new Proxy({}, { get: (_, k) => (x) => { if (k === 'spielzug') fertig[x.side]++; } });
    const m = new Match({ players: [a, b], human: null, surface: 'hard', difficulty: 'profi', sets: 2, games: 6, mode: 'match', spielzuege }, fx);
    let t = 0;
    while (m.state !== 'over' && t < 3600 * 6) { m.update(1 / 60); t += 1 / 60; }
    if (m.state !== 'over') { haengt++; continue; }
    siege[m.score.winner]++;
    punkte[0] += m.score.stats[0].points; punkte[1] += m.score.stats[1].points;
  }
  return { punkte, siege, fertig, haengt };
}
const n = +process.argv[2] || 30;
const ohne = matches(n, null);
const mit = matches(n, { an: true, seiten: [true, false] });
const beide = matches(Math.ceil(n / 3), { an: true });
const anteil = (r) => (100 * r.punkte[0] / (r.punkte[0] + r.punkte[1])).toFixed(1) + ' %';
console.log(`  ohne Spielzüge:            Seite 0 gewinnt ${anteil(ohne)} der Punkte, Matches ${ohne.siege.join(':')}`);
console.log(`  nur Seite 0 mit Spielzügen: Seite 0 gewinnt ${anteil(mit)} der Punkte, Matches ${mit.siege.join(':')}, fertige Spielzüge ${mit.fertig[0]} (${(mit.fertig[0] / n).toFixed(1)} pro Match)`);
console.log(`  beide mit Spielzügen:       Seite 0 gewinnt ${anteil(beide)} der Punkte, fertige Spielzüge ${beide.fertig.join(' und ')}`);
ok(!ohne.haengt && !mit.haengt && !beide.haengt, 'ein Match ist hängen geblieben');
ok(mit.fertig[0] > 0, 'der Computer hat keinen einzigen Spielzug geschafft');
if (mit.punkte[0] / (mit.punkte[0] + mit.punkte[1]) <= ohne.punkte[0] / (ohne.punkte[0] + ohne.punkte[1])) console.log('  Hinweis: Diesmal haben die Spielzüge nichts gebracht. Bei wenigen Matches kann das Zufall sein – mit mehr Matches noch einmal probieren.');
// Mit allen Spielzügen (wie ein Mensch, der alles gelernt hat und abwechselt) ist der Vorteil größer
const alleZuege = matches(n, { an: true, seiten: [true, false], lieblinge: ZUG_IDS.filter((id) => !ZUEGE[id].nurMensch) });
console.log(`  Seite 0 mit ALLEN Spielzügen: Seite 0 gewinnt ${anteil(alleZuege)} der Punkte, Matches ${alleZuege.siege.join(':')}`);

console.log(fehler ? `\n${fehler} Fehler` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
