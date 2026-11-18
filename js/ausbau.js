// Powershot – Profi-Service: Was sich ein Tennisprofi mit der Zeit alles leistet.
//
// Am Anfang bespannt man seinen Schläger selbst und hat niemanden. Je weiter man in der Weltrangliste kommt,
// desto mehr Fachleute arbeiten für einen: ein eigener Bespanner, eine Schläger-Werkstatt, Ärzte,
// Spezial-Trainer für einzelne Schläge. Und: Wer nicht auf seinen Körper hört, verletzt sich.
//
// Diese Datei enthält nur Listen und Rechnungen (kein three.js, keine anderen Dateien).
// Echt ist, DASS es das alles bei den Profis gibt. Alle Zahlen (Preise, Plätze, Wirkung, Risiko) sind geschätzt.

// ---------------------------------------------------------------
// Ausbaustufen: Jede Stufe kauft man einmal. Man braucht dafür einen Platz in der Weltrangliste (abPlatz)
// und die Stufe davor.
// ---------------------------------------------------------------
//   bonus    = Pluspunkte (p = Kraft, c = Präzision, s = Aufschlag …), gelten für alle Stufen zusammen
//   saiten   = so viele Matches hält eine Bespannung länger
//   risiko   = damit wird das Verletzungsrisiko malgenommen (0.8 = ein Fünftel weniger)
//   heilung  = damit wird die Dauer einer Verletzung malgenommen
export const BEREICHE = {
  bespanner: {
    name: 'Bespanner', bild: '🧵',
    text: 'Profis lassen vor jedem Match frisch bespannen – immer von demselben Menschen, immer genau gleich fest.',
    stufen: [
      { name: 'Bespanner am Turnier', abPlatz: 900, preis: 300, saiten: 1, text: 'Du gibst deinen Schläger beim Turnier-Service ab, statt selbst zu bespannen.' },
      { name: 'Eigene Bespannmaschine auf Reisen', abPlatz: 400, preis: 2500, saiten: 1, text: 'Dein Trainer bespannt im Hotel. Du bist nicht mehr auf andere angewiesen.' },
      { name: 'Persönlicher Bespanner', abPlatz: 120, preis: 15000, saiten: 1, bonus: { c: 1 }, text: 'Er kennt deine Schläger genau und trifft die Härte aufs Kilo.' },
      { name: 'Bespanner im eigenen Team', abPlatz: 25, preis: 80000, saiten: 1, bonus: { c: 1 }, text: 'Er reist mit und bespannt sogar während des Matches nach – je nach Wetter.' },
    ],
  },
  werkstatt: {
    name: 'Schläger-Werkstatt', bild: '🔧',
    text: 'Kein Profi spielt einen Schläger „von der Stange“. Gewicht, Balance und Griff werden für ihn angepasst.',
    stufen: [
      { name: 'Griff anpassen', abPlatz: 800, preis: 400, bonus: { c: 1 }, text: 'Der Griff wird so geformt, dass er genau in deine Hand passt.' },
      { name: 'Bleiband und Balance', abPlatz: 300, preis: 3000, bonus: { p: 1 }, text: 'Kleine Gewichte im Rahmen: Der Schläger schlägt härter und flattert weniger.' },
      { name: 'Alle Schläger genau gleich', abPlatz: 100, preis: 20000, bonus: { c: 1 }, text: 'Eine Werkstatt wiegt deine Schläger aufs Gramm aus. Jeder fühlt sich gleich an.' },
      { name: 'Dein eigenes Profi-Modell', abPlatz: 20, preis: 120000, bonus: { p: 1, c: 1 }, text: 'Die Marke baut einen Schläger nur für dich. Im Laden sieht er aus wie das normale Modell.' },
    ],
  },
  arzt: {
    name: 'Ärzte und Bewegungslabor', bild: '🩺',
    text: 'Ärzte schauen, ob dein Körper die Belastung aushält. Im Bewegungslabor filmen Kameras deine Schläge und finden Fehler, die dem Körper schaden.',
    stufen: [
      { name: 'Jährlicher Check beim Sportarzt', abPlatz: 900, preis: 500, risiko: 0.9, text: 'Herz, Gelenke, Blut: Der Arzt findet Probleme, bevor sie weh tun.' },
      { name: 'Video-Analyse deiner Bewegungen', abPlatz: 350, preis: 5000, risiko: 0.9, bonus: { s: 1 }, text: 'Zeitlupe zeigt: Dein Aufschlag belastet die Schulter. Mit der neuen Bewegung geht es leichter – und schneller.' },
      { name: 'Bewegungslabor', abPlatz: 100, preis: 30000, risiko: 0.85, heilung: 0.85, bonus: { t: 1 }, text: 'Messpunkte am ganzen Körper. Die Forscher zeigen dir, wie du mit weniger Kraft schneller läufst.' },
      { name: 'Eigenes Ärzteteam', abPlatz: 20, preis: 150000, risiko: 0.8, heilung: 0.75, text: 'Arzt und Ernährungsberater reisen mit. Kleine Beschwerden werden sofort behandelt.' },
    ],
  },
};

