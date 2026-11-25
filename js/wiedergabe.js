// Powershot – spielt eine Aufnahme des Match-Rekorders (js/rekorder.js) wieder ab.
// Die Wiedergabe tut so, als wäre sie ein Match: Sie hat dieselben Felder (state, P, ball, score …) und meldet
// dasselbe über "fx". Deshalb kann die Grafik (game3d.js) sie zeichnen, ohne etwas davon zu merken.
// Gerechnet wird hier nichts Neues: Die Spieler stehen dort, wo sie in der Aufnahme standen (Spur),
// der Ball fliegt mit Ort, Tempo und Drall aus der Aufnahme noch einmal los (derselbe Ballflug wie im Match).
// Ohne three.js, läuft auch in node.

import { COURT as C, SURFACES, Ball } from './physics.js';
import { MatchScore } from './rules.js';
import { Match, TOSS_TIME } from './match.js';
import { spurBei } from './rekorder.js';
import { schlagText, endeText } from './rekorderauswertung.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NOFX = new Proxy({}, { get: () => () => {} });
const VORLAUF = 1.0;        // so lange (Sekunden) stehen die Spieler vor dem Aufschlag bereit
const NACH_PUNKT = 2.0;     // so lange bleibt ein fertiger Punkt stehen, bevor der nächste kommt

export class Wiedergabe {
  // aufnahme: das Objekt aus Rekorder.daten() · spieler: [du, gegner] wie für ein Match (für Aussehen und Namen)
  constructor(aufnahme, fx = NOFX, spieler = null) {
    const K = aufnahme.kopf;
    this.aufnahme = aufnahme;
    this.fx = fx;
    this.wiedergabe = true;
    this.cfg = { finale: false, lernen: null, controlMode: K.steuerung, assist: K.laufhilfe };
    this.mode = K.modus === 'spielzug' ? 'match' : K.modus || 'match';
    this.surface = SURFACES[K.belag] || SURFACES.hard;
    this.score = new MatchScore({ sets: K.saetze, games: K.spiele, firstServer: K.ersterAufschlag || 0 });
    this.P = [0, 1].map((i) => {
      const s = (K.spieler || [])[i] || {}, dz = i === 0 ? 1 : -1;
      return {
        side: i, data: (spieler && spieler[i]) || s, isHuman: false, mensch: !!s.mensch, dz, hand: s.hand || 1, gross: s.gross || 1,
        x: 0, z: dz * (C.L + 0.6), vx: 0, vz: 0, prep: 0, stroke: 'fh', mood: null, plan: null, netRush: false,
      };
    });
    this.namen = (K.spieler || []).map((s) => s.kurz || s.name || '?');
    this.ball = new Ball();
    this.controls = null;
    this.training = { balls: aufnahme.punkte.length, done: 0, score: 0, zones: [] };
    this.state = 'intro';
    this.timer = 0;
    this.server = 0;
    this.serveUnten = false; this.tossT = 0; this.tossDauer = TOSS_TIME; this.prellK = null;
    this.sinceHit = 0;
    this.serveBox = null;
    this.lastPoint = null;
    this.i = -1;                // welcher Punkt gerade läuft
    this.k = 0;                 // welches Ereignis des Punkts als Nächstes dran ist
    this.t = 0;                 // Zeit der Aufnahme (Sekunden)
    this.warten = 0.8;          // Pause, bis es weitergeht
    this.text = '';             // was zuletzt passiert ist (für die Anzeige)
    this.zeilen = [];           // alles, was in diesem Punkt schon passiert ist
  }

  // Diese drei Fragen stellt die Grafik einem Match – in der Wiedergabe gibt es darauf keine Antwort
  previewTarget() { return null; }
  zugStand() { return null; }
  get court() { return this.score.court; }
  get punkt() { return this.aufnahme.punkte[this.i] || null; }
  get anzahl() { return this.aufnahme.punkte.length; }

  // Zu einem Punkt springen (0 = der erste). Der Spielstand wird dafür von vorn nachgezählt.
  springe(nr) {
    const N = this.anzahl;
    nr = clamp(nr, 0, N);
    const K = this.aufnahme.kopf;
    this.score = new MatchScore({ sets: K.saetze, games: K.spiele, firstServer: K.ersterAufschlag || 0 });
    for (let j = 0; j < nr; j++) this.zaehle(this.aufnahme.punkte[j]);
    this.i = nr - 1;
    this.ball.live = false;
    this.warten = 0.01;
    this.state = 'pointOver';
    for (const p of this.P) { p.mood = null; p.plan = null; }
  }

