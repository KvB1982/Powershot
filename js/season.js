// Powershot – Saison: Mit einem echten Profi durch das Jahr spielen und Punkte für das "ATP Race" sammeln.
//
// Das ATP Race ist ein Wettrennen: Am 1. Januar haben alle 0 Punkte. Bei jedem Turnier gibt es Punkte,
// je weiter man kommt, desto mehr. Die besten 8 am Ende dürfen zu den ATP Finals nach Turin.
// Diese Datei rechnet nur – sie zeichnet nichts. Darum kann man sie auch ohne Browser testen (tools/logic.mjs).

import { PLAYERS, TOURNAMENTS, playerById, tournamentById } from './data.js';
import { createTournament, payout, simulateRest } from './tournament.js';

const KEY = 'powershot.saison.v1';
export const FINALS_PLAETZE = 8;      // so viele dürfen zu den ATP Finals

export function loadSeason() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    // Gibt es den gewählten Spieler noch? (Die Spielerliste kann sich mit einer neuen Version ändern.)
    if (!s || !playerById(s.playerId)) return null;
    if (s.tournament && Object.keys(s.tournament.players).some((id) => !playerById(id))) s.tournament = null;
    return s;
  } catch (e) { return null; }
}
export function saveSeason(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* kein Speicher */ }
}
export function deleteSeason() {
  try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
}

// Eine neue Saison: alle starten bei 0 Punkten.
export function newSeason(playerId) {
  return {
    v: 1, playerId, year: 2027, week: 0,
    race: {},            // race[spieler][turnier] = Punkte
    tournament: null,    // das laufende Turnier (oder null)
    history: [],         // deine Ergebnisse, eins pro Turnier
    slams: {},           // slams[turnier] = wer hat diesen Grand Slam gewonnen
    titles: 0, money: 0, over: false,
  };
}

export const seasonPlayer = (s) => playerById(s.playerId);
export function nextTournament(s) { return s.over ? null : TOURNAMENTS[s.week]; }

const summe = (slots) => Object.values(slots || {}).reduce((a, b) => a + b, 0);

// Die Race-Tabelle: alle Spieler, sortiert nach Punkten. Bei Gleichstand steht der mit dem besseren Weltranglistenplatz vorn.
// Jeder Eintrag: { id, name, short, country, points, played, rank, me, slam, ref }
export function raceTable(s) {
  const sieger = new Set(Object.values(s.slams));
  const list = PLAYERS.map((p) => ({
    id: p.id, name: p.name, short: p.short, country: p.country, world: p.rank,
    points: summe(s.race[p.id]), played: Object.keys(s.race[p.id] || {}).length,
    me: p.id === s.playerId, slam: sieger.has(p.id), ref: p,
  }));
  list.sort((a, b) => b.points - a.points || a.world - b.world);
  list.forEach((p, i) => { p.rank = i + 1; });
  return list;
}
export function myRace(s) { return raceTable(s).find((p) => p.me); }

// Wer darf zu den ATP Finals? Die echte Regel:
//   - Die ersten 7 im Race sind sicher dabei.
//   - Den 8. Platz bekommt ein Grand-Slam-Sieger dieses Jahres, wenn er im Race auf Platz 8 bis 20 steht.
//   - Gibt es so einen nicht, fährt ganz normal der Achte im Race.
// Zurück kommt die Liste der 8 Spieler (bester zuerst). Wer über die Sonderregel reinkommt, hat viaSlam = true.
export function finalsField(s) {
  const r = raceTable(s);
  const feld = r.slice(0, FINALS_PLAETZE - 1);
  const sonder = r.slice(FINALS_PLAETZE - 1, 20).find((p) => p.slam);
  const letzter = sonder || r[FINALS_PLAETZE - 1];
  if (sonder && sonder.rank > FINALS_PLAETZE) letzter.viaSlam = true;
  feld.push(letzter);
  return feld;
}
export function qualified(s) { return finalsField(s).some((p) => p.me); }

// Wer spielt bei einem Turnier mit?
// Grand Slam und Masters: die Besten der Weltrangliste. Dein Profi ist immer dabei (außer du lässt das Turnier aus).
// ATP Finals: die 8 Qualifizierten aus dem Race.
export function entrants(s, def, skip = false) {
  if (def.cat === 'F') return finalsField(s).map((p) => p.ref);
  const me = seasonPlayer(s);
  const andere = PLAYERS.filter((p) => p.id !== me.id);
  if (skip) return andere.slice(0, def.draw);
  return [...andere.slice(0, def.draw - 1), me].sort((a, b) => a.rank - b.rank);
}

export function startTournament(s, skip = false) {
  const def = nextTournament(s);
  const list = entrants(s, def, skip);
  const dabei = list.some((p) => p.id === s.playerId);
  s.tournament = createTournament(def, list, dabei ? s.playerId : null);
  saveSeason(s);
  return s.tournament;
}

// Turnier abschließen: Race-Punkte für alle eintragen, weiter zum nächsten Turnier.
// Gibt eine kleine Zusammenfassung für die Anzeige zurück.
export function finishTournament(s) {
  const T = s.tournament;
  const def = tournamentById(T.defId);
  if (!T.done) simulateRest(T);
  for (const id of Object.keys(T.players)) {
    if (!s.race[id]) s.race[id] = {};
    s.race[id][def.id] = payout(T, id).points;
  }
  if (def.cat === 'GS') s.slams[def.id] = T.champion;
  const mine = T.humanId ? payout(T, T.humanId) : { points: 0, money: 0, label: null };
  s.money += mine.money;
  if (mine.label === 'W') s.titles++;
  const summary = {
    tid: def.id, name: def.name, label: mine.label, points: mine.points, money: mine.money,
    champion: T.players[T.champion].name, championId: T.champion,
  };
  s.history.push(summary);
  s.tournament = null;
  s.week++;
  if (s.week >= TOURNAMENTS.length) s.over = true;
  const ich = myRace(s);
  summary.rank = ich.rank;
  summary.total = ich.points;
  summary.seasonOver = s.over;
  // Kommt als Nächstes das Finale der Besten? Dann sagen wir gleich, ob du dabei bist.
  const next = nextTournament(s);
  if (next && next.cat === 'F') summary.finalsQualified = qualified(s);
  saveSeason(s);
  return summary;
}
