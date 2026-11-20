// Powershot – Profileben in der Saison: Was die Karriere kann, gibt es hier für einen Profi, der schon oben ist.
//
// In der Karriere fängst du ganz unten an und musst dir alles erst verdienen.
// In der Saison übernimmst du einen fertigen Profi. Der HAT schon alles: Trainer, Physio, Sponsoren, Fans.
// Dafür hat er etwas, das ein Anfänger nicht kennt: Alle ERWARTEN etwas von ihm.
//
//   1. Punkte verteidigen: Jedes Ergebnis vom letzten Jahr fällt weg, wenn das Turnier wieder dran ist.
//      Wer letztes Jahr im Halbfinale war und jetzt früh verliert, rutscht in der Weltrangliste ab.
//   2. Erwartung: Die Nummer 3 der Welt soll ins Halbfinale kommen. Schafft sie es nicht, schreibt die Zeitung
//      böse Sätze, der Medien-Druck steigt und das Selbstvertrauen sinkt.
//   3. Sponsoren: Sie zahlen viel Geld und geben dir drei Ziele für das Jahr. Wer sie schafft, bekommt Prämien.
//   4. Rivalen: Zwei Spieler stehen in der Rangliste direkt neben dir. Gegen die zählt jedes Match doppelt.
//   5. Körper: Frische, Beschwerden und Verletzungen wie in der Karriere (ausbau.js).
//   6. Zwischen den Turnieren: Pause, Trainingsblock, Sponsoren-Termin … (Liste ZWISCHEN).
//   7. Der Tag vor dem Match auf der Anlage (turniertag.js) – genau wie in der Karriere.
//
// Diese Datei rechnet nur (kein three.js). Alles liegt im Spielstand der Saison: s.profi, s.vorjahr, s.rest.
//
// Was ist echt, was ausgedacht?
//   echt:       die Regel mit dem Verteidigen der Punkte, die Punkte pro Runde, die Marken-Namen
//   ausgedacht: die Ergebnisse des Vorjahres (der Computer spielt das Vorjahr einmal durch, passend zu den echten Punkten),
//               welche Marke dein Profi hat (das suchst du selbst aus), alle Zahlen für Geld, Druck und Selbstvertrauen

import { PLAYERS, TOURNAMENTS, playerById, tournamentById } from './data.js';
import { createTournament, payout, simulateRest } from './tournament.js';
import { STAT_NAMES } from './faehigkeiten.js';
import { TRAINER, PHYSIOS, REISEN, VERTRAGS_STUFEN, GELDGEBER, FAN_PROZENT, FAN_MAX } from './ausruestung.js';
import { koerperWoche, ausheilen, beschwerdenAbzug } from './ausbau.js';
import { WOCHEN, wocheVon, zweiWochen } from './kalender.js';
import { KLEINE_TURNIERE } from './kleinetour.js';
import { addXp, frischeAbzug, istPflicht } from './career.js';
import * as SE from './season.js';

const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));
const geldText = (n) => Math.round(n).toLocaleString('de-DE') + ' $';

// ---------------------------------------------------------------
// Zahlen zum Einstellen (alle geschätzt)
// ---------------------------------------------------------------
export const MUT_MAX = 3;             // Selbstvertrauen geht von −3 bis +3
export const DRUCK_START = 30;        // Medien-Druck am Anfang des Jahres (0 bis 100)
export const DRUCK_HOCH = 60, DRUCK_SEHR_HOCH = 80;   // ab hier kostet der Druck Mental-Punkte
export const PLUS_MAX = 4;            // so viel kann ein fertiger Profi eine Fähigkeit noch verbessern
export const PLUS_KOSTET = 4;         // so viele Fähigkeitspunkte kostet +1 (ein Profi lernt langsamer dazu als ein Anfänger)
export const REISE_GRUND = 4000;      // Flug, Hotel und Essen für ein Turnier bei Reise-Art „Normal“
export const MATCH_KOSTET = 3.4;      // ein Match bei den ganz großen Turnieren kostet so viel mal mehr Frische als in der Karriere (lange Matches, starke Gegner)
const RUHETAG = 0.6;                  // bei Turnieren über zwei Wochen kostet ein Match weniger Frische
const FOTOS_MAX = 6;                  // so viele Siegerfotos werden aufgehoben
const ZEITUNG_MAX = 30;               // so viele Zeitungsmeldungen werden aufgehoben

// Womit startet ein Profi? Je weiter vorn, desto größer das Team und das Konto. [bis Platz, Geld, Trainer, Physio, Reise, Ärzte-Stufe]
const START = [
  [10, 3000000, 't4', 'p3', 'business', 3],
  [30, 1000000, 't3', 'p3', 'business', 2],
  [100, 300000, 't3', 'p2', 'normal', 1],
  [999, 80000, 't2', 'p1', 'normal', 0],
];

// Reihenfolge der Ergebnisse, vom schlechtesten zum besten (zum Vergleichen)
const STUFEN_KO = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F', 'W'];
const STUFEN_FINALS = ['RR', 'SF', 'F', 'W'];
const stufen = (def) => (def.cat === 'F' ? STUFEN_FINALS : STUFEN_KO.filter((l) => def.points[l] != null));
export const RUNDE_TEXT = { W: 'den Titel', F: 'das Finale', SF: 'das Halbfinale', QF: 'das Viertelfinale', R16: 'das Achtelfinale', R32: 'die Runde der 32', R64: 'die Runde der 64', R128: 'die erste Runde', RR: 'die Gruppenphase' };

// ---------------------------------------------------------------
// Das Vorjahr und die Weltrangliste
// ---------------------------------------------------------------

// Der Computer spielt das letzte Jahr einmal durch. Danach werden die Ergebnisse so weit verkleinert,
// dass kein Spieler mehr Punkte hat als in der echten Rangliste. Der Rest seiner echten Punkte
// (s.rest) stammt von kleineren Turnieren. Der fällt im Lauf des Jahres nach und nach weg (restWeg) –
// dafür kommen die neuen Punkte von den kleinen Turnieren dieses Jahres dazu.
function vorjahrAusrechnen(s) {
  s.vorjahr = {}; s.rest = {}; s.vorjahrSieger = {};
  for (const p of PLAYERS) s.vorjahr[p.id] = {};
  for (const def of TOURNAMENTS) {
    const feld = PLAYERS.slice(0, def.draw);
    const T = createTournament(def, feld, null);
    simulateRest(T);
    for (const p of feld) s.vorjahr[p.id][def.id] = payout(T, p.id).points;
    s.vorjahrSieger[def.id] = T.champion;
  }
  for (const p of PLAYERS) {
    const v = s.vorjahr[p.id];
    let summe = Object.values(v).reduce((a, b) => a + b, 0), wache = 0;
    while (summe > p.basePoints && wache++ < 200) {
      // Das beste Ergebnis eine Runde schlechter machen. Turniersiege bleiben, solange es geht – sonst hätte ein Turnier keinen Titelverteidiger.
      const sieg = (id) => (s.vorjahrSieger[id] === p.id ? 1 : 0);
      const tid = Object.keys(v).filter((id) => v[id] > 0).sort((a, b) => sieg(a) - sieg(b) || v[b] - v[a])[0];
      if (!tid) break;
      const def = tournamentById(tid);
      const werte = def.cat === 'F' ? [0, 200, 400, 600, 1000, 1500] : [0, ...new Set(Object.values(def.points))].sort((a, b) => a - b);
      const kleiner = werte.filter((w) => w < v[tid]).pop() ?? 0;
      summe -= v[tid] - kleiner;
      v[tid] = kleiner;
      if (s.vorjahrSieger[tid] === p.id && kleiner < (def.cat === 'F' ? 1 : def.points.W)) s.vorjahrSieger[tid] = null;
    }
    s.rest[p.id] = Math.max(0, p.basePoints - summe);
  }
}

// Die Weltrangliste: Punkte der letzten 52 Wochen. Für jedes Turnier zählt das neue Ergebnis, sobald es in diesem
// Jahr gespielt ist – vorher zählt noch das vom letzten Jahr. Bei den kleinen Turnieren geht das einfacher:
// Die alten Punkte (s.rest) schmelzen von Woche zu Woche, die neuen zählen sofort.
// Jeder Eintrag: { id, name, short, country, points, rank, me, ref }
export function weltTabelle(s) {
  const gespielt = new Set(TOURNAMENTS.slice(0, s.week).map((t) => t.id)), bleibt = 1 - restWeg(s);
  const list = PLAYERS.map((p) => {
    const race = s.race[p.id] || {};
    let points = Math.round((s.rest[p.id] || 0) * bleibt);
    for (const t of TOURNAMENTS) points += gespielt.has(t.id) ? (race[t.id] || 0) : ((s.vorjahr[p.id] || {})[t.id] || 0);
    for (const k in race) if (!GROSS_IDS.has(k)) points += race[k];
    return { id: p.id, name: p.name, short: p.short, country: p.country, points, start: p.rank, me: p.id === s.playerId, ref: p };
  });
  list.sort((a, b) => b.points - a.points || a.start - b.start);
  list.forEach((p, i) => { p.rank = i + 1; });
  return list;
}
export const weltPlatz = (s) => weltTabelle(s).find((p) => p.me).rank;

// Was hast du bei diesem Turnier letztes Jahr geholt? { punkte, label, titel }
export function verteidigen(s, def) {
  const punkte = (s.vorjahr[s.playerId] || {})[def.id] || 0;
  const titel = punkte > 0 && (s.vorjahrSieger || {})[def.id] === s.playerId;
  let label = null;
  if (titel) label = 'W';
  else if (def.cat === 'F') label = punkte >= 1000 ? 'F' : punkte >= 600 ? 'SF' : punkte > 0 ? 'RR' : null;     // bei den Finals nur ungefähr: Dort gibt es Punkte pro Sieg
  else if (punkte) label = STUFEN_KO.slice().reverse().find((l) => l !== 'W' && def.points[l] === punkte) || null;
  return { punkte, label, titel };
}

