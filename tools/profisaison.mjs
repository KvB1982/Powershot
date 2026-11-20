// Testet das Profileben im Saison-Modus ohne Browser: node tools/profisaison.mjs [Spieler-Kürzel] [Siegchance 0–1] [Jahre] [vorsichtig|ausgewogen|angriff]
// Ein Test-Spieler spielt Jahre durch, Woche für Woche, nach einem Plan aus dem Saison-Planer. Geprüft wird:
// Weltrangliste am Start = echte Rangliste, Punkte verteidigen, kleine Turniere, Pflichtturniere auslassen (Strafen),
// Geld nie unter 0, Ziele, Zeitung, Verletzungen, freie Wochen, Planer-Vorschau, Wechsel ins nächste Jahr.
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const D = await import('../js/data.js');
const TN = await import('../js/tournament.js');
const SE = await import('../js/season.js');
const PS = await import('../js/profisaison.js');
const TT = await import('../js/turniertag.js');
const CA = await import('../js/career.js');
const KA = await import('../js/kalender.js');

const [wer = 'alle', chance = '0.6', jahre = '2', planArt = 'ausgewogen'] = process.argv.slice(2);
const pruefe = (ok, text) => { if (!ok) throw new Error(text); };
const ALLE_K = ['s', 'vh', 'rh', 'v', 'b', 'a', 'm', 'k'];

// Ein Turnier (groß oder klein) durchspielen
function spielen(s, T, def, siegChance) {
  const P = s.profi, playerId = s.playerId;
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
}

