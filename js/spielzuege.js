// Powershot – taktische Spielzüge für das Einzel.
// Ein Spielzug ist ein Plan aus zwei oder drei Schlägen hintereinander, z. B.
// "Aufschlag nach außen – und den nächsten Ball in die leere Ecke".
// Wer so einen Plan richtig durchzieht, setzt den Gegner unter Druck: Der reagiert später und schlägt ungenauer.
//
// Diese Datei kennt keine Grafik und keine andere Datei. Man kann sie mit "node tools/spielzuege.mjs" prüfen.
//
// Alles wird aus der Sicht des Spielers beschrieben, der gerade schlägt:
//   u = seitlich in Metern (+ = rechts von ihm, − = links), d = wie weit hinter dem Netz der Ball landet (Meter)
// Die Spielzüge stammen aus Tennis-Lehrbüchern und von Trainern (Quellen: siehe CLAUDE.md).
// Alle Zahlen (Zielfelder, Stärke) sind geschätzt – du kannst sie ändern und ausprobieren!

const W = 4.115;       // halbe Breite des Einzelfelds
const L = 11.885;      // Netz bis Grundlinie
const vz = (v) => (v >= 0 ? 1 : -1);

// So stark wirkt ein fertiger Spielzug auf den Gegner (bei Stärke 1):
export const ZUG_REAKTION = 0.6;   // er reagiert so viel später (0.6 = 60 % später)
export const ZUG_STREUT = 0.5;     // sein nächster Schlag wird so viel ungenauer
export const ZUG_SCHWACH = 0.15;   // … und so viel langsamer
export const ZUG_SICHER = 0.25;    // du selbst triffst für den Rest des Punkts so viel genauer (Selbstvertrauen)
const ABSTAND = 2.5;               // "offenes Feld": so weit (Meter) muss der Ball neben dem Gegner landen
const TEIL = 0.35;                 // ein angefangener Spielzug wirkt schon ein bisschen (Anteil vom vollen Druck)
const GEMERKT = 6;                 // der Gegner merkt sich deine letzten 6 Spielzüge
const LERNEN_OFT = 3;              // so oft musst du einen Spielzug im Training schaffen, dann ist er gelernt
export const STUFEN = [
  { name: 'neu', stern: '', mal: 0 },
  { name: 'gelernt', stern: '★', mal: 1, abMatch: 0 },
  { name: 'sicher', stern: '★★', mal: 1.15, abMatch: 8 },      // 8-mal im Match geschafft
  { name: 'Meister', stern: '★★★', mal: 1.3, abMatch: 20 },    // 20-mal im Match geschafft
];

// Die Zielfelder: u = [von, bis] seitlich (immer auf der Seite, um die es geht), d = [von, bis] Tiefe
const BEREICH = {
  aussen:   { u: [2.5, W], d: [0, 6.4] },      // Aufschlag weit nach außen
  t:        { u: [0, 1.5], d: [0, 6.4] },      // Aufschlag durch die Mitte (auf das "T")
  egal:     { u: [0, W], d: [0.9, L] },        // irgendwo ins Feld
  offen:    { u: [0.6, W], d: [3.5, L] },      // dorthin, wo der Gegner nicht steht
  cross:    { u: [1.0, W], d: [5.5, L] },      // schräg über den Platz
  longline: { u: [1.6, W], d: [5.5, L] },      // gerade die Linie entlang
  ecke:     { u: [2.3, W], d: [7, L] },        // in eine der beiden Ecken
  gleiche:  { u: [2.3, W], d: [7, L] },        // auf dieselbe Seite wie dein Schlag davor
  andere:   { u: [2.3, W], d: [7, L] },        // auf die andere Seite als dein Schlag davor
  mitte:    { u: [0, 1.8], d: [7.5, L] },      // tief durch die Mitte
};

const SCHLAG_NAMEN = { drive: 'Topspin', flach: 'Gerader Schuss', topspin: 'Hoher Topspin', slice: 'Slice', drop: 'Stoppball', lob: 'Lob' };

