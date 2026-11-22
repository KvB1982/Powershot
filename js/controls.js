// Powershot – Steuerung. Fünf Arten:
//   klassik : wie in der Python-Version (Mausrad/Pfeile zielen, linke Maustaste halten = Kraft)
//   touch   : für iPad/Handy (links Joystick, rechts wischen; zwei Finger nach oben = ans Netz, nach unten = Grundlinie)
//   wisch   : für iPad/Handy, nur wischen: WANN du wischst, bestimmt die Richtung (früh = cross, spät = longline),
//             WOHIN du wischst, die Schlagart, und WIE SCHNELL, die Härte. Doppelt tippen = ans Netz und zurück.
//   profi   : Tastatur, selbst laufen, verschiedene Schläge, Richtung beim Treffen
//   controller : Switch-Controller (Joy-Con, Pro Controller): Stick, Tasten und – in der iOS-App – Schwingen
// Dazu kommt, wenn man will, das Laufen mit der Kamera (kamera.js) – das geht mit jeder der fünf Arten zusammen.
//
// Das Match fragt die Steuerung ab:
//   move()        -> { x, f }   Laufrichtung (-1..1), f = nach vorne
//   peek(serve)   -> aktuelle Eingabe (für die Ziel-Anzeige) oder null
//   consume()     -> Eingabe für den Schlag abholen (oder null, wenn nichts gedrückt wurde)
//   takeServe()   -> Eingabe für den Aufschlag, sobald sie abgeschickt wurde
//
// Aufschlagart: 'gerade', 'slice', 'kick' oder 'unten' (siehe js/schlaege.js). Sie steht in "art" der Aufschlag-Eingabe.
// Fehlt sie, nimmt das Match den Standard: erster Aufschlag gerade, zweiter Kick.
// Eine Steuerung darf außerdem in "schlag" eigene Zahlen mitgeben, z. B. { top: 3400, seite: -500, tempo: 31 }.

import { AUFSCHLAG_ARTEN } from './schlaege.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const POWER_MAX = 1.4;
export const POWER_LIMIT = 1.08;       // darüber fliegt der Ball zu lang
const CHARGE_TIME = 0.75;              // Sekunden bis volle Kraft (klassik)
const DOUBLE = 0.32;                   // Zeitfenster für Doppelklick / Doppeltipp
// --- Touch: mit zwei Fingern nach oben wischen = ans Netz, nach unten = zurück an die Grundlinie ---
const ZWEI_ZEIT = 0.35;                // so schnell nacheinander (Sekunden) müssen beide Finger aufsetzen
const ZWEI_NAH = 220;                  // so nah beieinander (Pixel) müssen die beiden Finger sein
const ZWEI_WEG = 40;                   // so weit (Pixel) müssen beide Finger nach oben oder unten wischen

// --- Wischen (Steuerung "wisch"): Mit diesen Zahlen kannst du das Wischen einstellen. ---
const WISCH_MIN = 30;                  // so weit (Pixel) muss der Finger mindestens wischen, sonst ist es nur ein Tipp
const WISCH_LANGSAM = 0.5;             // so langsam (Bildschirmhöhen pro Sekunde) = ganz weicher Schlag
const WISCH_SCHNELL = 3.5;             // so schnell (Bildschirmhöhen pro Sekunde) = volle Härte
const WISCH_FENSTER = 0.25;            // gemessen wird nur das letzte Stück des Wischens (Sekunden) – vorher darf der Finger ruhen
const WISCH_VERZUG = 0.05;             // der Schlag "zählt" ein kleines bisschen früher als das Loslassen des Fingers
const WISCH_SCHRAEG = 0.6;             // Aufschlag: so schräg gewischt (seitlich geteilt durch hoch) = ganz in die Ecke
const WISCH_STOPP = 0.15;              // nach unten und langsamer als diese Kraft (0 bis 1) gewischt = Stoppball statt kurzer Slice
const TIPP_ZEIT = 0.3;                 // so kurz (Sekunden) liegt der Finger bei einem Tipp auf dem Bildschirm
const TIPP_WEG = 18;                   // so wenig (Pixel) darf er sich dabei bewegen
// Das Zeitfenster beim Wischen ist länger als beim Controller – ein Wisch dauert selbst schon einen Moment:
//
//   0,46 s vorher        0,23 s vorher        Ball ist da
//     ganz cross  ─────────  Mitte  ─────────  ganz longline (die Linie entlang)
//
const WISCH_FRUEH = 0.46;              // so viele Sekunden vor dem Treffen = ganz cross
const WISCH_MITTE = 0.23;              // so viele Sekunden vor dem Treffen = genau in die Mitte
const WISCH_HALTBAR = 0.8;             // so lange "gilt" ein Wisch, bis der Ball da sein muss (danach verfällt er: zu früh)
export const WISCH_SPAET = 0.18;       // so lange nach dem besten Moment darf man noch wischen (bleibt ganz longline), danach "Zu spät!"
// Der Joystick links: Beim Wischen gibt es ihn nur, wenn du selbst laufen musst (Laufhilfe "Nur seitlich" oder "Aus").
// Mit Laufhilfe "Voll" ist der GANZE Bildschirm zum Wischen da – auch die linke Seite, wo man bei der Rückhand gern wischt.
const STICK_AB = 0.22;                 // erst wenn der Finger so lange (Sekunden) links liegt, wird er zum Joystick
const WISCH_KURZ = 0.4;                // ein Wisch links, der kürzer dauert als das, ist ein Schlag und kein Laufen
const DOPPEL_TIPP = 0.4;               // so schnell nacheinander (Sekunden) müssen zwei Tipps kommen