// ---------------------------------------------------------------
// Spezial-Trainer: Ohne sie kommst du bei einer Fähigkeit nur bis GRENZE_OHNE.
// Jede Stufe hebt die Grenze für "ihre" Fähigkeiten.
// ---------------------------------------------------------------
export const GRENZE_OHNE = 70;
export const TRAINER_STUFEN = [
  { name: 'Lehrgang', abPlatz: 600, preis: 2000, grenze: 80 },
  { name: 'Fester Spezial-Trainer', abPlatz: 150, preis: 25000, grenze: 88 },
  { name: 'Weltklasse-Trainer', abPlatz: 30, preis: 150000, grenze: 95 },
];
export const SPEZIAL = {
  tr_aufschlag: { name: 'Aufschlag-Trainer', bild: '🎯', fuer: ['s'], text: 'Arbeitet nur an deinem Aufschlag: Ballwurf, Kniebeuge, Treffpunkt.' },
  tr_schlag: { name: 'Schlag-Trainer', bild: '🎾', fuer: ['vh', 'rh'], text: 'Feilt an Vorhand und Rückhand, bis jede Bewegung sitzt.' },
  tr_netz: { name: 'Netz-Trainer', bild: '🥅', fuer: ['v'], text: 'Früher selbst Doppel-Spezialist. Bringt dir das Spiel am Netz bei.' },
  tr_athletik: { name: 'Athletik-Trainer', bild: '🏃', fuer: ['b', 'a'], text: 'Beinarbeit und Ausdauer: Leitern, Sprints, Läufe – jeden Tag.' },
  tr_kopf: { name: 'Mental-Trainer und Video-Analyst', bild: '🧠', fuer: ['m', 'k'], text: 'Der eine hilft dir, bei wichtigen Punkten ruhig zu bleiben. Der andere zeigt dir auf Video, wie dein nächster Gegner spielt.' },
};

// ---------------------------------------------------------------
// Profi-Techniken: stärkere Arten von Schlägen, die nur sehr gute Spieler lernen können.
// ---------------------------------------------------------------
//   braucht   = so gut muss die Fähigkeit schon sein
//   aufschlag / schlag = bei welcher Aufschlag- oder Schlagart es wirkt
//   nur       = 'fh': nur mit der Vorhand, 'bh': nur mit der Rückhand
//   mal       = diese Zahlen aus js/schlaege.js werden malgenommen
export const TECHNIKEN = {
  kick: { name: 'Profi-Kick', bild: '🌀', braucht: { s: 75 }, preis: 8000, aufschlag: 'kick', mal: { drall: 1.3, top: 1.15 },
    text: 'Dein Kick-Aufschlag springt noch höher und weiter zur Seite weg.' },
  peitsche: { name: 'Peitschen-Vorhand', bild: '⚡', braucht: { vh: 78 }, preis: 12000, schlag: 'topspin', nur: 'fh', mal: { top: 1.25, tempo: 1.06 },
    text: 'Der hohe Topspin mit der Vorhand bekommt noch mehr Drall und Tempo – der Ball springt dem Gegner über die Schulter.' },
  messer: { name: 'Messer-Slice', bild: '🔪', braucht: { rh: 72 }, preis: 6000, schlag: 'slice', mal: { top: 1.3, streu: 0.85 },
    text: 'Dein Slice rutscht flacher weg und landet genauer.' },
  zauber: { name: 'Zauber-Stopp', bild: '🪄', braucht: { k: 75 }, preis: 6000, schlag: 'drop', mal: { top: 1.25, streu: 0.75 },
    text: 'Dein Stoppball landet genauer und bleibt fast liegen.' },
};

// ---------------------------------------------------------------
// Rechnen
// ---------------------------------------------------------------
const alleStufen = (id) => (BEREICHE[id] ? BEREICHE[id].stufen : SPEZIAL[id] ? TRAINER_STUFEN : null);
// Welche Stufe hast du in diesem Bereich? (0 = noch nichts)
export const stufe = (c, id) => (c.ausbau && c.ausbau[id]) || 0;

