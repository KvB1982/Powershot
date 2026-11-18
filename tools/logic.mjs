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
const KA = await import('../js/kalender.js');
if (KA.WOCHEN.length !== 52) throw new Error('Der Kalender muss 52 Wochen haben');
for (const t of D.TOURNAMENTS) if (KA.wocheVon(t.id) < 0) throw new Error(t.id + ' fehlt im Kalender');
if (new Set(KT.NACHWUCHS.map((p) => p.name)).size !== KT.NACHWUCHS.length) throw new Error('Nachwuchs: doppelter Name');
if (KT.NACHWUCHS.some((n) => names.has(n.name))) throw new Error('Ein erfundener Spieler heißt wie ein echter');
for (const r of AU.SHOP.filter((s) => s.cat === 'Schläger')) if (Object.values(r.bonus).reduce((a, b) => a + b, 0) !== 4) throw new Error(r.name + ': Pluspunkte müssen zusammen 4 sein');

// ---------------- Karriere: von ganz unten nach oben ----------------
// Ein Test-Spieler, der so spielt: immer das größte Turnier, bei dem er mitspielen darf und das er bezahlen kann.
// siegChance = wie oft er ein Match gewinnt. Reicht das Geld nicht, spielt er Liga.
function karriere(siegChance, saisons, laut) {
  const c = CA.newCareer({ name: 'Max Test', look: {} });
  if (CA.myRank(c) !== 2000) throw new Error('Start muss Platz 2000 sein');
  let liga = 0, minGeld = c.money;
  while (c.season < 2026 + saisons) {
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
      // Gegen viel stärkere Gegner gewinnt auch der Test-Spieler seltener
      const win = Math.random() < siegChance * Math.min(1, Math.max(0.15, 1 - (T.players[opp].ovr - 58) / 30));
      TN.playRound(T, { winner: win ? 'me' : opp, score: win ? '6:3 6:4' : '2:6 3:6', setDiff: 2 });
      CA.matchGespielt(c, win, T.rounds.length);
    }
    const s = CA.finishTournament(c);
    minGeld = Math.min(minGeld, c.money);
    if (c.money < 0) throw new Error('Geld darf nie unter 0 fallen');
    const r = s.rechnung;
    if (s.netto !== s.money + r.sponsor - r.flug - r.hotel - r.essen - r.team - r.bespannen - r.leihe) throw new Error('Abrechnung falsch');
    if (laut) console.log(`  ${s.season} ${KA.datumKurz(s.season, s.w).padStart(6)} ${s.name.padEnd(34)} ${String(s.label).padEnd(4)} +${String(s.points).padStart(4)} P  Platz ${String(s.rank).padStart(4)}  netto ${String(s.netto).padStart(8)} $  Geld ${String(c.money).padStart(9)} $  Frische ${c.frische}${s.neueSponsoren.length ? '  NEU: ' + s.neueSponsoren.map((g) => g.name).join(', ') : ''}`);
    void platz;
  }
  return { c, liga, minGeld };
}
console.log('\nKarriere mit 65 % gewonnenen Matches, 3 Saisons:');
const { c } = karriere(0.65, 3, true);
console.log('Geld', c.money, 'Titel', c.titles, 'Platz', CA.myRank(c), 'Sponsoren', c.sponsoren.join(','), 'Fans', CA.fans(c));
for (const chance of [0.35, 0.5, 0.65, 0.8]) {
  const erg = [];
  for (let i = 0; i < 4; i++) { const k = karriere(chance, 3); erg.push([CA.myRank(k.c), k.c.money, k.liga, k.minGeld]); }
  const mittel = (j) => Math.round(erg.reduce((a, e) => a + e[j], 0) / erg.length);
  console.log(`Siegchance ${chance}: nach 3 Saisons im Schnitt Platz ${mittel(0)}, Geld ${mittel(1)} $, Liga-Wochen ${mittel(2)}, kleinster Kontostand ${Math.min(...erg.map((e) => e[3]))} $`);
}
CA.addXp(c, 500); console.log('Level', c.level, 'Punkte', c.skillPoints, CA.effectiveStats(c), CA.bonusListe(c).map((b) => b.name).join(' | '));
// Wimbledon ohne weißes Outfit kostet Leihgebühr; Schuhe passen sich dem Belag an
{
  const t = CA.newCareer({ name: 'Wim Test', look: {} });
  t.money = 1e6; t.week = KA.wocheVon('wim'); t.erg.me.push({ a: CA.jetzt(t) - 10, p: 5000, k: 0, n: 'Test' }); t.stand++;
  CA.buy(t, 'h_4'); CA.buy(t, 'h_5');
  if (CA.besteSchuhe(t, 'grass').name !== 'Nike Vapor Grass' || CA.besteSchuhe(t, 'clay').name !== 'adidas Barricade Clay') throw new Error('Schuhwahl falsch');
  CA.startTournament(t);
  if (t.rechnung.leihe !== 100 || CA.mePlayer(t).look.shirt !== 0xffffff) throw new Error('Wimbledon-Regel falsch');
  console.log('Wimbledon-Regel und Schuhwahl: ok');
}

