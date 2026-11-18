// Powershot – Turniere: K.-o.-Baum (Grand Slam, Masters) und ATP Finals (Gruppen + Halbfinale + Finale)

import { simulateMatch } from './rules.js';
import { overall, FINALS_POINTS, FINALS_MONEY, tournamentById } from './data.js';

// Setzliste: 1 und 2 können sich erst im Finale treffen
function seedOrder(n) {
  let o = [1];
  while (o.length < n) { const m = o.length * 2; o = o.flatMap((s) => [s, m + 1 - s]); }
  return o;
}

const roundLabel = (playersLeft) => ({ 128: 'R128', 64: 'R64', 32: 'R32', 16: 'R16', 8: 'QF', 4: 'SF', 2: 'F' }[playersLeft]);
const mischen = (liste) => { const l = [...liste]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const RR_PAIRS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

// entrants: Spieler, bester zuerst. humanId: wer bist du (oder null)
export function createTournament(def, entrants, humanId) {
  const players = {};
  entrants.forEach((p, i) => {
    players[p.id] = { id: p.id, name: p.name, short: p.short, country: p.country, ovr: overall(p.stats), seed: i + 1 };
  });
  const T = { defId: def.id, humanId, players, rounds: [], labels: [], done: false, champion: null, results: {}, format: def.cat === 'F' ? 'finals' : 'ko' };
  let ids = entrants.map((p) => p.id);
  if (T.format === 'ko') {
    // So wird in echt ausgelost: Nur die Besten sind "gesetzt" und stehen an festen Plätzen im Baum
    // (def.setz Spieler). Alle anderen werden zugelost.
    const setz = Math.min(def.setz || ids.length, ids.length);
    ids = [...ids.slice(0, setz), ...mischen(ids.slice(setz))];
    ids.forEach((id, i) => { players[id].seed = i < setz ? i + 1 : 0; });
    // Der Baum hat immer 2, 4, 8 … 128 Plätze. Spielen weniger mit (z. B. 96 statt 128), bleiben Plätze leer.
    // Wer gegen einen leeren Platz gelost wird, hat ein Freilos ("BYE") und ist ohne Match eine Runde weiter.
    // Die Freilose bekommen immer die am höchsten gesetzten Spieler.
    let size = 2;
    while (size < ids.length) size *= 2;
    T.size = size;
    T.bye = {};
    const order = seedOrder(size);
    const r = [];
    for (let i = 0; i < order.length; i += 2) {
      const a = ids[order[i] - 1] || null, b = ids[order[i + 1] - 1] || null;
      const m = { a: a || b, b: a ? b : null, winner: null, score: '' };
      if (!m.b) { m.winner = m.a; m.score = 'Freilos'; m.bye = true; T.bye[m.a] = true; }
      r.push(m);
    }
    T.rounds.push(r);
    T.labels.push(roundLabel(size));
    // Hast du selbst ein Freilos? Dann spielen die anderen ihre erste Runde gleich aus.
    if (humanId && T.bye[humanId]) playRound(T, null);
  } else {
    T.groups = [[ids[0], ids[3], ids[4], ids[7]], [ids[1], ids[2], ids[5], ids[6]]];
    T.rr = {};
    ids.forEach((id) => { T.rr[id] = { wins: 0, sets: 0 }; });
    T.sfWon = {}; T.stage = 0;
    pushRR(T);
  }
  return T;
}

function pushRR(T) {
  const pairs = RR_PAIRS[T.stage];
  const r = [];
  T.groups.forEach((g, gi) => pairs.forEach(([i, j]) => r.push({ a: g[i], b: g[j], winner: null, score: '', group: gi })));
  T.rounds.push(r);
  T.labels.push('RR');
}

export function currentRound(T) { return T.rounds[T.rounds.length - 1]; }
export function currentLabel(T) { return T.labels[T.labels.length - 1]; }

// Dein nächstes Match (oder null, wenn du raus bist oder das Turnier vorbei ist)
export function humanMatch(T) {
  if (T.done || !T.humanId) return null;
  return currentRound(T).find((m) => !m.winner && (m.a === T.humanId || m.b === T.humanId)) || null;
}

export function humanAlive(T) {
  return !!T.humanId && !T.done && currentRound(T).some((m) => m.a === T.humanId || m.b === T.humanId);
}

// Spielt die aktuelle Runde fertig. humanResult: { winner: id, score: '6:4 6:3' } für dein Match
export function playRound(T, humanResult) {
  if (T.done) return;
  const round = currentRound(T), label = currentLabel(T);
  for (const m of round) {
    if (m.winner) continue;
    if (!m.b) { m.winner = m.a; continue; }
    const mine = m.a === T.humanId || m.b === T.humanId;
    if (mine && humanResult) {
      m.winner = humanResult.winner; m.score = humanResult.score; m.setDiff = humanResult.setDiff ?? 1;
      m.humanFirst = true;   // dieses Ergebnis ist aus deiner Sicht geschrieben (deine Spiele zuerst)
    } else {
      const r = simulateMatch(T.players[m.a].ovr, T.players[m.b].ovr);
      m.winner = r.winner === 0 ? m.a : m.b; m.score = r.score;
      m.setDiff = Math.abs(r.sets.filter((s) => s[0] > s[1]).length - r.sets.filter((s) => s[1] > s[0]).length);
    }
    const loser = m.winner === m.a ? m.b : m.a;
    if (T.format === 'ko') {
      T.results[loser] = label;
      // Echte Regel: Wer ein Freilos hatte und sein erstes Match verliert, bekommt nur die Punkte der ersten Runde.
      if (T.bye && T.bye[loser] && T.rounds.length === 2) { T.erste = T.erste || {}; T.erste[loser] = T.labels[0]; }
    }
    else if (label === 'RR') {
      T.rr[m.winner].wins++; T.rr[m.winner].sets += m.setDiff; T.rr[loser].sets -= m.setDiff;
    } else if (label === 'SF') T.sfWon[m.winner] = true;
  }
  if (label === 'F') {
    T.done = true;
    T.champion = round[0].winner;
    T.results[T.champion] = 'W';
    return;
  }
  if (T.format === 'ko') {
    const next = [];
    for (let i = 0; i < round.length; i += 2) next.push({ a: round[i].winner, b: round[i + 1].winner, winner: null, score: '' });
    T.rounds.push(next);
    T.labels.push(roundLabel(next.length * 2));
    return;
  }
  // ATP Finals
  if (label === 'RR') {
    T.stage++;
    if (T.stage < 3) return pushRR(T);
    const top = T.groups.map((g) => [...g].sort((x, y) =>
      T.rr[y].wins - T.rr[x].wins || T.rr[y].sets - T.rr[x].sets || T.players[x].seed - T.players[y].seed));
    T.standings = top;
    T.rounds.push([
      { a: top[0][0], b: top[1][1], winner: null, score: '' },
      { a: top[1][0], b: top[0][1], winner: null, score: '' },
    ]);
    T.labels.push('SF');
  } else if (label === 'SF') {
    T.rounds.push([{ a: round[0].winner, b: round[1].winner, winner: null, score: '' }]);
    T.labels.push('F');
  }
}

export function simulateRest(T) {
  let guard = 0;
  while (!T.done && guard++ < 20) playRound(T, null);
}

// Was hat ein Spieler in diesem Turnier verdient?
// def: nur nötig, wenn das Turnier nicht in der Liste der Turniere steht
export function payout(T, id, def = tournamentById(T.defId)) {
  if (T.format === 'ko') {
    const label = T.results[id];
    if (!label) return { points: 0, money: 0, label: null };
    const fuerPunkte = (T.erste && T.erste[id]) || label;
    return { points: def.points[fuerPunkte] || 0, money: def.money[label] || 0, label };
  }
  if (!T.rr[id]) return { points: 0, money: 0, label: null };
  const w = T.rr[id].wins, sf = T.sfWon[id] ? 1 : 0, f = T.champion === id ? 1 : 0;
  return {
    points: w * FINALS_POINTS.RR + sf * FINALS_POINTS.SF + f * FINALS_POINTS.F,
    money: w * FINALS_MONEY.RR + sf * FINALS_MONEY.SF + f * FINALS_MONEY.F,
    label: f ? 'W' : sf ? 'F' : T.standings && T.standings.some((g) => g.indexOf(id) < 2 && g.includes(id)) ? 'SF' : 'RR',
  };
}