// ---------------------------------------------------------------
// Einrichten: ein neuer oder alter Spielstand bekommt das Profileben
// ---------------------------------------------------------------
const leerePlus = () => Object.fromEntries(Object.keys(STAT_NAMES).map((k) => [k, 0]));

export function einrichten(s) {
  if (!s.vorjahr || !s.rest) vorjahrAusrechnen(s);
  if (!s.profi) {
    const platz = weltPlatz(s);
    const [, geld, trainer, physio, reise, arzt] = START.find((z) => platz <= z[0]);
    s.profi = {
      saison: true, money: geld, frische: 100, xp: 0, level: 1, skillPoints: 0, plus: leerePlus(),
      trainer, physio, reise, ausbau: { arzt }, vertrag: { schlaeger: null, kleidung: null },
      koerper: null, verletzung: null, serie: 0, matchesTurnier: 0, tiefFrische: 100,
      tag: null, abend: null, abendOffen: false, tagFans: Math.max(0, 6 - Math.floor(platz / 15)), autogramme: 0, redeFans: 0,
      mut: 0, druck: DRUCK_START, gunst: 60, siege: 0, niederlagen: 0,
      rivalen: [], h2h: {}, zeitung: [], ziele: [], pokale: [],
      block: null, studium: false, kw: 0, plan: {},
      bilanz: { preis: 0, sponsor: 0, praemie: 0, team: 0, reise: 0 },
      startPlatz: platz,
    };
    neuesJahr(s);
    melden(s, 'info', `${s.year}: ${SE.seasonPlayer(s).name} startet als Nummer ${platz} der Welt`, 'Trainer, Physio und Sponsoren stehen bereit. Die Fans sind gespannt, was dieses Jahr geht.');
  }
  // Alte Spielstände kannten noch keine Wochen: Sie machen beim nächsten großen Turnier weiter.
  const P = s.profi;
  if (P.kw == null) { const next = s.tournament ? tournamentById(s.tournament.defId) : SE.nextTournament(s); P.kw = next ? wocheVon(next.id) : LETZTE_WOCHE + 1; }
  if (!P.plan) P.plan = {};
  delete P.zwischen;
  // Der Tag auf der Anlage (turniertag.js) speichert über diese Funktion. Sie steht nicht im Spielstand (nicht aufzählbar).
  Object.defineProperty(s.profi, 'sichern', { value: () => SE.saveSeason(s), enumerable: false, configurable: true });
  return s;
}

// Zum Jahresanfang: neue Rivalen, neue Ziele
function neuesJahr(s) {
  const P = s.profi, welt = weltTabelle(s), ich = welt.find((p) => p.me);
  P.startPlatz = ich.rank;
  // Rivalen: der direkt vor dir und der direkt hinter dir (die Nummer 1 bekommt die 2 und die 3)
  // und der Letzte der Liste die zwei vor ihm
  const davor = welt[ich.rank - 2], dahinter = welt[ich.rank];
  P.rivalen = (!davor ? [dahinter, welt[ich.rank + 1]] : !dahinter ? [davor, welt[ich.rank - 3]] : [davor, dahinter]).map((p) => p.id);
  P.ziele = zieleFuer(s, ich.rank);
  P.bilanz = { preis: 0, sponsor: 0, praemie: 0, team: 0, reise: 0 };
  P.jahrSiege = 0; P.bestes = null;
  P.gefehlt = 0; P.n500 = 0; P.turniere = 0; P.termine = 0; P.kindertage = 0; P.kleine = []; P.getan = {};
}

// ---------------------------------------------------------------
// Ziele der Sponsoren (drei pro Jahr, je nach Platz)
// ---------------------------------------------------------------
// art: 'finals' | 'race' (n = Platz) | 'titel' (gross: nur Grand Slam) | 'runde' (label) | 'siege' (n) | 'rivale' (id)
function zieleFuer(s, platz) {
  const stufe = sponsorStufe(platz), grund = Math.max(20000, VERTRAGS_STUFEN[stufe].geld * 6);
  const ziele = [];
  if (platz <= 12) ziele.push({ art: 'finals', text: 'Qualifiziere dich für die ATP Finals', geld: grund * 2 });
  else {
    const n = platz <= 40 ? 20 : platz <= 80 ? 50 : 100;
    ziele.push({ art: 'race', n, text: `Beende das Jahr unter den besten ${n} im ATP Race`, geld: grund * 2 });
  }
  if (platz <= 3) ziele.push({ art: 'titel', gross: true, text: 'Gewinne einen Grand Slam', geld: grund * 4 });
  else if (platz <= 10) ziele.push({ art: 'titel', text: 'Gewinne ein großes Turnier (Grand Slam oder Masters)', geld: grund * 3 });
  else if (platz <= 30) ziele.push({ art: 'runde', label: 'SF', text: 'Erreiche bei einem Turnier das Halbfinale', geld: grund * 2 });
  else if (platz <= 80) ziele.push({ art: 'runde', label: 'QF', text: 'Erreiche bei einem Turnier das Viertelfinale', geld: grund * 2 });
  else ziele.push({ art: 'siege', n: 6, text: 'Gewinne in diesem Jahr 6 Matches', geld: grund * 2 });
  const rivale = playerById(s.profi.rivalen[0]);
  if (rivale) ziele.push({ art: 'rivale', id: rivale.id, text: `Stehe am Jahresende in der Weltrangliste vor ${rivale.name}`, geld: grund });
  return ziele;
}

// Wie steht es um ein Ziel? { ok, stand } – stand ist ein kurzer Satz für die Anzeige
export function zielStand(s, z) {
  const P = s.profi;
  if (z.art === 'finals') {
    // Geschafft, wenn du bei den ATP Finals mitspielst. Vorher zählt, ob du gerade unter den besten 8 stehst.
    const gespielt = s.history.find((h) => h.tid === 'fin');
    const laeuft = s.tournament && s.tournament.defId === 'fin';
    const ok = gespielt ? !!gespielt.label : laeuft ? !!s.tournament.humanId : SE.qualified(s);
    return { ok, stand: `Race: Platz ${SE.myRace(s).rank}` };
  }
  if (z.art === 'race') { const r = SE.myRace(s); return { ok: r.rank <= z.n && r.points > 0, stand: `Race: Platz ${r.rank}` }; }
  if (z.art === 'titel') {
    const n = s.history.filter((h) => h.label === 'W' && (!z.gross || tournamentById(h.tid).cat === 'GS')).length;
    return { ok: n > 0, stand: n ? '🏆 geschafft' : 'noch kein Titel' };
  }
  if (z.art === 'runde') {
    const ok = s.history.some((h) => h.label && STUFEN_KO.indexOf(h.label) >= STUFEN_KO.indexOf(z.label) && h.tid !== 'fin');
    return { ok, stand: P.bestes ? `bisher am weitesten: ${RUNDE_TEXT[P.bestes]}` : 'noch kein Ergebnis' };
  }
  if (z.art === 'siege') return { ok: (P.jahrSiege || 0) >= z.n, stand: `${P.jahrSiege || 0} von ${z.n} Siegen` };
  if (z.art === 'rivale') {
    const welt = weltTabelle(s), ich = welt.find((p) => p.me), er = welt.find((p) => p.id === z.id);
    return { ok: !!er && ich.rank < er.rank, stand: er ? `du: Platz ${ich.rank} · er: Platz ${er.rank}` : '' };
  }
  return { ok: false, stand: '' };
}

// ---------------------------------------------------------------
// Sponsoren, Team, Reisen
// ---------------------------------------------------------------
// Welche Vertrags-Stufe hat ein Spieler auf diesem Platz? (Liste VERTRAGS_STUFEN in ausruestung.js)
export function sponsorStufe(platz) {
  let stufe = 0;
  VERTRAGS_STUFEN.forEach((v, i) => { if (platz <= v.bisPlatz) stufe = i; });
  return stufe;
}
// Fan-Sterne: Autogramme, Presse, Reden – und Titel
export const fans = (s) => Math.min(FAN_MAX, (s.profi.tagFans || 0) + (s.profi.redeFans || 0) + s.titles * 2);
// So zufrieden sind die Sponsoren (gunst 0 bis 100): 0 = sie zahlen nur 60 %, 100 = sie zahlen 140 %
export const gunstMal = (s) => 0.6 + 0.8 * s.profi.gunst / 100;

// Was zahlen die Sponsoren für ein Turnier? { posten: [{ name, geld }], summe }
export function sponsorGeld(s, platz = weltPlatz(s)) {
  const P = s.profi, S = VERTRAGS_STUFEN[sponsorStufe(platz)], posten = [];
  const mal = gunstMal(s) * (1 + fans(s) * FAN_PROZENT / 100);
  if (S.geld && P.vertrag.schlaeger) posten.push({ name: `${P.vertrag.schlaeger} (${S.name})`, geld: Math.round(S.geld * mal) });
  if (S.geld && P.vertrag.kleidung) posten.push({ name: `${P.vertrag.kleidung} (${S.name})`, geld: Math.round(S.geld * mal) });
  // Die Geldgeber mit dem Aufnäher auf dem Hemd (erfunden): Ein Profi hat alle, für die sein Platz reicht
  for (const g of GELDGEBER) if (g.wenn.platz && platz <= g.wenn.platz) posten.push({ name: g.name, geld: Math.round(g.geld * mal) });
  return { posten, summe: posten.reduce((a, p) => a + p.geld, 0) };
}
export function setVertrag(s, art, marke) { s.profi.vertrag[art] = marke || null; SE.saveSeason(s); }

export const meinTrainer = (s) => TRAINER.find((t) => t.id === s.profi.trainer) || TRAINER[0];
export const meinPhysio = (s) => PHYSIOS.find((p) => p.id === s.profi.physio) || PHYSIOS[0];
export function setTeam(s, id) {
  if (TRAINER.some((t) => t.id === id)) s.profi.trainer = id;
  if (PHYSIOS.some((p) => p.id === id)) s.profi.physio = id;
  SE.saveSeason(s);
}
export function setReise(s, art) { if (REISEN[art]) { s.profi.reise = art; SE.saveSeason(s); } }
// Was kostet ein Turnier? { team, reise, summe }
export function kosten(s) {
  const R = REISEN[s.profi.reise] || REISEN.normal;
  const team = meinTrainer(s).lohn + meinPhysio(s).lohn, reise = R.fest || Math.round(REISE_GRUND * R.mal);
  return { team, reise, summe: team + reise };
}

