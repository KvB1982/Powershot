// Powershot – Posen und Schlagbewegungen der Spielerfigur.
//
// Eine Pose beschreibt den ganzen Körper mit wenigen Zahlen:
//   r  = wo die Schlaghand ist            [vor, seite, hoch] in Metern (seite: + = Schlaghand-Seite)
//   d  = wohin der Schläger zeigt         (Richtung vom Griff zum Schlägerkopf)
//   l  = wo die andere Hand ist           (oder 'g' = mit am Griff, 't' = am Schlägerhals)
//   tw = Drehung der Schultern            (+ = Schlagschulter vorn, − = Schlagschulter hinten), in Bogenmaß
//   cr = wie tief die Knie gebeugt sind   (Meter)
//   ln = Vorlage des Oberkörpers          (Meter)
//   st = Schrittstellung                  (+1 = anderer Fuß vorn, −1 = Schlaghand-Fuß vorn)
//   jp = Sprung                           (Meter über dem Boden)
//   h  = wie stark die Hand der Ballhöhe folgt (0…1)
//
// Eine Schlagbewegung ist eine Liste [Zeit, Pose]. Zeit 0 ist der Moment, in dem der Ball getroffen wird,
// negative Zeiten sind das Ausholen davor, positive das Durchschwingen danach.
// Ellbogen, Knie und der Rest werden in avatar.js ausgerechnet.