// Aus der Wisch-Richtung wird die Schlagart. dx = nach rechts, dy = nach unten (in Pixeln, wie auf dem Bildschirm).
// Ob du nach links oder rechts wischst, ist egal – es zählt nur, wie steil es nach oben oder unten geht:
//
//        hoch  ↑   = hoher Topspin
//   schräg hoch ↗  = normaler Topspin
//      zur Seite → = gerader, flacher Schlag
//  schräg runter ↘ = langer Slice
//      runter  ↓   = kurzer Slice
//
export function wischArt(dx, dy) {
  const steil = Math.atan2(-dy, Math.abs(dx)) * 180 / Math.PI;     // +90 = genau nach oben, 0 = zur Seite, -90 = genau nach unten
  if (steil > 67.5) return { type: 'topspin', depth: 0.8, name: 'Hoher Topspin' };
  if (steil > 22.5) return { type: 'drive', depth: 0.78, name: 'Topspin' };
  if (steil > -22.5) return { type: 'flach', depth: 0.8, name: 'Gerader Schlag' };
  if (steil > -67.5) return { type: 'slice', depth: 0.85, name: 'Langer Slice' };
  return { type: 'slice', depth: 0.45, kurz: true, name: 'Kurzer Slice' };
}

// --- Controller: Schwung-Erkennung. Mit diesen Zahlen kannst du das Schwingen einstellen. ---
const SWING_START = 1.6;               // ab dieser Beschleunigung (in g, 1 g = Erdanziehung) zählt es als Schwung
const SWING_VOLL = 5.0;                // so stark muss man schwingen für volle Kraft
const SWING_PAUSE = 0.4;               // Sekunden Ruhe nach einem Schwung (sonst zählt einer doppelt)
const PAD_HALTBAR = 0.6;               // so lange "gilt" ein Schwung oder Tastendruck, bis der Ball da sein muss
// --- Schwingen mit Uhr, iPhone oder Controller: Hilfen, damit man damit auch Punkte macht (seit 21.11.2026, alle Zahlen geschätzt) ---
const SCHWUNG_MIN = 0.5;               // so hart ist schon der sanfteste Schwung (0 bis 1). Früher 0.3 – da kam der Ball zu lahm.
const SCHWUNG_KURVE = 0.6;             // kleiner als 1 = schon ein mittlerer Schwung gibt fast volle Härte
const SCHWUNG_ECKE = 0.6;              // kleiner als 1 = der Ball geht eher in die Ecken als in die Mitte (dort steht der Gegner)
const SCHWUNG_TIEF = 0.08;             // ein harter Schwung fliegt um so viel tiefer ins Feld (Anteil der Feldlänge)
// Aus der gemessenen Schwung-Stärke (0 bis 1) wird die Härte des Schlags (0 bis 1)
export const schwungHaerte = (kraft) => SCHWUNG_MIN + (1 - SCHWUNG_MIN) * Math.pow(clamp(kraft, 0, 1), SCHWUNG_KURVE);
// Aus der Richtung nach dem Timing (-1 bis +1) wird das Ziel: Die Mitte wird "auseinandergezogen", die Ecken bleiben.
export const schwungRichtung = (lr) => Math.sign(lr) * Math.pow(Math.abs(lr), SCHWUNG_ECKE);
// --- Controller: Das Timing bestimmt die Richtung, wie beim echten Tennis. ---
// Triffst du den Ball früh (noch vor dem Körper), geht er nach links. Triffst du ihn spät (neben dem Körper), nach rechts.
// Das gilt, wenn der Ball RECHTS von dir ist (Vorhand beim Rechtshänder). Ist der Ball LINKS von dir (Rückhand),
// ist es genau umgekehrt: früh = nach rechts, spät = nach links. Anders gesagt: früh = cross, spät = longline.
// Auf welcher Seite der Ball ist, sagt das Match der Steuerung in "schlagSeite" (+1 = rechts von dir, -1 = links).
// Das ganze Fenster ist kurz und liegt direkt vor dem Moment, in dem der Ball bei dir ankommt:
//
//   0,38 s vorher        0,19 s vorher        Ball ist da
//   ganz links  ───────────  Mitte  ───────────  ganz rechts
//
const TIMING_FRUEH = 0.38;             // so viele Sekunden vor dem Treffen = ganz nach links
const TIMING_MITTE = 0.19;             // so viele Sekunden vor dem Treffen = genau geradeaus
export const TIMING_SPAET = 0.15;      // so lange nach dem Treffmoment darf man noch schlagen (bleibt ganz rechts), danach "Zu spät!"
// Ein Schwung wird erst erkannt, wenn er schon einen Moment läuft. Diese Zeit rechnen wir zurück.
const SCHWUNG_VERZUG = 0.08;           // iPhone oder Controller in der Hand
const UHR_VERZUG = 0.04;               // Apple Watch (zusätzlich zur gemessenen Funkzeit)

// Aus "so viele Sekunden vor dem Treffen" wird die Richtung: -1 = ganz links, 0 = Mitte, +1 = ganz rechts
// frueh und mitte: die beiden Zeiten aus dem Bild oben (beim Wischen sind sie länger, siehe WISCH_FRUEH und WISCH_MITTE)
function richtungAusZeit(vorher, frueh = TIMING_FRUEH, mitte = TIMING_MITTE) {
  if (vorher >= mitte) return -clamp((vorher - mitte) / (frueh - mitte), 0, 1);
  return clamp((mitte - vorher) / mitte, 0, 1);
}
// Wann ist das passiert? Der Browser schreibt an jedes Finger-Ereignis die genaue Zeit (in Millisekunden).
const zeitVon = (e) => (e.timeStamp != null ? e.timeStamp : performance.now()) / 1000;
// Das letzte Stück eines Wischens: Wo war der Finger vor WISCH_FENSTER Sekunden, wo ist er jetzt?
//   f = Finger mit seiner Spur (alle Punkte mit Zeit), jetzt = Zeit des Loslassens
function wischStueck(f, jetzt) {
  let start = f.spur[0];
  for (const p of f.spur) { if (p.t >= jetzt - WISCH_FENSTER) break; start = p; }
  return { dx: f.x - start.x, dy: f.y - start.y, dauer: Math.min(jetzt - start.t, WISCH_FENSTER) };
}
const tot = (v) => (Math.abs(v) < 0.18 ? 0 : v);     // kleine Stick-Wackler ignorieren