// Die Gruppen im Spielzug-Buch
export const GRUPPEN = { aufschlag: 'Mit dem Aufschlag', return: 'Beim Return', ballwechsel: 'Im Ballwechsel', netz: 'Netz und Gefühl' };

// Ein Schritt:  text   = was zu tun ist
//               wer    = 'aufschlag' (sonst: ein normaler Schlag)
//               seite  = eins der Zielfelder oben · u / d = eigene Grenzen statt der vom Zielfeld
//               art    = nur diese Schlagarten zählen
//               extra  = 'volley' (aus der Luft am Netz), 'umlaufen' (Vorhand aus der Rückhand-Ecke), 'gegnerVorn' (Gegner steht am Netz),
//                        'gegnerWeg' (der Gegner ist schon aus dieser Ecke herausgelaufen)
//               dannNetz = nach diesem Schlag läufst du ans Netz
// Ein Spielzug:  start = womit er anfängt ('aufschlag', 'return' oder 'ballwechsel' = jederzeit)
//                staerke = wie viel Druck er macht (0 bis 1) · ab = so viele Spielzüge musst du schon gelernt haben
//                stil = welche Fähigkeit dazu passt (danach suchen sich die Computergegner ihre Lieblings-Spielzüge aus)
export const ZUEGE = {
  aufschlag_plus1: {
    name: 'Aufschlag + 1', gruppe: 'aufschlag', start: 'aufschlag', staerke: 0.7, ab: 0, stil: 's',
    kurz: 'Aufschlag nach außen, dann in die leere Ecke.',
    warum: 'Der Aufschlag zieht den Gegner aus dem Feld. Die andere Seite ist dann leer – dorthin kommt dein nächster Schlag. Die Profis gewinnen so die meisten ihrer Punkte: Sieben von zehn Ballwechseln sind nach höchstens vier Schlägen vorbei.',
    schritte: [
      { wer: 'aufschlag', seite: 'aussen', text: 'Aufschlag weit nach außen' },
      { seite: 'offen', text: 'Den nächsten Ball ins offene Feld' },
    ],
  },
  t_ecke: {
    name: 'T-Aufschlag und Ecke', gruppe: 'aufschlag', start: 'aufschlag', staerke: 0.7, ab: 1, stil: 's',
    kurz: 'Aufschlag durch die Mitte, dann tief in eine Ecke.',
    warum: 'Von der Mitte aus hat der Gegner keinen Winkel. Sein Return kommt meistens zu dir in die Mitte zurück – und du darfst dir die Ecke aussuchen.',
    schritte: [
      { wer: 'aufschlag', seite: 't', text: 'Aufschlag durch die Mitte (auf das T)' },
      { seite: 'ecke', d: [7.5, L], text: 'Tief in eine Ecke' },
    ],
  },
  aufschlag_volley: {
    name: 'Aufschlag und Volley', gruppe: 'aufschlag', start: 'aufschlag', staerke: 0.9, ab: 4, stil: 'v',
    kurz: 'Aufschlagen, sofort ans Netz, Volley in die leere Seite.',
    warum: 'Am Netz nimmst du dem Gegner die Zeit weg. Er muss sofort einen sehr genauen Schlag an dir vorbei spielen – das geht oft schief.',
    schritte: [
      { wer: 'aufschlag', seite: 'egal', dannNetz: true, text: 'Aufschlag ins Feld – und sofort ans Netz laufen' },
      { seite: 'offen', extra: 'volley', text: 'Volley ins offene Feld' },
    ],
  },
  return_mitte: {
    name: 'Tiefer Return durch die Mitte', gruppe: 'return', start: 'return', staerke: 0.6, ab: 1, stil: 'rh',
    kurz: 'Return tief in die Mitte, dann in eine Ecke.',
    warum: 'Ein tiefer Return vor die Füße des Aufschlägers macht dessen „Aufschlag + 1“ kaputt. Er hat keinen Winkel und muss zurückweichen. Danach greifst du an.',
    schritte: [
      { seite: 'mitte', text: 'Return tief durch die Mitte' },
      { seite: 'ecke', text: 'Jetzt in eine Ecke' },
    ],
  },
  chip_charge: {
    name: 'Chip & Charge', gruppe: 'return', start: 'return', staerke: 0.9, ab: 8, stil: 'v',
    kurz: 'Return als tiefer Slice, ans Netz, Volley.',
    warum: 'Der Slice bleibt flach. Der Gegner muss den Ball von unten hochheben – und du stehst schon am Netz und wartest darauf.',
    schritte: [
      { art: ['slice'], seite: 'egal', d: [7, L], dannNetz: true, text: 'Return als tiefer Slice – und ans Netz laufen' },
      { seite: 'egal', extra: 'volley', text: 'Volley ins Feld' },
    ],
  },
  cross_cross_line: {
    name: 'Zweimal cross, dann die Linie', gruppe: 'ballwechsel', start: 'ballwechsel', staerke: 0.8, ab: 0, stil: 'rh',
    kurz: 'Zwei Bälle schräg, der dritte gerade die Linie entlang.',
    warum: 'Schräg (cross) ist der sichere Schlag: Das Netz ist in der Mitte niedriger und der Weg ist länger. Der Gegner gewöhnt sich daran – und der plötzliche Wechsel die Linie entlang erwischt ihn auf dem falschen Fuß.',
    schritte: [
      { seite: 'cross', text: 'Schräg über den Platz (cross)' },
      { seite: 'cross', text: 'Noch einmal cross' },
      { seite: 'longline', text: 'Jetzt gerade die Linie entlang!' },
    ],
  },
  scheibenwischer: {
    name: 'Scheibenwischer', gruppe: 'ballwechsel', start: 'ballwechsel', staerke: 0.8, ab: 0, stil: 'vh',
    kurz: 'Links, rechts, links – der Gegner muss rennen.',
    warum: 'Wer von Ecke zu Ecke rennt, wird müde und kommt immer später an den Ball. Irgendwann schlägt er zu kurz oder ins Aus.',
    schritte: [
      { seite: 'ecke', text: 'In eine Ecke' },
      { seite: 'andere', text: 'In die andere Ecke' },
      { seite: 'andere', text: 'Und wieder in die andere Ecke' },
    ],
  },
  kurz_cross: {
    name: 'Kurzer Winkel', gruppe: 'ballwechsel', start: 'ballwechsel', staerke: 0.8, ab: 2, stil: 'vh',
    kurz: 'Erst tief cross, dann kurz und ganz schräg.',
    warum: 'Der tiefe Ball drängt den Gegner nach hinten. Der kurze, schräge Ball danach zieht ihn weit zur Seite aus dem Feld – der ganze Platz ist offen.',
    schritte: [
      { seite: 'cross', d: [7.5, L], text: 'Tief und schräg (cross)' },
      { seite: 'cross', u: [2.2, W], d: [2, 8], text: 'Kurz und ganz schräg nach außen' },
    ],
  },
  gegen_lauf: {
    name: 'Gegen die Laufrichtung', gruppe: 'ballwechsel', start: 'ballwechsel', staerke: 0.9, ab: 2, stil: 'k',
    kurz: 'Ecke, andere Ecke – und noch einmal dieselbe Ecke.',
    warum: 'Nach zwei Bällen von Seite zu Seite rennt der Gegner schon los zur anderen Ecke. Spielst du noch einmal hinter ihn, muss er bremsen und umdrehen. Das kostet viel Zeit.',
    schritte: [
      { seite: 'ecke', text: 'In eine Ecke' },
      { seite: 'andere', text: 'In die andere Ecke' },
      { seite: 'gleiche', extra: 'gegnerWeg', text: 'Noch einmal in dieselbe Ecke – hinter den Gegner!' },
    ],
  },
  inside_out: {
    name: 'Inside-out-Vorhand', gruppe: 'ballwechsel', start: 'ballwechsel', staerke: 0.9, ab: 8, stil: 'vh', nurMensch: true,
    kurz: 'Die Rückhand umlaufen, Vorhand schräg – dann ins offene Feld.',
    warum: 'Die Vorhand ist bei den meisten der stärkere Schlag. Wer um die Rückhand herumläuft, kann mit seiner Waffe auf die schwächere Seite des Gegners spielen.',
    schritte: [
      { seite: 'cross', u: [1.5, W], extra: 'umlaufen', text: 'Lauf um den Ball herum: Vorhand aus der Rückhand-Ecke, schräg' },
      { seite: 'offen', text: 'Den nächsten Ball ins offene Feld' },
    ],
  },
  angriff_volley: {
    name: 'Angriffsball und Volley', gruppe: 'netz', start: 'ballwechsel', staerke: 0.9, ab: 4, stil: 'v',
    kurz: 'Tief die Linie entlang, ans Netz, Volley in die leere Seite.',
    warum: 'Greifst du die Linie entlang an, stehst du am Netz genau richtig: Du deckst die Linie ab und der Gegner hat nur noch den schweren, schrägen Schlag an dir vorbei.',
    schritte: [
      { seite: 'longline', d: [8, L], dannNetz: true, text: 'Tief die Linie entlang – und ans Netz laufen' },
      { seite: 'offen', extra: 'volley', text: 'Volley ins offene Feld' },
    ],
  },
  stopp_lob: {
    name: 'Stoppball und Lob', gruppe: 'netz', start: 'ballwechsel', staerke: 1.0, ab: 6, stil: 'k',
    kurz: 'Stoppball lockt den Gegner vor, der Lob fliegt über ihn drüber.',
    warum: 'Der Stoppball zwingt den Gegner zu einem Sprint nach vorne. Dort steht er dann dicht am Netz – und über seinem Kopf ist alles frei.',
    schritte: [
      { art: ['drop'], seite: 'egal', d: [0.9, 5.5], text: 'Stoppball kurz hinter das Netz' },
      { art: ['lob'], seite: 'egal', d: [7, L], extra: 'gegnerVorn', text: 'Lob über den Gegner' },
    ],
  },
  stopp_pass: {
    name: 'Stoppball und vorbei', gruppe: 'netz', start: 'ballwechsel', staerke: 0.9, ab: 6, stil: 'k',
    kurz: 'Stoppball lockt den Gegner vor, dann schnell an ihm vorbei.',
    warum: 'Wer einen Stoppball gerade so erläuft, steht schlecht am Netz. Ein schneller Ball weit neben ihm ist dann nicht mehr zu erreichen.',
    schritte: [
      { art: ['drop'], seite: 'egal', d: [0.9, 5.5], text: 'Stoppball kurz hinter das Netz' },
      { art: ['drive', 'flach', 'topspin'], seite: 'offen', abstand: 2.2, d: [4, L], extra: 'gegnerVorn', text: 'Schnell am Gegner vorbei' },
    ],
  },
};
export const ZUG_IDS = Object.keys(ZUEGE);

