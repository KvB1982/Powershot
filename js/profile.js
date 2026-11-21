// Powershot – Profile: „Wer spielt?“
// Mehrere Leute an einem Gerät (zum Beispiel Vater und Sohn) haben jeder ihre eigenen Spielstände und Einstellungen.
// So geht es: Das Spiel merkt sich alles unter Namen, die mit „powershot.“ anfangen (Karriere, Saison, Einstellungen …).
// Beim Wechseln packen wir alle diese Sachen des alten Profils in eine Kiste (LAGER + Kennung)
// und holen die Kiste des neuen Profils heraus. Danach wird die Seite neu geladen.
// Dazu: alles zusammen als Datei sichern und wieder einspielen (zum Beispiel vom iPad auf den PC).
// Ohne three.js und ohne andere Dateien – in node testbar (mit einem künstlichen Speicher).

const KEY = 'powershot.profile.v1';       // wer es gibt und wer gerade spielt
const LAGER = 'powershot.profil.';        // davor: die Kisten der anderen Profile
export const HOECHSTENS = 6;              // so viele Profile gehen

// Der Speicher des Browsers (im Test kann man einen eigenen mitgeben)
let speicher = null;
try { speicher = globalThis.localStorage || null; } catch (e) { speicher = null; }
export function setzeSpeicher(s) { speicher = s; }

const lies = (k) => { try { return speicher.getItem(k); } catch (e) { return null; } };
const schreib = (k, v) => { try { speicher.setItem(k, v); return true; } catch (e) { return false; } };
const weg = (k) => { try { speicher.removeItem(k); } catch (e) { /* egal */ } };

// Die Liste der Profile: { aktiv: Kennung, liste: [{ id, name }] }
export function laden() {
  let p = null;
  try { p = JSON.parse(lies(KEY)); } catch (e) { p = null; }
  if (!p || !Array.isArray(p.liste) || !p.liste.length) p = { aktiv: 'p1', liste: [{ id: 'p1', name: 'Spieler 1' }] };
  if (!p.liste.some((x) => x.id === p.aktiv)) p.aktiv = p.liste[0].id;
  return p;
}
const sichern = (p) => schreib(KEY, JSON.stringify(p));
export const aktiv = () => { const p = laden(); return p.liste.find((x) => x.id === p.aktiv); };

// Alle Namen im Speicher, die zum Profil gehören, das gerade spielt (also ohne die Liste und ohne die Kisten)
export function eigene() {
  const namen = [];
  try {
    for (let i = 0; i < speicher.length; i++) {
      const k = speicher.key(i);
      if (k && k.startsWith('powershot.') && k !== KEY && !k.startsWith(LAGER)) namen.push(k);
    }
  } catch (e) { /* kein Speicher */ }
  return namen;
}

// Alles vom Profil, das gerade spielt, als ein Päckchen { name: text }
function einpacken() {
  const kiste = {};
  for (const k of eigene()) kiste[k] = lies(k);
  return kiste;
}
function auspacken(kiste) {
  for (const k of eigene()) weg(k);
  for (const [k, v] of Object.entries(kiste || {})) if (k.startsWith('powershot.') && k !== KEY && !k.startsWith(LAGER) && typeof v === 'string') schreib(k, v);
}

const sauber = (name) => String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 16);

// Neues Profil anlegen (es fängt ganz von vorne an). Gibt die Kennung zurück oder null.
export function neu(name) {
  const p = laden();
  name = sauber(name);
  if (!name || p.liste.length >= HOECHSTENS) return null;
  let n = 1; while (p.liste.some((x) => x.id === 'p' + n)) n++;
  p.liste.push({ id: 'p' + n, name });
  sichern(p);
  return 'p' + n;
}

export function umbenennen(id, name) {
  const p = laden(), x = p.liste.find((y) => y.id === id);
  name = sauber(name);
  if (!x || !name) return false;
  x.name = name;
  return sichern(p);
}

// Zu einem anderen Profil wechseln. Danach muss die Seite neu geladen werden! Gibt true zurück, wenn gewechselt wurde.
export function wechseln(id) {
  const p = laden();
  if (id === p.aktiv || !p.liste.some((x) => x.id === id)) return false;
  // Erst die eigene Kiste wegstellen – klappt das nicht (Speicher voll), bleibt alles, wie es ist.
  if (!schreib(LAGER + p.aktiv, JSON.stringify(einpacken()))) return false;
  let kiste = {};
  try { kiste = JSON.parse(lies(LAGER + id)) || {}; } catch (e) { kiste = {}; }
  auspacken(kiste);
  weg(LAGER + id);
  p.aktiv = id;
  sichern(p);
  return true;
}

// Ein Profil löschen, das gerade NICHT spielt (das eigene kann man nicht löschen – erst wechseln)
export function loeschen(id) {
  const p = laden();
  if (id === p.aktiv || !p.liste.some((x) => x.id === id)) return false;
  p.liste = p.liste.filter((x) => x.id !== id);
  weg(LAGER + id);
  return sichern(p);
}

// Was hat ein Profil? Kurzer Text für die Liste (Karriere-Name, Saison …)
export function inhalt(id) {
  const p = laden();
  let kiste;
  if (id === p.aktiv) kiste = einpacken();
  else { try { kiste = JSON.parse(lies(LAGER + id)) || {}; } catch (e) { kiste = {}; } }
  const teile = [];
  try { const c = JSON.parse(kiste['powershot.karriere.v1'] || 'null'); if (c && c.name) teile.push('Karriere: ' + sauber(c.name)); } catch (e) { /* kaputt: weglassen */ }
  if (kiste['powershot.saison.v1']) teile.push('Saison läuft');
  return teile.length ? teile.join(' · ') : 'noch kein Spielstand';
}

// Alles (alle Profile) als Text für eine Datei
export function paket() {
  const p = laden(), kisten = {};
  for (const x of p.liste) {
    if (x.id === p.aktiv) kisten[x.id] = einpacken();
    else { try { kisten[x.id] = JSON.parse(lies(LAGER + x.id)) || {}; } catch (e) { kisten[x.id] = {}; } }
  }
  return JSON.stringify({ powershot: 1, datum: new Date().toISOString().slice(0, 10), profile: p, kisten });
}

// Eine gesicherte Datei wieder einspielen. Ersetzt ALLE Profile. Gibt true zurück, wenn die Datei gepasst hat.
export function einspielen(text) {
  let d = null;
  try { d = JSON.parse(text); } catch (e) { return false; }
  if (!d || d.powershot !== 1 || !d.profile || !Array.isArray(d.profile.liste) || !d.profile.liste.length || !d.kisten) return false;
  const liste = d.profile.liste.filter((x) => x && /^p\d+$/.test(x.id) && sauber(x.name)).slice(0, HOECHSTENS).map((x) => ({ id: x.id, name: sauber(x.name) }));
  if (!liste.length) return false;
  const aktivId = liste.some((x) => x.id === d.profile.aktiv) ? d.profile.aktiv : liste[0].id;
  // Alte Kisten wegräumen, dann die neuen hinstellen
  const alt = laden();
  for (const x of alt.liste) weg(LAGER + x.id);
  for (const x of liste) if (x.id !== aktivId) schreib(LAGER + x.id, JSON.stringify(d.kisten[x.id] || {}));
  auspacken(d.kisten[aktivId] || {});
  return sichern({ aktiv: aktivId, liste });
}
