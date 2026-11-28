// Powershot – die Regler vom Physik-Labor.
// Hier stehen alle Zahlen, die man im Spiel selbst verstellen kann (Hauptmenü → „Physik-Labor“).
// Diese Datei kennt keine Grafik und keine andere Datei – man kann sie auch ohne Browser testen.
//
// So funktioniert es:
//   REGLER = die Liste aller Regler: Name, Erklärung, kleinster und größter Wert, Standard.
//   R      = die Werte, die GERADE gelten. Ballphysik, Match und Steuerung schauen bei jedem Schlag hier nach.
//   Die meisten Regler sind ein "Mal-Wert": 1 = wie immer, 1.2 = ein Fünftel mehr, 0.8 = ein Fünftel weniger.
//   Steht jeder Regler auf Standard, rechnet das Spiel haargenau wie ohne Labor.
//
// Außerhalb vom Labor (Karriere, Saison, Turnier, Freies Spiel) gelten immer die Standardwerte:
// app.js ruft vor jedem Match standard() auf und nur beim Testen aus dem Labor setze(…).

export const GRUPPEN = {
  tempo: { name: 'Tempo', text: 'Wie schnell das ganze Spiel ist.' },
  ball: { name: 'Ball', text: 'Wie der Ball fliegt und abspringt.' },
  schlag: { name: 'Fehler', text: 'Wie genau alle Spieler treffen – du und der Computer.' },
  beine: { name: 'Beine', text: 'Wie die Spieler laufen – du und der Computer.' },
  gegner: { name: 'Gegner und Hilfen', text: 'Diese Regler machen eine Schwierigkeitsstufe aus. Sie fangen bei der Stufe an, die du oben gewählt hast.' },
  uhr: { name: 'Schwingen (Uhr, Handy, Controller)', text: 'Hilfen, die nur beim Schwingen gelten.' },
  profi: { name: 'Für Tüftler', text: 'Ball und Beine einzeln verstellen. Vorsicht: Schneller Ball mit langsamen Beinen macht die Ballwechsel sehr kurz.' },
};