// ---------------------------------------------------------------
// Erwartung: Wie weit „muss“ dein Profi bei diesem Turnier kommen?
// ---------------------------------------------------------------
export function erwartung(s, def, platz = weltPlatz(s)) {
  let label;
  if (def.cat === 'F') label = platz <= 4 ? 'SF' : 'RR';
  else {
    label = platz <= 1 ? 'F' : platz <= 4 ? 'SF' : platz <= 8 ? 'QF' : platz <= 16 ? 'R16' : platz <= 32 ? 'R32' : platz <= 64 ? 'R64' : 'R128';
    const S = stufen(def);
    if (!S.includes(label)) label = S[0];
  }
  const ohne = label === stufen(def)[0];      // die unterste Stufe: Da gibt es nichts zu verlieren
  return { label, text: ohne ? 'Hier erwartet niemand etwas von dir. Jeder Sieg ist ein Geschenk.' : `Alle erwarten von dir: mindestens ${RUNDE_TEXT[label]}.` };
}
// Um wie viele Runden besser (+) oder schlechter (−) als erwartet?
const abstand = (def, label, erwartet) => stufen(def).indexOf(label) - stufen(def).indexOf(erwartet);

// ---------------------------------------------------------------
// Die Zeitung
// ---------------------------------------------------------------
// art: 'gut' | 'schlecht' | 'info' | 'rivale'
function melden(s, art, kopf, text) {
  const P = s.profi;
  P.zeitung.unshift({ art, kopf, text, jahr: s.year, nr: s.week });
  if (P.zeitung.length > ZEITUNG_MAX) P.zeitung.length = ZEITUNG_MAX;
}
// „bei den US Open“, „in Wimbledon“, „beim Rom Masters“ – und „die US Open“, „das Rom Masters“ (damit die Sätze richtig klingen)
const BEI = { ao: 'bei den Australian Open', uso: 'bei den US Open', fin: 'bei den ATP Finals', wim: 'in Wimbledon', rg: 'bei Roland Garros', iw: 'in Indian Wells' };
const DEN = { ao: 'die Australian Open', uso: 'die US Open', fin: 'die ATP Finals', wim: 'Wimbledon', rg: 'Roland Garros', iw: 'Indian Wells' };
export const bei = (def) => BEI[def.id] || 'beim ' + def.name;
export const den = (def) => DEN[def.id] || 'das ' + def.name;
const gross = (text) => text[0].toUpperCase() + text.slice(1);
const einer = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ---------------------------------------------------------------
// Dein Profi im Match: seine echten Werte plus alles, was gerade wirkt
// ---------------------------------------------------------------
// Alle Plus- und Minuspunkte einzeln (für die Anzeige): [{ name, bonus }]. gegner = id des Gegners (oder null)
export function bonusListe(s, def, gegner = null) {
  const P = s.profi, out = [];
  if (Object.values(P.plus).some((n) => n)) out.push({ name: 'Dazugelernt', bonus: Object.fromEntries(Object.entries(P.plus).filter(([, n]) => n)) });
  if (P.block) out.push({ name: 'Trainingsblock', bonus: { [P.block.key]: P.block.plus } });
  if (P.mut) out.push({ name: P.mut > 0 ? 'Selbstvertrauen' : 'Wenig Selbstvertrauen', bonus: { m: P.mut, c: Math.trunc(P.mut / 2) } });
  if (P.druck >= DRUCK_HOCH) out.push({ name: 'Medien-Druck', bonus: { m: P.druck >= DRUCK_SEHR_HOCH ? -2 : -1 } });
  if (gegner) {
    const b = P.h2h[gegner] || [0, 0], d = begrenzen(b[0] - b[1], -2, 2);
    if (d) out.push({ name: d > 0 ? 'Lieblingsgegner' : 'Angstgegner', bonus: { m: d } });
    if (P.studium && (P.rivalen.includes(gegner) || playerById(gegner).rank <= 10)) out.push({ name: 'Gegner auf Video studiert', bonus: { k: 2 } });
  }
  const weh = beschwerdenAbzug(P);
  if (weh) out.push(weh);
  if (P.tag && Object.keys(P.tag.bonus || {}).length) out.push({ name: 'Heute auf der Anlage', bonus: P.tag.bonus });
  if (P.abend && P.abend.bonus) out.push({ name: 'Gestern Abend', bonus: P.abend.bonus });
  const f = frischeAbzug(P.frische);
  if (Object.keys(f).length) out.push({ name: P.frische >= 95 ? 'Topfit' : 'Müde', bonus: f });
  return out;
}
// Der Spieler in der Form, die das Match braucht (Tempo zählt zur Beinarbeit, Kraft und Präzision stehen extra dabei – wie in der Karriere)
export function spieler(s, def, gegner = null) {
  const p = SE.seasonPlayer(s);
  const st = { ...p.stats, kraft: 0, praez: 0 }, ziel = { t: 'b', p: 'kraft', c: 'praez' };
  for (const e of bonusListe(s, def, gegner)) for (const k in e.bonus) st[ziel[k] || k] = (st[ziel[k] || k] || 0) + e.bonus[k];
  for (const k in STAT_NAMES) st[k] = begrenzen(st[k], 1, 99);
  const look = { ...p.look };
  if (def && def.id === 'wim') { look.shirt = 0xffffff; look.shorts = 0xffffff; look.trim = 0xffffff; }   // Wimbledon: alles in Weiß
  return { ...p, stats: st, look };
}

// Eine Fähigkeit verbessern (kostet PLUS_KOSTET Fähigkeitspunkte, höchstens PLUS_MAX pro Fähigkeit)
export function steigern(s, key) {
  const P = s.profi, p = SE.seasonPlayer(s);
  if (P.skillPoints < PLUS_KOSTET || P.plus[key] >= PLUS_MAX || p.stats[key] + P.plus[key] >= 99) return false;
  P.plus[key]++;
  P.skillPoints -= PLUS_KOSTET;
  SE.saveSeason(s);
  return true;
}

// ---------------------------------------------------------------
// Der Kalender der Saison: 14 große Turniere und dazwischen freie Wochen mit kleinen Turnieren
// ---------------------------------------------------------------
// Die Saison läuft Woche für Woche (P.kw = Nummer der Woche im Kalender, kalender.js). In einer freien Woche
// kann dein Profi ein kleines Turnier spielen (ATP 500, ATP 250, weiter hinten auch Challenger) oder etwas anderes tun.
// Alle anderen Profis spielen in diesen Wochen auch – sonst wäre das ATP Race unfair.
const GROSS_IDS = new Set(TOURNAMENTS.map((t) => t.id));
const LETZTE_WOCHE = wocheVon('fin');
export const FREIE_WOCHEN = WOCHEN.filter((w) => !w.gross && !w.zweite && !w.off && w.nr < LETZTE_WOCHE).map((w) => w.nr);
const istFrei = (kw) => FREIE_WOCHEN.includes(kw);
const dauer = (def) => (zweiWochen(def.id) ? 2 : 1);
// So viel Frische kommt in einer Woche ohne Turnier zurück (ein guter Physio hilft) – und gleich nach einem Turnier nur die Hälfte davon
export const erholung = (s) => 8 + meinPhysio(s).erholung * 0.2;
export const ERHOLUNG_NACH = 0.25;
// Massage und früh schlafen helfen für den nächsten Tag. Aber die Müdigkeit eines Turniers geht davon nicht ganz weg:
// Mindestens dieser Anteil der Match-Belastung bleibt bis zum Ende des Turniers in den Beinen.
export const LAST_BLEIBT = 0.6;
const LAST_PLAN = 0.7;                // damit rechnet der Saison-Planer (nicht jeder geht jeden Tag zur Massage)
export const KLEIN_GELD = { A500: 0.5, A250: 0.3, CH: 0.1 };   // so viel zahlen die Sponsoren bei kleinen Turnieren (1 = wie bei einem großen)
// Wie oft spielt ein anderer Profi in einer freien Woche ein kleines Turnier? (geschätzt: Die Besten spielen seltener)
// Wer bei den kleinen Turnieren schon mehr Punkte hat als letztes Jahr um diese Zeit, macht meistens Pause (SATT) –
// so bleibt die Weltrangliste im Gleichgewicht, und die Besten spielen nur wenige kleine Turniere, wie in echt.
const SPIELT = (platz) => (platz <= 10 ? 0.28 : platz <= 30 ? 0.5 : 0.8);
const SATT = 0.08;
// Pflicht für die besten 30 (echte ATP-Regel): mindestens 4 ATP-500-Turniere im Jahr
export const REGEL_500 = { bisPlatz: 30, zahl: 4, strafe: 30000 };
export const TERMINE_MAX = 4, KINDERTAGE_MAX = 3;      // so oft im Jahr gehen Sponsoren-Termin und Tennistag für Kinder

// Die kleinen Turniere einer Woche, die für dich in Frage kommen (größtes zuerst). Von den Challengern nur das größte.
export function kleineDerWoche(kw) {
  const alle = KLEINE_TURNIERE.filter((t) => t.woche === kw);
  const atp = alle.filter((t) => t.cat === 'A500' || t.cat === 'A250'), ch = alle.filter((t) => t.cat === 'CH').sort((a, b) => b.points.W - a.points.W);
  return [...atp, ...ch.slice(0, 1)].sort((a, b) => b.points.W - a.points.W);
}
// Darfst du dort mitspielen? Für ein ATP 500 muss man weit vorn stehen. Challenger sind umgekehrt nichts für die Besten.
export function darfSpielen(s, def, platz = weltPlatz(s)) {
  if (platz > def.bisPlatz) return { ok: false, warum: `erst ab Platz ${def.bisPlatz}` };
  if (def.abPlatz && platz < def.abPlatz) return { ok: false, warum: `nur für Spieler hinter Platz ${def.abPlatz}` };
  return { ok: true, warum: '' };
}
// Welcher Anteil der Punkte von kleinen Turnieren aus dem Vorjahr ist schon weggefallen? (0 = noch alle da, 1 = alle weg)
export const restWeg = (s) => FREIE_WOCHEN.filter((w) => w < (s.profi ? s.profi.kw || 0 : 0)).length / FREIE_WOCHEN.length;

