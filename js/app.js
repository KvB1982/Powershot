// Powershot – Hauptprogramm: Menüs, Abläufe (Freies Spiel, Turnier, Karriere, Training), Anzeige im Spiel

import { Sound } from './audio.js';
import { Game3D } from './game3d.js';
import { Controls } from './controls.js';
import { KameraLauf, RAUM } from './kamera.js';
import { KameraBild } from './kamerabild.js';
import { Match } from './match.js';
import { AUFSCHLAEGE, AUFSCHLAG_ARTEN, standardAufschlag } from './schlaege.js';
import { loadFigure } from './figur.js';
import { ladeRequisiten } from './requisiten.js';
import { loadMocap, mocapClip } from './mocap.js';
import { SHOW } from './showschlaege.js';
import * as D from './data.js';
import * as TN from './tournament.js';
import * as CA from './career.js';
import * as TT from './turniertag.js';
import * as GL from './gelaende.js';
import * as AU from './ausruestung.js';
import * as KT from './kleinetour.js';
import * as KA from './kalender.js';
import * as AB from './ausbau.js';
import * as PL from './planer.js';
import * as SE from './season.js';
import { bracketHtml, timelineHtml, raceHtml, pointsHtml } from './saisonansicht.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.round(n).toLocaleString('de-DE') + ' $';
const flag = (c) => D.FLAGS[c] || '🏳️';
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------
const SET_KEY = 'powershot.einstellungen.v1';
const touchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const settings = Object.assign({
  control: touchDevice ? 'touch' : 'klassik', assist: 'voll', difficulty: 'mittel', length: 'kurz',
  sound: true, volume: 0.8, voice: true, quality: 'hoch', figures: 'echt',
  kamera: 'aus', kameraRaum: 'mittel', kameraTauschen: false,
}, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* egal */ } };

const CONTROL_NAMES = { klassik: 'Klassik (Maus)', touch: 'Touch (iPad)', profi: 'Profi (Tastatur)', controller: 'Controller / iPhone-Schläger' };
const KAMERA_NAMES = { aus: 'Aus', seite: 'Nur links und rechts', voll: 'Auch vor und zurück' };
const ASSIST_NAMES = { voll: 'Voll (läuft von allein)', seitlich: 'Nur seitlich', aus: 'Aus (selbst laufen)' };

// ---------------------------------------------------------------
// Grundgerüst
// ---------------------------------------------------------------
const sound = new Sound();
sound.voice = settings.voice;
sound.volume = settings.volume;
sound.enabled = settings.sound;
const game = new Game3D($('#view'), sound);
// Ein Show-Schlag wurde gespielt (nur möglich mit eigener Aufnahme, siehe showschlaege.js): Name einblenden, in der Karriere mitzählen
game.wennShow = (side, id) => {
  const S = SHOW[id];
  if (!S || side !== 0) return;
  hud.message(S.name + '!', 'wichtig');
  if (career && ctxT && ctxT.career) { career.showSchlaege = career.showSchlaege || {}; career.showSchlaege[S.clip] = (career.showSchlaege[S.clip] || 0) + 1; }
};
game.setQuality(settings.quality);
game.realFigures = settings.figures === 'echt';
const controls = new Controls($('#touch'), $('#stick'));
// Laufen mit der Kamera: kameraLauf rechnet (kamera.js), kameraBild holt das Bild und erkennt den Körper (kamerabild.js)
const kameraLauf = new KameraLauf();
const kameraBild = new KameraBild(kameraLauf);
controls.kamera = kameraLauf;
function kameraEinstellen() {
  kameraLauf.art = settings.kamera;
  kameraLauf.raum = settings.kameraRaum;
  kameraLauf.tauschen = !!settings.kameraTauschen;
}
kameraEinstellen();
const screen = $('#screen'), hudEl = $('#hud');

let match = null, paused = false, session = null;
let career = CA.loadCareer();
let season = SE.loadSeason();
let menuVenue = 'ao';

function show(html) { screen.innerHTML = `<div class="wrap">${html}</div>`; screen.classList.add('on'); screen.scrollTop = 0; }
function hide() { screen.classList.remove('on'); screen.innerHTML = ''; }

const actions = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  sound.unlock();
  sound.click();
  const fn = actions[el.dataset.a];
  if (fn) fn(el.dataset.v, el);
});
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && match && session && !session.over) togglePause();
});
$('#pauseBtn').addEventListener('click', () => { sound.unlock(); togglePause(); });
// Die vier Knöpfe für die Aufschlagart (unten in der Mitte). Die Zahl davor ist die Taste auf der Tastatur.
$('#aufschlagWahl').innerHTML = AUFSCHLAG_ARTEN.map((a, i) => `<button data-art="${a}"><small>${i + 1}</small>${AUFSCHLAEGE[a].kurz}</button>`).join('');
$('#aufschlagWahl').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) controls.aufschlagArt = b.dataset.art;
});

// ---------------------------------------------------------------
// Bausteine für die Menüs
// ---------------------------------------------------------------
function statBars(st) {
  return Object.keys(D.STAT_NAMES).map((k) =>
    `<div class="stat"><span>${D.STAT_NAMES[k]}</span><i><b style="width:${st[k]}%"></b></i><span>${st[k]}</span></div>`).join('');
}
// Woran erkennt man den Spieler? Größe, Schlaghand, Rückhand und (bei den Stars) sein Markenzeichen
function stilZeile(p) {
  const teile = [];
  if (p.stil) teile.push((p.stil.groesse / 100).toFixed(2).replace('.', ',') + ' m');
  teile.push(p.hand === -1 ? 'Linkshänder' : 'Rechtshänder');
  if (p.look && p.look.bh === 1) teile.push('einhändige Rückhand');
  return `<div class="stil">${teile.join(' · ')}${p.stil ? `<br><i>${esc(p.stil.merkmal)}</i>` : ''}</div>`;
}
function playerCard(p, act, sel) {
  return `<button class="pcard ${sel ? 'sel' : ''}" data-a="${act}" data-v="${p.id}">
    <div class="nm">${flag(p.country)} ${esc(p.name)}</div>
    <div class="meta"><span>${p.me ? 'Dein Karriere-Spieler' : 'Nr. ' + p.rank}</span><span>Stärke ${D.overall(p.stats)}</span></div>
    ${stilZeile(p)}
    ${statBars(p.stats)}</button>`;
}
function optionRow(label, key, names) {
  return `<label>${label}</label><div class="row">${Object.keys(names).map((k) =>
    `<button class="${settings[key] === k ? 'sel' : ''}" data-a="set" data-v="${key}:${k}">${names[k]}</button>`).join('')}</div>`;
}
const CAT_KLASSE = { GS: 'gs', M: 'm', F: 'f', A500: 'a500', A250: 'a250', CH: 'ch', ITF: 'itf', LIGA: 'itf' };
const catTag = (def) => `<span class="tag ${CAT_KLASSE[def.cat] || 'f'}">${def.catName}</span>`;
// Die 200 Spieler in Seiten zu je 20: Knöpfe "1–20", "21–40" …
const pageOf = (id) => { const p = D.playerById(id); return p ? Math.floor((p.rank - 1) / 20) : 0; };
const pagePlayers = (page) => D.PLAYERS.slice(page * 20, page * 20 + 20);
const pageTabs = (act, page) => `<div class="row tabs">${Array.from({ length: Math.ceil(D.PLAYERS.length / 20) }, (_, i) =>
  `<button class="${i === page ? 'sel' : ''}" data-a="${act}" data-v="${i}">${i ? '' : 'Platz '}${i * 20 + 1}–${i * 20 + 20}</button>`).join('')}</div>`;
const getPlayer = (id) => (id === 'me' ? CA.mePlayer(career) : D.playerById(id));
const back = (to = 'home') => `<button class="ghost" data-a="${to}">‹ Zurück</button>`;

// ---------------------------------------------------------------
// Hauptmenü
// ---------------------------------------------------------------
actions.home = () => {
  session = null;
  enterMenu();
  show(`
    <div class="title"><h1>POWERSHOT</h1><p>Tennis · ATP Tour · Grand Slams · Masters · Finals</p></div>
    <div class="menu">
      <button class="big primary" data-a="free">Freies Spiel <small>Spieler wählen und loslegen</small></button>
      <button class="big" data-a="career">Karriere <small>${career ? esc(career.name) + ' · Platz ' + CA.myRank(career) : 'Eigenen Spieler aufbauen'}</small></button>
      <button class="big" data-a="saison">Saison <small>${season ? esc(SE.seasonPlayer(season).short) + ' · ATP Race Platz ' + SE.myRace(season).rank : 'Mit einem Profi durchs Jahr · ATP Race'}</small></button>
      <button class="big" data-a="tourMenu">Turnier <small>Ein Turnier mit einem Profi spielen</small></button>
      <button class="big" data-a="training">Training <small>Ballmaschine · Aufschlag</small></button>
      <button class="big" data-a="anlage">Turniergelände <small>Wimbledon, New York, Paris … – die echten Anlagen zum Herumlaufen</small></button>
      <div class="row"><button class="grow" data-a="settings" data-v="home">Einstellungen</button><button class="grow" data-a="help" data-v="home">Steuerung</button></div>
    </div>`);
};

function enterMenu() {
  match = null; paused = false;
  controls.enabled = false;
  controls.showStick(false);
  game.detach();
  game.loadVenue(D.tournamentById(menuVenue));
  hudEl.hidden = true;
  sound.setCrowd(0.02);
}

// ---------------------------------------------------------------
// Einstellungen und Hilfe
// ---------------------------------------------------------------
let settingsBack = 'home';
actions.settings = (v) => {
  if (v) settingsBack = v;
  show(`
    <div class="bar">${back(settingsBack)}<h2>Einstellungen</h2></div>
    <div class="panel">
      ${optionRow('Steuerung', 'control', CONTROL_NAMES)}
      <p class="dim" style="margin:6px 0 0;font-size:13px">🎮 ${controls.pad.connected
        ? `Verbunden: ${esc(controls.pad.name)} · ${controls.pad.motion ? 'Schwingen wird erkannt' : 'nur Tasten und Stick (kein Schwingen)'}`
        : 'Kein Controller verbunden. Koppeln: iPad-Einstellungen → Bluetooth, am Joy-Con die kleine runde Taste gedrückt halten.'}</p>
      ${window.webkit?.messageHandlers?.powershot ? `<div class="row" style="margin-top:8px">
        <button data-a="schlaeger">📱 Dieses Gerät als Schläger für ein anderes benutzen</button></div>` : ''}
      <label>Laufen mit der Kamera</label><div class="row">
        <button data-a="kamera" data-v="settings">📷 ${settings.kamera === 'aus' ? 'Aus – einrichten …' : KAMERA_NAMES[settings.kamera] + (kameraLauf.bereit ? ' · eingemessen' : ' · noch einmessen!')}</button></div>
      ${optionRow('Laufhilfe', 'assist', ASSIST_NAMES)}
      ${optionRow('Schwierigkeit', 'difficulty', Object.fromEntries(Object.entries(D.DIFFICULTY).map(([k, d]) => [k, d.name])))}
      ${optionRow('Matchlänge', 'length', Object.fromEntries(Object.entries(D.LENGTHS).map(([k, d]) => [k, d.name])))}
    </div>
    <div class="panel">
      ${optionRow('Ton', 'sound', { true: 'An', false: 'Aus' })}
      ${optionRow('Lautstärke', 'volume', { 0.4: 'Leise', 0.8: 'Normal', 1.2: 'Laut' })}
      ${optionRow('Schiedsrichter spricht', 'voice', { true: 'Ja', false: 'Nein' })}
      ${optionRow('Grafik', 'quality', { hoch: 'Schön', niedrig: 'Schnell (ältere Geräte)' })}
      ${optionRow('Spielerfiguren', 'figures', { echt: 'Realistisch', einfach: 'Einfach' })}
    </div>
    ${window.__powershotVersion ? `<p class="dim" style="font-size:12px">App-Version ${esc(window.__powershotVersion)} – iPad, iPhone und Uhr sollten dieselbe Nummer haben.</p>` : ''}
    <p class="dim">Auf „Leicht“ bleiben deine Bälle immer im Feld, und du schlägst auch ohne Eingabe zurück.
    Auf „Schwer“ und „Profi“ kannst du ins Aus und ins Netz schlagen.</p>`);
};
actions.set = (v) => {
  const [key, raw] = v.split(':');
  let val = raw;
  if (raw === 'true' || raw === 'false') val = raw === 'true';
  else if (key === 'volume') val = parseFloat(raw);
  settings[key] = val;
  saveSettings();
  sound.voice = settings.voice;
  sound.setVolume(settings.volume);
  sound.setEnabled(settings.sound);
  game.setQuality(settings.quality);
  game.realFigures = settings.figures === 'echt';
  if (key === 'quality') game.loadVenue(D.tournamentById(menuVenue));
  if (key === 'control' && match) { controls.setMode(settings.control); match.cfg.controlMode = settings.control; }
  if (key === 'assist' && match) match.cfg.assist = settings.assist;
  actions.settings();
};

// ---------------------------------------------------------------
// Laufen mit der Kamera: einrichten und einmessen
// ---------------------------------------------------------------
let kameraZurueck = 'settings';     // wohin "Zurück" führt
let kameraDanach = null;            // falls ein Match auf die Kamera wartet: das hier startet es danach
let messStart = 0;                  // wann der Countdown zum Einmessen abläuft (0 = keiner)
actions.kamera = (v) => {
  if (v) kameraZurueck = v;
  const an = settings.kamera !== 'aus';
  const wahl = (label, key, names) => `<label>${label}</label><div class="row">${Object.keys(names).map((k) =>
    `<button class="${String(settings[key]) === k ? 'sel' : ''}" data-a="kameraSet" data-v="${key}:${k}">${names[k]}</button>`).join('')}</div>`;
  show(`
    <div class="bar"><button class="ghost" data-a="kameraFertig" data-v="zurueck">‹ Zurück</button><h2>Laufen mit der Kamera</h2></div>
    <div class="panel">
      <p class="dim" style="margin-top:0">Die Kamera schaut dir zu: Gehst du im Zimmer nach rechts, läuft dein Spieler nach rechts.
        Geschlagen wird wie sonst auch (Uhr, Controller, Maus …). Das Bild bleibt auf diesem Gerät und wird nicht gespeichert.</p>
      ${wahl('Kamera steuert', 'kamera', KAMERA_NAMES)}
      ${an ? wahl('Wie viel Platz hast du nach jeder Seite?', 'kameraRaum', Object.fromEntries(Object.entries(RAUM).map(([k, r]) => [k, r.name]))) : ''}
    </div>
    ${an ? `<div class="panel">
      <div class="kameraZeile"><canvas id="kameraVorschau" width="480" height="360"></canvas><canvas id="kameraPlatz" width="150" height="360"></canvas></div>
      <p id="kameraText" class="center" style="min-height:2.6em;font-weight:700"></p>
      <div class="row" style="justify-content:center">
        <button class="primary" data-a="kameraMessen">🎯 Einmessen</button>
        <button data-a="kameraSet" data-v="kameraTauschen:${!settings.kameraTauschen}">⇄ Links und rechts tauschen</button>
        <button data-a="kameraWechseln">📷 Andere Kamera</button>
      </div>
      <p class="dim" style="font-size:13px;margin-bottom:0">So geht es: Stell das Gerät unter oder neben den Fernseher. Geh 2 bis 3 Meter zurück, bis du
        vom Kopf bis zur Hüfte im Bild bist. Drück „Einmessen“ und stell dich in die Mitte – dort ist die Mitte der Grundlinie.
        Es darf nur eine Person im Bild sein.</p>
    </div>` : ''}
    <div class="center"><button class="primary" data-a="kameraFertig">${kameraDanach ? 'Los geht’s!' : 'Fertig'}</button></div>`);
  if (an && kameraBild.status === 'aus') kameraBild.start(kameraBild.kameraId);
};
actions.kameraSet = (v) => {
  const [key, raw] = v.split(':');
  settings[key] = raw === 'true' ? true : raw === 'false' ? false : raw;
  saveSettings();
  kameraEinstellen();
  if (settings.kamera === 'aus') kameraBild.stop();
  actions.kamera();
};
// Einmessen: erst 3 Sekunden Zeit, um sich hinzustellen, dann misst kamera.js kurz die Mitte aus.
actions.kameraMessen = () => { kameraLauf.mitte = null; messStart = performance.now() + 3000; };
actions.kameraWechseln = () => kameraBild.naechste();
actions.kameraFertig = (v) => {
  messStart = 0;
  const danach = kameraDanach;
  kameraDanach = null;
  if (danach && v !== 'zurueck') return danach();
  if (danach) { kameraBild.stop(); return actions.home(); }      // doch nicht spielen: zurück ins Hauptmenü
  if (hudEl.hidden) kameraBild.stop();          // im Menü braucht niemand die Kamera – das Lämpchen geht aus
  actions[kameraZurueck]();
};

// Läuft bei jedem Bild mit: Vorschau, kleiner Platz und Hinweistext auf dem Kamera-Bildschirm
function kameraFrame() {
  const vorschau = $('#kameraVorschau');
  if (!vorschau) return;
  const jetzt = performance.now();
  if (messStart && jetzt >= messStart) { messStart = 0; kameraLauf.einmessen(); }
  kameraBild.zeichne(vorschau);
  const ziel = kameraLauf.ziel(jetzt / 1000);
  kameraPlatz($('#kameraPlatz'), ziel);
  let text;
  if (kameraBild.status === 'startet') text = 'Kamera startet … (beim ersten Mal wird die Körpererkennung geladen, etwa 20 MB)';
  else if (kameraBild.status === 'fehler') text = '⚠️ ' + kameraBild.fehler;
  else if (kameraBild.status !== 'an') text = 'Die Kamera ist aus.';
  else if (messStart) text = `Stell dich in die Mitte … ${Math.ceil((messStart - jetzt) / 1000)}`;
  else if (kameraLauf.sammeln) text = kameraLauf.gesehen ? 'Stillhalten …' : 'Ich sehe dich nicht ganz – Schultern und Hüfte müssen im Bild sein.';
  else if (!kameraLauf.bereit) text = 'Bist du vom Kopf bis zur Hüfte im Bild? Dann drück „Einmessen“.';
  else if (!ziel) text = 'Ich sehe dich gerade nicht.';
  else text = '✅ Eingemessen! Geh nach links und rechts – der gelbe Punkt ist dein Spieler.';
  const el = $('#kameraText');
  if (el.textContent !== text) el.textContent = text;
}

// Zeichnet deine Platzhälfte von oben (Netz oben, Grundlinie unten) und deinen Spieler als gelben Punkt.
function kameraPlatz(flaeche, ziel) {
  const g = flaeche.getContext('2d'), w = flaeche.width, h = flaeche.height;
  const L = 11.885, B = 4.115;                          // Länge einer Platzhälfte und halbe Breite des Einzelfelds (Meter)
  const px = (x) => w / 2 + x * (w / 13), pz = (z) => 14 + z * ((h - 28) / (L + 3.2));
  g.fillStyle = '#1d5c8a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.strokeRect(px(-B), pz(0), px(B) - px(-B), pz(L) - pz(0));
  g.beginPath(); g.moveTo(px(-B), pz(6.4)); g.lineTo(px(B), pz(6.4)); g.moveTo(px(0), pz(0)); g.lineTo(px(0), pz(6.4)); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(px(-B) - 6, pz(0)); g.lineTo(px(B) + 6, pz(0)); g.stroke();       // das Netz
  if (!ziel) return;
  const vor = ziel.vor === null ? 0 : ziel.vor;
  const z = vor >= 0 ? L + 0.7 + (3.2 - L - 0.7) * vor : L + 0.7 - vor * 2.5;
  g.fillStyle = '#ffd34a';
  g.beginPath(); g.arc(px(Math.max(-6.2, Math.min(6.2, ziel.x))), pz(z), 8, 0, 7); g.fill();
}

