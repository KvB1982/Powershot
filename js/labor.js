// Powershot – das Physik-Labor (Hauptmenü → „Physik-Labor“).
// Hier merkt sich das Spiel, wie du die Regler gestellt hast, und baut die Seite mit den Schiebereglern.
// Die Regler selbst (Namen, Grenzen, Standard) stehen in js/regler.js. Diese Datei kennt keine Grafik.
//
// Der Stand sieht so aus:
//   { basis: 'mittel',               ← von dieser Stufe gehen die Regler „Gegner und Hilfen“ aus
//     werte: { tempo: 1.1, … },      ← nur Regler, die NICHT auf Standard stehen
//     stufen: [ { id, name, basis, werte } ] }   ← deine gespeicherten eigenen Stufen (höchstens STUFEN_MAX)

import { REGLER, GRUPPEN, standardVon, pruefe, geaendert, zeige } from './regler.js';

const KEY = 'powershot.labor.v1';      // fängt mit „powershot.“ an – gehört damit zum Profil, das gerade spielt
export const STUFEN_MAX = 8;

const leer = () => ({ basis: 'mittel', werte: {}, stufen: [] });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Stand aus dem Speicher holen. Was kaputt oder unbekannt ist, wird weggelassen.
export function laden(DIFF, speicher = globalThis.localStorage) {
  const s = leer();
  try {
    const roh = JSON.parse((speicher && speicher.getItem(KEY)) || 'null');
    if (roh && typeof roh === 'object') {
      if (DIFF[roh.basis]) s.basis = roh.basis;
      s.werte = geaendert(roh.werte, DIFF[s.basis]);
      for (const e of Array.isArray(roh.stufen) ? roh.stufen.slice(0, STUFEN_MAX) : []) {
        if (!e || !DIFF[e.basis]) continue;
        s.stufen.push({ id: String(e.id || Date.now()), name: String(e.name || 'Meine Stufe').slice(0, 24), basis: e.basis, werte: geaendert(e.werte, DIFF[e.basis]) });
      }
    }
  } catch (e) { /* nichts gespeichert oder nicht lesbar: mit leerem Stand anfangen */ }
  return s;
}
export function sichern(stand, speicher = globalThis.localStorage) {
  try { speicher.setItem(KEY, JSON.stringify(stand)); } catch (e) { /* Speicher voll oder gesperrt */ }
}

// Der Wert eines Reglers, wie er gerade im Labor steht
export function wert(stand, r, DIFF) {
  return r.id in stand.werte ? stand.werte[r.id] : standardVon(r, DIFF[stand.basis]);
}
// Einen Regler verstellen. Steht er danach auf Standard, wird er aus der Liste genommen.
export function stellen(stand, id, w, DIFF) {
  const r = REGLER.find((x) => x.id === id), neu = pruefe(id, w);
  if (!r || neu === null) return null;
  if (neu === standardVon(r, DIFF[stand.basis])) delete stand.werte[id]; else stand.werte[id] = neu;
  return neu;
}
// Andere Ausgangs-Stufe wählen. Regler, die jetzt genau auf dem neuen Standard stehen, fallen aus der Liste.
export function basisSetzen(stand, basis, DIFF) {
  if (!DIFF[basis]) return;
  stand.basis = basis;
  stand.werte = geaendert(stand.werte, DIFF[basis]);
}
export const anzahl = (stand) => Object.keys(stand.werte).length;

// --- Eigene Stufen ---
// Die Regler von jetzt unter einem Namen aufheben. Gibt es den Namen schon, wird die alte Stufe überschrieben.
export function stufeMerken(stand, name) {
  name = String(name || '').trim().slice(0, 24) || 'Meine Stufe';
  const eintrag = { id: 'e' + Date.now().toString(36), name, basis: stand.basis, werte: { ...stand.werte } };
  const alt = stand.stufen.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
  if (alt >= 0) { eintrag.id = stand.stufen[alt].id; stand.stufen[alt] = eintrag; return eintrag; }
  if (stand.stufen.length >= STUFEN_MAX) return null;
  stand.stufen.push(eintrag);
  return eintrag;
}
export const stufeVon = (stand, id) => stand.stufen.find((e) => e.id === id) || null;
export function stufeHolen(stand, id) {      // eine gespeicherte Stufe zurück auf die Regler legen
  const e = stufeVon(stand, id);
  if (!e) return false;
  stand.basis = e.basis; stand.werte = { ...e.werte };
  return true;
}
export function stufeWeg(stand, id) { stand.stufen = stand.stufen.filter((e) => e.id !== id); }

// Kurze Beschreibung einer Stufe: „Mittel · 4 Regler verstellt“
export function kurzText(e, DIFF) {
  const n = Object.keys(e.werte).length;
  return `${DIFF[e.basis].name} · ${n === 0 ? 'nichts verstellt' : n === 1 ? '1 Regler verstellt' : n + ' Regler verstellt'}`;
}
// Was genau ist anders? „Tempo von Ball und Beinen 115 % (sonst 100 %)“ …
export function unterschiede(e, DIFF) {
  return REGLER.filter((r) => r.id in e.werte).map((r) => `${r.name}: ${zeige(r, e.werte[r.id])} (sonst ${zeige(r, standardVon(r, DIFF[e.basis]))})`);
}