// Was ist gerade dran? { art: 'gross' | 'klein' | 'frei' | 'ende', kw, def, laeuft, turniere, bisGross }
export function jetzt(s) {
  const P = s.profi, next = SE.nextTournament(s);
  if (!next) return { art: 'ende', kw: P.kw };
  if (s.tournament) return { art: P.klein ? 'klein' : 'gross', def: tournamentById(s.tournament.defId), laeuft: true, kw: P.kw };
  const ziel = wocheVon(next.id);
  while (P.kw < ziel && !istFrei(P.kw)) P.kw++;
  if (P.kw >= ziel) { P.kw = ziel; return { art: 'gross', def: next, kw: ziel }; }
  return { art: 'frei', kw: P.kw, next, bisGross: ziel - P.kw, turniere: kleineDerWoche(P.kw) };
}

// So viel Frische kostet ein Match bei diesem Turnier (Ausdauer und Physio helfen; bei Turnieren über zwei Wochen ist zwischen den Matches ein Ruhetag)
export function matchLast(s, def) {
  const p = SE.seasonPlayer(s), ausdauer = 1 - (p.stats.a + s.profi.plus.a - 52) / 100;
  return (3 + meinPhysio(s).last * 0.4) * MATCH_KOSTET * (zweiWochen(def.id) ? RUHETAG : 1) * (def.klein && def.cat !== 'A500' ? 0.8 : 1) * ausdauer;
}

// --- Die anderen Profis in einer freien Woche ---
// Verteilt die Profis auf die ATP-Turniere der Woche, rechnet die Turniere aus und trägt die Punkte ins Race ein.
// meinDef = das Turnier, bei dem du selbst mitspielst (wird nicht ausgerechnet – das spielst du ja). Gibt die Felder zurück.
function weltWoche(s, kw, meinDef) {
  const atp = KLEINE_TURNIERE.filter((t) => t.woche === kw && (t.cat === 'A500' || t.cat === 'A250'));
  const felder = Object.fromEntries(atp.map((t) => [t.id, []])), dabei = new Set();
  const platz = (t) => t.draw - (meinDef && meinDef.id === t.id ? 1 : 0) - felder[t.id].length;
  // Wie viele Punkte von kleinen Turnieren hat jeder schon – und wie viele wären es nach dem Vorjahr um diese Zeit?
  const teil = (FREIE_WOCHEN.indexOf(kw) + 1) / FREIE_WOCHEN.length, fehlt = {};
  for (const p of PLAYERS) {
    let hat = 0; const race = s.race[p.id] || {};
    for (const k in race) if (!GROSS_IDS.has(k)) hat += race[k];
    fehlt[p.id] = (s.rest[p.id] || 0) * teil - hat;
  }
  for (const p of PLAYERS) {            // die Besten suchen sich zuerst ein Turnier aus
    if (p.id === s.playerId || Math.random() > (fehlt[p.id] < 0 ? SATT : SPIELT(p.rank))) continue;
    const offen = atp.filter((t) => platz(t) > 0 && p.rank <= t.bisPlatz * 1.2);
    if (!offen.length) continue;
    const lose = offen.flatMap((t) => (t.cat === 'A500' ? [t, t, t] : [t]));     // ein ATP 500 lockt mehr
    const t = lose[Math.floor(Math.random() * lose.length)];
    felder[t.id].push(p); dabei.add(p.id);
  }
  // Ist ein Feld sehr leer geblieben, rücken die Besten der Übrigen nach (wie Qualifikanten)
  for (const t of atp) for (const p of PLAYERS) {
    if (felder[t.id].length >= t.draw - (meinDef && meinDef.id === t.id ? 1 : 0)) break;
    if (p.id !== s.playerId && !dabei.has(p.id) && p.rank > 30) { felder[t.id].push(p); dabei.add(p.id); }
  }
  // Spielst du ein Challenger? Dann kommen 31 Spieler von weiter hinten dazu.
  if (meinDef && meinDef.cat === 'CH') {
    const pool = PLAYERS.filter((p) => p.id !== s.playerId && !dabei.has(p.id) && p.rank >= Math.max(60, meinDef.abPlatz || 0)).sort(() => Math.random() - 0.5).slice(0, meinDef.draw - 1);
    felder[meinDef.id] = pool;
    for (const p of pool) dabei.add(p.id);
  }
  for (const t of atp) {
    if (meinDef && meinDef.id === t.id) continue;
    const T = createTournament(t, felder[t.id].sort((a, b) => a.rank - b.rank), null);
    simulateRest(T);
    for (const p of felder[t.id]) { (s.race[p.id] = s.race[p.id] || {})[t.id] = payout(T, p.id, t).points; }
  }
  // Wer weiter hinten steht und diese Woche kein ATP-Turnier spielt, sammelt Punkte bei Challengern (die sieht man im Spiel nicht).
  // Im Schnitt kommt so über das Jahr ungefähr wieder zusammen, was er letztes Jahr bei kleinen Turnieren geholt hat.
  for (const p of PLAYERS) if (p.id !== s.playerId && !dabei.has(p.id) && p.rank > 30 && fehlt[p.id] > 0) {
    const punkte = Math.round(Math.min(fehlt[p.id], (s.rest[p.id] || 0) / FREIE_WOCHEN.length * 2.4 * Math.random()));
    if (punkte) (s.race[p.id] = s.race[p.id] || {})['c' + kw] = punkte;
  }
  return felder;
}

// ---------------------------------------------------------------
// Pflichtturniere: Was passiert, wenn man eines auslässt?
// ---------------------------------------------------------------
// Echt: Die 4 Grand Slams und 8 Masters sind für die Besten Pflicht (Monte-Carlo nicht). Wer ohne Grund fehlt, bekommt 0 Punkte
// und Geldstrafen. Im Spiel: Die Punkte vom Vorjahr sind immer weg. Das erste Mal im Jahr gibt es nur eine Verwarnung,
// danach Geldstrafen, die jedes Mal höher werden – und die Sponsoren werden immer saurer. Mit Beschwerden oder verletzt
// schreibt der Arzt ein Attest: Dann ist man entschuldigt. (Die Höhe der Strafen ist geschätzt.)
// schon = so viele Pflichtturniere hast du in diesem Jahr schon ohne Grund ausgelassen · mitAttest: null = so, wie es dir gerade geht
export function auslassFolgen(s, def, schon = s.profi.gefehlt || 0, mitAttest = null) {
  const P = s.profi, pflicht = istPflicht(def);
  if (!pflicht) return { pflicht: false, strafe: 0, gunst: 0, druck: 0, text: 'Kein Pflichtturnier: Du verlierst nur die Punkte vom letzten Jahr.' };
  if (mitAttest ?? !!(P.verletzung || P.koerper)) return { pflicht, entschuldigt: true, strafe: 0, gunst: 0, druck: 0, text: 'Pflichtturnier – aber du hast Beschwerden. Der Arzt schreibt ein Attest, darum gibt es keine Strafe.' };
  const nr = schon + 1, grund = Math.max(20000, Math.round(sponsorGeld(s).summe * 0.5 / 1000) * 1000);
  if (nr === 1) return { pflicht, nr, strafe: 0, gunst: 6, druck: 0, text: 'Pflichtturnier! Beim ersten Mal im Jahr gibt es nur eine Verwarnung. Die Sponsoren murren.' };
  if (nr === 2) return { pflicht, nr, strafe: grund, gunst: 12, druck: 6, text: `Pflichtturnier – und schon das 2. ohne Grund: ${geldText(grund)} Strafe, die Sponsoren sind verärgert.` };
  const strafe = grund * 2 * (nr - 2);
  return { pflicht, nr, strafe, gunst: 20, druck: 15, text: `Pflichtturnier – schon das ${nr}. ohne Grund: ${geldText(strafe)} Strafe, die Sponsoren sind richtig sauer und die Zeitungen schreiben darüber.` };
}

// ---------------------------------------------------------------
// Turnier: Start, Matches, Abschluss
// ---------------------------------------------------------------
export const istVerletzt = (s) => !!s.profi.verletzung;

// Ein großes Turnier beginnen. auslassen = du spielst nicht mit (freiwillig oder verletzt).
export function turnierStart(s, auslassen = false) {
  const P = s.profi, def = SE.nextTournament(s);
  // Zu den ATP Finals ist man im Spiel immer rechtzeitig wieder fit (vereinfacht)
  if (def.cat === 'F' && P.verletzung) { P.verletzung = null; P.frische = Math.max(P.frische, 70); }
  if (istVerletzt(s)) auslassen = true;
  P.kw = wocheVon(def.id);
  P.klein = null;
  P.vorher = { platz: weltPlatz(s), verteidigt: verteidigen(s, def), erwartet: erwartung(s, def).label, ausgelassen: auslassen, verletzt: istVerletzt(s) };
  if (auslassen && !P.vorher.verletzt && def.cat !== 'F') {
    P.vorher.folgen = auslassFolgen(s, def);
    if (P.vorher.folgen.pflicht && !P.vorher.folgen.entschuldigt) P.gefehlt = (P.gefehlt || 0) + 1;
  }
  P.matchesTurnier = 0; P.tag = null; P.abend = null; P.abendOffen = false;
  const T = SE.startTournament(s, auslassen);
  // Anreise: Im Privatjet kommt man ausgeruht an, mit dem Billigflug müde
  if (T.humanId) P.frische = begrenzen(P.frische + (REISEN[P.reise] || REISEN.normal).frische, 0, 100);
  P.tiefFrische = P.startFrische = P.frische; P.lastTurnier = 0;
  SE.saveSeason(s);
  return T;
}

