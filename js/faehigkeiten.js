// Powershot – Die acht Fähigkeiten eines Tennisspielers.
//
// Früher gab es fünf Werte (Aufschlag, Kraft, Tempo, Präzision, Volley). Jetzt sind es acht – so, wie Trainer
// wirklich über Spieler reden: Wie gut ist die Vorhand? Die Rückhand? Hält er lange durch? Bleibt er ruhig?
//
// Diese Datei enthält nur Listen und kleine Rechnungen (kein three.js, keine anderen Dateien).

// Kürzel → Name. Die Reihenfolge hier ist auch die Reihenfolge in den Menüs.
export const STAT_NAMES = {
  s: 'Aufschlag', vh: 'Vorhand', rh: 'Rückhand', v: 'Volley',
  b: 'Beinarbeit', a: 'Ausdauer', m: 'Mental', k: 'Taktik',
};

// Was bringt eine Fähigkeit im Match?
export const STAT_INFO = {
  s: 'Schnellere und genauere Aufschläge',
  vh: 'Deine Vorhand wird härter und landet näher am Ziel',
  rh: 'Deine Rückhand wird härter und landet näher am Ziel',
  v: 'Bessere Volleys und Schmetterbälle am Netz',
  b: 'Du läufst schneller und erreichst mehr Bälle',
  a: 'Du wirst in langen Matches später müde, und ein Match kostet dich weniger Frische',
  m: 'Bei Breakball, Satzball und Matchball zitterst du weniger',
  k: 'Du spielst so, dass der Gegner später erkennt, wohin der Ball geht',
};

// Ausrüstung hat eigene Eigenschaften, die keine Fähigkeiten sind:
//   p = Kraft (macht Vorhand und Rückhand härter), c = Präzision (macht Vorhand und Rückhand genauer),
//   t = Tempo (zählt zur Beinarbeit).
// Diese Namen braucht die Anzeige, z. B. "+2 Kraft, +1 Präzision" bei einem Schläger.
export const BONUS_NAMES = { ...STAT_NAMES, p: 'Kraft', c: 'Präzision', t: 'Tempo' };

const runden = (x) => Math.round(Math.max(30, Math.min(99, x)));

// Aus den fünf alten Werten { s, p, t, c, v } werden die acht neuen.
// n = eine feste Zahl je Spieler (z. B. sein Platz), damit nicht alle gleich aussehen: Der eine hat die bessere
// Vorhand, der andere die bessere Rückhand. Diese Unterschiede sind ausgedacht, nicht gemessen.
export function achtWerte(alt, n = 0) {
  if (alt.vh != null) return alt;                     // sind schon acht Werte
  const { s, p, t, c, v } = alt;
  const z = (k) => ((n * 29 + k * 17) % 7) - 3;       // feste kleine Abweichung: -3 bis +3
  const schlag = (p + c) / 2, alle = (s + p + t + c + v) / 5;
  return {
    s, vh: runden(schlag + 2 + z(1)), rh: runden(schlag - 2 - z(1)), v,
    b: t, a: runden((t + alle) / 2 + z(2)), m: runden(alle + z(3)), k: runden((c + alle) / 2 + z(4)),
  };
}

// Gesamtstärke: der Durchschnitt der acht Fähigkeiten. Kraft und Präzision der Ausrüstung zählen ein wenig mit.
export function gesamt(werte) {
  const st = achtWerte(werte);
  let summe = (st.kraft || 0) + (st.praez || 0);
  for (const k in STAT_NAMES) summe += st[k];
  return Math.round(summe / 8);
}
