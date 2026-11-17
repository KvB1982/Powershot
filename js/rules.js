// Powershot – Tennis-Zählweise: Punkte, Spiele, Sätze, Tiebreak, Aufschlagwechsel

const newStats = () => ({ points: 0, aces: 0, doubleFaults: 0, winners: 0, errors: 0, firstIn: 0, firstTotal: 0, topSpeed: 0 });

export class MatchScore {
  // cfg: { sets: Gewinnsätze, games: Spiele pro Satz, firstServer: 0|1 }
  constructor(cfg) {
    this.cfg = { sets: cfg.sets || 1, games: cfg.games || 6 };
    this.sets = [];            // fertige Sätze: [[6,4],[3,6]]
    this.setsWon = [0, 0];
    this.games = [0, 0];
    this.points = [0, 0];
    this.tiebreak = false;
    this.server = cfg.firstServer ?? 0;
    this.tbFirst = 0;
    this.serveNo = 1;          // 1 = erster Aufschlag, 2 = zweiter
    this.winner = null;
    this.stats = [newStats(), newStats()];
  }

  // 'deuce' = Aufschlag von rechts (gerade Punktzahl), 'ad' = von links
  get court() { return (this.points[0] + this.points[1]) % 2 === 0 ? 'deuce' : 'ad'; }

  // Ein Punkt für Seite w. Gibt eine Liste zurück, was dadurch passiert ist.
  pointTo(w) {
    const ev = ['point'];
    const l = 1 - w;
    this.points[w]++;
    this.stats[w].points++;
    this.serveNo = 1;
    if (this.tiebreak) {
      if (this.points[w] >= 7 && this.points[w] - this.points[l] >= 2) this.gameTo(w, ev);
      else if ((this.points[0] + this.points[1]) % 2 === 1) this.server = 1 - this.server;
    } else if (this.points[w] >= 4 && this.points[w] - this.points[l] >= 2) {
      this.gameTo(w, ev);
    }
    return ev;
  }

  gameTo(w, ev) {
    const l = 1 - w, N = this.cfg.games;
    const wasTb = this.tiebreak;
    this.games[w]++;
    this.points = [0, 0];
    ev.push('game');
    if (wasTb || (this.games[w] >= N && this.games[w] - this.games[l] >= 2)) {
      this.sets.push([...this.games]);
      this.setsWon[w]++;
      this.games = [0, 0];
      this.tiebreak = false;
      this.server = wasTb ? 1 - this.tbFirst : 1 - this.server;
      ev.push('set');
      if (this.setsWon[w] >= this.cfg.sets) { this.winner = w; ev.push('match'); }
      return;
    }
    this.server = 1 - this.server;
    if (this.games[0] === N && this.games[1] === N) {
      this.tiebreak = true;
      this.tbFirst = this.server;
      ev.push('tiebreak');
    }
  }

  // Was würde passieren, wenn Seite w den nächsten Punkt gewinnt? Probiert es an einer Kopie aus,
  // der echte Spielstand bleibt unverändert. Gibt z. B. ['point', 'game', 'set'] zurück.
  wennPunkt(w) {
    const k = new MatchScore(this.cfg);
    k.sets = this.sets.map((x) => [...x]);
    k.setsWon = [...this.setsWon]; k.games = [...this.games]; k.points = [...this.points];
    k.tiebreak = this.tiebreak; k.server = this.server; k.tbFirst = this.tbFirst;
    return k.pointTo(w);
  }