// Ein kleines Turnier in einer freien Woche beginnen (id aus kleineDerWoche). Gibt das Turnier zurück oder null.
export function kleinStart(s, id) {
  const P = s.profi, j = jetzt(s), def = tournamentById(id);
  if (j.art !== 'frei' || !def || def.woche !== j.kw || P.verletzung || !darfSpielen(s, def).ok) return null;
  const felder = weltWoche(s, j.kw, def);
  const me = SE.seasonPlayer(s), platz = weltPlatz(s);
  const feld = [...felder[def.id], me].sort((a, b) => a.rank - b.rank);
  // Erwartung: Der Beste im Feld soll ins Finale, die ersten vier ins Halbfinale, die ersten acht ins Viertelfinale
  const nr = feld.findIndex((p) => p.id === me.id);
  const erwartet = nr === 0 ? 'F' : nr < 4 ? 'SF' : nr < 8 ? 'QF' : stufen(def)[0];
  P.vorher = { platz, verteidigt: { punkte: 0, label: null }, erwartet, ausgelassen: false, verletzt: false };
  P.matchesTurnier = 0; P.tag = null; P.abend = null; P.abendOffen = false;
  P.klein = id;
  s.tournament = createTournament(def, feld, s.playerId);
  P.frische = begrenzen(P.frische + (REISEN[P.reise] || REISEN.normal).frische, 0, 100);
  P.tiefFrische = P.startFrische = P.frische; P.lastTurnier = 0;
  SE.saveSeason(s);
  return s.tournament;
}

// Nach jedem deiner Matches. Gibt zurück: { ups (neue Level), rivale (war es ein Rivalen-Duell?) }
export function matchGespielt(s, gewonnen, gegnerId, runde = 1) {
  const P = s.profi, def = tournamentById(s.tournament.defId), p = SE.seasonPlayer(s), gegner = playerById(gegnerId);
  P.matchesTurnier++;
  P.tiefFrische = Math.min(P.tiefFrische ?? 100, P.frische);
  const last = matchLast(s, def);
  P.lastTurnier = (P.lastTurnier || 0) + last;
  // Massage und Schlaf können höchstens einen Teil der Belastung ausgleichen (LAST_BLEIBT)
  P.frische = begrenzen(Math.round(Math.min(P.frische - last, (P.startFrische ?? 100) - LAST_BLEIBT * P.lastTurnier)), 0, 100);
  P.tag = null; P.abend = null;
  P.abendOffen = !!gewonnen && !s.tournament.done;
  const b = P.h2h[gegnerId] || (P.h2h[gegnerId] = [0, 0]);
  b[gewonnen ? 0 : 1]++;
  if (gewonnen) { P.siege++; P.jahrSiege = (P.jahrSiege || 0) + 1; } else P.niederlagen++;
  const rivale = P.rivalen.includes(gegnerId);
  if (rivale) {
    if (gewonnen) {
      P.mut = begrenzen(P.mut + 1, -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck - 6, 0, 100);
      melden(s, 'rivale', einer([`${p.short} gewinnt das Duell gegen ${gegner.short}!`, `Rivalen-Duell: ${p.short} lässt ${gegner.short} keine Chance`]), `${gross(bei(def))} schlägt ${p.name} seinen großen Rivalen. Bilanz der beiden: ${b[0]}:${b[1]}.`);
    } else {
      P.druck = begrenzen(P.druck + 8, 0, 100);
      melden(s, 'rivale', einer([`${gegner.short} schlägt ${p.short} – schon wieder?`, `Rivalen-Duell geht an ${gegner.short}`]), `${gross(bei(def))} verliert ${p.name} gegen seinen Rivalen. Bilanz der beiden: ${b[0]}:${b[1]}.`);
    }
  } else if (gewonnen && gegner.rank <= 5 && p.rank > 10) {
    P.mut = begrenzen(P.mut + 1, -MUT_MAX, MUT_MAX);
    melden(s, 'gut', `Sensation! ${p.short} schlägt die Nummer ${gegner.rank} der Welt`, `Damit hat ${bei(def)} niemand gerechnet. ${gegner.name} ist raus.`);
  }
  const ups = addXp(P, gewonnen ? 15 + 5 * Math.min(runde, 5) : 6);     // halb so viel wie in der Karriere: Ein fertiger Profi lernt langsamer dazu
  SE.saveSeason(s);
  return { ups, rivale };
}

// Nach jedem Turnier (groß oder klein): Geld, Erwartung, Zeitung, Körper. sum = die Zusammenfassung, die ergänzt wird.
function auswerten(s, T, def, sum, V, dabei) {
  const P = s.profi, p = SE.seasonPlayer(s), klein = !!def.klein;
  sum.dabei = dabei;
  sum.verteidigt = V.verteidigt || { punkte: 0, label: null };
  sum.platzVorher = V.platz;
  sum.platz = weltPlatz(s);
  sum.erwartet = V.erwartet;

  // --- Geld ---
  const lohn = meinTrainer(s).lohn + meinPhysio(s).lohn;
  const K = dabei ? kosten(s) : { team: lohn, reise: 0, summe: lohn };
  const G = dabei ? sponsorGeld(s, V.platz) : { posten: [], summe: 0 };
  if (klein) { const mal = KLEIN_GELD[def.cat] || 0.1; G.posten = G.posten.map((g) => ({ ...g, geld: Math.round(g.geld * mal) })); G.summe = G.posten.reduce((a, g) => a + g.geld, 0); }
  sum.rechnung = { preis: sum.money, sponsoren: G.posten, sponsor: G.summe, team: K.team, reise: K.reise };
  sum.netto = sum.money + G.summe - K.summe;
  P.money = Math.max(0, P.money + sum.netto);
  P.bilanz.preis += sum.money; P.bilanz.sponsor += G.summe; P.bilanz.team += K.team; P.bilanz.reise += K.reise;

  if (klein) kleinFolgen(s, def, sum, V); else grossFolgen(s, T, def, sum, V, dabei);

  // --- Körper: Jedes Turnier ist eine Belastung. Viele Turnierwochen am Stück und müde spielen sind gefährlich. ---
  P.serie = dabei ? (P.serie || 0) + dauer(def) : 0;
  if (dabei) {
    P.turniere = (P.turniere || 0) + 1;
    if (def.id === 'mc') P.n500 = (P.n500 || 0) + 1;      // Monte-Carlo ist keine Pflicht, zählt aber für die Regel mit den ATP-500-Turnieren (echt)
    const k = koerperWoche(P, { matches: P.matchesTurnier, tiefFrische: P.tiefFrische, serie: P.serie, physio: PHYSIOS.findIndex((x) => x.id === P.physio) });
    if (k.beschwerden) sum.beschwerden = k.beschwerden;
    if (k.verletzung) { sum.verletzung = k.verletzung; melden(s, 'schlecht', `${p.short} verletzt: ${k.verletzung.name}`, `Er fällt etwa ${k.verletzung.wochen} Wochen aus.`); }
  }
  P.block = null; P.studium = false; P.tag = null; P.abend = null; P.abendOffen = false;
  // Erholung: gleich nach einem Turnier nur ein bisschen. Wer ein großes Turnier auslässt, erholt sich wie in freien Wochen.
  const vorherFrische = P.frische;
  P.frische = begrenzen(P.frische + Math.round(erholung(s) * (dabei ? ERHOLUNG_NACH : dauer(def))), 0, 100);
  sum.erholung = Math.round(P.frische - vorherFrische);
  if (!dabei && !V.verletzt && ausheilen(P)) sum.geheilt = true;
  if (P.verletzung && !sum.verletzung) heilen(s, dauer(def), sum);
  P.kw = (def.klein ? def.woche : wocheVon(def.id)) + dauer(def);
}
// Eine Verletzung heilt mit der Zeit
function heilen(s, wochen, sum) {
  const P = s.profi;
  P.verletzung.wochen -= wochen;
  if (P.verletzung.wochen > 0) return;
  sum.gesund = P.verletzung.name;
  P.verletzung = null;
  P.frische = Math.max(P.frische, 85);
  melden(s, 'gut', `${SE.seasonPlayer(s).short} ist wieder gesund`, 'Die Verletzung ist ausgeheilt. Ab jetzt ist er wieder dabei.');
}

