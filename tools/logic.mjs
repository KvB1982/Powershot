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
const AB = await import('../js/ausbau.js');
if (KA.WOCHEN.length !== 52) throw new Error('Der Kalender muss 52 Wochen haben');
for (const t of D.TOURNAMENTS) if (KA.wocheVon(t.id) < 0) throw new Error(t.id + ' fehlt im Kalender');
if (new Set(KT.NACHWUCHS.map((p) => p.name)).size !== KT.NACHWUCHS.length) throw new Error('Nachwuchs: doppelter Name');
if (KT.NACHWUCHS.some((n) => names.has(n.name))) throw new Error('Ein erfundener Spieler heißt wie ein echter');
for (const r of AU.SHOP.filter((s) => s.cat === 'Schläger' && !s.verdient)) if (Object.values(r.bonus).reduce((a, b) => a + b, 0) !== 4) throw new Error(r.name + ': Pluspunkte müssen zusammen 4 sein');

// ---------------- Karriere: von ganz unten nach oben ----------------
// Ein Test-Spieler, der so spielt: immer das größte Turnier, bei dem er mitspielen darf und das er bezahlen kann.
// siegChance = wie oft er ein Match gewinnt. Reicht das Geld nicht, spielt er Liga.
function karriere(siegChance, saisons, laut, stur) {
  const c = CA.newCareer({ name: 'Max Test', look: {} });
  if (CA.myRank(c) !== 2000) throw new Error('Start muss Platz 2000 sein');
  let liga = 0, minGeld = c.money, verletzt = 0, wehweh = 0;
  while (c.season < 2026 + saisons) {
    const platz = CA.myRank(c);
    // Ausrüstung und Team wie ein vernünftiger Spieler
    if (!c.equipped['Schläger'] && c.money > 1500) CA.buy(c, 'r_12');
    if (!c.owned.includes('h_0') && c.money > 400) CA.buy(c, 'h_0');      // Schuhe für alle Beläge (ohne geht es nicht auf Sand und Rasen)
    if (!c.equipped['Saiten'] && c.money > 1500) CA.buy(c, 's_2');
    if (!c.vertrag.schlaeger && CA.vertragsStufe(c) >= 0) CA.setVertrag(c, 'schlaeger', 'Babolat');
    if (c.money > 30000 && c.trainer === 't0') CA.setTeam(c, 't2');
    if (c.money > 30000 && c.physio === 'p0') CA.setTeam(c, 'p2');
    for (const id of ['bespanner', 'werkstatt', 'arzt', 'tr_schlag']) if (c.money > 4 * ((AB.kannKaufen(c, id, platz).naechste || {}).preis || 1e9)) CA.ausbauKaufen(c, id);
    // Verletzt: gesund werden. Beschwerden: eine Woche Pause (so macht es ein vernünftiger Spieler).
    if (c.verletzung) { const s = CA.wocheOhneTurnier(c, 'pause'); verletzt++; if (s.cat !== 'reha') throw new Error('Verletzt muss Reha sein'); if (laut) console.log(`  Verletzungspause (${s.reha.name}, noch ${s.reha.rest} Wochen)  Platz ${s.rank}`); continue; }
    if (c.koerper && !stur) { const s = CA.wocheOhneTurnier(c, 'pause'); if (!s.geheilt || c.koerper) throw new Error('Pause muss Beschwerden heilen'); continue; }
    const wahl = CA.angebot(c).filter((a) => a.zugang.ok && !a.fehlt && !a.sachen.some((f) => f.muss)).pop();
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
    if (s.beschwerden) wehweh++;
    if (s.verletzung && laut) console.log(`  VERLETZT: ${s.verletzung.name}, ${s.verletzung.wochen} Wochen. ${s.verletzung.fehler.join(' ')} (${s.punkteInGefahr} Punkte fallen in der Zeit weg)`);
    if (c.money < 0) throw new Error('Geld darf nie unter 0 fallen');
    const r = s.rechnung;
    if (s.netto !== s.money + r.sponsor - r.flug - r.hotel - r.essen - r.team - r.bespannen - r.leihe) throw new Error('Abrechnung falsch');
    if (laut) console.log(`  ${s.season} ${KA.datumKurz(s.season, s.w).padStart(6)} ${s.name.padEnd(34)} ${String(s.label).padEnd(4)} +${String(s.points).padStart(4)} P  Platz ${String(s.rank).padStart(4)}  netto ${String(s.netto).padStart(8)} $  Geld ${String(c.money).padStart(9)} $  Frische ${c.frische}${s.neueSponsoren.length ? '  NEU: ' + s.neueSponsoren.map((g) => g.name).join(', ') : ''}`);
    void platz;
  }
  return { c, liga, minGeld, verletzt, wehweh };
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
// Der Körper: Ein vernünftiger Spieler (macht Pause bei Beschwerden) verletzt sich fast nie, ein sturer öfter.
for (const stur of [false, true]) {
  let v = 0, w = 0;
  for (let i = 0; i < 3; i++) { const k = karriere(0.65, 3, false, stur); v += k.verletzt; w += k.wehweh; }
  console.log(`Körper (${stur ? 'spielt mit Beschwerden weiter' : 'macht Pause bei Beschwerden'}): in 9 Jahren ${w}-mal Beschwerden, ${v} Wochen verletzt`);
}
{
  // Mit festem Zufall: erst Beschwerden, dann Verletzung mit Erklärung
  const t = { money: 0, ausbau: {}, skills: {} };
  const eins = AB.koerperWoche(t, { matches: 3, tiefFrische: 25, serie: 7, physio: 0, zufall: () => 0 });
  if (!eins.beschwerden || !t.koerper) throw new Error('Beschwerden fehlen');
  const zwei = AB.koerperWoche(t, { matches: 3, tiefFrische: 25, serie: 7, physio: 0, zufall: () => 0 });
  if (!zwei.verletzung || t.verletzung.fehler.length !== 3 || t.verletzung.wochen !== 12 || t.koerper) throw new Error('Verletzung falsch: ' + JSON.stringify(zwei));
  if (AB.grenze({ ausbau: {} }, 's') !== 70 || AB.grenze({ ausbau: { tr_aufschlag: 2 } }, 's') !== 88 || AB.grenze({ ausbau: { tr_aufschlag: 2 } }, 'v') !== 70) throw new Error('Grenze der Fähigkeiten falsch');
  const l = { money: 50000, skills: { s: 80, vh: 60 }, techniken: [] };
  if (!AB.lernen(l, 'kick') || AB.lernen(l, 'peitsche') || !AB.technikWerte(l).aufschlag.kick) throw new Error('Profi-Schläge lernen falsch');
}
{
  // Der Turniertag: Zeitfenster, Zufälle, Essen, Presse, Kraftraum, Abend
  const TT = await import('../js/turniertag.js');
  const t = CA.newCareer({ name: 'Tag Test', look: {} });
  const ao = D.tournamentById('ao'), itf = KT.KLEINE_TURNIERE.find((x) => x.cat === 'ITF');
  if (TT.fensterVon(ao) !== 3 || TT.fensterVon(itf) !== 2) throw new Error('Zeitfenster falsch');
  for (const id in TT.EREIGNISSE) for (const w of TT.EREIGNISSE[id].wahl) if (w.length !== 3) throw new Error('Ereignis ' + id + ' unvollständig');
  for (const f of TT.FRAGEN) if (f.antworten.map((a) => a[0]).sort().join() !== 'nett,patzig,witzig') throw new Error('Presse-Frage braucht je eine nette, witzige und patzige Antwort');
  // Zufall fest: 0 → Frage 0, Ereignis ja, das erste mögliche (Regen: ein Zeitfenster mehr)
  TT.tagStart(t, ao, () => 0);
  if (TT.ereignis(t).id !== 'regen' || TT.fensterName(t) !== 'Freier Tag') throw new Error('Ereignis oder Fenstername falsch');
  TT.ereignisWahl(t, 0);
  if (TT.freieFenster(t) !== 4 || TT.ereignis(t)) throw new Error('Regen muss ein Zeitfenster bringen');
  t.frische = 80;
  if (!TT.tun(t, 'essen', ao, { wahl: 1 }) || t.frische !== 77) throw new Error('Burger muss Frische kosten');
  if (TT.tun(t, 'essen', ao, { wahl: 0 })) throw new Error('Zweimal essen geht nicht');
  if (!TT.tun(t, 'presse', ao, { wahl: 0 }) || t.tagFans !== 1) throw new Error('Nette Antwort muss einen Fan-Stern bringen');
  const k = TT.tun(t, 'kraft', ao, { treffer: 5 });
  if (!k || t.tag.bonus.s !== 1 || t.tag.bonus.p !== 1) throw new Error('Kraftraum falsch');
  if (TT.fensterName(t) !== 'Mittag') throw new Error('Fenstername nach drei Tätigkeiten: ' + TT.fensterName(t));
  // Abend: nur nach einem Sieg
  if (TT.abend(t, 'video')) throw new Error('Abend ohne Sieg');
  t.abendOffen = true;
  if (!TT.abend(t, 'video') || !CA.bonusListe(t).some((b) => b.name === 'Gestern Abend' && b.bonus.k === 2) || t.abendOffen) throw new Error('Abend falsch');
  // Wie oft kommt ein Zufall?
  let n = 0; for (let i = 0; i < 400; i++) { TT.tagStart(t, itf); if (TT.ereignis(t)) { n++; if (TT.EREIGNISSE[t.tag.ereignis].ab > 0) throw new Error('Ereignis passt nicht zum ITF-Turnier'); } }
  console.log('Turniertag: ok · Zufälle an', Math.round(n / 4), '% der Tage');
}
{
  // Sammlung: Turnier-Editionen nur in der Turnierwoche und nur mit Startrecht; Sonderstücke nur verdient; Handtücher
  const t = CA.newCareer({ name: 'Sammel Test', look: {} });
  t.money = 5000;
  if (CA.buy(t, 'e_ao') || CA.buy(t, 'x_titel')) throw new Error('Edition oder Sonderstück darf man so nicht kaufen');
  t.week = KA.wocheVon('ao');
  if (CA.buy(t, 'e_ao')) throw new Error('Edition ohne Startrecht gekauft');
  t.erg.me.push({ a: CA.jetzt(t) - 1, p: 3000, k: 0 }); t.stand++;
  if (!CA.buy(t, 'e_ao') || !CA.buy(t, 'h_0')) throw new Error('Edition mit Startrecht muss gehen');
  t.week++;
  if (!CA.editionDa(t, AU.shopById('e_ao')) ) throw new Error('Edition muss auch in der zweiten Turnierwoche da sein');
  t.titles = 1;
  const neu = CA.sonderPruefen(t);
  if (!neu.some((x) => x.id === 'x_titel') || !neu.some((x) => x.id === 'x_top100') || CA.sonderPruefen(t).length) throw new Error('Sonderstücke falsch: ' + neu.map((x) => x.id));
  if (CA.anprobeLook(t, 'e_rg').shirt !== 0xc8643a || CA.anprobeLook(t, null).shirt !== 0x3aa0f0) throw new Error('Anprobe falsch');
  if (!c.handtuecher.length || c.handtuecher.some((h) => !h.n || h.mal < 1)) throw new Error('Handtücher fehlen');
  console.log('Sammlung: ok ·', c.handtuecher.length, 'Handtücher nach 3 Jahren ·', c.owned.filter((id) => id[0] === 'x').join(','));
}
{
  // Saison-Planer: Schuhe, Phasen, automatischer Plan, Kosten
  const PL = await import('../js/planer.js');
  const t = CA.newCareer({ name: 'Plan Test', look: {} });
  for (let w = 0; w < 52; w++) if (!KA.phaseVon(w) || KA.phaseVon(w).von > w || KA.phaseVon(w).bis < w) throw new Error('Phase fehlt für Woche ' + w);
  if (KA.phaseVon(KA.wocheVon('wim')).belag !== 'grass' || KA.phaseVon(KA.wocheVon('rg')).belag !== 'clay' || KA.phaseVon(KA.wocheVon('uso')).belag !== 'hard' || !KA.WOCHEN.every((w) => !w.off || KA.phaseVon(w.nr).id === 'off')) throw new Error('Phasen passen nicht zum Kalender');
  if (!CA.schuhePassen(t, 'hard') || CA.schuhePassen(t, 'clay') || CA.schuhePassen(t, 'grass')) throw new Error('Alte Turnschuhe: nur Hartplatz und Halle');
  const sand = KT.KLEINE_TURNIERE.find((x) => x.surface === 'clay');
  t.week = sand.woche;
  if (CA.startTournament(t, sand.id)) throw new Error('Ohne Sandplatz-Schuhe darf man nicht auf Sand antreten');
  CA.buy(t, 'h_5');
  if (!CA.schuhePassen(t, 'clay') || CA.fehltFuer(t, sand).length) throw new Error('Sandplatz-Schuhe müssen reichen');
  t.week = 0;
  if (CA.ausruestungJetzt(CA.newCareer({ name: 'x', look: {} })).some((z) => z.eigen)) throw new Error('Am Anfang gehört dir noch nichts Gekauftes');
  for (const art of Object.keys(PL.AUTO)) {
    PL.leeren(t); PL.autoPlan(t, art);
    const v = PL.vorschau(t);
    if (Object.keys(t.plan.wochen).length !== 52 || v.wochen.length !== 52 || v.tief < 0 || v.laengste > PL.AUTO[art].pauseNach + 1) throw new Error('Auto-Plan ' + art + ' falsch: ' + JSON.stringify({ n: Object.keys(t.plan.wochen).length, tief: v.tief, serie: v.laengste }));
    const m = v.monate.reduce((a, x) => a + x.kosten, 0);
    if (m !== v.kosten || v.monate.length !== 12) throw new Error('Monate zählen falsch');
    console.log(`Planer ${art}: ${v.turniere} Turniere, Kosten ${v.kosten} $, sicher ${v.sicher} $, tiefster Kontostand ${v.tief} $, Note ${v.note}`);
  }
  PL.leeren(t); PL.setzen(t, KA.wocheVon('wim'), 'wim');
  const v = PL.vorschau(t);
  if (!v.braucht.some((b) => b.was === 'schuhe' && b.belag === 'grass') || !v.braucht.some((b) => b.was === 'weiss') || !v.hinweise.some((h) => h.text.startsWith('Platz'))) throw new Error('Wimbledon-Plan: Rasen-Schuhe, Weiß und Platz-Hinweis fehlen');
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
