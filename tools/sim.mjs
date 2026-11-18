// Testlauf ohne Grafik: Computer gegen Computer
import { Match } from '../js/match.js';
import { PLAYERS } from '../js/data.js';

function play(a, b, diff, surface) {
  const stat = { reasons: {}, rallies: 0, points: 0, serveSpeed: 0, serves: 0, maxRally: 0 };
  const fx = new Proxy({}, { get: (_, k) => (x) => {
    if (k === 'point') { stat.reasons[x.reason] = (stat.reasons[x.reason] || 0) + 1; stat.points++; stat.rallies += x.rally; stat.maxRally = Math.max(stat.maxRally, x.rally); }
    if (k === 'hit' && x.type === 'serve') { stat.serveSpeed += x.speed * 3.6; stat.serves++; }
    if (k === 'fault') stat.reasons.fehler1 = (stat.reasons.fehler1 || 0) + 1;
  } });
  const m = new Match({ players: [a, b], human: null, surface, difficulty: diff, sets: 2, games: 6, mode: 'match' }, fx);
  let t = 0;
  while (m.state !== 'over' && t < 3600 * 6) { m.update(1 / 60); t += 1 / 60; }
  return { m, stat, t };
}

const [ia, ib, diff = 'profi', surface = 'hard', n = 3] = process.argv.slice(2);
const a = PLAYERS[+ia || 0], b = PLAYERS[+ib || 1];
let wins = [0, 0];
for (let i = 0; i < +n; i++) {
  const { m, stat, t } = play(a, b, diff, surface);
  if (m.state !== 'over') { console.log('HÄNGT! state', m.state, m.score.scoreLine()); continue; }
  wins[m.score.winner]++;
  console.log(`${a.short} - ${b.short}: ${m.score.scoreLine()} | ${Math.round(t / 60)} min | Punkte ${stat.points}, Ø Ballwechsel ${(stat.rallies / stat.points).toFixed(1)} (max ${stat.maxRally}), Ø Aufschlag ${Math.round(stat.serveSpeed / stat.serves)} km/h`);
  console.log('   ', 'gelaufen', m.P.map((q) => Math.round(q.gelaufen) + ' m, müde ' + q.muede.toFixed(2)).join(' | '), JSON.stringify(stat.reasons), 'Asse', m.score.stats.map(s => s.aces), '1.Aufschlag', m.score.stats.map(s => Math.round(100 * s.firstIn / Math.max(1, s.firstTotal)) + '%'));
}
console.log('Siege:', wins);