// auslassen = Liste von großen Turnieren, die der Test-Spieler ohne Grund auslässt
function saison(playerId, siegChance, jahre, laut, art = 'ausgewogen', auslassen = []) {
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
  const R = { verletzt: 0, weh: 0, minGeld: s.profi.money, kleine: 0, strafen: 0, turniere: 0, starts: [], jahre: [] };
  for (let j = 0; j < jahre; j++) {
    PS.autoPlan(s, art);
    for (const id of auslassen) PS.planSetzen(s, CA_woche(id), 'aus');
    const V = PS.vorschau(s);
    pruefe(V.wochen.length > 40 && V.wochen.every((z) => z.vorbei || z.art === 'zweite' || (z.frische >= 0 && z.frische <= 100)), 'Vorschau kaputt');
    if (laut) console.log(`  Plan „${art}“: ${V.turniere} Turniere, ATP 500: ${V.n500}, Belastung ${V.belastung}${V.hinweise.map((h) => '\n    [' + h.art + '] ' + h.text).join('')}`);
    let wache = 0, letzteKw = -1;
    while (!s.over && wache++ < 200) {
      const J = PS.jetzt(s), P = s.profi;
      pruefe(J.kw >= letzteKw, 'Die Wochen laufen rückwärts');
      letzteKw = J.kw;
      const wahl = PS.planVon(s, J.kw);
      if (J.art === 'frei') {
        const klein = wahl && D.tournamentById(wahl);
        // Wer Beschwerden hat oder sehr müde ist, lässt das kleine Turnier doch weg (so soll man den Planer benutzen)
        if (klein && !P.verletzung && !P.koerper && P.frische >= 55 && PS.darfSpielen(s, klein).ok) {
          const vorher = PS.weltTabelle(s).find((e) => e.me).points, restVorher = Math.round(s.rest[playerId] * (1 - PS.restWeg(s)));
          const T = PS.kleinStart(s, klein.id);
          pruefe(T && T.humanId === playerId && s.profi.klein === klein.id, 'Kleines Turnier startet nicht: ' + klein.name);
          R.starts.push(P.frische);
          pruefe(PS.kleinStart(s, klein.id) === null && PS.wocheFrei(s, 'pause') === null, 'Während eines Turniers darf nichts anderes gehen');
          spielen(s, T, klein, siegChance);
          const sum = PS.turnierFertig(s);
          pruefe(sum.klein && sum.netto === sum.money + sum.rechnung.sponsor - sum.rechnung.team - sum.rechnung.reise, 'Abrechnung (klein) falsch');
          const restNachher = Math.round(s.rest[playerId] * (1 - PS.restWeg(s)));
          const nachher = PS.weltTabelle(s).find((e) => e.me).points;
          pruefe(nachher === vorher + sum.points - restVorher + restNachher, `${klein.name}: Weltpunkte stimmen nicht`);
          pruefe(s.race[playerId][klein.id] === sum.points && !s.tournament && !P.klein, 'Kleines Turnier nicht sauber beendet');
          R.kleine++;
          if (sum.beschwerden) R.weh++;
          if (laut) console.log(`  KW${String(J.kw + 1).padStart(2)} ${('· ' + klein.name + ' (' + klein.catName + ')').padEnd(34)} ${String(sum.label).padEnd(5)} +${String(sum.points).padStart(4)} P.  Welt ${String(sum.platzVorher).padStart(3)}→${String(sum.platz).padStart(3)}  Frische ${P.frische}  Serie ${P.serie}${sum.verletzung ? '  VERLETZT ' + sum.verletzung.wochen + ' W.' : ''}${sum.beschwerden ? '  Beschwerden' : ''}`);
        } else {
          let [id, k] = (wahl && !D.tournamentById(wahl) ? wahl : 'pause').split(':');
          if (P.koerper || P.frische < 55 || !PS.zwischenGeht(s, id).ok) id = 'pause';
          const r = PS.wocheFrei(s, id, k || 's');
          pruefe(r && r.bringt.length, 'Freie Woche ging nicht: ' + id);
          if (laut) console.log(`  KW${String(J.kw + 1).padStart(2)}   ${r.name.padEnd(28)} ${r.bringt.join(' · ')}  (Frische ${P.frische})`);
        }
        pruefe(s.profi.kw > J.kw, 'Die Woche geht nicht weiter');
      } else {
        const def = J.def;
        pruefe(J.art === 'gross' && def.id === SE.nextTournament(s).id, 'Falsches Turnier dran');
        const vorher = PS.weltTabelle(s).find((e) => e.me).points, vert = PS.verteidigen(s, def);
        const E = PS.erwartung(s, def);
        pruefe(def.cat === 'F' ? ['RR', 'SF'].includes(E.label) : def.points[E.label] != null, 'Erwartung passt nicht zum Turnier: ' + E.label);
        const aus = wahl === 'aus' && def.cat !== 'F';
        const folgen = aus && !PS.istVerletzt(s) ? PS.auslassFolgen(s, def) : null, geldVorher = P.money, gefehltVorher = P.gefehlt || 0;
        const T = PS.turnierStart(s, aus);
        if (PS.istVerletzt(s)) { pruefe(!T.humanId, 'Verletzt darf man nicht spielen'); R.verletzt++; }
        if (T.humanId) R.starts.push(P.frische);
        if (T.humanId) spielen(s, T, def, siegChance); 
        const sum = PS.turnierFertig(s);
        // 2. Punkte verteidigen: Die Weltranglisten-Punkte ändern sich genau um (neu − Vorjahr)
        const nachher = PS.weltTabelle(s).find((e) => e.me).points;
        pruefe(nachher === vorher - vert.punkte + sum.points, `${def.name}: Punkte ${vorher} − ${vert.punkte} + ${sum.points} ≠ ${nachher}`);
        pruefe(sum.netto === sum.money + sum.rechnung.sponsor - sum.rechnung.team - sum.rechnung.reise, 'Abrechnung falsch');
        // 3. Pflichtturnier ohne Grund ausgelassen: Verwarnung, dann Strafen, die jedes Mal höher werden
        if (folgen) {
          pruefe(sum.auslassen && sum.auslassen.strafe === folgen.strafe, 'Folgen des Auslassens falsch');
          pruefe(folgen.pflicht === CA.istPflicht(def), 'Pflicht falsch erkannt');
          if (folgen.pflicht && !folgen.entschuldigt) {
            pruefe(P.gefehlt === gefehltVorher + 1 && folgen.nr === P.gefehlt, 'Zähler der ausgelassenen Pflichtturniere falsch');
            pruefe(folgen.nr === 1 ? folgen.strafe === 0 : folgen.strafe > 0, 'Erst Verwarnung, dann Strafe');
            R.strafen += folgen.strafe;
          } else pruefe(folgen.strafe === 0, 'Ohne Pflicht oder mit Attest gibt es keine Strafe');
        }
        if (sum.beschwerden) R.weh++;
        if (laut) console.log(`  KW${String(J.kw + 1).padStart(2)} ${def.name.padEnd(34)} ${String(sum.label || (sum.dabei ? '?' : '—')).padEnd(5)} +${String(sum.points).padStart(4)} P. (Vorjahr ${String(vert.punkte).padStart(4)})  Welt ${String(sum.platzVorher).padStart(3)}→${String(sum.platz).padStart(3)}  Mut ${P.mut}  Druck ${P.druck}  Gunst ${P.gunst}  Frische ${P.frische}${sum.auslassen ? '  AUSGELASSEN: ' + sum.auslassen.text : ''}${sum.verletzung ? '  VERLETZT ' + sum.verletzung.wochen + ' W.' : ''}${sum.beschwerden ? '  Beschwerden' : ''}`);
      }
      const P2 = s.profi;
      pruefe(P2.money >= 0 && P2.frische >= 0 && P2.frische <= 100 && P2.druck >= 0 && P2.druck <= 100 && P2.gunst >= 0 && P2.gunst <= 100 && Math.abs(P2.mut) <= PS.MUT_MAX, 'Werte außerhalb der Grenzen');
      R.minGeld = Math.min(R.minGeld, P2.money);
      while (P2.skillPoints >= PS.PLUS_KOSTET && PS.steigern(s, ALLE_K.find((k) => P2.plus[k] < PS.PLUS_MAX && p.stats[k] + P2.plus[k] < 99) || 's'));
    }
    pruefe(s.over, 'Die Saison ist nicht zu Ende gegangen');
    const J = PS.jahresBilanz(s);
    pruefe(s.profi.ausgezahlt && s.profi.zeitung.length > 5, 'Jahresende unvollständig');
    pruefe(J.fehlen500 === 0 || J.strafen >= J.fehlen500 * PS.REGEL_500.strafe, 'Strafe für fehlende ATP 500 fehlt');
    R.turniere += J.turniere;
    R.jahre.push({ start: J.startPlatz, ende: J.platz, turniere: J.turniere, fehlen500: J.fehlen500 });
    if (laut) console.log(`  → ${s.year}: Welt ${J.startPlatz} → ${J.platz}, Race ${J.race}, Titel ${J.titel}, Turniere ${J.turniere} (klein ${J.kleine.length}), fehlende ATP 500: ${J.fehlen500}, Strafen ${J.strafen}, Ziele ${J.geschafft}/3, Gewinn ${J.gewinn}, Konto ${s.profi.money}, Level ${s.profi.level}`);
    const altRace = { ...s.race[playerId] }, altPlatz = J.platz, altWelt = PS.weltTabelle(s);
    R.welt = altWelt;
    s = PS.naechsteSaison(s);
    // 4. Neues Jahr: Das Race des alten Jahres ist jetzt das, was zu verteidigen ist. Der Platz bleibt gleich.
    for (const t of D.TOURNAMENTS) pruefe((s.vorjahr[playerId][t.id] || 0) === (altRace[t.id] || 0), 'Vorjahr falsch übernommen');
    const neuWelt = PS.weltTabelle(s);
    for (const e of altWelt) pruefe(neuWelt.find((x) => x.id === e.id).points === e.points, 'Punkte ändern sich beim Jahreswechsel: ' + e.name);
    pruefe(PS.weltPlatz(s) === altPlatz && s.week === 0 && s.profi.kw === 0 && !s.over && s.profi.ziele.length === 3 && !s.profi.gefehlt && !Object.keys(s.profi.plan).length, 'Wechsel ins neue Jahr falsch');
  }
  R.zeitung = s.profi.zeitung;
  return R;
}
function CA_woche(id) { return KA.wocheVon(id); }