// Darfst du die nächste Stufe kaufen? { ok, warum, naechste }
export function kannKaufen(c, id, platz) {
  const liste = alleStufen(id), n = liste && liste[stufe(c, id)];
  if (!n) return { ok: false, warum: 'Mehr geht nicht – du hast schon die beste Stufe.', naechste: null };
  if (platz > n.abPlatz) return { ok: false, warum: `Erst ab Platz ${n.abPlatz} der Weltrangliste.`, naechste: n };
  if (c.money < n.preis) return { ok: false, warum: 'Dafür reicht dein Geld noch nicht.', naechste: n };
  return { ok: true, warum: '', naechste: n };
}
export function kaufen(c, id, platz) {
  const k = kannKaufen(c, id, platz);
  if (!k.ok) return false;
  c.money -= k.naechste.preis;
  c.ausbau = c.ausbau || {};
  c.ausbau[id] = stufe(c, id) + 1;
  return true;
}

// Alle Pluspunkte aus dem Profi-Service: [{ name, bonus }]
export function ausbauBonus(c) {
  const out = [];
  for (const id in BEREICHE) {
    const bonus = {};
    for (const s of BEREICHE[id].stufen.slice(0, stufe(c, id))) for (const k in s.bonus || {}) bonus[k] = (bonus[k] || 0) + s.bonus[k];
    if (Object.keys(bonus).length) out.push({ name: BEREICHE[id].name, bonus });
  }
  return out;
}
// So viele Matches hält eine Bespannung länger
export const saitenPlus = (c) => BEREICHE.bespanner.stufen.slice(0, stufe(c, 'bespanner')).reduce((x, s) => x + (s.saiten || 0), 0);
// Ärzte: { risiko, heilung } – beides Zahlen zum Malnehmen (1 = keine Hilfe)
export function aerzte(c) {
  let risiko = 1, heilung = 1;
  for (const s of BEREICHE.arzt.stufen.slice(0, stufe(c, 'arzt'))) { risiko *= s.risiko || 1; heilung *= s.heilung || 1; }
  return { risiko, heilung };
}
// Bis zu welchem Wert darfst du diese Fähigkeit steigern?
export function grenze(c, key) {
  const id = Object.keys(SPEZIAL).find((t) => SPEZIAL[t].fuer.includes(key));
  const n = id ? stufe(c, id) : 0;
  return n ? TRAINER_STUFEN[n - 1].grenze : GRENZE_OHNE;
}

// Profi-Techniken
export function kannLernen(c, id) {
  const T = TECHNIKEN[id];
  if (!T) return { ok: false, warum: '' };
  if ((c.techniken || []).includes(id)) return { ok: false, warum: 'Kannst du schon.', gelernt: true };
  for (const k in T.braucht) if (c.skills[k] < T.braucht[k]) return { ok: false, warum: 'braucht', key: k, wert: T.braucht[k] };
  if (c.money < T.preis) return { ok: false, warum: 'Dafür reicht dein Geld noch nicht.' };
  return { ok: true, warum: '' };
}
export function lernen(c, id) {
  if (!kannLernen(c, id).ok) return false;
  c.money -= TECHNIKEN[id].preis;
  c.techniken = [...(c.techniken || []), id];
  return true;
}
// Was das Match über deine Techniken wissen muss: { aufschlag: { kick: { mal } }, schlag: { topspin: { nur, mal } } }
export function technikWerte(c) {
  const out = { aufschlag: {}, schlag: {} };
  for (const id of c.techniken || []) {
    const T = TECHNIKEN[id];
    if (!T) continue;
    if (T.aufschlag) out.aufschlag[T.aufschlag] = { mal: T.mal };
    if (T.schlag) out.schlag[T.schlag] = { nur: T.nur || null, mal: T.mal };
  }
  return out;
}

