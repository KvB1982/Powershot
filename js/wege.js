// Powershot – Wege auf dem Turniergelände (ohne three.js, in node testbar).
//
// Das Gelände wird in ein Gitter aus kleinen Kästchen zerlegt (1 Meter groß).
// Jedes Kästchen ist entweder frei (man kann dort laufen) oder zu (Haus, Stadion, Platz, Wasser).
// Damit prüft das Spiel zwei Dinge:
//   1. Darf die Figur hierhin? (nicht durch Wände laufen)
//   2. Wie kommt die Figur von A nach B, ohne irgendwo hängen zu bleiben? (der kürzeste Weg um alles herum)

const PLATZ_UM_FIGUR = 0.45;     // so viel Abstand hält die Figur von einer Wand (Meter)

// Baut das Gitter. rand = { x0, x1, z0, z1 } (Grenzen des Geländes),
// sperren = Liste von Formen, durch die man nicht laufen kann:
//   { x, z, b, t }            ein Rechteck (Mitte x/z, b breit, t tief)
//   { x, z, b, t, rund: true } ein Oval mit denselben Maßen
export function gitterBauen(rand, sperren, zelle = 1) {
  const nx = Math.ceil((rand.x1 - rand.x0) / zelle), nz = Math.ceil((rand.z1 - rand.z0) / zelle);
  const zu = new Uint8Array(nx * nz), hoch = new Float32Array(nx * nz);      // hoch = wie hoch das ist, was dort steht (für die Kamera)
  const G = { x0: rand.x0, z0: rand.z0, nx, nz, zelle, zu, hoch };
  for (const s of sperren) {
    const hb = s.b / 2 + PLATZ_UM_FIGUR, ht = s.t / 2 + PLATZ_UM_FIGUR;
    const i0 = Math.max(0, Math.floor((s.x - hb - rand.x0) / zelle)), i1 = Math.min(nx - 1, Math.floor((s.x + hb - rand.x0) / zelle));
    const k0 = Math.max(0, Math.floor((s.z - ht - rand.z0) / zelle)), k1 = Math.min(nz - 1, Math.floor((s.z + ht - rand.z0) / zelle));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      // Mitte des Kästchens
      const dx = (rand.x0 + (i + 0.5) * zelle - s.x) / hb, dz = (rand.z0 + (k + 0.5) * zelle - s.z) / ht;
      if (s.rund ? dx * dx + dz * dz <= 1 : Math.abs(dx) <= 1 && Math.abs(dz) <= 1) { zu[k * nx + i] = 1; if (s.h > hoch[k * nx + i]) hoch[k * nx + i] = s.h; }
    }
  }
  return G;
}

const zelleVon = (G, x, z) => [Math.floor((x - G.x0) / G.zelle), Math.floor((z - G.z0) / G.zelle)];
const drin = (G, i, k) => i >= 0 && k >= 0 && i < G.nx && k < G.nz;
const offen = (G, i, k) => drin(G, i, k) && !G.zu[k * G.nx + i];

// Wie hoch ist das Gebäude an dieser Stelle? (0 = da steht nichts Hohes)
export function hoeheBei(G, x, z) {
  const [i, k] = zelleVon(G, x, z);
  return drin(G, i, k) ? G.hoch[k * G.nx + i] : 0;
}

// Kann man an dieser Stelle stehen?
export function frei(G, x, z) {
  const [i, k] = zelleVon(G, x, z);
  return offen(G, i, k);
}

// Die nächste freie Stelle zu einem Punkt (falls jemand mitten auf ein Haus tippt)
export function naechsteFreie(G, x, z) {
  const [i0, k0] = zelleVon(G, Math.max(G.x0, Math.min(G.x0 + G.nx * G.zelle - 0.01, x)), Math.max(G.z0, Math.min(G.z0 + G.nz * G.zelle - 0.01, z)));
  if (offen(G, i0, k0)) return { x, z };
  for (let r = 1; r < 60; r++) {
    let best = null, bd = 1e9;
    for (let k = k0 - r; k <= k0 + r; k++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (Math.max(Math.abs(i - i0), Math.abs(k - k0)) !== r || !offen(G, i, k)) continue;      // nur der Rand des Quadrats
      const d = (i - i0) ** 2 + (k - k0) ** 2;
      if (d < bd) { bd = d; best = [i, k]; }
    }
    if (best) return { x: G.x0 + (best[0] + 0.5) * G.zelle, z: G.z0 + (best[1] + 0.5) * G.zelle };
  }
  return null;
}