  // Einen fertigen Punkt in den Spielstand eintragen (wie pointEnd im Match)
  zaehle(P) {
    const en = P.ende;
    if (this.mode !== 'match' || !en || en.sieger == null) return ['point'];
    const sc = this.score, w = en.sieger, l = 1 - w;
    for (const e of P.e) if (e.a === 'schlag' && e.auf === 1) { sc.stats[e.s].firstTotal++; if (e.drin && !e.insNetz) sc.stats[e.s].firstIn++; }
    if (en.grund === 'ass') sc.stats[w].aces++;
    else if (en.grund === 'winner') sc.stats[w].winners++;
    else if (en.grund === 'doppelfehler') sc.stats[l].doubleFaults++;
    else sc.stats[l].errors++;
    return sc.pointTo(w);
  }

  // Der nächste Punkt beginnt: Spieler aufstellen, Uhr auf kurz vor dem ersten Ereignis stellen
  punktAuf() {
    this.i++;
    const P = this.punkt;
    if (!P) {
      this.state = 'over';
      this.text = 'Ende der Aufnahme';
      if (this.mode === 'match') this.fx.matchOver(this.score); else this.fx.trainingOver(this.training);
      return;
    }
    this.k = 0;
    this.zeilen = [];
    const erstes = P.e.find((e) => e.a === 'wurf' || e.a === 'schlag');
    this.t = Math.max(P.t0, (erstes ? erstes.t : P.t0) - VORLAUF);
    this.server = P.auf;
    this.score.serveNo = P.aufNr || 1;
    this.serveUnten = false; this.tossDauer = TOSS_TIME; this.tossT = 0;
    this.aufstellen(P);
    for (const p of this.P) { p.mood = null; p.plan = null; p.prep = 0; p.vx = p.vz = 0; }
    this.ball.live = false;
    this.state = 'serveReady';
    this.stellen(P, 1);
    this.ball.pos = this.wurfOrt(0);
    this.text = `Punkt ${P.nr} von ${this.anzahl}`;
    this.fx.landing(null);
    this.fx.serveSetup({ server: this.server, serveNo: this.score.serveNo, box: this.serveBox });
  }

  // Auf welcher Seite liegt das Aufschlagfeld? (wie setupServe im Match)
  aufstellen(P) {
    const srv = this.P[P.auf], right = this.court === 'deuce' ? 1 : -1, bs = -right * srv.dz;
    this.serveBox = this.mode === 'ballmaschine' ? { x0: -C.W, x1: C.W, sign: 1, zs: 1 } : { x0: Math.min(0, bs * C.W), x1: Math.max(0, bs * C.W), sign: bs, zs: -srv.dz };
  }

  wurfOrt(t) { return Match.prototype.tossPos.call(this, this.P[this.server], t); }

  // Spieler dorthin stellen, wo sie in der Aufnahme zu dieser Zeit standen
  stellen(P, dt) {
    const o = spurBei(P, this.t);
    if (!o) return;
    for (const p of this.P) {
      const x = o[p.side * 2], z = o[p.side * 2 + 1];
      p.vx = dt > 0 ? (x - p.x) / dt : 0; p.vz = dt > 0 ? (z - p.z) / dt : 0;
      p.x = x; p.z = z;
    }
  }

  // Der nächste Schlag dieses Spielers in diesem Punkt (damit er rechtzeitig ausholt)
  planFuer(P, seite, ab) {
    for (let j = ab; j < P.e.length; j++) {
      const e = P.e[j];
      if (e.a !== 'schlag') continue;
      if (e.s !== seite) return null;
      return { x: e.von[0], y: e.von[1], z: e.von[2], t: e.t, b: e.volley ? 0 : 1, sx: e.ich[0], sz: e.ich[1], lack: e.streck > 0.6 ? 0.3 : 0, stroke: e.hand === 'bh' ? 'bh' : 'fh' };
    }
    return null;
  }

  melde(s) { if (s) { this.text = s; this.zeilen.push(s); } }

