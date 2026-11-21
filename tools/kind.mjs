// Wie schwer ist das Spiel für ein Kind? Drei künstliche Spieler treten auf jeder Stufe gegen den Computer an:
//   nix     = macht gar nichts (schlägt nur auf)
//   drueckt = schlägt jeden Ball mit halber Kraft in die Mitte, zielt nie
//   zielt   = schlägt kräftig dorthin, wo der Gegner nicht steht
// So sieht man, ob eigenes Schlagen und Zielen belohnt wird. Aufruf: node tools/kind.mjs [Matches je Zeile] [Spieler-Platz]
// Wunsch: "nix" verliert auf jeder Stufe klar. "drueckt" gewinnt auf Leicht fast immer (dafür ist Leicht da),
// auf Mittel etwa die Hälfte und auf Schwer fast nie. "zielt" ist auf Mittel und Schwer deutlich besser als "drueckt".
// Die Stellschrauben: aiAngriff, meReact, aiSigma in js/data.js und CHANCE_…, HILFS_… oben in js/match.js.
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';

const N = +process.argv[2] || 12, platz = +process.argv[3] || 1;
const ich = PLAYERS[platz - 1];

// Eine künstliche Steuerung: Sie beantwortet dieselben Fragen wie js/controls.js
function steuerung(art, match) {
  return {
    begin() {}, peek() { return null; }, move() { return { x: 0, f: 0 }; }, takeNetz() { return null; },
    takeServe() { return { power: 0.6, aim: 0 }; },
    consume() {
      if (art === 'nix') return null;
      if (art === 'drueckt') return { type: 'drive', aimMode: 'abs', aim: 0, power: 0.45 };
      const gegner = match().P[1];
      return { type: 'drive', aimMode: 'abs', aim: gegner.x >= 0 ? -0.75 : 0.75, power: 0.75 };
    },
  };
}

console.log(`Du bist ${ich.name}. ${N} kurze Matches je Zeile, Gegner aus den Top 20.\n`);
console.log('Stufe   Spieler   Siege   Punkte-Anteil   Ø Schläge   so enden deine Punkte / die des Gegners');
for (const diff of ['leicht', 'mittel', 'schwer']) {
  for (const art of ['nix', 'drueckt', 'zielt']) {
    let siege = 0, pts = [0, 0], rally = 0, n = 0; const wie = [{}, {}];
    for (let k = 0; k < N; k++) {
      let m;
      const gegner = PLAYERS[1 + (k * 3) % 19];
      m = new Match({ players: [ich, gegner === ich ? PLAYERS[19] : gegner], human: 0, surface: 'hard', difficulty: diff, sets: 1, games: 3, mode: 'match', assist: 'voll', controlMode: 'klassik', changeover: false },
        new Proxy({}, { get: (_, key) => (x) => { if (key === 'point') { rally += x.rally; n++; wie[x.winner][x.reason] = (wie[x.winner][x.reason] || 0) + 1; } } }),
        steuerung(art, () => m));
      let t = 0; while (m.state !== 'over' && m.score.winner === null && t++ < 600000) m.update(1 / 60);
      if (m.score.winner === 0) siege++;
      for (const i of [0, 1]) pts[i] += m.score.stats[i].points;
    }
    const kurz = (o) => Object.entries(o).map(([k, v]) => k + ' ' + v).join(', ');
    console.log(diff.padEnd(7), art.padEnd(8), `${siege}/${N}`.padStart(6), `${Math.round(100 * pts[0] / (pts[0] + pts[1]))} %`.padStart(12), (rally / n).toFixed(1).padStart(13), '    ', kurz(wie[0]), ' / ', kurz(wie[1]));
  }
}
