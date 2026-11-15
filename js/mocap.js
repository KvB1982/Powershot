// Powershot – aufgezeichnete Bewegungen (Motion Capture).
// tools/mocap.mjs rechnet gekaufte Aufnahmen in die Datei mocap/bewegungen.json um. Gibt es diese Datei,
// benutzt die Figur für die enthaltenen Schläge die echten Gelenkpositionen statt der Posen aus posen.js.
// Fehlt sie (z. B. auf GitHub, wo die gekauften Dateien nicht liegen), läuft alles wie vorher.

let data = null;

export async function loadMocap(url = 'mocap/bewegungen.json') {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    for (const c of Object.values(json.clips)) c.tEnd = c.t0 + (c.frames.length - 1) / c.fps;
    data = json;
    return true;
  } catch (e) { return false; }
}

export const mocapClip = (name) => (data && data.clips[name]) || null;
export const mocapNames = () => (data ? Object.keys(data.clips) : []);

// Alle Gelenke zur Zeit t (0 = Treffpunkt). Ergebnis: { hip:[vor,seite,hoch], shR:…, d:…, n:… }
export function mocapFrame(clip, t) {
  const x = Math.max(0, Math.min(clip.frames.length - 1.001, (t - clip.t0) * clip.fps));
  const i = Math.floor(x), u = x - i;
  const a = clip.frames[i], b = clip.frames[i + 1] || a;
  const out = {};
  data.keys.forEach((k, j) => {
    const o = j * 3;
    out[k] = [a[o] + (b[o] - a[o]) * u, a[o + 1] + (b[o + 1] - a[o + 1]) * u, a[o + 2] + (b[o + 2] - a[o + 2]) * u];
  });
  return out;
}
