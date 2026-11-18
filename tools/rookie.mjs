// Wie schlägt sich ein Neuling (alle Werte 54) als Computer gegen die Stufen? Nur zur groben Einordnung.
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';
const rookie = { name: 'Neuling', short: 'Neuling', stats: { s: 54, vh: 54, rh: 54, v: 54, b: 54, a: 54, m: 54, k: 54 }, hand: 1 };
for (const diff of ['leicht', 'mittel', 'schwer']) {
  let pts = [0, 0], aces = [0, 0], rally = 0, n = 0;
  for (let k = 0; k < 4; k++) {
    const m = new Match({ players: [PLAYERS[k * 5], rookie], human: null, surface: 'hard', difficulty: diff, sets: 1, games: 4, mode: 'match' });
    // Seite 1 (Neuling) ohne Abzug rechnen, wie ein Mensch
    const q = (v) => Math.max(0.03, Math.min(1, (v - 40) / 60));
    Object.assign(m.P[1], { s: q(54), vhP: q(54), vhC: q(54), rhP: q(54), rhC: q(54), t: q(54), v: q(54), aus: q(54), men: q(54), tak: q(54), topSpeed: 4.1 + 2.6 * q(54), maxSpeed: 4.1 + 2.6 * q(54), accel: 11 + 8 * q(54) });
    const fx = m.fx; m.fx = new Proxy({}, { get: (_, key) => (x) => { if (key === 'point') { rally += x.rally; n++; } } });
    let t = 0; while (m.state !== 'over' && t++ < 400000) m.update(1 / 60);
    for (const i of [0, 1]) { pts[i] += m.score.stats[i].points; aces[i] += m.score.stats[i].aces; }
  }
  console.log(diff.padEnd(7), 'Punkte Profi:Neuling', pts.join(':'), 'Asse', aces.join(':'), 'Ø Ballwechsel', (rally / n).toFixed(1));
}