if (wer !== 'alle') {
  const r = saison(wer, +chance, +jahre, true, planArt);
  console.log('Zeitung (neueste zuerst):'); for (const z of r.zeitung.slice(0, 12)) console.log(`  [${z.art}] ${z.kopf} – ${z.text}`);
} else {
  // Viele Profis, gute und schlechte Test-Spieler, drei Arten zu planen
  let n = 0;
  const je = {};
  for (const i of [0, 1, 2, 4, 7, 11, 19, 29, 45, 60, 85, 99, 120, 150, 199]) for (const c of [0.25, 0.6, 0.95]) {
    const art = ['vorsichtig', 'ausgewogen', 'angriff'][n % 3];
    const r = saison(D.PLAYERS[i].id, c, 2, false, art); n++;
    const e = je[art] = je[art] || { n: 0, weh: 0, verletzt: 0, turniere: 0, kleine: 0, starts: [] };
    e.n++; e.weh += r.weh; e.verletzt += r.verletzt; e.turniere += r.turniere; e.kleine += r.kleine; e.starts.push(...r.starts);
  }
  console.log(`Profi-Saison: ${n} Läufe über je 2 Jahre in Ordnung`);
  for (const [art, e] of Object.entries(je)) console.log(`  ${art.padEnd(11)} Turniere pro Jahr ${(e.turniere / e.n / 2).toFixed(1)} (davon klein ${(e.kleine / e.n / 2).toFixed(1)}) · Beschwerden pro Jahr ${(e.weh / e.n / 2).toFixed(2)} · verpasste große Turniere durch Verletzung pro Jahr ${(e.verletzt / e.n / 2).toFixed(2)} · Frische am Turnierstart im Schnitt ${Math.round(e.starts.reduce((a, b) => a + b, 0) / e.starts.length)}, unter 60 bei ${Math.round(100 * e.starts.filter((f) => f < 60).length / e.starts.length)} %`);
  // Pflichtturniere ohne Grund auslassen: Die Strafen müssen steigen
  const r = saison('zverev', 0.6, 1, false, 'vorsichtig', ['iw', 'mia', 'mad', 'rom']);
  pruefe(r.strafen > 0, 'Vier Pflichtturniere ausgelassen und keine Strafe');
  console.log(`  Vier Pflichtturniere ohne Grund ausgelassen: zusammen ${r.strafen.toLocaleString('de-DE')} $ Strafe (oder weniger, wenn gerade ein Attest da war)`);
  // Bleibt die Welt im Gleichgewicht? Punkte der anderen Profis nach einem Jahr, verglichen mit den echten Punkten am Start
  const b = saison('zverev', 0.6, 1, false, 'ausgewogen');
  for (const [a, z] of [[1, 10], [11, 30], [31, 60], [61, 110], [111, 200]]) {
    const gruppe = b.welt.filter((e) => e.start >= a && e.start <= z && !e.me);
    const neu = gruppe.reduce((x, e) => x + e.points, 0), alt = gruppe.reduce((x, e) => x + e.ref.basePoints, 0);
    console.log(`  Gleichgewicht Platz ${String(a).padStart(3)}–${String(z).padEnd(3)}: Punkte nach einem Jahr ${Math.round(100 * neu / alt)} % vom Start`);
  }
}
