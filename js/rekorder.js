// Powershot – der Match-Rekorder. Er schreibt mit, was in einem Match passiert – keine Bilder, nur Zahlen:
// jede Eingabe, jeder Schlag, jeder Aufprall, jeder verpasste Ball (mit Grund) und jeder Punkt.
// Daraus kann man später ablesen, was an Steuerung und Schwierigkeit gut ist und was nicht
// (Auswertung: js/rekorderauswertung.js und tools/rekorder.mjs, Abspielen: js/wiedergabe.js).
//
// Diese Datei kennt keine Grafik und keinen Browser. Sie läuft auch in node.
// Ist der Rekorder aus, gibt es ihn gar nicht (match.rek ist dann null) – das Spiel wird also nicht langsamer.
//
// So sieht eine Aufnahme aus:
//   { v: 1, kopf: { … wer, wo, welche Stufe, welche Steuerung … },
//     punkte: [ { nr, t0, auf, aufNr, stand, wichtig,
//                 e: [ { t, a: 'eingabe' | 'wurf' | 'schlag' | 'aufprall' | 'netz' | 'fehler' | 'verpasst' | … }, … ],
//                 spur: [ t, x0, z0, x1, z1,  t, x0, z0, x1, z1, … ],      (wo die Spieler stehen, in Zentimetern und Hundertstelsekunden)
//                 ende: { t, sieger, grund, schlaege, dauer, … } }, … ],
//     ergebnis: { … } }
// Alle Zeiten t sind Sekunden Spielzeit seit Beginn des Matches. Seite 0 = du (unten), Seite 1 = der Gegner.

export const REK_VERSION = 1;
const SPUR_HZ = 8;              // so oft pro Sekunde wird gemerkt, wo die Spieler stehen (dazwischen wird beim Abspielen gemittelt)
const SPAET_NACH = 0.7;         // kommt so kurz (Sekunden) nach einem verpassten Ball noch eine Eingabe, war sie "zu spät"

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const xyz = (p, f = r2) => [f(p.x), f(p.y), f(p.z)];

export class Rekorder {
  // kopf: was das Menü schon weiß (Titel, Ort, Steuerung, Spieltempo …). Den Rest trägt das Match in start() ein.
  constructor(kopf = {}) {
    this.kopf = { wann: new Date().toISOString(), tempoMal: 1, ...kopf };
    this.punkte = [];
    this.t = 0;                 // Spielzeit in Sekunden
    this.p = null;              // der Punkt, der gerade läuft
    this.spurBei = 0;           // wann die Spur das nächste Mal einen Eintrag bekommt
    this.fertig = false;
    this.ergebnis = null;
    this.offen = null;          // der letzte verpasste Ball – vielleicht kommt die Eingabe ja noch (dann war sie "zu spät")
    this.letzteEingabe = null;  // die letzte Eingabe des Menschen seit dem Schlag des Gegners
    this.verfallen = null;      // … und die letzte, die verfallen ist, weil sie zu früh kam
    this.nah = 99;              // so nah (Meter) kam der Spieler, der dran ist, dem Ball seit dem letzten Schlag
  }

  // Das Match meldet sich an (einmal, im Konstruktor von Match)
  start(m) {
    const c = m.cfg, K = this.kopf;
    K.modus = c.lernen ? 'spielzug' : m.mode;
    K.stufe = c.difficulty || 'mittel';
    K.steuerung = K.steuerung || c.controlMode || '';
    K.laufhilfe = c.assist || 'voll';
    K.belag = c.surface || 'hard';
    K.saetze = c.sets; K.spiele = c.games;
    K.ersterAufschlag = m.score.server;
    K.mensch = c.human;
    K.spieler = m.P.map((p) => ({
      name: p.data.name, kurz: p.data.short, platz: p.data.rank, hand: p.hand, mensch: p.isHuman,
      stats: p.data.stats, look: p.data.look, gross: r2(p.gross),
      // So rechnet das Match mit dem Spieler (0 bis 1): Aufschlag, Vorhand/Rückhand Härte und Genauigkeit, Volley, Lauftempo in m/s
      werte: { s: r2(p.s), vhP: r2(p.vhP), vhC: r2(p.vhC), rhP: r2(p.rhP), rhC: r2(p.rhC), v: r2(p.v), tempo: r2(p.topSpeed) },
    }));
  }