// art: 'mal' = Mal-Wert (wird als Prozent gezeigt) · 'zahl' = echte Zahl mit Einheit · 'schalter' = an oder aus
// stufe: true = gehört zur Schwierigkeitsstufe (der Standard kommt aus DIFFICULTY in data.js, nicht von hier)
export const REGLER = [
  // --- Tempo ---
  { id: 'tempo', gruppe: 'tempo', name: 'Tempo von Ball und Beinen', art: 'mal', min: 0.7, max: 1.4, schritt: 0.05, std: 1,
    text: 'Macht Schläge, Aufschläge und das Laufen zusammen schneller oder langsamer. So bleiben die Ballwechsel etwa gleich lang.' },
  { id: 'aufschlag', gruppe: 'tempo', name: 'Aufschlag-Tempo', art: 'mal', min: 0.6, max: 1.3, schritt: 0.05, std: 1,
    text: 'Nur der Aufschlag. Kleiner = man kann leichter zurückschlagen, größer = mehr Asse.' },

  // --- Ball ---
  { id: 'drall', gruppe: 'ball', name: 'Wirkung des Dralls in der Luft', art: 'mal', min: 0, max: 2, schritt: 0.1, std: 1,
    text: 'Wie stark Topspin den Ball herunterdrückt, Slice ihn schweben lässt und Seitendrall ihn zur Kurve biegt. 0 = der Drall wirkt in der Luft gar nicht.' },
  { id: 'absprung', gruppe: 'ball', name: 'Absprung-Höhe', art: 'mal', min: 0.8, max: 1.25, schritt: 0.05, std: 1,
    text: 'Wie hoch der Ball vom Boden zurückspringt. Größer = der Ball kommt höher und bleibt länger in der Luft – man hat mehr Zeit.' },
  { id: 'griff', gruppe: 'ball', name: 'Boden bremst den Ball', art: 'mal', min: 0.5, max: 1.5, schritt: 0.05, std: 1,
    text: 'Wie stark der Boden „greift“. Größer = der Ball wird beim Aufprall langsamer, Kick und Stoppball wirken stärker (wie auf Sand). Kleiner = er rutscht schnell durch (wie auf Rasen).' },

  // --- Fehler ---
  { id: 'streu', gruppe: 'schlag', name: 'Streuung der Schläge', art: 'mal', min: 0.3, max: 2, schritt: 0.1, std: 1,
    text: 'Wie weit ein Schlag neben dem Ziel landet. Kleiner = alle treffen genauer, die Ballwechsel werden länger.' },
  { id: 'netzfehler', gruppe: 'schlag', name: 'Bälle ins Netz', art: 'mal', min: 0, max: 2, schritt: 0.1, std: 1,
    text: 'Wie oft ein Ball im Netz hängen bleibt. 0 = nie.' },

  // --- Beine ---
  { id: 'reichweite', gruppe: 'beine', name: 'Reichweite des Schlägers', art: 'zahl', einheit: 'm', min: 1.0, max: 2.2, schritt: 0.1, std: 1.4,
    text: 'So nah muss ein Spieler am Ball sein, um ihn zu treffen. Größer = man erreicht mehr Bälle.' },
  { id: 'muede', gruppe: 'beine', name: 'Müde werden', art: 'mal', min: 0, max: 3, schritt: 0.25, std: 1,
    text: 'Wie viel langsamer und ungenauer ein Spieler wird, wenn er viel gerannt ist. 0 = niemand wird müde.' },

  // --- Gegner und Hilfen (das ist die Schwierigkeitsstufe) ---
  { id: 'aiStat', gruppe: 'gegner', stufe: true, name: 'Stärke des Gegners', art: 'mal', min: 0.6, max: 1.05, schritt: 0.01,
    text: 'So viel von seinen echten Fähigkeiten zeigt der Computer. 100 % = er spielt so gut, wie er wirklich ist.' },
  { id: 'aiSigma', gruppe: 'gegner', stufe: true, name: 'Gegner streut', art: 'mal', min: 0.6, max: 1.8, schritt: 0.05,
    text: 'Größer = der Computer macht mehr Fehler.' },
  { id: 'aiAngriff', gruppe: 'gegner', stufe: true, name: 'Gegner greift an', art: 'mal', min: 0, max: 1, schritt: 0.05,
    text: 'Wie oft der Computer einen langsamen Ball in die Mitte hart in die freie Ecke schlägt. 0 % = nie.' },
  { id: 'aiReact', gruppe: 'gegner', stufe: true, name: 'Gegner reagiert nach', art: 'zahl', einheit: 's', min: 0.1, max: 0.6, schritt: 0.01,
    text: 'So lange braucht der Computer, bis er nach deinem Schlag losläuft. Größer = du schlägst mehr Winner.' },
  { id: 'meReact', gruppe: 'gegner', stufe: true, name: 'Deine Figur läuft los nach', art: 'zahl', einheit: 's', min: 0, max: 0.4, schritt: 0.01,
    text: 'Gilt mit Laufhilfe: So lange wartet deine Figur, bis sie von allein zum Ball läuft. Kleiner = leichter.' },
  { id: 'meSigma', gruppe: 'gegner', stufe: true, name: 'Du streust', art: 'mal', min: 0, max: 1.5, schritt: 0.05,
    text: 'Wie weit deine Schläge neben dem Ziel landen. 0 % = der Ball landet genau dort, wohin du zielst.' },
  { id: 'meNet', gruppe: 'gegner', stufe: true, name: 'Deine Bälle ins Netz', art: 'mal', min: 0, max: 1.5, schritt: 0.05,
    text: 'Wie oft dein Ball im Netz hängen bleibt. 0 % = nie.' },
  { id: 'clampIn', gruppe: 'gegner', stufe: true, name: 'Dein Ball bleibt seitlich im Feld', art: 'schalter',
    text: 'An = dein Ziel wird immer ein Stück ins Feld geschoben. Du schlägst dann selten seitlich ins Aus.' },
  { id: 'autoReturn', gruppe: 'gegner', stufe: true, name: 'Hilfs-Schlag', art: 'schalter',
    text: 'An = schlägst du gar nicht, spielt deine Figur einen schwachen Ball in die Mitte (und er geht nie hinten ins Aus).' },
  { id: 'marker', gruppe: 'gegner', stufe: true, name: 'Landepunkt anzeigen', art: 'schalter',
    text: 'An = ein Kreis zeigt, wo der Ball des Gegners aufkommen wird.' },

  // --- Schwingen ---
  { id: 'uhrUeberrascht', gruppe: 'uhr', name: 'Gegner ist vom Schwung überrascht', art: 'mal', min: 1, max: 3, schritt: 0.1, std: 1.8,
    text: 'So viel später läuft der Computer nach einem geschwungenen Schlag los. 100 % = keine Hilfe, größer = mehr Winner für dich.' },
  { id: 'uhrGenau', gruppe: 'uhr', name: 'Streuung beim Schwingen', art: 'mal', min: 0.3, max: 1.2, schritt: 0.05, std: 0.7,
    text: 'Geschwungene Schläge streuen nur so viel wie sonst. 100 % = keine Hilfe.' },
  { id: 'uhrSpaet', gruppe: 'uhr', name: 'Zu spät geschwungen – gilt noch', art: 'zahl', einheit: 's', min: 0.1, max: 0.6, schritt: 0.05, std: 0.35,
    text: 'So lange nach dem besten Moment darf man noch schwingen. Größer = man trifft öfter.' },
  { id: 'uhrFrueh', gruppe: 'uhr', name: 'Zu früh geschwungen – gilt noch', art: 'zahl', einheit: 's', min: 0.5, max: 2.5, schritt: 0.1, std: 1.6,
    text: 'So lange „wartet“ ein Schwung auf den Ball. Größer = man trifft auch, wenn man viel zu früh schwingt.' },
  { id: 'uhrReich', gruppe: 'uhr', name: 'Schläger reicht weiter', art: 'zahl', einheit: 'm', min: 0, max: 0.8, schritt: 0.05, std: 0.3,
    text: 'Beim Schwingen kann man nicht fein hinlaufen. Deshalb reicht der Schläger um so viel weiter.' },

  // --- Für Tüftler ---
  { id: 'ballExtra', gruppe: 'profi', name: 'Nur der Ball', art: 'mal', min: 0.7, max: 1.4, schritt: 0.05, std: 1,
    text: 'Tempo der Schläge und Aufschläge, zusätzlich zum Regler „Tempo von Ball und Beinen“.' },
  { id: 'beinExtra', gruppe: 'profi', name: 'Nur die Beine', art: 'mal', min: 0.7, max: 1.4, schritt: 0.05, std: 1,
    text: 'Lauftempo, zusätzlich zum Regler „Tempo von Ball und Beinen“.' },
  { id: 'antritt', gruppe: 'profi', name: 'Antritt', art: 'mal', min: 0.5, max: 2, schritt: 0.1, std: 1,
    text: 'Wie schnell ein Spieler aus dem Stand auf Tempo kommt.' },
];

