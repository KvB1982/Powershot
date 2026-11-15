// Powershot – das laufende Match: Aufschlag, Ballwechsel, Regeln, Computergegner.
// Diese Datei kennt keine Grafik. Sie meldet alles über "fx" an die Anzeige.

import { COURT as C, SURFACES, Ball, solveSafe, solveShot, predict, gauss } from './physics.js';
import { MatchScore } from './rules.js';
import { DIFFICULTY } from './data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const NOFX = new Proxy({}, { get: () => () => {} });
const REACH = 1.4;          // so weit reicht man mit dem Schläger (Meter)
export const TOSS_TIME = 1.4;      // Dauer der Aufschlagbewegung vom Stand bis zum Treffpunkt
const WALK_SPEED = 2.0;            // Gehen beim Seitenwechsel (m/s) – zügiges Gehen, kein Laufen
const CHANGEOVER_TIME = 6.4;       // Dauer des Seitenwechsels (s)
export const TOSS_FLIGHT = 0.85;   // so lange fliegt der Ball frei, bevor er getroffen wird (davor ist er in der Hand)

export class Match {
  // cfg: { players:[a,b], human:0|null, surface, difficulty, sets, games,
  //        mode:'match'|'ballmaschine'|'aufschlag', assist:'voll'|'seitlich'|'aus', controlMode }
  constructor(cfg, fx = NOFX, controls = null) {
    this.cfg = cfg;
    this.fx = fx;
    this.controls = controls;
    this.diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.mittel;
    this.surface = SURFACES[cfg.surface] || SURFACES.hard;
    this.mode = cfg.mode || 'match';
    this.score = new MatchScore({ sets: cfg.sets, games: cfg.games, firstServer: this.mode === 'match' ? (Math.random() < 0.5 ? 0 : 1) : 0 });
    this.P = [this.mkPlayer(0, cfg.players[0]), this.mkPlayer(1, cfg.players[1])];
    this.ball = new Ball();
    this.pred = null;
    this.state = 'intro';
    this.timer = 1.2;
    this.rally = 0;
    this.training = { balls: this.mode === 'aufschlag' ? 12 : 20, done: 0, score: 0, zones: [] };
    this.lastPoint = null;
  }

  mkPlayer(side, data) {
    const isHuman = this.cfg.human === side;
    // Der Computer hat eine Tagesform: mal etwas besser, mal etwas schlechter
    const k = isHuman ? 1 : this.diff.aiStat * (0.95 + Math.random() * 0.1);
    const q = (v) => clamp((v * k - 40) / 60, 0.03, 1);
    const st = data.stats;
    const dz = side === 0 ? 1 : -1;
    return {
      side, data, isHuman, dz, hand: data.hand || 1,
      s: q(st.s), p: q(st.p), t: q(st.t), c: q(st.c), v: q(st.v),
      maxSpeed: 4.1 + 2.6 * q(st.t), accel: 11 + 8 * q(st.t),
      x: 0, z: dz * (C.L + 0.6), vx: 0, vz: 0,
      homeX: 0, homeZ: C.L + 0.7, netRush: false,
      plan: null, planAge: 9, react: 0, missed: false, lastDist: 99,
      stroke: 'fh', prep: 0, mood: null,
    };
  }

  get court() {
    if (this.mode === 'aufschlag') return this.training.done % 2 === 0 ? 'deuce' : 'ad';
    return this.score.court;
  }

  // ---------------------------------------------------------------
  // Hauptschleife
  // ---------------------------------------------------------------
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    this.timer -= dt;
    const st = this.state;

