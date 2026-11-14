// Powershot – Karriere: eigener Spieler, Weltrangliste, Geld, Ausrüstung, Fähigkeiten

import { PLAYERS, TOURNAMENTS, SHOP, shopById } from './data.js';
import { createTournament, payout, simulateRest } from './tournament.js';

const KEY = 'powershot.karriere.v1';
const WEIGHT = { GS: 2, M: 1, F: 1.5 };

export function loadCareer() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
}
export function saveCareer(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* kein Speicher */ }
}
export function deleteCareer() {
  try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
}

// opts: { name, country, hand, look }
export function newCareer(opts) {
  const points = {};
  for (const p of PLAYERS) {
    // Punkte des "letzten Jahres" auf die Turniere verteilen
    const slots = TOURNAMENTS.filter((t) => t.cat !== 'F' || p.rank <= 8);
    const sum = slots.reduce((s, t) => s + WEIGHT[t.cat], 0);
    points[p.id] = {};
    for (const t of slots) points[p.id][t.id] = Math.round(p.basePoints * WEIGHT[t.cat] / sum);
  }
  points.me = {};
  return {
    v: 1, name: opts.name || 'Spieler', country: opts.country || 'GER', hand: opts.hand || 1, look: opts.look,
    skills: { s: 52, p: 52, t: 52, c: 52, v: 52 }, skillPoints: 10,
    xp: 0, level: 1, money: 50000,
    owned: [], equipped: {},
    season: 2026, week: 0, points, tournament: null, trainingLeft: 2,
    history: [], titles: 0, bestRank: 101,
  };
}

export function effectiveStats(c) {
  const st = { ...c.skills };
  for (const id of Object.values(c.equipped)) {
    const item = shopById(id);
    if (item) for (const k in item.bonus) st[k] += item.bonus[k];
  }
  for (const k in st) st[k] = Math.min(99, st[k]);
  return st;
}

// Dein Spieler in der Form, die das Match braucht
export function mePlayer(c) {
  const look = { ...c.look };
  const racket = shopById(c.equipped['Schläger']), shoes = shopById(c.equipped['Schuhe']);
  if (racket && racket.color) look.racket = racket.color;
  if (shoes && shoes.color) look.shoes = shoes.color;
  const parts = c.name.trim().split(' ');
  return { id: 'me', name: c.name, short: parts[parts.length - 1], country: c.country, stats: effectiveStats(c), hand: c.hand, look, me: true };
}

const total = (slots) => Object.values(slots || {}).reduce((s, v) => s + v, 0);

// Weltrangliste: sortierte Liste mit { id, name, country, points, rank, me }
export function ranking(c) {
  const list = PLAYERS.map((p) => ({ id: p.id, name: p.name, country: p.country, points: total(c.points[p.id]), ref: p }));
  list.push({ id: 'me', name: c.name, country: c.country, points: total(c.points.me), me: true, ref: mePlayer(c) });
  list.sort((a, b) => b.points - a.points || (a.me ? 1 : -1));
  list.forEach((p, i) => { p.rank = i + 1; });
  return list;
}

export function myRank(c) { return ranking(c).find((p) => p.me).rank; }
export function nextTournament(c) { return TOURNAMENTS[c.week]; }

// Wer spielt mit? Die Besten der Rangliste – und du (bei den ATP Finals nur, wenn du in den Top 8 bist)
export function entrants(c, def) {
  const r = ranking(c);
  if (def.cat === 'F') return r.slice(0, 8).map((p) => p.ref);
  const others = r.filter((p) => !p.me).slice(0, def.draw - 1);
  const me = r.find((p) => p.me);
  return [...others, me].sort((a, b) => a.rank - b.rank).map((p) => p.ref);
}

export function qualified(c, def) {
  return def.cat !== 'F' || myRank(c) <= 8;
}

export function startTournament(c) {
  const def = nextTournament(c);
  const list = entrants(c, def);
  const inIt = list.some((p) => p.id === 'me');
  c.tournament = createTournament(def, list, inIt ? 'me' : null);
  saveCareer(c);
  return c.tournament;
}

// Turnier abschließen: Punkte, Preisgeld, nächste Woche. Gibt eine Zusammenfassung zurück.
export function finishTournament(c) {
  const T = c.tournament;
  const def = TOURNAMENTS.find((t) => t.id === T.defId);
  if (!T.done) simulateRest(T);
  for (const id of Object.keys(T.players)) {
    if (!c.points[id]) c.points[id] = {};
    c.points[id][def.id] = payout(T, id).points;
  }
  const mine = T.humanId ? payout(T, 'me') : { points: 0, money: 0, label: null };
  if (!T.humanId) c.points.me[def.id] = 0;
  c.money += mine.money;
  if (mine.label === 'W') c.titles++;
  const summary = {
    season: c.season, tid: def.id, name: def.name, label: mine.label, points: mine.points, money: mine.money,
    champion: T.players[T.champion].name,
  };
  c.history.push(summary);
  c.tournament = null;
  c.trainingLeft = 2;
  c.week++;
  summary.seasonOver = c.week >= TOURNAMENTS.length;
  if (summary.seasonOver) { c.week = 0; c.season++; }
  const rk = myRank(c);
  c.bestRank = Math.min(c.bestRank, rk);
  summary.rank = rk;
  saveCareer(c);
  return summary;
}

// Erfahrung sammeln. Bei jedem neuen Level gibt es Fähigkeitspunkte.
export function addXp(c, n) {
  c.xp += Math.round(n);
  let ups = 0;
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level);
    c.level++;
    c.skillPoints += 3;
    ups++;
  }
  saveCareer(c);
  return ups;
}
export const xpNeed = (level) => 100 + level * 40;

export function raiseSkill(c, key) {
  if (c.skillPoints <= 0 || c.skills[key] >= 95) return false;
  c.skills[key]++;
  c.skillPoints--;
  saveCareer(c);
  return true;
}

export function buy(c, id) {
  const item = shopById(id);
  if (!item || c.owned.includes(id) || c.money < item.price) return false;
  c.money -= item.price;
  c.owned.push(id);
  c.equipped[item.cat] = id;
  saveCareer(c);
  return true;
}

export function equip(c, id) {
  const item = shopById(id);
  if (!item || !c.owned.includes(id)) return;
  c.equipped[item.cat] = c.equipped[item.cat] === id ? undefined : id;
  if (!c.equipped[item.cat]) delete c.equipped[item.cat];
  saveCareer(c);
}

export { SHOP };