  // Jedes Bild: Die Uhr läuft weiter, und ab und zu wird gemerkt, wo die Spieler stehen.
  takt(dt, m) {
    this.t += dt;
    const P = this.p, st = m.state;
    // Wie nah kommt der Spieler, der dran ist, an den Ball? (Am Ende eines Punkts sieht man daran, ob er eine Chance hatte.)
    if (st === 'rally' && m.ball.live && m.ball.lastHitter >= 0) {
      const q = m.P[1 - m.ball.lastHitter], b = m.ball.pos, d = Math.hypot(b.x - q.x, b.z - q.z);
      if (d < this.nah) this.nah = d;
    }
    if (!P || this.t < this.spurBei) return;
    if (st === 'intro' || st === 'changeover' || st === 'over') return;
    this.spurBei = this.t + 1 / SPUR_HZ;
    const a = m.P[0], b = m.P[1];
    const neu = [Math.round((this.t - P.t0) * 100), Math.round(a.x * 100), Math.round(a.z * 100), Math.round(b.x * 100), Math.round(b.z * 100)];
    const S = P.spur, n = S.length, alt = this.ruhe;
    // Stehen beide still, wird nichts geschrieben (spart Platz). Bewegen sie sich wieder, kommt zuerst noch der letzte Stand dazu.
    if (n >= 5 && neu[1] === S[n - 4] && neu[2] === S[n - 3] && neu[3] === S[n - 2] && neu[4] === S[n - 1]) { this.ruhe = neu; return; }
    if (alt) S.push(...alt);
    this.ruhe = null;
    S.push(...neu);
  }

  ereignis(e) {
    e.t = r3(this.t);
    if (this.p) this.p.e.push(e);
    return e;
  }

  // Ein neuer Punkt beginnt (oder der zweite Aufschlag desselben Punkts – dann läuft der Punkt einfach weiter).
  punktStart(m) {
    if (this.p && !this.p.ende && m.mode === 'match') { this.ereignis({ a: 'aufstellung', aufNr: m.score.serveNo }); return; }
    if (this.p && !this.p.ende) this.punktZu({ grund: 'training' });       // Training: Der nächste Ball kommt, der alte ist vorbei
    const sc = m.score;
    this.p = {
      nr: this.punkte.length + 1, t0: r3(this.t), auf: m.server, aufNr: sc.serveNo,
      stand: m.mode === 'match' ? { saetze: sc.sets.map((s) => [...s]), spiele: [...sc.games], punkte: sc.pointLabels(), tiebreak: sc.tiebreak } : null,
      wichtig: m.mode === 'match' && sc.wichtigerPunkt ? sc.wichtigerPunkt() || null : null,
      e: [], spur: [], ende: null,
    };
    this.punkte.push(this.p);
    this.spurBei = 0; this.ruhe = null;
    this.offen = null; this.letzteEingabe = null; this.verfallen = null;
    this.takt(0, m);
  }

  punktZu(ende) {
    const P = this.p;
    if (!P || P.ende) return;
    const schlaege = P.e.filter((e) => e.a === 'schlag');
    P.ende = { t: r3(this.t), schlaege: schlaege.length, dauer: schlaege.length ? r2(this.t - schlaege[0].t) : 0, ...ende };
    if (this.ruhe) { P.spur.push(...this.ruhe); this.ruhe = null; }
  }

  // Die Steuerung meldet etwas (siehe onRek in controls.js):
  //   'eingabe'   = ein fertiger Schlag-Wunsch (Taste, Schwung, Wisch, Maus …)
  //   'verfallen' = der Wunsch kam zu früh und gilt nicht mehr
  //   'geloescht' = der Wunsch kam, bevor der Gegner überhaupt geschlagen hatte
  //   'schwung'   = Rohwerte eines Schwungs (Uhr, iPhone, Controller), 'wisch' = Rohwerte eines Wischs
  eingabe(was, d = {}) {
    const e = this.ereignis({ a: 'eingabe', was, ...d });
    if (was === 'eingabe') {
      this.letzteEingabe = e;
      // Gerade erst einen Ball verpasst? Dann war diese Eingabe zu spät.
      const o = this.offen;
      if (o && this.t - o.t <= SPAET_NACH * this.kopf.tempoMal && d.ctx !== 'serve') { o.grund = 'zu_spaet'; o.nach = r2((this.t - o.t) / this.kopf.tempoMal); e.zuSpaet = true; }
      this.offen = null;
    } else if (was === 'verfallen' || was === 'geloescht') {
      this.verfallen = e;
    }
  }

