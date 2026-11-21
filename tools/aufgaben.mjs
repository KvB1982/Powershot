// Prüft die Aufgaben vom Team (js/aufgaben.js) und das Tennis-Quiz (js/quiz.js) – ohne Browser.
//   node tools/aufgaben.mjs
// Geprüft wird: Jede Quiz-Frage ist vollständig und hat vier verschiedene Antworten · bei jeder Turnier-Stufe gibt es genug Aufgaben ·
// Aufgaben vom Team kosten keine Zeit, Freiwilliges ein Zeitfenster · Belohnungen, Team-Stern, Aufgaben nach dem Match.
// Die Mini-Spiele selbst (js/minispiele.js) brauchen einen Browser und werden hier NICHT geprüft.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const QZ = await import('../js/quiz.js');
const TA = await import('../js/aufgaben.js');
const TT = await import('../js/turniertag.js');
const CA = await import('../js/career.js');
const D = await import('../js/data.js');
const KT = await import('../js/kleinetour.js');
let fehler = 0;
const pruefe = (ok, text) => { if (!ok) { fehler++; console.log('FEHLER: ' + text); } };

// --- Quiz ---
const fragen = new Set();
for (const [thema, liste] of Object.entries(QZ.FRAGEN)) {
  pruefe(QZ.THEMEN[thema], 'Thema ohne Namen: ' + thema);
  pruefe(liste.length >= 15, `Thema ${thema} hat nur ${liste.length} Fragen`);
  for (const f of liste) {
    pruefe(f.length === 6 && f.every((x) => typeof x === 'string' && x.trim()), 'Frage unvollständig: ' + f[0]);
    pruefe(new Set(f.slice(1, 5)).size === 4, 'Antworten doppelt: ' + f[0]);
    pruefe(!fragen.has(f[0]), 'Frage doppelt: ' + f[0]);
    fragen.add(f[0]);
  }
}
// Ziehen: richtige Antwort steht da, wo `richtig` hinzeigt; schon gesehene Fragen kommen nicht wieder
const gesehen = [];
for (let runde = 0; runde < 40; runde++) {
  const z = QZ.ziehe(5, gesehen);
  pruefe(z.length === 5, 'Ziehen liefert nicht 5 Fragen');
  for (const f of z) {
    const zeile = QZ.ALLE.find((a) => a.id === f.id).zeile;
    pruefe(f.antworten[f.richtig] === zeile[1], 'Richtige Antwort verrutscht: ' + f.frage);
    pruefe(!gesehen.includes(f.id), 'Frage kam zu früh wieder: ' + f.frage);
    gesehen.push(f.id);
  }
}
pruefe(QZ.ziehe(5, [], Math.random, ['taktik']).every((f) => f.thema === 'taktik'), 'Themen-Filter geht nicht');
console.log(`Quiz: ${QZ.ANZAHL} Fragen in ${Object.keys(QZ.FRAGEN).length} Themen`);