// Nach einem großen Turnier: Erwartung, Selbstvertrauen, Druck, Sponsoren, Zeitung, Rivalen
function grossFolgen(s, T, def, sum, V, dabei) {
  const P = s.profi, p = SE.seasonPlayer(s);
  // --- Erwartung, Selbstvertrauen, Druck, Sponsoren-Laune, Zeitung ---
  if (dabei && sum.label) {
    const d = abstand(def, sum.label, V.erwartet);
    sum.abstand = d;
    if (!P.bestes || STUFEN_KO.indexOf(sum.label) > STUFEN_KO.indexOf(P.bestes)) if (def.cat !== 'F') P.bestes = sum.label;
    if (sum.label === 'W') {
      P.mut = begrenzen(P.mut + 2, -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck - 25, 0, 100); P.gunst = begrenzen(P.gunst + 10, 0, 100);
      melden(s, 'gut', einer([`${p.short} holt den Titel ${bei(def)}!`, `Pokal für ${p.short}: Sieg ${bei(def)}`, `${def.city} feiert ${p.short}`]),
        V.verteidigt && V.verteidigt.titel ? 'Titel verteidigt! Das schaffen nur die ganz Großen.' : 'Im Finale war er nicht zu stoppen. Die Sponsoren strahlen.');
    } else if (d > 0) {
      P.mut = begrenzen(P.mut + 1, -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck - 10, 0, 100); P.gunst = begrenzen(P.gunst + 4 * Math.min(d, 2), 0, 100);
      melden(s, 'gut', einer([`Stark: ${p.short} erreicht ${RUNDE_TEXT[sum.label]}`, `${p.short} überrascht ${bei(def)}`]), `Erwartet hatte man ${RUNDE_TEXT[V.erwartet]}. Er kam weiter – so kann es weitergehen.`);
    } else if (d < 0) {
      P.mut = begrenzen(P.mut - (d <= -2 ? 2 : 1), -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck + Math.min(20, 7 * -d), 0, 100); P.gunst = begrenzen(P.gunst - 3 * Math.min(-d, 2), 0, 100);
      melden(s, 'schlecht', einer([`Frühes Aus für ${p.short} ${bei(def)}`, `Was ist los mit ${p.short}?`, `${p.short} enttäuscht in ${def.city}`]),
        `Raus in: ${RUNDE_TEXT[sum.label]}. Erwartet hatte man mindestens ${RUNDE_TEXT[V.erwartet]}. Die Reporter stellen jetzt unbequeme Fragen.`);
    } else {
      P.druck = begrenzen(P.druck - 4, 0, 100);
      melden(s, 'info', `${p.short}: ${RUNDE_TEXT[sum.label]} ${bei(def)}`, 'Genau das, was alle erwartet haben. Ein solides Turnier.');
    }
  } else if (!dabei && def.cat !== 'F') {
    if (V.verletzt) melden(s, 'info', `${p.short} fehlt verletzt ${bei(def)}`, 'Die Fans schicken Genesungswünsche.');
    else {
      // Freiwillig ausgelassen: Was das kostet, hat auslassFolgen beim Start ausgerechnet
      const F = V.folgen || { strafe: 0, gunst: 0, druck: 0 };
      sum.auslassen = F;
      P.gunst = begrenzen(P.gunst - F.gunst, 0, 100); P.druck = begrenzen(P.druck - 5 + (F.druck || 0), 0, 100);
      if (F.strafe) { P.money = Math.max(0, P.money - F.strafe); P.bilanz.strafen = (P.bilanz.strafen || 0) + F.strafe; }
      melden(s, F.strafe ? 'schlecht' : 'info', `${p.short} sagt für ${den(def)} ab`, F.strafe ? `Schon das ${F.nr}. Pflichtturnier ohne Grund! Die ATP verhängt eine Strafe, die Sponsoren sind sauer.` : F.entschuldigt ? 'Der Arzt hat es so entschieden. Gute Besserung!' : F.pflicht ? 'Eine Pause für den Körper. Die Sponsoren hätten ihn dort aber gern gesehen.' : 'Kein Pflichtturnier – eine kluge Pause.');
    }
  }
  P.druck = begrenzen(P.druck - 5, 0, 100);      // nach jedem Turnier reden die Zeitungen bald über etwas anderes
  // Punkte verteidigt oder verloren? Platz in der Weltrangliste
  sum.punkteWeg = sum.verteidigt.punkte;
  if (sum.platzVorher && sum.platz !== sum.platzVorher && Math.abs(sum.platz - sum.platzVorher) >= (sum.platzVorher <= 10 ? 1 : 3)) {
    if (sum.platz < sum.platzVorher) melden(s, 'gut', `Weltrangliste: ${p.short} klettert auf Platz ${sum.platz}`, `Vorher stand er auf Platz ${sum.platzVorher}.`);
    else melden(s, 'schlecht', `Weltrangliste: ${p.short} rutscht auf Platz ${sum.platz}`, `Vorher Platz ${sum.platzVorher}. ${sum.punkteWeg > sum.points ? `Er hatte hier ${sum.punkteWeg} Punkte aus dem Vorjahr zu verteidigen und holte nur ${sum.points}.` : 'Die anderen haben mehr Punkte gesammelt.'}`);
  }
  // Was machen die Rivalen?
  sum.rivalen = P.rivalen.map((id) => {
    const pay = T.players[id] ? payout(T, id) : null;
    return { id, name: playerById(id).short, label: pay && pay.label };
  });
  const sieger = sum.rivalen.find((r) => r.id === T.champion);
  if (sieger) { P.druck = begrenzen(P.druck + 6, 0, 100); melden(s, 'rivale', `${sieger.name} gewinnt ${den(def)}`, `Ausgerechnet der Rivale von ${p.short} holt den Pokal. Das setzt ihn unter Druck.`); }
  else if (T.champion !== s.playerId) melden(s, 'info', `${sum.champion} gewinnt ${den(def)}`, def.cat === 'GS' ? 'Ein Grand-Slam-Titel – der größte Erfolg, den es im Tennis gibt.' : `Der Pokal von ${def.city} hat einen neuen Besitzer.`);

}
// Nach einem kleinen Turnier: Die Folgen sind kleiner als bei den großen – aber ein Titel tut immer gut
function kleinFolgen(s, def, sum, V) {
  const P = s.profi, p = SE.seasonPlayer(s);
  if (!sum.label) return;
  const d = abstand(def, sum.label, V.erwartet);
  sum.abstand = d;
  if (sum.label === 'W') {
    P.mut = begrenzen(P.mut + 1, -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck - 10, 0, 100); P.gunst = begrenzen(P.gunst + 4, 0, 100);
    melden(s, 'gut', `${p.short} gewinnt in ${def.city}`, `Ein Titel bei einem ${def.catName}-Turnier. Das gibt Selbstvertrauen für die großen Aufgaben.`);
  } else if (d > 0) { P.druck = begrenzen(P.druck - 4, 0, 100); P.gunst = begrenzen(P.gunst + 2, 0, 100); }
  else if (d <= -2) {
    P.mut = begrenzen(P.mut - 1, -MUT_MAX, MUT_MAX); P.druck = begrenzen(P.druck + 6, 0, 100);
    melden(s, 'schlecht', `${p.short} scheitert früh in ${def.city}`, `Erwartet hatte man ${RUNDE_TEXT[V.erwartet]}. Ausgerechnet bei einem kleinen Turnier.`);
  }
  if (sum.platzVorher && Math.abs(sum.platz - sum.platzVorher) >= (sum.platzVorher <= 10 ? 1 : 3) && sum.platz < sum.platzVorher) melden(s, 'gut', `Weltrangliste: ${p.short} klettert auf Platz ${sum.platz}`, `Die Punkte aus ${def.city} haben geholfen.`);
}

// Ein großes Turnier abschließen: Punkte (season.js), Geld, Erwartung, Zeitung, Körper.
// Gibt die Zusammenfassung von season.js zurück, ergänzt um alles vom Profileben.
export function turnierFertig(s) {
  const P = s.profi;
  if (P.klein) return kleinFertig(s);
  const V = P.vorher || {}, T = s.tournament, def = tournamentById(T.defId), dabei = !!T.humanId;
  const sum = SE.finishTournament(s);
  auswerten(s, T, def, sum, V, dabei);
  const j = jetzt(s);
  sum.naechstes = j.art === 'ende' ? null : j.art === 'frei' ? 'frei' : j.def.name;
  if (sum.seasonOver) sum.jahr = jahresBilanz(s, true);
  SE.saveSeason(s);
  return sum;
}
// Ein kleines Turnier abschließen
function kleinFertig(s) {
  const P = s.profi, V = P.vorher || {}, T = s.tournament, def = tournamentById(T.defId);
  if (!T.done) simulateRest(T);
  for (const id of Object.keys(T.players)) (s.race[id] = s.race[id] || {})[def.id] = payout(T, id, def).points;
  const mine = payout(T, s.playerId, def);
  if (mine.label === 'W') s.titles++;
  if (def.cat === 'A500') P.n500 = (P.n500 || 0) + 1;
  s.money += mine.money;
  const sum = { tid: def.id, klein: true, name: def.name, catName: def.catName, label: mine.label, points: mine.points, money: mine.money, champion: T.players[T.champion].name, championId: T.champion };
  (P.kleine = P.kleine || []).push({ tid: def.id, kw: def.woche, name: def.name, cat: def.cat, label: mine.label, points: mine.points });
  s.tournament = null;
  P.klein = null;
  const ich = SE.myRace(s);
  sum.rank = ich.rank; sum.total = ich.points;
  auswerten(s, T, def, sum, V, true);
  const j = jetzt(s);
  sum.naechstes = j.art === 'frei' ? 'frei' : j.def ? j.def.name : null;
  SE.saveSeason(s);
  return sum;
}

// Einen Turniersieg in den Pokalschrank stellen
export function pokalMerken(s, def, art, foto) {
  const P = s.profi;
  P.pokale.push({ name: def.name, ort: def.city || '', cat: def.cat, jahr: s.year, art, foto: foto || null });
  const mitFoto = P.pokale.filter((x) => x.foto);
  for (const x of mitFoto.slice(0, Math.max(0, mitFoto.length - FOTOS_MAX))) x.foto = null;
  SE.saveSeason(s);
}