  // Ist der nächste Punkt ein besonders wichtiger? Gibt null zurück oder
  // { art: 'match' | 'satz' | 'break', wer: 0|1, anzahl } – anzahl = wie viele solche Bälle er hintereinander hat.
  // Matchball geht vor Satzball, Satzball geht vor Breakball.
  wichtigerPunkt() {
    if (this.winner !== null) return null;
    let best = null;
    const rang = { break: 1, satz: 2, match: 3 };
    for (const w of [0, 1]) {
      const ev = this.wennPunkt(w);
      if (!ev.includes('game')) continue;
      // Breakball: Der Rückschläger kann dem Aufschläger das Spiel wegnehmen (im Tiebreak gibt es das nicht)
      const art = ev.includes('match') ? 'match' : ev.includes('set') ? 'satz' : w !== this.server && !this.tiebreak ? 'break' : null;
      if (!art || (best && rang[best.art] >= rang[art])) continue;
      // Bei 40:0 sind es drei Bälle, bei 40:15 zwei, bei 40:30 oder Vorteil einer
      best = { art, wer: w, anzahl: Math.max(1, this.points[w] - this.points[1 - w]) };
    }
    return best;
  }

  // Der Hinweis als Text, z. B. "Breakball Sinner" oder "3 Matchbälle Alcaraz".
  // finale = true: Im Endspiel heißt der Matchball "Championship Point".
  wichtigText(names, finale = false) {
    const p = this.wichtigerPunkt();
    if (!p) return '';
    const eins = { break: 'Breakball', satz: 'Satzball', match: finale ? 'Championship Point' : 'Matchball' }[p.art];
    const viele = { break: 'Breakbälle', satz: 'Satzbälle', match: finale ? 'Championship Points' : 'Matchbälle' }[p.art];
    return (p.anzahl > 1 ? `${p.anzahl} ${viele}` : eins) + ' ' + names[p.wer];
  }

  // Punkte-Anzeige für beide Seiten, z. B. ['40', 'A']
  pointLabels() {
    const [a, b] = this.points;
    if (this.tiebreak) return [String(a), String(b)];
    const z = ['0', '15', '30', '40'];
    if (a >= 3 && b >= 3) {
      if (a === b) return ['40', '40'];
      return a > b ? ['A', '40'] : ['40', 'A'];
    }
    return [z[a], z[b]];
  }

  // Ansage des Schiedsrichters (Punktzahl des Aufschlägers zuerst)
  callText(names) {
    const s = this.server, r = 1 - s;
    const [a, b] = [this.points[s], this.points[r]];
    if (this.tiebreak) return a === b ? `${a} beide` : `${Math.max(a, b)} zu ${Math.min(a, b)}, ${names[a > b ? s : r]}`;
    if (a >= 3 && b >= 3) return a === b ? 'Einstand' : `Vorteil ${names[a > b ? s : r]}`;
    const z = ['null', '15', '30', '40'];
    return a === b ? `${z[a]} beide` : `${z[a]} ${z[b]}`;
  }

  // "6:4 3:6 2:1"
  scoreLine(withCurrent = true) {
    const parts = this.sets.map((s) => `${s[0]}:${s[1]}`);
    if (withCurrent && this.winner === null) parts.push(`${this.games[0]}:${this.games[1]}`);
    return parts.join('  ');
  }
}

// Ein Match nur ausrechnen (für Spiele ohne dich). ra, rb = Gesamtstärke.
export function simulateMatch(ra, rb, setsToWin = 2, games = 6, rnd = Math.random) {
  const p = 1 / (1 + Math.exp(-(ra - rb) / 5.5));
  const won = [0, 0], sets = [];
  while (won[0] < setsToWin && won[1] < setsToWin) {
    const w = rnd() < p ? 0 : 1;
    const r = rnd();
    let ws = games, ls;
    if (r < 0.14) { ws = games + 1; ls = games; }                 // Tiebreak
    else if (r < 0.28) { ws = games + 1; ls = games - 1; }        // 7:5
    else ls = Math.min(games - 2, Math.floor(Math.pow(rnd(), 0.7) * (games - 1)));
    ls = Math.max(0, ls);
    sets.push(w === 0 ? [ws, ls] : [ls, ws]);
    won[w]++;
  }
  return { winner: won[0] > won[1] ? 0 : 1, sets, score: sets.map((s) => `${s[0]}:${s[1]}`).join(' ') };
}
