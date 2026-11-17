// Prüft den Seitenwechsel: Computer gegen Computer, ohne Grafik.
// Regel: Zur Bank geht es nur direkt nach einem Punkt, der ein Spiel beendet hat,
// und nur wenn die Zahl der Spiele im Satz ungerade ist (nach dem 1., 3., 5. … Spiel).
// Niemals nach einem Aufschlagfehler mitten im Spiel!
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';

const [surface = 'hard', n = 5] = process.argv.slice(2);
let wechsel = 0, falsch = 0, fehlend = 0, fehler1 = 0;

for (let i = 0; i < +n; i++) {
  let m;
  const fx = new Proxy({}, { get: (_, k) => () => { if (k === 'fault') fehler1++; } });
  m = new Match({ players: [PLAYERS[0], PLAYERS[1]], human: null, surface, difficulty: 'mittel', sets: 2, games: 6, mode: 'match' }, fx);
  let t = 0, vorher = m.state, spiele = 0;
  while (m.state !== 'over' && t < 3600 * 6) {
    m.update(1 / 60); t += 1 / 60;
    if (m.state === vorher) continue;
    const sc = m.score;
    // alle Spiele des Matches zusammengezählt: steigt die Zahl, war gerade ein Spiel zu Ende
    const jetzt = sc.sets.reduce((s, x) => s + x[0] + x[1], 0) + sc.games[0] + sc.games[1];
    if (m.state === 'changeover') {
      wechsel++;
      const spielZuEnde = vorher === 'pointOver' && jetzt > spiele;
      if (!spielZuEnde) {
        falsch++;
        console.log(`FALSCH: Seitenwechsel nach "${vorher}" bei ${sc.scoreLine()} (Aufschlag Nr. ${sc.serveNo})`);
      }
    } else if (vorher === 'pointOver' && jetzt > spiele && m.state !== 'over') {
      // Spiel zu Ende, aber kein Seitenwechsel: das darf nur bei gerader Spielzahl im Satz sein
      const satz = sc.games[0] + sc.games[1] === 0 && sc.sets.length ? sc.sets[sc.sets.length - 1] : sc.games;
      if ((satz[0] + satz[1]) % 2 === 1) { fehlend++; console.log(`FEHLT: kein Seitenwechsel bei ${sc.scoreLine()}`); }
    }
    if (vorher === 'pointOver') spiele = jetzt;
    vorher = m.state;
  }
  if (m.state !== 'over') { console.log('HÄNGT! state', m.state); falsch++; }
}

console.log(`${n} Matches auf ${surface}: ${wechsel} Seitenwechsel, ${fehler1} Fehler beim ersten Aufschlag`);
console.log(`falsche Seitenwechsel: ${falsch}, fehlende: ${fehlend}`);
if (falsch || fehlend) { console.log('NICHT IN ORDNUNG'); process.exit(1); }
console.log('Alles in Ordnung.');
