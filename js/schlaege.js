// Powershot – alle Schlagarten und Aufschlagarten als Tabelle.
// Hier steht, wie schnell ein Schlag ist und wie stark sich der Ball dabei dreht.
// Die Zahlen sind an Messungen aus dem Profi-Tennis angelehnt. Du kannst sie ändern und ausprobieren!
//
// Was die Zahlen bedeuten:
//   tempo      : [langsam, schnell] in Metern pro Sekunde. Ein schwacher Spieler schafft das linke Tempo,
//                ein sehr kräftiger das rechte. (Mal 3,6 ergibt km/h: 40 m/s = 144 km/h.)
//                Seit dem 21.11.2026 mit Absicht etwas schneller als im echten Tennis – das macht mehr Spaß.
//   kraft      : wie viel vom Tempo davon abhängt, wie fest man schlägt (0 = immer gleich schnell)
//   top        : Drall in Umdrehungen pro Minute. + = Topspin (Ball fällt steil und springt hoch und weit weg),
//                − = Slice (Ball schwebt, kommt flach an und bleibt flach)
//   seite      : + = Ball biegt in der Luft nach rechts ab, − = nach links (für Rechtshänder; Linkshänder gespiegelt)
//   drall      : + = Ball springt beim Aufkommen nach rechts weg, − = nach links (für Rechtshänder)
//   netz       : so viele Meter soll der Ball mindestens über das Netz gehen. Zwei Zahlen = [locker, volle Kraft].
//   bogen      : nur bei Gefühlsschlägen: genau so hoch (Meter) geht der Ball über das Netz – das Tempo ergibt sich daraus
//   streu      : wie ungenau der Schlag ist (1 = normal, größer = riskanter)
//   netzfehler : wie oft der Ball im Netz hängen bleibt (1 = normal)

export const SCHLAEGE = {
  // Der normale Grundschlag der Profis: viel Tempo und etwa 2600 Umdrehungen. Sicher, weil der Ball von selbst herunterfällt.
  drive:   { name: 'Topspin', tempo: [28, 46], kraft: 0.5, top: 2600, netz: [0.30, 0.15], streu: 1, netzfehler: 1 },
  // Gerader Angriffsschlag: sehr schnell, knapp über das Netz, wenig Drall. Bleibt flach – aber geht leicht ins Netz oder ins Aus.
  flach:   { name: 'Gerader Schuss', tempo: [32, 52], kraft: 0.5, top: 900, netz: [0.15, 0.08], streu: 1.25, netzfehler: 1.8 },
  // Hoher Topspin (wie auf Sand): langsamer, hoch über das Netz, springt dem Gegner bis auf Schulterhöhe.
  topspin: { name: 'Hoher Topspin', tempo: [23, 38], kraft: 0.5, top: 3800, netz: [0.80, 0.60], streu: 0.85, netzfehler: 0.5 },
  // Slice: Rückwärtsdrall. Der Ball schwebt lange, kommt flach an und rutscht flach weg.
  slice:   { name: 'Slice', tempo: [21, 30], kraft: 0.30, top: -2400, netz: 0.20, streu: 1, netzfehler: 1 },
  // Stoppball: ganz langsam mit viel Rückwärtsdrall. Er bleibt nach dem Aufkommen fast liegen.
  drop:    { name: 'Stoppball', bogen: 0.40, top: -3000, netz: 0.30, streu: 1, netzfehler: 1, tiefe: [1.5, 4] },
  // Lob: hoch über den Gegner hinweg, mit etwas Topspin, damit er noch im Feld herunterkommt.
  lob:     { name: 'Lob', tempo: [11.5, 11.5], kraft: 0, top: 1200, netz: 1.5, streu: 1, netzfehler: 1 },
  // Volley: der Ball wird aus der Luft nur geblockt, mit ein wenig Rückwärtsdrall.
  volley:  { name: 'Volley', tempo: [19, 31], kraft: 0.40, top: -800, netz: 0.20, streu: 1, netzfehler: 1 },
  // Schmetterball: von oben mit voller Wucht.
  smash:   { name: 'Schmetterball', tempo: [36, 50], kraft: 0, top: 300, netz: 0.15, streu: 1, netzfehler: 1 },
};