const P = {
  ready:      { r: [0.34, 0.10, 0.98], d: [0.35, -0.75, 0.55], l: 't', tw: 0, cr: 0.05 },

  // ---------------- Vorhand Topspin ----------------
  fh_turn:    { r: [0.12, 0.40, 1.22], d: [-0.15, 0.25, 1.0], l: 't', tw: -0.65, cr: 0.07, st: 0.5 },
  fh_back:    { r: [-0.34, 0.50, 1.22], d: [-0.70, 0.20, 0.68], l: [0.34, 0.30, 1.24], tw: -1.15, cr: 0.10, st: 1 },
  fh_drop:    { r: [-0.28, 0.56, 0.74], d: [-0.90, 0.30, -0.32], l: [0.30, 0.02, 1.16], tw: -0.65, cr: 0.15, st: 1, h: 0.5 },
  fh_hit:     { r: [0.42, 0.55, 0.95], d: [0.06, 0.98, 0.14], l: [0.12, -0.26, 1.14], tw: 0.25, cr: 0.09, ln: 0.04, st: 0.6, h: 1 },
  fh_ext:     { r: [0.62, 0.22, 1.28], d: [0.50, 0.30, 0.82], l: [0.12, -0.28, 1.16], tw: 0.65, cr: 0.05, ln: 0.06, st: 0.2, h: 0.8 },
  fh_follow:  { r: [0.24, -0.30, 1.50], d: [-0.55, -0.62, 0.36], l: [0.16, -0.24, 1.26], tw: 1.05, cr: 0.04, ln: 0.03, st: -0.5, h: 0.2 },
  fh_relax:   { r: [0.26, -0.22, 1.30], d: [-0.35, -0.75, 0.40], l: [0.20, -0.22, 1.18], tw: 0.7, cr: 0.05, st: -0.3 },

  // ---------------- Vorhand Slice (von oben nach unten durch den Ball) ----------------
  fhs_back:   { r: [-0.12, 0.46, 1.52], d: [-0.42, 0.22, 0.88], l: [0.30, 0.10, 1.20], tw: -0.9, cr: 0.08, st: 1 },
  fhs_hit:    { r: [0.40, 0.52, 0.95], d: [0.10, 0.94, 0.32], l: [0.10, -0.28, 1.10], tw: -0.1, cr: 0.12, ln: 0.05, st: 0.8, h: 1 },
  fhs_follow: { r: [0.58, 0.16, 0.78], d: [0.74, 0.30, 0.34], l: [-0.05, -0.34, 1.05], tw: 0.3, cr: 0.14, ln: 0.08, st: 0.6, h: 0.7 },

  // ---------------- Rückhand Topspin (beidhändig) ----------------
  bh_turn:    { r: [0.08, -0.16, 1.05], d: [-0.25, -0.50, 0.82], l: 'g', tw: 0.7, cr: 0.07, st: -0.5 },
  bh_back:    { r: [-0.16, -0.30, 1.02], d: [-0.78, -0.30, 0.52], l: 'g', tw: 1.2, cr: 0.10, st: -1 },
  bh_drop:    { r: [-0.14, -0.40, 0.74], d: [-0.85, -0.36, -0.36], l: 'g', tw: 0.9, cr: 0.15, st: -1, h: 0.5 },
  bh_hit:     { r: [0.40, -0.38, 0.95], d: [0.06, -0.98, 0.12], l: 'g', tw: 0.1, cr: 0.09, ln: 0.04, st: -0.7, h: 1 },
  bh_ext:     { r: [0.58, -0.10, 1.26], d: [0.50, -0.30, 0.82], l: 'g', tw: -0.4, cr: 0.05, ln: 0.06, st: -0.3, h: 0.8 },
  bh_follow:  { r: [0.20, 0.32, 1.50], d: [-0.50, 0.66, 0.42], l: 'g', tw: -0.9, cr: 0.04, st: 0.3, h: 0.2 },
  bh_relax:   { r: [0.24, 0.24, 1.30], d: [-0.30, 0.75, 0.45], l: 'g', tw: -0.6, cr: 0.05, st: 0.2 },

  // ---------------- Rückhand Slice (einhändig, der andere Arm geht nach hinten) ----------------
  bhs_back:   { r: [-0.06, -0.22, 1.48], d: [-0.30, -0.42, 0.86], l: 't', tw: 1.2, cr: 0.08, st: -1 },
  bhs_hit:    { r: [0.38, -0.40, 0.95], d: [0.14, -0.94, 0.30], l: [-0.22, -0.30, 1.02], tw: 0.95, cr: 0.13, ln: 0.05, st: -1, h: 1 },
  bhs_follow: { r: [0.52, 0.02, 0.86], d: [0.62, -0.52, 0.52], l: [-0.42, -0.28, 0.98], tw: 0.8, cr: 0.15, ln: 0.08, st: -1, h: 0.7 },

  // ---------------- Volley (kurze Bewegung, kaum Ausholen) ----------------
  fhv_back:   { r: [0.24, 0.44, 1.26], d: [-0.05, 0.50, 0.86], l: [0.30, -0.10, 1.15], tw: -0.35, cr: 0.10, st: 0.6 },
  fhv_hit:    { r: [0.50, 0.46, 1.05], d: [0.12, 0.72, 0.68], l: [0.16, -0.28, 1.10], tw: -0.05, cr: 0.12, ln: 0.08, st: 1, h: 1 },
  fhv_follow: { r: [0.60, 0.36, 0.95], d: [0.34, 0.72, 0.60], l: [0.10, -0.30, 1.08], tw: 0.1, cr: 0.13, ln: 0.10, st: 1, h: 0.9 },
  bhv_back:   { r: [0.22, -0.24, 1.26], d: [-0.05, -0.50, 0.86], l: 't', tw: 0.6, cr: 0.10, st: -0.6 },
  bhv_hit:    { r: [0.48, -0.36, 1.05], d: [0.12, -0.72, 0.68], l: [-0.05, -0.30, 1.10], tw: 0.5, cr: 0.12, ln: 0.08, st: -1, h: 1 },
  bhv_follow: { r: [0.58, -0.28, 0.95], d: [0.34, -0.72, 0.60], l: [-0.20, -0.30, 1.05], tw: 0.45, cr: 0.13, ln: 0.10, st: -1, h: 0.9 },

  // ---------------- Aufschlag ----------------
  sv_ready:   { r: [0.26, 0.10, 0.96], d: [0.78, -0.20, 0.58], l: [0.40, 0.02, 1.02], tw: -0.6, cr: 0.03, st: 1 },
  sv_down:    { r: [-0.06, 0.34, 0.72], d: [0.05, 0.28, -0.96], l: [0.42, -0.06, 1.25], tw: -0.9, cr: 0.06, st: 1 },
  sv_trophy:  { r: [-0.20, 0.36, 1.56], d: [-0.10, -0.12, 1.0], l: [0.28, -0.12, 2.06], tw: -1.25, cr: 0.20, ln: -0.04, st: 1 },
  sv_drop:    { r: [-0.18, 0.14, 1.52], d: [-0.25, 0.10, -0.96], l: [0.26, -0.20, 1.62], tw: -0.75, cr: 0.10, st: 1, jp: 0.03 },
  sv_hit:     { r: [0.20, 0.18, 2.20], d: [0.10, 0.02, 1.0], l: [0.16, -0.22, 1.20], tw: 0.25, cr: -0.02, ln: 0.06, st: 0.6, jp: 0.16 },
  sv_pron:    { r: [0.46, 0.14, 1.92], d: [0.78, 0.10, 0.48], l: [0.16, -0.24, 1.15], tw: 0.6, cr: 0.0, ln: 0.10, st: 0.2, jp: 0.12 },
  sv_follow:  { r: [0.42, -0.30, 0.82], d: [0.30, -0.60, -0.72], l: [0.12, -0.30, 1.05], tw: 1.05, cr: 0.12, ln: 0.14, st: -0.6, jp: 0.0 },
  sv_land:    { r: [0.36, -0.20, 0.90], d: [0.30, -0.75, 0.10], l: [0.20, -0.25, 1.05], tw: 0.6, cr: 0.12, ln: 0.08, st: -0.4 },

  // ---------------- Schmetterball ----------------
  sm_trophy:  { r: [-0.18, 0.36, 1.58], d: [-0.15, -0.10, 1.0], l: [0.26, -0.10, 2.02], tw: -1.1, cr: 0.10, st: 1 },
  sm_drop:    { r: [-0.16, 0.16, 1.54], d: [-0.25, 0.10, -0.96], l: [0.26, -0.18, 1.70], tw: -0.7, cr: 0.08, st: 1 },
  sm_hit:     { r: [0.24, 0.18, 2.16], d: [0.22, 0.02, 0.98], l: [0.16, -0.22, 1.20], tw: 0.3, cr: 0.0, ln: 0.06, st: 0.5, jp: 0.10 },
  sm_follow:  { r: [0.44, -0.24, 0.90], d: [0.40, -0.55, -0.70], l: [0.12, -0.30, 1.05], tw: 0.95, cr: 0.12, ln: 0.12, st: -0.3 },

  // ---------------- Stimmung nach dem Punkt ----------------
  cheer:      { r: [0.05, 0.30, 2.0], d: [0, 0.25, 1], l: [0.10, -0.30, 1.45], tw: 0, cr: 0.0 },
  sad:        { r: [0.10, 0.25, 0.75], d: [0.2, 0.1, -1], l: [0.05, -0.25, 0.80], tw: 0, cr: 0.09 },
};

