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
import { loadMocap } from './mocap.js';
import * as D from './data.js';
import * as TN from './tournament.js';
import * as CA from './career.js';
import * as AU from './ausruestung.js';
import * as KT from './kleinetour.js';
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
// Die 100 Spieler in Seiten zu je 20: Knöpfe "1–20", "21–40" …
const pageOf = (id) => { const p = D.playerById(id); return p ? Math.floor((p.rank - 1) / 20) : 0; };
const pagePlayers = (page) => D.PLAYERS.slice(page * 20, page * 20 + 20);
const pageTabs = (act, page) => `<div class="row tabs">${[0, 1, 2, 3, 4].map((i) =>
  `<button class="${i === page ? 'sel' : ''}" data-a="${act}" data-v="${i}">Platz ${i * 20 + 1}–${i * 20 + 20}</button>`).join('')}</div>`;
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
actions.tourStart = () => {
  const def = D.tournamentById(tour.def);
  let list = D.PLAYERS.slice(0, def.draw);
  if (!list.some((p) => p.id === tour.me)) list = [...list.slice(0, def.draw - 1), getPlayer(tour.me)].sort((a, b) => a.rank - b.rank);
  ctxT = { T: TN.createTournament(def, list, tour.me), def, career: false, exit: 'home' };
  renderTournament();
};

// Gemeinsame Turnier-Ansicht (einzelnes Turnier und Karriere)
let ctxT = null;
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
  } else if (m) {
    const oppId = m.a === T.humanId ? m.b : m.a;
    const opp = getPlayer(oppId), me = getPlayer(T.humanId);
    top = `<div class="panel"><div class="center dim">${def.cat === 'LIGA' ? 'Liga-Spiel' : D.ROUND_NAMES[label]}${m.group != null ? ' · Gruppe ' + 'AB'[m.group] : ''}</div>
      <div class="vs"><div><div class="who">${flag(me.country)} ${esc(me.short)}</div><div class="dim">Stärke ${D.overall(me.stats)}</div></div>
      <div class="x">gegen</div>
      <div><div class="who">${flag(opp.country)} ${esc(opp.short)}</div><div class="dim">${def.cat === 'LIGA' ? 'Spieler des anderen Vereins' : 'Nr. ' + T.players[oppId].seed + ' der Setzliste'} · Stärke ${D.overall(opp.stats)}</div></div></div>
      <div class="center"><button class="primary" data-a="tourPlay">Match spielen ›</button></div></div>`;
  } else {
    top = `<div class="panel center"><p>${T.humanId ? 'Du bist ausgeschieden.' : 'Du spielst dieses Turnier nicht mit.'}</p>
      <button class="primary" data-a="tourSim">Turnier zu Ende spielen lassen</button></div>`;
  }
  // In der Saison kommt man vom Turnier zurück zur Übersicht (das Turnier bleibt gespeichert)
  const zurueck = ctxT.season ? '<button class="ghost" data-a="saison" data-v="start">‹ Saison</button>' : '';
  show(`<div class="bar">${zurueck}<h2>${def.name} ${catTag(def)}</h2><span class="dim">${def.city} · ${D.SURFACE_NAMES[def.surface]}</span></div>${top}${bracketHtml(T, def)}`);
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
      if (ctxT.career) {
        // Müde werden, Saiten abnutzen, Erfahrung sammeln
        const ups = CA.matchGespielt(career, res.won, roundIdx);
        CA.saveCareer(career);
        if (ups) return showInfo('Level ' + career.level + '!', 'Du hast 3 neue Fähigkeitspunkte bekommen. Verteile sie im Karriere-Menü unter „Fähigkeiten“.', 'tourShow');
      }
      renderTournament();
    },
  });
};
actions.tourShow = () => renderTournament();
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
  else lines.push(s.cat === 'pause' ? 'Du hast dich ausgeruht und bist wieder ganz frisch.' : 'Du hast eine Woche lang Kindern Tennis beigebracht.');
  if (s.grossSieger) lines.push(`<span class="dim">${esc(s.grossName)} hat ${esc(s.grossSieger)} gewonnen.</span>`);
  if (r.wildcard) lines.push('<span class="dim">Du hast eine Wildcard eingesetzt.</span>');
  if (r.teamWeg) lines.push('<b>Dein Geld hat für das Team nicht gereicht.</b> Trainer und Physio haben gekündigt.');
  lines.push(`<table class="rechnung">${zeilen.join('')}<tr class="summe"><td>Diese Woche</td><td class="num ${s.netto >= 0 ? 'plus' : 'minus'}">${s.netto >= 0 ? '+' : '−'} ${money(Math.abs(s.netto))}</td></tr></table>`);
  lines.push(`Du stehst jetzt auf <b>Platz ${s.rank}</b> der Weltrangliste und hast <b class="gold">${money(career.money)}</b>.`);
  for (const g of s.neueSponsoren) lines.push(`<b class="gold">Neuer Sponsor: ${esc(g.name)}!</b> ${esc(g.text)} (${money(g.geld)} pro Turnier)`);
  if (s.seasonOver) lines.push(`<b>Die Saison ist zu Ende!</b> Weiter geht es mit der Saison ${career.season}. Du hast wieder ${CA.WILDCARDS_PRO_SAISON} Wildcards.`);
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