const NACH_ID = Object.fromEntries(REGLER.map((r) => [r.id, r]));
export const regler = (id) => NACH_ID[id];

// Die Werte, die gerade gelten. (Die Stufen-Regler stehen nicht hier, sie stecken in der Schwierigkeitsstufe des Matches.)
export const R = {};

// Alles zurück auf Standard
export function standard() {
  for (const r of REGLER) if (!r.stufe) R[r.id] = r.std;
  return R;
}
standard();

// Bringt einen Wert in die erlaubten Grenzen. Unsinn (kein Regler, keine Zahl) ergibt null.
export function pruefe(id, wert) {
  const r = NACH_ID[id];
  if (!r) return null;
  if (r.art === 'schalter') return !!wert;
  const z = Number(wert);
  if (!Number.isFinite(z)) return null;
  // auf den Schritt runden, damit keine Zahlen wie 1.1500000000000001 entstehen
  const rund = Math.round(z / r.schritt) * r.schritt;
  return Math.round(Math.max(r.min, Math.min(r.max, rund)) * 1000) / 1000;
}

// Setzt die Werte für das nächste Match: erst alles auf Standard, dann die eigenen Werte darüber.
// werte = { tempo: 1.1, drall: 0.8, … } – was fehlt, bleibt Standard.
export function setze(werte) {
  standard();
  for (const id in werte || {}) {
    const r = NACH_ID[id];
    if (!r || r.stufe) continue;
    const w = pruefe(id, werte[id]);
    if (w !== null) R[id] = w;
  }
  return R;
}

// Baut aus einer Schwierigkeitsstufe (ein Eintrag aus DIFFICULTY) und eigenen Werten die Stufe für das Match.
export function stufeAus(basis, werte) {
  const s = { ...basis };
  for (const r of REGLER) {
    if (!r.stufe || !werte || !(r.id in werte)) continue;
    const w = pruefe(r.id, werte[r.id]);
    if (w !== null) s[r.id] = w;
  }
  return s;
}

// Der Standard eines Reglers. Bei Stufen-Reglern kommt er aus der gewählten Stufe.
export const standardVon = (r, basis) => (r.stufe ? basis[r.id] : r.std);

// Nur die Werte, die vom Standard abweichen (zum Speichern und Anzeigen)
export function geaendert(werte, basis) {
  const out = {};
  for (const r of REGLER) {
    if (!werte || !(r.id in werte)) continue;
    const w = pruefe(r.id, werte[r.id]);
    if (w !== null && w !== standardVon(r, basis)) out[r.id] = w;
  }
  return out;
}

// So steht ein Wert auf dem Bildschirm: „115 %“, „1,4 m“, „0,27 s“, „An“
export function zeige(r, w) {
  if (r.art === 'schalter') return w ? 'An' : 'Aus';
  if (r.art === 'mal') return Math.round(w * 100) + ' %';
  return String(Math.round(w * 100) / 100).replace('.', ',') + ' ' + (r.einheit || '');
}

// --- Kleine Helfer für Ballphysik und Match ---
export const ballMal = () => R.tempo * R.ballExtra;      // so viel schneller sind die Schläge
export const beinMal = () => R.tempo * R.beinExtra;      // so viel schneller sind die Beine
