// Testet Turnier- und Karriere-Logik ohne Browser
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const D = await import('../js/data.js');
const TN = await import('../js/tournament.js');
const CA = await import('../js/career.js');
const names = new Set(D.PLAYERS.map(p => p.name)); console.log('Spieler', D.PLAYERS.length, 'eindeutige Namen', names.size);
const c = CA.newCareer({ name: 'Max Test', look: {} });
console.log('Start: Platz', CA.myRank(c), 'Top3', CA.ranking(c).slice(0, 3).map(p => p.name + ' ' + p.points));
for (let season = 0; season < 2; season++) for (let w = 0; w < 14; w++) {
  const def = CA.nextTournament(c);
  const T = CA.startTournament(c);
  let guard = 0;
  while (!T.done && guard++ < 20) {
    const m = TN.humanMatch(T);
    if (!m) { TN.simulateRest(T); break; }
    const opp = m.a === 'me' ? m.b : m.a;
    const win = Math.random() < 0.6;
    TN.playRound(T, { winner: win ? 'me' : opp, score: win ? '6:3 6:4' : '2:6 3:6', setDiff: 2 });
  }
  const s = CA.finishTournament(c);
  console.log(`${def.name.padEnd(20)} ${String(s.label).padEnd(5)} +${String(s.points).padStart(4)} P  Platz ${String(s.rank).padStart(3)}  Sieger: ${s.champion}${s.seasonOver ? '  [Saisonende]' : ''}`);
}
console.log('Geld', c.money, 'Titel', c.titles, 'Top5', CA.ranking(c).slice(0, 5).map(p => p.name + ' ' + p.points).join(' | '));
CA.addXp(c, 500); console.log('Level', c.level, 'Punkte', c.skillPoints, 'kaufen', CA.buy(c, 'r1'), CA.effectiveStats(c));