// ---------------------------------------------------------------
// Freie Wochen: Was machst du, wenn du kein Turnier spielst?
// ---------------------------------------------------------------
// In jeder freien Woche geht genau eine Sache. Erholung gibt es in jeder Woche ohne Turnier – im Urlaub am meisten.
export const ZWISCHEN = {
  pause: { name: '🏖️ Urlaub machen', bild: '🏖️', kurz: 'Urlaub', bringt: 'am meisten Frische · weniger Druck', text: 'Strand, Familie, kein Schläger. Der Kopf wird frei.', frische: 10 },
  training: { name: '🏋️ Trainingsblock', bild: '🏋️', kurz: 'Training', bringt: '+2 auf eine Fähigkeit beim nächsten Turnier · Erfahrung', text: 'Eine Woche lang nur an einer Sache arbeiten. Such dir aus, woran.', frische: -6 },
  sponsor: { name: '📸 Sponsoren-Termin', bild: '📸', kurz: 'Sponsoren', bringt: 'Geld · Sponsoren zufriedener', text: 'Werbefilm drehen, Hände schütteln, lächeln. Das gehört zum Beruf.', frische: -5 },
  studium: { name: '🎬 Gegner studieren', bild: '🎬', kurz: 'Gegner studieren', bringt: '+2 Taktik gegen Rivalen und Top-10-Spieler beim nächsten Turnier', text: 'Mit dem Trainer Videos ansehen: Wohin schlägt er auf, wenn es eng wird?', frische: 0 },
  kinder: { name: '🧒 Tennistag für Kinder', bild: '🧒', kurz: 'Kinder-Tag', bringt: 'Fans · deutlich weniger Druck', text: 'Du spielst einen Nachmittag mit hundert Kindern. Die Zeitung schreibt endlich mal wieder etwas Nettes.', frische: -3 },
};
// Geht das noch? (Sponsoren-Termine und Kinder-Tage gibt es nur ein paar Mal im Jahr.)
export function zwischenGeht(s, id) {
  const P = s.profi;
  if (id === 'sponsor' && (P.termine || 0) >= TERMINE_MAX) return { ok: false, warum: `höchstens ${TERMINE_MAX}-mal im Jahr` };
  if (id === 'kinder' && (P.kindertage || 0) >= KINDERTAGE_MAX) return { ok: false, warum: `höchstens ${KINDERTAGE_MAX}-mal im Jahr` };
  return { ok: !!ZWISCHEN[id], warum: '' };
}
// Eine freie Woche ohne Turnier verbringen. id aus ZWISCHEN, wahl = bei 'training' die Fähigkeit (z. B. 's').
// Wer verletzt ist, macht Reha – egal, was gewählt wurde. Gibt { name, bringt, kw } zurück (oder null, wenn es nicht geht).
export function wocheFrei(s, id, wahl) {
  const P = s.profi, j = jetzt(s);
  if (j.art !== 'frei') return null;
  const reha = !!P.verletzung;
  if (!reha && (!zwischenGeht(s, id).ok || (id === 'training' && !STAT_NAMES[wahl]))) return null;
  weltWoche(s, j.kw, null);
  const bringt = [], vorher = P.frische, sum = {};
  P.frische = begrenzen(P.frische + Math.round(erholung(s)) + (reha ? 0 : ZWISCHEN[id].frische), 0, 100);
  P.serie = 0;
  if (reha) { const name = P.verletzung.name; heilen(s, 1, sum); bringt.push(sum.gesund ? `Du bist wieder gesund (${name})!` : `Reha: ${name} – noch ${P.verletzung.wochen} ${P.verletzung.wochen === 1 ? 'Woche' : 'Wochen'}`); }
  else {
    if (id === 'pause') { P.druck = begrenzen(P.druck - 8, 0, 100); bringt.push('Medien-Druck sinkt'); }
    if (id === 'training') { P.block = { key: wahl, plus: 2 }; const ups = addXp(P, 40); bringt.push(`+2 ${STAT_NAMES[wahl]} beim nächsten Turnier`, 'Erfahrung gesammelt'); if (ups) bringt.push('Neues Level: Fähigkeitspunkte zum Verteilen!'); }
    if (id === 'sponsor') {
      const geld = Math.round(Math.max(5000, sponsorGeld(s).summe * 1.5));
      P.money += geld; P.bilanz.sponsor += geld; P.termine = (P.termine || 0) + 1;
      P.gunst = begrenzen(P.gunst + 6, 0, 100); P.druck = begrenzen(P.druck + 3, 0, 100);
      bringt.push('+ ' + geldText(geld), 'Sponsoren zufriedener');
    }
    if (id === 'studium') { P.studium = true; P.druck = begrenzen(P.druck - 3, 0, 100); bringt.push('+2 Taktik gegen Rivalen und Top-10-Spieler'); }
    if (id === 'kinder') {
      P.druck = begrenzen(P.druck - 14, 0, 100); P.kindertage = (P.kindertage || 0) + 1;
      P.autogramme = (P.autogramme || 0) + 3; P.tagFans = Math.min(8, (P.tagFans || 0) + 1);
      bringt.push('+1 Fan-Stern ⭐', 'Medien-Druck sinkt deutlich');
    }
    if (ausheilen(P)) bringt.push('Deine Beschwerden sind weg');
  }
  const d = Math.round(P.frische - vorher);
  bringt.push(`Frische ${d >= 0 ? '+' : '−'}${Math.abs(d)}`);
  (P.getan = P.getan || {})[j.kw] = reha ? '🩹 Reha' : ZWISCHEN[id].bild + ' ' + ZWISCHEN[id].kurz;
  P.kw = j.kw + 1;
  SE.saveSeason(s);
  return { name: reha ? '🩹 Reha' : ZWISCHEN[id].name, bringt, kw: j.kw };
}

// ---------------------------------------------------------------
// Saison-Planer: das Jahr im Voraus einteilen (Belastungssteuerung)
// ---------------------------------------------------------------
// P.plan[Woche] = 'aus' (großes Turnier auslassen) · Kürzel eines kleinen Turniers · 'pause' | 'sponsor' | 'studium' | 'kinder' | 'training:s'
// Der Plan verpflichtet zu nichts: Jede Woche entscheidest du auf der Saison-Seite neu. Er zeigt aber vorher, wo es eng wird.
export const AUTO = {
  vorsichtig: { name: 'Vorsichtig', bild: '🛡️', text: 'Nur die Pflicht: große Turniere, sonst Urlaub und Training. Monte-Carlo wird ausgelassen.' },
  ausgewogen: { name: 'Ausgewogen', bild: '⚖️', text: 'In jeder längeren Lücke ein kleines Turnier, vor den großen Turnieren Training.' },
  angriff: { name: 'Voll auf Angriff', bild: '⚔️', text: 'Jedes kleine Turnier mitnehmen, solange die Frische reicht. Viele Punkte – aber gefährlich für den Körper.' },
};
export const planVon = (s, kw) => (s.profi.plan || {})[kw] || null;
export function planSetzen(s, kw, wahl) {
  const P = s.profi;
  P.plan = P.plan || {};
  if (wahl) P.plan[kw] = wahl; else delete P.plan[kw];
  SE.saveSeason(s);
}
export function planLeeren(s) { s.profi.plan = {}; SE.saveSeason(s); }
// Wie viele Matches wird ein Turnier ungefähr kosten? (so weit, wie man es von deinem Platz erwartet)
function matchesGeschaetzt(s, def, platz) {
  if (def.klein) return platz <= 10 ? 4 : platz <= 30 ? 3 : 2;
  if (def.cat === 'F') return 4;
  return Math.max(1, Math.min(stufen(def).indexOf(erwartung(s, def, platz).label) + 1, def.cat === 'GS' ? 7 : 6));
}

// Die Vorschau: Woche für Woche ausrechnen, wie es dir mit diesem Plan ungefähr geht.
// Jede Zeile: { nr, art: 'gross' | 'zweite' | 'frei', def, wahl, vorbei, frischeVor, frische, serie, warn: [], folgen }
export function vorschau(s) {
  const P = s.profi, platz = weltPlatz(s), E = erholung(s), anreise = (REISEN[P.reise] || REISEN.normal).frische;
  const gespielt = new Set(TOURNAMENTS.slice(0, s.week).map((t) => t.id));
  let f = P.frische, serie = P.serie || 0, gefehlt = P.gefehlt || 0, n500 = P.n500 || 0, turniere = P.turniere || 0, strafen = 0, muede = 0, lang = 0;
  const wochen = [];
  for (const w of WOCHEN) {
    if (w.off || w.nr > LETZTE_WOCHE) continue;
    const z = { nr: w.nr, warn: [], wahl: planVon(s, w.nr) };
    wochen.push(z);
    if (w.zweite) { z.art = 'zweite'; z.def = tournamentById(w.zweite); z.vorbei = gespielt.has(w.zweite); z.frische = Math.round(f); continue; }
    z.art = w.gross ? 'gross' : 'frei';
    z.def = w.gross ? tournamentById(w.gross) : z.wahl && tournamentById(z.wahl) ? tournamentById(z.wahl) : null;
    z.vorbei = w.gross ? gespielt.has(w.gross) || (s.tournament && s.tournament.defId === w.gross) : w.nr < P.kw || (!!P.klein && w.nr === P.kw);
    if (z.vorbei) { z.frische = null; continue; }
    const spielt = w.gross ? z.wahl !== 'aus' : !!z.def;
    if (spielt) {
      f = begrenzen(f + anreise, 0, 100);
      z.frischeVor = Math.round(f);
      if (f < 60) { z.warn.push('müde am Start'); muede++; }
      f = begrenzen(f - matchesGeschaetzt(s, z.def, platz) * matchLast(s, z.def) * LAST_PLAN, 0, 100);
      serie += dauer(z.def); turniere++;
      if (serie >= 6) { z.warn.push(`${serie}. Turnierwoche am Stück`); lang++; }
      if (z.def.cat === 'A500' || z.def.id === 'mc') n500++;
      f = begrenzen(f + E * ERHOLUNG_NACH, 0, 100);
      if (w.gross) z.verteidigen = verteidigen(s, z.def).punkte;
    } else if (w.gross) {
      z.folgen = auslassFolgen(s, z.def, gefehlt, false);
      if (z.folgen.pflicht) gefehlt++;
      strafen += z.folgen.strafe;
      z.verloren = verteidigen(s, z.def).punkte;
      f = begrenzen(f + E * dauer(z.def), 0, 100); serie = 0;
    } else {
      const id = (z.wahl || 'pause').split(':')[0];
      f = begrenzen(f + E + (ZWISCHEN[id] ? ZWISCHEN[id].frische : 0), 0, 100); serie = 0;
    }
    z.frische = Math.round(f); z.serie = serie;
  }
  // Hinweise des Trainers
  const hinweise = [], regel = P.startPlatz <= REGEL_500.bisPlatz;
  if (muede) hinweise.push({ art: 'schlecht', text: `${muede}-mal gehst du müde in ein Turnier (Frische unter 60). Müde spielen ist der häufigste Grund für Verletzungen. Plane davor Urlaub ein oder lass ein kleines Turnier weg.` });
  if (lang) hinweise.push({ art: 'schlecht', text: 'Du spielst 6 oder mehr Turnierwochen am Stück. Ohne freie Woche dazwischen steigt das Verletzungsrisiko deutlich.' });
  if (gefehlt > (P.gefehlt || 0)) hinweise.push({ art: gefehlt >= 2 ? 'schlecht' : 'achtung', text: `Du lässt ${gefehlt - (P.gefehlt || 0)} Pflichtturnier${gefehlt - (P.gefehlt || 0) === 1 ? '' : 'e'} aus${strafen ? ` – das kostet zusammen ${geldText(strafen)} Strafe` : ''}. Das erste im Jahr gibt nur eine Verwarnung, danach wird es jedes Mal teurer.` });
  if (regel && n500 < REGEL_500.zahl) hinweise.push({ art: 'achtung', text: `Als Spieler aus den Top ${REGEL_500.bisPlatz} musst du ${REGEL_500.zahl} ATP-500-Turniere spielen. Geplant oder gespielt: ${n500}. Für jedes fehlende gibt es am Jahresende ${geldText(REGEL_500.strafe)} Strafe.` });
  if (!muede && !lang && turniere >= 14) hinweise.push({ art: 'gut', text: 'Die Belastung passt: genug Pausen, und du gehst nie müde in ein Turnier.' });
  if (turniere < 13 && gefehlt === (P.gefehlt || 0)) hinweise.push({ art: 'info', text: 'Sehr wenige Turniere. Das schont den Körper – aber die Punkte von kleinen Turnieren aus dem letzten Jahr fallen nach und nach weg.' });
  const belastung = muede + lang >= 3 ? 'hoch' : muede + lang >= 1 ? 'mittel' : 'niedrig';
  return { wochen, turniere, n500, gefehlt, strafen, hinweise, belastung, regel };
}