// --- Aufgaben ---
const ao = D.tournamentById('ao'), itf = KT.KLEINE_TURNIERE.find((t) => t.cat === 'ITF'), ch = KT.KLEINE_TURNIERE.find((t) => t.cat === 'CH'), atp = KT.KLEINE_TURNIERE.find((t) => t.cat === 'A250');
for (const id of TA.AUFGABEN_IDS) {
  const A = TA.AUFGABEN[id];
  pruefe(TA.TEAM[A.von] && A.name && A.ort && A.spiel && A.stufen.length && A.stufen[A.stufen.length - 1][0] === 0, 'Aufgabe unvollständig: ' + id);
  pruefe(TA.stufeFuer(id, 1) === A.stufen[0] && TA.stufeFuer(id, 0) === A.stufen[A.stufen.length - 1], 'Stufen falsch sortiert: ' + id);
}
const neu = () => { const c = CA.newCareer({ name: 'Test' }); c.money = 5000; c.frische = 80; return c; };
for (const [name, def, n] of [['ITF', itf, 3], ['Challenger', ch, 3], ['ATP 250', atp, 3], ['Grand Slam', ao, 4]]) {
  const arten = new Set();
  for (let i = 0; i < 300; i++) {
    const c = neu();
    TT.tagStart(c, def);
    const S = TA.tagAufgaben(c, def);
    pruefe(S.liste.length === n && S.liste[0] === 'warm' && new Set(S.liste).size === n, `${name}: Aufgabenliste falsch: ${S.liste}`);
    for (const id of S.liste) { arten.add(id); pruefe(TA.kann(c, id, def, 'vor').ok, `${name}: Aufgabe ${id} geht nicht`); }
    const N = TA.nachAufgaben(c, def, 'x:1');
    pruefe(N.liste.length === 2 && N.liste[0] === 'dehnen', `${name}: Aufgaben nach dem Match falsch: ${N.liste}`);
    for (const id of N.liste) { arten.add(id); pruefe(TA.kann(c, id, def, 'nach').ok, `${name}: Aufgabe ${id} nach dem Match geht nicht`); }
  }
  console.log(`${name}: ${[...arten].sort().join(', ')}`);
}

// Ein ganzer Tag bei einem großen Turnier
{
  const c = neu();
  TT.tagStart(c, ao, () => 0.99);                         // kein Zufall am Morgen
  const S = TA.tagAufgaben(c, ao);
  const fenster = TT.freieFenster(c), xp = c.xp + c.level * 1000;
  for (const id of S.liste) {
    const r = TA.fertig(c, id, ao, 'vor', 1);
    pruefe(r && r.team, 'Aufgabe vom Team nicht erkannt: ' + id);
    pruefe(!TA.fertig(c, id, ao, 'vor', 1), 'Aufgabe zweimal gemacht: ' + id);
  }
  pruefe(TT.freieFenster(c) === fenster, 'Aufgaben vom Team dürfen keine Zeit kosten');
  pruefe(S.stern && c.teamSterne === 1 && c.tag.bonus.m >= 1, 'Team-Stern fehlt');
  pruefe(c.xp + c.level * 1000 > xp, 'Keine Erfahrung bekommen');
  // Freiwilliges kostet ein Zeitfenster
  const frei = TA.AUFGABEN_IDS.find((id) => !S.liste.includes(id) && id !== 'saiten' && TA.kann(c, id, ao, 'vor').ok);
  const r = TA.fertig(c, frei, ao, 'vor', 0.5);
  pruefe(r && !r.team && TT.freieFenster(c) === fenster - 1, 'Freiwilliges muss ein Zeitfenster kosten');
  pruefe(CA.bonusListe(c).some((b) => b.name === 'Heute auf der Anlage'), 'Pluspunkte kommen nicht im Match an');
  // Nach dem Match: Pluspunkte gelten für das nächste Match und bleiben bei der Abend-Auswahl erhalten
  c.tag = null; c.abend = null; c.abendOffen = true; c.nach = null;
  const N = TA.nachAufgaben(c, ao, 'ao:1');
  pruefe(TA.nachAufgaben(c, ao, 'ao:1') === N && !TA.kann(c, 'kraft', ao, 'nach').ok, 'Nach dem Match gibt es nur die Aufgaben vom Team');
  const f0 = c.frische;
  TA.fertig(c, 'dehnen', ao, 'nach', 1);
  pruefe(c.frische === f0 + 6, 'Dehnen muss Frische bringen');
  c.nach.liste = ['dehnen', 'quiz']; TA.fertig(c, 'quiz', ao, 'nach', 1);
  pruefe(c.nach.stern && c.abend.bonus.k === 1 && c.tag === null, 'Quiz nach dem Match: Pluspunkte fehlen (oder der Tag wurde angelegt)');
  TT.abend(c, 'video');
  pruefe(c.abend.bonus.k === 3 && c.abend.bonus.m === 1, 'Abend-Auswahl muss die Pluspunkte dazuzählen: ' + JSON.stringify(c.abend.bonus));
  pruefe(TA.nachAufgaben(c, ao, 'ao:2') !== N, 'Nach dem nächsten Sieg muss es neue Aufgaben geben');
}
console.log(fehler ? `${fehler} Fehler` : 'Alles in Ordnung.');
if (fehler) process.exitCode = 1;

