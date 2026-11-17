// Prüft die Hinweise auf wichtige Punkte: Breakball, Satzball, Matchball, Championship Point.
// Teil 1: feste Spielstände mit bekannter Antwort. Teil 2: viele Zufalls-Matches – nach jedem Hinweis
// muss wirklich das passieren, was er verspricht, und kein Spiel darf ohne Hinweis verloren gehen.
import { MatchScore } from '../js/rules.js';

const N = ['Unten', 'Oben'];
let fehler = 0;
function pruefe(name, sc, soll, finale = false) {
  const ist = sc.wichtigText(N, finale);
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? 'ok    ' : 'FALSCH'} ${name.padEnd(46)} → "${ist}"${ok ? '' : `  (erwartet: "${soll}")`}`);
}
// Spielstand bauen: Sätze, Spiele, Punkte, Aufschläger
function stand({ sets = [], games = [0, 0], points = [0, 0], server = 0, tiebreak = false, gewinn = 2 }) {
  const sc = new MatchScore({ sets: gewinn, games: 6, firstServer: server });
  sc.sets = sets; sc.games = games; sc.points = points; sc.tiebreak = tiebreak;
  sc.setsWon = [sets.filter((s) => s[0] > s[1]).length, sets.filter((s) => s[1] > s[0]).length];
  return sc;
}

pruefe('0:0, 30:30', stand({ points: [2, 2] }), '');
pruefe('40:30 für den Aufschläger (nur Spielball)', stand({ points: [3, 2] }), '');
pruefe('30:40, Unten schlägt auf', stand({ points: [2, 3] }), 'Breakball Oben');
pruefe('0:40, Unten schlägt auf', stand({ points: [0, 3] }), '3 Breakbälle Oben');
pruefe('15:40, Oben schlägt auf (Punkte Unten 3)', stand({ points: [3, 1], server: 1 }), '2 Breakbälle Unten');
pruefe('Einstand', stand({ points: [4, 4] }), '');
pruefe('Vorteil Rückschläger', stand({ points: [4, 5] }), 'Breakball Oben');
pruefe('Vorteil Aufschläger', stand({ points: [5, 4] }), '');
pruefe('5:3, 40:15 Aufschläger', stand({ games: [5, 3], points: [3, 1] }), '2 Satzbälle Unten');
pruefe('3:5, 30:40 (Satzball statt Breakball)', stand({ games: [3, 5], points: [2, 3] }), 'Satzball Oben');
pruefe('5:5, 40:0 (noch kein Satzball)', stand({ games: [5, 5], points: [3, 0] }), '');
pruefe('Tiebreak 6:4', stand({ games: [6, 6], points: [6, 4], tiebreak: true }), '2 Satzbälle Unten');
pruefe('Tiebreak 6:6', stand({ games: [6, 6], points: [6, 6], tiebreak: true }), '');
pruefe('Tiebreak 3:5 (kein Breakball im Tiebreak)', stand({ games: [6, 6], points: [3, 5], tiebreak: true }), '');
pruefe('1 Satz vorn, 5:4, 40:30', stand({ sets: [[6, 4]], games: [5, 4], points: [3, 2] }), 'Matchball Unten');
pruefe('1 Satz vorn, 5:2, 0:40 Aufschlag Oben', stand({ sets: [[6, 4]], games: [5, 2], points: [3, 0], server: 1 }), '3 Matchbälle Unten');
pruefe('Finale: Championship Point', stand({ sets: [[4, 6]], games: [4, 5], points: [2, 3] }), 'Championship Point Oben', true);
pruefe('Finale: 2 Championship Points', stand({ sets: [[6, 4]], games: [5, 4], points: [3, 1] }), '2 Championship Points Unten', true);
pruefe('Finale, aber nur Breakball', stand({ points: [2, 3] }), 'Breakball Oben', true);
pruefe('Ein Gewinnsatz: 5:4, 40:30', stand({ games: [5, 4], points: [3, 2], gewinn: 1 }), 'Matchball Unten');

// Teil 2: Zufalls-Matches
let hinweise = { break: 0, satz: 0, match: 0 }, matches = 300;
for (let i = 0; i < matches; i++) {
  const sc = new MatchScore({ sets: 2, games: 6, firstServer: i % 2 });
  while (sc.winner === null) {
    const p = sc.wichtigerPunkt(), server = sc.server, tb = sc.tiebreak;
    const w = Math.random() < 0.5 ? 0 : 1;
    const ev = sc.pointTo(w);
    if (p) hinweise[p.art]++;
    // Hat der mit dem Hinweis gewonnen, muss das Versprochene eingetreten sein
    const soll = p && p.wer === w ? { break: 'game', satz: 'set', match: 'match' }[p.art] : null;
    if (soll && !ev.includes(soll)) { fehler++; console.log('FALSCH: Hinweis', p, 'aber passiert ist', ev); }
    // Ohne Hinweis darf weder ein Match noch ein Satz noch ein Break passieren
    const erwartet = ev.includes('match') ? 'match' : ev.includes('set') ? 'satz' : ev.includes('game') && w !== server && !tb ? 'break' : null;
    if (erwartet && (!p || p.art !== erwartet || p.wer !== w)) { fehler++; console.log('FEHLT: es passierte', erwartet, 'für', w, '– Hinweis war', p); }
  }
}
console.log(`${matches} Zufalls-Matches: ${hinweise.break} Breakbälle, ${hinweise.satz} Satzbälle, ${hinweise.match} Matchbälle angesagt`);
if (fehler) { console.log(fehler + ' Fehler – NICHT IN ORDNUNG'); process.exit(1); }
console.log('Alles in Ordnung.');