  ereignis(P, e) {
    if (e.a === 'wurf') {
      this.state = 'toss'; this.tossT = 0;
      this.serveUnten = !!e.unten; this.tossDauer = e.dauer || TOSS_TIME;
    } else if (e.a === 'aufstellung') {
      this.score.serveNo = e.aufNr || 2;
      this.state = 'serveReady';
      this.ball.live = false;
      this.fx.serveSetup({ server: this.server, serveNo: this.score.serveNo, box: this.serveBox });
    } else if (e.a === 'schlag') {
      const p = this.P[e.s], opp = this.P[1 - e.s];
      this.state = 'rally';
      this.ball.launch({ x: e.von[0], y: e.von[1], z: e.von[2] }, { x: e.vel[0], y: e.vel[1], z: e.vel[2] }, { top: e.spin[0], seite: e.spin[1], drall: e.spin[2] }, e.s, !!e.auf);
      this.sinceHit = 0;
      this.lastShot = { type: e.typ };
      p.plan = null; p.prep = 0;
      opp.plan = this.planFuer(P, opp.side, this.k);
      if (opp.plan) opp.plan.t -= e.t;        // die Grafik will wissen: wie viele Sekunden nach diesem Schlag wird getroffen?
      const speed = e.kmh / 3.6;
      if (e.auf) {
        if (this.serveUnten) this.fx.swing(e.s, 'fh', e.von[1], 'slice'); else this.fx.swing(e.s, 'sv', e.von[1]);
        this.fx.hit({ side: e.s, speed, power: 1, type: 'serve', art: e.art });
      } else {
        this.fx.swing(e.s, e.typ === 'smash' ? 'sv' : e.hand === 'bh' ? 'bh' : 'fh', e.von[1], e.typ);
        this.fx.hit({ side: e.s, speed, power: e.kraft || 0.6, type: e.typ });
      }
      this.melde(schlagText(e, this.namen));
    } else if (e.a === 'aufprall') {
      this.fx.bounce({ x: e.x, z: e.z, n: e.n, in: e.drin, speed: 8 });
    } else if (e.a === 'netz') {
      // Der Ball fliegt genau so weiter wie im Match (an der Netzkante entscheidet ein Zentimeter).
      if (e.ort && e.vel && this.ball.live) {
        this.ball.pos.x = e.ort[0]; this.ball.pos.y = e.ort[1]; this.ball.pos.z = e.ort[2];
        this.ball.vel.x = e.vel[0]; this.ball.vel.y = e.vel[1]; this.ball.vel.z = e.vel[2];
      }
      this.fx.net(e.typ);
    } else if (e.a === 'fehler') {
      if (e.nr === 1) { this.state = 'faultPause'; this.fx.fault(1, e.grund); }
      this.melde(schlagText(e, this.namen));
    } else if (e.a === 'verpasst') {
      this.P[e.s].plan = null;
      this.fx.message('Verpasst!', 'warn');
      this.melde(schlagText(e, this.namen));
    } else if (e.a === 'eingabe') {
      if (e.was !== 'schwung' && e.was !== 'wisch') this.melde(schlagText(e, this.namen));
    } else if (e.a === 'training') {
      this.training.done++; this.training.score += e.punkte || 0;
    } else {
      this.melde(schlagText(e, this.namen));
    }
  }

  punktZu(P) {
    const en = P.ende || {};
    const events = this.zaehle(P);
    this.melde(endeText(en, this.namen));
    this.state = 'pointOver';
    this.warten = NACH_PUNKT;
    if (this.mode === 'match' && en.sieger != null) {
      const big = events.includes('game');
      this.P[en.sieger].mood = big ? 'cheer' : null;
      this.P[1 - en.sieger].mood = events.includes('set') ? 'sad' : null;
      this.lastPoint = { winner: en.sieger, reason: en.grund, events, rally: en.schlaege };
      this.fx.point(this.lastPoint);
    }
  }

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    if (this.state === 'over') return;
    if (this.state === 'intro' || (this.state === 'pointOver' && this.warten > 0)) {
      this.warten -= dt;
      if (this.state === 'pointOver') this.ball.step(dt, this.surface);      // der Ball rollt noch aus
      if (this.warten <= 0) this.punktAuf();
      return;
    }
    const P = this.punkt;
    if (!P) return;
    this.t += dt;
    this.stellen(P, dt);
    // Alles, was bis jetzt in der Aufnahme passiert ist
    while (this.k < P.e.length && P.e[this.k].t <= this.t) { this.k++; this.ereignis(P, P.e[this.k - 1]); }
    if (this.state === 'toss') {
      this.tossT = Math.min(this.tossT + dt, this.tossDauer);
      this.ball.pos = this.wurfOrt(this.tossT);
      if (!this.serveUnten) this.fx.toss(this.server, clamp(this.tossT / TOSS_TIME, 0, 1));
    } else if (this.state === 'serveReady') {
      this.ball.pos = this.wurfOrt(0);
    } else {
      this.sinceHit += dt;
      this.ball.step(dt, this.surface);
      // Wer den Ball als Nächster schlägt, holt aus (wie im Match: je näher der Ball, desto weiter)
      for (const p of this.P) {
        if (p.plan) {
          p.stroke = p.plan.stroke;
          p.prep = clamp((10 - Math.hypot(this.ball.pos.x - p.x, this.ball.pos.z - p.z)) / 6, 0, 1);
        } else p.prep = Math.max(0, p.prep - dt * 4);
      }
    }
    // Ist der Punkt vorbei? (Was danach noch in der Aufnahme steht – etwa eine zu späte Eingabe – wird nicht mehr abgespielt.)
    if (this.state !== 'pointOver' && (P.ende ? this.t >= P.ende.t : this.k >= P.e.length)) this.punktZu(P);
  }
}
