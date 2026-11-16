// Powershot – der "Service Worker". Das ist ein kleiner Helfer, den der Browser im Hintergrund laufen lässt.
// Er merkt sich alle Dateien des Spiels in einem Zwischenspeicher (Cache). Dadurch startet das Spiel
// auf iPad und iPhone auch ohne Internet, wenn es vorher einmal mit Internet geladen wurde.
//
// Zwei Regeln:
//   1. Programm-Dateien (HTML, CSS, JavaScript): zuerst im Internet nachsehen, damit Änderungen sofort
//      ankommen. Nur wenn kein Internet da ist, nehmen wir die gemerkte Datei.
//   2. Große Dateien (Spielermodelle, Sounds, three.js): zuerst die gemerkte Datei nehmen – das spart
//      jedes Mal rund 15 MB Herunterladen.
//
// Wenn du ein Modell oder einen Sound austauschst (gleicher Dateiname, neuer Inhalt), erhöhe VERSION um 1.
// Dann wirft der Helfer den alten Speicher weg und lädt alles frisch.

const VERSION = 1;
const CACHE = 'powershot-v' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Alte Speicher (von früheren Versionen) aufräumen
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

// Holt eine Datei aus dem Internet und merkt sie sich (nur wenn sie wirklich angekommen ist)
async function holen(request) {
  const antwort = await fetch(request);
  if (antwort.ok) (await caches.open(CACHE)).put(request, antwort.clone());
  return antwort;
}

// Gehört die Adresse zum Spiel? (eigene Dateien, three.js und die Körpererkennung von jsDelivr, aber nie die Bewegungsaufnahmen)
function gehoertDazu(url) {
  const eigene = url.origin === self.location.origin;
  if (!eigene && url.hostname !== 'cdn.jsdelivr.net') return false;
  return !url.pathname.includes('/mocap/');
}

// Beim allerersten Start lädt die Seite ihre Dateien, bevor der Helfer mithören kann.
// Deshalb schickt uns die Seite danach eine Liste dieser Dateien (siehe index.html) und wir holen sie nach.
self.addEventListener('message', (event) => {
  const liste = (event.data && event.data.merken) || [];
  event.waitUntil((async () => {
    for (const adresse of liste) {
      try {
        if (!gehoertDazu(new URL(adresse))) continue;
        if (!(await caches.match(adresse))) await holen(new Request(adresse));
      } catch (e) { /* diese Datei klappt nicht – beim nächsten Start wieder versuchen */ }
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!gehoertDazu(url)) return;
  const eigene = url.origin === self.location.origin;

  const gross = !eigene || /\/(assets|sounds|icons)\//.test(url.pathname);
  event.respondWith((async () => {
    const gemerkt = await caches.match(request, { ignoreSearch: eigene && !gross });
    if (gross) return gemerkt || holen(request);                 // Regel 2
    try { return await holen(request); }                         // Regel 1
    catch (e) { if (gemerkt) return gemerkt; throw e; }
  })());
});