// Ist die gerade Linie von a nach b frei? (wird in kleinen Schritten abgetastet)
export function sicht(G, ax, az, bx, bz) {
  const weit = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(weit / (G.zelle * 0.4)));
  for (let s = 0; s <= n; s++) if (!frei(G, ax + (bx - ax) * s / n, az + (bz - az) * s / n)) return false;
  return true;
}

// Der kürzeste Weg von a nach b als Liste von Punkten [{ x, z }, …] – oder null, wenn es keinen gibt.
// (Das Verfahren heißt A*: Es probiert immer zuerst das Kästchen aus, das am vielversprechendsten aussieht.)
export function weg(G, ax, az, bx, bz) {
  const a = naechsteFreie(G, ax, az), b = naechsteFreie(G, bx, bz);
  if (!a || !b) return null;
  if (sicht(G, a.x, a.z, b.x, b.z)) return [b];
  const [ai, ak] = zelleVon(G, a.x, a.z), [bi, bk] = zelleVon(G, b.x, b.z);
  const N = G.nx * G.nz, start = ak * G.nx + ai, ziel = bk * G.nx + bi;
  const kosten = new Float32Array(N).fill(Infinity), von = new Int32Array(N).fill(-1), fertig = new Uint8Array(N);
  // Ein kleiner „Haufen“: Er gibt immer das Kästchen mit der kleinsten Zahl zuerst heraus.
  const haufen = [], wert = [];
  const rein = (id, w) => {
    let n = haufen.length; haufen.push(id); wert.push(w);
    while (n > 0) { const e = (n - 1) >> 1; if (wert[e] <= w) break; haufen[n] = haufen[e]; wert[n] = wert[e]; n = e; }
    haufen[n] = id; wert[n] = w;
  };
  const raus = () => {
    const oben = haufen[0], id = haufen.pop(), w = wert.pop(), len = haufen.length;
    if (len) {
      let n = 0;
      for (;;) {
        let c = 2 * n + 1; if (c >= len) break;
        if (c + 1 < len && wert[c + 1] < wert[c]) c++;
        if (wert[c] >= w) break;
        haufen[n] = haufen[c]; wert[n] = wert[c]; n = c;
      }
      haufen[n] = id; wert[n] = w;
    }
    return oben;
  };
  const luft = (i, k) => { const dx = Math.abs(i - bi), dz = Math.abs(k - bk); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  kosten[start] = 0; rein(start, luft(ai, ak));
  const NACHBARN = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let da = false;
  while (haufen.length) {
    const id = raus();
    if (fertig[id]) continue;
    fertig[id] = 1;
    if (id === ziel) { da = true; break; }
    const i = id % G.nx, k = (id - i) / G.nx;
    for (const [di, dk, w] of NACHBARN) {
      const ni = i + di, nk = k + dk;
      if (!offen(G, ni, nk)) continue;
      if (di && dk && (!offen(G, i + di, k) || !offen(G, i, k + dk))) continue;       // nicht schräg um eine Hausecke schneiden
      const nid = nk * G.nx + ni, neu = kosten[id] + w;
      if (neu < kosten[nid]) { kosten[nid] = neu; von[nid] = id; rein(nid, neu + luft(ni, nk)); }
    }
  }
  if (!da) return null;
  // Den Weg rückwärts einsammeln
  const roh = [];
  for (let id = ziel; id !== -1; id = von[id]) { const i = id % G.nx, k = (id - i) / G.nx; roh.push({ x: G.x0 + (i + 0.5) * G.zelle, z: G.z0 + (k + 0.5) * G.zelle }); }
  roh.reverse();
  roh[roh.length - 1] = b;
  // Glätten: Punkte weglassen, wenn man auch geradeaus zum übernächsten käme. So läuft die Figur nicht im Zickzack.
  const glatt = [];
  let jetzt = a, n = 0;
  while (n < roh.length - 1) {
    let m = roh.length - 1;
    while (m > n + 1 && !sicht(G, jetzt.x, jetzt.z, roh[m].x, roh[m].z)) m--;
    glatt.push(roh[m]); jetzt = roh[m]; n = m;
  }
  if (!glatt.length) glatt.push(b);
  return glatt;
}
