// Powershot – aufgezeichnete Bewegungen (Motion Capture).
// tools/mocap.mjs rechnet gekaufte Aufnahmen in die Datei mocap/bewegungen.json um. Gibt es diese Datei,
// benutzt die Figur für die enthaltenen Schläge die echten Gelenkpositionen statt der Posen aus posen.js.
// Fehlt sie (z. B. auf GitHub, wo die gekauften Dateien nicht liegen), läuft alles wie vorher.

let data = null;
// Frei verwendbare Bewegungen: Gehen und Sprinten aus dem Schwester-Spiel Police Quest (assets/gang.json, umgerechnet mit
// tools/gang.mjs) und Laufen, Seitwärts-Laufen, Stehen von Mixamo (assets/lauf.json, umgerechnet mit tools/mixamo.mjs).
// Diese Dateien liegen im Repository – sie laufen also auch auf GitHub Pages und in der App.
let frei = null;

export async function loadGang(urls = ['assets/gang.json', 'assets/lauf.json']) {
  const alle = { clips: {} };
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      for (const [name, c] of Object.entries(json.clips)) { c.tEnd = c.t0 + (c.frames.length - 1) / c.fps; c.keys = json.keys; alle.clips[name] = c; }
    } catch (e) { /* fehlt die Datei, bleibt es bei den gebauten Bewegungen */ }
  }));
  if (!Object.keys(alle.clips).length) return false;
  frei = alle;
  return true;
}

export async function loadMocap(url = 'mocap/bewegungen.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    for (const c of Object.values(json.clips)) { c.tEnd = c.t0 + (c.frames.length - 1) / c.fps; c.keys = json.keys; }
    data = json;
    return true;
  } catch (e) { return false; }
}

// (Eine eigene Aufnahme aus mocap/ geht vor, sonst kommt die frei verwendbare.)
export const mocapClip = (name) => (data && data.clips[name]) || (frei && frei.clips[name]) || null;
// Eine Aufnahme als Schleife abspielen (Warten auf den Ball): Das Ende blendet weich in den Anfang über.
export function mocapLoop(clip, time) {
  const len = clip.tEnd - clip.t0, over = 0.5;
  const t = time % (len - over);
  const f = mocapFrame(clip, clip.t0 + t);
  if (t >= over) return f;
  const g = mocapFrame(clip, clip.t0 + len - over + t), u = t / over, out = {};
  for (const k of clip.keys) out[k] = [g[k][0] + (f[k][0] - g[k][0]) * u, g[k][1] + (f[k][1] - g[k][1]) * u, g[k][2] + (f[k][2] - g[k][2]) * u];
  return out;
}

// Eine Geh-Aufnahme im Takt der Schritte abspielen. phase zählt die Schritte der Figur (2π = zwei Schritte);
// die Aufnahme beginnt mit dem Schlaghand-Fuß ganz vorn und enthält clip.schritte Doppelschritte.
export function mocapGang(clip, phase) {
  const n = clip.schritte || 1;
  let u = ((phase - Math.PI / 2) / (2 * Math.PI)) % n;
  if (u < 0) u += n;
  return mocapFrame(clip, clip.t0 + u / n * (clip.tEnd - clip.t0));
}

// Zwei Bilder mischen (k = 0: nur a, k = 1: nur b)
export function mocapMix(a, b, k) {
  const out = {};
  for (const n in a) out[n] = [a[n][0] + (b[n][0] - a[n][0]) * k, a[n][1] + (b[n][1] - a[n][1]) * k, a[n][2] + (b[n][2] - a[n][2]) * k];
  return out;
}

// Die „Leiter“ vom Gehen bis zum Sprint: stufen = Aufnahmen, nach Tempo sortiert (gehen, laufen, schnell laufen, sprinten).
// k sagt, wo auf der Leiter man steht: 0 = erste Aufnahme, 1 = zweite, 1,5 = genau zwischen zweiter und dritter.
// Alle Aufnahmen laufen im selben Takt (der Schlaghand-Fuß ist bei allen gleichzeitig vorn), deshalb darf man sie mischen.
export function mocapLauf(stufen, phase, k) {
  const i = Math.max(0, Math.min(stufen.length - 1, Math.floor(k))), u = k - i;
  const a = mocapGang(stufen[i], phase);
  if (u < 0.001 || !stufen[i + 1]) return a;
  return mocapMix(a, mocapGang(stufen[i + 1], phase), u);
}
// Wo auf der Leiter gehört ein Tempo (Meter pro Sekunde) hin?
export function mocapStufe(stufen, tempo) {
  for (let i = 0; i < stufen.length - 1; i++) if (tempo < stufen[i + 1].tempo) return i + Math.max(0, (tempo - stufen[i].tempo) / (stufen[i + 1].tempo - stufen[i].tempo));
  return stufen.length - 1;
}
// Wie weit kommt man an dieser Stelle der Leiter mit einem Doppelschritt (Meter)?
export function mocapWeg(stufen, k) {
  const i = Math.max(0, Math.min(stufen.length - 1, Math.floor(k))), b = stufen[i + 1];
  return stufen[i].weg + (b ? (b.weg - stufen[i].weg) * (k - i) : 0);
}
// Eine Runde, die genau in sich selbst zurückläuft (z. B. Stehen und Atmen), einfach mit der Zeit abspielen
export const mocapRunde = (clip, time) => mocapFrame(clip, clip.t0 + time % (clip.tEnd - clip.t0));

export const mocapNames = () => (data ? Object.keys(data.clips) : []);

// Alle Gelenke zur Zeit t (0 = Treffpunkt). Ergebnis: { hip:[vor,seite,hoch], shR:…, d:…, n:… }
export function mocapFrame(clip, t) {
  const x = Math.max(0, Math.min(clip.frames.length - 1.001, (t - clip.t0) * clip.fps));
  const i = Math.floor(x), u = x - i;
  const a = clip.frames[i], b = clip.frames[i + 1] || a;
  const out = {};
  clip.keys.forEach((k, j) => {
    const o = j * 3;
    out[k] = [a[o] + (b[o] - a[o]) * u, a[o + 1] + (b[o + 1] - a[o + 1]) * u, a[o + 2] + (b[o + 2] - a[o + 2]) * u];
  });
  return out;
}