// ---------- Tennis-Wissen (Lernmodus) ----------
{
  const LE = await import('../js/lernen.js');
  const Q = await import('../js/quiz.js');
  let fehler = 0;
  const falsch = (t) => { fehler++; console.log('  ✗ ' + t); };
  let seiten = 0;
  for (const id of Object.keys(Q.THEMEN)) {
    const K = LE.KAPITEL[id];
    if (!K) { falsch(`Kapitel fehlt: ${id}`); continue; }
    if (!K.kurz || K.seiten.length < 3) falsch(`Kapitel ${id}: zu wenig Seiten`);
    for (const S of K.seiten) {
      seiten++;
      if (!S.titel || !((S.text && S.text.length) || (S.liste && S.liste.length))) falsch(`${id}: Seite ohne Inhalt (${S.titel})`);
      if (S.bild && !LE.BILDER[S.bild]) falsch(`${id}: Bild fehlt (${S.bild})`);
      if (S.bild && !LE.BILDER[S.bild]().startsWith('<svg')) falsch(`${id}: Bild ist kein SVG (${S.bild})`);
    }
  }
  for (const id of Object.keys(LE.KAPITEL)) if (!Q.THEMEN[id]) falsch(`Kapitel ohne Quiz-Thema: ${id}`);
  // Üben: Falsches kommt zuerst wieder, und wer alles zweimal richtig hat, bekommt drei Sterne
  const st = LE.neuerStand();
  let zahl = 1; const zufall = () => (zahl = (zahl * 16807) % 2147483647) / 2147483647;
  const erste = LE.naechste(st, 'regeln', LE.RUNDE, zufall);
  if (erste.length !== LE.RUNDE) falsch('Übungsrunde hat nicht ' + LE.RUNDE + ' Fragen');
  for (const f of erste) { if (f.antworten.length !== 4 || f.antworten[f.richtig] !== Q.ALLE.find((a) => a.id === f.id).zeile[1]) falsch('richtige Antwort verrutscht: ' + f.id); }
  LE.eintragen(st, erste[0].id, false); for (const f of erste.slice(1)) LE.eintragen(st, f.id, true);
  const zweite = LE.naechste(st, 'regeln', LE.RUNDE, zufall);
  if (!zweite.some((f) => f.id === erste[0].id)) falsch('falsch beantwortete Frage kommt nicht wieder');
  if (zweite.some((f) => erste.slice(1).some((e) => e.id === f.id))) falsch('schon gekonnte Frage kommt vor neuen Fragen');
  let runden = 0;
  while (LE.fortschritt(st, 'regeln').sterne < 3 && runden++ < 100) for (const f of LE.naechste(st, 'regeln', LE.RUNDE, zufall)) LE.eintragen(st, f.id, true);
  if (LE.fortschritt(st, 'regeln').sterne !== 3) falsch('drei Sterne nicht erreichbar');
  if (LE.fortschritt(st).sterne !== 0) falsch('Sterne für alle Kapitel zu früh');
  LE.gelesen(st, 'regeln', 0); LE.gelesen(st, 'regeln', 0);
  if (LE.fortschritt(st, 'regeln').gelesen !== 1) falsch('gelesene Seiten falsch gezählt');
  console.log(`\nTennis-Wissen: ${Object.keys(LE.KAPITEL).length} Kapitel, ${seiten} Seiten, drei Sterne im Kapitel „Regeln“ nach ${runden} Runden – ${fehler ? fehler + ' Fehler' : 'alles in Ordnung'}`);
  if (fehler) process.exitCode = 1;
}