// Diese Schläge sind "normale" Grundschläge. Am Netz wird daraus ein Volley, bei hohen Bällen ein Schmetterball.
export const GRUNDSCHLAEGE = ['drive', 'flach', 'topspin'];

// Aufschläge. "tempo" ist hier ein Anteil vom schnellsten Aufschlag des Spielers (1 = volles Tempo).
// "zweiter" sagt, wie viel vorsichtiger die Art als zweiter Aufschlag gespielt wird.
export const AUFSCHLAEGE = {
  // Gerader Aufschlag: der schnellste. Kaum Drall, deshalb ist das Fenster über dem Netz winzig – oft ein Fehler.
  gerade: { name: 'Gerade', kurz: 'Gerade', tempo: 1.0, top: 500, seite: -300, drall: 0, netz: 0.10, streu: 1, netzfehler: 1,
            zweiter: { tempo: 0.86, streu: 0.7, netzfehler: 0.6 } },
  // Slice-Aufschlag: der Ball dreht seitlich, fliegt eine Kurve nach links und zieht den Gegner aus dem Feld. Bleibt flach.
  slice:  { name: 'Slice', kurz: 'Slice', tempo: 0.90, top: 600, seite: -2600, drall: 0, netz: 0.15, streu: 0.8, netzfehler: 0.7,
            zweiter: { tempo: 0.93, streu: 0.8, netzfehler: 0.7 } },
  // Kick-Aufschlag: viel Topspin. Geht hoch über das Netz, fällt steil ins Feld und springt hoch und nach rechts weg.
  // Langsamer, aber sehr sicher – der beliebteste zweite Aufschlag.
  kick:   { name: 'Kick', kurz: 'Kick', tempo: 0.74, top: 4200, seite: -900, drall: 2800, netz: 0.70, streu: 0.55, netzfehler: 0.35,
            zweiter: { tempo: 0.97, streu: 0.9, netzfehler: 1 } },
  // Aufschlag von unten: erlaubt, aber selten. Kurz und langsam mit Rückwärtsdrall – eine Überraschung,
  // wenn der Gegner weit hinten steht. "hoehe" = so hoch wird der Ball getroffen.
  unten:  { name: 'Von unten', kurz: 'Von unten', bogen: 0.40, top: -2400, seite: -1200, drall: 0, netz: 0.20, streu: 0.5, netzfehler: 0.5,
            tiefe: [1.6, 3.4], hoehe: 0.75, zweiter: { tempo: 1, streu: 1, netzfehler: 1 } },
};

// Die Reihenfolge für Knöpfe und Tasten (1, 2, 3, 4)
export const AUFSCHLAG_ARTEN = ['gerade', 'slice', 'kick', 'unten'];

// Wer nichts auswählt, schlägt den ersten Aufschlag gerade und den zweiten als Kick – wie die meisten Profis.
export const standardAufschlag = (serveNo) => (serveNo === 1 ? 'gerade' : 'kick');

// Mischt eigene Zahlen über eine Schlagart. So kann eine Steuerung (z. B. die Apple Watch) einen Schlag
// ganz genau vorgeben:  schlagWerte('drive', { top: 3400, tempo: 31 })
//   extra.tempo als einzelne Zahl = festes Tempo in m/s
export function schlagWerte(art, extra) {
  const basis = SCHLAEGE[art] || SCHLAEGE.drive;
  return extra ? { ...basis, ...extra } : basis;
}
export function aufschlagWerte(art, extra) {
  const basis = AUFSCHLAEGE[art] || AUFSCHLAEGE.gerade;
  return extra ? { ...basis, ...extra } : basis;
}