  // Der Aufschläger wirft den Ball hoch
  wurf(m, intent) {
    this.ereignis({ a: 'wurf', s: m.server, art: intent.art || 'gerade', unten: !!m.serveUnten, dauer: m.tossDauer, kraft: r2(intent.power ?? 0) });
  }

  // Ein Ball wird geschlagen. info = was nur tryHit und doServe wissen (Eingabe, Bedrängnis …)
  schlag(m, p, from, shot, isServe, info = {}) {
    const opp = m.P[1 - p.side], f = m.pred && m.pred.first, it = info.intent || {};
    const e = {
      a: 'schlag', s: p.side, nr: m.rally, auf: isServe ? m.score.serveNo : 0,
      typ: shot.type, art: shot.art || undefined, hand: shot.hand || (isServe ? 'sv' : undefined),
      kmh: Math.round(shot.speed * 3.6), kraft: r2(it.power ?? 0),
      von: xyz(from), vel: xyz(shot.vel, r3), spin: [shot.spin.top, shot.spin.seite, shot.spin.drall],
      wunsch: it.x != null ? [r2(it.x), r2(-p.dz * (it.d ?? 0))] : undefined,      // dorthin wollte er spielen …
      ziel: shot.target ? [r2(shot.target.x), r2(shot.target.z)] : undefined,       // … und dorthin geht der Schlag nach dem Streuen
      landet: f ? [r2(f.x), r2(f.z)] : undefined, drin: !!m.predIn, insNetz: !!(m.pred && m.pred.net) || undefined,
      ich: [r2(p.x), r2(p.z)], geg: [r2(opp.x), r2(opp.z)],
      streck: info.stretch ? r2(info.stretch) : undefined, volley: info.volley || undefined,
      ankam: info.incoming ? Math.round(info.incoming * 3.6) : undefined,          // so schnell kam der Ball an (km/h)
      reakt: r2(opp.react),                                                        // so lange braucht der Gegner, bis er losläuft
    };
    if (p.isHuman) {
      e.mensch = true;
      if (info.hilfe) e.hilfe = true;                    // Hilfs-Schlag der Stufe "Leicht": Das Spiel hat für dich geschlagen
      if (info.spaet > 0.03) e.spaet = r2(info.spaet / this.kopf.tempoMal);    // so viele Sekunden nach dem besten Moment geschlagen
      if (shot.schwung) e.schwung = true;
      if (info.raw) {
        const w = info.raw;
        e.roh = { typ: w.type, ziel: w.aim != null ? r2(w.aim) : undefined, tiefe: w.depth != null ? r2(w.depth) : undefined, kraft: w.power != null ? r2(w.power) : undefined, art: w.art || undefined };
      }
      // Wie lange vor dem Treffen kam die Eingabe? (in echten Sekunden, nicht in Spielzeit)
      const le = this.letzteEingabe;
      if (le && !info.hilfe && !isServe) e.vor = r2((this.t - le.t) / this.kopf.tempoMal + (le.seit || 0));
    }
    this.ereignis(e);
    this.letzteEingabe = null; this.verfallen = null; this.offen = null; this.nah = 99;
  }

  // Der Ball war in Reichweite, aber es kam kein Schlag (nur beim Menschen möglich)
  verpasst(m, p, wo, spaet) {
    const b = m.ball.pos;
    const e = this.ereignis({
      a: 'verpasst', s: p.side, grund: this.verfallen ? 'zu_frueh' : 'keine_eingabe',
      ball: xyz(b), ich: [r2(p.x), r2(p.z)], abstand: r2(wo.dist ?? Math.hypot(b.x - p.x, b.z - p.z)),
      seite: p.plan ? p.plan.stroke : undefined, nr: m.rally,
    });
    if (this.verfallen) e.vorher = r2((this.t - this.verfallen.t) / this.kopf.tempoMal);     // so lange vorher ist die Eingabe verfallen
    if (spaet > 0) e.frist = r2(spaet / this.kopf.tempoMal);
    this.offen = e;
  }

  aufprall(m, e, ok) {
    if (e.n > 2 || m.state !== 'rally') return;
    this.ereignis({ a: 'aufprall', x: r2(e.x), z: r2(e.z), n: e.n, drin: !!ok, wand: e.wall || undefined });
  }