// Im Spiel: ein kleines Kamerabild unten links, damit man sieht, ob man noch im Bild ist (grüner Rand = alles gut).
let miniZeit = 0;
function kameraMini(dt) {
  const el = $('#kameraMini');
  const an = settings.kamera !== 'aus' && kameraBild.status === 'an';
  el.classList.toggle('on', an);
  if (!an || (miniZeit += dt) < 0.1) return;            // zehnmal pro Sekunde reicht
  miniZeit = 0;
  kameraBild.zeichne(el);
  el.classList.toggle('weg', !kameraLauf.ziel(performance.now() / 1000));
}

const HELP = `
  <div class="panel help"><h3>Touch (iPad / Handy)</h3><ul>
    <li><b>Linke Bildschirmhälfte:</b> Finger auflegen und ziehen = laufen (Joystick). Ohne Finger läuft dein Spieler von allein zum Ball.</li>
    <li><b>Rechte Hälfte, nach oben wischen:</b> Schlag. Nach links/rechts wischen = Richtung. Je länger der Wisch, desto härter und tiefer. Zu lang = Aus!</li>
    <li><b>Nach unten wischen:</b> Stoppball. <b>Zur Seite wischen:</b> Slice. <b>Doppelt tippen:</b> Lob. <b>Einmal tippen:</b> sicherer Ball.</li>
    <li><b>Aufschlag:</b> nach oben wischen (Richtung und Länge wie beim Schlag). Vorher unten die Art antippen: Gerade, Slice, Kick oder Von unten.</li>
    <li>Du kannst wischen, sobald der Gegner geschlagen hat. Der Schlag kommt, wenn der Ball bei dir ist.</li></ul></div>
  <div class="panel help"><h3>Klassik (Maus)</h3><ul>
    <li><kbd>Mausrad</kbd> oder <kbd>←</kbd> <kbd>→</kbd>: zielen (Rad hoch = links).</li>
    <li><kbd>Linke Maustaste halten</kbd>: Kraft aufladen. Im roten Bereich geht der Ball ins Aus.</li>
    <li><kbd>Doppelklick</kbd> oder <kbd>rechte Maustaste</kbd>: Lob.</li>
    <li><kbd>↑</kbd> <kbd>↓</kbd>: ans Netz / zurück. Seitlich läuft dein Spieler von allein.</li>
    <li><b>Aufschlag:</b> Kraft aufladen und loslassen. Art wählen mit <kbd>1</kbd> Gerade · <kbd>2</kbd> Slice · <kbd>3</kbd> Kick · <kbd>4</kbd> Von unten (oder unten anklicken).</li></ul></div>
  <div class="panel help"><h3>Profi (Tastatur)</h3><ul>
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten: laufen. Stell die Laufhilfe auf „Aus“ für das volle Erlebnis.</li>
    <li><kbd>Leertaste</kbd>/<kbd>J</kbd>: Topspin · <kbd>K</kbd>: Slice · <kbd>L</kbd>: Lob · <kbd>I</kbd>: Stoppball. Halten = mehr Kraft.</li>
    <li><kbd>U</kbd>: gerader Schuss (sehr schnell und flach, aber riskant) · <kbd>O</kbd>: hoher Topspin (sicher, springt hoch weg).</li>
    <li>Die Richtungstasten, die du <b>beim Treffen</b> hältst, bestimmen das Ziel: links/rechts = Ecke, hoch = lang, runter = kurz.</li>
    <li><b>Aufschlag:</b> Leertaste halten und loslassen, mit links/rechts zielen. Zu lange halten = Fehler.
      <kbd>J</kbd> = gerade · <kbd>K</kbd> = Slice · <kbd>L</kbd> = Kick · <kbd>I</kbd> = von unten. Mit der Leertaste kommt der erste Aufschlag gerade, der zweite als Kick.</li></ul></div>
  <div class="panel help"><h3>Controller (Switch Joy-Con / Pro Controller)</h3><ul>
    <li>Erst koppeln (Bluetooth), dann in den Einstellungen bei „Steuerung“ den Controller wählen.</li>
    <li><b>Schwingen</b> (nur in der iPad-/iPhone-App): Schwing den Joy-Con wie einen Schläger, wenn der Ball bei dir ist.
      Stärker schwingen = härterer Schlag. Von oben nach unten = Slice.</li>
    <li><kbd>A</kbd>: Topspin · <kbd>B</kbd>: Slice · <kbd>X</kbd>: Lob · <kbd>Y</kbd>: Stoppball.</li>
    <li><b>Stick:</b> laufen. Die Richtung, die du <b>beim Treffen</b> hältst, bestimmt das Ziel.</li>
    <li><b>Aufschlag:</b> schwingen oder <kbd>A</kbd> drücken (erster gerade, zweiter Kick). <kbd>B</kbd> = Slice · <kbd>X</kbd> = Kick · <kbd>Y</kbd> = von unten. <kbd>+</kbd>: Pause.</li>
    <li><b>Ans Netz und zurück:</b> Mit der Apple Watch zweimal kurz die Hände aneinander klopfen. Auf dem iPhone-Schläger-Bildschirm
      gibt es dafür die Taste „Netz“. Dasselbe noch einmal bringt dich zurück an die Grundlinie.</li>
    <li><b>iPhone als Schläger fürs iPad</b> (in der App): Auf dem iPad „Controller / iPhone-Schläger“ wählen.
      Auf dem iPhone Powershot öffnen → Einstellungen → „Dieses Gerät als Schläger … benutzen“. Die Geräte finden sich von selbst.</li>
    <li><b>iPhone als Schläger</b> (in der App): Halte das iPhone fest in der Hand und schwing es wie einen Schläger.
      <b>Timing = Richtung:</b> früh schwingen = Ball nach links, genau richtig = Mitte, spät = nach rechts.
      Aufschlag und Schmetterball (hoher Ball): von oben nach unten schwingen.
      Lass am besten die Laufhilfe auf „Voll“. Achtung: gut festhalten, am besten mit Hülle!</li></ul></div>
  <div class="panel help"><h3>Laufen mit der Kamera (Webcam oder Kamera vom iPad)</h3><ul>
    <li>Einstellungen → „Laufen mit der Kamera“. Die Kamera schaut dir zu und dein Spieler läuft dorthin, wo du im Zimmer stehst.</li>
    <li><b>Einmessen:</b> Stell dich 2 bis 3 Meter vor die Kamera in die Mitte. Kopf bis Hüfte müssen im Bild sein, und nur eine Person.</li>
    <li>Ein Schritt im Zimmer sind mehrere Meter auf dem Platz. Wie viele, stellst du bei „Wie viel Platz hast du?“ ein.</li>
    <li><b>Auch vor und zurück:</b> Ein Schritt auf die Kamera zu = ans Netz. Das klappt nicht ganz so genau wie links und rechts.</li>
    <li>Bist du nah genug am Ball, macht dein Spieler den letzten Schritt allein (außer bei Laufhilfe „Aus“).</li>
    <li>Geschlagen wird wie sonst: mit Uhr, iPhone-Schläger, Controller, Maus oder Tastatur.</li></ul></div>
  <div class="panel help"><h3>Was die Schläge mit dem Ball machen</h3><ul>
    <li><b>Topspin:</b> Der Ball dreht nach vorne. Er fällt von selbst ins Feld und springt hoch und schnell weg.</li>
    <li><b>Hoher Topspin:</b> noch mehr Drall, hoch über das Netz – sehr sicher, springt dem Gegner bis zur Schulter.</li>
    <li><b>Gerader Schuss:</b> kaum Drall, sehr schnell und knapp über das Netz. Bleibt flach, geht aber leichter ins Netz oder ins Aus.</li>
    <li><b>Slice:</b> Der Ball dreht rückwärts. Er schwebt lange, wird beim Aufkommen gebremst und bleibt flach.</li>
    <li><b>Stoppball:</b> ganz kurz hinter das Netz, mit viel Rückwärtsdrall – er bleibt fast liegen.</li>
    <li><b>Aufschlag gerade:</b> der schnellste, aber er geht am häufigsten daneben.</li>
    <li><b>Aufschlag Slice:</b> fliegt eine Kurve zur Seite und zieht den Gegner aus dem Feld.</li>
    <li><b>Aufschlag Kick:</b> langsamer und sehr sicher. Geht hoch über das Netz und springt hoch und zur Seite weg – gut als zweiter Aufschlag.</li>
    <li><b>Aufschlag von unten:</b> kurz und langsam – eine Überraschung, wenn der Gegner weit hinten steht.</li>
    <li>Auf <b>Sand</b> springt der Ball höher und wird stärker gebremst, auf <b>Rasen</b> bleibt er flach und schnell.</li></ul></div>
  <p class="dim"><kbd>P</kbd> oder <kbd>Esc</kbd> = Pause. Der gelbe Ring zeigt, wo der Ball des Gegners landet. Der orange Ring ist dein Ziel.</p>`;
let helpBack = 'home';
actions.help = (v) => { if (v) helpBack = v; show(`<div class="bar">${back(helpBack)}<h2>Steuerung</h2></div>${HELP}`); };

// ---------------------------------------------------------------
// Freies Spiel
// ---------------------------------------------------------------
const free = { me: 'zverev', opp: 'zufall', venue: 'ao', page: 0, oppPage: 0 };
actions.free = () => {
  if (free.me === 'me' && !career) free.me = 'zverev';
  const list = pagePlayers(free.page);
  if (career) list.unshift(CA.mePlayer(career));
  const chosen = getPlayer(free.me), chosenOpp = free.opp === 'zufall' ? null : getPlayer(free.opp);
  show(`
    <div class="bar">${back()}<h2>Freies Spiel</h2><button class="primary" data-a="freeStart">Match starten ›</button></div>
    <div class="panel"><h3 style="margin-top:0">Stadion</h3><div class="row">
      ${D.TOURNAMENTS.map((t) => `<button class="${free.venue === t.id ? 'sel' : ''}" data-a="freeVenue" data-v="${t.id}">${t.name}<br><small class="dim">${D.SURFACE_NAMES[t.surface]}</small></button>`).join('')}
    </div></div>
    <div class="panel"><h3 style="margin-top:0">Dein Spieler: ${esc(chosen.name)}</h3>${pageTabs('freePage', free.page)}<div class="grid">${list.map((p) => playerCard(p, 'freeMe', free.me === p.id)).join('')}</div></div>
    <div class="panel"><h3 style="margin-top:0">Gegner: ${chosenOpp ? esc(chosenOpp.name) : 'Zufall'}</h3>${pageTabs('freeOppPage', free.oppPage)}<div class="grid small">
      <button class="${free.opp === 'zufall' ? 'sel' : ''}" data-a="freeOpp" data-v="zufall">🎲 Zufall</button>
      ${pagePlayers(free.oppPage).map((p) => `<button class="${free.opp === p.id ? 'sel' : ''}" data-a="freeOpp" data-v="${p.id}">${flag(p.country)} ${esc(p.short)} <small class="dim">${D.overall(p.stats)}</small></button>`).join('')}
    </div></div>
    <div class="row"><button class="primary grow" data-a="freeStart">Match starten ›</button><button data-a="settings" data-v="free">Einstellungen</button></div>`);
};
actions.freePage = (v) => { free.page = +v; keepScroll(actions.free); };
actions.freeOppPage = (v) => { free.oppPage = +v; keepScroll(actions.free); };
actions.freeMe = (v) => { free.me = v; keepScroll(actions.free); };
actions.freeOpp = (v) => { free.opp = v; keepScroll(actions.free); };
actions.freeVenue = (v) => { free.venue = v; menuVenue = v; game.loadVenue(D.tournamentById(v)); keepScroll(actions.free); };
function keepScroll(fn) { const y = screen.scrollTop; fn(); screen.scrollTop = y; }
actions.freeStart = () => {
  const me = getPlayer(free.me);
  const opp = free.opp === 'zufall' ? pick(pagePlayers(free.oppPage).filter((p) => p.id !== free.me)) : getPlayer(free.opp);
  startMatch({ me, opp, def: D.tournamentById(free.venue), title: 'Freies Spiel', onEnd: () => actions.free() });
};