// ---------------------------------------------------------------
// Der Körper: Beschwerden und Verletzungen
// ---------------------------------------------------------------
// So läuft es:
//   1. Wer müde spielt oder viele Wochen ohne Pause, bekommt irgendwann BESCHWERDEN (z. B. die Schulter zwickt).
//      Das ist eine Warnung: Eine Fähigkeit ist etwas schwächer. Eine Woche Pause oder ein Besuch beim Physio heilt sie.
//   2. Wer mit Beschwerden einfach weiterspielt, riskiert eine echte VERLETZUNG. Je mehr Fehler zusammenkommen
//      (Beschwerden ignoriert, müde, keine Pause), desto länger fällt man aus – und rutscht in der Rangliste ab,
//      weil die alten Punkte wegfallen und keine neuen dazukommen.
export const KOERPER = [
  { teil: 'Schulter', trifft: 's', leicht: 'Die Schulter zwickt beim Aufschlag.', schwer: 'Entzündung in der Schulter' },
  { teil: 'Handgelenk', trifft: 'vh', leicht: 'Das Handgelenk schmerzt bei der Vorhand.', schwer: 'Überlastetes Handgelenk' },
  { teil: 'Ellbogen', trifft: 'rh', leicht: 'Der Ellbogen tut bei der Rückhand weh.', schwer: 'Tennisarm (entzündeter Ellbogen)' },
  { teil: 'Knie', trifft: 'b', leicht: 'Das Knie meldet sich beim Abstoppen.', schwer: 'Gereizte Sehne im Knie' },
  { teil: 'Oberschenkel', trifft: 'b', leicht: 'Der Oberschenkel fühlt sich hart an.', schwer: 'Muskelfaserriss im Oberschenkel' },
  { teil: 'Rücken', trifft: 's', leicht: 'Der Rücken ist steif.', schwer: 'Blockade im Rücken' },
];
export const BESCHWERDEN_ABZUG = 3;       // so viele Punkte fehlen der Fähigkeit bei Beschwerden
export const MUEDE = 50, SEHR_MUEDE = 30; // Frische: darunter wird es gefährlich
export const SERIE_LANG = 6;              // so viele Turnierwochen am Stück sind zu viel
const AUSFALL_WOCHEN = [3, 5, 8, 12];     // Dauer einer Verletzung – je nachdem, wie viele Fehler zusammenkamen (0 bis 3)

// Nach einer Turnierwoche: Was sagt der Körper?
//   lage = { matches, tiefFrische (niedrigste Frische der Woche), serie (Turnierwochen am Stück), physio (0 bis 3), zufall }
// Ändert c.koerper (Beschwerden) und c.verletzung. Gibt zurück, was passiert ist: { beschwerden } oder { verletzung } oder {}.
export function koerperWoche(c, lage) {
  if (!lage.matches) return {};
  const rnd = lage.zufall || Math.random;
  const muede = lage.tiefFrische < MUEDE, sehr = lage.tiefFrische < SEHR_MUEDE, serie = lage.serie >= SERIE_LANG;
  const schutz = aerzte(c).risiko * [1, 1, 0.85, 0.7][lage.physio || 0];
  if (!c.koerper) {
    // Noch alles gut. Kommt eine Warnung?
    const p = (0.02 + (muede ? 0.06 : 0) + (sehr ? 0.1 : 0) + (serie ? 0.05 : 0) + (lage.matches >= 5 ? 0.02 : 0)) * schutz;
    if (rnd() >= p) return {};
    const K = KOERPER[Math.floor(rnd() * KOERPER.length)];
    c.koerper = { teil: K.teil, wochen: 0 };
    return { beschwerden: K };
  }
  // Du hast mit Beschwerden gespielt. Das kann schiefgehen.
  const K = KOERPER.find((k) => k.teil === c.koerper.teil) || KOERPER[0];
  c.koerper.wochen++;
  const p = (0.07 + (muede ? 0.12 : 0) + (sehr ? 0.2 : 0) + (serie ? 0.1 : 0)) * schutz;
  if (rnd() >= p) return {};
  const fehler = [`Du hattest schon Beschwerden (${K.teil}) und hast trotzdem weitergespielt.`];
  if (sehr) fehler.push(`Du warst völlig erschöpft: Deine Frische lag nur noch bei ${Math.round(lage.tiefFrische)} %.`);
  else if (muede) fehler.push(`Du warst müde: Deine Frische lag nur noch bei ${Math.round(lage.tiefFrische)} %.`);
  if (serie) fehler.push(`Du hast ${lage.serie} Wochen hintereinander Turniere gespielt, ohne eine Pause.`);
  const wochen = Math.max(2, Math.round(AUSFALL_WOCHEN[Math.min(3, fehler.length - 1 + (sehr ? 1 : 0))] * aerzte(c).heilung));
  c.verletzung = { name: K.schwer, teil: K.teil, wochen, gesamt: wochen, fehler };
  c.koerper = null;
  return { verletzung: c.verletzung };
}
// Eine Woche ohne Turnier oder ein Besuch beim Physio: Beschwerden sind weg. Gibt true zurück, wenn es welche gab.
export function ausheilen(c) {
  const hatte = !!c.koerper;
  c.koerper = null;
  return hatte;
}
// Abzug durch Beschwerden als Pluspunkt-Eintrag (oder null)
export function beschwerdenAbzug(c) {
  if (!c.koerper) return null;
  const K = KOERPER.find((k) => k.teil === c.koerper.teil) || KOERPER[0];
  return { name: 'Beschwerden: ' + K.teil, bonus: { [K.trifft]: -BESCHWERDEN_ABZUG } };
}