// ---------------------------------------------------------------
// Zielfeld und Prüfung
// ---------------------------------------------------------------

// Auf welcher Seite liegt das Zielfeld dieses Schritts? +1 = rechts, −1 = links, 0 = beide Seiten gehen
//   lage: { vonU, gegnerU, feld (Seite des Aufschlagfelds), landU (wenn schon geschlagen) } · davor: Seite des eigenen Schlags davor
function seiteVon(step, lage, davor) {
  const frei = lage.landU != null ? vz(lage.landU) : (Math.abs(lage.gegnerU) > 0.3 ? -vz(lage.gegnerU) : 0);
  switch (step.seite) {
    case 'aussen': case 't': return lage.feld || 1;
    case 'cross': return -vz(lage.vonU);
    case 'longline': return vz(lage.vonU);
    case 'offen': return Math.abs(lage.gegnerU) > 0.5 ? -vz(lage.gegnerU) : frei;
    case 'gleiche': return davor || frei;
    case 'andere': return davor ? -davor : frei;
    case 'ecke': return frei;
    default: return 0;
  }
}

// Das Zielfeld eines Schritts aus Sicht des Schlägers: { u0, u1, d0, d1 } (u0 < u1)
export function zielfeld(step, lage, davor = 0) {
  const B = BEREICH[step.seite] || BEREICH.egal;
  let u = step.u || B.u;
  const d = step.d || B.d;
  let s = seiteVon(step, lage, davor);
  if (step.seite === 'mitte' || step.seite === 'egal') return { u0: step.seite === 'mitte' ? -u[1] : -W, u1: step.seite === 'mitte' ? u[1] : W, d0: d[0], d1: d[1] };
  // beide = true: Es gehen beide Seiten (z. B. "in eine Ecke", wenn der Gegner genau in der Mitte steht)
  const beide = !s;
  if (!s) s = 1;
  // "Offenes Feld": Das Zielfeld fängt erst ein Stück neben dem Gegner an (abstand) – je weiter er außen steht, desto größer ist es.
  if (step.seite === 'offen') u = [Math.min(W - 1, Math.max(u[0], s * lage.gegnerU + (step.abstand || ABSTAND))), u[1]];
  return { u0: Math.min(s * u[0], s * u[1]), u1: Math.max(s * u[0], s * u[1]), d0: d[0], d1: d[1], beide };
}

