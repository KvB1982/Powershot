// Powershot – Show-Schläge: besondere Schläge, bei denen das Publikum aufspringt.
//
// WICHTIG: Für diese Schläge gibt es noch KEINE Bewegungen. Ihr nehmt sie selbst auf (Motion Capture).
// Diese Datei ist nur die Vorbereitung: Sie sagt, welche Show-Schläge es geben soll, wie die Aufnahme heißen muss
// und in welcher Spielsituation der Schlag kommt. Solange eine Aufnahme fehlt, passiert im Spiel nichts Neues.
//
// So kommt ein Show-Schlag ins Spiel:
//   1. Bewegung aufnehmen und als FBX in den Ordner mocap/ legen – mit dem Namen aus `datei` (z. B. mocap/Show_Tweener.FBX).
//   2. `node tools/mocap.mjs` laufen lassen. Das Werkzeug kennt die Namen schon (Tabelle CLIPS dort).
//   3. Fertig: Sobald die Situation passt (`passt`), spielt die Figur die Aufnahme statt des normalen Schlags.
//
// Diese Datei enthält kein three.js. Mit einer echten Aufnahme ist das Ganze noch nicht erprobt.

//   clip   = Name der Bewegung in mocap/bewegungen.json
//   datei  = Name der FBX-Datei im Ordner mocap/ (ohne .FBX)
//   basis  = welche normalen Schläge der Show-Schlag ersetzen darf (Namen wie in posen.js: fh_ts, bh_ts, fh_sl, bh_sl, fh_vo, bh_vo)
//   passt  = in welcher Spielsituation (s.y = Höhe des Treffpunkts in Metern, s.volley, s.defend = kommt kaum an den Ball,
//            s.inside = steht im Feld, s.weg = rennt vom Netz weg)
//   aufnehmen = Tipp für die Aufnahme
export const SHOW = {
  tweener: { name: 'Tweener', clip: 'show_tweener', datei: 'Show_Tweener', basis: ['fh_ts', 'bh_ts', 'fh_sl', 'bh_sl'],
    passt: (s) => !!s.weg && !s.volley && s.y < 0.8,
    text: 'Der Schlag zwischen den Beinen hindurch – mit dem Rücken zum Netz, wenn man einem Lob hinterherrennt.',
    aufnehmen: 'Vom Netz weglaufen, dann den Ball tief zwischen den Beinen nach hinten schlagen. Treffpunkt etwa auf Kniehöhe.' },
  sprung: { name: 'Sprung-Rückhand', clip: 'show_sprung', datei: 'Show_Sprung_Rueckhand', basis: ['bh_ts'],
    passt: (s) => !s.volley && !s.weg && s.y > 1.45 && s.y <= 2.0,
    text: 'Beidhändige Rückhand im Sprung, wenn der Ball über Schulterhöhe kommt.',
    aufnehmen: 'Hochspringen und den Ball am höchsten Punkt mit beiden Händen treffen.' },
  lasso: { name: 'Lasso-Vorhand', clip: 'show_lasso', datei: 'Show_Lasso_Vorhand', basis: ['fh_ts'],
    passt: (s) => !s.volley && !s.weg && !!s.defend && s.y < 1.2,
    text: 'Vorhand aus vollem Lauf: Der Schläger schwingt über dem Kopf aus wie ein Lasso.',
    aufnehmen: 'Aus dem Laufen zur Vorhandseite schlagen und den Schläger über dem Kopf ausschwingen lassen.' },
  hecht: { name: 'Hechtvolley', clip: 'show_hecht', datei: 'Show_Hechtvolley', basis: ['fh_vo', 'bh_vo'],
    passt: (s) => !!s.volley && !!s.defend,
    text: 'Volley im Hechtsprung, wenn der Ball eigentlich schon vorbei ist.',
    aufnehmen: 'Zur Seite hechten (auf eine Matte!) und den Ball mit ausgestrecktem Arm treffen.' },
};

// Welcher Show-Schlag passt jetzt? basis = der normale Schlag, sit = Spielsituation (siehe oben),
// gibtEs(clip) = sagt, ob es die Aufnahme gibt. Zurück kommt der Schlüssel aus SHOW oder null.
export function showFuer(basis, sit, gibtEs) {
  for (const id in SHOW) {
    const S = SHOW[id];
    if (S.basis.includes(basis) && S.passt(sit) && gibtEs(S.clip)) return id;
  }
  return null;
}
