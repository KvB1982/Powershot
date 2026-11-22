// Powershot – die Einlaufszene vor dem Match (ohne three.js, in node testbar: node tools/einlauf.mjs)
//
// Wie im Fernsehen, bevor es losgeht:
//   einlaufen   → beide Spieler kommen auf den Platz und gehen zu ihrer Grundlinie
//   einspielen  → sie schlagen sich ein paar lockere Bälle zu
//   steckbrief  → erst dein Gegner, dann du: eine Karte mit den wichtigsten Daten – dabei schlagen beide weiter Bälle
//
// Diese Datei rechnet nur aus, WO alle stehen, wo der Ball ist und wo die Kamera hinschaut.
// Gezeichnet wird in game3d.js (einlaufBild), die Karte und die Knöpfe baut app.js.
// Einstellungen → „Einlaufen vor dem Match“: ganz, nur Steckbrief oder aus. Ein Tipp springt zum nächsten Teil.

import { COURT as C, netHeightAt } from './physics.js';
import { STAT_NAMES, achtWerte, gesamt } from './faehigkeiten.js';

// ---- Zahlen zum Einstellen (alle geschätzt – einfach ändern und ausprobieren!) ----
export const GEH_TEMPO = 1.5;        // so schnell gehen die Spieler auf den Platz (Meter pro Sekunde, wie beim Seitenwechsel)
const START_X = -8.0, START_Z = 9.0; // hier kommen sie herein: am Rand neben der Bank (z zählt für beide vom Netz weg)
const EIN_WECHSEL = 3.0;             // nach so vielen Sekunden wechselt die Kamera beim Einlaufen vom Gegner zu dir
const EIN_VOR = 6.6, EIN_SEITE = 2.1; // dort steht die Kamera beim Einlaufen: so weit vor dem Spieler und so weit neben seinem Weg (Meter)
const HEIM_Z = C.L + 0.6;            // hier stehen sie am Ende: knapp hinter der Mitte der Grundlinie – genau dort beginnt das Match
const BAELLE = 6;                    // nach so vielen Schlägen kommt der erste Steckbrief (gespielt wird dabei weiter)
const ANLAUF = 1.1;                  // so lange dauert es, bis der erste Ball geschlagen wird (Sekunden)
const BALL_TEMPO = 17;               // so schnell fliegt der Ball beim Einspielen (Meter pro Sekunde, etwa 60 km/h – ganz locker)
const NACH_AUFPRALL = 0.68;          // nach dem Aufspringen ist der Ball nur noch so schnell (Anteil)
const TREFF_HOCH = 0.95;             // in dieser Höhe wird der Ball getroffen (Meter)
const AUFPRALL_Z = [7.6, 9.2];       // so weit hinter dem Netz springt der Ball auf (von … bis)
const STREUT_X = 1.3;                // so weit links oder rechts von der Mitte kommt der Ball an
const SEITE = 0.62;                  // so weit neben dem Körper wird der Ball getroffen (wie im Match)
const LAUF_MAX = 3.4;                // schneller laufen die Spieler beim Einspielen nicht
const NACH_LETZTEM = 0.6;            // so lange schaut man dem letzten Ball noch nach, bevor die Kamera zum Steckbrief wechselt
const KARTE_WEIT = 7.5, KARTE_NEBEN = 1.6;    // Steckbrief: so weit steht die Kamera vor dem Spieler, und so weit schaut sie neben ihn (damit rechts Platz für die Karte ist)
const KARTE_SEITE = 3.6, KARTE_HOCH = 1.55;   // … und so weit steht sie neben der Platzmitte (damit kein Ball in die Kamera fliegt) und so hoch
const KARTE_ZEIT = 5.5;              // so lange steht ein Steckbrief da (Sekunden)
const G = 9.81;                      // Erdanziehung

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => a + (b - a) * k;
const weich = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// Welche Teile gibt es bei welcher Einstellung?
export const TEILE = {
  an: ['einlaufen', 'einspielen', 'steckbrief1', 'steckbrief0'],
  kurz: ['steckbrief1', 'steckbrief0'],
};