// Passt der Schlag m zu diesem Schritt? Gibt null zurück (passt) oder einen Satz, was nicht gestimmt hat.
//   m: { aufschlag, ret, typ, hand ('fh'/'bh'), vonU, landU, landD, drin, gegnerU, gegnerD, feld, haendig (1 = Rechtshänder) }
export function pruefe(step, m, davor = 0) {
  if ((step.wer === 'aufschlag') !== !!m.aufschlag) return step.wer === 'aufschlag' ? 'Hier ist der Aufschlag dran' : 'Das war ein Aufschlag';
  if (!m.drin) return 'Der Ball war nicht im Feld';
  if (step.extra === 'volley' && m.typ !== 'volley' && m.typ !== 'smash') return 'Du musst den Ball am Netz aus der Luft nehmen (Volley)';
  if (step.art && !step.art.includes(m.typ)) return 'Falsche Schlagart – hier brauchst du: ' + step.art.map((a) => SCHLAG_NAMEN[a] || a).join(' oder ');
  if (step.extra === 'umlaufen' && !(m.hand === 'fh' && m.vonU * m.haendig < 0.3)) return 'Das muss eine Vorhand aus deiner Rückhand-Ecke sein';
  if (step.extra === 'gegnerVorn' && m.gegnerD > 7.5) return 'Der Gegner stand nicht vorne am Netz';
  const z = zielfeld(step, m, davor);
  if (m.landU < z.u0 - 0.05 || m.landU > z.u1 + 0.05) {
    if (step.seite === 't') return 'Der Aufschlag war nicht nah genug an der Mitte';
    if (step.seite === 'mitte') return 'Der Ball war nicht in der Mitte';
    const richtig = vz(m.landU) === vz(z.u0 + z.u1);
    if (richtig && step.seite === 'offen') return 'Der Ball war zu nah am Gegner';
    return richtig ? 'Der Ball war nicht weit genug außen' : 'Der Ball ging auf die falsche Seite';
  }
  if (m.landD < z.d0 - 0.05) return 'Der Ball war zu kurz';
  if (m.landD > z.d1 + 0.05) return 'Der Ball war zu lang – er sollte kürzer sein';
  if (step.extra === 'gegnerWeg' && m.gegnerU * vz(m.landU) > 1.5) return 'Der Gegner stand noch in dieser Ecke – warte, bis er losläuft';
  return null;
}

