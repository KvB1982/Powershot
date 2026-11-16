// Powershot – Laufen mit der Kamera (wie bei der Kinect).
//
// Die Kamera filmt dich, und eine Körpererkennung findet Schultern und Hüften im Bild (siehe kamerabild.js).
// Diese Datei rechnet daraus aus, wo dein Spieler auf dem Platz stehen soll:
//
//   Du gehst im Zimmer nach rechts   ->  dein Spieler läuft nach rechts (viel weiter als du!)
//   Du gehst auf die Kamera zu       ->  dein Spieler läuft ans Netz
//
// Hier steckt nur Rechnen drin – keine Kamera, kein Bildschirm. Deshalb lässt sich die Datei
// auch ohne Browser testen: node tools/kamera.mjs

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// --- Mit diesen Zahlen kannst du die Kamera-Steuerung einstellen. ---
// Wie groß ist euer Zimmer? Die Zahl sagt, wie viele Meter dein Spieler läuft, wenn du 1 Meter gehst.
export const RAUM = {
  klein: { name: 'Klein (1 Schritt)', mal: 6 },
  mittel: { name: 'Mittel (2 Schritte)', mal: 4 },
  gross: { name: 'Groß (3 Schritte)', mal: 2.5 },
};
const RUMPF_METER = 0.5;        // so lang ist ein Oberkörper ungefähr (Schulter bis Hüfte). Damit rechnen wir Bild in Meter um.
const NETZ_AB = 0.07;           // so viel näher an der Kamera (Anteil des Abstands) – ab da läuft der Spieler nach vorne
const NETZ_VOLL = 0.28;         // so viel näher – dann steht er ganz vorne am Netz (bei 2,5 m Abstand: etwa 70 cm)
const WEICH_SEITE = 0.10;       // Sekunden: so stark wird das Zittern der Erkennung geglättet (seitlich)
const WEICH_VOR = 0.30;         // Sekunden: vor und zurück zittert mehr, also stärker glätten
const WEG_NACH = 0.7;           // Sekunden ohne Bild von dir – dann übernimmt wieder die Laufhilfe
const SICHER = 0.5;             // so sicher (0 bis 1) muss die Erkennung bei einem Punkt sein
const MESS_ZEIT = 1.2;          // Sekunden still stehen beim Einmessen

// Nummern der Körperpunkte, wie die Körpererkennung (MediaPipe) sie liefert
const SCHULTER_L = 11, SCHULTER_R = 12, HUEFTE_L = 23, HUEFTE_R = 24;

// Aus den Körperpunkten eines Bildes wird eine Messung: Wo ist die Körpermitte, wie groß erscheint der Körper?
//   punkte: Liste mit { x, y, visibility } – x und y von 0 bis 1 (links oben = 0, 0)
//   format: Breite des Bildes geteilt durch die Höhe (z. B. 640 / 480)
// Ergebnis: { x, breite, rumpf } in "Bildhöhen" – oder null, wenn die Schultern nicht zu sehen sind.
export function messen(punkte, format = 4 / 3) {
  if (!punkte || punkte.length <= HUEFTE_R) return null;
  const da = (p) => p && (p.visibility === undefined || p.visibility >= SICHER);
  const sl = punkte[SCHULTER_L], sr = punkte[SCHULTER_R], hl = punkte[HUEFTE_L], hr = punkte[HUEFTE_R];
  if (!da(sl) || !da(sr)) return null;
  const sx = (sl.x + sr.x) / 2 * format, sy = (sl.y + sr.y) / 2;
  const breite = Math.hypot((sl.x - sr.x) * format, sl.y - sr.y);
  if (!da(hl) || !da(hr)) return { x: sx, breite, rumpf: 0 };       // Hüfte nicht im Bild: nur die Schultern zählen
  const hx = (hl.x + hr.x) / 2 * format, hy = (hl.y + hr.y) / 2;
  return { x: (sx + hx) / 2, breite, rumpf: Math.hypot(sx - hx, sy - hy) };
}