export class Einlauf {
  // o: { art: 'an' | 'kurz', spieler: [du, gegner] (wie im Match), zufall: eigene Zufallsfunktion (nur zum Testen) }
  // wenn(name, info) wird gerufen bei: 'teil' (ein neuer Teil beginnt), 'schlag', 'aufprall', 'fertig'
  constructor(o, wenn = () => {}) {
    this.o = o;
    this.wenn = wenn;
    this.zufall = o.zufall || Math.random;
    this.teile = TEILE[o.art] || TEILE.an;
    this.an = true;
    this.zeit = 0;                    // Zeit seit Beginn der ganzen Szene
    // Die zwei Spieler: Seite 0 (du, unten, z > 0) und Seite 1 (Gegner, oben, z < 0). dz = +1 oder −1.
    this.leute = [0, 1].map((i) => {
      const s = o.spieler[i] || {}, dz = i === 0 ? 1 : -1;
      return {
        side: i, dz, hand: s.hand || 1, gross: clamp(((s.look && s.look.groesse) || 183) / 183, 0.9, 1.12),
        x: 0, z: dz * HEIM_Z, vx: 0, vz: 0, walk: false, face: 0, stroke: 'fh', tHit: null, planY: TREFF_HOCH, zielX: 0,
      };
    });
    this.ball = { x: 0, y: 0, z: 0, da: false, hand: null };     // hand = Seite des Spielers, der den Ball gerade in der Hand hält
    this.kamera = { von: [0, 5, 20], nach: [0, 1, 0], winkel: 50, schnitt: true };
    this.nr = -1;
    this.weiter();
  }

  get teil() { return this.teile[this.nr] || null; }

  // Zum nächsten Teil springen (auch beim Antippen). Nach dem letzten Teil ist die Szene vorbei.
  weiter() {
    if (!this.an) return;
    this.nr++;
    this.t = 0;                        // Zeit seit Beginn dieses Teils
    this.kamera.schnitt = true;        // die Kamera springt (ein „Schnitt“ wie im Film) statt zu fahren
    const teil = this.teil;
    if (!teil) return this.ueberspringen();
    this.daSeit = 0; this.kamWer = null; this.kamSeite = null; this.ende = null;
    // Läuft schon ein Ballwechsel (vom Einspielen her)? Dann geht er einfach weiter – nur die Kamera wechselt.
    const laeuft = teil !== 'einlaufen' && !!this.flug;
    if (!laeuft) {
      for (const p of this.leute) { p.tHit = null; p.vx = p.vz = 0; }
      this.ball.da = false; this.ball.hand = null;
      this.flug = null; this.schlagNr = 0; this.amZug = 1;       // der Gegner spielt den ersten Ball an
      if (teil === 'einlaufen') {
        for (const p of this.leute) { p.x = START_X; p.z = p.dz * START_Z; p.walk = true; p.face = null; }
      } else {
        // In allen anderen Teilen stehen die Spieler an ihrer Grundlinie und fangen an, sich Bälle zuzuspielen
        for (const p of this.leute) { p.x = 0; p.z = p.dz * HEIM_Z; p.zielX = 0; p.walk = false; p.face = null; }
        this.anspiel = 0;                                        // Zeit, bis der erste Ball geschlagen wird
      }
    }
    this.wenn('teil', { teil, seite: teil === 'steckbrief1' ? 1 : teil === 'steckbrief0' ? 0 : null }, this);
  }

  // Alles überspringen: Die Spieler stehen sofort dort, wo das Match beginnt.
  ueberspringen() {
    if (!this.an) return;
    this.an = false;
    for (const p of this.leute) { p.x = 0; p.z = p.dz * HEIM_Z; p.vx = p.vz = 0; p.walk = false; p.face = null; p.tHit = null; }
    this.ball.da = false; this.ball.hand = null; this.flug = null;
    this.wenn('fertig', {}, this);
  }

  // Jedes Bild aufrufen (dt = vergangene Zeit in Sekunden)
  update(dt) {
    if (!this.an || dt <= 0) return;
    this.zeit += dt; this.t += dt;
    const teil = this.teil;
    if (teil === 'einlaufen') this.einlaufen(dt);
    else if (teil === 'einspielen') this.einspielen(dt);
    else this.vorstellen(dt, teil === 'steckbrief1' ? 1 : 0);
  }