// Fängt dieser Schlag einen Spielzug an?
const startPasst = (zug, m) => (zug.start === 'aufschlag' ? !!m.aufschlag : zug.start === 'return' ? !!m.ret : !m.aufschlag);

// ---------------------------------------------------------------
// Der Zähler: schaut einem Spieler bei jedem Schlag zu und merkt, welche Spielzüge gerade laufen
// ---------------------------------------------------------------
export class ZugZaehler {
  // o: { erlaubt: { id: Stufe 1 bis 3 }  – nur diese Spielzüge zählen
  //      klug: 0 bis 1                   – Taktik des Gegners: Ein kluger Gegner durchschaut Wiederholungen schneller
  //      lernen: true                    – Training: merkt sich, warum ein Schritt nicht geklappt hat
  //      ohneStrafe: true                – für den Computer: Wiederholungen schaden ihm nicht }
  constructor(o = {}) {
    this.erlaubt = o.erlaubt || {};
    this.klug = o.klug ?? 0.5;
    this.lernen = !!o.lernen;
    this.ohneStrafe = !!o.ohneStrafe;   // true: Ein durchschauter Spielzug bringt nichts mehr, schadet aber auch nicht
    this.verlauf = [];          // die letzten fertigen Spielzüge in diesem Match (für "durchschaut")
    this.neuerPunkt();
  }

