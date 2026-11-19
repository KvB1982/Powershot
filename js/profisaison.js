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
import { wocheVon, zweiWochen } from './kalender.js';
import { addXp, frischeAbzug } from './career.js';
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
export const MATCH_KOSTET = 1.8;      // ein Match bei den ganz großen Turnieren kostet so viel mal mehr Frische als in der Karriere (lange Matches, starke Gegner)
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
// (s.rest) stammt von kleineren Turnieren, die es in der Saison nicht gibt – der bleibt das ganze Jahr gleich.
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
// Jahr gespielt ist – vorher zählt noch das vom letzten Jahr.
// Jeder Eintrag: { id, name, short, country, points, rank, me, ref }
export function weltTabelle(s) {
  const gespielt = new Set(TOURNAMENTS.slice(0, s.week).map((t) => t.id));
  const list = PLAYERS.map((p) => {
    let points = s.rest[p.id] || 0;
    for (const t of TOURNAMENTS) points += gespielt.has(t.id) ? ((s.race[p.id] || {})[t.id] || 0) : ((s.vorjahr[p.id] || {})[t.id] || 0);
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
      block: null, studium: false, zwischen: null,
      bilanz: { preis: 0, sponsor: 0, praemie: 0, team: 0, reise: 0 },
      startPlatz: platz,
    };
    neuesJahr(s);
    melden(s, 'info', `${s.year}: ${SE.seasonPlayer(s).name} startet als Nummer ${platz} der Welt`, 'Trainer, Physio und Sponsoren stehen bereit. Die Fans sind gespannt, was dieses Jahr geht.');
  }
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
// Turnier: Start, Matches, Abschluss
// ---------------------------------------------------------------
export const istVerletzt = (s) => !!s.profi.verletzung;

// Turnier beginnen. auslassen = du spielst nicht mit (freiwillig oder verletzt).
export function turnierStart(s, auslassen = false) {
  const P = s.profi, def = SE.nextTournament(s);
  // Zu den ATP Finals ist man im Spiel immer rechtzeitig wieder fit (vereinfacht)
  if (def.cat === 'F' && P.verletzung) { P.verletzung = null; P.frische = Math.max(P.frische, 70); }
  if (istVerletzt(s)) auslassen = true;
  P.vorher = { platz: weltPlatz(s), verteidigt: verteidigen(s, def), erwartet: erwartung(s, def).label, ausgelassen: auslassen, verletzt: istVerletzt(s) };
  P.matchesTurnier = 0; P.tiefFrische = P.frische; P.tag = null; P.abend = null; P.abendOffen = false; P.zwischen = null;
  const T = SE.startTournament(s, auslassen);
  // Anreise: Im Privatjet kommt man ausgeruht an, mit dem Billigflug müde
  if (T.humanId) P.frische = begrenzen(P.frische + (REISEN[P.reise] || REISEN.normal).frische, 0, 100);
  SE.saveSeason(s);
  return T;
}

// Nach jedem deiner Matches. Gibt zurück: { ups (neue Level), rivale (war es ein Rivalen-Duell?) }
export function matchGespielt(s, gewonnen, gegnerId, runde = 1) {
  const P = s.profi, def = tournamentById(s.tournament.defId), p = SE.seasonPlayer(s), gegner = playerById(gegnerId);
  const ausdauer = 1 - (p.stats.a + P.plus.a - 52) / 100;
  P.matchesTurnier++;
  P.tiefFrische = Math.min(P.tiefFrische ?? 100, P.frische);
  P.frische = begrenzen(P.frische - Math.round(meinPhysio(s).last * MATCH_KOSTET * (zweiWochen(def.id) ? RUHETAG : 1) * ausdauer), 0, 100);
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

// Wie viele freie Wochen liegen zwischen diesem Turnier und dem nächsten?
export function freieWochen(def, next) {
  if (!next) return 0;
  return Math.max(0, wocheVon(next.id) - wocheVon(def.id) - 1 - (zweiWochen(def.id) ? 1 : 0));
}

// Turnier abschließen: Punkte (season.js), Geld, Erwartung, Zeitung, Körper, Erholung.
// Gibt die Zusammenfassung von season.js zurück, ergänzt um alles vom Profileben.
export function turnierFertig(s) {
  const P = s.profi, V = P.vorher || {}, T = s.tournament, def = tournamentById(T.defId), p = SE.seasonPlayer(s);
  const dabei = !!T.humanId;
  const sum = SE.finishTournament(s);
  const next = SE.nextTournament(s);
  sum.dabei = dabei;
  sum.verteidigt = V.verteidigt || { punkte: 0, label: null };
  sum.platzVorher = V.platz;
  sum.platz = weltPlatz(s);
  sum.erwartet = V.erwartet;

  // --- Geld ---
  const K = dabei ? kosten(s) : { team: meinTrainer(s).lohn + meinPhysio(s).lohn, reise: 0, summe: meinTrainer(s).lohn + meinPhysio(s).lohn };
  const G = dabei ? sponsorGeld(s, V.platz) : { posten: [], summe: 0 };
  sum.rechnung = { preis: sum.money, sponsoren: G.posten, sponsor: G.summe, team: K.team, reise: K.reise };
  sum.netto = sum.money + G.summe - K.summe;
  P.money = Math.max(0, P.money + sum.netto);
  P.bilanz.preis += sum.money; P.bilanz.sponsor += G.summe; P.bilanz.team += K.team; P.bilanz.reise += K.reise;

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
      P.gunst = begrenzen(P.gunst - 6, 0, 100); P.druck = begrenzen(P.druck - 5, 0, 100);
      melden(s, 'info', `${p.short} sagt für ${den(def)} ab`, 'Eine Pause für den Körper. Die Sponsoren hätten ihn dort aber gern gesehen.');
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

  // --- Körper ---
  P.serie = dabei ? (P.serie || 0) + 1 : 0;
  if (dabei) {
    const k = koerperWoche(P, { matches: P.matchesTurnier, tiefFrische: P.tiefFrische, serie: P.serie * 2, physio: PHYSIOS.findIndex((x) => x.id === P.physio) });
    if (k.beschwerden) sum.beschwerden = k.beschwerden;
    if (k.verletzung) { sum.verletzung = k.verletzung; melden(s, 'schlecht', `${p.short} verletzt: ${k.verletzung.name}`, `Er fällt etwa ${k.verletzung.wochen} Wochen aus.`); }
  }
  // --- Die Zeit bis zum nächsten Turnier ---
  P.block = null; P.studium = false; P.tag = null; P.abend = null; P.abendOffen = false;
  const frei = freieWochen(def, next);
  sum.frei = frei;
  const vorherFrische = P.frische;
  P.frische = begrenzen(P.frische + Math.round(meinPhysio(s).erholung * (0.25 + 0.2 * Math.min(frei, 3)) * (dabei ? 1 : 1.5)), 0, 100);
  sum.erholung = Math.round(P.frische - vorherFrische);
  if (frei > 0) P.serie = 0;
  if (!dabei && !V.verletzt && ausheilen(P)) sum.geheilt = true;
  if (P.verletzung) {
    // Verletzt: Die Zeit heilt. Ein Turnier dauert 1 oder 2 Wochen, dazu kommen die freien Wochen.
    P.verletzung.wochen -= sum.verletzung ? frei : frei + 1 + (zweiWochen(def.id) ? 1 : 0);
    if (P.verletzung.wochen <= 0) { sum.gesund = P.verletzung.name; P.verletzung = null; P.frische = Math.max(P.frische, 85); melden(s, 'gut', `${p.short} ist wieder gesund`, 'Die Verletzung ist ausgeheilt. Beim nächsten Turnier ist er wieder dabei.'); }
  }
  // Wie viele Dinge kannst du bis zum nächsten Turnier tun? (höchstens 2; verletzt: nichts)
  P.zwischen = next && !P.verletzung && frei > 0 ? { frei, n: Math.min(frei, 2), getan: [], next: next.id } : null;
  sum.zwischen = P.zwischen;
  sum.naechstes = next ? next.name : null;
  if (sum.seasonOver) sum.jahr = jahresBilanz(s, true);
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
// Zwischen den Turnieren
// ---------------------------------------------------------------
// Jede Auswahl braucht eine freie Woche. Höchstens zwei pro Lücke – ein bisschen Erholung gibt es immer von allein.
export const ZWISCHEN = {
  pause: { name: '🏖️ Urlaub machen', bringt: '+18 Frische · weniger Druck · heilt Beschwerden', text: 'Strand, Familie, kein Schläger. Der Kopf wird frei.' },
  training: { name: '🏋️ Trainingsblock', bringt: '+2 auf eine Fähigkeit beim nächsten Turnier · Erfahrung · −6 Frische', text: 'Eine Woche lang nur an einer Sache arbeiten. Such dir aus, woran.' },
  sponsor: { name: '📸 Sponsoren-Termin', bringt: 'Geld · Sponsoren zufriedener · −5 Frische', text: 'Werbefilm drehen, Hände schütteln, lächeln. Das gehört zum Beruf.' },
  studium: { name: '🎬 Gegner studieren', bringt: '+2 Taktik gegen Rivalen und Top-10-Spieler beim nächsten Turnier', text: 'Mit dem Trainer Videos ansehen: Wohin schlägt er auf, wenn es eng wird?' },
  kinder: { name: '🧒 Tennistag für Kinder', bringt: 'Fans · deutlich weniger Druck · −3 Frische', text: 'Du spielst einen Nachmittag mit hundert Kindern. Die Zeitung schreibt endlich mal wieder etwas Nettes.' },
};
export const zwischenOffen = (s) => { const z = s.profi.zwischen; return z ? Math.max(0, z.n - z.getan.length) : 0; };
// Etwas tun. wahl = bei 'training' die Fähigkeit (z. B. 's'). Gibt Sätze zurück, was es gebracht hat (oder null).
export function zwischenTun(s, id, wahl) {
  const P = s.profi, z = P.zwischen;
  if (!z || !ZWISCHEN[id] || zwischenOffen(s) <= 0 || z.getan.includes(id)) return null;
  const bringt = [];
  if (id === 'pause') {
    P.frische = begrenzen(P.frische + 18, 0, 100); P.druck = begrenzen(P.druck - 8, 0, 100);
    bringt.push('+18 Frische', 'Medien-Druck sinkt');
    if (ausheilen(P)) bringt.push('Deine Beschwerden sind weg');
  }
  if (id === 'training') {
    if (!STAT_NAMES[wahl]) return null;
    P.block = { key: wahl, plus: 2 };
    P.frische = begrenzen(P.frische - 6, 0, 100);
    const ups = addXp(P, 40);
    bringt.push(`+2 ${STAT_NAMES[wahl]} beim nächsten Turnier`, 'Erfahrung gesammelt', '−6 Frische');
    if (ups) bringt.push('Neues Level: Fähigkeitspunkte zum Verteilen!');
  }
  if (id === 'sponsor') {
    const geld = Math.round(Math.max(5000, sponsorGeld(s).summe * 1.5));
    P.money += geld; P.bilanz.sponsor += geld;
    P.gunst = begrenzen(P.gunst + 6, 0, 100); P.frische = begrenzen(P.frische - 5, 0, 100); P.druck = begrenzen(P.druck + 3, 0, 100);
    bringt.push('+ ' + geldText(geld), 'Sponsoren zufriedener', '−5 Frische');
  }
  if (id === 'studium') { P.studium = true; P.druck = begrenzen(P.druck - 3, 0, 100); bringt.push('+2 Taktik gegen Rivalen und Top-10-Spieler'); }
  if (id === 'kinder') {
    P.druck = begrenzen(P.druck - 14, 0, 100); P.frische = begrenzen(P.frische - 3, 0, 100);
    P.autogramme = (P.autogramme || 0) + 3; P.tagFans = Math.min(8, (P.tagFans || 0) + 1);
    bringt.push('+1 Fan-Stern ⭐', 'Medien-Druck sinkt deutlich', '−3 Frische');
  }
  z.getan.push(id);
  SE.saveSeason(s);
  return bringt;
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
  const b = P.bilanz;
  return { ziele, geschafft, sterne: geschafft, startPlatz: P.startPlatz, platz: weltPlatz(s), race: SE.myRace(s).rank, titel: s.titles,
    bilanz: b, gewinn: b.preis + b.sponsor + b.praemie - b.team - b.reise };
}

// Mit demselben Profi ins nächste Jahr. Was dieses Jahr geholt wurde, muss nächstes Jahr verteidigt werden.
export function naechsteSaison(s) {
  const neu = SE.newSeason(s.playerId);
  neu.year = s.year + 1;
  neu.rest = s.rest;
  neu.vorjahr = {};
  for (const p of PLAYERS) neu.vorjahr[p.id] = { ...(s.race[p.id] || {}) };
  neu.vorjahrSieger = Object.fromEntries(s.history.map((h) => [h.tid, h.championId]));
  neu.jahre = (s.jahre || 0) + 1;
  neu.titelGesamt = (s.titelGesamt || 0) + s.titles;
  const P = s.profi;
  neu.profi = { ...P, frische: 100, mut: begrenzen(Math.round(P.mut / 2), -1, 1), druck: begrenzen(Math.round((P.druck + DRUCK_START) / 2), 0, 100),
    koerper: null, verletzung: null, serie: 0, tag: null, abend: null, abendOffen: false, block: null, studium: false, zwischen: null, ausgezahlt: false, vorher: null };
  einrichten(neu);
  neuesJahr(neu);
  melden(neu, 'info', `Auf ins Jahr ${neu.year}!`, `${SE.seasonPlayer(neu).name} startet als Nummer ${neu.profi.startPlatz} der Welt. Alle Punkte aus dem letzten Jahr müssen jetzt verteidigt werden.`);
  SE.saveSeason(neu);
  return neu;
}