  // ---------------------------------------------------------------
  // Teil 1: Beide gehen von der Bank zu ihrer Grundlinie
  // ---------------------------------------------------------------
  einlaufen(dt) {
    let alleDa = true;
    for (const p of this.leute) {
      const dx = -p.x, dzz = p.dz * HEIM_Z - p.z, weit = Math.hypot(dx, dzz);
      if (weit > 0.06) {
        // gemütlich losgehen und vor dem Ziel abbremsen
        const v = Math.min(GEH_TEMPO * Math.min(1, this.t / 0.6 + 0.15), weit * 2.5 + 0.2);
        p.vx = dx / weit * v; p.vz = dzz / weit * v;
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.face = null;                 // beim Gehen schaut die Figur von selbst in Laufrichtung
        alleDa = false;
      } else { p.vx = p.vz = 0; p.face = 0; }      // angekommen: zum Netz drehen
    }
    // Kamera: zwei Einstellungen wie im Fernsehen. Erst kommt dein Gegner auf die Kamera zu, dann du.
    // Die Kamera steht dabei fest ein Stück vor dem Spieler neben seinem Weg und schaut ihm nur nach.
    const wer = this.t < EIN_WECHSEL ? 1 : 0;
    if (wer !== this.kamWer) {
      this.kamWer = wer; this.kamera.schnitt = true;
      const p = this.leute[wer], zx = 0, zz = p.dz * HEIM_Z;
      const lang = Math.hypot(zx - START_X, zz - p.dz * START_Z), wx = (zx - START_X) / lang, wz = (zz - p.dz * START_Z) / lang;   // Gehrichtung
      // Bis wohin kommt er in dieser Einstellung? Der Gegner etwa bis zur Hälfte, du bis zur Grundlinie.
      const weit = wer === 1 ? Math.min(lang, GEH_TEMPO * EIN_WECHSEL - 0.6) : lang;
      this.kamFest = [START_X + wx * (weit + EIN_VOR) + wz * p.dz * EIN_SEITE, 1.35, p.dz * START_Z + wz * (weit + EIN_VOR) - wx * p.dz * EIN_SEITE];
    }
    const z = this.leute[wer];
    this.kameraSetzen(this.kamFest, [z.x, 1.12 * z.gross, z.z], 40);
    if (alleDa) { this.daSeit = (this.daSeit || 0) + dt; if (this.daSeit > 0.5) this.weiter(); } else this.daSeit = 0;
  }

  // ---------------------------------------------------------------
  // Teil 2 (und weiter bei den Steckbriefen): Einspielen. Der Ball fliegt in zwei Bögen: vom Schläger bis zum Aufspringen und von dort bis zum Schläger des anderen.
  // ---------------------------------------------------------------
  // Wo wird der nächste Ball getroffen? schlaeger = wer ihn schlägt, von = Treffpunkt [x, y, z]
  neuerFlug(schlaeger, von) {
    const r = this.zufall, f = this.leute[1 - schlaeger];          // f = der Spieler, der den Ball bekommt
    const aufX = (r() * 2 - 1) * STREUT_X * 0.8, aufZ = f.dz * mix(AUFPRALL_Z[0], AUFPRALL_Z[1], r());
    const zielX = clamp(aufX * 1.25 + (r() * 2 - 1) * 0.3, -STREUT_X, STREUT_X), zielZ = f.dz * (HEIM_Z - 0.12);
    const t1 = Math.hypot(aufX - von[0], aufZ - von[2]) / BALL_TEMPO;
    const t2 = Math.hypot(zielX - aufX, zielZ - aufZ) / (BALL_TEMPO * NACH_AUFPRALL);
    // Vorhand oder Rückhand? Kommt der Ball auf die Seite der Schlaghand, wird es eine Vorhand (wie im Match).
    const vorhand = (zielX - f.x) * f.dz * f.hand >= -0.35;
    const seite = (vorhand ? 1 : -1) * f.hand * f.dz;
    f.stroke = vorhand ? 'fh' : 'bh';
    f.zielX = zielX - seite * SEITE;                               // dorthin stellt er sich
    return {
      schlaeger, von, auf: [aufX, 0, aufZ], ziel: [zielX, TREFF_HOCH, zielZ], t1, t2, t: 0, aufgeprallt: false,
      // Damit der Ball nach t1 Sekunden genau am Boden ist, braucht er diese Geschwindigkeit nach oben – und nach dem Aufspringen diese:
      hoch1: (-von[1] + G * t1 * t1 / 2) / t1, hoch2: (TREFF_HOCH + G * t2 * t2 / 2) / t2,
    };
  }