  neuerPunkt() {
    this.lauf = [];             // angefangene Spielzüge: { id, i } – i = so viele Schritte sind schon geschafft
    this.davor = 0;             // Seite des eigenen Schlags davor (+1 rechts, −1 links)
    this.fehler = null;         // Training: { schritt, grund }
    this.geschafft = false;     // in diesem Punkt ist schon ein Spielzug fertig geworden (mehr als einer pro Punkt zählt nicht)
    this.vorbei = false;        // Training: Dieser Versuch kann in diesem Punkt nicht mehr klappen
  }

  // Wie weit ist dieser Spielzug gerade? (0 = noch nicht angefangen)
  stand(id) { const c = this.lauf.find((x) => x.id === id); return c ? c.i : 0; }

  // Wie viel wirkt der Spielzug noch? 1 = volle Wirkung, 0 = der Gegner kennt ihn in- und auswendig
  wirkung(id) {
    const oft = this.verlauf.filter((x) => x === id).length;
    return Math.max(0, 1 - oft * (0.2 + 0.2 * this.klug));
  }

  // Ein eigener Schlag. Gibt zurück:
  //   { druck: Druck auf den Gegner (−0.25 bis 1.3), fertig: null oder { id, zug, wirkung, durchschaut }, weiter: [ids], fehler }
  schlag(m) {
    if (m.aufschlag) { this.lauf = []; this.davor = 0; this.fehler = null; this.vorbei = false; }
    if (this.geschafft) { if (m.drin) this.davor = vz(m.landU); return { druck: 0, fertig: null, weiter: [], fehler: null }; }
    const weiter = [];
    let fertig = null, fehler = null;
    const ablegen = (id, i) => {
      const zug = ZUEGE[id];
      if (i >= zug.schritte.length) { if (!fertig || ZUEGE[fertig].staerke < zug.staerke) fertig = id; } else weiter.push({ id, i });
    };
    for (const c of this.lauf) {
      const grund = pruefe(ZUEGE[c.id].schritte[c.i], m, this.davor);
      if (!grund) ablegen(c.id, c.i + 1);
      else { fehler = { schritt: c.i, grund }; if (ZUEGE[c.id].start !== 'ballwechsel') this.vorbei = true; }
    }
    for (const id in this.erlaubt) {
      const zug = ZUEGE[id];
      if (!zug || !this.erlaubt[id] || weiter.some((x) => x.id === id) || fertig === id) continue;
      if (!startPasst(zug, m)) continue;
      const grund = pruefe(zug.schritte[0], m, this.davor);
      if (!grund) ablegen(id, 1);
      else if (!fehler) { fehler = { schritt: 0, grund }; if (zug.start !== 'ballwechsel') this.vorbei = true; }
    }
    this.lauf = weiter;
    if (m.drin) this.davor = vz(m.landU);
    this.fehler = this.lernen && !fertig && !weiter.length ? fehler : null;

    // Wie viel Druck macht das? Ein angefangener Spielzug ein bisschen, ein fertiger richtig viel.
    let druck = 0, info = null;
    for (const c of weiter) {
      const z = ZUEGE[c.id];
      druck = Math.max(druck, TEIL * z.staerke * (c.i / z.schritte.length) * this.wirkung(c.id));
    }
    if (fertig) {
      const z = ZUEGE[fertig], wirkung = this.wirkung(fertig);
      const mal = (STUFEN[this.erlaubt[fertig]] || STUFEN[1]).mal;
      const durchschaut = wirkung <= 0.25;
      druck = durchschaut ? (this.ohneStrafe ? 0 : -0.25) : z.staerke * mal * wirkung;      // durchschaut: Der Gegner ist sogar früher da
      info = { id: fertig, zug: z, wirkung, durchschaut };
      this.verlauf.push(fertig);
      if (this.verlauf.length > GEMERKT) this.verlauf.shift();
      this.lauf = [];
      this.geschafft = true;
    }
    return { druck, fertig: info, weiter: weiter.map((c) => c.id), fehler: this.fehler };
  }
}