  // Netz oder Netzkante. Wo der Ball danach ist und wie er weiterfliegt, wird mit aufgeschrieben:
  // An der Netzkante entscheidet ein Zentimeter – die Wiedergabe soll da nicht neu würfeln.
  netz(typ, b) {
    const e = { a: 'netz', typ };
    if (b) { e.ort = [r2(b.pos.x), r2(b.pos.y), r2(b.pos.z)]; e.vel = [r2(b.vel.x), r2(b.vel.y), r2(b.vel.z)]; }
    this.ereignis(e);
  }

  fehler(nr, grund) { this.ereignis({ a: 'fehler', nr, grund }); }

  // Kleinigkeiten: 'netzwunsch' (ans Netz / zurück), 'spielzug', 'training' (Ergebnis eines Trainingsballs)
  notiz(was, d = {}) { this.ereignis({ a: was, ...d }); }

  // Der Punkt ist vorbei
  punktEnde(m, winner, reason, events) {
    const loser = m.P[1 - winner], b = m.ball.pos;
    const ende = { sieger: winner, grund: reason };
    if (events.length > 1) ende.dazu = events.filter((x) => x !== 'point');
    if (reason === 'winner' || reason === 'ass') {
      // Controller und Wischen: Der Ball war schon in Reichweite und die kurze Frist für "spät" lief noch, als er zum zweiten Mal aufkam.
      // Auch das ist ein verpasster Ball (und nicht "nicht hingekommen").
      if (loser.isHuman && !loser.missed && loser.spaetSeit != null) { this.verpasst(m, loser, loser.spaetVon || {}, m.sinceHit - loser.spaetSeit); ende.verpasst = true; }
      // Der Verlierer hat den Ball nicht geschlagen: Wie nah kam er ihm, und wie viel fehlte nach seinem Plan?
      ende.abstand = r2(Math.min(this.nah, Math.hypot(b.x - loser.x, b.z - loser.z)));
      if (loser.plan) ende.fehlte = r2(loser.plan.lack);
      if (loser.missed) ende.verpasst = true;
    }
    this.punktZu(ende);
  }

  // Das Match ist vorbei (oder wurde abgebrochen)
  ende(score, abgebrochen = false) {
    if (this.fertig) return;
    this.fertig = true;
    if (this.p && !this.p.ende) this.punktZu({ grund: abgebrochen ? 'abbruch' : 'training' });
    this.ergebnis = { abgebrochen: !!abgebrochen, dauer: r2(this.t) };
    if (score && score.sets) {
      Object.assign(this.ergebnis, {
        sieger: score.winner, saetze: score.sets.map((s) => [...s]), spiele: [...score.games],
        stats: score.stats.map((s) => ({ ...s })),
      });
    }
  }

  // Die fertige Aufnahme als einfaches Objekt (zum Speichern als JSON)
  daten() {
    return { v: REK_VERSION, kopf: this.kopf, punkte: this.punkte, ergebnis: this.ergebnis };
  }
}

// Wo stehen die Spieler eines Punkts zur Zeit t? (aus der Spur gemittelt) → [x0, z0, x1, z1] in Metern
export function spurBei(punkt, t) {
  const S = punkt.spur, n = S.length / 5, c = (t - punkt.t0) * 100;
  if (!n) return null;
  let i = 0;
  while (i < n - 1 && S[(i + 1) * 5] <= c) i++;
  const a = i * 5, b = Math.min(n - 1, i + 1) * 5;
  const k = S[b] > S[a] ? Math.max(0, Math.min(1, (c - S[a]) / (S[b] - S[a]))) : 0;
  const m = (j) => (S[a + j] + (S[b + j] - S[a + j]) * k) / 100;
  return [m(1), m(2), m(3), m(4)];
}

// Ein kurzer Name für eine Aufnahme (für Listen)
export function kurzName(a) {
  const K = a.kopf || {}, sp = K.spieler || [], E = a.ergebnis || {};
  const stand = E.saetze && E.saetze.length ? E.saetze.map((s) => s.join(':')).join(' ') : E.spiele ? E.spiele.join(':') : '';
  return `${(sp[0] || {}).kurz || 'Du'} – ${(sp[1] || {}).kurz || 'Gegner'}${stand ? ' ' + stand : ''}${E.abgebrochen ? ' (abgebrochen)' : ''}`;
}
