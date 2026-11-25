// Powershot – hebt die Aufnahmen des Match-Rekorders im Browser auf (js/rekorder.js).
// Die Aufnahmen liegen in einer kleinen Datenbank des Browsers (IndexedDB) und nicht bei den Spielständen:
// Sie sind groß (ein Match etwa 100 bis 400 KB) und gehören zu keinem Profil. Geht die Datenbank nicht
// (manche Browser im privaten Modus), bleiben die Aufnahmen nur so lange da, bis die Seite neu geladen wird.

const DB = 'powershot-rekorder', LAGER = 'aufnahmen';
export const HOECHSTENS = 30;       // so viele Aufnahmen bleiben, die ältesten fliegen raus

let dbP = null;
const notfall = [];                 // ohne Datenbank: nur im Arbeitsspeicher

function oeffnen() {
  if (dbP) return dbP;
  dbP = new Promise((ok) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LAGER, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch (e) { ok(null); }
  });
  return dbP;
}

// Eine Frage an die Datenbank stellen und auf die Antwort warten
async function frage(art, tun) {
  const db = await oeffnen();
  if (!db) return undefined;
  return new Promise((ok) => {
    try {
      const tx = db.transaction(LAGER, art), r = tun(tx.objectStore(LAGER));
      tx.oncomplete = () => ok(r ? r.result : true);
      tx.onerror = tx.onabort = () => ok(undefined);
    } catch (e) { ok(undefined); }
  });
}

// Alle Aufnahmen, die neueste zuerst
export async function alle() {
  const l = await frage('readonly', (s) => s.getAll());
  return (l || notfall).slice().sort((a, b) => (a.id < b.id ? 1 : -1));
}

export async function speichern(aufnahme) {
  aufnahme.id = aufnahme.id || `${aufnahme.kopf.wann}-${Math.random().toString(36).slice(2, 6)}`;
  const ok = await frage('readwrite', (s) => s.put(aufnahme));
  if (!ok) notfall.push(aufnahme);
  // Zu viele? Dann die ältesten löschen.
  const l = await alle();
  for (const alt of l.slice(HOECHSTENS)) await loeschen(alt.id);
  return !!ok;
}

export async function loeschen(id) {
  const i = notfall.findIndex((a) => a.id === id);
  if (i >= 0) notfall.splice(i, 1);
  await frage('readwrite', (s) => s.delete(id));
}

export async function allesLoeschen() {
  notfall.length = 0;
  await frage('readwrite', (s) => s.clear());
}

// Alle Aufnahmen als Text für eine Datei (so liest sie tools/rekorder.mjs)
export async function paket() {
  return JSON.stringify({ powershotAufnahmen: 1, gesichert: new Date().toISOString(), aufnahmen: await alle() });
}