// ---------------------------------------------------------------
// Lernen und Freischalten (der Spielstand ist ein einfaches Objekt: { id: { t: im Training geschafft, m: im Match geschafft } })
// ---------------------------------------------------------------
export function stufe(stand, id) {
  const e = (stand && stand[id]) || {};
  if ((e.t || 0) < LERNEN_OFT) return 0;
  return (e.m || 0) >= STUFEN[3].abMatch ? 3 : (e.m || 0) >= STUFEN[2].abMatch ? 2 : 1;
}
export const gelerntAnzahl = (stand) => ZUG_IDS.filter((id) => stufe(stand, id) > 0).length;
// Darf man diesen Spielzug schon üben? (Erst die einfachen lernen, dann kommen die schweren dazu.)
export const offen = (stand, id) => gelerntAnzahl(stand) >= ZUEGE[id].ab;
// Alle gelernten Spielzüge mit ihrer Stufe – das bekommt das Match
export function gelernte(stand) {
  const out = {};
  for (const id of ZUG_IDS) { const s = stufe(stand, id); if (s) out[id] = s; }
  return out;
}
// Einen Erfolg eintragen. wo: 't' = Training, 'm' = Match. Gibt zurück, ob dadurch eine neue Stufe erreicht wurde.
export function eintragen(stand, id, wo) {
  const vorher = stufe(stand, id);
  const e = stand[id] || (stand[id] = { t: 0, m: 0 });
  e[wo] = (e[wo] || 0) + 1;
  return stufe(stand, id) > vorher;
}
export const lernenOft = LERNEN_OFT;

// ---------------------------------------------------------------
// Computergegner: Lieblings-Spielzüge nach den Fähigkeiten (starker Aufschlag → Aufschlag + 1, guter Volley → ans Netz …)
// Das ist aus den Fähigkeitswerten berechnet, nicht bei echten Spielern nachgeschaut.
// ---------------------------------------------------------------
export function lieblingsZuege(werte, anzahl = 3) {
  const liste = ZUG_IDS.filter((id) => !ZUEGE[id].nurMensch)
    .map((id, n) => ({ id, w: (werte[ZUEGE[id].stil] || 60) + ZUEGE[id].staerke * 5 - n * 0.01 }))
    .sort((a, b) => b.w - a.w);
  // nicht drei Spielzüge derselben Art: höchstens zwei pro Fähigkeit
  const out = [], proStil = {};
  for (const e of liste) {
    const s = ZUEGE[e.id].stil;
    if ((proStil[s] || 0) >= 2) continue;
    proStil[s] = (proStil[s] || 0) + 1;
    out.push(e.id);
    if (out.length >= anzahl) break;
  }
  return out;
}

// Wohin soll der Computer bei diesem Schritt zielen? Mitte des Zielfelds, mit etwas Abstand zu den Linien.
export function zielPunkt(step, lage, davor = 0, rand = 1.0) {
  const z = zielfeld(step, lage, davor);
  const u = Math.max(-(W - rand), Math.min(W - rand, (z.u0 + z.u1) / 2 + (step.seite === 'egal' || step.seite === 'mitte' ? 0 : vz(z.u0 + z.u1) * 0.3)));
  const d = Math.min(L - 1.4, (z.d0 + z.d1) / 2);
  return { u, d, art: step.art ? step.art[0] : null };
}
