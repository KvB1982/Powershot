// Testet das Profileben im Saison-Modus ohne Browser: node tools/profisaison.mjs [Spieler-Kürzel] [Siegchance 0–1] [Jahre]
// Ein Test-Spieler spielt Jahre durch. Geprüft wird: Weltrangliste am Start = echte Rangliste, Punkte verteidigen,
// Geld nie unter 0, Ziele, Zeitung, Verletzungen, Zwischenzeit, Wechsel ins nächste Jahr.
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const D = await import('../js/data.js');
const TN = await import('../js/tournament.js');
const SE = await import('../js/season.js');
const PS = await import('../js/profisaison.js');
const TT = await import('../js/turniertag.js');

const [wer = 'alle', chance = '0.6', jahre = '2'] = process.argv.slice(2);
const pruefe = (ok, text) => { if (!ok) throw new Error(text); };

function saison(playerId, siegChance, jahre, laut) {
  let s = PS.einrichten(SE.newSeason(playerId));
  const p = SE.seasonPlayer(s);
  // 1. Am Start muss die Weltrangliste genau die echte sein (das Vorjahr darf keine Punkte dazuerfinden)
  const welt = PS.weltTabelle(s);
  for (const e of welt) pruefe(e.points === e.ref.basePoints, `${e.name}: Startpunkte ${e.points} statt ${e.ref.basePoints}`);
  pruefe(PS.weltPlatz(s) === p.rank, 'Startplatz stimmt nicht');
  pruefe(s.profi.rivalen.length === 2 && !s.profi.rivalen.includes(playerId), 'Rivalen fehlen');
  pruefe(s.profi.ziele.length === 3, 'Es muss drei Ziele geben');
  // Speichern und Laden: der Profi bleibt, die Speicher-Funktion steht nicht im Spielstand
  SE.saveSeason(s);
  pruefe(!localStorage.getItem('powershot.saison.v1').includes('sichern'), 'sichern darf nicht gespeichert werden');
  s = PS.einrichten(SE.loadSeason());
  pruefe(s.profi.rivalen.length === 2, 'Laden hat den Profi verloren');
  if (laut) console.log(`${p.name} (Platz ${p.rank}) · Konto ${s.profi.money} · Team ${s.profi.trainer}/${s.profi.physio} · Rivalen ${s.profi.rivalen.join(', ')}\n  Ziele: ${s.profi.ziele.map((z) => z.text).join(' | ')}`);
  let verletzt = 0, weh = 0, minGeld = s.profi.money;
  for (let j = 0; j < jahre; j++) {
    while (!s.over) {
      const def = SE.nextTournament(s), P = s.profi;
      const vorher = PS.weltTabelle(s).find((e) => e.me).points, vert = PS.verteidigen(s, def);
      const E = PS.erwartung(s, def);
      pruefe(def.cat === 'F' ? ['RR', 'SF'].includes(E.label) : def.points[E.label] != null, 'Erwartung passt nicht zum Turnier: ' + E.label);
      // Müde und nicht bei einem Grand Slam? Dann auslassen.
      const aus = !PS.istVerletzt(s) && P.frische < 45 && def.cat === 'M';
      const T = PS.turnierStart(s, aus);
      if (PS.istVerletzt(s)) { pruefe(!T.humanId, 'Verletzt darf man nicht spielen'); verletzt++; }
      let wache = 0;
      while (!T.done && wache++ < 20) {
        const m = TN.humanMatch(T);
        if (!m) { TN.simulateRest(T); break; }
        const opp = m.a === playerId ? m.b : m.a;
        // Der Tag auf der Anlage: alles einmal ausprobieren
        TT.tagStart(P, def, Math.random);
        if (TT.ereignis(P)) TT.ereignisWahl(P, 0);
        for (const [ort, spiel] of [['saiten'], ['presse', { wahl: Math.floor(Math.random() * 3) }], ['essen', { wahl: 0 }], ['physio']]) if (TT.kann(P, ort, def).ok) pruefe(TT.tun(P, ort, def, spiel), ort + ' ging nicht');
        const ich = PS.spieler(s, def, opp);
        pruefe(ich.id === playerId && ich.stats.vh >= 1 && ich.stats.vh <= 99 && Number.isFinite(ich.stats.kraft), 'Spieler-Werte kaputt');
        const win = Math.random() < siegChance * Math.min(1.2, Math.max(0.3, 1 - (T.players[opp].ovr - D.overall(ich.stats)) / 30));
        TN.playRound(T, { winner: win ? playerId : opp, score: win ? '6:3 6:4' : '2:6 3:6', setDiff: 2 });
        PS.matchGespielt(s, win, opp, T.rounds.length);
        if (P.abendOffen) pruefe(TT.abend(P, 'schlafen'), 'Abend ging nicht');
      }
      const sum = PS.turnierFertig(s);
      // 2. Punkte verteidigen: Die Weltranglisten-Punkte ändern sich genau um (neu − Vorjahr)
      const nachher = PS.weltTabelle(s).find((e) => e.me).points;
      pruefe(nachher === vorher - vert.punkte + sum.points, `${def.name}: Punkte ${vorher} − ${vert.punkte} + ${sum.points} ≠ ${nachher}`);
      pruefe(sum.netto === sum.money + sum.rechnung.sponsor - sum.rechnung.team - sum.rechnung.reise, 'Abrechnung falsch');
      pruefe(P.money >= 0 && P.frische >= 0 && P.frische <= 100 && P.druck >= 0 && P.druck <= 100 && Math.abs(P.mut) <= PS.MUT_MAX, 'Werte außerhalb der Grenzen');
      minGeld = Math.min(minGeld, P.money);
      if (sum.beschwerden) weh++;
      if (laut) console.log(`  ${def.name.padEnd(22)} ${String(sum.label || (sum.dabei ? '?' : '—')).padEnd(5)} +${String(sum.points).padStart(4)} P. (Vorjahr ${String(vert.punkte).padStart(4)})  Welt ${String(sum.platzVorher).padStart(3)}→${String(sum.platz).padStart(3)}  Mut ${P.mut}  Druck ${P.druck}  Gunst ${P.gunst}  Frische ${P.frische}  frei ${sum.frei}${sum.verletzung ? '  VERLETZT ' + sum.verletzung.wochen + ' W.' : ''}${sum.beschwerden ? '  Beschwerden' : ''}`);
      // 3. Zwischen den Turnieren
      const n = PS.zwischenOffen(s);
      pruefe(n <= 2 && (sum.frei > 0 || n === 0), 'Zwischenzeit falsch');
      const wahl = P.koerper || P.frische < 70 ? ['pause', 'studium'] : ['training', 'sponsor', 'kinder'];
      for (const id of wahl) if (PS.zwischenOffen(s)) pruefe(PS.zwischenTun(s, id, 's'), id + ' ging nicht');
      pruefe(PS.zwischenTun(s, wahl[0], 's') === null, 'Dasselbe darf nicht zweimal gehen');
      while (P.skillPoints >= PS.PLUS_KOSTET && PS.steigern(s, ['s', 'vh', 'rh', 'v', 'b', 'a', 'm', 'k'].find((k) => P.plus[k] < PS.PLUS_MAX && p.stats[k] + P.plus[k] < 99) || 's'));
    }
    const J = PS.jahresBilanz(s);
    pruefe(s.profi.ausgezahlt && s.profi.zeitung.length > 5, 'Jahresende unvollständig');
    if (laut) console.log(`  → ${s.year}: Welt ${J.startPlatz} → ${J.platz}, Race ${J.race}, Titel ${J.titel}, Ziele ${J.geschafft}/3, Gewinn ${J.gewinn}, Konto ${s.profi.money}, Level ${s.profi.level}, Plus ${JSON.stringify(s.profi.plus)}`);
    const altRace = { ...s.race[playerId] }, altPlatz = J.platz;
    s = PS.naechsteSaison(s);
    // 4. Neues Jahr: Das Race des alten Jahres ist jetzt das, was zu verteidigen ist. Der Platz bleibt gleich.
    for (const t of D.TOURNAMENTS) pruefe((s.vorjahr[playerId][t.id] || 0) === (altRace[t.id] || 0), 'Vorjahr falsch übernommen');
    pruefe(PS.weltPlatz(s) === altPlatz && s.week === 0 && !s.over && s.profi.ziele.length === 3, 'Wechsel ins neue Jahr falsch');
  }
  return { verletzt, weh, minGeld, zeitung: s.profi.zeitung };
}

if (wer !== 'alle') {
  const r = saison(wer, +chance, +jahre, true);
  console.log('Zeitung (neueste zuerst):'); for (const z of r.zeitung.slice(0, 12)) console.log(`  [${z.art}] ${z.kopf} – ${z.text}`);
} else {
  // Viele Profis, gute und schlechte Test-Spieler
  let n = 0, verletzt = 0, weh = 0;
  for (const i of [0, 1, 2, 4, 7, 11, 19, 29, 45, 60, 85, 99, 120, 150, 199]) for (const c of [0.25, 0.6, 0.95]) {
    const r = saison(D.PLAYERS[i].id, c, 2, false); n++; verletzt += r.verletzt; weh += r.weh;
  }
  console.log(`Profi-Saison: ${n} Läufe über je 2 Jahre in Ordnung · Beschwerden ${weh} · verpasste Turniere durch Verletzung ${verletzt}`);
}