export class KameraLauf {
  constructor() {
    this.art = 'aus';           // 'aus' | 'seite' (nur links/rechts) | 'voll' (auch vor und zurück)
    this.raum = 'mittel';       // siehe RAUM oben
    this.tauschen = false;      // true: links und rechts vertauschen (falls die Kamera ein Spiegelbild liefert)
    this.mitte = null;          // das Ergebnis vom Einmessen: { x, groesse, verhaeltnis }
    this.sammeln = null;        // läuft gerade ein Einmessen? Dann sammeln wir hier die Messungen.
    this.x = 0;                 // geglättet: so viele Meter stehst du neben der Mitte (+ = rechts von dir aus)
    this.naeher = 0;            // geglättet: so viel näher an der Kamera als beim Einmessen (0,2 = ein Fünftel des Wegs)
    this.zuletzt = -9;          // wann du zuletzt im Bild warst
    this.zeit = -9;             // wann das letzte Bild kam
    this.gesehen = false;       // warst du im letzten Bild zu sehen?
  }

  get bereit() { return !!this.mitte; }

  // Wie groß erscheint der Körper? Wir nehmen den Oberkörper ODER die Schulterbreite – je nachdem, was größer ist.
  // Warum? Drehst du dich zur Seite (beim Schlag), wird die Schulterbreite im Bild schmal, der Oberkörper bleibt gleich.
  // Beugst du dich nach vorne, wird der Oberkörper kurz, die Schultern bleiben gleich. Eins von beiden stimmt fast immer.
  groesse(m, verhaeltnis) {
    return Math.max(m.rumpf, m.breite * verhaeltnis);
  }

  // Einmessen starten: Stell dich in die Mitte und bleib kurz stehen.
  einmessen() { this.sammeln = { liste: [], t0: null }; this.mitte = null; }

  // Jedes Bild der Kamera kommt hier an. punkte = Körperpunkte (oder null, wenn niemand zu sehen ist), t = Zeit in Sekunden.
  update(punkte, format, t) {
    const dt = clamp(t - this.zeit, 0, 0.5);
    this.zeit = t;
    const m = messen(punkte, format);
    this.gesehen = !!m;
    if (!m) return;
    this.zuletzt = t;

    if (this.sammeln) {
      const S = this.sammeln;
      if (S.t0 === null) S.t0 = t;
      if (m.rumpf > 0) S.liste.push(m);                 // zum Einmessen muss auch die Hüfte im Bild sein
      if (t - S.t0 >= MESS_ZEIT && S.liste.length >= 5) {
        // Der Durchschnitt aller Messungen ist deine Mitte.
        const schnitt = (f) => S.liste.reduce((s, e) => s + f(e), 0) / S.liste.length;
        const rumpf = schnitt((e) => e.rumpf), breite = schnitt((e) => e.breite);
        this.mitte = { x: schnitt((e) => e.x), groesse: rumpf, verhaeltnis: breite > 0.01 ? rumpf / breite : 1.3 };
        this.sammeln = null;
        this.x = 0; this.naeher = 0;
      }
      return;
    }
    if (!this.mitte) return;

    const M = this.mitte;
    const gr = this.groesse(m, M.verhaeltnis);
    if (gr < 0.01) return;
    // Seitlich: Abstand zur Mitte im Bild, umgerechnet in Meter. Die Kamera sieht dich von vorne,
    // deshalb ist "rechts von dir aus" im Bild links – darum das Minus.
    let meter = -(m.x - M.x) / gr * RUMPF_METER;
    if (this.tauschen) meter = -meter;
    // Vor und zurück: Kommst du näher, erscheinst du größer. Doppelt so groß = halber Abstand.
    const naeher = 1 - M.groesse / gr;
    // Glätten: Der neue Wert zählt nur zum Teil, damit der Spieler nicht zittert.
    const teil = (weich) => 1 - Math.exp(-dt / weich);
    this.x += (meter - this.x) * teil(WEICH_SEITE);
    this.naeher += (naeher - this.naeher) * teil(WEICH_VOR);
  }

  // Wohin soll der Spieler? Das Match fragt das in jedem Bild.
  //   x:   Meter neben der Platzmitte (+ = rechts)
  //   vor: 0 = Grundlinie, 1 = am Netz, bis -1 = weit hinter der Grundlinie · null = Kamera steuert nur seitlich
  // Ergebnis null heißt: Die Kamera steuert gerade nicht (aus, nicht eingemessen oder niemand im Bild).
  ziel(t) {
    if (this.art === 'aus' || !this.mitte || this.sammeln || t - this.zuletzt > WEG_NACH) return null;
    const mal = (RAUM[this.raum] || RAUM.mittel).mal;
    let vor = null;
    if (this.art === 'voll') {
      const n = this.naeher;
      vor = Math.sign(n) * clamp((Math.abs(n) - NETZ_AB) / (NETZ_VOLL - NETZ_AB), 0, 1);
    }
    return { x: this.x * mal, vor };
  }
}