// ---------------- Regeln der Weltrangliste ----------------
{
  const t = CA.newCareer({ name: 'Regel Test', look: {} });
  const J = CA.jetzt(t);
  // 20 kleine Ergebnisse: nur die besten 18 zählen
  for (let i = 0; i < 20; i++) t.erg.me.push({ a: J - 1 - i, p: 10 + i, k: 0, n: 'Test ' + i });
  t.stand++;
  let m = CA.meinePunkte(t);
  if (m.zaehlt.length !== 18 || m.gestrichen.length !== 2 || m.punkte !== 20 * 10 + 190 - 10 - 11) throw new Error('Es müssen die besten 18 zählen');
  // Ein Pflichtturnier mit 0 Punkten verdrängt ein anderes Ergebnis, die ATP Finals zählen obendrauf
  t.erg.me.push({ a: J - 2, p: 0, k: 1, n: 'Pflicht' }, { a: J - 3, p: 400, k: 2, n: 'Finals' }); t.stand++;
  m = CA.meinePunkte(t);
  if (m.zaehlt.length !== 19 || m.gestrichen.length !== 3 || m.punkte !== 369 - 12 + 400) throw new Error('Pflicht- oder Finals-Regel falsch');
  // Nach 52 Wochen fällt ein Ergebnis weg
  t.erg.me = [{ a: J - 52, p: 100, k: 0, n: 'Vor einem Jahr' }]; t.stand++;
  if (CA.meinePunkte(t).punkte !== 100 || CA.zuVerteidigen(t)[0].p !== 100) throw new Error('Punkte von vor genau einem Jahr müssen noch zählen');
  const s = CA.wocheOhneTurnier(t, 'pause');
  if (CA.meinePunkte(t).punkte !== 0 || s.weg.length !== 1) throw new Error('Punkte müssen nach 52 Wochen wegfallen');
  // Race: nur das laufende Jahr
  if (CA.meinRace(t).punkte !== 0 || CA.race(t).length !== 601) throw new Error('Race falsch');
  // Wer ein Pflichtturnier auslässt, obwohl er mitspielen darf, bekommt 0 Punkte, die zählen
  t.week = KA.wocheVon('ao'); t.erg.me = [{ a: CA.jetzt(t) - 5, p: 3000, k: 0, n: 'Test' }]; t.stand++;
  CA.wocheOhneTurnier(t, 'pause');
  if (!t.erg.me.some((e) => e.k === 1 && e.p === 0)) throw new Error('Ausgelassenes Pflichtturnier muss mit 0 Punkten zählen');
  // Alle 200 echten Profis starten genau mit ihren echten Punkten
  const n = CA.newCareer({ name: 'Start Test', look: {} });
  const r = CA.ranking(n);
  for (const p of D.PLAYERS) if (r[p.rank - 1].id !== p.id || r[p.rank - 1].points !== p.basePoints) throw new Error('Startrangliste stimmt nicht bei ' + p.name);
  console.log('\nRegeln der Weltrangliste: ok (beste 18, Pflichtturniere, Finals obendrauf, 52 Wochen, Race, Startrangliste)');
}
// Freilose: 96 Spieler im 128er-Baum, 28 im 32er-Baum
{
  const iw = D.tournamentById('iw'), T = TN.createTournament(iw, D.PLAYERS.slice(0, 96), null);
  if (T.rounds[0].filter((m) => m.bye).length !== 32 || Object.keys(T.bye).some((id) => T.players[id].seed > 32 || !T.players[id].seed)) throw new Error('Masters: die 32 Gesetzten müssen ein Freilos haben');
  TN.simulateRest(T);
  if (T.rounds.length !== 7 || !T.champion) throw new Error('Masters mit 96 Spielern muss 7 Runden haben');
  const gs = TN.createTournament(D.tournamentById('wim'), D.PLAYERS.slice(0, 128), null); TN.simulateRest(gs);
  if (gs.rounds.length !== 7 || gs.rounds[0].some((m) => m.bye)) throw new Error('Grand Slam: 128 Spieler, 7 Runden, kein Freilos');
  const k = KT.KLEINE_TURNIERE.find((t) => t.cat === 'A250'), A = TN.createTournament(k, D.PLAYERS.slice(20, 48), null);
  if (A.rounds[0].filter((m) => m.bye).length !== 4) throw new Error('ATP 250: 4 Freilose');
  console.log('Freilose: ok (Masters 96 Spieler mit 32 Freilosen, Grand Slam 128, ATP 250 mit 4 Freilosen)');
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