// ---------------------------------------------------------------
// Training
// ---------------------------------------------------------------
actions.training = (v) => {
  const fromCareer = v === 'career';
  show(`
    <div class="bar">${back(fromCareer ? 'career' : 'home')}<h2>Training</h2></div>
    ${fromCareer ? `<p class="dim">Noch ${career.trainingLeft} Trainingseinheiten vor dem nächsten Turnier. Training bringt Erfahrung.</p>` : ''}
    <div class="menu">
      <button class="big" data-a="train" data-v="ballmaschine${fromCareer ? ':c' : ''}">Ballmaschine <small>20 Bälle – triff die Zielfelder</small></button>
      <button class="big" data-a="train" data-v="aufschlag${fromCareer ? ':c' : ''}">Aufschlag <small>12 Aufschläge auf die Zielfelder</small></button>
    </div>`);
};
actions.train = (v) => {
  const [mode, c] = v.split(':');
  const inCareer = c === 'c' && career;
  const me = inCareer ? CA.mePlayer(career) : getPlayer(free.me === 'me' && !career ? 'zverev' : free.me);
  const trainer = { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' };
  startMatch({
    me, opp: trainer, def: D.tournamentById(inCareer ? CA.nextTournament(career).id : free.venue), mode, title: 'Training',
    onEnd: (res) => {
      if (inCareer && !res.aborted) {
        career.trainingLeft = Math.max(0, career.trainingLeft - 1);
        const xp = Math.min(90, res.training.score * 2);
        const ups = CA.addXp(career, xp);
        return showInfo('Training beendet', `${res.training.score} Punkte · +${xp} Erfahrung${ups ? ' · Level ' + career.level + '! Du hast neue Fähigkeitspunkte.' : ''}`, 'career');
      }
      actions.training(inCareer ? 'career' : '');
    },
  });
};

function showInfo(title, text, next) {
  show(`<div class="panel modal"><h2>${esc(title)}</h2><p class="center">${text}</p>
    <div class="center"><button class="primary" data-a="${next}">Weiter</button></div></div>`);
}

// ---------------------------------------------------------------
// Einzelnes Turnier
// ---------------------------------------------------------------
const tour = { def: 'wim', me: 'alcaraz', page: 0 };
actions.tourMenu = () => {
  show(`
    <div class="bar">${back()}<h2>Turnier</h2><button class="primary" data-a="tourStart">Turnier starten ›</button></div>
    <div class="panel"><h3 style="margin-top:0">Turnier</h3><div class="row">
      ${D.TOURNAMENTS.map((t) => `<button class="${tour.def === t.id ? 'sel' : ''}" data-a="tourDef" data-v="${t.id}">${t.name}<br>${catTag(t)}</button>`).join('')}
    </div></div>
    <div class="panel"><h3 style="margin-top:0">Dein Spieler: ${esc(getPlayer(tour.me).name)}</h3>${pageTabs('tourPage', tour.page)}<div class="grid">${pagePlayers(tour.page).map((p) => playerCard(p, 'tourMe', tour.me === p.id)).join('')}</div></div>`);
};
actions.tourDef = (v) => { tour.def = v; menuVenue = v; game.loadVenue(D.tournamentById(v)); keepScroll(actions.tourMenu); };
actions.tourPage = (v) => { tour.page = +v; keepScroll(actions.tourMenu); };
actions.tourMe = (v) => { tour.me = v; keepScroll(actions.tourMenu); };
actions.baumTeil = (v) => { baumTeil = +v; keepScroll(renderTournament); };
actions.tourStart = () => {
  baumTeil = null;
  const def = D.tournamentById(tour.def);
  let list = D.PLAYERS.slice(0, def.draw);
  if (!list.some((p) => p.id === tour.me)) list = [...list.slice(0, def.draw - 1), getPlayer(tour.me)].sort((a, b) => a.rank - b.rank);
  ctxT = { T: TN.createTournament(def, list, tour.me), def, career: false, exit: 'home' };
  renderTournament();
};

// Gemeinsame Turnier-Ansicht (einzelnes Turnier und Karriere)
let ctxT = null;
let baumTeil = null;      // welches Achtel eines großen Turnierbaums man sich gerade ansieht (null = das eigene)
function renderTournament() {
  const { T, def } = ctxT;
  menuVenue = def.id;
  enterMenu();
  const m = TN.humanMatch(T);
  const label = TN.currentLabel(T);
  let top;
  if (T.done) {
    const pay = T.humanId ? TN.payout(T, T.humanId) : null;
    // Hast du selbst gewonnen, gibt es einen Pokal zum Ansehen (kein Pokal beim Liga-Spiel)
    const meinPokal = T.champion === T.humanId && def.cat !== 'LIGA';
    top = `<div class="panel center">${meinPokal ? '<canvas id="pokal" class="pokal3d" width="400" height="500"></canvas>' : ''}<h2 class="gold">🏆 ${esc(T.players[T.champion].name)}</h2>
      <p>gewinnt ${def.name}${T.champion === T.humanId ? ' – das bist du! Glückwunsch!' : '.'}</p>
      ${pay && pay.label && def.cat !== 'LIGA' ? `<p class="dim">Dein Ergebnis: ${D.ROUND_NAMES[pay.label]}</p>` : ''}
      <button class="primary" data-a="tourDone">Weiter</button></div>`;
  } else if (m && ctxT.career && career.abendOffen && def.cat !== 'LIGA') {
    // Nach einem Sieg: Was machst du am Abend? (Liste ABEND in turniertag.js)
    top = `<div class="panel"><h3 style="margin-top:0">🌙 Der Abend nach deinem Sieg</h3><p class="dim">Morgen geht das Turnier für dich weiter. Was machst du heute Abend noch?</p>
      <div class="row">${Object.entries(TT.ABEND).map(([id, A]) => `<button data-a="abend" data-v="${id}">${A.name} <small>${A.bringt}</small></button>`).join('')}</div></div>`;
  } else if (m) {
    const oppId = m.a === T.humanId ? m.b : m.a;
    const opp = getPlayer(oppId), me = getPlayer(T.humanId);
    top = `<div class="panel"><div class="center dim">${def.cat === 'LIGA' ? 'Liga-Spiel' : D.ROUND_NAMES[label]}${m.group != null ? ' · Gruppe ' + 'AB'[m.group] : ''}</div>
      <div class="vs"><div><div class="who">${flag(me.country)} ${esc(me.short)}</div><div class="dim">Stärke ${D.overall(me.stats)}</div></div>
      <div class="x">gegen</div>
      <div><div class="who">${flag(opp.country)} ${esc(opp.short)}</div><div class="dim">${def.cat === 'LIGA' ? 'Spieler des anderen Vereins' : T.players[oppId].seed ? 'Nr. ' + T.players[oppId].seed + ' der Setzliste' : 'nicht gesetzt'} · Stärke ${D.overall(opp.stats)}</div></div></div>
      <div class="center">${ctxT.career && def.cat !== 'LIGA' ? `<button data-a="tagAnlage">🚶 Erst auf die Anlage <small>${career.tag ? `noch ${TT.freieFenster(career)} Zeitfenster` : `${TT.fensterVon(def)} Zeitfenster vor dem Match`}</small></button> ` : ''}<button class="primary" data-a="tourPlay">Match spielen ›</button></div></div>`;
  } else {
    top = `<div class="panel center"><p>${T.humanId ? 'Du bist ausgeschieden.' : 'Du spielst dieses Turnier nicht mit.'}</p>
      <button class="primary" data-a="tourSim">Turnier zu Ende spielen lassen</button></div>`;
  }
  // In der Saison kommt man vom Turnier zurück zur Übersicht (das Turnier bleibt gespeichert)
  const zurueck = ctxT.season ? '<button class="ghost" data-a="saison" data-v="start">‹ Saison</button>' : '';
  show(`<div class="bar">${zurueck}<h2>${def.name} ${catTag(def)}</h2><span class="dim">${def.city} · ${D.SURFACE_NAMES[def.surface]}</span></div>${top}${bracketHtml(T, def, baumTeil)}`);
  // Pokal nach einem eigenen Turniersieg: Grand Slam = Silberpokal, ATP Finals = Stern, alle anderen = Goldpokal
  const pokalBild = document.getElementById('pokal');
  if (pokalBild) game.pokalZeigen(pokalBild, def.cat === 'GS' ? 'silber' : def.cat === 'F' ? 'stern' : 'gold');
  // Den Baum so hinschieben, dass man die aktuelle Runde sieht
  // (links daneben bleibt die Runde davor stehen, damit man sieht, woher die Spieler kommen)
  const cur = screen.querySelector('.bcol.curcol'), box = screen.querySelector('.bscroll');
  if (cur && box) {
    const ab = cur.previousElementSibling || cur;
    box.scrollLeft = ab.getBoundingClientRect().left - box.querySelector('.bracket').getBoundingClientRect().left;
  }
}
actions.tourPlay = () => {
  const { T, def } = ctxT;
  const m = TN.humanMatch(T);
  const oppId = m.a === T.humanId ? m.b : m.a;
  const roundIdx = T.rounds.length;
  startMatch({
    me: getPlayer(T.humanId), opp: getPlayer(oppId), def, title: def.cat === 'LIGA' ? def.name : `${def.name} · ${D.ROUND_NAMES[TN.currentLabel(T)]}`,
    finale: def.cat !== 'LIGA' && TN.currentLabel(T) === 'F',
    onEnd: (res) => {
      TN.playRound(T, { winner: res.won ? T.humanId : oppId, score: res.score, setDiff: res.setDiff });
      if (ctxT.season) SE.saveSeason(season);
      let danach = renderTournament;
      if (ctxT.career) {
        // Müde werden, Saiten abnutzen, Erfahrung sammeln
        const ups = CA.matchGespielt(career, res.won, roundIdx);
        CA.saveCareer(career);
        if (ups) danach = () => showInfo('Level ' + career.level + '!', 'Du hast 3 neue Fähigkeitspunkte bekommen. Verteile sie im Karriere-Menü unter „Fähigkeiten“.', 'tourShow');
      }
      // Finale gewonnen? Dann gibt es zuerst die Siegerehrung im Stadion (nicht beim Liga-Spiel).
      if (T.done && T.champion === T.humanId && def.cat !== 'LIGA') return siegerehrung(getPlayer(oppId), danach);
      danach();
    },
  });
};
actions.tourShow = () => renderTournament();
actions.abend = (v) => {
  const r = TT.abend(career, v);
  if (!r) return renderTournament();
  showInfo(TT.ABEND[v].name, `${r.text}<br><b class="gold">${r.bringt.join(' · ')}</b>`, 'tourShow');
};

// ---------------------------------------------------------------
// Turnieranlage (Probe): herumlaufen, entweder durch Antippen oder selbst gesteuert
// ---------------------------------------------------------------
// Die Anlage selbst steht in anlage.js. Hier sind nur die Knöpfe oben und das Fenster unten.
const anlageEl = document.createElement('div');
anlageEl.id = 'anlage';
document.body.appendChild(anlageEl);
let anlageTag = null;        // { def } wenn die Anlage gerade der Tag vor einem Karriere-Match ist, sonst null
let anlageWo = 'wim';        // welches Gelände man sich im Hauptmenü ansieht (Kürzel des Turniers)
let anlageListe = false;     // ist die Liste „Gelände wechseln“ gerade aufgeklappt?
// Welches Gelände wird gerade gezeigt? Die großen Turniere haben ihr eigenes, die kleinen die einfache Anlage (null).
const anlageGelaende = () => (anlageTag ? (GL.gelaendeVon(anlageTag.def.id) ? anlageTag.def.id : null) : anlageWo);
let anlageErgebnis = null;   // was die letzte Tätigkeit gebracht hat: { ort, text, bringt }
let anlageMeldung = null;    // was nach einem Zufall (Ereignis) passiert ist: { text, bringt }
let kraftSpiel = null;       // läuft gerade das Spiel im Kraftraum? { n, treffer, mitte, start, uhr, letzter }
// Wo steht der Zeiger im Kraftraum-Spiel gerade? (0 = ganz links, 1 = ganz rechts; er läuft hin und her)
const kraftZeiger = () => 0.5 - 0.5 * Math.cos(2 * Math.PI * (performance.now() - kraftSpiel.start) / 1000 / TT.KRAFT_SPIEL.dauer);
function kraftEnde() { if (kraftSpiel) clearInterval(kraftSpiel.uhr); kraftSpiel = null; }
function anlageZeigen() {
  const A = game.anlage, ort = A.amOrt;
  const hilfe = 'Laufen: W A S D oder mit einem Finger ziehen. Tippe auf ein Gebäude, dann läuft deine Figur von selbst hin. Kamera: Knöpfe rechts, zwei Finger oder rechte Maustaste.';
  const kam = [['karte', '🗺️', 'Übersicht'], ['links', '⟲', 'Kamera nach links drehen'], ['rechts', '⟳', 'Kamera nach rechts drehen'], ['nah', '＋', 'näher'], ['fern', '－', 'weiter weg']];
  let unten = `<p class="dim">${hilfe}</p>`, zeit = '';
  if (anlageTag) {
    // Der Tag vor dem Match: oben steht, wie viel Zeit noch ist
    const frei = TT.freieFenster(career);
    zeit = `<span class="zeit">${esc(anlageTag.def.name)} · ${TT.fensterName(career)} · ${frei ? `noch ${frei} Zeitfenster` : 'dein Match beginnt gleich'} · Frische ${Math.round(career.frische)}</span>`;
    const court = A.orte.find((o) => o.id === 'court');
    unten = `<p class="dim">${frei ? 'Such dir aus, was du vor dem Match machst. Für alles reicht die Zeit nicht!' : `Die Zeit ist um. Geh zum <b>${esc(court ? court.name : 'Centre Court')}</b> – dort wartet dein Match.`}</p>`;
  }
  // Auf einem großen Gelände: oben steht, wo man ist, und unten gibt es Knöpfe zum Hinlaufen (die Wege sind lang)
  const G = A.plan ? A.plan.g : null;
  let wohin = '';
  if (G) {
    if (!anlageTag) {
      zeit = `<span class="zeit">${esc(G.name)} · <span class="dim">${esc(G.stadt)}</span></span><button data-a="anlageListe">🌍 Gelände wechseln</button>`;
      unten = anlageListe
        ? `<h3>Welches Turniergelände möchtest du sehen?</h3><div class="row wahl">${GL.GELAENDE_LISTE.map((id) => `<button class="${id === anlageWo ? 'primary' : ''}" data-a="anlageWahlOrt" data-v="${id}">${esc(D.tournamentById(id).name)} <small>${esc(GL.GELAENDE[id].name)}</small></button>`).join('')}</div>`
        : `<p class="dim">Dieses Gelände ist dem echten nachempfunden. Lauf herum und sieh dir alles an – an den blauen Kreisen ℹ️ erfährst du etwas über den Ort. ${hilfe}</p>`;
    }
    const knopf = (o) => `<button data-a="anlageGeh" data-v="${o.id}">${o.info ? 'ℹ️ ' : ''}${esc(o.name)}</button>`;
    wohin = `<div class="wohin"><span class="dim">Hinlaufen:</span> ${A.orte.filter((o) => !o.info && o.id !== 'hotel').map(knopf).join('')}${A.orte.filter((o) => o.info).map(knopf).join('')}</div>`;
  }
  const E = anlageTag ? TT.ereignis(career) : null;
  if (E) {
    // Heute ist etwas Besonderes passiert: erst entscheiden, dann geht der Tag weiter
    unten = `<h3>${E.bild} Heute Morgen …</h3><p>${esc(E.text)}</p><div class="row">${E.wahl.map((w, i) => `<button class="${i ? '' : 'primary'}" data-a="tagEreignis" data-v="${i}">${esc(w[0])}</button>`).join('')}</div>`;
  } else if (anlageMeldung && !ort) {
    unten = `<p>${esc(anlageMeldung.text)}</p>${anlageMeldung.bringt.length ? `<p class="gold">${anlageMeldung.bringt.join(' · ')}</p>` : ''}<p class="dim">Und jetzt: Such dir aus, was du vor dem Match machst.</p>`;
  } else if (ort) {
    unten = `<h3>${esc(ort.name)}</h3><p>${ort.text}</p>${ort.info || G ? '' : '<p class="dim klein">Hier passiert noch nichts. Später gehst du hier hinein.</p>'}`;
    if (G && !ort.info && !anlageTag) unten += `<p class="dim klein">${esc({ court: 'In der Karriere spielst du hier dein Match.', hotel: 'In der Karriere bringt dich der Fahrdienst nach dem Match ins Hotel.' }[ort.id] || 'In der Karriere kannst du hier am Tag vor dem Match etwas tun.')}</p>`;
    const T = TT.TAETIGKEITEN[ort.id];
    if (anlageTag && kraftSpiel && ort.id === 'kraft') {
      // Kraftraum-Spiel: Der Zeiger läuft hin und her. Drücken, wenn er im grünen Feld ist.
      const K = TT.KRAFT_SPIEL, b = K.breite[kraftSpiel.n];
      unten = `<h3>${esc(ort.name)} · Wiederholung ${kraftSpiel.n + 1} von ${K.wdh}</h3>
        <p>${kraftSpiel.letzter == null ? 'Drücke, wenn der Zeiger im grünen Feld steht. So hebst du das Gewicht sauber.' : kraftSpiel.letzter ? '<b class="plus">Sauber gehoben!</b>' : '<b class="minus">Verwackelt!</b>'} <span class="dim">Sauber: ${kraftSpiel.treffer}</span></p>
        <div class="kraftbalken"><i style="left:${(kraftSpiel.mitte - b / 2) * 100}%;width:${b * 100}%"></i><b id="kraftzeiger"></b></div>
        <button class="primary" data-a="kraftDruck">🏋️ Jetzt heben!</button>`;
    } else if (anlageTag && anlageErgebnis && anlageErgebnis.ort === ort.id) {
      unten = `<h3>${esc(ort.name)}</h3><p>${anlageErgebnis.text}</p><p class="gold">${anlageErgebnis.bringt.join(' · ')}</p>`;
    } else if (anlageTag && ort.id === 'court') {
      unten = `<h3>${esc(ort.name)}</h3><p>Dein Gegner wartet schon. Bist du bereit?</p><button class="primary" data-a="anlageMatch">Match spielen ›</button>`;
    } else if (anlageTag && ort.id === 'hotel') {
      unten = `<h3>${esc(ort.name)}</h3><p>Erst nach dem Match geht es zurück ins Hotel.</p>`;
    } else if (anlageTag && T && T.spiel) {
      // Trainingsplatz: zwei Übungen zur Auswahl, jede ist ein kleines Spiel
      const k = TT.kann(career, ort.id, anlageTag.def);
      unten = `<h3>${esc(ort.name)}</h3>` + (k.ok ? `<p>Je besser du triffst, desto mehr Pluspunkte hast du im Match. Braucht 1 Zeitfenster.</p><div class="row">${Object.entries(TT.UEBUNGEN).map(([id, U]) =>
        `<button class="primary" data-a="anlageUeben" data-v="${id}">${U.name} <small>${U.kurz}</small></button>`).join('')}</div>` : `<p>${k.warum}</p>`);
    } else if (anlageTag && T && T.wahl) {
      // Restaurant und Presse: Du suchst dir selbst eine Antwort aus
      const k = TT.kann(career, ort.id, anlageTag.def);
      const wahl = T.wahl === 'essen' ? TT.ESSEN.map((e) => e.name) : TT.FRAGEN[career.tag.frage || 0].antworten.map((a) => '„' + a[1] + '“');
      unten = `<h3>${esc(ort.name)}</h3>` + (k.ok ? `<p>${T.wahl === 'essen' ? esc(T.text) : `Ein Reporter fragt: <b>„${esc(TT.FRAGEN[career.tag.frage || 0].frage)}“</b>`} <span class="dim">Braucht 1 Zeitfenster.</span></p>
        <div class="${T.wahl === 'essen' ? 'row' : 'spalte'}">${wahl.map((w, i) => `<button data-a="anlageWahl" data-v="${ort.id}:${i}">${esc(w)}</button>`).join('')}</div>` : `<p>${k.warum}</p>`);
    } else if (anlageTag && T && T.kraft) {
      const k = TT.kann(career, ort.id, anlageTag.def);
      unten = `<h3>${esc(ort.name)}</h3>` + (k.ok ? `<p>${ort.text}</p><button class="primary" data-a="kraftStart">${T.name} <small>${TT.KRAFT_SPIEL.wdh} Wiederholungen · braucht 1 Zeitfenster</small></button>` : `<p>${k.warum}</p>`);
    } else if (anlageTag && T) {
      const k = TT.kann(career, ort.id, anlageTag.def);
      unten = `<h3>${esc(ort.name)}</h3>` + (k.ok ? `<p>${ort.text}</p><button class="primary" data-a="anlageTun" data-v="${ort.id}">${T.name} <small>braucht 1 Zeitfenster</small></button>` : `<p>${k.warum}</p>`);
    }
  }
  anlageEl.innerHTML = `<div class="oben"><button class="ghost" data-a="anlageEnde">‹ Zurück</button>${zeit}</div>
    <div class="kam">${kam.map(([k, z, t]) => `<button data-kam="${k}" title="${t}" aria-label="${t}">${z}</button>`).join('')}</div>
    <div class="panel">${unten}${anlageListe && !anlageTag ? '' : wohin}</div>`;
  anlageEl.classList.add('on');
}
// Kamera-Knöpfe: solange gedrückt, dreht oder zoomt die Kamera
anlageEl.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-kam]');
  if (!b) return;
  e.preventDefault();
  if (b.dataset.kam === 'karte') game.anlage.uebersicht(); else game.anlage.kamTaste = b.dataset.kam;
});
for (const n of ['pointerup', 'pointercancel', 'pointerleave']) anlageEl.addEventListener(n, () => { game.anlage.kamTaste = null; }, true);
// woher = an welcher Tür die Figur startet · ergebnis = was dort gleich angezeigt wird (nach einem Minispiel)
function anlageStart(ich, woher, ergebnis = null) {
  hide();
  enterMenu();
  game.setPlayers(ich, ich);
  anlageErgebnis = ergebnis;
  // Das Ergebnis bleibt stehen, bis die Figur von der Tür weggeht
  game.anlage.wennDa = (ort) => {
    if (!ort || !anlageErgebnis || anlageErgebnis.ort !== ort.id) anlageErgebnis = null;
    if (ort) anlageMeldung = null;
    if (!ort || ort.id !== 'kraft') kraftEnde();           // wer aus dem Kraftraum weggeht, bricht das Training ab
    anlageZeigen();
  };
  game.anlage.start(woher, anlageGelaende());
  anlageZeigen();
}
// Knopf „Hinlaufen“: Die Figur sucht sich den Weg selbst
actions.anlageGeh = (v) => { game.anlage.geheZu(v); };
actions.anlageListe = () => { anlageListe = !anlageListe; anlageZeigen(); };
// Ein anderes Gelände ansehen (nur im Hauptmenü)
actions.anlageWahlOrt = (v) => { if (anlageTag || !GL.gelaendeVon(v)) return; anlageWo = v; anlageListe = false; anlageStart(career ? CA.mePlayer(career) : D.PLAYERS[0]); };
function anlageSchluss() { kraftEnde(); anlageMeldung = null; game.anlage.ende(); anlageEl.classList.remove('on'); anlageEl.innerHTML = ''; }
// Aus dem Hauptmenü: einfach nur herumlaufen (mit deinem Karriere-Spieler, sonst mit dem ersten Spieler der Liste)
actions.anlage = () => { anlageTag = null; anlageListe = false; anlageStart(career ? CA.mePlayer(career) : D.PLAYERS[0]); };
// In der Karriere: der Tag vor dem Match. Wer schon auf der Anlage war und zurückkommt, macht dort weiter.
actions.tagAnlage = () => {
  if (!ctxT || !ctxT.career) return;
  if (!career.tag) TT.tagStart(career, ctxT.def);
  anlageTag = { def: ctxT.def };
  anlageStart(CA.mePlayer(career));
};
actions.anlageTun = (v) => {
  if (!anlageTag) return;
  const bringt = TT.tun(career, v, anlageTag.def);
  if (bringt) anlageErgebnis = { ort: v, text: TT.TAETIGKEITEN[v].text, bringt };
  anlageZeigen();
};
// Ein Zufall am Morgen: Antwort wählen
actions.tagEreignis = (v) => { if (anlageTag) anlageMeldung = TT.ereignisWahl(career, +v); anlageZeigen(); };
// Restaurant und Presse: v = 'ort:nummer'
actions.anlageWahl = (v) => {
  if (!anlageTag) return;
  const [ort, nr] = String(v).split(':');
  const bringt = TT.tun(career, ort, anlageTag.def, { wahl: +nr });
  if (bringt) anlageErgebnis = { ort, text: bringt[0], bringt: bringt.slice(1) };
  anlageZeigen();
};
// Kraftraum-Spiel starten, und: der Knopf „Jetzt heben!“
function kraftRunde() { kraftSpiel.mitte = 0.3 + Math.random() * 0.4; kraftSpiel.start = performance.now(); }
actions.kraftStart = () => {
  if (!anlageTag || !TT.kann(career, 'kraft', anlageTag.def).ok) return;
  kraftEnde();
  kraftSpiel = { n: 0, treffer: 0, letzter: null, uhr: setInterval(() => { const z = document.getElementById('kraftzeiger'); if (z && kraftSpiel) z.style.left = kraftZeiger() * 100 + '%'; }, 30) };
  kraftRunde();
  anlageZeigen();
};
actions.kraftDruck = () => {
  if (!kraftSpiel || !anlageTag) return;
  const K = TT.KRAFT_SPIEL, gut = Math.abs(kraftZeiger() - kraftSpiel.mitte) <= K.breite[kraftSpiel.n] / 2;
  kraftSpiel.letzter = gut;
  if (gut) { kraftSpiel.treffer++; sound.coin(); }
  kraftSpiel.n++;
  if (kraftSpiel.n >= K.wdh) {
    const treffer = kraftSpiel.treffer;
    kraftEnde();
    const bringt = TT.tun(career, 'kraft', anlageTag.def, { treffer });
    if (bringt) anlageErgebnis = { ort: 'kraft', text: bringt[0], bringt: bringt.slice(1) };
  } else kraftRunde();
  anlageZeigen();
};
// Minispiel auf dem Trainingsplatz: Ballmaschine oder Aufschlag. Danach geht es zurück auf die Anlage.
actions.anlageUeben = (v) => {
  const U = TT.UEBUNGEN[v];
  if (!anlageTag || !U || !TT.kann(career, 'training', anlageTag.def).ok) return;
  const def = anlageTag.def, trainer = { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' };
  anlageSchluss();
  startMatch({
    me: CA.mePlayer(career), opp: trainer, def, mode: U.modus, balls: U.baelle, title: U.name,
    onEnd: (res) => {
      let ergebnis = null;
      // Wer abbricht, hat das Zeitfenster noch nicht verbraucht
      if (!res.aborted) {
        const bringt = TT.tun(career, 'training', def, { uebung: v, punkte: res.training.score });
        if (bringt) ergebnis = { ort: 'training', text: `${res.training.score} von ${U.baelle * TT.PUNKTE_PRO_BALL} Punkten. ${bringt[0]}`, bringt: bringt.slice(1) };
      }
      anlageStart(CA.mePlayer(career), 'training', ergebnis);
    },
  });
};
actions.anlageMatch = () => { anlageSchluss(); actions.tourPlay(); };
actions.anlageEnde = () => { anlageSchluss(); if (anlageTag) renderTournament(); else actions.home(); };

// ---------------------------------------------------------------
// Siegerehrung nach einem gewonnenen Finale
// ---------------------------------------------------------------
// Was im Stadion passiert, steht in siegerehrung.js. Hier ist nur das kleine Fenster unten mit Text und Knöpfen.
let ehrung = null;
const ehrungEl = document.createElement('div');
ehrungEl.id = 'ehrung';
document.body.appendChild(ehrungEl);

function siegerehrung(gegner, danach) {
  const { T, def } = ctxT;
  const art = def.cat === 'GS' ? 'silber' : def.cat === 'F' ? 'stern' : 'gold';     // Grand Slam = Silberpokal, ATP Finals = Stern
  const geld = TN.payout(T, T.humanId).money || 0;
  hide();
  ehrung = { danach, art, def, gegner, geld, rede: null, foto: null, fertig: false };
  game.ehrung.start({ art, gross: def.zuschauer ?? 1, geld, turnier: def.name, farbe: def.theme && def.theme.wall });
  sound.setCrowd(0.06);
  ehrungZeigen();
}

function ehrungZeigen() {
  const e = ehrung, schritt = game.ehrung.schritt, ich = getPlayer(ctxT.T.humanId);
  const weiter = (text = 'Weiter ›') => `<button class="primary" data-a="ehrungWeiter">${text}</button>`;
  let html = '';
  if (schritt === 'aufstellen') html = `<h3>🏆 Siegerehrung · ${esc(e.def.name)}</h3><p>Das Finale ist vorbei. Beide Spieler kommen zur Ehrung nach vorn.</p>${weiter()}`;
  else if (schritt === 'teller') html = `<p>Zuerst wird der Zweite geehrt: <b>${esc(e.gegner.name)}</b> bekommt den Teller für den Finalisten. Auch er hat ein tolles Turnier gespielt!</p>${weiter()}`;
  else if (schritt === 'pokal') html = `<h3 class="gold">Der Sieger: ${esc(ich.name)}!</h3><p>Du bekommst den Pokal und stemmst ihn in die Luft.</p>${weiter()}`;
  else if (schritt === 'scheck') html = `<p>Dazu gibt es den großen Scheck: <b class="gold">${money(e.geld)}</b> Preisgeld.</p>${weiter()}`;
  else if (schritt === 'rede' && !e.rede) {
    html = `<p>Jetzt bekommst du das Mikrofon. Was sagst du?</p><div class="row">${Object.entries(CA.REDEN).map(([k, r]) =>
      `<button data-a="ehrungRede" data-v="${k}">${r.knopf}${ctxT.career ? `<small>${r.bringt}</small>` : ''}</button>`).join('')}</div>`;
  } else if (schritt === 'rede') {
    const r = CA.REDEN[e.rede];
    html = `<p>„${r.satz}“</p><p class="dim">Die Zuschauer klatschen.${ctxT.career ? ' ' + r.bringt : ''}</p>${weiter('Zum Siegerfoto ›')}`;
  } else if (schritt === 'foto' && !e.fertig) html = `<p>Die Fotografen warten. Bitte lächeln!</p><button class="primary" data-a="ehrungFoto">📸 Foto machen</button>`;
  else {
    html = `${e.foto ? `<img class="siegerfoto" src="${e.foto}" alt="Siegerfoto">` : ''}<p>${ctxT.career ? 'Das Foto steht jetzt in deinem Pokalschrank (Karriere-Menü).' : 'Ein schönes Foto!'}</p>
      <button class="primary" data-a="ehrungEnde">Weiter ›</button>`;
  }
  const ueberspringen = e.fertig ? '' : '<button class="ghost klein" data-a="ehrungEnde">Überspringen</button>';
  ehrungEl.innerHTML = `<div class="panel">${html}${ueberspringen}</div><div id="blitz"></div>`;
  ehrungEl.classList.add('on');
}
actions.ehrungWeiter = () => { game.ehrung.weiter(); ehrungZeigen(); };
actions.ehrungRede = (v) => {
  if (!CA.REDEN[v]) return;
  ehrung.rede = v;
  if (ctxT.career) CA.siegerRede(career, v);
  game.ehrung.jubeln(0.8);
  ehrungZeigen();
};
actions.ehrungFoto = () => {
  ehrung.foto = game.ehrung.foto();
  ehrung.fertig = true;
  sound.click();
  ehrungZeigen();
  // Blitzlicht: das Bild wird kurz weiß
  const blitz = document.getElementById('blitz');
  if (blitz) { blitz.classList.add('on'); setTimeout(() => blitz.classList.remove('on'), 60); }
};
actions.ehrungEnde = () => {
  const e = ehrung;
  if (!e) return;
  // In der Karriere kommt jeder Turniersieg in den Pokalschrank – auch wenn die Ehrung übersprungen wurde (dann ohne Foto)
  if (ctxT.career) CA.pokalMerken(career, e.def, e.art, e.foto);
  ehrung = null;
  game.ehrung.ende();
  ehrungEl.classList.remove('on');
  ehrungEl.innerHTML = '';
  enterMenu();
  e.danach();
};
actions.tourSim = () => { TN.simulateRest(ctxT.T); if (ctxT.career) CA.saveCareer(career); if (ctxT.season) SE.saveSeason(season); renderTournament(); };
actions.tourDone = () => {
  if (ctxT.season) return seasonTournamentDone();
  if (!ctxT.career) return actions.home();
  wocheZeigen(CA.finishTournament(career));
};

// Die Abrechnung nach einer Woche: Was kam rein, was ging raus?
function wocheZeigen(s) {
  const r = s.rechnung, zeilen = [];
  const z = (name, betrag) => { if (betrag) zeilen.push(`<tr><td>${name}</td><td class="num ${betrag > 0 ? 'plus' : 'minus'}">${betrag > 0 ? '+' : '−'} ${money(Math.abs(betrag))}</td></tr>`); };
  z(s.cat === 'stunden' ? 'Lohn als Tennislehrer' : s.cat === 'LIGA' ? 'Geld vom Verein' : 'Preisgeld', s.money);
  for (const g of r.sponsoren) z('Sponsor: ' + esc(g.name), g.geld);
  z('Flug', -r.flug); z('Hotel', -r.hotel); z('Essen und Taxi', -r.essen);
  z('Trainer und Physio', -r.team); z('Schläger neu bespannen', -r.bespannen); z('Weiße Leih-Kleidung', -r.leihe);
  const lines = [];
  if (s.cat === 'LIGA') lines.push(s.label === 'W' ? '<b>Gewonnen!</b> Dein Verein freut sich.' : 'Verloren – aber das Antrittsgeld gibt es trotzdem.');
  else if (s.label) lines.push(`Dein Ergebnis: <b>${D.ROUND_NAMES[s.label]}</b> · Ranglistenpunkte: <b>${s.points}</b>`);
  else if (s.cat === 'reha') lines.push(s.reha.gesund ? `<b class="plus">Du bist wieder gesund!</b> Die Verletzung (${esc(s.reha.name)}) ist ausgeheilt. Ab jetzt darfst du wieder Turniere spielen.`
    : `Du machst Reha: Übungen, Behandlung, viel Geduld. <b>${esc(s.reha.name)}</b> – noch ${s.reha.rest} ${s.reha.rest === 1 ? 'Woche' : 'Wochen'} Pause.`);
  else lines.push(s.cat === 'pause' ? 'Du hast dich ausgeruht und bist wieder ganz frisch.' : s.cat === 'vorbereitung' ? `Du hast eine Woche hart trainiert: +${CA.VORBEREITUNG_XP} Erfahrung.` : 'Du hast eine Woche lang Kindern Tennis beigebracht.');
  if (s.zweiteWoche) lines.push('<span class="dim">Du warst bis in die zweite Turnierwoche dabei. Darum sind jetzt zwei Wochen vergangen.</span>');
  if (s.geheilt) lines.push('<b class="plus">Die Pause hat gutgetan:</b> Deine Beschwerden sind weg.');
  if (s.beschwerden) lines.push(`<b class="minus">🩹 Beschwerden: ${esc(s.beschwerden.leicht)}</b> Das ist eine Warnung deines Körpers (−${AB.BESCHWERDEN_ABZUG} ${D.STAT_NAMES[s.beschwerden.trifft]}). Eine Woche Pause oder ein Besuch beim Physio auf der Anlage heilt das. Wer einfach weiterspielt, riskiert eine echte Verletzung.`);
  if (s.verletzung) lines.push(`<div class="verletzt"><b>🚑 Verletzt: ${esc(s.verletzung.name)}</b><br>Du musst <b>${s.verletzung.wochen} Wochen</b> pausieren.<br><b>Warum ist das passiert?</b><ul>${s.verletzung.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <b>Was bedeutet das für die Rangliste?</b> In der Pause sammelst du keine neuen Punkte, und alte Punkte fallen nach einem Jahr weg${s.punkteInGefahr ? ` – in diesen ${s.verletzung.wochen} Wochen sind das <b>${s.punkteInGefahr} Punkte</b>` : ''}. Die anderen spielen weiter. Du wirst also abrutschen.<br>
    <span class="dim">Beim nächsten Mal: Bei Beschwerden lieber eine Woche Pause machen. Ärzte und ein eigener Physio senken das Risiko.</span></div>`);
  if (s.verpasst) lines.push(`<b class="minus">${esc(s.verpasst)} war für dich ein Pflichtturnier.</b> Weil du nicht angetreten bist, zählt es ein Jahr lang mit 0 Punkten als eines deiner ${KA.ZAEHLT_HOECHSTENS} Turniere.`);
  for (const e of s.weg || []) lines.push(`<span class="minus">−${e.p} Punkte:</span> <span class="dim">${esc(e.n || 'Turnier')} ist jetzt ein Jahr her und fällt aus der Rangliste.</span>`);
  if (s.grossSieger) lines.push(`<span class="dim">${esc(s.grossName)} hat ${esc(s.grossSieger)} gewonnen.</span>`);
  if (r.wildcard) lines.push('<span class="dim">Du hast eine Wildcard eingesetzt.</span>');
  if (r.teamWeg) lines.push('<b>Dein Geld hat für das Team nicht gereicht.</b> Trainer und Physio haben gekündigt.');
  lines.push(`<table class="rechnung">${zeilen.join('')}<tr class="summe"><td>Diese Woche</td><td class="num ${s.netto >= 0 ? 'plus' : 'minus'}">${s.netto >= 0 ? '+' : '−'} ${money(Math.abs(s.netto))}</td></tr></table>`);
  lines.push(`Du stehst jetzt auf <b>Platz ${s.rank}</b> der Weltrangliste${s.vorher && s.vorher !== s.rank ? ` <span class="${s.rank < s.vorher ? 'plus' : 'minus'}">(${s.rank < s.vorher ? '▲' : '▼'} ${Math.abs(s.vorher - s.rank)})</span>` : ''} und hast <b class="gold">${money(career.money)}</b>.`);
  if (s.handtuch) lines.push(`<span class="dim">🧺 Neu in deiner Sammlung: das Handtuch von ${esc(s.handtuch.n)}.</span>`);
  for (const t of s.neueTeile || []) lines.push(`<b class="gold">🎁 Sonderstück verdient: ${esc(t.name)}!</b> Du bekommst es für ${esc(t.wofuer)}. Es liegt unter „Ausrüstung“ in deiner Sammlung.`);
  for (const g of s.neueSponsoren) lines.push(`<b class="gold">Neuer Sponsor: ${esc(g.name)}!</b> ${esc(g.text)} (${money(g.geld)} pro Turnier)`);
  if (s.seasonOver) lines.push(`<b>Ein neues Tennisjahr beginnt: ${career.season}!</b> Im ATP Race starten alle wieder bei 0 Punkten. In der Weltrangliste behältst du deine Punkte – aber jede Woche fallen die Punkte weg, die genau ein Jahr alt sind. Du hast wieder ${CA.WILDCARDS_PRO_SAISON} Wildcards.`);
  if (s.netto > 0) sound.coin();
  showInfo(s.name, lines.join('<br>'), 'career');
}

// ---------------------------------------------------------------
// Karriere
// ---------------------------------------------------------------
const SKINS = [0xf3cfb0, 0xe2b48c, 0xc99872, 0x9a6a48, 0x7a4a30];
const HAIRS = [0x1a1410, 0x3a2a1c, 0x6a4a2c, 0xb8935a, 0xc8642a, 0xd8d8d8];
const SHIRTS = [0xe84a3a, 0x2e6fd8, 0xffffff, 0x1fb87a, 0xf2e85c, 0x9a3ad8, 0xff7a2a, 0x1a1a1a];
const COUNTRIES = ['GER', 'AUT', 'SUI', 'ITA', 'ESP', 'FRA', 'GBR', 'USA', 'AUS', 'NOR', 'SWE', 'NED', 'POL', 'CZE', 'CRO', 'SRB', 'GRE', 'ARG', 'BRA', 'CAN', 'JPN'];
const draft = { name: '', country: 'GER', hand: 1, skin: SKINS[0], hair: HAIRS[1], shirt: SHIRTS[1], shorts: 0xffffff, head: 'cap', model: 'e', pattern: 0, trim: 0x1a2a4a };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
let careerTab = 'start';
let ranglisteTab = 'welt';

actions.career = (v) => {
  if (!career) return renderCreate();
  if (career.tournament) { ctxT = { T: career.tournament, def: D.tournamentById(career.tournament.defId), career: true }; return renderTournament(); }
  if (['start', 'kalender', 'rangliste', 'skills', 'shop', 'team', 'service', 'pokale'].includes(v)) careerTab = v;
  enterMenu();
  renderCareer();
};

function renderCreate() {
  const sw = (key, list) => `<div class="swatches">${list.map((c) => `<button class="${draft[key] === c ? 'sel' : ''}" style="background:${hex(c)}" data-a="draft" data-v="${key}:${c}"></button>`).join('')}</div>`;
  show(`
    <div class="bar">${back()}<h2>Neue Karriere</h2></div>
    <div class="panel">
      <label>Name deines Spielers</label><input id="cname" type="text" maxlength="22" placeholder="Vorname Nachname" value="${esc(draft.name)}">
      <label>Land</label><div class="row">${COUNTRIES.map((c) => `<button class="${draft.country === c ? 'sel' : ''}" data-a="draft" data-v="country:${c}">${flag(c)} ${c}</button>`).join('')}</div>
      <label>Schlaghand</label><div class="row">
        <button class="${draft.hand === 1 ? 'sel' : ''}" data-a="draft" data-v="hand:1">Rechtshänder</button>
        <button class="${draft.hand === -1 ? 'sel' : ''}" data-a="draft" data-v="hand:-1">Linkshänder</button></div>
      <label>Hautfarbe</label>${sw('skin', SKINS)}
      <label>Haarfarbe</label>${sw('hair', HAIRS)}
      <label>Trikot</label>${sw('shirt', SHIRTS)}
      <label>Hose</label>${sw('shorts', [0xffffff, 0x1a1a1a, 0x24406a, 0xc82a2a])}
      <label>Figur</label><div class="row">${[['a', 'Kurze Haare'], ['b', 'Stirnband'], ['c', 'Locken, ärmellos'], ['d', 'Bart'], ['e', 'Kappe'], ['f', 'Haarknoten']].map(([k, n]) => `<button class="${draft.model === k ? 'sel' : ''}" data-a="draft" data-v="model:${k}">${n}</button>`).join('')}</div>
      <label>Muster der Kleidung</label><div class="row">${['Einfarbig', 'Bruststreifen', 'Farbige Ärmel', 'Seitenstreifen', 'Schulterpartie'].map((n, k) => `<button class="${draft.pattern === k ? 'sel' : ''}" data-a="draft" data-v="pattern:${k}">${n}</button>`).join('')}</div>
      <label>Zweite Farbe</label>${sw('trim', [0xffffff, 0x1a1a1a, 0x1a2a4a, 0xe84a3a, 0xf2e85c, 0x1fb87a])}
    </div>
    <p class="dim">Du startest ganz unten: ungefähr Platz 2000 der Weltrangliste, ${money(CA.START_GELD)} und ${CA.START_PUNKTE} Fähigkeitspunkte. Zuerst spielst du kleine ITF-Turniere – und arbeitest dich hoch bis nach Wimbledon.</p>
    <button class="primary" data-a="createCareer">Karriere starten ›</button>`);
}
actions.draft = (v) => {
  const [k, raw] = v.split(':');
  const inp = $('#cname');
  if (inp) draft.name = inp.value;
  draft[k] = (k === 'country' || k === 'head' || k === 'model') ? raw : Number(raw);
  draft.head = draft.model === 'e' ? 'cap' : draft.model === 'b' ? 'band' : 'none';   // für die einfache Figur
  keepScroll(renderCreate);
};
actions.createCareer = () => {
  const name = ($('#cname').value || '').trim() || 'Mein Spieler';
  career = CA.newCareer({
    name, country: draft.country, hand: draft.hand,
    look: { skin: draft.skin, hair: draft.hair, shirt: draft.shirt, shorts: draft.shorts, head: draft.head, model: draft.model, pattern: draft.pattern, trim: draft.trim, shoes: 0xffffff, racket: 0x202020 },
  });
  CA.saveCareer(career);
  careerTab = 'start';
  renderCareer();
};

// '+2 Kraft, +1 Präzision' aus { p: 2, c: 1 }
const bonusText = (b) => Object.entries(b).map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${D.BONUS_NAMES[k]}`).join(', ');
const sterne = (n) => (n ? '⭐'.repeat(n) : '');
const BELAG_KURZ = { hard: 'Hartplatz', clay: 'Sand', grass: 'Rasen', indoor: 'Halle' };
let shopCat = 'Schläger';
let anprobeId = null;         // dieses Teil probiert die Figur im Shop gerade an (null = was du wirklich trägst)

// Ein Turnier, das diese Woche zur Auswahl steht
function angebotKarte(a) {
  const { def, zugang, kosten, fehlt } = a, c = career;
  const ort = def.klein ? `${def.city} · ${KT.ERDTEILE[def.erdteil]}` : `${def.city} · ${KT.ERDTEILE[KT.ERDTEIL_GROSS[def.id]]}`;
  const runden = Math.ceil(Math.log2(def.draw));
  const sieg = def.cat === 'F' ? 'Die besten 8 im ATP Race' : `${def.draw} Spieler, ${runden} Runden · Sieg: ${def.points.W} Punkte und ${money(def.money.W)}`;
  const teile = [`Flug ${money(kosten.flug)}`];
  if (kosten.hotel) teile.push(`Hotel ${money(kosten.hotel)}`);
  teile.push(`Essen ${money(kosten.essen)}`);
  const reise = `Reise: <b>${money(kosten.summe)}</b> <span class="dim">(${teile.join(' + ')}${kosten.hotel ? '' : ' · das Hotel zahlt das Turnier'})</span>`;
  let knopf;
  if (!zugang.ok && !zugang.wildcard) knopf = `<button disabled>🔒 ${zugang.race ? 'Nur für die besten 8 im ATP Race' : 'Erst ab Platz ' + zugang.bis}</button>`;
  else if ((a.sachen || []).some((f) => f.muss)) knopf = `<button data-a="schuheKaufen">👟 ${a.sachen.find((f) => f.muss).text} – zum Shop</button>`;
  else if (fehlt) knopf = `<button disabled>Dir fehlen ${money(fehlt)}</button>`;
  else if (!zugang.ok) knopf = `<button data-a="careerPlay" data-v="${def.id}:wc">🎟️ Mit Wildcard hinreisen (noch ${c.wildcards})</button>`;
  else knopf = `<button class="primary" data-a="careerPlay" data-v="${def.id}">Hinreisen und spielen ›</button>`;
  return `<div class="angebot ${zugang.ok ? '' : 'zu'}">
    <div class="kopf"><b>${esc(def.name)}</b> ${catTag(def)}${PL.wahlVon(c, c.week) === def.id ? ' <span class="tag plan">📌 in deinem Plan</span>' : ''}</div>
    <div class="dim">${esc(ort)} · <span class="belag ${def.surface}">${BELAG_KURZ[def.surface]}</span> · ${sieg}</div>
    ${(a.sachen || []).filter((f) => !f.muss).map((f) => `<div class="klein minus">👕 ${esc(f.text)}</div>`).join('')}
    ${a.pflicht ? '<div class="klein gold">Pflichtturnier: Wenn du nicht antrittst, zählt es mit 0 Punkten.</div>' : ''}
    <div>${reise}</div>${knopf}</div>`;
}

// ---------------------------------------------------------------
// Saison-Planer: das ganze Jahr nach Monaten, dein Turnierplan, Kosten und Bedarf (Rechnung in planer.js)
// ---------------------------------------------------------------
let planWoche = null;        // diese Woche ist im Planer gerade aufgeklappt
function planerHtml(c) {
  const V = PL.vorschau(c), rk = CA.myRank(c);
  const done = Object.fromEntries(c.history.filter((h) => h.season === c.season && h.w != null).map((h) => [h.w, h]));
  const zeile = Object.fromEntries(V.wochen.map((z) => [z.nr, z])), monat = Object.fromEntries(V.monate.map((m) => [m.monat, m]));
  const kurz = { GS: 'Grand Slam', M: 'Masters', F: 'Finals', A500: 'ATP 500', A250: 'ATP 250', CH: 'Challenger', ITF: 'ITF' };
  const geld = (n) => `<span class="${n < 0 ? 'minus' : ''}">${n < 0 ? '−' : ''}${money(Math.abs(n))}</span>`;
  // Das Jahr als Streifen: 52 Kästchen in der Farbe der Phase, deine geplanten Turniere als Punkt
  const streifen = `<div class="jahr">${KA.WOCHEN.map((w) => { const P = KA.phaseVon(w.nr), z = zeile[w.nr], h = done[w.nr];
    const punkt = h ? (h.label ? '●' : '') : z && z.def ? (z.def.cat === 'LIGA' ? '·' : '●') : z && z.wahl === 'pause' ? '☾' : '';
    return `<i class="${w.nr === c.week ? 'heute' : w.nr < c.week ? 'war' : ''}" style="background:${P.farbe}" title="KW ${KA.kw(w.nr)}: ${P.name}" data-a="planAuf" data-v="${w.nr}">${punkt}</i>`; }).join('')}</div>
    <div class="row klein">${KA.PHASEN.map((P) => `<span><i class="punkt" style="background:${P.farbe}"></i>${P.bild} ${P.name}${P.belag ? ' · ' + BELAG_KURZ[P.belag] : ''}</span>`).join('')}</div>`;
  const sterneNote = V.note ? '⭐'.repeat(V.note) + '☆'.repeat(5 - V.note) : '–';
  const zeichen = { schlecht: '🔴', achtung: '🟡', info: 'ℹ️', gut: '🟢' };
  const kopf = `<div class="panel"><h3 style="margin-top:0">🗓️ Dein Tennisjahr ${c.season}</h3>${streifen}
      <p class="dim klein">● = Turnier in deinem Plan oder schon gespielt · ☾ = Pause · weißer Rahmen = diese Woche. Tippe auf ein Kästchen, um zu der Woche zu springen.</p></div>
    <div class="cols breit"><div class="panel"><h3 style="margin-top:0">💰 Was kostet dein Plan?</h3>
      <div class="kpi"><div><b>${V.turniere}</b><span>Turniere geplant</span></div>
        <div><b class="minus">${money(V.kosten)}</b><span>Kosten bis Jahresende</span></div>
        <div><b class="plus">${money(V.sicher)}</b><span>sichere Einnahmen</span></div>
        <div><b class="${V.bedarf ? 'minus' : 'plus'}">${V.bedarf ? money(V.bedarf) : 'reicht'}</b><span>${V.bedarf ? `fehlen dir schlimmstenfalls (KW ${KA.kw(V.tiefWoche)})` : `tiefster Kontostand: ${money(V.tief)}`}</span></div></div>
      <p class="dim klein"><b>Kosten</b> = Flüge, Hotel, Essen, dein Team und Ausrüstung, die dir für den Plan noch fehlt. <b>Sichere Einnahmen</b> = Sponsoren, Tennisstunden und das Preisgeld,
        das es sogar bei einer Niederlage in der ersten Runde gibt. Jedes gewonnene Match bringt mehr – darauf verlässt sich ein kluger Plan aber nicht.
        ${V.maxPunkte ? `Und wenn du alles gewinnst? Dann wären es ${V.maxPunkte.toLocaleString('de-DE')} Punkte. 😄` : ''}</p>
      ${V.braucht.length ? `<p><b>🛒 Einkaufszettel für diesen Plan</b></p><table>${V.braucht.map((b) => `<tr><td>${esc(b.text.replace(/ \(.*/, ''))}<br><small class="dim">für ${esc(b.fuer)} · ab KW ${KA.kw(b.woche)}</small></td>
        <td class="right">${b.teil ? `<small>${esc(b.teil.name)}</small><br><button data-a="planKauf" data-v="${b.teil.id}" ${c.money < b.teil.price ? 'disabled' : ''}>Kaufen · ${money(b.teil.price)}</button>` : ''}</td></tr>`).join('')}</table>` : ''}</div>
    <div class="panel"><h3 style="margin-top:0">🧑‍🏫 Der Trainer schaut auf deinen Plan <span class="gold">${sterneNote}</span></h3>
      ${V.hinweise.map((h) => `<p class="klein">${zeichen[h.art]} ${esc(h.text)}</p>`).join('')}
      <p><b>Vorschlag vom Trainer</b> <span class="dim klein">– füllt nur die Wochen, die noch frei sind</span></p>
      <div class="row">${Object.entries(PL.AUTO).map(([id, A]) => `<button data-a="planAuto" data-v="${id}" title="${A.text}">${A.bild} ${A.name}</button>`).join('')}
        <button class="ghost" data-a="planLeeren">Plan leeren</button></div>
      <p class="dim klein">${Object.values(PL.AUTO).map((A) => `${A.bild} ${A.name}: ${A.text}`).join(' ')} Der Trainer rechnet mit deinem Platz von heute (${rk}). Wenn du kletterst, lohnt sich ein neuer Blick.</p></div></div>`;
  // Die Wochen, nach Monaten getrennt
  let letzter = -1;
  const reihen = KA.WOCHEN.map((w) => {
    const mo = KA.monatVon(c.season, w.nr), P = KA.phaseVon(w.nr), z = zeile[w.nr], h = done[w.nr], g = w.gross ? D.tournamentById(w.gross) : null;
    let out = '';
    if (mo !== letzter) {
      letzter = mo;
      const m = monat[mo];
      out += `<tr class="monat"><td colspan="5"><b>${KA.MONATE[mo]}</b>${m ? ` <span class="klein">· ${m.turniere} ${m.turniere === 1 ? 'Turnier' : 'Turniere'} · Kosten ${money(m.kosten)} · sicher ${money(m.sicher)} · Konto am Monatsende mindestens ${geld(m.konto)}</span>` : ' <span class="dim klein">· vorbei</span>'}</td></tr>`;
    }
    const kleine = KT.KLEINE_TURNIERE.filter((t) => t.woche === w.nr);
    let was = g ? `<b>${esc(g.name)}</b> ${catTag(g)}` : w.zweite ? `<span class="dim">${esc(D.tournamentById(w.zweite).name)} · 2. Woche</span>` : w.off ? '<span class="dim">Off-Season</span>' : '';
    const stufen = [...new Set(kleine.map((t) => t.cat))].reverse();
    if (stufen.length) was += `${was ? '<br>' : ''}<span class="dim klein">${stufen.map((cat) => kurz[cat] + (cat[0] === 'A' ? ': ' + kleine.filter((t) => t.cat === cat).map((t) => esc(t.city)).join(', ') : '')).join(' · ')}</span>`;
    let plan;
    if (h) plan = `<span class="dim">${esc(h.name)}${h.label === 'W' ? ' · 🏆 Sieg' : h.label ? ' · ' + D.ROUND_NAMES[h.label] : ''}${h.label ? ` · ${h.points} P.` : ''} · ${geld(h.netto)}</span>`;
    else if (w.nr < c.week) plan = '<span class="dim">–</span>';
    else {
      const name = z.def ? `${esc(z.def.name)}${z.def.klein || z.def.cat === 'LIGA' ? '' : ''}` : z.wahl ? `${PL.FREI[z.wahl].bild} ${PL.FREI[z.wahl].name}` : '';
      const warn = [z.def && z.zugang && !z.zugang.ok ? `🔒 erst ab Platz ${z.zugang.bis}` : '', ...z.sachen.map((x) => '👟 ' + x), z.pflichtAus ? '⚠️ Pflichtturnier ausgelassen' : '', z.verteidigen ? `🛡️ ${z.verteidigen} Punkte verteidigen` : '', z.serie >= AB.SERIE_LANG ? `🩹 ${z.serie}. Woche ohne Pause` : ''].filter(Boolean);
      plan = `<button class="${z.wahl ? 'sel' : 'ghost'} planknopf" data-a="planAuf" data-v="${w.nr}">${z.wahl ? '📌 ' + name : '＋ planen'}</button>
        ${z.def && z.def.surface ? ` <span class="belag ${z.def.surface}">${BELAG_KURZ[z.def.surface]}</span>` : ''}${warn.length ? `<br><small class="minus">${warn.map(esc).join(' · ')}</small>` : ''}`;
    }
    out += `<tr class="${w.nr === c.week ? 'me' : ''}" id="kw${w.nr}"><td class="kwzelle" style="border-left:6px solid ${P.farbe}"><b>KW ${KA.kw(w.nr)}</b><br><small class="dim">${KA.datumKurz(c.season, w.nr)}</small></td>
      <td>${was || '<span class="dim">–</span>'}</td><td>${plan}</td>
      <td class="num">${z && (z.kosten || z.sicher) ? `<small class="minus">−${money(z.kosten)}</small><br><small class="plus">+${money(z.sicher)}</small>` : ''}</td>
      <td class="num">${z ? geld(z.konto) : ''}</td></tr>`;
    // Aufgeklappt: alle Möglichkeiten dieser Woche
    if (planWoche === w.nr && w.nr >= c.week) {
      const opt = PL.optionen(c, w.nr, rk);
      out += `<tr class="planwahl"><td colspan="5"><b>KW ${KA.kw(w.nr)} · ${P.bild} ${esc(P.name)}</b> – was hast du vor?<div class="row">${opt.map((o) => {
        const an = z.wahl === o.id;
        if (!o.def) return `<button class="${an ? 'sel' : ''}" data-a="planSetzen" data-v="${w.nr}:${o.id}">${PL.FREI[o.id].bild} ${PL.FREI[o.id].name}</button>`;
        const fehlt = CA.fehltFuer(c, o.def).filter((f) => f.muss);
        return `<button class="${an ? 'sel' : ''} ${o.zugang.ok ? '' : 'zu'}" data-a="planSetzen" data-v="${w.nr}:${o.id}">${esc(o.def.cat === 'LIGA' ? '🏠 Liga-Spiel' : o.def.name)}
          <small>${o.def.cat === 'LIGA' ? 'zu Hause' : `${kurz[o.def.cat]} · ${BELAG_KURZ[o.def.surface]} · ${KT.ERDTEILE[o.def.erdteil || KT.ERDTEIL_GROSS[o.def.id]] || ''}`}${o.zugang.ok ? '' : ` · 🔒 ab Platz ${o.zugang.bis || 8}`}${fehlt.length ? ' · 👟 Schuhe fehlen' : ''}</small></button>`; }).join('')}
        ${z.wahl ? `<button class="ghost" data-a="planSetzen" data-v="${w.nr}:">✕ Woche wieder freigeben</button>` : ''}</div></td></tr>`;
    }
    return out;
  }).join('');
  return `${kopf}<div class="panel" style="overflow-x:auto"><table class="planer"><tr><th>Woche</th><th>Turniere der Woche</th><th>Dein Plan</th><th class="num">Kosten / sicher</th><th class="num">Konto mind.</th></tr>${reihen}</table>
    <p class="dim klein">KW = Woche des Tennisjahres (KW 1 beginnt am ersten Montag im Januar). Der farbige Rand zeigt die Phase der Saison. „Konto mind.“ = so viel Geld hast du nach dieser Woche mindestens,
      wenn du nach Plan spielst und überall in der ersten Runde verlierst. Der Plan verpflichtet dich zu nichts: Jede Woche entscheidest du in der Übersicht neu.
      Der Kalender ist der echte ATP-Kalender 2026; die Wochen der Challenger und ITF-Turniere stimmen nur ungefähr. Alle Geldbeträge sind geschätzt.</p></div>`;
}
actions.planAuf = (v) => { planWoche = planWoche === +v ? null : +v; keepScroll(renderCareer); const el = document.getElementById('kw' + v); if (el && planWoche != null) el.scrollIntoView({ block: 'center' }); };
actions.planSetzen = (v) => { const [w, wahl] = String(v).split(':'); PL.setzen(career, +w, wahl || null); planWoche = null; keepScroll(renderCareer); };
actions.planAuto = (v) => { PL.autoPlan(career, v); keepScroll(renderCareer); };
let planLeerArmed = false;
actions.planLeeren = (v, el) => {
  if (!planLeerArmed) { planLeerArmed = true; el.textContent = 'Wirklich leeren? Nochmal tippen'; setTimeout(() => { planLeerArmed = false; }, 4000); return; }
  planLeerArmed = false; PL.leeren(career); keepScroll(renderCareer);
};
actions.planKauf = (v) => { if (CA.buy(career, v)) sound.coin(); keepScroll(renderCareer); };
// Vom Turnier-Angebot direkt zu den Schuhen im Shop
actions.schuheKaufen = () => { shopCat = 'Schuhe'; careerTab = 'shop'; renderCareer(); };

// In welcher Phase der Saison sind wir? Ein farbiger Streifen mit Belag und dem, was als Nächstes kommt.
function phaseBanner(c) {
  const P = KA.phaseVon(c.week), danach = KA.PHASEN[(KA.PHASEN.indexOf(P) + 1) % KA.PHASEN.length];
  const rest = P.bis - c.week;
  return `<div class="phase" style="border-color:${P.farbe}"><b>${P.bild} ${esc(P.name)}</b>${P.belag ? ` <span class="belag ${P.belag}">${BELAG_KURZ[P.belag]}</span>` : ''}
    <span class="dim klein">Woche ${c.week - P.von + 1} von ${P.bis - P.von + 1}</span><br><span class="klein">${esc(P.text)}</span>
    <br><span class="dim klein">${rest ? `Noch ${rest} ${rest === 1 ? 'Woche' : 'Wochen'}, dann` : 'Nächste Woche beginnt'}: ${danach.bild} ${esc(danach.name)}${danach.belag ? ' (' + BELAG_KURZ[danach.belag] + ')' : ''}${danach.belag && !CA.schuhePassen(c, danach.belag) ? ` – <b class="minus">dafür fehlen dir noch die Schuhe!</b>` : ''}</span></div>`;
}
// Was steht für diese Woche in deinem Plan?
function geplantText(c) {
  const wahl = PL.wahlVon(c, c.week);
  if (!wahl) return `<p class="dim klein">📌 Für diese Woche steht nichts in deinem Plan. <button class="ghost" data-a="career" data-v="kalender">Zum Saison-Planer</button></p>`;
  const def = PL.defVon(wahl);
  return `<p class="tipp">📌 Dein Plan für diese Woche: <b>${def ? esc(def.name) : PL.FREI[wahl].name}</b></p>`;
}
// Deine Ausrüstung auf einen Blick – auch die Sachen vom Anfang
function ausruestungKasten(c) {
  const z = CA.ausruestungJetzt(c), neu = z.every((x) => !x.eigen);
  return `<div class="ausr"><b>🎒 Das hast du gerade</b>${neu ? ' <span class="dim klein">– noch nichts gekauft, nur die Sachen vom Anfang</span>' : ''}
    <table>${z.map((x) => `<tr class="${x.eigen ? '' : 'dim'}"><td>${x.cat}</td><td><b>${esc(x.name)}</b>
      ${x.bonus ? `<br><small class="gold">${bonusText(x.bonus)}</small>` : ''}${x.sterne ? ` <small>${sterne(x.sterne)}</small>` : ''}
      ${x.belaege ? `<br><small>${['hard', 'clay', 'grass', 'indoor'].map((b) => `<span class="belag ${b} ${x.belaege.includes(b) ? '' : 'aus'}">${x.belaege.includes(b) ? '✓' : '✗'} ${BELAG_KURZ[b]}</span>`).join(' ')}</small>` : ''}
      ${x.info ? `<br><small class="dim">${esc(x.info)}</small>` : ''}</td></tr>`).join('')}</table>
    <button class="ghost" data-a="career" data-v="shop">Zum Shop ›</button></div>`;
}

function frischeBalken(f) {
  const farbe = f >= 70 ? '#3ad87a' : f >= 50 ? '#f2c02a' : '#e8442a';
  return `<i class="frische"><b style="width:${f}%;background:${farbe}"></b></i>`;
}

function renderCareer() {
  const c = career, me = CA.mePlayer(c), rk = CA.myRank(c), stufe = CA.vertragsStufe(c), W = KA.WOCHEN[c.week];
  const tabs = [['start', 'Übersicht'], ['kalender', 'Saison-Planer'], ['shop', 'Ausrüstung'], ['team', 'Team & Sponsoren'], ['service', 'Profi-Service' + (c.koerper || c.verletzung ? ' 🩹' : '')], ['skills', 'Fähigkeiten' + (c.skillPoints ? ' ●' : '')], ['pokale', 'Pokalschrank' + (c.pokale.length ? ' ' + c.pokale.length : '')], ['rangliste', 'Weltrangliste']];
  let body = '';
  const raceIch = CA.race(c).find((p) => p.me);
  if (careerTab === 'start') {
    const sp = CA.sponsorGeld(c), lohn = CA.lohn(c), muede = CA.frischeAbzug(c.frische);
    const saite = CA.traegt(c, 'Saiten');
    const weg = CA.zuVerteidigen(c).filter((e) => e.zaehlt);
    // Nicht alle Turniere der Woche zeigen: die größten, bei denen du mitspielen darfst, und das nächste Ziel darüber
    const alleA = CA.angebot(c), darf = alleA.filter((a) => a.zugang.ok || a.zugang.wildcard);
    const liste = [...darf.slice(-5), ...alleA.filter((a) => !darf.includes(a)).slice(0, 1), ...alleA.filter((a) => !a.def.klein && !darf.includes(a))].filter((a, i, l) => l.indexOf(a) === i);
    const versteckt = alleA.length - liste.length;
    const tipps = [];
    if (!CA.traegt(c, 'Schläger')) tipps.push('Du spielst noch mit dem alten Vereinsschläger. Unter „Ausrüstung“ gibt es bessere.');
    if (saite && c.saitenRest <= 0) tipps.push('Deine Saiten sind müde und bringen nichts mehr. Lass unter „Ausrüstung“ neu bespannen.');
    if (c.frische < 70) tipps.push(`Du bist müde (${bonusText(muede)}). Eine Pause oder ein Physio hilft.`);
    if (c.koerper) tipps.push(`<b class="minus">🩹 Beschwerden (${esc(c.koerper.teil)}).</b> Eine Woche Pause oder der Physio auf der Anlage heilt das. Wer weiterspielt, riskiert eine Verletzung.`);
    else if (c.serie >= AB.SERIE_LANG - 1) tipps.push(`Du spielst schon ${c.serie} Wochen ohne Pause. Dein Körper braucht bald eine freie Woche.`);
    if (stufe >= 0 && !c.vertrag.schlaeger) tipps.push('Eine Schläger-Marke würde dich ausrüsten! Schau unter „Team & Sponsoren“.');
    body = `
      <div class="panel"><div class="kpi">
        <div><b>${rk}.</b><span>Weltrangliste · ${CA.meinePunkte(c).punkte.toLocaleString('de-DE')} Punkte</span></div>
        <div><b>${raceIch.points ? raceIch.rank + '.' : '–'}</b><span>ATP Race ${c.season} · ${raceIch.points.toLocaleString('de-DE')} Punkte</span></div>
        <div><b class="gold">${money(c.money)}</b><span>Geld</span></div>
        <div><b>${c.frische} %</b>${frischeBalken(c.frische)}<span>Frische</span></div>
        <div><b>${CA.fans(c)} ⭐</b><span>Fans</span></div>
        <div><b>Level ${c.level}</b><span>${c.xp} / ${CA.xpNeed(c.level)} Erfahrung</span></div>
        <div><b>${c.titles}</b><span>Titel</span></div>
      </div>${tipps.map((t) => `<p class="tipp">💡 ${t}</p>`).join('')}</div>
      <div class="cols breit">
        ${c.verletzung ? `<div class="panel"><div class="dim">${c.season} · Woche ${c.week + 1} von ${KA.WOCHEN_PRO_JAHR} · ab Montag, ${KA.datumText(c.season, c.week)}</div>
          <h2 style="margin:6px 0">🚑 Du bist verletzt</h2>
          <div class="verletzt"><b>${esc(c.verletzung.name)}</b> – noch <b>${c.verletzung.wochen} ${c.verletzung.wochen === 1 ? 'Woche' : 'Wochen'}</b> Pause (von ${c.verletzung.gesamt}).
            <ul>${c.verletzung.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>
          <p class="dim">Solange du verletzt bist, kannst du keine Turniere spielen. Die Welt spielt weiter, und deine alten Punkte fallen nach und nach aus der Rangliste.
            ${weg.length ? `Nach dieser Woche sind es <b>${weg.reduce((x, e) => x + e.p, 0)} Punkte</b>.` : ''} Pflichtturniere musst du verletzt nicht spielen.</p>
          <div class="row"><button class="primary grow" data-a="careerWoche" data-v="reha">Eine Woche Reha machen</button></div></div>` : `
        <div class="panel"><div class="dim">${c.season} · Woche ${c.week + 1} von ${KA.WOCHEN_PRO_JAHR} · ab Montag, ${KA.datumText(c.season, c.week)}</div>
          <h2 style="margin:6px 0">${W.off ? 'Off-Season: Was machst du diese Woche?' : 'Wohin reist du diese Woche?'}</h2>
          ${phaseBanner(c)}
          ${geplantText(c)}
          ${W.hinweis ? `<p class="tipp">📅 ${esc(W.hinweis)}</p>` : ''}
          ${W.zweite ? `<p class="dim klein">${esc(D.tournamentById(W.zweite).name)} läuft in der zweiten Woche – ohne dich.</p>` : ''}
          ${weg.length ? `<p class="tipp">🛡️ Punkte verteidigen: Nach dieser Woche ${weg.length > 1 || weg[0].p !== 1 ? 'fallen' : 'fällt'} <b>${weg.reduce((x, e) => x + e.p, 0)} ${weg.reduce((x, e) => x + e.p, 0) === 1 ? 'Punkt' : 'Punkte'}</b> aus deiner Rangliste (${weg.map((e) => esc(e.n || 'Turnier')).join(', ')} vor einem Jahr).</p>` : ''}
          ${liste.length ? `<label>So reist du</label><div class="row">${Object.entries(AU.REISEN).map(([k, r]) => `<button class="${c.reise === k ? 'sel' : ''}" data-a="careerReise" data-v="${k}">${r.name}</button>`).join('')}</div>
          <p class="dim klein">${AU.REISEN[c.reise].text} ${AU.REISEN[c.reise].frische ? `(Frische ${AU.REISEN[c.reise].frische > 0 ? '+' : '−'}${Math.abs(AU.REISEN[c.reise].frische)})` : ''}
            ${lohn ? ` · Dein Team kostet ${money(lohn)} pro Woche.` : ''}${sp.summe ? ` · Deine Sponsoren zahlen ${money(sp.summe)} pro Turnier.` : ''}</p>` : '<p class="dim">Diese Woche gibt es kein Turnier.</p>'}
          ${liste.map(angebotKarte).join('')}
          ${versteckt ? `<p class="dim klein">${versteckt} weitere Turniere dieser Woche sind hier nicht gezeigt (zu klein oder noch zu weit weg für dich). Alle stehen im Kalender.</p>` : ''}
          <label>Oder bleib zu Hause</label>
          <div class="row">
            <button data-a="careerLiga">Liga-Spiel für den Verein <small>ein Match · ${money(KT.LIGA.money.F)} bis ${money(KT.LIGA.money.W)}</small></button>
            <button data-a="careerWoche" data-v="stunden">Tennisstunden geben <small>+ ${money(KT.STUNDEN_GELD)}, kein Match</small></button>
            <button data-a="careerWoche" data-v="pause">${W.off ? 'Urlaub machen' : 'Pause machen'} <small>danach 100 % frisch</small></button>
            ${W.off ? `<button data-a="careerWoche" data-v="vorbereitung">Saisonvorbereitung <small>hart trainieren · +${CA.VORBEREITUNG_XP} Erfahrung</small></button>` : ''}
          </div></div>`}
        <div class="panel">${playerCard(me, 'career', false)}
          <div class="row" style="margin-top:10px"><button class="grow" data-a="training" data-v="career" ${c.trainingLeft <= 0 || c.verletzung ? 'disabled' : ''}>Training (${c.trainingLeft} übrig)</button></div>
          ${c.skillPoints ? `<p class="gold">Du hast ${c.skillPoints} Fähigkeitspunkte zu verteilen!</p>` : ''}
          ${ausruestungKasten(c)}
          <p class="dim klein">Wildcards in dieser Saison: ${c.wildcards}. Mit einer Wildcard (Einladung) darfst du bei einem Turnier mitspielen, für das dein Platz knapp nicht reicht.</p></div>
      </div>`;
  } else if (careerTab === 'pokale') {
    // Pokalschrank: jeder Turniersieg mit Siegerfoto (das neueste zuerst)
    const symbol = { silber: '🏆', gold: '🏆', stern: '🌟' };
    body = c.pokale.length ? `<div class="grid">${[...c.pokale].reverse().map((p) => `<div class="panel teil pokalkarte">
        ${p.foto ? `<img src="${p.foto}" alt="Siegerfoto">` : `<div class="ohnefoto">${symbol[p.art] || '🏆'}</div>`}
        <b>${esc(p.name)}</b><div class="dim klein">${p.ort ? esc(p.ort) + ' · ' : ''}Saison ${p.jahr}, Woche ${p.woche}</div></div>`).join('')}</div>`
      : `<div class="panel center"><div style="font-size:56px">🏆</div><p>Dein Pokalschrank ist noch leer.</p>
        <p class="dim">Gewinne ein Turnier – dann steht hier dein Pokal mit dem Siegerfoto.</p></div>`;
  } else if (careerTab === 'kalender') {
    body = planerHtml(c);
  } else if (careerTab === 'rangliste') {
    const knoepfe = `<div class="row tabs">${[['welt', 'Weltrangliste'], ['race', 'ATP Race ' + c.season], ['meine', 'Meine Punkte']].map(([k, n]) => `<button class="${ranglisteTab === k ? 'sel' : ''}" data-a="ranglisteTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    const tabelle = (list, ich, text) => {
      const rows = list.filter((p, i) => i < 30 || p.me || Math.abs(i - list.indexOf(ich)) <= 4);
      return `<div class="panel scroll"><p class="dim klein" style="margin-top:0">${text}</p><table><tr><th class="num">Platz</th><th>Spieler</th><th class="num">Punkte</th></tr>
      ${rows.map((p, i) => `${i > 0 && list.indexOf(rows[i - 1]) < list.indexOf(p) - 1 ? '<tr><td colspan="3" class="dim center">…</td></tr>' : ''}
        <tr class="${p.me ? 'me' : ''}"><td class="num">${p.rank}</td><td>${flag(p.country)} ${esc(p.name)}${p.slam ? ' 🏆' : ''}${p.ref && p.ref.erfunden ? ' <span class="dim klein">(erfunden)</span>' : ''}</td><td class="num">${p.points.toLocaleString('de-DE')}</td></tr>`).join('')}
      </table></div>`;
    };
    if (ranglisteTab === 'welt') {
      const list = CA.ranking(c);
      body = knoepfe + tabelle(list, list.find((p) => p.me), `Es zählen die Ergebnisse der letzten 52 Wochen, höchstens ${KA.ZAEHLT_HOECHSTENS} Turniere. Alle Spieler spielen jede Woche irgendwo mit und sammeln oder verlieren Punkte.
        ${rk > D.PLAYERS.length ? 'Hinter den Top 200 kennen wir nicht alle Spieler der Welt einzeln. Dort wird der Platz aus den Punkten geschätzt.' : ''}`);
    } else if (ranglisteTab === 'race') {
      const list = CA.race(c);
      body = knoepfe + tabelle(list, raceIch, `Das ATP Race zählt nur die Punkte aus dem Jahr ${c.season}. Im Januar starten alle bei 0. Die besten 8 spielen im November die ATP Finals in Turin. 🏆 = hat dieses Jahr einen Grand Slam gewonnen.`);
    } else {
      const m = CA.meinePunkte(c), J = CA.jetzt(c);
      const zeile = (e, zaehlt) => `<tr class="${zaehlt ? '' : 'dim'}"><td>${esc(e.n || 'Turnier')}${e.k === 1 ? ' <span class="tag m">Pflicht</span>' : e.k === 2 ? ' <span class="tag f">zählt extra</span>' : ''}</td>
        <td>${e.label ? (e.label === 'W' ? '🏆 Sieg' : D.ROUND_NAMES[e.label]) : ''}</td><td class="num">${zaehlt ? e.p : '(' + e.p + ')'}</td><td class="num">${e.a + KA.WOCHEN_PRO_JAHR - J + 1} Wo.</td></tr>`;
      const sort = (l) => [...l].sort((x, y) => y.p - x.p);
      body = knoepfe + `<div class="panel scroll"><p style="margin-top:0">Deine Punkte: <b>${m.punkte.toLocaleString('de-DE')}</b> aus ${m.zaehlt.length} ${m.zaehlt.length === 1 ? 'Turnier' : 'Turnieren'}.</p>
        ${m.zaehlt.length + m.gestrichen.length ? `<table><tr><th>Turnier</th><th>Ergebnis</th><th class="num">Punkte</th><th class="num">zählt noch</th></tr>
        ${sort(m.zaehlt).map((e) => zeile(e, true)).join('')}${sort(m.gestrichen).map((e) => zeile(e, false)).join('')}</table>` : '<p class="dim">Noch keine Ergebnisse.</p>'}
        <p class="dim klein">So rechnet die echte ATP (Regeln 2026): Ein Ergebnis zählt 52 Wochen lang. Es zählen höchstens ${KA.ZAEHLT_HOECHSTENS} Turniere.
        Die 4 Grand Slams und 8 Masters (alle außer Monte-Carlo) sind Pflicht für alle, die dort mitspielen dürfen – sie zählen immer, auch mit 0 Punkten.
        Die übrigen Plätze füllen deine besten anderen Ergebnisse. Was in Klammern steht, zählt gerade nicht. Die ATP Finals zählen extra obendrauf.</p></div>`;
    }
  } else if (careerTab === 'skills') {
    const eff = CA.effectiveStats(c), liste = CA.bonusListe(c);
    body = `<div class="panel"><p>Freie Fähigkeitspunkte: <b class="gold">${c.skillPoints}</b> · Level ${c.level}. Punkte gibt es für jedes neue Level (Matches und Training bringen Erfahrung).</p>
      <table>${Object.keys(D.STAT_NAMES).map((k) => `<tr><td><b>${D.STAT_NAMES[k]}</b><br><small class="dim">${D.STAT_INFO[k]}</small></td>
        <td style="width:40%"><div class="stat" style="grid-template-columns:1fr 60px"><i><b style="width:${eff[k]}%"></b></i><span>${c.skills[k]}${eff[k] !== c.skills[k] ? ` <span class="${eff[k] > c.skills[k] ? 'gold' : 'minus'}">${eff[k] > c.skills[k] ? '+' : '−'}${Math.abs(eff[k] - c.skills[k])}</span>` : ''}</span></div></td>
        <td class="right"><button data-a="skill" data-v="${k}" ${c.skillPoints <= 0 || c.skills[k] >= AB.grenze(c, k) ? 'disabled' : ''}>+1</button><br><small class="dim">bis ${AB.grenze(c, k)}</small></td></tr>`).join('')}</table>
      <p class="dim klein">Allein kommst du bei jeder Fähigkeit nur bis ${AB.GRENZE_OHNE}. Für mehr brauchst du Spezial-Trainer – die findest du unter „Profi-Service“.</p>
      ${eff.kraft || eff.praez ? `<p class="dim klein">Von deiner Ausrüstung: ${[eff.kraft ? bonusText({ p: eff.kraft }) : '', eff.praez ? bonusText({ c: eff.praez }) : ''].filter(Boolean).join(', ')}. Kraft macht Vorhand und Rückhand härter, Präzision macht beide genauer.</p>` : ''}</div>
      <div class="panel"><h3 style="margin-top:0">Woher kommen deine Pluspunkte?</h3>
        ${liste.length ? `<table>${liste.map((b) => `<tr><td>${esc(b.name)}</td><td class="gold">${bonusText(b.bonus)}</td></tr>`).join('')}</table>` : '<p class="dim">Noch keine. Ausrüstung und ein gutes Team bringen Pluspunkte.</p>'}
        <p class="dim klein">Schuhe zählen für den Belag des Turniers (hier: Hartplatz).</p></div>`;
  } else if (careerTab === 'service') {
    // Profi-Service: Bespanner, Werkstatt, Ärzte, Spezial-Trainer, Profi-Schläge (Listen in ausbau.js)
    const stufenKarte = (id, B, liste, wirkung) => {
      const hab = AB.stufe(c, id), k = AB.kannKaufen(c, id, rk);
      return `<div class="panel"><h3 style="margin-top:0">${B.bild} ${esc(B.name)} <span class="tag">Stufe ${hab} von ${liste.length}</span></h3><p class="dim">${esc(B.text)}</p>
        <table>${liste.map((S, i) => `<tr class="${i > hab ? 'dim' : ''}"><td>${i < hab ? '✓' : i === hab ? '➜' : '🔒'} <b>${esc(S.name)}</b>${S.text ? `<br><small>${esc(S.text)}</small>` : ''}<br><small class="gold">${wirkung(S)}</small></td>
          <td class="right">${i < hab ? '<small class="dim">hast du</small>' : i === hab ? `<button data-a="ausbau" data-v="${id}" ${k.ok ? '' : 'disabled'}>${money(S.preis)}</button>${k.ok ? '' : `<br><small class="dim">${esc(k.warum)}</small>`}` : `<small>ab Platz ${S.abPlatz}<br>${money(S.preis)}</small>`}</td></tr>`).join('')}</table></div>`;
    };
    const wirkB = (S) => [S.bonus ? bonusText(S.bonus) : '', S.saiten ? `Saiten halten ${S.saiten} Match länger` : '', S.risiko ? `Verletzungsrisiko −${Math.round((1 - S.risiko) * 100)} %` : '', S.heilung ? `Verletzungen heilen ${Math.round((1 - S.heilung) * 100)} % schneller` : ''].filter(Boolean).join(' · ');
    const K = c.koerper && AB.KOERPER.find((x) => x.teil === c.koerper.teil);
    body = `<p>Dein Geld: <b class="gold">${money(c.money)}</b> · Platz ${rk}. <span class="dim">Je weiter vorn du stehst, desto mehr Fachleute arbeiten für dich. Jede Stufe kaufst du einmal.</span></p>
      <div class="panel"><h3 style="margin-top:0">🩹 Dein Körper</h3>
        ${c.verletzung ? `<div class="verletzt"><b>Verletzt: ${esc(c.verletzung.name)}</b> – noch ${c.verletzung.wochen} ${c.verletzung.wochen === 1 ? 'Woche' : 'Wochen'} Pause.</div>`
          : K ? `<p><b class="minus">Beschwerden: ${esc(K.leicht)}</b> (−${AB.BESCHWERDEN_ABZUG} ${D.STAT_NAMES[K.trifft]}). Mach eine Woche Pause oder geh auf der Turnieranlage zum Physio.</p>`
          : '<p><b class="plus">Alles in Ordnung.</b> Nichts zwickt.</p>'}
        <p class="dim klein">So bleibt man gesund: nicht müde spielen (Frische über ${AB.MUEDE} %), nach spätestens ${AB.SERIE_LANG - 1} Turnierwochen eine Pause machen (du bist bei ${c.serie || 0}),
          und bei Beschwerden nicht einfach weiterspielen. Wer das missachtet, fällt wochenlang aus und rutscht in der Rangliste ab. Alle Zahlen dazu sind geschätzt.</p></div>
      ${Object.entries(AB.BEREICHE).map(([id, B]) => stufenKarte(id, B, B.stufen, wirkB)).join('')}
      <h2>Spezial-Trainer</h2><p class="dim">Allein kommst du bei jeder Fähigkeit nur bis ${AB.GRENZE_OHNE}. Ein Spezial-Trainer hebt diese Grenze für seine Fähigkeiten. Die Punkte verteilst du weiter unter „Fähigkeiten“.</p>
      ${Object.entries(AB.SPEZIAL).map(([id, B]) => stufenKarte(id, B, AB.TRAINER_STUFEN, (S) => `${B.fuer.map((f) => D.STAT_NAMES[f]).join(' und ')} bis ${S.grenze}`)).join('')}
      <h2>Show-Schläge</h2><p class="dim">Besondere Schläge für die Zuschauer. Dafür braucht das Spiel eure eigenen Bewegungs-Aufnahmen – die Anleitung steht in <code>js/showschlaege.js</code>. Solange eine Aufnahme fehlt, spielt die Figur den normalen Schlag.</p>
      <div class="grid">${Object.values(SHOW).map((S) => `<div class="panel teil"><b>${esc(S.name)}</b><br><small class="dim">${esc(S.text)}</small><br>
        <small class="${mocapClip(S.clip) ? 'plus' : 'dim'}">${mocapClip(S.clip) ? '✓ Aufnahme gefunden' : `🔒 Aufnahme fehlt: mocap/${S.datei}.FBX`}</small>${c.showSchlaege && c.showSchlaege[S.clip] ? `<br><small class="gold">${c.showSchlaege[S.clip]}-mal gespielt</small>` : ''}</div>`).join('')}</div>
      <h2>Profi-Schläge</h2><p class="dim">Stärkere Arten von Schlägen, die du schon kennst. Lernen kann sie nur, wer die Fähigkeit dafür hat.</p>
      <div class="grid">${Object.entries(AB.TECHNIKEN).map(([id, T]) => { const k = AB.kannLernen(c, id);
        return `<div class="panel teil"><b>${T.bild} ${esc(T.name)}</b><br><small class="dim">${esc(T.text)}</small><br><small class="gold">braucht ${Object.entries(T.braucht).map(([f, w]) => `${D.STAT_NAMES[f]} ${w}`).join(', ')}</small><br>
          ${k.gelernt ? '<button class="sel" disabled style="margin-top:8px">✓ Gelernt</button>' : `<button data-a="technik" data-v="${id}" ${k.ok ? '' : 'disabled'} style="margin-top:8px">Lernen · ${money(T.preis)}</button>${k.ok ? '' : `<br><small class="dim">${k.key ? `Deine ${D.STAT_NAMES[k.key]} muss erst ${k.wert} sein (jetzt ${c.skills[k.key]}).` : esc(k.warum)}</small>`}`}</div>`; }).join('')}</div>`;
  } else if (careerTab === 'shop') {
    const karte = (s) => {
      const frei = CA.gratis(c, s, stufe), own = c.owned.includes(s.id) || frei, on = c.equipped[s.cat] === s.id;
      let info = '', knopf;
      if (s.cat === 'Schläger') info = `<span class="tag">${s.typ}</span><br><small class="gold">${bonusText(s.bonus)}</small>${s.profis ? `<br><small class="dim">Diese Reihe spielt z. B. ${esc(s.profis)}</small>` : ''}`;
      else if (s.cat === 'Saiten') info = `<small class="gold">${bonusText(s.bonus)}</small><br><small class="dim">${esc(s.text)} Hält ${CA.saitenLeben(c, s)} Matches.</small>`;
      else if (s.cat === 'Schuhe') info = `<small class="gold">Tempo: ${Object.entries(s.tempo).map(([b, v]) => `${BELAG_KURZ[b]} +${v}`).join(' · ')}</small><br><small class="dim">${esc(s.text)}</small>`;
      else info = `<small class="gold">${[s.bonus ? bonusText(s.bonus) : '', sterne(s.sterne)].filter(Boolean).join(' · ')}</small>${s.text ? `<br><small class="dim">${esc(s.text)}</small>` : ''}`;
      // Seltene Stücke bekommen ein farbiges Schild
      if (s.selten) info = `<span class="tag" style="background:${AU.SELTEN_FARBE[s.selten]};color:#111">${AU.SELTEN[s.selten]}</span> ` + info;
      const probe = ['Schläger', 'Schuhe', 'Outfit', 'Kopf'].includes(s.cat) ? ` <button class="ghost" data-a="anprobe" data-v="${s.id}" style="margin-top:8px">${anprobeId === s.id ? '👀 wird anprobiert' : 'Anprobieren'}</button>` : '';
      if (s.verdient && !own) {
        knopf = `<button disabled>🔒 Nicht zu kaufen</button><br><small class="dim">Bekommst du für ${esc(s.wofuer)}.</small>`;
      } else if (s.nur && !own && !CA.editionDa(c, s)) {
        const t = D.tournamentById(s.nur);
        knopf = `<button disabled>🔒 Nur im Turnier-Shop</button><br><small class="dim">Gibt es nur in der Woche von ${esc(t.name)} (${KA.datumKurz(c.season, KA.wocheVon(s.nur))}) – und nur, wenn du dort mitspielen darfst.</small>`;
      } else if (s.cat === 'Saiten') {
        knopf = on && c.saitenRest > 0 ? `<button class="sel" disabled>✓ Aufgezogen · noch ${c.saitenRest} ${c.saitenRest === 1 ? 'Match' : 'Matches'}</button>`
          : `<button data-a="buy" data-v="${s.id}" ${!frei && c.money < s.price ? 'disabled' : ''}>Bespannen · ${frei ? 'gratis' : money(s.price)}</button>`;
      } else if (s.cat === 'Schuhe') {
        knopf = own ? `<button class="sel" disabled>✓ Im Schrank${frei ? ' (vom Ausrüster)' : ''}</button>` : `<button data-a="buy" data-v="${s.id}" ${c.money < s.price ? 'disabled' : ''}>Kaufen · ${money(s.price)}</button>`;
      } else {
        knopf = own ? `<button class="${on ? 'sel' : ''}" data-a="equip" data-v="${s.id}">${on ? '✓ Im Einsatz' : frei ? 'Nehmen (vom Ausrüster)' : 'Nehmen'}</button>`
          : `<button data-a="buy" data-v="${s.id}" ${c.money < s.price ? 'disabled' : ''}>Kaufen · ${money(s.price)}</button>`;
      }
      const farbe = s.color != null ? s.color : s.shirt;
      return `<div class="panel teil" ${s.selten ? `style="border-color:${AU.SELTEN_FARBE[s.selten]}"` : ''}>${farbe != null ? `<i class="punkt" style="background:${hex(farbe)}"></i>` : ''}<b>${esc(s.name)}</b><br>${info}<br>${knopf.replace('<button', '<button style="margin-top:8px"')}${probe}</div>`;
    };
    const teile = AU.SHOP.filter((s) => s.cat === shopCat);
    const probeTeil = AU.shopById(anprobeId);
    // Anprobe: deine Figur in 3D, mit dem Teil, das du gerade anschaust
    const anprobe = `<div class="panel anprobe"><canvas id="anprobe" width="320" height="400"></canvas>
      <div><h3 style="margin-top:0">Anprobe</h3><p>${probeTeil ? `Du probierst an: <b>${esc(probeTeil.name)}</b>${c.owned.includes(probeTeil.id) ? '' : ' <span class="dim">(gehört dir noch nicht)</span>'}` : 'So sieht dein Spieler gerade aus.'}</p>
      <p class="dim klein">Tippe bei einem Schläger, Schuh, Outfit oder einer Kappe auf „Anprobieren“. Die Figur zeigt nur Farben und Formen – echte Marken-Logos gibt es im Spiel nicht.</p>
      ${probeTeil ? '<button class="ghost" data-a="anprobe" data-v="">Wieder meine eigenen Sachen zeigen</button>' : ''}</div></div>`;
    const marken = [...new Set(teile.map((s) => s.marke))];
    // Schläger nach Marke sortiert anzeigen, alles andere in einer Liste
    const liste = shopCat === 'Schläger'
      ? marken.map((m) => `<div class="panel"><h3 style="margin-top:0">${m}${c.vertrag.schlaeger === m && stufe >= 0 ? ' <span class="tag gs">dein Ausrüster</span>' : ''}</h3><div class="grid">${teile.filter((s) => s.marke === m).map(karte).join('')}</div></div>`).join('')
      : `<div class="panel"><div class="grid">${teile.map(karte).join('')}</div></div>`;
    // Sammlung: alles, was dir gehört – nach Seltenheit sortiert – und die Handtücher von deinen Turnieren
    let sammlung = '';
    if (shopCat === 'Sammlung') {
      const meins = AU.SHOP.filter((s) => s.cat !== 'Saiten' && c.owned.includes(s.id)).sort((a, b) => b.selten - a.selten);
      const zahl = (n) => AU.SHOP.filter((s) => s.cat !== 'Saiten' && s.selten === n);
      sammlung = `<div class="panel"><h3 style="margin-top:0">Deine Sammlung</h3>
        <div class="kpi">${AU.SELTEN.map((name, n) => `<div style="border-bottom:3px solid ${AU.SELTEN_FARBE[n]}"><b>${zahl(n).filter((s) => c.owned.includes(s.id)).length} / ${zahl(n).length}</b><span>${name}</span></div>`).join('')}
          <div><b>${c.handtuecher.length}</b><span>Turnier-Handtücher</span></div></div>
        <p class="dim klein">Seltene Stücke machen nicht stärker als normale – sie bringen Fans und sind etwas für Sammler. Turnier-Editionen gibt es nur vor Ort im Turnier-Shop, Sonderstücke nur für besondere Erfolge.</p></div>
        <div class="panel">${meins.length ? `<div class="grid">${meins.map(karte).join('')}</div>` : '<p class="dim">Noch nichts gekauft. Saiten zählen nicht zur Sammlung – die werden ja verbraucht.</p>'}</div>
        <div class="panel"><h3 style="margin-top:0">Noch zu holen: Sonderstücke</h3><div class="grid">${AU.SHOP.filter((s) => s.verdient && !c.owned.includes(s.id)).map(karte).join('') || '<p class="gold">Du hast alle Sonderstücke!</p>'}</div></div>
        <div class="panel"><h3 style="margin-top:0">🧺 Turnier-Handtücher</h3><p class="dim klein">Von jedem Turnier, bei dem du spielst, nimmst du ein Handtuch mit – das machen die echten Profis auch.</p>
          ${c.handtuecher.length ? `<div class="row">${c.handtuecher.map((h) => `<span class="tag ${h.cat === 'GS' ? 'gs' : ''}" title="zum ersten Mal ${h.jahr}">${esc(h.n)}${h.mal > 1 ? ' ×' + h.mal : ''}</span>`).join('')}</div>` : '<p class="dim">Noch keins. Spiel dein erstes Turnier!</p>'}</div>`;
    }
    body = `<p>Dein Geld: <b class="gold">${money(c.money)}</b></p>
      <div class="row tabs">${[...AU.SHOP_CATS, 'Sammlung'].map((k) => `<button class="${shopCat === k ? 'sel' : ''}" data-a="shopCat" data-v="${k}">${k}</button>`).join('')}</div>
      ${shopCat === 'Sammlung' ? sammlung : `<p class="dim">${AU.SHOP_INFO[shopCat]}</p>${anprobe}${liste}`}`;
  } else if (careerTab === 'team') {
    const person = (p, aktiv, extra) => `<div class="panel teil"><b>${p.name}</b><br><small class="dim">${p.text}</small><br><small class="gold">${extra}</small><br>
      <button class="${aktiv ? 'sel' : ''}" data-a="careerTeam" data-v="${p.id}" style="margin-top:8px">${aktiv ? '✓ In deinem Team' : p.lohn ? 'Einstellen · ' + money(p.lohn) + ' pro Woche' : 'Auswählen'}</button></div>`;
    const S = stufe >= 0 ? AU.VERTRAGS_STUFEN[stufe] : null;
    const next = AU.VERTRAGS_STUFEN[stufe + 1];
    const markenWahl = (art, liste) => `<div class="row">${liste.map((m) => `<button class="${c.vertrag[art] === m ? 'sel' : ''}" data-a="careerVertrag" data-v="${art}:${m}" ${S ? '' : 'disabled'}>${m}</button>`).join('')}
      ${c.vertrag[art] ? `<button class="ghost" data-a="careerVertrag" data-v="${art}:">Vertrag beenden</button>` : ''}</div>`;
    const sp = CA.sponsorGeld(c);
    body = `
      <div class="panel"><h3 style="margin-top:0">Trainer</h3><p class="dim">Ein Trainer bringt dir mehr Erfahrung pro Match und Training. Bezahlt wird jede Woche – auch wenn du früh verlierst.</p>
        <div class="grid">${AU.TRAINER.map((t) => person(t, c.trainer === t.id, [t.xp > 1 ? `+${Math.round((t.xp - 1) * 100)} % Erfahrung` : '', `${t.training}× Training`, t.bonus ? bonusText(t.bonus) : ''].filter(Boolean).join(' · '))).join('')}</div></div>
      <div class="panel"><h3 style="margin-top:0">Physio</h3><p class="dim">Jedes Match macht müde. Wer müde ist, läuft langsamer. Ein Physio sorgt dafür, dass du dich schneller erholst. Deine Frische: <b>${c.frische} %</b></p>
        <div class="grid">${AU.PHYSIOS.map((p) => person(p, c.physio === p.id, [`Erholung +${p.erholung} pro Woche`, `ein Match kostet ${p.last}`, p.bonus ? bonusText(p.bonus) : ''].filter(Boolean).join(' · '))).join('')}</div></div>
      <div class="panel"><h3 style="margin-top:0">Ausrüster</h3>
        <p>${S ? `Du bekommst zurzeit einen <b class="gold">${S.name}</b>: Die Sachen deiner Marke sind gratis${S.geld ? ` und die Marke zahlt dir <b>${money(S.geld)}</b> pro Turnier` : ', Geld gibt es aber noch keins'}.`
          : `Noch will dich keine Marke ausrüsten. Ab Platz ${AU.VERTRAGS_STUFEN[0].bisPlatz} bekommst du deinen ersten Vertrag.`}
          ${next ? `<span class="dim">Nächste Stufe ab Platz ${next.bisPlatz}: ${next.name} (${money(next.geld)} pro Turnier).</span>` : ''}</p>
        <p class="dim klein">Geld gibt es nur, wenn du auch mit dem Schläger bzw. im Outfit deiner Marke spielst. Ab dem Profi-Vertrag baut dir die Schläger-Marke deinen Schläger nach Maß (+1 Kraft, +1 Präzision).</p>
        <label>Schläger, Saiten und Tasche von</label>${markenWahl('schlaeger', AU.SCHLAEGER_MARKEN)}
        <label>Kleidung und Schuhe von</label>${markenWahl('kleidung', AU.KLEIDER_MARKEN)}</div>
      <div class="panel"><h3 style="margin-top:0">Sponsoren</h3>
        <p>Pro Turnier bekommst du zurzeit <b class="gold">${money(sp.summe)}</b>. Deine <b>${CA.fans(c)} ⭐ Fans</b> bringen dabei ${CA.fans(c) * AU.FAN_PROZENT} % extra.
          <span class="dim">Fans bekommst du durch Titel und schicke Outfits.</span></p>
        <table>${AU.GELDGEBER.map((g) => { const da = c.sponsoren.includes(g.id); const w = g.wenn;
          const bed = w.siege ? `nach ${w.siege} gewonnenen Matches` : w.titel ? 'nach deinem ersten Titel' : w.platz ? `ab Platz ${w.platz}` : '';
          return `<tr class="${da ? '' : 'dim'}"><td>${da ? '✓' : '🔒'} <b>${g.name}</b><br><small>${da ? g.text : 'Kommt ' + bed}</small></td><td class="num">${money(g.geld)}</td></tr>`; }).join('')}</table></div>`;
  }
  show(`<div class="bar">${back()}<h2>${flag(c.country)} ${esc(c.name)}</h2><button class="ghost" data-a="careerDelete">Karriere löschen</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="${careerTab === k ? 'sel' : ''}" data-a="career" data-v="${k}">${n}</button>`).join('')}</div>${body}`);
  const probeBild = document.getElementById('anprobe');
  if (probeBild) game.figurZeigen(probeBild, CA.anprobeLook(c, anprobeId), c.hand);
}
actions.anprobe = (v) => { anprobeId = v || null; keepScroll(renderCareer); };
actions.ranglisteTab = (v) => { ranglisteTab = v; keepScroll(renderCareer); };
actions.ausbau = (v) => { if (CA.ausbauKaufen(career, v)) sound.coin(); keepScroll(renderCareer); };
actions.technik = (v) => { if (CA.technikLernen(career, v)) sound.coin(); keepScroll(renderCareer); };
actions.skill = (v) => { CA.raiseSkill(career, v); keepScroll(renderCareer); };
actions.buy = (v) => { if (CA.buy(career, v)) sound.coin(); keepScroll(renderCareer); };
actions.equip = (v) => { CA.equip(career, v); keepScroll(renderCareer); };
actions.shopCat = (v) => { shopCat = v; keepScroll(renderCareer); };
actions.careerReise = (v) => { CA.setReise(career, v); keepScroll(renderCareer); };
actions.careerTeam = (v) => { CA.setTeam(career, v); keepScroll(renderCareer); };
actions.careerVertrag = (v) => { const [art, marke] = v.split(':'); CA.setVertrag(career, art, marke); keepScroll(renderCareer); };
// Zu einem Turnier reisen. v = 'turnier' oder 'turnier:wc' (mit Wildcard)
actions.careerPlay = (v) => {
  const [id, wc] = String(v || '').split(':');
  const T = CA.startTournament(career, id || undefined, wc === 'wc');
  if (!T) return renderCareer();
  baumTeil = null;
  ctxT = { T, def: D.tournamentById(T.defId), career: true };
  renderTournament();
};
actions.careerLiga = () => { const T = CA.ligaSpiel(career); if (!T) return renderCareer(); ctxT = { T, def: D.tournamentById(T.defId), career: true }; renderTournament(); };
actions.careerWoche = (v) => wocheZeigen(CA.wocheOhneTurnier(career, v));
let delArmed = false;
actions.careerDelete = (v, el) => {
  if (!delArmed) { delArmed = true; el.textContent = 'Wirklich löschen? Nochmal tippen'; setTimeout(() => { delArmed = false; }, 4000); return; }
  delArmed = false;
  CA.deleteCareer(); career = null; actions.home();
};

// ---------------------------------------------------------------
// Saison: mit einem echten Profi durchs Jahr, Punkte sammeln fürs ATP Race
// ---------------------------------------------------------------
const pickS = { me: 'zverev', page: 0 };
let saisonTab = 'start';

actions.saison = (v) => {
  if (!season) return renderSeasonPick();
  // Läuft gerade ein Turnier? Dann geht es dort weiter. (Über „‹ Zurück“ im Turnier kommt man mit v = 'start' zur Übersicht.)
  if (season.tournament && !v) return showSeasonTournament();
  if (['start', 'race', 'punkte'].includes(v)) saisonTab = v;
  enterMenu();
  renderSeason();
};
function showSeasonTournament() {
  ctxT = { T: season.tournament, def: D.tournamentById(season.tournament.defId), season: true };
  renderTournament();
}

function renderSeasonPick() {
  show(`
    <div class="bar">${back()}<h2>Neue Saison</h2><button class="primary" data-a="saisonNeu">Saison starten ›</button></div>
    <p class="dim">Such dir einen Profi aus. Mit ihm spielst du alle 4 Grand Slams und 9 Masters-Turniere.
    Für jedes Ergebnis gibt es Punkte im ATP Race. Schaffst du es unter die besten 8, darfst du zu den ATP Finals!</p>
    <div class="panel"><h3 style="margin-top:0">Dein Profi: ${esc(getPlayer(pickS.me).name)}</h3>${pageTabs('saisonSeite', pickS.page)}
      <div class="grid">${pagePlayers(pickS.page).map((p) => playerCard(p, 'saisonWahl', pickS.me === p.id)).join('')}</div></div>
    <button class="primary" data-a="saisonNeu">Saison starten ›</button>`);
}
actions.saisonSeite = (v) => { pickS.page = +v; keepScroll(renderSeasonPick); };
actions.saisonWahl = (v) => { pickS.me = v; keepScroll(renderSeasonPick); };
actions.saisonNeu = () => {
  season = SE.newSeason(pickS.me);
  SE.saveSeason(season);
  saisonTab = 'start';
  renderSeason();
};

function renderSeason() {
  const s = season, me = SE.seasonPlayer(s), ich = SE.myRace(s), def = SE.nextTournament(s);
  const table = SE.raceTable(s);
  const achter = table[SE.FINALS_PLAETZE - 1], neunter = table[SE.FINALS_PLAETZE];
  const dabei = SE.qualified(s);
  // Wie weit ist es bis zur Finals-Linie (Platz 8)?
  const abstand = ich.rank <= SE.FINALS_PLAETZE ? `${(ich.points - neunter.points).toLocaleString('de-DE')} P. vor Platz 9` : `${(achter.points - ich.points).toLocaleString('de-DE')} P. bis Platz 8`;
  const tabs = [['start', 'Saison'], ['race', 'ATP Race'], ['punkte', 'Punkte-Regeln']];
  let body = '';
  if (saisonTab === 'start') {
    let next;
    if (s.over) {
      const sieger = s.history[s.history.length - 1];
      next = `<div class="panel center"><h2 class="gold">Saison ${s.year} beendet</h2>
        <p>Du beendest das Jahr auf <b>Platz ${ich.rank}</b> im ATP Race mit <b>${ich.points.toLocaleString('de-DE')} Punkten</b> und ${s.titles} Titel${s.titles === 1 ? '' : 'n'}.</p>
        <p class="dim">ATP-Finals-Sieger: ${esc(sieger.champion)}</p>
        <button class="primary" data-a="saisonEnde">Neue Saison starten ›</button></div>`;
    } else {
      const finals = def.cat === 'F';
      const laeuft = !!s.tournament;
      next = `<div class="panel"><div class="dim">${laeuft ? 'Läuft gerade' : 'Als Nächstes'}</div>
        <h2 style="margin:6px 0">${def.name}</h2>
        <p>${catTag(def)} · ${def.city} · ${def.month} · ${D.SURFACE_NAMES[def.surface]}</p>
        <p class="dim">${finals ? 'Nur die besten 8 im Race. ' + (dabei ? 'Du bist dabei!' : 'Du hast es diesmal nicht geschafft – du kannst zuschauen.')
          : def.draw + ' Spieler · Sieger: ' + def.points.W.toLocaleString('de-DE') + ' Punkte'}</p>
        <div class="row"><button class="primary" data-a="${laeuft ? 'saisonWeiter' : 'saisonPlay'}">${laeuft ? 'Weiter im Turnier ›' : !finals || dabei ? 'Turnier spielen ›' : 'Turnier ansehen ›'}</button>
        ${!laeuft && !finals ? '<button data-a="saisonSkip">Auslassen</button>' : ''}</div></div>`;
    }
    body = `${timelineHtml(s)}
      <div class="cols">
        <div>${next}
          <div class="panel"><div class="kpi vier">
            <div><b>${ich.rank}.</b><span>ATP Race</span></div>
            <div><b>${ich.points.toLocaleString('de-DE')}</b><span>Punkte</span></div>
            <div><b class="${dabei ? 'gold' : ''}">${dabei ? '✓ dabei' : 'noch nicht'}</b><span>ATP Finals · ${abstand}</span></div>
            <div><b>${s.titles}</b><span>Titel</span></div>
          </div></div>
          <div class="panel">${playerCard(me, 'saison', false)}</div>
        </div>
        <div class="panel"><h3 style="margin-top:0">ATP Race – Stand</h3>${raceHtml(s, true)}
          <div class="center" style="margin-top:10px"><button data-a="saison" data-v="race">Ganze Tabelle ›</button></div></div>
      </div>`;
  } else if (saisonTab === 'race') {
    body = `<div class="panel"><p class="dim" style="margin-top:0">Alle starten im Januar bei 0. Die besten 8 nach dem Paris Masters fahren zu den ATP Finals. 🏆 = hat dieses Jahr einen Grand Slam gewonnen.</p>${raceHtml(s, false)}</div>`;
  } else {
    body = pointsHtml();
  }
  show(`<div class="bar">${back()}<h2>${flag(me.country)} ${esc(me.name)} <small class="dim">Saison ${s.year}</small></h2><button class="ghost" data-a="saisonDelete">Saison löschen</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="${saisonTab === k ? 'sel' : ''}" data-a="saison" data-v="${k}">${n}</button>`).join('')}</div>${body}`);
  // Die Zeitleiste so hinschieben, dass „Du bist hier“ in der Mitte steht
  const now = $('#tlNow'), box = screen.querySelector('.tlscroll');
  if (box) box.scrollLeft = now ? Math.max(0, now.offsetLeft - box.clientWidth / 2 + now.offsetWidth / 2) : box.scrollWidth;
}
actions.saisonPlay = () => { SE.startTournament(season); showSeasonTournament(); };
actions.saisonWeiter = () => showSeasonTournament();
actions.saisonSkip = () => {
  const T = SE.startTournament(season, true);
  TN.simulateRest(T);
  SE.saveSeason(season);
  showSeasonTournament();
};
function seasonTournamentDone() {
  const s = SE.finishTournament(season);
  const lines = [
    s.label ? `Dein Ergebnis: <b>${s.label === 'W' ? 'Turniersieg 🏆' : D.ROUND_NAMES[s.label]}</b>` : 'Du hast nicht mitgespielt.',
    `Punkte fürs ATP Race: <b class="gold">+${s.points.toLocaleString('de-DE')}</b>`,
    `Du stehst jetzt auf <b>Platz ${s.rank}</b> im Race (${s.total.toLocaleString('de-DE')} Punkte).`,
  ];
  if (s.finalsQualified === true) lines.push('<b class="gold">Geschafft! Du bist unter den besten 8 und fährst zu den ATP Finals nach Turin!</b>');
  if (s.finalsQualified === false) lines.push('Für die ATP Finals hat es diesmal leider nicht gereicht.');
  if (s.seasonOver) lines.push('<b>Die Saison ist zu Ende!</b>');
  if (s.label === 'W') sound.coin();
  saisonTab = 'start';
  showInfo(s.name, lines.join('<br>'), 'saisonStart');
}
actions.saisonStart = () => actions.saison('start');
actions.saisonEnde = () => { season = null; SE.deleteSeason(); renderSeasonPick(); };
let delSeasonArmed = false;
actions.saisonDelete = (v, el) => {
  if (!delSeasonArmed) { delSeasonArmed = true; el.textContent = 'Wirklich löschen? Nochmal tippen'; setTimeout(() => { delSeasonArmed = false; }, 4000); return; }
  delSeasonArmed = false;
  SE.deleteSeason(); season = null; actions.home();
};

// ---------------------------------------------------------------
// Match starten, Anzeige, Pause, Ergebnis
// ---------------------------------------------------------------
// o: { me, opp, def, mode, title, onEnd(res) }
function startMatch(o) {
  // Kamera-Steuerung an, aber noch nicht eingemessen? Dann zuerst zum Kamera-Bildschirm, danach geht es hier weiter.
  if (settings.kamera !== 'aus' && !kameraLauf.bereit) { kameraDanach = () => startMatch(o); return actions.kamera(); }
  if (settings.kamera !== 'aus' && kameraBild.status === 'aus') kameraBild.start(kameraBild.kameraId);
  hide();
  const len = D.LENGTHS[settings.length];
  const mode = o.mode || 'match';
  menuVenue = o.def.id;
  game.loadVenue(o.def);
  game.setPlayers(o.me, o.opp);
  // In der Karriere steht deine Schlägertasche neben der Bank
  const tasche = career && o.me && o.me.me ? CA.traegt(career, 'Tasche') : null;
  game.tascheZeigen(tasche ? tasche.color ?? 0x2a2a34 : null);
  game.showAvatars(true);
  controls.setMode(settings.control);
  controls.enabled = true;
  const names = [o.me.short, o.opp.short];
  session = { o, names, over: false, mode };
  match = new Match({
    players: [o.me, o.opp], human: 0, surface: o.def.surface, difficulty: settings.difficulty,
    sets: len.sets, games: len.games, mode, balls: o.balls, assist: settings.assist, controlMode: settings.control,
    finale: !!o.finale,      // im Endspiel heißt der Matchball "Championship Point"
  }, game.makeFx(names), controls);
  game.attach(match, hud);
  paused = false;
  hudEl.hidden = false;
  $('#trainBox').classList.toggle('on', mode !== 'match');
  $('#scoreboard').style.display = mode === 'match' ? '' : 'none';
  $('#hint').textContent = {
    touch: 'Links: laufen · Rechts: nach oben wischen = Schlag · unten = Stopp · Doppeltipp = Lob',
    klassik: 'Mausrad/←→ zielen · Linke Taste halten = Kraft · Doppelklick = Lob · ↑↓ laufen',
    controller: 'Schwingen oder A = Schlag · B Slice · X Lob · Y Stopp · früh = links, spät = rechts',
    profi: 'WASD laufen · Leertaste Topspin · U gerade · O hoher Topspin · K Slice · L Lob · I Stopp · Richtung beim Treffen halten',
  }[settings.control] + (settings.kamera !== 'aus' ? ' · 📷 laufen mit der Kamera' : '');
  // Auf dem Handy blendet sich der Hinweis nach ein paar Sekunden aus (siehe style.css). Dafür die Klasse neu setzen.
  $('#hint').classList.remove('kurz'); void $('#hint').offsetWidth; $('#hint').classList.add('kurz');
  hud.update();
  hud.message(o.title || '', 'info');
  sound.setCrowd(0.05);
}

let msgTimer = 0, toastTimer = 0, speedTimer = 0;
const hud = {
  update() {
    if (!match || match.mode !== 'match') return;
    const sc = match.score, pts = sc.pointLabels(), n = session.names;
    const row = (i) => `<tr><td class="nm"><span class="dot ${sc.server === i ? 'on' : ''}"></span> ${esc(n[i])}</td>
      ${sc.sets.map((s) => `<td class="set">${s[i]}</td>`).join('')}
      ${sc.winner === null ? `<td class="gm">${sc.games[i]}</td><td class="pt">${pts[i]}</td>` : ''}</tr>`;
    $('#scoreboard').innerHTML = `<div class="ttl">${esc(session.o.title || '')}${sc.tiebreak ? ' · Tiebreak' : ''}</div><table>${row(0)}${row(1)}</table>`;
  },
  point(head, sub) {
    $('#msgHead').textContent = head; $('#msgSub').textContent = sub;
    $('#msg').classList.add('on');
    msgTimer = 1.9;
  },
  message(text, kind) {
    if (!text) return;
    const t = $('#toast');
    t.textContent = text; t.className = 'on ' + (kind || '');
    toastTimer = kind === 'wichtig' ? 2.6 : 1.6;     // wichtige Hinweise bleiben etwas länger stehen
  },
  serveSpeed(kmh, side, art) {
    const s = $('#speed');
    // Bei Slice, Kick und "von unten" steht die Art dabei, damit man sieht, was da gerade kam
    const name = art && art !== 'gerade' && AUFSCHLAEGE[art] ? AUFSCHLAEGE[art].name + ' · ' : '';
    s.textContent = name + kmh + ' km/h'; s.classList.add('on');
    speedTimer = 2.5;
  },
  training(tr, pts, ok) {
    $('#trainBox').innerHTML = `${tr.score} Punkte<small>Ball ${Math.min(tr.done + 1, tr.balls)} von ${tr.balls} · Gelb = 5, Blau = 3</small>`;
    if (pts !== undefined) hud.message(ok ? (pts >= 3 ? `Zielfeld! +${pts}` : `Im Feld +${pts}`) : 'Daneben', pts >= 3 ? 'info' : ok ? '' : 'warn');
  },
  trainingOver(tr) {
    session.over = true;
    setTimeout(() => showResult({ training: tr }), 600);
  },
  matchOver(score) {
    session.over = true;
    setTimeout(() => showResult({ score }), 400);
  },
};

// Zum Fehlersuchen bei Controller, iPhone-Schläger und Apple Watch: Einmal pro Sekunde steht unten im Spiel,
// was gerade ankommt. "Meldungen/s" sollte um die 60 liegen, wenn ein Schläger verbunden ist.
let diagZeit = 0, diagPakete = 0;
function diagFrame(dt) {
  if (settings.control !== 'controller') return;
  diagZeit += dt;
  if (diagZeit < 1) return;
  const d = controls.diag, proSek = Math.round((d.pakete - diagPakete) / diagZeit);
  diagZeit = 0; diagPakete = d.pakete;
  const el = $('#hint');
  el.classList.remove('kurz');
  el.textContent = `🎮 ${controls.pad.connected ? controls.pad.name : 'nichts verbunden'} · ${proSek} Meldungen/s · ⌚ ${d.uhr} Uhr-Schwünge (letzter: ${d.letzter})`;
}

function hudFrame(dt) {
  if (hudEl.hidden) return;
  diagFrame(dt);
  kameraMini(dt);
  const off = (t, el) => { if (t > 0 && t - dt <= 0) el.classList.remove('on'); return t - dt; };
  msgTimer = off(msgTimer, $('#msg'));
  toastTimer = off(toastTimer, $('#toast'));
  speedTimer = off(speedTimer, $('#speed'));
  const h = controls.hud(), bar = $('#power');
  const myTurn = match && ((match.state === 'serveReady' && match.server === 0) || (match.state === 'rally' && match.ball.lastHitter === 1));
  const on = h.show && myTurn && !session.over && h.type !== 'lob';
  bar.classList.toggle('on', !!on);
  // Aufschlagart wählen: nur solange du selbst aufschlägst und der Ball noch in der Hand ist
  const wahl = $('#aufschlagWahl');
  const waehlen = !!match && match.state === 'serveReady' && match.server === 0 && match.P[0].isHuman && !session.over && !paused;
  wahl.classList.toggle('on', waehlen);
  if (waehlen) {
    const art = controls.aufschlagArt || standardAufschlag(match.score.serveNo);
    for (const b of wahl.children) b.classList.toggle('an', b.dataset.art === art);
  }
  if (on) {
    const f = $('#powerFill');
    f.style.width = Math.min(100, h.power / h.max * 100) + '%';
    f.classList.toggle('over', h.power > h.limit);
    $('#powerLimit').style.width = (1 - h.limit / h.max) * 100 + '%';
  }
}

function togglePause() {
  if (!match || !session || session.over) return;
  paused = !paused;
  controls.enabled = !paused;
  if (paused) {
    show(`<div class="panel modal"><h2>Pause</h2><div class="menu">
      <button class="primary" data-a="resume">Weiterspielen</button>
      <button data-a="settings" data-v="pauseMenu">Einstellungen</button>
      <button data-a="help" data-v="pauseMenu">Steuerung</button>
      <button data-a="quit">${session.mode === 'match' ? 'Match aufgeben' : 'Training beenden'}</button></div></div>`);
  } else hide();
}
actions.resume = () => { if (paused) togglePause(); };
actions.pauseMenu = () => { paused = false; togglePause(); };
actions.quit = () => {
  const o = session.o;
  const training = match ? match.training : { score: 0 };
  session.over = true;
  endMatch();
  enterMenu();
  o.onEnd({ won: false, aborted: true, score: 'Aufgabe', setDiff: 2, training });
};

function endMatch() {
  kameraBild.stop();                // Kamera aus, das Einmessen bleibt gemerkt
  controls.enabled = false;
  controls.showStick(false);
  hudEl.hidden = true;
  paused = false;
}

function showResult(r) {
  const o = session.o;
  endMatch();
  if (r.training) {
    const tr = r.training;
    const max = tr.balls * 5;
    sound.applause(0.6, tr.score > max * 0.4);
    pendingEnd = () => o.onEnd({ won: true, training: tr });
    return show(`<div class="panel modal"><h2>Training beendet</h2><div class="score gold">${tr.score} Punkte</div>
      <p class="center dim">von höchstens ${max} Punkten</p><div class="center"><button class="primary" data-a="resultNext">Weiter</button></div></div>`);
  }
  const sc = r.score, won = sc.winner === 0, n = session.names, st = sc.stats;
  const line = (label, f) => `<tr><td class="num">${f(st[0])}</td><td class="center dim">${label}</td><td>${f(st[1])}</td></tr>`;
  const res = { won, score: sc.sets.map((s) => `${s[0]}:${s[1]}`).join(' '), setDiff: Math.abs(sc.setsWon[0] - sc.setsWon[1]), stats: st };
  pendingEnd = () => o.onEnd(res);
  show(`<div class="panel modal"><h2 class="${won ? 'gold' : ''}">${won ? '🏆 Sieg!' : 'Niederlage'}</h2>
    <div class="score">${res.score}</div>
    <table><tr><th class="num">${esc(n[0])}</th><th></th><th>${esc(n[1])}</th></tr>
      ${line('Punkte', (s) => s.points)}${line('Asse', (s) => s.aces)}${line('Doppelfehler', (s) => s.doubleFaults)}
      ${line('Winner', (s) => s.winners)}${line('Fehler', (s) => s.errors)}
      ${line('1. Aufschlag im Feld', (s) => (s.firstTotal ? Math.round(100 * s.firstIn / s.firstTotal) + ' %' : '–'))}</table>
    <div class="center" style="margin-top:14px"><button class="primary" data-a="resultNext">Weiter</button></div></div>`);
}
let pendingEnd = null;
actions.resultNext = () => { const f = pendingEnd; pendingEnd = null; enterMenu(); if (f) f(); };

// ---------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  controls.pollPad();               // Controller im Browser abfragen (auch in der Pause, wegen der Pause-Taste)
  if (match && !paused) {
    controls.update(dt);
    match.update(dt);
  }
  game.frame(match && paused ? 0 : dt);
  hudFrame(dt);
  kameraFrame();
  requestAnimationFrame(loop);
}

// Für Tests: das Spiel von Hand um n Bilder weiterdrehen
function step(n = 60) {
  for (let i = 0; i < n; i++) {
    if (match && !paused) { controls.update(1 / 60); match.update(1 / 60); }
    game.frame(1 / 60);
    hudFrame(1 / 60);
  }
}
// iPad/iPhone: Wechselt man zu einer anderen App oder sperrt den Bildschirm, macht das Spiel Pause.
// Kommt man zurück, wird der Ton wieder aufgeweckt (iOS hält ihn sonst an).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (match && !paused) togglePause(); } else if (sound.ctx) sound.unlock();
});

// ---------------------------------------------------------------
// Menüs mit dem Controller bedienen (z. B. wenn das Spiel auf dem Fernseher läuft)
// ---------------------------------------------------------------
// Ein Knopf ist "ausgewählt" (gelber Rahmen, Klasse .fokus). Der Stick springt zum nächsten Knopf
// in der gedrückten Richtung, A drückt den Knopf, B drückt "Zurück".
function menuTaste(was) {
  if (!screen.classList.contains('on')) return;
  const knoepfe = [...screen.querySelectorAll('button:not(:disabled)')];
  if (!knoepfe.length) return;
  let jetzt = screen.querySelector('button.fokus');
  if (was === 'zurueck') {
    const z = knoepfe.find((b) => b.textContent.includes('Zurück')) || screen.querySelector('[data-a="resume"]');
    if (z) z.click();
    return;
  }
  if (was === 'ok' && jetzt) { jetzt.click(); return; }       // ist noch nichts ausgewählt, wählt A zuerst den wichtigsten Knopf aus
  let ziel = null;
  if (!jetzt || was === 'ok') {
    ziel = screen.querySelector('button.primary') || knoepfe[0];      // noch nichts ausgewählt: beim wichtigsten Knopf anfangen
  } else {
    // Den nächsten Knopf in der Richtung suchen: Wir vergleichen die Mittelpunkte der Knöpfe.
    const mitte = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const a = mitte(jetzt), [rx, ry] = { links: [-1, 0], rechts: [1, 0], hoch: [0, -1], runter: [0, 1] }[was];
    let best = Infinity;
    for (const k of knoepfe) {
      if (k === jetzt) continue;
      const b = mitte(k), dx = b.x - a.x, dy = b.y - a.y;
      const vor = dx * rx + dy * ry;                 // wie weit liegt der Knopf in der gewünschten Richtung?
      const quer = Math.abs(dx * ry) + Math.abs(dy * rx);     // und wie weit daneben?
      if (vor < 8) continue;
      const kosten = vor + quer * 2.5;
      if (kosten < best) { best = kosten; ziel = k; }
    }
  }
  if (!ziel) return;
  if (jetzt) jetzt.classList.remove('fokus');
  ziel.classList.add('fokus');
  ziel.scrollIntoView({ block: 'nearest' });
  sound.click();
}
controls.onMenu = menuTaste;
controls.onHint = (text) => hud.message(text, 'warn');

// Nur in der iOS-App: Dieses Gerät wird zum Schläger für ein anderes (z. B. iPhone für das Spiel auf dem iPad).
actions.schlaeger = () => window.webkit.messageHandlers.powershot.postMessage('schlaeger');

// Controller: Die Pause-Taste hält das Spiel an. Die iOS-App meldet den Controller über diese beiden Funktionen.
controls.onPause = () => togglePause();
window.__powershotPad = (s) => { controls.nativePad = true; controls.setPad(s); };
window.__powershotPadWeg = () => { controls.nativePad = false; controls.padWeg(); };

window.__powershot = { game, controls, settings, step, kameraLauf, kameraBild, get match() { return match; }, get career() { return career; }, get season() { return season; }, actions };
// Das Spielermodell laden (höchstens 8 Sekunden warten – sonst geht es mit den einfachen Figuren los)
await Promise.race([Promise.all([loadFigure(), loadMocap(), ladeRequisiten()]), new Promise((r) => setTimeout(r, 8000))]);
$('#loading').remove();
actions.home();
requestAnimationFrame(loop);