    if (st === 'intro') {
      if (this.timer <= 0) this.next();
    } else if (st === 'changeover') {
      // Seitenwechsel: beide gehen zur Bank neben dem Schiedsrichterstuhl
      for (const p of this.P) {
        const tx = -(C.NET_W + 0.7), tz = p.dz * 4;
        const dx = tx - p.x, dzz = tz - p.z, dist = Math.hypot(dx, dzz);
        const v = Math.min(WALK_SPEED, dist * 4);
        p.vx = dist > 0.05 ? dx / dist * v : 0; p.vz = dist > 0.05 ? dzz / dist * v : 0;
        p.x += p.vx * dt; p.z += p.vz * dt;
      }
      if (this.timer <= 0) this.setupServe();
    } else if (st === 'serveReady') {
      this.updateServeReady();
    } else if (st === 'toss') {
      this.tossT += dt;
      const srv = this.P[this.server];
      this.ball.pos = this.tossPos(srv, this.tossT);
      this.fx.toss(srv.side, clamp(this.tossT / TOSS_TIME, 0, 1));
      if (this.tossT >= TOSS_TIME) this.doServe();
    } else if (st === 'rally' || st === 'pointOver' || st === 'faultPause' || st === 'feedWait') {
      this.sinceHit += dt;
      const ev = this.ball.step(dt, this.surface);
      for (const e of ev) this.onBallEvent(e);
      this.checkWalls();
      for (const p of this.P) this.movePlayer(p, dt);
      if (this.state === 'rally') {
        for (const p of this.P) this.tryHit(p);
        // Sicherheitsnetz: Ball liegt still oder ist weit weg, ohne dass der Punkt entschieden ist
        if (this.state === 'rally' && (!this.ball.live || Math.abs(this.ball.pos.z) > 40 || Math.abs(this.ball.pos.x) > 30)) {
          this.ballDead(this.ball.bounces >= 1 ? this.ball.lastHitter : 1 - this.ball.lastHitter, 'aus');
        }
      } else if (this.timer <= 0) {
        this.next();
      }
    }
  }

  // Der Ball prallt von der Bande ab. Für die Regeln zählt das wie ein Aufprall außerhalb.
  checkWalls() {
    const b = this.ball, p = b.pos;
    if (!b.live || (Math.abs(p.z) < 19.2 && Math.abs(p.x) < 10.2)) return;
    p.z = clamp(p.z, -19.2, 19.2); p.x = clamp(p.x, -10.2, 10.2);
    if (Math.abs(p.z) >= 19.2) b.vel.z *= -0.25; else b.vel.x *= -0.25;
    b.vel.x *= 0.6; b.vel.z *= 0.6;
    this.fx.net('wall');
    if (this.state === 'rally') {
      const n = b.bounces === 0 ? 1 : 2;
      b.bounces = Math.max(b.bounces, n);
      this.onBallEvent({ type: 'bounce', x: p.x, z: p.z, n, speed: 6, wall: true });
    }
  }

  // Nach einer Pause: Wie geht es weiter?
  next() {
    if (this.mode !== 'match') {
      if (this.training.done >= this.training.balls) {
        this.state = 'over';
        this.fx.trainingOver(this.training);
        return;
      }
      if (this.mode === 'ballmaschine') return this.feed();
      return this.setupServe();
    }
    if (this.score.winner !== null) {
      this.state = 'over';
      this.fx.matchOver(this.score);
      return;
    }
    if (this.changeoverDue()) {
      this.state = 'changeover';
      this.timer = CHANGEOVER_TIME;
      for (const p of this.P) { p.mood = null; p.plan = null; p.prep = 0; }
      this.ball.live = false;
      this.fx.message('Seitenwechsel', 'info');
      return;
    }
    this.setupServe();
  }

  // Seitenwechsel gibt es wie im echten Tennis nach jedem ungeraden Spiel eines Satzes (1., 3., 5. …).
  // (Die Seiten selbst werden im Spiel nicht getauscht – du spielst immer unten.)
  changeoverDue() {
    const lp = this.lastPoint, sc = this.score;
    if (!lp || !lp.events.includes('game') || this.cfg.changeover === false) return false;
    const set = lp.events.includes('set') ? sc.sets[sc.sets.length - 1] : sc.games;
    return !!set && (set[0] + set[1]) % 2 === 1;
  }

  // ---------------------------------------------------------------
  // Aufschlag
  // ---------------------------------------------------------------
  setupServe() {
    const s = this.mode === 'match' ? this.score.server : 0;
    this.server = s;
    const srv = this.P[s], rec = this.P[1 - s];
    const right = this.court === 'deuce' ? 1 : -1;
    srv.x = right * srv.dz * 1.1; srv.z = srv.dz * (C.L + 0.35);
    rec.x = right * rec.dz * 2.6; rec.z = rec.dz * (C.L + 1.0);
    const bs = -right * srv.dz;      // auf welcher Seite (x) liegt das Aufschlagfeld?
    this.serveBox = { x0: Math.min(0, bs * C.W), x1: Math.max(0, bs * C.W), sign: bs, zs: -srv.dz };
    for (const p of this.P) {
      p.vx = p.vz = 0; p.plan = null; p.missed = false; p.prep = 0; p.mood = null;
      p.netRush = false; p.homeX = 0; p.homeZ = C.L + 0.7;
    }
    this.ball.live = false;
    this.ball.pos = this.tossPos(srv, 0);
    this.pred = null;
    this.rally = 0;
    this.netHit = false;
    this.state = 'serveReady';
    this.timer = srv.isHuman ? 0 : 1.3;
    if (srv.isHuman && this.controls) this.controls.begin('serve');
    this.fx.serveSetup({ server: s, serveNo: this.score.serveNo, box: this.serveBox });
    if (this.mode === 'aufschlag') this.makeServeZones();
  }

  updateServeReady() {
    const srv = this.P[this.server];
    this.ball.pos = this.tossPos(srv, 0);
    if (srv.isHuman) {
      const raw = this.controls && this.controls.takeServe();
      if (raw) this.startToss(this.humanIntent(srv, raw, true));
    } else if (this.timer <= 0) {
      this.startToss(this.aiServe(srv));
    }
  }

  startToss(intent) {
    this.serveIntent = intent;
    this.tossT = 0;
    this.state = 'toss';
  }

  // Wo ist der Ball beim Hochwerfen? t = Sekunden seit Beginn
  tossPos(p, t) {
    // Erst hebt die Hand den Ball an, dann fliegt er frei: hoch bis etwa 3,2 m und zurück auf 2,75 m
    const tr = TOSS_TIME - TOSS_FLIGHT, s = t - tr;
    const lift = clamp((t - 0.15) / (tr - 0.15), 0, 1);
    const up = s < 0 ? 0.8 + 0.86 * lift * lift : 1.66 + 5.45 * s - 4.905 * s * s;
    const k = clamp(t / TOSS_TIME, 0, 1);
    return { x: p.x - p.hand * p.dz * 0.22 * (1 - k), y: up, z: p.z - p.dz * (0.3 + 0.1 * k) };
  }

  doServe() {
    const p = this.P[this.server];
    const sc = this.score;
    const from = this.tossPos(p, TOSS_TIME);
    const shot = this.buildShot(p, this.serveIntent, { from, stretch: 0, serveNo: sc.serveNo, incoming: 0 });
    if (this.mode === 'match' && sc.serveNo === 1) sc.stats[p.side].firstTotal++;
    this.state = 'rally';
    this.launch(p, from, shot, true);
    this.fx.swing(p.side, 'sv', from.y);
    this.fx.hit({ side: p.side, speed: shot.speed, power: 1, type: 'serve' });
  }

  aiServe(p) {
    const first = this.score.serveNo === 1;
    const r = Math.random();
    const bs = this.serveBox.sign;
    const edge = 0.45 + (1 - p.s) * 0.9;              // schwächere Aufschläger zielen weniger an die Linie
    const x = bs * (r < 0.42 ? C.W - edge : r < 0.84 ? edge : C.W / 2);
    return { type: 'serve', x, d: C.SL - (first ? 0.45 : 1.0) - Math.random() * 0.8, power: first ? 0.82 + 0.18 * Math.random() : 0.45 };
  }

  // ---------------------------------------------------------------
  // Schlag ausrechnen
  // ---------------------------------------------------------------

  // Aus der Eingabe (Steuerung) wird ein Schlagziel
  humanIntent(p, raw, isServe) {
    const pw = raw.power ?? 0.6;
    const p01 = clamp(pw, 0.05, 1);
    if (isServe) {
      const bs = this.serveBox.sign;
      const x = bs * (C.W / 2) + clamp(raw.aim || 0, -1, 1) * (C.W / 2 - 0.3);
      const d = raw.depth != null ? C.SL * raw.depth : C.SL * (0.45 + 0.5 * pw);
      return { type: 'serve', x, d, power: p01 };
    }
    let type = raw.type || 'drive';
    let d = raw.depth != null ? C.L * raw.depth : C.L * (0.25 + 0.68 * pw);
    if (type === 'lob') d = C.L * 0.84;
    if (type === 'drop') d = 2.4;
    let x;
    if (raw.aimMode === 'angle') {
      const ang = (raw.aim || 0) * 35 * Math.PI / 180;
      x = p.x + Math.tan(ang) * (Math.abs(p.z) + d);
    } else {
      x = (raw.aim || 0) * (C.W - 0.45);
    }
    if (this.diff.clampIn) x = clamp(x, -(C.W - 0.4), C.W - 0.4);
    if (this.diff.autoReturn) d = Math.min(d, C.L - 0.6);
    return { type, x, d, power: p01 };
  }

  // Wohin würde der Schlag mit der aktuellen Eingabe gehen? (für die Ziel-Anzeige)
  previewTarget() {
    const p = this.P[0];
    if (!p.isHuman || !this.controls) return null;
    const serving = (this.state === 'serveReady' || this.state === 'toss') && this.server === 0;
    let raw = this.controls.peek(serving);
    if (!raw) return null;
    if (raw.idle) raw = { ...raw, power: 0.85 };
    if (serving && this.state === 'toss') return null;
    if (!serving && !(this.state === 'rally' && this.ball.lastHitter === 1 && !p.missed)) return null;
    const it = this.humanIntent(p, raw, serving);
    return { x: it.x, z: -it.d, type: it.type, committed: !!raw.committed, power: raw.power ?? 0 };
  }

  buildShot(p, intent, o) {
    const d = this.diff;
    const sigK = p.isHuman ? d.meSigma : d.aiSigma;
    const netK = p.isHuman ? d.meNet : 1;
    const pw = clamp(intent.power ?? 0.6, 0.05, 1);
    let type = intent.type, vh, spin, clear, sigma, pNet, ctl = p.c;
    let tx = intent.x, td = intent.d;

    if (type === 'serve') {
      const first = o.serveNo === 1;
      vh = (35 + 23 * p.s) * (0.72 + 0.28 * pw) * (first ? 1 : 0.8);
      spin = first ? 0.25 : 0.9;
      clear = first ? 0.1 : 0.25;
      sigma = (0.24 + (1 - p.s) * 0.8) * (0.35 + pw * pw) * (first ? 1 : 0.5);
      pNet = (0.02 + 0.09 * pw * (1 - p.s * 0.6)) * (first ? 1 : 0.35);
    } else {
      if (o.volley && (type === 'drive' || type === 'slice')) type = o.from.y > 2.0 ? 'smash' : 'volley';
      else if (type === 'drive' && o.from.y > 2.1) type = 'smash';
      if (type === 'drive') { vh = (23 + 17 * p.p) * (0.55 + 0.45 * pw); spin = 0.7; clear = 0.3 - 0.15 * pw; }
      else if (type === 'slice') { vh = (16 + 7 * p.p) * (0.7 + 0.3 * pw); spin = -0.6; clear = 0.25; }
      else if (type === 'drop') { vh = 9.5; spin = -0.8; clear = 0.3; td = clamp(td, 1.5, 4); }
      else if (type === 'lob') { vh = 11.5; spin = 0.3; clear = 1.5; }
      else if (type === 'volley') { vh = (17 + 11 * p.p) * (0.6 + 0.4 * pw); spin = -0.2; clear = 0.2; ctl = p.v; }
      else { vh = 32 + 12 * p.p; spin = 0; clear = 0.15; ctl = (p.v + p.c) / 2; }   // Schmetterball
      sigma = (0.15 + (1 - ctl) * 0.9) * (0.45 + 0.7 * pw + 2.0 * o.stretch + 0.35 * (o.incoming / 40));
      vh *= 1 - 0.3 * o.stretch;         // aus der Bedrängnis wird der Schlag schwächer
      pNet = 0.012 + 0.04 * sigma;
    }
    sigma *= sigK; pNet *= netK;
    tx += gauss() * sigma;
    td += gauss() * sigma * 1.3;
    if (p.isHuman && d.autoReturn && type !== 'serve') {   // Stufe "Leicht": deine Bälle bleiben drin
      tx = clamp(tx, -(C.W - 0.2), C.W - 0.2);
      td = Math.min(td, C.L - 0.3);
    }
    td = Math.max(0.9, td);
    let target = { x: tx, y: 0, z: -p.dz * td };
    let sol;
    if (Math.random() < pNet) {
      // Netzfehler: flach und zu kurz gezielt
      sol = solveShot(o.from, { x: tx, y: 0, z: -p.dz * 1.0 }, Math.max(vh, 24), 0);
      if (sol.clearance > -0.05) sol = solveShot(o.from, { x: tx, y: 0, z: p.dz * 0.5 }, Math.max(vh, 24), 0);
    } else {
      sol = solveSafe(o.from, target, vh, spin, clear);
    }
    const v = sol.vel;
    return { vel: v, spin, speed: Math.hypot(v.x, v.y, v.z), type, target };
  }

  // Ball losschicken und alles vorbereiten, was danach gebraucht wird
  launch(p, from, shot, isServe) {
    this.ball.launch(from, shot.vel, shot.spin, p.side, isServe);
    this.sinceHit = 0;
    this.netHit = false;
    this.rally++;
    this.lastShot = shot;
    this.pred = predict(this.ball, this.surface);
    const f = this.pred.first;
    this.predIn = !!f && !this.pred.net && this.inArea(f.x, f.z, p.side, isServe);
    const opp = this.P[1 - p.side];
    opp.plan = null; opp.planAge = 9; opp.missed = false; opp.lastDist = 99;
    opp.react = opp.isHuman ? 0.04 : this.diff.aiReact * (1.15 - 0.3 * opp.t) * (isServe ? 0.65 : 1);
    p.plan = null; p.prep = 0;
    p.homeX = f ? clamp(f.x * 0.2, -1.2, 1.2) : 0;
    p.homeZ = p.netRush ? 3.2 : C.L + 0.7;
    if (opp.isHuman && this.controls) this.controls.begin('rally');
    this.fx.landing(opp.isHuman && this.diff.marker && f && !this.pred.net ? { x: f.x, z: f.z, in: this.predIn } : null);
  }

  inArea(x, z, hitter, isServe) {
    const tol = 0.04;
    const ts = -this.P[hitter].dz;         // auf dieser Seite muss der Ball landen
    if (z * ts <= 0) return false;
    if (isServe) {
      const b = this.serveBox;
      return Math.abs(z) <= C.SL + tol && x >= b.x0 - tol && x <= b.x1 + tol;
    }
    return Math.abs(x) <= C.W + tol && Math.abs(z) <= C.L + tol;
  }

  // ---------------------------------------------------------------
  // Regeln: Was passiert, wenn der Ball aufkommt?
  // ---------------------------------------------------------------
  onBallEvent(e) {
    if (e.type === 'net' || e.type === 'cord') {
      this.netHit = e.type === 'net' || this.netHit;
      this.fx.net(e.type);
      return;
    }
    const b = this.ball;
    const hitter = b.lastHitter;
    const ok = e.n === 1 ? this.inArea(e.x, e.z, hitter, b.isServe) : true;
    this.fx.bounce({ x: e.x, z: e.z, n: e.n, in: ok, speed: e.speed });
    if (this.state !== 'rally') return;

    if (e.n === 1) {
      if (this.mode !== 'match' && hitter === 0) return this.trainingResult(e, ok);
      if (!ok) {
        if (b.isServe) return this.fault();
        return this.pointEnd(1 - hitter, this.netHit ? 'netz' : 'aus');
      }
      if (b.isServe && this.score.serveNo === 1) this.score.stats[hitter].firstIn++;
    } else if (e.n >= 2) {
      this.ballDead(hitter, b.isServe ? 'ass' : 'winner');
    }
  }

  ballDead(winner, reason) {
    if (this.mode !== 'match') {
      // Training: Ball ist tot, der nächste kommt
      if (this.state === 'rally') {
        if (this.ball.lastHitter === 1) {        // den zugespielten Ball nicht erwischt
          this.training.done++;
          this.fx.trainingUpdate(this.training, 0, false);
        }
        this.state = 'feedWait'; this.timer = 0.9;
      }
      return;
    }
    this.pointEnd(winner, reason);
  }

  fault() {
    const sc = this.score;
    if (sc.serveNo === 1) {
      sc.serveNo = 2;
      this.state = 'faultPause';
      this.timer = 1.5;
      this.fx.fault(1, this.netHit ? 'netz' : 'aus');
    } else {
      this.pointEnd(1 - this.server, 'doppelfehler');
    }
  }

  pointEnd(winner, reason) {
    if (this.state !== 'rally') return;
    const sc = this.score, loser = 1 - winner;
    if (reason === 'ass') sc.stats[winner].aces++;
    else if (reason === 'winner') sc.stats[winner].winners++;
    else if (reason === 'doppelfehler') sc.stats[loser].doubleFaults++;
    else sc.stats[loser].errors++;
    const events = sc.pointTo(winner);
    this.state = 'pointOver';
    const big = events.includes('game');
    this.timer = events.includes('match') ? 3.5 : big ? 3.2 : 2.3;
    this.P[winner].mood = big ? 'cheer' : null;
    this.P[loser].mood = events.includes('set') ? 'sad' : null;
    this.lastPoint = { winner, reason, events, rally: this.rally };
    this.fx.point(this.lastPoint);
  }

  // ---------------------------------------------------------------
  // Spieler bewegen und schlagen
  // ---------------------------------------------------------------
  movePlayer(p, dt) {
    const b = this.ball;
    const incoming = this.state === 'rally' && b.live && b.lastHitter !== p.side && b.bounces < 2 && !p.missed;
    const assist = p.isHuman ? (this.cfg.assist || 'voll') : 'voll';
    if (p.noHit) { p.vx = p.vz = 0; return; }

    if (incoming) {
      p.react -= dt;
      p.planAge += dt;
      if (p.react <= 0 && p.planAge > 0.18) {
        p.plan = this.planIntercept(p, assist === 'seitlich');
        p.planAge = 0;
      }
      const dist = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
      p.prep = clamp((10 - dist) / 6, 0, 1);
      if (p.plan) p.stroke = p.plan.stroke;
    } else {
      p.plan = null;
      p.prep = Math.max(0, p.prep - dt * 4);
    }

    let tx = p.homeX, tz = p.dz * p.homeZ;
    if (incoming && p.plan && assist !== 'aus') { tx = p.plan.sx; tz = p.plan.sz; }
    else if (incoming && assist === 'aus') { tx = p.x; tz = p.z; }
    if (this.state !== 'rally') { tx = p.x; tz = p.z; }

    let dx = tx - p.x, dzz = tz - p.z;
    let dist = Math.hypot(dx, dzz);
    let k = dist > 0.01 ? Math.min(p.maxSpeed, dist * 7) / dist : 0;
    let wx = dx * k, wz = dzz * k;

    // Eigene Eingabe geht vor
    if (p.isHuman && this.controls && this.state === 'rally') {
      const m = this.controls.move();
      if (Math.abs(m.x) > 0.15) wx = m.x * p.maxSpeed;
      if (Math.abs(m.f) > 0.15) {
        wz = -m.f * p.maxSpeed;
        p.homeZ = clamp(p.z, 2.5, C.L + 2.5);
      } else if (assist === 'seitlich') {
        wz = 0;
      }
      if (assist === 'aus') { if (Math.abs(m.x) <= 0.15) wx = 0; if (Math.abs(m.f) <= 0.15) wz = 0; }
    }

    // Beschleunigen dauert einen Moment – wie bei echten Spielern
    const ax = wx - p.vx, az = wz - p.vz, al = Math.hypot(ax, az), am = p.accel * dt;
    if (al <= am) { p.vx = wx; p.vz = wz; } else { p.vx += ax / al * am; p.vz += az / al * am; }
    p.x = clamp(p.x + p.vx * dt, -9, 9);
    p.z = p.dz * clamp((p.z + p.vz * dt) * p.dz, 0.9, C.L + 6);
  }

  // Wo kann der Spieler den Ball am besten erwischen?
  planIntercept(p, fixedZ) {
    if (!this.pred) return null;
    const now = this.sinceHit, b = this.ball;
    const nearNet = Math.abs(p.z) < 6.5 || p.netRush;
    let best = null, bs = 1e9;
    for (const s of this.pred.pts) {
      if (s.t < now + 0.03) continue;
      if (s.b >= 2) break;
      if (s.z * p.dz < 0.4 || s.y > 2.5) continue;
      const volley = s.b === 0;
      if (volley && (b.isServe || !this.predIn || !nearNet)) continue;
      const fh = (s.x - p.x) * p.dz * p.hand >= -0.35;
      const side = (fh ? 1 : -1) * p.hand * p.dz;
      let sx = s.x - side * 0.62, sz = s.z + p.dz * 0.12;
      if (fixedZ) {
        if ((s.z - p.z) * p.dz < -0.2) continue;       // Ball ist noch nicht auf meiner Höhe
        sz = p.z;
      }
      sx = clamp(sx, -8.8, 8.8);
      sz = p.dz * clamp(sz * p.dz, 0.9, C.L + 5.8);
      const need = Math.hypot(sx - p.x, sz - p.z);
      const time = s.t - now;
      const lack = Math.max(0, need - p.maxSpeed * Math.max(0, time - 0.17) * 0.95 - 0.15);
      let score = lack * 50 + Math.abs(s.y - 0.95) * 1.5 + time * 0.4 + (volley ? 0.2 : 0);
      if (s.y < 0.3) score += 1.5;
      score += Math.max(0, s.z * p.dz - (C.L + 3.5)) * 2;
      if (fixedZ) score = lack * 50 + Math.abs((s.z - p.z)) * 3;
      if (score < bs) {
        bs = score;
        best = { x: s.x, y: s.y, z: s.z, t: s.t, b: s.b, sx, sz, lack, stroke: fh ? 'fh' : 'bh' };
      }
    }
    return best;
  }

  tryHit(p) {
    const b = this.ball;
    if (!b.live || b.lastHitter === p.side || p.missed || p.noHit || b.bounces >= 2) return;
    if (b.pos.z * p.dz <= 0.15) return;
    const volley = b.bounces === 0;
    const profi = p.isHuman && this.cfg.controlMode === 'profi';
    if (volley) {
      if (b.isServe) return;
      if (!this.predIn && !profi) return;
      if (p.plan && p.plan.b >= 1 && !(p.isHuman && this.cfg.assist === 'aus')) return;
    }
    const dist = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
    const receding = dist > p.lastDist + 1e-5;
    p.lastDist = dist;
    const reach = b.isServe ? REACH + 0.3 : REACH;      // beim Return streckt man sich weiter
    if (dist > reach || b.pos.y > 2.75 || b.pos.y < 0.1) return;
    const passed = (b.pos.z - p.z) * p.dz > 0.15;
    if (!(dist <= 0.85 || receding || passed)) return;

    const from = { x: b.pos.x, y: Math.max(b.pos.y, 0.25), z: b.pos.z };
    let stretch = clamp((dist - 0.75) / (reach - 0.75), 0, 1);
    if (!volley && (from.y < 0.4 || from.y > 1.9)) stretch = Math.min(1, stretch + 0.25);
    const fh = (b.pos.x - p.x) * p.dz * p.hand >= 0;
    const o = { from, stretch, volley, incoming: Math.hypot(b.vel.x, b.vel.y, b.vel.z) };

    let intent;
    if (p.isHuman) {
      let raw = this.controls ? this.controls.consume() : null;
      if (!raw && this.diff.autoReturn) raw = { type: 'drive', aimMode: 'abs', aim: 0, depth: 0.7, power: 0.5 };
      if (!raw) {
        p.missed = true;
        this.fx.message('Zu spät!', 'warn');
        return;
      }
      intent = this.humanIntent(p, raw, false);
    } else {
      intent = this.aiShot(p, o);
    }
    const shot = this.buildShot(p, intent, o);
    const kind = shot.type === 'smash' ? 'sv' : fh ? 'fh' : 'bh';
    this.launch(p, from, shot, false);
    this.fx.swing(p.side, kind, from.y, shot.type);
    this.fx.hit({ side: p.side, speed: shot.speed, power: intent.power, type: shot.type });
  }

  // Der Computer entscheidet, wohin er spielt
  aiShot(p, o) {
    if (this.mode === 'ballmaschine') return this.feedIntent();
    const opp = this.P[1 - p.side];
    const r = Math.random();
    const oppAtNet = Math.abs(opp.z) < 5;
    const inside = Math.abs(p.z) < C.L - 2;
    const margin = 0.3 + (1 - p.c) * 1.0 + o.stretch * 0.5;
    const away = opp.x >= 0 ? -1 : 1;                 // weg vom Gegner
    const wide = Math.max(0.5, C.W - margin);
    let type = 'drive', x, d, power = 0.6 + 0.4 * Math.random();

    if (o.stretch > 0.75) {
      type = r < 0.5 ? 'slice' : 'lob';
      x = (Math.random() - 0.5) * 3; d = C.L * 0.72; power = 0.4;
    } else if (oppAtNet && r < 0.4) {
      type = 'lob'; x = away * wide * 0.6; d = C.L * 0.85;
    } else if (!oppAtNet && Math.abs(opp.z) > C.L + 1.5 && inside && r < 0.08 + 0.1 * p.c) {
      type = 'drop'; x = away * wide * 0.7; d = 2.5;
    } else {
      const smart = Math.random() < 0.35 + 0.5 * p.c;
      x = (smart ? away : (Math.random() < 0.5 ? -1 : 1)) * wide * (0.6 + 0.4 * Math.random());
      d = C.L * (0.7 + 0.22 * Math.random());
      if (inside) power = Math.min(1, power + 0.15);
      power -= o.stretch * 0.3;
    }
    if (inside && !p.netRush && p.v > 0.5 && Math.random() < 0.3 * p.v && type === 'drive') p.netRush = true;
    return { type, x, d, power: clamp(power, 0.2, 1) };
  }

  // ---------------------------------------------------------------
  // Training
  // ---------------------------------------------------------------
  feed() {
    // Ballmaschine: der Gegner spielt dir einen Ball zu
    const ai = this.P[1], me = this.P[0];
    const tr = this.training;
    if (!tr.zones.length) {
      tr.zones = [
        { x0: -C.W, x1: -C.W + 2, z0: -C.L, z1: -C.L + 3.2, pts: 5 },
        { x0: C.W - 2, x1: C.W, z0: -C.L, z1: -C.L + 3.2, pts: 5 },
        { x0: -1.1, x1: 1.1, z0: -C.L, z1: -C.L + 2.4, pts: 3 },
      ];
      me.x = 0; me.z = C.L + 0.7; ai.x = 0; ai.z = -(C.L + 0.5);
      this.fx.zones(tr.zones);
    }
    ai.noHit = true;
    me.missed = false; me.plan = null;
    this.server = 1;
    this.serveBox = { x0: -C.W, x1: C.W, sign: 1, zs: 1 };
    this.state = 'rally';
    const from = { x: ai.x + 0.5, y: 0.9, z: ai.z + 0.4 };
    const shot = this.buildShot(ai, this.feedIntent(), { from, stretch: 0, incoming: 0 });
    this.launch(ai, from, shot, false);
    this.fx.swing(1, 'fh', 0.9);
    this.fx.hit({ side: 1, speed: shot.speed, power: 0.5, type: 'drive' });
    this.fx.trainingUpdate(tr);
  }

  feedIntent() {
    const hard = { leicht: 0.25, mittel: 0.4, schwer: 0.55, profi: 0.7 }[this.cfg.difficulty] ?? 0.4;
    return { type: 'drive', x: (Math.random() - 0.5) * (3 + hard * 5), d: C.L * (0.6 + 0.25 * Math.random()), power: hard };
  }

  makeServeZones() {
    const b = this.serveBox, zs = b.zs;
    const zr = [zs * (C.SL - 2.2), zs * C.SL].sort((a, c) => a - c);
    const wideX = b.sign * (C.W - 1.2), wideX2 = b.sign * C.W;
    const tX = 0, tX2 = b.sign * 1.2;
    this.training.zones = [
      { x0: Math.min(wideX, wideX2), x1: Math.max(wideX, wideX2), z0: zr[0], z1: zr[1], pts: 5 },
      { x0: Math.min(tX, tX2), x1: Math.max(tX, tX2), z0: zr[0], z1: zr[1], pts: 5 },
    ];
    this.P[1].noHit = true;
    this.fx.zones(this.training.zones);
    this.fx.trainingUpdate(this.training);
  }

  trainingResult(e, ok) {
    const tr = this.training;
    let pts = 0;
    if (ok) {
      pts = this.mode === 'aufschlag' ? 2 : 1;
      for (const z of tr.zones) if (e.x >= z.x0 && e.x <= z.x1 && e.z >= z.z0 && e.z <= z.z1) pts = Math.max(pts, z.pts);
    }
    tr.score += pts;
    tr.done++;
    this.fx.trainingUpdate(tr, pts, ok);
    this.state = 'feedWait';
    this.timer = 1.3;
  }
}