  // Wo ist der Ball nach t Sekunden?
  ballOrt(F, t) {
    if (t < F.t1) {
      const k = t / F.t1;
      return [mix(F.von[0], F.auf[0], k), F.von[1] + F.hoch1 * t - G * t * t / 2, mix(F.von[2], F.auf[2], k)];
    }
    const u = Math.min(t - F.t1, F.t2), k = u / F.t2;
    return [mix(F.auf[0], F.ziel[0], k), Math.max(0.033, F.hoch2 * u - G * u * u / 2), mix(F.auf[2], F.ziel[2], k)];
  }

  einspielen(dt) {
    this.ballwechsel(dt);
    // Nach genug Schlägen noch kurz dem Ball nachschauen, dann kommt der erste Steckbrief (der Ballwechsel läuft weiter)
    if (this.schlagNr >= BAELLE) {
      this.ende = (this.ende ?? NACH_LETZTEM) - dt;
      if (this.ende <= 0) return this.weiter();
    }
    // Kamera: erst schräg hinter dir, ab der Hälfte schräg hinter dem Gegner
    const hinten = this.schlagNr <= BAELLE / 2 ? 1 : -1;
    if (hinten !== this.kamSeite) { this.kamSeite = hinten; this.kamera.schnitt = true; }
    this.kameraSetzen([hinten * 2.4, 2.7, hinten * 18.4], [-hinten * 0.3 + this.ball.x * 0.08, 1.1, 0], 50);
  }

  // Die beiden spielen sich den Ball zu – so lange, bis die Szene vorbei ist.
  ballwechsel(dt) {
    const B = this.ball, L = this.leute;
    if (!this.flug) {
      this.anspiel += dt;
      // Vor dem ersten Ball: Der Gegner hält den Ball in der Hand und holt zur Vorhand aus
      const a = L[this.amZug];
      a.stroke = 'fh'; a.tHit = ANLAUF - this.anspiel; a.planY = 0.85;
      B.da = true; B.hand = a.side;
      const treff = [a.x + a.hand * a.dz * SEITE, 0.85, a.z - a.dz * 0.12];
      B.x = treff[0]; B.y = treff[1]; B.z = treff[2];                // (game3d.js lässt ihn aus der Hand dorthin fallen)
      B.fall = clamp(1 - a.tHit / 0.4, 0, 1);                         // 0 = noch in der Hand, 1 = am Treffpunkt
      if (this.anspiel >= ANLAUF) this.schlagen(a, treff);
    } else {
      const F = this.flug;
      F.t += dt;
      const f = L[1 - F.schlaeger];
      if (!F.aufgeprallt && F.t >= F.t1) { F.aufgeprallt = true; this.wenn('aufprall', { x: F.auf[0], z: F.auf[2] }, this); }
      const ort = this.ballOrt(F, F.t);
      B.x = ort[0]; B.y = ort[1]; B.z = ort[2];
      const rest = F.t1 + F.t2 - F.t;
      f.tHit = rest; f.planY = TREFF_HOCH;
      if (rest <= 0) this.schlagen(f, F.ziel);
    }
    // Laufen: Wer den Ball bekommt, stellt sich hin. Der andere geht gemütlich zurück zur Mitte.
    for (const p of L) {
      const dran = this.flug && this.flug.schlaeger !== p.side;
      const ziel = dran ? p.zielX : 0, v = clamp((ziel - p.x) * 4, -1, 1) * (dran ? LAUF_MAX : 1.6);
      p.vx = Math.abs(ziel - p.x) > 0.03 ? v : 0; p.vz = 0;
      p.x += p.vx * dt;
    }
  }

