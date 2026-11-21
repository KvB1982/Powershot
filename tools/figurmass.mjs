// Powershot – Werkzeug-Baustein: Gelenke einer fremden Figur auf die Maße unserer Tennisspieler umrechnen.
// Benutzt von tools/gang.mjs (Polizist aus Police Quest) und tools/mixamo.mjs (Mixamo-Aufnahmen).
// Übernommen werden nur die RICHTUNGEN von Oberschenkel, Unterschenkel, Oberarm, Unterarm und Rumpf –
// die LÄNGEN kommen von unserer Figur (MASS). So wird kein Bein langgezogen.
// Alle Punkte sind [vor, seite, hoch] in Metern (seite: + = rechts von der Figur).

// Maße unserer Figur in Metern (wie DIM_REAL in js/avatar.js und REST in js/figur.js)
export const MASS = {
  ober: 0.42, unter: 0.425,        // Oberschenkel, Unterschenkel
  hueftBreit: 0.09,                // von der Körpermitte bis zum Hüftgelenk
  halsHoch: 0.625,                 // von der Hüfte bis zum Hals
  schulterTief: 0.77,              // die Schultern sitzen auf diesem Teil der Strecke Hüfte → Hals …
  schulterHinten: 0.05,            // … und so weit hinter dieser Linie (Meter)
  schulterBreit: 0.192,            // von der Körpermitte bis zur Schulter
  oberarm: 0.275, unterarm: 0.278, // Schulter → Ellbogen → Handgelenk
  griff: 0.065,                    // vom Handgelenk bis zur Mitte der Handfläche
  kopf: 0.075,                     // Hals → Kopfgelenk
  knoechel: 0.09,                  // so hoch ist der Knöchel, wenn der Fuß flach steht
  fuss: 0.15, fussRuhe: 0.46,      // Knöchel → Fußballen; so stark zeigt diese Linie im Stand nach unten (Bogenmaß)
};

// ---- kleine Rechen-Helfer
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const mitte = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// Diese Gelenke stehen in jedem Bild einer Aufnahme (je drei Zahlen)
export const KEYS = ['hip', 'neck', 'head', 'shR', 'shL', 'elR', 'elL', 'handR', 'handL', 'hipR', 'hipL', 'kneeR', 'kneeL', 'footR', 'footL', 'toeR', 'toeL'];

// R = die fremde Figur in ihrer Ruhe-Haltung (T-Pose), finger = Name des Knochens am Anfang der Finger
// (damit weiß man, wohin die Hand zeigt). Antwort: eine Funktion, die ein Bild der fremden Figur umrechnet.
// Die Knochen heißen wie bei Mixamo: Hips, Neck, Head, Left/Right + UpLeg, Leg, Foot, ToeBase, Arm, ForeArm, Hand.
export function umrechner(R, finger = 'Finger1') {
  const beinQ = len(sub(R.RightLeg, R.RightUpLeg)) + len(sub(R.RightFoot, R.RightLeg));
  const kBein = (MASS.ober + MASS.unter) / beinQ;                              // so viel kleiner (oder größer) sind unsere Beine
  const rumpfQ = len(sub(R.Neck, mitte(R.LeftUpLeg, R.RightUpLeg))), kopfQ = len(sub(R.Head, R.Neck));
  const neigung = (fuss, zeh) => Math.atan2(fuss[2] - zeh[2], Math.hypot(zeh[0] - fuss[0], zeh[1] - fuss[1]));
  const fussRuheQ = neigung(R.RightFoot, R.RightToeBase);                      // so steht der Fuß der fremden Figur, wenn er flach steht
  function umrechnen(Q) {
    const o = {};
    const beinMitte = mitte(Q.LeftUpLeg, Q.RightUpLeg);
    o.hip = [beinMitte[0] * kBein, beinMitte[1] * kBein, beinMitte[2] * kBein];
    const hQuer = norm(sub(Q.RightUpLeg, Q.LeftUpLeg)), sQuer = norm(sub(Q.RightArm, Q.LeftArm));
    // Rumpf: Die Linie Hüfte → Hals neigt sich wie bei der fremden Figur. Die Schultern sitzen fest an dieser Linie
    // (bei der fremden Figur hängen sie mit den Armen herunter – unsere Figur hat dafür kein Gelenk).
    o.neck = add(o.hip, sub(Q.Neck, beinMitte), MASS.halsHoch / rumpfQ);
    const oben = add(add(o.hip, sub(o.neck, o.hip), MASS.schulterTief), [-MASS.schulterHinten, 0, 0]);    // Mitte zwischen den Schultern
    o.head = add(o.neck, sub(Q.Head, Q.Neck), MASS.kopf / kopfQ);
    for (const [s, S, v] of [['R', 'Right', 1], ['L', 'Left', -1]]) {
      o['hip' + s] = add(o.hip, hQuer, v * MASS.hueftBreit);
      o['knee' + s] = add(o['hip' + s], norm(sub(Q[S + 'Leg'], Q[S + 'UpLeg'])), MASS.ober);
      o['foot' + s] = add(o['knee' + s], norm(sub(Q[S + 'Foot'], Q[S + 'Leg'])), MASS.unter);
      // Fuß: Richtung zum Fußballen wie bei der fremden Figur, aber die Neigung von unserem flachen Fuß aus gerechnet
      const f = Q[S + 'Foot'], z = Q[S + 'ToeBase'], w = MASS.fussRuhe + neigung(f, z) - fussRuheQ, flach = norm([z[0] - f[0], z[1] - f[1], 0]);
      o['toe' + s] = add(o['foot' + s], [flach[0] * Math.cos(w), flach[1] * Math.cos(w), -Math.sin(w)], MASS.fuss);
      o['sh' + s] = add(oben, sQuer, v * MASS.schulterBreit);
      o['el' + s] = add(o['sh' + s], norm(sub(Q[S + 'ForeArm'], Q[S + 'Arm'])), MASS.oberarm);
      const gelenk = add(o['el' + s], norm(sub(Q[S + 'Hand'], Q[S + 'ForeArm'])), MASS.unterarm);
      o['hand' + s] = add(gelenk, norm(sub(Q[S + finger], Q[S + 'Hand'])), MASS.griff);
    }
    return o;
  }
  umrechnen.kBein = kBein; umrechnen.beinQ = beinQ; umrechnen.rumpfQ = rumpfQ;
  return umrechnen;
}