export class Controls {
  constructor(el, stickEl) {
    this.el = el;                 // Fläche, auf der getippt/geklickt wird
    this.stickEl = stickEl;       // Anzeige für den Joystick
    this.mode = 'klassik';
    this.enabled = false;
    this.keys = {};
    this.ctx = 'idle';
    this.reset();
    this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 };
    this.swipe = null;
    this.lastTap = -9;
    this.laufhilfe = 'voll';      // wird von app.js gesetzt: 'voll', 'seitlich' oder 'aus' (bei 'voll' braucht das Wischen keinen Joystick)
    this.schlagSeite = 1;         // Timing: Ist der Ball rechts (+1) oder links (-1) von dir? Setzt das Match vor jedem Schlag.
    this.tippZeit = -9;           // Wischen: wann zuletzt getippt wurde (für den Doppel-Tipp)
    this.lastClick = -9;
    this.time = 0;
    // Controller: Stick (x, f), gedrückte Tasten, Name und ob er Bewegungen (Schwingen) meldet
    this.pad = { connected: false, name: '', x: 0, f: 0, btn: {}, motion: false };
    this.schwung = { aktiv: false, t0: 0, peak: 0, hoch: 0, ende: -9 };
    this.padAt = -9;              // wann der letzte Controller-Schlag ausgelöst wurde
    this.aufschlagArt = null;     // gewählte Aufschlagart (null = Standard: erster gerade, zweiter Kick)
    this.onHint = null;           // wird von app.js gesetzt: kurzer Hinweis-Text auf dem Bildschirm
    // Zum Fehlersuchen: Wie viele Meldungen kommen vom Controller/Schläger an, wie viele Schwünge von der Uhr?
    this.diag = { pakete: 0, uhr: 0, letzter: '–' };
    this.netzWechsel = null;      // Wunsch: 'vor' = ans Netz, 'zurueck' = Grundlinie, 'wechsel' = hin und her (Doppelklopfen oder Taste)
    this.finger = new Map();      // Touch: alle Finger, die gerade auf dem Bildschirm sind (für das Wischen mit zwei Fingern)
    this.zwei = null;             // Touch: läuft gerade ein Wischen mit zwei Fingern? { a, b, fertig }
    this.nativePad = false;       // true, sobald die iOS-App den Controller meldet
    this.onPause = null;          // wird von app.js gesetzt: Pause-Taste am Controller
    this.onMenu = null;           // wird von app.js gesetzt: Controller im Menü ('links', 'rechts', 'hoch', 'runter', 'ok', 'zurueck')
    this.menuDir = '';            // Richtung, in die der Stick gerade gedrückt ist
    this.menuAt = 0;              // wann die Richtung zuletzt gemeldet wurde (zum Wiederholen beim Festhalten)
    this.kamera = null;           // wird von app.js gesetzt: Laufen mit der Kamera (siehe kamera.js)
    this.bind();
  }

  reset() {
    this.aim = 0;
    this.power = 0;
    this.charging = false;
    this.committed = null;      // fertige Eingabe
    this.serveOut = null;
    this.type = 'drive';
    this.live = null;           // Eingabe, die gerade entsteht (Finger noch auf dem Bildschirm)
  }

  setMode(mode) { this.mode = mode; this.reset(); this.showStick(false); this.finger.clear(); this.zwei = null; this.netzWechsel = null; this.swipe = null; this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 }; }

  // ctx: 'serve' | 'rally'
  begin(ctx) {
    const keepAim = this.mode === 'klassik' && ctx === 'rally' ? 0 : 0;
    this.ctx = ctx;
    this.reset();
    if (ctx === 'serve') this.aufschlagArt = null;      // vor jedem Aufschlag gilt wieder der Standard
    this.aim = keepAim;
  }

  bind() {
    const el = this.el;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    el.addEventListener('wheel', (e) => {
      if (!this.enabled || this.mode !== 'klassik') return;
      e.preventDefault();
      this.aim = clamp(this.aim + (e.deltaY < 0 ? -0.14 : 0.14), -1, 1);
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  // ---------------------------------------------------------------
  // Tastatur
  // ---------------------------------------------------------------
  onKey(e, down) {
    if (!this.enabled) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (this.keys[k] === down) return;
    this.keys[k] = down;
    // Tasten 1 bis 4 wählen die Aufschlagart: 1 = gerade, 2 = Slice, 3 = Kick, 4 = von unten
    if (down && this.ctx === 'serve' && '1234'.includes(k)) this.aufschlagArt = AUFSCHLAG_ARTEN[+k - 1];
    if (this.mode !== 'profi') return;
    const shot = { ' ': 'drive', j: 'drive', k: 'slice', l: 'lob', i: 'drop', u: 'flach', o: 'topspin' }[k];
    if (!shot) return;
    if (down) {
      this.charging = true; this.power = 0; this.type = shot; this.committed = null; this.taste = k;
    } else if (this.charging && this.type === shot) {
      this.charging = false;
      // Beim Aufschlag wählt die Taste die Art: J = gerade, K = Slice, L = Kick, I = von unten (Leertaste = Standard)
      const art = { j: 'gerade', k: 'slice', l: 'kick', i: 'unten' }[this.taste] || this.aufschlagArt;
      this.committed = { type: shot, power: this.power, art };
      if (this.ctx === 'serve') this.serveOut = this.profiRaw(this.committed);
    }
  }

  profiRaw(c) {
    const K = this.keys;
    const lr = (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0);
    const ud = (K.ArrowUp || K.w ? 1 : 0) - (K.ArrowDown || K.s ? 1 : 0);
    if (this.ctx === 'serve') return { type: 'serve', art: c.art, aim: lr * 0.85, power: c.power, committed: true };
    return { type: c.type, aimMode: 'abs', aim: lr * 0.88, depth: 0.78 + ud * 0.16, power: clamp(c.power, 0.2, 1), committed: true };
  }

  // ---------------------------------------------------------------
  // Controller (Switch Joy-Con, Pro Controller …)
  // ---------------------------------------------------------------
  // Der Zustand des Controllers kommt hier an – entweder aus der iOS-App (mit Bewegung) oder aus dem Browser.
  //   s = { name, lx, ly, a, b, x, y, pause, motion }   lx/ly: Stick von -1 bis 1 (ly: + = nach vorne)
  //   motion = { ax, ay, az, gx, gy, gz } oder null       a: Beschleunigung der Hand in g, g: Richtung "unten"
  setPad(s) {
    const P = this.pad, alt = P.btn;
    this.diag.pakete++;
    P.connected = true; P.name = s.name || 'Controller';
    P.x = tot(s.lx || 0); P.f = tot(s.ly || 0);
    P.motion = !!s.motion;
    const neu = { a: !!s.a, b: !!s.b, x: !!s.x, y: !!s.y, pause: !!s.pause, netz: !!s.netz };
    // Doppelklopfen von der Apple Watch (jedes hat eine Nummer, damit es nur einmal zählt) oder die Taste "Netz"
    const klopfen = s.geste && s.geste.id !== this.gesteId;
    if (s.geste) this.gesteId = s.geste.id;
    if (this.enabled && this.mode === 'controller' && (klopfen || (neu.netz && !alt.netz))) {
      this.netzWechsel = 'wechsel';
      this.diag.letzter = 'Doppelklopfen / Netz-Taste';
    }
    P.btn = neu;
    if (neu.pause && !alt.pause && this.onPause) this.onPause();
    // Ein fertig erkannter Schwung von der Apple Watch? Jeder hat eine Nummer, damit er nur einmal zählt.
    const uhr = s.schwung && s.schwung.id !== this.schwungId ? s.schwung : null;
    if (s.schwung) this.schwungId = s.schwung.id;
    if (uhr) { this.diag.uhr++; this.diag.letzter = `Kraft ${Math.round((uhr.kraft || 0) * 100)} %, ${(uhr.hoch || 0) < -0.35 ? 'von oben' : (uhr.hoch || 0) > 0.35 ? 'von unten' : 'seitlich'}`; }
    // Zum Einstellen: kurz anzeigen, dass ein Schwung von der Uhr angekommen ist und wie lange er unterwegs war.
    if (uhr && this.onHint) {
      const ms = Math.round((uhr.alter || 0) * 1000);
      this.onHint(this.mode === 'controller' ? `⌚ Schwung angekommen (${ms} ms unterwegs)` : '⌚ Schwung angekommen – Steuerung steht nicht auf „Controller“');
    }
    // Im Menü (kein Ballwechsel): Stick wählt einen Knopf aus, A drückt ihn, B geht zurück.
    if (!this.enabled && this.onMenu) {
      const dir = Math.abs(P.x) > Math.abs(P.f) ? (P.x > 0.6 ? 'rechts' : P.x < -0.6 ? 'links' : '')
        : (P.f > 0.6 ? 'hoch' : P.f < -0.6 ? 'runter' : '');
      const jetzt = performance.now();
      if (dir && (dir !== this.menuDir || jetzt - this.menuAt > 280)) { this.menuAt = jetzt; this.onMenu(dir); }
      this.menuDir = dir;
      if (neu.a && !alt.a) this.onMenu('ok');
      if (neu.b && !alt.b) this.onMenu('zurueck');
      return;
    }
    if (!this.enabled || this.mode !== 'controller') return;
    // Tasten wie auf der Switch: A = Topspin, B = Slice, X = Lob, Y = Stoppball
    // (Mit einer Taste darf man immer aufschlagen und schmettern – dafür steht das "true" in der Mitte.)
    // Beim Aufschlag wählen die Tasten die Art: A = Standard, B = Slice, X = Kick, Y = von unten.
    if (neu.a && !alt.a) this.commitPad('drive', 0.75, true, this.aufschlagArt);
    if (neu.b && !alt.b) this.commitPad('slice', 0.6, true, 'slice');
    if (neu.x && !alt.x) this.commitPad('lob', 0.6, true, 'kick');
    if (neu.y && !alt.y) this.commitPad('drop', 0.4, true, 'unten');
    // Sobald die Uhr einmal einen Schwung gemeldet hat, zählt nur noch sie –
    // sonst würde das iPhone in der Hosentasche auch Schläge auslösen.
    if (s.schwung) this.uhrAktiv = true;
    if (uhr) this.schwungFertig(uhr.kraft, uhr.hoch, clamp((uhr.alter || 0) + UHR_VERZUG, 0, 0.5));
    else if (s.motion && !this.uhrAktiv) this.fuehleSchwung(s.motion);
  }

  padWeg() { this.pad = { connected: false, name: '', x: 0, f: 0, btn: {}, motion: false }; this.uhrAktiv = false; }

  // Aus den Bewegungsdaten einen Schwung erkennen:
  // Wird die Hand stark beschleunigt, beginnt ein Schwung. Wir merken uns kurz den stärksten Wert
  // und ob die Bewegung dabei nach oben oder nach unten ging.
  fuehleSchwung(m) {
    const S = this.schwung;
    const stark = Math.hypot(m.ax, m.ay, m.az);
    const hoch = -(m.ax * m.gx + m.ay * m.gy + m.az * m.gz);     // > 0: nach oben, < 0: nach unten
    if (!S.aktiv) {
      if (stark < SWING_START || this.time - S.ende < SWING_PAUSE) return;
      S.aktiv = true; S.t0 = this.time; S.peak = stark; S.hoch = hoch;
      return;
    }
    if (stark > S.peak) { S.peak = stark; S.hoch = hoch; }
    if (this.time - S.t0 < 0.12) return;                         // 0,12 Sekunden lang den stärksten Wert suchen
    S.aktiv = false; S.ende = this.time;
    this.schwungFertig(clamp((S.peak - SWING_START) / (SWING_VOLL - SWING_START), 0, 1), S.hoch / S.peak, SCHWUNG_VERZUG);
  }

  // Ein Schwung ist erkannt – hier wird daraus ein Schlag.
  //   kraft: 0 bis 1 · hochAnteil: +1 = ganz nach oben, -1 = ganz nach unten, 0 = seitlich
  //   alter: so viele Sekunden ist der Schwung schon her (bei der Apple Watch dauert die Meldung einen Moment)
  schwungFertig(kraft, hochAnteil, alter) {
    if (this.onSchwung) this.onSchwung(kraft);      // z. B. damit das Handy als Schläger kurz rüttelt
    // Ging der Schwung senkrecht (von oben nach unten oder umgekehrt) oder eher seitlich?
    // Aufschlag und Schmetterball brauchen einen senkrechten Schwung – wie beim echten Tennis über dem Kopf.
    const senkrecht = Math.abs(hochAnteil) > 0.35;
    if (this.ctx === 'serve' && !senkrecht) {
      if (this.onHint) this.onHint('Aufschlag: von oben nach unten schwingen!');
      return;
    }
    // Von oben nach unten geschwungen = Slice, sonst Topspin
    const type = hochAnteil < -0.35 ? 'slice' : 'drive';
    this.commitPad(type, schwungHaerte(kraft), senkrecht, this.aufschlagArt);
    this.committed.schwung = true;         // merken: Das war ein echter Schwung (keine Taste) – dafür gibt es die Schwung-Hilfen
    this.padAt = this.time - alter;
  }

  // vonOben: true, wenn der Schwung senkrecht war (oder eine Taste gedrückt wurde)
  // art: Aufschlagart ('gerade', 'slice', 'kick', 'unten') oder null für den Standard
  commitPad(type, power, vonOben, art = null) {
    this.committed = { type, power, vonOben, art };
    this.padAt = this.time;
    if (this.ctx === 'serve') this.serveOut = this.padRaw(this.committed, 0);
  }

  // Aus dem Zeitpunkt des Schwungs wird die Richtung: -1 = ganz links (sehr früh), 0 = Mitte, +1 = ganz rechts (sehr spät).
  //   spaet = wie viele Sekunden nach dem besten Moment geschwungen wurde (0 = rechtzeitig)
  // Das Ergebnis gilt für einen Ball rechts von dir. Ist der Ball links (Rückhand), dreht schlagSeite es um.
  timingZiel(spaet) {
    const s = this.schlagSeite < 0 ? -1 : 1;
    if (spaet > 0) return s;                               // nach dem Treffmoment: ganz longline
    return s * this.zeitRichtung(this.time - this.padAt);  // so lange ist der Schwung schon her
  }

  // Aus "so viele Sekunden vor dem Treffen" wird die Richtung. Beim Wischen ist das Fenster länger.
  zeitRichtung(vorher) {
    return this.mode === 'wisch' ? richtungAusZeit(vorher, WISCH_FRUEH, WISCH_MITTE) : richtungAusZeit(vorher);
  }

  // Wie bei "profi": Die Richtung, in die der Stick beim Treffen zeigt, bestimmt das Ziel.
  padRaw(c, spaet = 0) {
    // Richtung: Wer einen Stick hat und ihn drückt, zielt damit. Sonst entscheidet das Timing.
    const ud = this.pad.f;
    if (this.ctx === 'serve') return { type: 'serve', art: c.art, aim: this.pad.x * 0.85, power: Math.min(1.05, c.power + 0.1), committed: true };
    // Wer schwingt und nicht mit dem Stick zielt, bekommt Hilfe: Der Ball geht eher in die Ecken und bei harten Schwüngen tiefer.
    const hilfe = !!c.schwung && !this.pad.x;
    const lr = this.pad.x || (hilfe ? schwungRichtung(this.timingZiel(spaet)) : this.timingZiel(spaet));
    const tief = hilfe ? SCHWUNG_TIEF * clamp((c.power - 0.5) * 2, 0, 1) : 0;
    return { type: c.type, aimMode: 'abs', aim: lr * 0.88, depth: 0.78 + ud * 0.16 + tief, power: clamp(c.power, 0.2, 1), committed: true, vonOben: !!c.vonOben, schwung: hilfe };
  }

  // Im Browser (ohne iOS-App) fragen wir den Controller selbst ab. Dort gibt es nur Stick und Tasten.
  pollPad() {
    if (this.nativePad || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    if (!gp) { if (this.pad.connected) this.padWeg(); return; }
    const B = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    // Nummern nach dem Standard-Aufbau: 0 = unten, 1 = rechts, 2 = links, 3 = oben, 9 = Start/Plus
    this.setPad({ name: gp.id, lx: gp.axes[0] || 0, ly: -(gp.axes[1] || 0), a: B(1), b: B(0), x: B(3), y: B(2), pause: B(9), motion: null });
  }

  // ---------------------------------------------------------------
  // Maus und Finger
  // ---------------------------------------------------------------
  onDown(e) {
    if (!this.enabled) return;
    if (this.mode === 'klassik') {
      if (e.pointerType === 'touch') return;
      if (e.button === 2) { this.commitClassic('lob'); return; }
      if (e.button !== 0) return;
      if (this.ctx === 'rally' && this.time - this.lastClick <= DOUBLE) {
        this.commitClassic('lob');
      } else {
        this.charging = true; this.power = 0; this.type = 'drive'; this.committed = null;
      }
      this.lastClick = this.time;
      return;
    }
    if (this.mode !== 'touch' && this.mode !== 'wisch') return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.kurzeSeite = Math.min(r.width, r.height) || 700;      // Maß für "wie schnell gewischt" (unabhängig von der Größe des Geräts)
    if (this.zweiStart(e.pointerId, x, y, zeitVon(e))) return;
    const wisch = this.mode === 'wisch';
    // Beim Wischen mit Laufhilfe "Voll" gibt es keinen Joystick: Überall auf dem Bildschirm zählt ein Wisch als Schlag.
    const mitStick = !(wisch && this.laufhilfe === 'voll');
    if (mitStick && x < r.width * 0.42 && this.stick.id === null) {
      this.stick = { id: e.pointerId, x0: x, y0: y, x: 0, f: 0, t0: this.time, wartet: wisch };
      if (!wisch) this.showStick(true, x, y, 0, 0);     // beim Wischen erscheint der Joystick erst nach einem Moment (siehe STICK_AB)
    } else if (!this.swipe) {
      this.swipe = { id: e.pointerId, x0: x, y0: y, x, y, t0: this.time, w: r.width };
    }
  }

  onMove(e) {
    const wisch = this.mode === 'wisch';
    if (!this.enabled || (this.mode !== 'touch' && !wisch)) return;
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const fi = this.finger.get(e.pointerId);
    if (fi) { fi.x = x; fi.y = y; fi.spur.push({ x, y, t: zeitVon(e) }); if (fi.spur.length > 40) fi.spur.shift(); }
    if (this.zwei) return wisch ? undefined : this.zweiBewegt();     // beim Wischen wird erst beim Loslassen ausgewertet
    if (e.pointerId === this.stick.id) {
      const R = 55;
      let dx = (x - this.stick.x0) / R, dy = (y - this.stick.y0) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stick.x = dx; this.stick.f = -dy;
      if (!this.stickWartet()) this.showStick(true, this.stick.x0, this.stick.y0, dx * R, dy * R);
    } else if (this.swipe && e.pointerId === this.swipe.id) {
      this.swipe.x = x; this.swipe.y = y;
      if (!wisch) this.live = this.swipeRaw(this.swipe, false);
    }
  }

  onUp(e) {
    if (this.mode === 'klassik') {
      if (!this.enabled || e.button !== 0 || !this.charging) return;
      this.commitClassic('drive');
      return;
    }
    if (this.mode === 'wisch') return this.wischHoch(e);
    if (this.mode !== 'touch') return;
    this.finger.delete(e.pointerId);
    if (this.zwei) {
      // Das Wischen mit zwei Fingern ist erst vorbei, wenn beide Finger wieder oben sind
      if (!this.finger.has(this.zwei.a) && !this.finger.has(this.zwei.b)) this.zwei = null;
      return;
    }
    if (e.pointerId === this.stick.id) {
      this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 };
      this.showStick(false);
    } else if (this.swipe && e.pointerId === this.swipe.id) {
      const raw = this.enabled ? this.swipeRaw(this.swipe, true) : null;
      this.swipe = null;
      this.live = null;
      if (!raw) return;
      this.committed = raw;
      if (this.ctx === 'serve') this.serveOut = raw;
    }
  }

  // Touch: Ein Finger setzt auf. Liegt schon ein zweiter Finger ganz frisch und nah daneben,
  // ist das der Anfang von "mit zwei Fingern wischen". Dann zählt keiner der beiden mehr als Joystick oder Schlag.
  zweiStart(id, x, y, t = 0) {
    let partner = null;
    if (!this.zwei) {
      for (const [pid, f] of this.finger) {
        if (this.time - f.t0 <= ZWEI_ZEIT && Math.hypot(f.x0 - x, f.y0 - y) <= ZWEI_NAH && Math.hypot(f.x - f.x0, f.y - f.y0) < 30) partner = pid;
      }
    }
    this.finger.set(id, { x0: x, y0: y, x, y, t0: this.time, spur: [{ x, y, t }] });
    if (this.zwei) return true;            // ein dritter Finger während des Wischens: ignorieren
    if (partner === null) return false;
    this.zwei = { a: partner, b: id, fertig: false };
    if (this.stick.id === partner) { this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 }; this.showStick(false); }
    if (this.swipe && this.swipe.id === partner) { this.swipe = null; this.live = null; }
    return true;
  }

  // Touch: Beide Finger sind weit genug in dieselbe Richtung gewischt? Nach oben = ans Netz, nach unten = Grundlinie.
  zweiBewegt() {
    const Z = this.zwei, a = this.finger.get(Z.a), b = this.finger.get(Z.b);
    if (Z.fertig || !a || !b) return;
    const da = a.y - a.y0, db = b.y - b.y0;
    if (Math.abs(da) < ZWEI_WEG || Math.abs(db) < ZWEI_WEG || Math.sign(da) !== Math.sign(db)) return;
    Z.fertig = true;
    this.netzWechsel = da < 0 ? 'vor' : 'zurueck';
  }

  // ---------------------------------------------------------------
  // Steuerung "wisch": nur wischen
  // ---------------------------------------------------------------
  // Ein Finger geht hoch. Was war das: ein Tipp, ein Wisch mit einem Finger oder einer mit zwei Fingern?
  wischHoch(e) {
    const id = e.pointerId, t = zeitVon(e);
    const fi = this.finger.get(id);
    this.finger.delete(id);
    if (this.zwei) {
      const Z = this.zwei;
      // Mit zwei Fingern gewischt: Sobald der erste Finger hochgeht, wird ausgewertet (Mittelwert aus beiden Fingern).
      if (!Z.fertig && fi && (id === Z.a || id === Z.b)) {
        Z.fertig = true;
        const anderer = this.finger.get(id === Z.a ? Z.b : Z.a);
        const a = wischStueck(fi, t), b = anderer ? wischStueck(anderer, t) : a;
        // Beide Finger müssen in dieselbe Richtung (hoch oder runter) gewischt haben
        if (this.enabled && Math.sign(a.dy) === Math.sign(b.dy)) {
          this.wischFertig({ dx: (a.dx + b.dx) / 2, dy: (a.dy + b.dy) / 2, dauer: Math.max(a.dauer, b.dauer) }, 2);
        }
      }
      if (!this.finger.has(Z.a) && !this.finger.has(Z.b)) this.zwei = null;
      return;
    }
    const warStick = id === this.stick.id, warWisch = this.swipe && id === this.swipe.id;
    if (warStick) { this.stick = { id: null, x0: 0, y0: 0, x: 0, f: 0 }; this.showStick(false); }
    if (warWisch) this.swipe = null;
    if (!fi || !this.enabled) return;
    // Kurz getippt, ohne zu wischen? Zwei Tipps schnell nacheinander = ans Netz und wieder zurück.
    if (Math.hypot(fi.x - fi.x0, fi.y - fi.y0) < TIPP_WEG) {
      if (this.time - fi.t0 > TIPP_ZEIT) return;
      if (t - this.tippZeit <= DOPPEL_TIPP) { this.netzWechsel = 'wechsel'; this.tippZeit = -9; }
      else this.tippZeit = t;
      return;
    }
    // Ein schneller Wisch auf der linken Seite ist auch ein Schlag (und kein Laufen mit dem Joystick).
    if (warWisch || (warStick && this.time - fi.t0 <= WISCH_KURZ)) this.wischFertig(wischStueck(fi, t), 1);
  }

  // Wischen: Liegt der Finger links erst ganz kurz auf? Dann ist noch offen, ob es ein Wisch oder Laufen wird –
  // so lange bewegt der Joystick den Spieler noch nicht.
  stickWartet() {
    return !!this.stick.wartet && this.time - this.stick.t0 < STICK_AB;
  }

  // Ein Wisch ist fertig – hier wird daraus ein Schlag oder ein Aufschlag.
  //   w = { dx, dy, dauer }: so weit (Pixel) und so lange (Sekunden) wurde gewischt · finger: 1 oder 2
  wischFertig(w, finger) {
    const len = Math.hypot(w.dx, w.dy);
    if (len < WISCH_MIN) return;
    // Wie schnell? In "Bildschirmhöhen pro Sekunde", damit es auf iPhone und iPad gleich ist.
    const tempo = len / Math.max(w.dauer, 0.03) / (this.kurzeSeite || 700);
    const kraft = clamp((tempo - WISCH_LANGSAM) / (WISCH_SCHNELL - WISCH_LANGSAM), 0, 1);
    const power = 0.25 + 0.75 * kraft;
    const hoch = w.dy < 0;
    if (this.ctx === 'serve') {
      // Aufschlag: hoch = gerade, runter = Slice; mit zwei Fingern hoch = Kick, runter = von unten.
      if (Math.abs(w.dy) < 0.4 * len) { if (this.onHint) this.onHint('Aufschlag: nach oben oder nach unten wischen!'); return; }
      const art = finger === 2 ? (hoch ? 'kick' : 'unten') : (hoch ? 'gerade' : 'slice');
      // Schräg gewischt = Richtung: nach links geneigt = linke Ecke des Aufschlagfelds, nach rechts = rechte Ecke
      const aim = clamp(w.dx / Math.abs(w.dy) / WISCH_SCHRAEG, -1, 1) * 0.85;
      this.wischLetzter = { name: 'Aufschlag ' + art, kraft, finger };
      this.committed = { type: 'serve', art, aim, power, committed: true };
      this.serveOut = this.committed;
      return;
    }
    let c;
    if (finger === 2) {
      // Im Ballwechsel: zwei Finger nach oben = Lob (nach unten bedeutet nichts)
      if (!hoch || Math.abs(w.dy) < Math.abs(w.dx)) return;
      c = { type: 'lob', name: 'Lob', power: 0.6 };
    } else {
      const a = wischArt(w.dx, w.dy);
      c = { type: a.type, depth: a.depth, name: a.name, power };
      if (a.kurz) {
        // Kurzer Slice: nie hart. Ganz sanft gewischt wird daraus ein Stoppball direkt hinter das Netz.
        if (kraft < WISCH_STOPP) c = { type: 'drop', name: 'Stoppball', power: 0.4 };
        else c.power = Math.min(power, 0.6);
      }
    }
    this.wischLetzter = { name: c.name, kraft, finger };
    this.committed = c;
    this.padAt = this.time - WISCH_VERZUG;      // ab hier läuft die Uhr für das Timing (früh = cross, spät = longline)
  }

  // Die Richtung kommt wie beim Controller aus dem Zeitpunkt des Wischens.
  wischRaw(c, spaet = 0) {
    if (c.type === 'serve') return c;
    return { type: c.type, aimMode: 'abs', aim: this.timingZiel(spaet) * 0.88, depth: c.depth, power: clamp(c.power, 0.2, 1), committed: true, vonOben: true };
  }

  commitClassic(type) {
    this.charging = false;
    this.type = type;
    this.committed = { type, power: type === 'lob' ? 0.6 : this.power };
    if (this.ctx === 'serve') this.serveOut = this.classicRaw(true);
  }

  classicRaw(committed) {
    const c = this.committed;
    const power = c ? c.power : this.power;
    const idle = !c && !this.charging;       // noch nichts gedrückt: nur die Richtung zeigen
    if (this.ctx === 'serve') return { type: 'serve', art: this.aufschlagArt, aim: this.aim, power, committed, idle };
    return { type: c ? c.type : this.type, aimMode: 'angle', aim: this.aim, power, committed, idle };
  }

  // Aus einer Wischbewegung wird ein Schlag
  swipeRaw(s, final) {
    const dx = s.x - s.x0, dy = s.y - s.y0;
    const len = Math.hypot(dx, dy);
    const serve = this.ctx === 'serve';
    const aim = clamp(dx / 110, -1, 1);
    if (len < 18) {
      if (!final) return null;
      const tapAim = clamp((s.x0 - s.w * 0.71) / (s.w * 0.2), -1, 1) * 0.7;
      if (serve) return { type: 'serve', art: this.aufschlagArt, aim: tapAim, power: 0.55, committed: true };
      const double = this.time - this.lastTap <= DOUBLE;
      this.lastTap = this.time;
      if (double) return { type: 'lob', aimMode: 'abs', aim: tapAim, power: 0.6, committed: true };
      return { type: 'drive', aimMode: 'abs', aim: tapAim, depth: 0.7, power: 0.5, committed: true };
    }
    const power = clamp((len - 40) / 200, 0.15, 1.15);
    if (serve) return { type: 'serve', art: this.aufschlagArt, aim, power, committed: final };
    if (dy > 18 && Math.abs(dy) > Math.abs(dx) * 0.6) {
      return { type: 'drop', aimMode: 'abs', aim, power: 0.4, committed: final };
    }
    if (Math.abs(dx) > Math.abs(dy) * 2.5) {
      return { type: 'slice', aimMode: 'abs', aim: Math.sign(dx) * 0.85, depth: 0.8, power: 0.6, committed: final };
    }
    return { type: 'drive', aimMode: 'abs', aim, depth: 0.45 + 0.5 * power, power: Math.min(1, power), committed: final };
  }

  showStick(on, x = 0, y = 0, kx = 0, ky = 0) {
    const s = this.stickEl;
    if (!s) return;
    s.style.display = on ? 'block' : 'none';
    if (!on) return;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.firstElementChild.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  // ---------------------------------------------------------------
  // Abfragen durch das Match
  // ---------------------------------------------------------------
  update(dt) {
    this.time += dt;
    if (!this.enabled) return;
    const K = this.keys;
    if (this.mode === 'klassik') {
      const lr = (K.ArrowRight ? 1 : 0) - (K.ArrowLeft ? 1 : 0);
      this.aim = clamp(this.aim + lr * 1.5 * dt, -1, 1);
      if (this.charging) this.power = Math.min(POWER_MAX, this.power + dt / CHARGE_TIME);
    } else if (this.mode === 'profi') {
      if (this.charging) this.power = Math.min(this.ctx === 'serve' ? 1.25 : 1, this.power + dt / 0.5);
    } else if (this.mode === 'controller' || this.mode === 'wisch') {
      // Zu früh geschwungen oder gewischt? Dann verfällt der Schlag wieder – wie beim echten Tennis muss das Timing stimmen.
      if (this.committed && this.ctx === 'rally' && this.time - this.padAt > (this.mode === 'wisch' ? WISCH_HALTBAR : PAD_HALTBAR)) this.committed = null;
    }
  }

  move() {
    const K = this.keys;
    if (this.mode === 'klassik') return { x: 0, f: (K.ArrowUp ? 1 : 0) - (K.ArrowDown ? 1 : 0) };
    if (this.mode === 'profi') {
      return {
        x: (K.ArrowRight || K.d ? 1 : 0) - (K.ArrowLeft || K.a ? 1 : 0),
        f: (K.ArrowUp || K.w ? 1 : 0) - (K.ArrowDown || K.s ? 1 : 0),
      };
    }
    if (this.mode === 'controller') return { x: this.pad.x, f: this.pad.f };
    if (this.stickWartet()) return { x: 0, f: 0 };
    return { x: this.stick.x, f: this.stick.f };
  }

  // bisTreffen: nur für den Controller – Sekunden bis zum Treffen (negativ = schon vorbei)
  peek(serving, bisTreffen = null) {
    if (this.mode === 'klassik') return this.classicRaw(!!this.committed);
    if (this.mode === 'profi') {
      if (this.committed) return this.profiRaw(this.committed);
      if (this.charging) return { ...this.profiRaw({ type: this.type, power: this.power }), committed: false };
      return null;
    }
    if (this.mode === 'controller' || this.mode === 'wisch') {
      const wisch = this.mode === 'wisch';
      if (this.committed) return wisch ? this.wischRaw(this.committed) : this.padRaw(this.committed);
      // Noch nicht geschwungen: Die Ziellinie zeigt, wohin der Ball ginge, wenn du GENAU JETZT schwingst.
      // Sie wandert von cross (früh) über die Mitte nach longline (spät): bei der Vorhand von links nach rechts,
      // bei der Rückhand von rechts nach links.
      if (this.ctx !== 'rally' || bisTreffen === null || bisTreffen > 1.0) return null;
      const ziel = (this.schlagSeite < 0 ? -1 : 1) * (bisTreffen < 0 ? 1 : this.zeitRichtung(bisTreffen));
      return { type: 'drive', aimMode: 'abs', aim: ((!wisch && this.pad.x) || ziel) * 0.88, depth: 0.78, power: 0.6, committed: false };
    }
    return this.committed || this.live;
  }

  // spaet: nur für den Controller – wie viele Sekunden nach dem besten Moment (0 = rechtzeitig)
  consume(spaet = 0) {
    let raw = null;
    if (this.mode === 'klassik') {
      if (this.committed || this.charging) raw = this.classicRaw(true);
    } else if (this.mode === 'profi') {
      if (this.committed) raw = this.profiRaw(this.committed);
      else if (this.charging) raw = this.profiRaw({ type: this.type, power: this.power });
    } else if (this.mode === 'controller') {
      if (this.committed) raw = this.padRaw(this.committed, spaet);
    } else if (this.mode === 'wisch') {
      if (this.committed) raw = this.wischRaw(this.committed, spaet);
    } else {
      raw = this.committed;
    }
    this.committed = null; this.charging = false; this.power = 0; this.live = null;
    return raw;
  }

  // Fragt das Match: Wohin soll der Spieler laufen, wenn die Kamera steuert? (null = Kamera steuert gerade nicht)
  kameraZiel() {
    return this.kamera ? this.kamera.ziel(performance.now() / 1000) : null;
  }

  // Fragt das Match: Soll der Spieler ans Netz ('vor'), zurück ('zurueck') oder wechseln ('wechsel')?
  // (Die Frage löscht den Wunsch wieder. Ohne Wunsch kommt null.)
  takeNetz() {
    const r = this.netzWechsel;
    this.netzWechsel = null;
    return r;
  }

  takeServe() {
    const r = this.serveOut;
    this.serveOut = null;
    if (r) { this.committed = null; this.charging = false; this.power = 0; }
    return r;
  }

  // Für den Kraftbalken auf dem Bildschirm
  hud() {
    const show = this.mode !== 'touch' && this.mode !== 'wisch' && this.mode !== 'controller' && (this.charging || !!this.committed);
    const p = this.committed ? this.committed.power : this.power;
    return { show, power: p, max: POWER_MAX, limit: POWER_LIMIT, charging: this.charging, type: this.committed ? this.committed.type : this.type };
  }
}