actions.career = (v) => {
  if (!career) return renderCreate();
  if (career.tournament) { ctxT = { T: career.tournament, def: D.tournamentById(career.tournament.defId), career: true }; return renderTournament(); }
  if (['start', 'kalender', 'rangliste', 'skills', 'shop', 'team'].includes(v)) careerTab = v;
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
    <p class="dim">Du startest ganz unten: Platz 2000 der Weltrangliste, ${money(CA.START_GELD)} und 10 Fähigkeitspunkte. Zuerst spielst du kleine ITF-Turniere – und arbeitest dich hoch bis nach Wimbledon.</p>
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
const bonusText = (b) => Object.entries(b).map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${D.STAT_NAMES[k]}`).join(', ');
const sterne = (n) => (n ? '⭐'.repeat(n) : '');
const BELAG_KURZ = { hard: 'Hartplatz', clay: 'Sand', grass: 'Rasen', indoor: 'Halle' };
let shopCat = 'Schläger';

// Ein Turnier, das diese Woche zur Auswahl steht
function angebotKarte(a) {
  const { def, zugang, kosten, fehlt } = a, c = career;
  const ort = def.klein ? `${def.city} · ${KT.ERDTEILE[def.erdteil]}` : `${def.city} · ${KT.ERDTEILE[KT.ERDTEIL_GROSS[def.id]]}`;
  const sieg = def.cat === 'F' ? 'Die besten 8 des Jahres' : `${def.draw} Spieler · Sieg: ${def.points.W} Punkte und ${money(def.money.W)}`;
  const teile = [`Flug ${money(kosten.flug)}`];
  if (kosten.hotel) teile.push(`Hotel ${money(kosten.hotel)}`);
  teile.push(`Essen ${money(kosten.essen)}`);
  const reise = `Reise: <b>${money(kosten.summe)}</b> <span class="dim">(${teile.join(' + ')}${kosten.hotel ? '' : ' · das Hotel zahlt das Turnier'})</span>`;
  let knopf;
  if (!zugang.ok && !zugang.wildcard) knopf = `<button disabled>🔒 Erst ab Platz ${zugang.bis}</button>`;
  else if (fehlt) knopf = `<button disabled>Dir fehlen ${money(fehlt)}</button>`;
  else if (!zugang.ok) knopf = `<button data-a="careerPlay" data-v="${def.id}:wc">🎟️ Mit Wildcard hinreisen (noch ${c.wildcards})</button>`;
  else knopf = `<button class="primary" data-a="careerPlay" data-v="${def.id}">Hinreisen und spielen ›</button>`;
  return `<div class="angebot ${zugang.ok ? '' : 'zu'}">
    <div class="kopf"><b>${esc(def.name)}</b> ${catTag(def)}</div>
    <div class="dim">${esc(ort)} · ${BELAG_KURZ[def.surface]} · ${sieg}</div>
    <div>${reise}</div>${knopf}</div>`;
}

function frischeBalken(f) {
  const farbe = f >= 70 ? '#3ad87a' : f >= 50 ? '#f2c02a' : '#e8442a';
  return `<i class="frische"><b style="width:${f}%;background:${farbe}"></b></i>`;
}

function renderCareer() {
  const c = career, me = CA.mePlayer(c), rk = CA.myRank(c), def = CA.nextTournament(c), stufe = CA.vertragsStufe(c);
  const tabs = [['start', 'Übersicht'], ['shop', 'Ausrüstung'], ['team', 'Team & Sponsoren'], ['skills', 'Fähigkeiten' + (c.skillPoints ? ' ●' : '')], ['kalender', 'Kalender'], ['rangliste', 'Weltrangliste']];
  let body = '';
  if (careerTab === 'start') {
    const sp = CA.sponsorGeld(c), lohn = CA.lohn(c), muede = CA.frischeAbzug(c.frische);
    const saite = CA.traegt(c, 'Saiten');
    const tipps = [];
    if (!CA.traegt(c, 'Schläger')) tipps.push('Du spielst noch mit dem alten Vereinsschläger. Unter „Ausrüstung“ gibt es bessere.');
    if (saite && c.saitenRest <= 0) tipps.push('Deine Saiten sind müde und bringen nichts mehr. Lass unter „Ausrüstung“ neu bespannen.');
    if (c.frische < 70) tipps.push(`Du bist müde (${bonusText(muede)}). Eine Pause oder ein Physio hilft.`);
    if (stufe >= 0 && !c.vertrag.schlaeger) tipps.push('Eine Schläger-Marke würde dich ausrüsten! Schau unter „Team & Sponsoren“.');
    body = `
      <div class="panel"><div class="kpi">
        <div><b>${rk}.</b><span>Weltrangliste · ${CA.ranking(c).find((p) => p.me).points} Punkte</span></div>
        <div><b class="gold">${money(c.money)}</b><span>Geld</span></div>
        <div><b>${c.frische} %</b>${frischeBalken(c.frische)}<span>Frische</span></div>
        <div><b>${CA.fans(c)} ⭐</b><span>Fans</span></div>
        <div><b>Level ${c.level}</b><span>${c.xp} / ${CA.xpNeed(c.level)} Erfahrung</span></div>
        <div><b>${c.titles}</b><span>Titel</span></div>
      </div>${tipps.map((t) => `<p class="tipp">💡 ${t}</p>`).join('')}</div>
      <div class="cols breit">
        <div class="panel"><div class="dim">Saison ${c.season} · ${def.month} · Woche ${c.week + 1} von ${D.TOURNAMENTS.length}</div>
          <h2 style="margin:6px 0">Wohin reist du diese Woche?</h2>
          <label>So reist du</label><div class="row">${Object.entries(AU.REISEN).map(([k, r]) => `<button class="${c.reise === k ? 'sel' : ''}" data-a="careerReise" data-v="${k}">${r.name}</button>`).join('')}</div>
          <p class="dim klein">${AU.REISEN[c.reise].text} ${AU.REISEN[c.reise].frische ? `(Frische ${AU.REISEN[c.reise].frische > 0 ? '+' : '−'}${Math.abs(AU.REISEN[c.reise].frische)})` : ''}
            ${lohn ? ` · Dein Team kostet ${money(lohn)} pro Woche.` : ''}${sp.summe ? ` · Deine Sponsoren zahlen ${money(sp.summe)} pro Turnier.` : ''}</p>
          ${CA.angebot(c).map(angebotKarte).join('')}
          <label>Oder bleib zu Hause</label>
          <div class="row">
            <button data-a="careerLiga">Liga-Spiel für den Verein <small>ein Match · ${money(KT.LIGA.money.F)} bis ${money(KT.LIGA.money.W)}</small></button>
            <button data-a="careerWoche" data-v="stunden">Tennisstunden geben <small>+ ${money(KT.STUNDEN_GELD)}, kein Match</small></button>
            <button data-a="careerWoche" data-v="pause">Pause machen <small>danach 100 % frisch</small></button>
          </div></div>
        <div class="panel">${playerCard(me, 'career', false)}
          <div class="row" style="margin-top:10px"><button class="grow" data-a="training" data-v="career" ${c.trainingLeft <= 0 ? 'disabled' : ''}>Training (${c.trainingLeft} übrig)</button></div>
          ${c.skillPoints ? `<p class="gold">Du hast ${c.skillPoints} Fähigkeitspunkte zu verteilen!</p>` : ''}
          <p class="dim klein">Wildcards in dieser Saison: ${c.wildcards}. Mit einer Wildcard (Einladung) darfst du bei einem Turnier mitspielen, für das dein Platz knapp nicht reicht.</p></div>
      </div>`;
  } else if (careerTab === 'kalender') {
    const done = Object.fromEntries(c.history.filter((h) => h.season === c.season).map((h) => [h.tid, h]));
    body = `<div class="panel scroll"><table><tr><th>Monat</th><th>Großes Turnier</th><th>Das hast du gemacht</th><th class="num">Punkte</th><th class="num">Geld</th></tr>
      ${D.TOURNAMENTS.map((t, i) => { const h = done[t.id]; return `<tr class="${i === c.week ? 'me' : ''}"><td>${t.month}</td><td>${t.name} ${catTag(t)}</td>
        <td>${h ? esc(h.name) + (h.label && h.label !== 'W' ? ' · ' + D.ROUND_NAMES[h.label] : h.label === 'W' ? ' · 🏆 Sieg' : '') : i === c.week ? 'diese Woche' : ''}</td>
        <td class="num">${h ? h.points : ''}</td><td class="num ${h && h.netto < 0 ? 'minus' : ''}">${h && h.netto != null ? money(h.netto) : ''}</td></tr>`; }).join('')}
      </table><p class="dim klein">Geld = was in der Woche übrig blieb (Preisgeld und Sponsoren minus Reise und Team).</p></div>`;
  } else if (careerTab === 'rangliste') {
    const list = CA.ranking(c);
    const rows = list.filter((p) => p.rank <= 30 || p.me || (rk <= 104 && Math.abs(p.rank - rk) <= 4));
    body = `<div class="panel scroll"><table><tr><th class="num">Platz</th><th>Spieler</th><th class="num">Punkte</th></tr>
      ${rows.map((p, i) => `${i > 0 && rows[i - 1].rank < p.rank - 1 ? '<tr><td colspan="3" class="dim center">…</td></tr>' : ''}
        <tr class="${p.me ? 'me' : ''}"><td class="num">${p.rank}</td><td>${flag(p.country)} ${esc(p.name)}</td><td class="num">${p.points.toLocaleString('de-DE')}</td></tr>`).join('')}
      </table>${rk > 100 ? '<p class="dim klein">Hinter den Top 100 stehen in echt noch rund 2000 Spieler. Dein Platz dort wird aus deinen Punkten geschätzt.</p>' : ''}</div>`;
  } else if (careerTab === 'skills') {
    const eff = CA.effectiveStats(c), liste = CA.bonusListe(c);
    body = `<div class="panel"><p>Freie Fähigkeitspunkte: <b class="gold">${c.skillPoints}</b> · Level ${c.level}. Punkte gibt es für jedes neue Level (Matches und Training bringen Erfahrung).</p>
      <table>${Object.keys(D.STAT_NAMES).map((k) => `<tr><td><b>${D.STAT_NAMES[k]}</b><br><small class="dim">${SKILL_INFO[k]}</small></td>
        <td style="width:40%"><div class="stat" style="grid-template-columns:1fr 60px"><i><b style="width:${eff[k]}%"></b></i><span>${c.skills[k]}${eff[k] !== c.skills[k] ? ` <span class="${eff[k] > c.skills[k] ? 'gold' : 'minus'}">${eff[k] > c.skills[k] ? '+' : '−'}${Math.abs(eff[k] - c.skills[k])}</span>` : ''}</span></div></td>
        <td class="right"><button data-a="skill" data-v="${k}" ${c.skillPoints <= 0 || c.skills[k] >= 95 ? 'disabled' : ''}>+1</button></td></tr>`).join('')}</table></div>
      <div class="panel"><h3 style="margin-top:0">Woher kommen deine Pluspunkte?</h3>
        ${liste.length ? `<table>${liste.map((b) => `<tr><td>${esc(b.name)}</td><td class="gold">${bonusText(b.bonus)}</td></tr>`).join('')}</table>` : '<p class="dim">Noch keine. Ausrüstung und ein gutes Team bringen Pluspunkte.</p>'}
        <p class="dim klein">Schuhe zählen für den Belag des Turniers (hier: Hartplatz).</p></div>`;
  } else if (careerTab === 'shop') {
    const karte = (s) => {
      const frei = CA.gratis(c, s, stufe), own = c.owned.includes(s.id) || frei, on = c.equipped[s.cat] === s.id;
      let info = '', knopf;
      if (s.cat === 'Schläger') info = `<span class="tag">${s.typ}</span><br><small class="gold">${bonusText(s.bonus)}</small>${s.profis ? `<br><small class="dim">Diese Reihe spielt z. B. ${esc(s.profis)}</small>` : ''}`;
      else if (s.cat === 'Saiten') info = `<small class="gold">${bonusText(s.bonus)}</small><br><small class="dim">${esc(s.text)} Hält ${CA.saitenLeben(c, s)} Matches.</small>`;
      else if (s.cat === 'Schuhe') info = `<small class="gold">Tempo: ${Object.entries(s.tempo).map(([b, v]) => `${BELAG_KURZ[b]} +${v}`).join(' · ')}</small><br><small class="dim">${esc(s.text)}</small>`;
      else info = `<small class="gold">${[s.bonus ? bonusText(s.bonus) : '', sterne(s.sterne)].filter(Boolean).join(' · ')}</small>${s.text ? `<br><small class="dim">${esc(s.text)}</small>` : ''}`;
      if (s.cat === 'Saiten') {
        knopf = on && c.saitenRest > 0 ? `<button class="sel" disabled>✓ Aufgezogen · noch ${c.saitenRest} ${c.saitenRest === 1 ? 'Match' : 'Matches'}</button>`
          : `<button data-a="buy" data-v="${s.id}" ${!frei && c.money < s.price ? 'disabled' : ''}>Bespannen · ${frei ? 'gratis' : money(s.price)}</button>`;
      } else if (s.cat === 'Schuhe') {
        knopf = own ? `<button class="sel" disabled>✓ Im Schrank${frei ? ' (vom Ausrüster)' : ''}</button>` : `<button data-a="buy" data-v="${s.id}" ${c.money < s.price ? 'disabled' : ''}>Kaufen · ${money(s.price)}</button>`;
      } else {
        knopf = own ? `<button class="${on ? 'sel' : ''}" data-a="equip" data-v="${s.id}">${on ? '✓ Im Einsatz' : frei ? 'Nehmen (vom Ausrüster)' : 'Nehmen'}</button>`
          : `<button data-a="buy" data-v="${s.id}" ${c.money < s.price ? 'disabled' : ''}>Kaufen · ${money(s.price)}</button>`;
      }
      const farbe = s.color != null ? s.color : s.shirt;
      return `<div class="panel teil">${farbe != null ? `<i class="punkt" style="background:${hex(farbe)}"></i>` : ''}<b>${esc(s.name)}</b><br>${info}<br>${knopf.replace('<button', '<button style="margin-top:8px"')}</div>`;
    };
    const teile = AU.SHOP.filter((s) => s.cat === shopCat);
    const marken = [...new Set(teile.map((s) => s.marke))];
    // Schläger nach Marke sortiert anzeigen, alles andere in einer Liste
    const liste = shopCat === 'Schläger'
      ? marken.map((m) => `<div class="panel"><h3 style="margin-top:0">${m}${c.vertrag.schlaeger === m && stufe >= 0 ? ' <span class="tag gs">dein Ausrüster</span>' : ''}</h3><div class="grid">${teile.filter((s) => s.marke === m).map(karte).join('')}</div></div>`).join('')
      : `<div class="panel"><div class="grid">${teile.map(karte).join('')}</div></div>`;
    body = `<p>Dein Geld: <b class="gold">${money(c.money)}</b></p>
      <div class="row tabs">${AU.SHOP_CATS.map((k) => `<button class="${shopCat === k ? 'sel' : ''}" data-a="shopCat" data-v="${k}">${k}</button>`).join('')}</div>
      <p class="dim">${AU.SHOP_INFO[shopCat]}</p>${liste}`;
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
}
const SKILL_INFO = {
  s: 'Schnellere und genauere Aufschläge', p: 'Härtere Grundschläge', t: 'Du läufst schneller und erreichst mehr Bälle',
  c: 'Deine Bälle landen näher am Ziel', v: 'Bessere Volleys und Schmetterbälle am Netz',
};
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
  ctxT = { T, def: D.tournamentById(T.defId), career: true };
  renderTournament();
};
actions.careerLiga = () => { const T = CA.ligaSpiel(career); ctxT = { T, def: D.tournamentById(T.defId), career: true }; renderTournament(); };
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
  game.showAvatars(true);
  controls.setMode(settings.control);
  controls.enabled = true;
  const names = [o.me.short, o.opp.short];
  session = { o, names, over: false, mode };
  match = new Match({
    players: [o.me, o.opp], human: 0, surface: o.def.surface, difficulty: settings.difficulty,
    sets: len.sets, games: len.games, mode, assist: settings.assist, controlMode: settings.control,
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