// Vorschlag vom Trainer: füllt alle Wochen, die noch kommen (auch schon geplante)
export function autoPlan(s, art) {
  if (!AUTO[art]) return;
  const P = s.profi, me = SE.seasonPlayer(s), platz = weltPlatz(s);
  // Woran soll im Training gearbeitet werden? An der schwächsten Fähigkeit.
  const schwach = Object.keys(STAT_NAMES).sort((a, b) => me.stats[a] + P.plus[a] - me.stats[b] - P.plus[b])[0];
  const bestes = (kw) => kleineDerWoche(kw).find((t) => darfSpielen(s, t, platz).ok) || null;
  const offen = FREIE_WOCHEN.filter((kw) => kw >= P.kw);
  let n500Start = 0;
  P.plan = Object.fromEntries(Object.entries(P.plan || {}).filter(([kw]) => +kw < P.kw));
  if (art === 'vorsichtig' && wocheVon('mc') >= P.kw) P.plan[wocheVon('mc')] = 'aus';
  else if (wocheVon('mc') >= P.kw) n500Start = 1;     // Monte-Carlo zählt für die Regel mit
  // Die freien Wochen in Lücken einteilen (Wochen direkt hintereinander)
  const luecken = [];
  for (const kw of offen) { const l = luecken[luecken.length - 1]; if (l && l[l.length - 1] === kw - 1) l.push(kw); else luecken.push([kw]); }
  let n500 = (P.n500 || 0) + n500Start;
  const regel = P.startPlatz <= REGEL_500.bisPlatz, ist500 = (kw) => { const x = bestes(kw); return !!x && x.cat === 'A500'; };
  for (const l of luecken) {
    // In welcher Woche der Lücke wird gespielt? Fehlen noch ATP-500-Turniere für die Regel der besten 30, dann in der Woche mit dem ATP 500.
    const braucht = regel && n500 < REGEL_500.zahl, lang = l.length >= 2;
    const spielWoche = braucht && l.slice(0, lang ? -1 : 1).some(ist500) ? l.find(ist500) : l[0];
    l.forEach((kw, i) => {
      const t = bestes(kw), letzte = i === l.length - 1;
      let wahl = letzte && lang ? 'training:' + schwach : 'pause';
      if (art === 'angriff') wahl = t ? t.id : 'training:' + schwach;
      if (art === 'ausgewogen' && lang && kw === spielWoche && t) wahl = t.id;
      // Vorsichtig: nur so viele ATP 500, wie die Regel verlangt
      if (art === 'vorsichtig' && braucht && kw === spielWoche && ist500(kw)) wahl = t.id;
      if (tournamentById(wahl) && tournamentById(wahl).cat === 'A500') n500++;
      P.plan[kw] = wahl;
    });
  }
  const zeile = (kw) => vorschau(s).wochen.find((z) => z.nr === kw);
  // Reicht es noch nicht für die Regel? Dann kommen ATP 500 in einzelne freie Wochen – aber nur, wo es den Körper nicht überlastet.
  if (art !== 'angriff' && regel) for (const kw of offen) {
    if (n500 >= REGEL_500.zahl) break;
    if (!ist500(kw) || tournamentById(P.plan[kw])) continue;
    const alt = P.plan[kw];
    P.plan[kw] = bestes(kw).id;
    const V = vorschau(s);
    if (V.wochen.some((z) => !z.vorbei && z.warn.length && z.nr >= kw && z.nr <= kw + 4)) P.plan[kw] = alt; else n500++;
  }
  // Zum Schluss schaut der Trainer auf die Vorschau: Wo man müde wäre oder zu lange am Stück spielt, fliegt das kleine Turnier davor wieder raus.
  // „Voll auf Angriff“ nimmt dabei mehr in Kauf (erst ab Frische unter 50).
  for (let i = 0; i < 40; i++) {
    const W = vorschau(s).wochen;
    const eng = W.find((z) => !z.vorbei && z.art !== 'zweite' && (art === 'angriff' ? z.frischeVor < 50 : z.warn.length));
    if (!eng) break;
    const kleine = W.filter((z) => z.art === 'frei' && !z.vorbei && z.nr <= eng.nr && z.def);
    // Lieber ein ATP 250 streichen als ein ATP 500, das für die Regel der besten 30 gebraucht wird
    const davor = (regel ? kleine.filter((z) => z.def.cat !== 'A500' && z.nr >= eng.nr - 5).pop() : null) || kleine.pop();
    if (!davor) break;
    P.plan[davor.nr] = 'pause';
  }
  SE.saveSeason(s);
}

// ---------------------------------------------------------------
// Jahresende: Wie war die Saison? Und weiter ins nächste Jahr
// ---------------------------------------------------------------
// auszahlen = true: Prämien für geschaffte Ziele werden gutgeschrieben (nur einmal, am Saisonende)
export function jahresBilanz(s, auszahlen = false) {
  const P = s.profi;
  const ziele = P.ziele.map((z) => ({ ...z, ...zielStand(s, z) }));
  const geschafft = ziele.filter((z) => z.ok).length;
  if (auszahlen && !P.ausgezahlt) {
    const praemie = ziele.filter((z) => z.ok).reduce((a, z) => a + z.geld, 0);
    P.money += praemie; P.bilanz.praemie += praemie; P.ausgezahlt = true;
    P.gunst = begrenzen(P.gunst + [-15, 0, 10, 20][Math.min(3, geschafft)], 0, 100);
    melden(s, geschafft >= 2 ? 'gut' : 'info', `Bilanz ${s.year}: ${geschafft} von ${ziele.length} Zielen geschafft`,
      ['Die Sponsoren sind enttäuscht. Nächstes Jahr muss mehr kommen.', 'Ein Ziel erreicht – die Sponsoren hatten sich mehr erhofft.', 'Zwei Ziele erreicht. Die Sponsoren sind zufrieden.', 'Alle Ziele erreicht! Die Sponsoren verlängern mit Freude.'][Math.min(3, geschafft)]);
  }
  // Die Regel für die besten 30: Wer zu wenige ATP-500-Turniere gespielt hat, zahlt (im echten Tennis gibt es dafür Null-Punkte-Ergebnisse)
  const fehlen500 = P.startPlatz <= REGEL_500.bisPlatz ? Math.max(0, REGEL_500.zahl - (P.n500 || 0)) : 0;
  if (auszahlen && !P.ausgezahlt500 && fehlen500) {
    const strafe = fehlen500 * REGEL_500.strafe;
    P.money = Math.max(0, P.money - strafe); P.bilanz.strafen = (P.bilanz.strafen || 0) + strafe; P.ausgezahlt500 = true;
    melden(s, 'schlecht', `Strafe für ${SE.seasonPlayer(s).short}: zu wenige ATP-500-Turniere`, `Die besten ${REGEL_500.bisPlatz} müssen ${REGEL_500.zahl} davon spielen. Es fehlten ${fehlen500}.`);
  }
  const b = P.bilanz;
  return { fehlen500, strafen: b.strafen || 0, turniere: P.turniere || 0, kleine: P.kleine || [], ziele, geschafft, sterne: geschafft, startPlatz: P.startPlatz, platz: weltPlatz(s), race: SE.myRace(s).rank, titel: s.titles,
    bilanz: b, gewinn: b.preis + b.sponsor + b.praemie - b.team - b.reise - (b.strafen || 0) };
}

// Mit demselben Profi ins nächste Jahr. Was dieses Jahr geholt wurde, muss nächstes Jahr verteidigt werden.
export function naechsteSaison(s) {
  const neu = SE.newSeason(s.playerId);
  neu.year = s.year + 1;
  // Große Turniere werden einzeln verteidigt, die Punkte von den kleinen kommen zusammen in einen Topf (rest)
  neu.rest = {}; neu.vorjahr = {};
  for (const p of PLAYERS) {
    neu.vorjahr[p.id] = {}; neu.rest[p.id] = 0;
    for (const [k, n] of Object.entries(s.race[p.id] || {})) { if (GROSS_IDS.has(k)) neu.vorjahr[p.id][k] = n; else neu.rest[p.id] += n; }
  }
  neu.vorjahrSieger = Object.fromEntries(s.history.map((h) => [h.tid, h.championId]));
  neu.jahre = (s.jahre || 0) + 1;
  neu.titelGesamt = (s.titelGesamt || 0) + s.titles;
  const P = s.profi;
  neu.profi = { ...P, frische: 100, mut: begrenzen(Math.round(P.mut / 2), -1, 1), druck: begrenzen(Math.round((P.druck + DRUCK_START) / 2), 0, 100),
    koerper: null, verletzung: null, serie: 0, tag: null, abend: null, abendOffen: false, block: null, studium: false, kw: 0, plan: {}, klein: null, ausgezahlt: false, ausgezahlt500: false, vorher: null };
  einrichten(neu);
  neuesJahr(neu);
  melden(neu, 'info', `Auf ins Jahr ${neu.year}!`, `${SE.seasonPlayer(neu).name} startet als Nummer ${neu.profi.startPlatz} der Welt. Alle Punkte aus dem letzten Jahr müssen jetzt verteidigt werden.`);
  SE.saveSeason(neu);
  return neu;
}
