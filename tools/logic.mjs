// Testet Turnier- und Karriere-Logik ohne Browser
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const D = await import('../js/data.js');
const TN = await import('../js/tournament.js');
const CA = await import('../js/career.js');
const names = new Set(D.PLAYERS.map(p => p.name)); console.log('Spieler', D.PLAYERS.length, 'eindeutige Namen', names.size);
const AU = await import('../js/ausruestung.js');
const KT = await import('../js/kleinetour.js');
console.log('Shop:', AU.SHOP.length, 'Teile ·', AU.SHOP.filter((s) => s.cat === 'Schläger').length, 'Schläger · kleine Turniere:', KT.KLEINE_TURNIERE.length, '· Nachwuchsspieler:', KT.NACHWUCHS.length);
if (new Set(AU.SHOP.map((s) => s.id)).size !== AU.SHOP.length) throw new Error('Shop: doppelte id');
for (const t of D.TOURNAMENTS) if (KT.KLEINE_TURNIERE.filter((k) => k.slot === t.id).length !== 4) throw new Error('Zu ' + t.id + ' fehlen kleine Turniere');
for (const r of AU.SHOP.filter((s) => s.cat === 'Schläger')) if (Object.values(r.bonus).reduce((a, b) => a + b, 0) !== 4) throw new Error(r.name + ': Pluspunkte müssen zusammen 4 sein');

// ---------------- Karriere: von ganz unten nach oben ----------------
// Ein Test-Spieler, der so spielt: immer das größte Turnier, bei dem er mitspielen darf und das er bezahlen kann.
// siegChance = wie oft er ein Match gewinnt. Reicht das Geld nicht, spielt er Liga.
function karriere(siegChance, saisons, laut) {
  const c = CA.newCareer({ name: 'Max Test', look: {} });
  if (CA.myRank(c) !== 2000) throw new Error('Start muss Platz 2000 sein');
  let liga = 0, minGeld = c.money;
  for (let n = 0; n < saisons * 14; n++) {
    const platz = CA.myRank(c);
    // Ausrüstung und Team wie ein vernünftiger Spieler
    if (!c.equipped['Schläger'] && c.money > 1500) CA.buy(c, 'r_12');
    if (!c.equipped['Saiten'] && c.money > 1500) CA.buy(c, 's_2');
    if (!c.vertrag.schlaeger && CA.vertragsStufe(c) >= 0) CA.setVertrag(c, 'schlaeger', 'Babolat');
    if (c.money > 30000 && c.trainer === 't0') CA.setTeam(c, 't2');
    if (c.money > 30000 && c.physio === 'p0') CA.setTeam(c, 'p2');
    const wahl = CA.angebot(c).filter((a) => a.zugang.ok && !a.fehlt).pop();
    let T;
    if (c.frische < 40) { const s = CA.wocheOhneTurnier(c, 'pause'); if (laut) console.log(`  Pause                              Platz ${s.rank}  Geld ${c.money}`); continue; }
    if (wahl) T = CA.startTournament(c, wahl.def.id); else { T = CA.ligaSpiel(c); liga++; }
    if (!T) throw new Error('Turnier ließ sich nicht starten');
    let guard = 0;
    while (!T.done && guard++ < 20) {
      const m = TN.humanMatch(T);
      if (!m) { TN.simulateRest(T); break; }
      const opp = m.a === 'me' ? m.b : m.a;
      const win = Math.random() < siegChance;
      TN.playRound(T, { winner: win ? 'me' : opp, score: win ? '6:3 6:4' : '2:6 3:6', setDiff: 2 });
      CA.matchGespielt(c, win, T.rounds.length);
    }
    const s = CA.finishTournament(c);
    minGeld = Math.min(minGeld, c.money);
    if (c.money < 0) throw new Error('Geld darf nie unter 0 fallen');
    const r = s.rechnung;
    if (s.netto !== s.money + r.sponsor - r.flug - r.hotel - r.essen - r.team - r.bespannen - r.leihe) throw new Error('Abrechnung falsch');
    if (laut) console.log(`  ${s.name.padEnd(34)} ${String(s.label).padEnd(4)} +${String(s.points).padStart(4)} P  Platz ${String(s.rank).padStart(4)}  netto ${String(s.netto).padStart(8)} $  Geld ${String(c.money).padStart(9)} $  Frische ${c.frische}${s.neueSponsoren.length ? '  NEU: ' + s.neueSponsoren.map((g) => g.name).join(', ') : ''}`);
    void platz;
  }
  return { c, liga, minGeld };
}
console.log('\nKarriere mit 65 % gewonnenen Matches, 3 Saisons:');
const { c } = karriere(0.65, 3, true);
console.log('Geld', c.money, 'Titel', c.titles, 'Platz', CA.myRank(c), 'Sponsoren', c.sponsoren.join(','), 'Fans', CA.fans(c));
for (const chance of [0.35, 0.5, 0.65, 0.8]) {
  const erg = [];
  for (let i = 0; i < 20; i++) { const k = karriere(chance, 3); erg.push([CA.myRank(k.c), k.c.money, k.liga, k.minGeld]); }
  const mittel = (j) => Math.round(erg.reduce((a, e) => a + e[j], 0) / erg.length);
  console.log(`Siegchance ${chance}: nach 3 Saisons im Schnitt Platz ${mittel(0)}, Geld ${mittel(1)} $, Liga-Wochen ${mittel(2)}, kleinster Kontostand ${Math.min(...erg.map((e) => e[3]))} $`);
}
CA.addXp(c, 500); console.log('Level', c.level, 'Punkte', c.skillPoints, CA.effectiveStats(c), CA.bonusListe(c).map((b) => b.name).join(' | '));
// Wimbledon ohne weißes Outfit kostet Leihgebühr; Schuhe passen sich dem Belag an
{
  const t = CA.newCareer({ name: 'Wim Test', look: {} });
  t.money = 1e6; t.week = 7; t.points.me = { ao: 5000 };
  CA.buy(t, 'h_4'); CA.buy(t, 'h_5');
  if (CA.besteSchuhe(t, 'grass').name !== 'Nike Vapor Grass' || CA.besteSchuhe(t, 'clay').name !== 'adidas Barricade Clay') throw new Error('Schuhwahl falsch');
  CA.startTournament(t);
  if (t.rechnung.leihe !== 100 || CA.mePlayer(t).look.shirt !== 0xffffff) throw new Error('Wimbledon-Regel falsch');
  console.log('Wimbledon-Regel und Schuhwahl: ok');
}

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