// --- Die Seite ---
function reglerHtml(stand, r, DIFF) {
  const w = wert(stand, r, DIFF), std = standardVon(r, DIFF[stand.basis]), anders = w !== std;
  const kopf = `<div class="lr-kopf"><b>${r.name}</b><span class="lr-wert" data-wert="${r.id}">${zeige(r, w)}</span>
    <button class="ghost lr-std" data-a="laborStd" data-v="${r.id}" title="zurück auf Standard" ${anders ? '' : 'disabled'}>↺ ${zeige(r, std)}</button></div>`;
  const regler = r.art === 'schalter'
    ? `<div class="row"><button class="${w ? 'sel' : ''}" data-a="laborSchalter" data-v="${r.id}:1">An</button><button class="${w ? '' : 'sel'}" data-a="laborSchalter" data-v="${r.id}:0">Aus</button></div>`
    : `<input type="range" data-regler="${r.id}" min="${r.min}" max="${r.max}" step="${r.schritt}" value="${w}" aria-label="${esc(r.name)}">`;
  return `<div class="lr ${anders ? 'anders' : ''}" data-zeile="${r.id}">${kopf}${regler}<p class="dim">${r.text}</p></div>`;
}

export function laborHtml(stand, DIFF, zurueck) {
  const n = anzahl(stand);
  const testen = `<div class="row">
      <button class="primary grow" data-a="laborTest" data-v="match">▶ Kurzes Match</button>
      <button class="grow" data-a="laborTest" data-v="ballmaschine">▶ Ballmaschine</button>
      <button class="grow" data-a="laborTest" data-v="aufschlag">▶ Aufschlag</button></div>`;
  const gruppe = (g) => `<div class="panel labor"><h3>${GRUPPEN[g].name}</h3><p class="dim">${GRUPPEN[g].text}</p>
      ${REGLER.filter((r) => r.gruppe === g).map((r) => reglerHtml(stand, r, DIFF)).join('')}</div>`;
  const stufen = stand.stufen.map((e) => `<div class="lr-stufe"><div><b>${esc(e.name)}</b> <span class="dim">${kurzText(e, DIFF)}</span>
        ${e.werte && Object.keys(e.werte).length ? `<br><small class="dim">${unterschiede(e, DIFF).join(' · ')}</small>` : ''}</div>
      <div class="row"><button data-a="laborHolen" data-v="${e.id}">Auf die Regler legen</button><button class="ghost" data-a="laborWeg" data-v="${e.id}">Löschen</button></div></div>`).join('');
  return `
    <div class="bar">${zurueck}<h2>🔧 Physik-Labor</h2></div>
    <div class="panel">
      <p style="margin-top:0">Hier stellst du selbst ein, wie sich das Spiel anfühlt: Ball, Beine, Gegner. Schieb einen Regler und probier es gleich aus.
        <b>Die Regler gelten nur beim Testen von hier aus</b> und in deinen eigenen Stufen im Freien Spiel. Karriere, Saison und Turnier bleiben, wie sie sind.</p>
      <label>Ausgangs-Stufe (für die Regler „Gegner und Hilfen“)</label>
      <div class="row">${Object.entries(DIFF).map(([k, d]) => `<button class="${stand.basis === k ? 'sel' : ''}" data-a="laborBasis" data-v="${k}">${d.name}</button>`).join('')}</div>
      <label>Ausprobieren</label>
      ${testen}
      <div class="row" style="margin-top:10px"><span class="dim grow" id="laborZahl">${n ? (n === 1 ? '1 Regler ist verstellt.' : n + ' Regler sind verstellt.') : 'Alle Regler stehen auf Standard.'}</span>
        <button data-a="laborAlles" ${n ? '' : 'disabled'}>↺ Alles auf Standard</button></div>
    </div>
    ${Object.keys(GRUPPEN).map(gruppe).join('')}
    <div class="panel labor"><h3>Meine Stufen</h3>
      <p class="dim">Gefällt dir, was du eingestellt hast? Gib der Einstellung einen Namen. Sie erscheint dann im Freien Spiel bei „Schwierigkeit“ (höchstens ${STUFEN_MAX}).</p>
      <div class="row"><input type="text" id="laborName" maxlength="24" placeholder="Name, zum Beispiel: Papa mit Uhr" style="flex:1;min-width:180px">
        <button class="primary" data-a="laborMerken">💾 Als Stufe speichern</button></div>
      ${stufen || '<p class="dim" style="margin-bottom:0">Noch keine eigene Stufe gespeichert.</p>'}
      ${stand.stufen.length ? '<div class="row" style="margin-top:10px"><button data-a="laborDatei">Meine Stufen als Datei sichern</button></div>' : ''}
    </div>
    <div class="panel"><label style="margin-top:0">Ausprobieren</label>${testen}</div>`;
}
