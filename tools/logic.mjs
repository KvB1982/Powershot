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

// ---------------- Saison mit einem Profi (ATP Race) ----------------
const SE = await import('../js/season.js');
const AN = await import('../js/saisonansicht.js');
for (const pid of ['zverev', 'struff', 'zheng']) {
  const s = SE.newSeason(pid);
  console.log(`\nSaison mit ${SE.seasonPlayer(s).name} (Weltrangliste ${SE.seasonPlayer(s).rank})`);
  let html = 0;
  while (!s.over) {
    const def = SE.nextTournament(s);
    const T = SE.startTournament(s, def.id === 'mc');          // Monte-Carlo lassen wir zum Test aus
    let guard = 0;
    while (!T.done && guard++ < 20) {
      html += AN.bracketHtml(T, def).length;
      const m = TN.humanMatch(T);
      if (!m) { TN.simulateRest(T); break; }
      const opp = m.a === pid ? m.b : m.a;
      const win = Math.random() < 0.6;
      TN.playRound(T, { winner: win ? pid : opp, score: win ? '6:3 6:4' : '2:6 3:6', setDiff: 2 });
    }
    html += AN.bracketHtml(T, def).length + AN.timelineHtml(s).length + AN.raceHtml(s, true).length + AN.raceHtml(s).length;
    const dabei = !!T.humanId;
    const r = SE.finishTournament(s);
    console.log(`${def.name.padEnd(20)} ${String(dabei ? r.label : 'nicht dabei').padEnd(11)} +${String(r.points).padStart(4)} P  Race-Platz ${String(r.rank).padStart(3)}  Sieger: ${r.champion}${r.finalsQualified != null ? '  [Finals: ' + (r.finalsQualified ? 'qualifiziert' : 'nicht dabei') + ']' : ''}`);
  }
  const feld = SE.finalsField(s);
  console.log('Race Top 8:', SE.raceTable(s).slice(0, 8).map((p) => `${p.short} ${p.points}`).join(' | '));
  console.log('Titel', s.titles, '· HTML gebaut:', html, 'Zeichen', '· Punkte-Seite:', AN.pointsHtml().length);
  // Prüfen: Summe im Race = Summe der Einzelergebnisse; nur Finals-Teilnehmer haben Finals-Punkte
  const mine = s.history.reduce((a, h) => a + h.points, 0);
  if (mine !== SE.myRace(s).points) throw new Error('Race-Punkte stimmen nicht mit den Ergebnissen überein');
  if (Object.keys(s.race).filter((id) => s.race[id].fin != null).length !== 8) throw new Error('Bei den Finals müssen genau 8 Spieler stehen');
  if (feld.length !== 8) throw new Error('Finals-Feld muss 8 Spieler haben');
}
// Sonderregel: Grand-Slam-Sieger auf Platz 8–20 bekommt den 8. Startplatz
{
  const s = SE.newSeason('zverev');
  D.PLAYERS.slice(0, 12).forEach((p, i) => { s.race[p.id] = { x: 5000 - i * 100 }; });
  const zwoelfter = D.PLAYERS[11].id;
  s.slams.wim = zwoelfter;
  const feld = SE.finalsField(s).map((p) => p.id);
  if (feld.length !== 8 || feld[7] !== zwoelfter || feld.includes(D.PLAYERS[7].id)) throw new Error('Grand-Slam-Regel falsch');
  console.log('\nGrand-Slam-Regel: ok (Platz 12 mit Grand-Slam-Sieg bekommt den 8. Startplatz)');
}