// Schlagbewegungen: [Zeit in Sekunden, Pose]
const STROKES = {
  fh_ts: [[-0.22, 'fh_back'], [-0.10, 'fh_drop'], [0, 'fh_hit'], [0.07, 'fh_ext'], [0.20, 'fh_follow'], [0.40, 'fh_relax'], [0.68, 'ready']],
  fh_sl: [[-0.20, 'fhs_back'], [0, 'fhs_hit'], [0.14, 'fhs_follow'], [0.36, 'fhs_follow'], [0.64, 'ready']],
  bh_ts: [[-0.22, 'bh_back'], [-0.10, 'bh_drop'], [0, 'bh_hit'], [0.07, 'bh_ext'], [0.20, 'bh_follow'], [0.40, 'bh_relax'], [0.68, 'ready']],
  bh_sl: [[-0.20, 'bhs_back'], [0, 'bhs_hit'], [0.14, 'bhs_follow'], [0.38, 'bhs_follow'], [0.66, 'ready']],
  fh_vo: [[-0.10, 'fhv_back'], [0, 'fhv_hit'], [0.10, 'fhv_follow'], [0.22, 'fhv_follow'], [0.44, 'ready']],
  bh_vo: [[-0.10, 'bhv_back'], [0, 'bhv_hit'], [0.10, 'bhv_follow'], [0.22, 'bhv_follow'], [0.44, 'ready']],
  sv:    [[-0.12, 'sv_drop'], [0, 'sv_hit'], [0.08, 'sv_pron'], [0.26, 'sv_follow'], [0.48, 'sv_land'], [0.82, 'ready']],
  sm:    [[-0.12, 'sm_drop'], [0, 'sm_hit'], [0.08, 'sv_pron'], [0.24, 'sm_follow'], [0.60, 'ready']],
};

// Ausholen, solange der Ball noch unterwegs ist: [Fortschritt 0…1, Pose]
const PREPS = {
  fh_ts: [[0, 'ready'], [0.5, 'fh_turn'], [1, 'fh_back']],
  fh_sl: [[0, 'ready'], [0.5, 'fh_turn'], [1, 'fhs_back']],
  bh_ts: [[0, 'ready'], [0.5, 'bh_turn'], [1, 'bh_back']],
  bh_sl: [[0, 'ready'], [0.5, 'bh_turn'], [1, 'bhs_back']],
  fh_vo: [[0, 'ready'], [1, 'fhv_back']],
  bh_vo: [[0, 'ready'], [1, 'bhv_back']],
  sm:    [[0, 'ready'], [0.5, 'fh_turn'], [1, 'sm_trophy']],
  // Aufschlag: Ball und Schläger zusammen, Schläger pendelt nach unten, "Pokal-Pose", Schläger fällt hinter den Rücken
  sv:    [[0, 'sv_ready'], [0.30, 'sv_down'], [0.66, 'sv_trophy'], [0.90, 'sv_drop']],
};