  // Ein Spieler trifft den Ball: Der Schwung beginnt, und der Ball fliegt zum anderen.
  schlagen(p, treff) {
    this.ball.hand = null;
    p.tHit = null;
    this.wenn('schlag', { side: p.side, kind: p.stroke, y: treff[1] }, this);
    this.schlagNr++;
    this.flug = this.neuerFlug(p.side, treff);
  }

  // ---------------------------------------------------------------
  // Teil 3 und 4: Steckbrief (seite = wer vorgestellt wird). Beide schlagen dabei weiter Bälle.
  // ---------------------------------------------------------------
  vorstellen(dt, seite) {
    this.ballwechsel(dt);
    const p = this.leute[seite], k = weich(this.t / KARTE_ZEIT);
    // Die Kamera steht ein gutes Stück vor dem Spieler schräg neben der Platzmitte und fährt ganz langsam näher.
    // Sie schaut ein Stück neben ihn, damit die Figur links im Bild steht und rechts Platz für die Karte ist.
    // (Von der Kamera aus ist „rechts“ = −dz in x.) Läuft der Spieler zum Ball, schwenkt die Kamera ein wenig mit.
    const weit = mix(KARTE_WEIT + 1, KARTE_WEIT, k);
    const von = [p.dz * KARTE_SEITE, KARTE_HOCH, p.z - p.dz * weit];
    this.kameraSetzen(von, [p.x * 0.6 - p.dz * KARTE_NEBEN, 1.1 * p.gross, p.z], 42);
    if (this.t >= KARTE_ZEIT) this.weiter();
  }

  kameraSetzen(von, nach, winkel) {
    const K = this.kamera;
    K.von = von; K.nach = nach; K.winkel = winkel;
  }
}

// ---------------------------------------------------------------
// Der Steckbrief: die wichtigsten Daten eines Spielers als Liste für die Karte
// ---------------------------------------------------------------
// p = Spieler (wie in data.js), mehr = { platz, punkte, titel, bilanz: [deine Siege, seine Siege], du: true }
// Echt sind Name, Land, Platz, Punkte, Größe und Jahrgang der bekannten Spieler. Die Stärken sind geschätzt (nur fürs Spiel).
export function steckbrief(p, mehr = {}) {
  const stil = p.stil || {}, look = p.look || {};
  const platz = mehr.platz ?? p.rank ?? null;
  const punkte = mehr.punkte ?? p.basePoints ?? null;
  const zeilen = [];
  if (punkte != null) zeilen.push(['Punkte', Math.round(punkte).toLocaleString('de-DE')]);
  if (stil.groesse) zeilen.push(['Größe', (stil.groesse / 100).toFixed(2).replace('.', ',') + ' m']);
  if (stil.jahr) zeilen.push(['Jahrgang', String(stil.jahr)]);
  zeilen.push(['Spielt', ((p.hand || 1) === -1 ? 'mit links' : 'mit rechts') + ', Rückhand ' + (look.bh === 1 ? 'mit einer Hand' : 'mit beiden Händen')]);
  if (p.stats) {
    // Die größte Stärke: die höchste der acht Fähigkeiten
    const w = achtWerte(p.stats);
    let beste = null;
    for (const key in STAT_NAMES) if (w[key] != null && (beste == null || w[key] > w[beste])) beste = key;
    if (beste) zeilen.push(['Größte Stärke', STAT_NAMES[beste] + ' (' + Math.round(w[beste]) + ')']);
    zeilen.push(['Gesamtstärke', String(Math.round(gesamt(w)))]);
  }
  if (mehr.titel != null) zeilen.push(['Turniersiege', String(mehr.titel)]);
  if (mehr.bilanz && mehr.bilanz[0] + mehr.bilanz[1] > 0) zeilen.push(['Bilanz gegen dich', mehr.bilanz[1] + ' : ' + mehr.bilanz[0]]);
  return { name: p.name || p.short || 'Spieler', land: p.country || '', platz, zeilen, merkmal: stil.merkmal || '', du: !!mehr.du };
}

// Nur für das Prüfwerkzeug (tools/einlauf.mjs)
export const ZAHLEN = { HEIM_Z, BAELLE, TREFF_HOCH, LAUF_MAX, KARTE_ZEIT, netHeightAt };