export const strokeStart = (name) => STROKES[name][0][0];
export const strokeEnd = (name) => STROKES[name][STROKES[name].length - 1][0];

// Welche Bewegung passt? kind = 'fh' | 'bh' | 'sv', type = Art des Schlags aus dem Match
export function strokeName(kind, type) {
  if (kind === 'sv') return type === 'smash' ? 'sm' : 'sv';
  if (type === 'smash') return 'sm';
  if (type === 'volley') return kind + '_vo';
  if (type === 'slice' || type === 'drop') return kind + '_sl';
  return kind + '_ts';
}

// ---------------------------------------------------------------
const FIELDS = ['tw', 'cr', 'ln', 'st', 'jp', 'h'];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Pose vervollständigen: fehlende Zahlen = 0, 'g'/'t' für die zweite Hand ausrechnen
function full(name) {
  const p = P[name];
  if (p.done) return p;
  const d = norm(p.d);
  let l = p.l;
  if (l === 'g') l = [p.r[0] + d[0] * 0.11, p.r[1] + d[1] * 0.11, p.r[2] + d[2] * 0.11];
  if (l === 't') l = [p.r[0] + d[0] * 0.30, p.r[1] + d[1] * 0.30, p.r[2] + d[2] * 0.30];
  const out = { r: p.r, d, l, done: true, two: p.l === 'g' ? 1 : 0 };
  for (const f of FIELDS) out[f] = p[f] || 0;
  P[name] = out;
  return out;
}

export const pose = (name) => full(name);

export function mixPose(a, b, s) {
  const m3 = (x, y) => [x[0] + (y[0] - x[0]) * s, x[1] + (y[1] - x[1]) * s, x[2] + (y[2] - x[2]) * s];
  const out = { r: m3(a.r, b.r), d: m3(a.d, b.d), l: m3(a.l, b.l), two: a.two + (b.two - a.two) * s };
  for (const f of FIELDS) out[f] = a[f] + (b[f] - a[f]) * s;
  return out;
}

// Weiche Kurve durch vier Punkte (Catmull-Rom): Die Bewegung läuft flüssig durch die Posen,
// ohne an jeder Pose kurz anzuhalten.
const cr1 = (a, b, c, d, u) => 0.5 * ((2 * b) + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
const cr3 = (a, b, c, d, u) => [cr1(a[0], b[0], c[0], d[0], u), cr1(a[1], b[1], c[1], d[1], u), cr1(a[2], b[2], c[2], d[2], u)];

function sample(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return full(keys[0][1]);
  if (t >= keys[n - 1][0]) return full(keys[n - 1][1]);
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const a = full(keys[Math.max(0, i - 1)][1]), b = full(keys[i][1]), c = full(keys[i + 1][1]), d = full(keys[Math.min(n - 1, i + 2)][1]);
  const out = { r: cr3(a.r, b.r, c.r, d.r, u), d: cr3(a.d, b.d, c.d, d.d, u), l: cr3(a.l, b.l, c.l, d.l, u), two: b.two + (c.two - b.two) * u };
  for (const f of FIELDS) out[f] = cr1(a[f], b[f], c[f], d[f], u);
  return out;
}

// Pose einer Schlagbewegung zur Zeit t (0 = Treffpunkt). contactY = Höhe des Balls beim Treffen.
export function strokePose(name, t, contactY = 0.95) {
  const p = sample(STROKES[name], t);
  return lift(p, name, contactY);
}

// Pose beim Ausholen (k = 0…1)
export function prepPose(name, k, contactY = 0.95) {
  return lift(sample(PREPS[name] || PREPS.fh_ts, k), name, contactY);
}

// Die Hand folgt der Ballhöhe (nicht bei Aufschlag und Schmetterball – da geht es immer nach oben)
function lift(p, name, contactY) {
  if (name === 'sv' || name === 'sm' || !p.h) return p;
  const base = name.endsWith('_vo') ? 1.05 : 0.95;
  const dy = (Math.max(0.45, Math.min(1.7, contactY)) - base) * p.h;
  if (Math.abs(dy) < 0.005) return p;
  return { ...p, r: [p.r[0], p.r[1], p.r[2] + dy], l: [p.l[0], p.l[1], p.l[2] + dy * p.two] };
}
