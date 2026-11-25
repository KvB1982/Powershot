// Powershot – Hauptprogramm: Menüs, Abläufe (Freies Spiel, Turnier, Karriere, Training), Anzeige im Spiel

import { SchlaegerEmpfang, qrMalen } from './handyschlaeger.js';
import { GelaendeKarte } from './gelaendekarte.js';
import * as GW from './gelaendewetter.js';
import { Sound } from './audio.js';
import { Game3D } from './game3d.js';
import { Controls } from './controls.js';
import { KameraLauf, RAUM } from './kamera.js';
import { KameraBild } from './kamerabild.js';
import { Match } from './match.js';
import { AUFSCHLAEGE, AUFSCHLAG_ARTEN, standardAufschlag } from './schlaege.js';
import { loadFigure } from './figur.js';
import { ladeRequisiten } from './requisiten.js';
import { loadMocap, loadGang, mocapClip } from './mocap.js';
import { SHOW } from './showschlaege.js';
import { steckbrief } from './einlauf.js';
import { schlagbuchHtml, uhrHtml } from './schlagbuch.js';
import * as D from './data.js';
import * as TN from './tournament.js';
import * as CA from './career.js';
import * as TT from './turniertag.js';
import * as QZ from './quiz.js';
import * as TA from './aufgaben.js';
import * as MS from './minispiele.js';
import { MiniBuehne } from './minibuehne.js';
import * as GL from './gelaende.js';
import { hotelArt, hotelFuer } from './hotelfahrt.js';
import { stadtGelaende, sterneFuer } from './hotelweg.js';
import * as AU from './ausruestung.js';
import * as KT from './kleinetour.js';
import * as KA from './kalender.js';
import * as AB from './ausbau.js';
import * as PL from './planer.js';
import * as SE from './season.js';
import * as PS from './profisaison.js';
import * as SZ from './spielzuege.js';
import * as LE from './lernen.js';
import * as PR from './profile.js';
import { Rekorder, kurzName } from './rekorder.js';
import * as RS from './rekorderspeicher.js';
import { auswerten, bericht, STEUERUNG_NAME } from './rekorderauswertung.js';
import { Wiedergabe } from './wiedergabe.js';
import { bracketHtml, timelineHtml, raceHtml, pointsHtml, weltHtml, zeitungHtml } from './saisonansicht.js';

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
  sound: true, volume: 0.8, umgebung: 1, voice: true, quality: 'hoch', schaerfe: 'auto', gelaende: 'reit', figures: 'echt',
  kamera: 'aus', kameraRaum: 'mittel', kameraTauschen: false,
  spielzuege: 'aus',       // taktische Spielzüge im Match: 'aus' oder 'an'
  blick: 'tv',             // Blick auf den Platz im Match: 'tv' (wie im Fernsehen) oder 'nah' (dicht hinter dir)
  tempo: 'schnell',        // Spieltempo im Match: 'echt', 'schnell' oder 'turbo' (siehe TEMPO_MAL)
  schweif: 'aus',          // leuchtender Schweif hinter dem Ball: 'aus' oder 'an'
  einlauf: 'an',           // Einlaufszene vor dem Match: 'an' (ganz), 'kurz' (nur Steckbriefe) oder 'aus'
  rekorder: 'aus',         // Match-Rekorder: 'aus' oder 'an' (schreibt jedes Match mit, siehe js/rekorder.js)
}, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
// Welche Spielzüge hast du schon gelernt? { id: { t: im Training geschafft, m: im Match geschafft } }
const ZUG_KEY = 'powershot.spielzuege.v1';
const zugSpeicher = (() => { try { return JSON.parse(localStorage.getItem(ZUG_KEY)) || {}; } catch (e) { return {}; } })();
const zugSichern = () => { try { localStorage.setItem(ZUG_KEY, JSON.stringify(zugSpeicher)); } catch (e) { /* egal */ } };
// Spieltempo: Mit dieser Zahl wird die Zeit im Match malgenommen. 1.1 heißt: Ball, Spieler und Bewegungen
// laufen alle zusammen 10 % schneller ab – wie ein Film, der etwas schneller abgespielt wird. Flugbahnen bleiben gleich.
const TEMPO_MAL = { echt: 1, schnell: 1.1, turbo: 1.22 };
const tempoMal = () => TEMPO_MAL[settings.tempo] || 1;
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* egal */ } };

const CONTROL_NAMES = { klassik: 'Klassik (Maus)', touch: 'Touch (iPad)', wisch: 'Wischen (iPad, neu)', profi: 'Profi (Tastatur)', controller: 'Controller / iPhone-Schläger' };
const KAMERA_NAMES = { aus: 'Aus', seite: 'Nur links und rechts', voll: 'Auch vor und zurück' };
const ASSIST_NAMES = { voll: 'Voll (läuft von allein)', seitlich: 'Nur seitlich', aus: 'Aus (selbst laufen)' };

// ---------------------------------------------------------------
// Grundgerüst
// ---------------------------------------------------------------
const sound = new Sound();
sound.voice = settings.voice;
sound.volume = settings.volume;
sound.umgebung = settings.umgebung;      // Publikum und Umgebung: 1 normal, 0.5 leise, 0 aus
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
game.setScharfAuto(settings.schaerfe !== 'fest');
game.anlage.artSetzen(settings.gelaende);      // Steuerung auf dem Turniergelände: 'reit' = wie im Reitturnier, 'frei' = mit freier Kamera
game.blick = settings.blick;
game.schweifAn = settings.schweif === 'an';
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
if (season) PS.einrichten(season);     // das Profileben dazu (auch für alte Spielstände)
let menuVenue = 'ao';

function show(html) { screen.innerHTML = `<div class="wrap">${html}</div>`; screen.classList.add('on'); screen.scrollTop = 0; reiterPruefen(); }
// Lange Reiter-Leisten (Karriere, Saison): den gewählten Reiter ins Bild schieben und am Rand zeigen, dass es weitergeht
function reiterPruefen() {
  for (const t of screen.querySelectorAll('.tabs')) {
    const rand = () => { t.classList.toggle('mehrR', t.scrollLeft + t.clientWidth < t.scrollWidth - 4); t.classList.toggle('mehrL', t.scrollLeft > 4); };
    const sel = t.querySelector('.sel');
    if (sel) t.scrollLeft = Math.max(0, sel.offsetLeft - t.offsetLeft - (t.clientWidth - sel.offsetWidth) / 2);
    t.addEventListener('scroll', rand, { passive: true });
    rand();
  }
}
function hide() { screen.classList.remove('on'); screen.innerHTML = ''; }

const actions = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  sound.unlock();
  if (el.dataset.a === 'set') sound.schalter(); else if (/^\s*‹|Zurück/.test(el.textContent)) sound.zurueck(); else sound.click();
  const fn = actions[el.dataset.a];
  if (fn) fn(el.dataset.v, el);
});
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
window.addEventListener('keydown', (e) => {
  // Einlaufszene: Leertaste oder Eingabetaste = nächster Teil, Esc = gleich zum Match
  if (game.einlauf && game.einlauf.an && !paused && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); return einlaufTipp(e.key === 'Escape'); }
  if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && match && session && !session.over) togglePause();
});
$('#pauseBtn').addEventListener('click', () => { sound.unlock(); togglePause(); });
$('#helpBtn').addEventListener('click', () => { sound.unlock(); actions.spick(); });
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
// Karriere und Saison haben beide ein „Profileben“ (Turniertage, Frische, Abend …). Diese zwei Helfer liefern das Richtige:
//   lebenC()  = der Spielstand, mit dem turniertag.js rechnet (Karriere: career · Saison: season.profi)
//   ichJetzt() = deine Figur mit allen Pluspunkten von heute
const mitLeben = () => !!ctxT && !!(ctxT.career || ctxT.season);
const lebenC = () => (ctxT && ctxT.season ? season.profi : career);
const ichJetzt = (gegner) => (ctxT && ctxT.season ? PS.spieler(season, ctxT.def, gegner) : CA.mePlayer(career));
const back = (to = 'home') => `<button class="ghost" data-a="${to}">‹ Zurück</button>`;

// ---------------------------------------------------------------
// Hauptmenü
// ---------------------------------------------------------------
actions.home = () => {
  session = null;
  enterMenu();
  const wer = PR.aktiv(), mehrere = PR.laden().liste.length > 1;
  const neuHier = !ersteStand.fertig && !ersteStand.weg;
  show(`
    <div class="title"><h1>POWERSHOT</h1><p>Tennis · ATP Tour · Grand Slams · Masters · Finals</p></div>
    <div class="center" style="margin-bottom:10px"><button class="ghost" data-a="profile">👤 ${mehrere ? 'Es spielt: <b>' + esc(wer.name) + '</b> · wechseln' : 'Wer spielt? Eigene Spielstände für jeden'}</button></div>
    ${neuHier ? `<div class="panel neuhier"><b>👋 Neu hier?</b> In vier kurzen Lektionen lernst du Schlagen, Zielen, Aufschlagen und spielst dein erstes Match.
      <div class="row" style="margin-top:8px"><button class="primary grow" data-a="erste">Erste Schritte starten ›</button><button data-a="ersteWeg">Kenne ich schon</button></div></div>` : ''}
    <h3 class="gruppe">Spielen</h3>
    <div class="menu">
      <button class="big primary" data-a="free">Freies Spiel <small>Spieler wählen und loslegen</small></button>
      <button class="big" data-a="career">Karriere <small>${career ? esc(career.name) + ' · Platz ' + CA.myRank(career) : 'Eigenen Spieler aufbauen'}</small></button>
      <button class="big" data-a="saison">Saison <small>${season ? esc(SE.seasonPlayer(season).short) + ' · ATP Race Platz ' + SE.myRace(season).rank : 'Mit einem Profi durchs Jahr · ATP Race'}</small></button>
      <button class="big" data-a="tourMenu">Turnier <small>Ein Turnier mit einem Profi spielen</small></button>
    </div>
    <h3 class="gruppe">Üben und Lernen</h3>
    <div class="menu">
      <button class="big" data-a="erste">Erste Schritte <small>${ersteStand.fertig ? '✓ geschafft · noch einmal ansehen' : 'Das Spiel in vier kurzen Lektionen lernen'}</small></button>
      <button class="big" data-a="training">Training <small>Ballmaschine · Aufschlag · Spielzüge</small></button>
      <button class="big" data-a="schlagbuch">Schlagarten <small>Nachlesen und ansehen · Aufnehmen mit der Uhr</small></button>
      <button class="big" data-a="wissen">Tennis-Wissen <small>Lernen und üben: Regeln, Technik, Taktik, Turniere, Geschichte …</small></button>
    </div>
    <h3 class="gruppe">Entdecken</h3>
    <div class="menu">
      <button class="big" data-a="anlage">Turniergelände <small>Wimbledon, New York, Paris … – die echten Anlagen zum Herumlaufen</small></button>
      <button class="big" data-a="miniMenu">Mini-Spiele und Quiz <small>Alle Aufgaben vom Turniergelände frei spielen · Tennis-Quiz</small></button>
    </div>
    <div class="menu" style="margin-top:14px">
      <div class="row"><button class="grow" data-a="settings" data-v="home">Einstellungen</button><button class="grow" data-a="help" data-v="home">Steuerung</button><button class="grow" data-a="neuImSpiel">Was ist was?</button></div>
    </div>`);
};

// ---------------------------------------------------------------
// „Was ist was?“ – eine Seite, die jeden Menüpunkt in einem Satz erklärt
// ---------------------------------------------------------------
actions.neuImSpiel = () => {
  const z = (name, text) => `<tr><td><b>${name}</b></td><td>${text}</td></tr>`;
  show(`
    <div class="bar">${back()}<h2>Was ist was?</h2></div>
    <div class="panel"><h3 style="margin-top:0">Spielen</h3><table class="erklaer">
      ${z('Freies Spiel', 'Ein einzelnes Match. Du suchst dir Spieler, Gegner und Stadion aus. Gut zum Ausprobieren.')}
      ${z('Karriere', 'Du baust einen eigenen Spieler auf: vom Platz 2000 bis nach Wimbledon. Mit Geld, Reisen, Ausrüstung und Training. Das ist das lange Spiel.')}
      ${z('Saison', 'Du übernimmst einen echten Profi für ein Jahr. Er kann schon alles – dafür erwarten alle etwas von ihm.')}
      ${z('Turnier', 'Ein einzelnes großes Turnier mit einem Profi, von der ersten Runde bis zum Finale.')}
    </table></div>
    <div class="panel"><h3 style="margin-top:0">Üben und Lernen</h3><table class="erklaer">
      ${z('Erste Schritte', 'Vier kurze Lektionen für den Anfang: Schlagen, Zielen, Aufschlagen, erstes Match.')}
      ${z('Training', 'Ballmaschine und Aufschlag-Training mit Zielfeldern. Dazu die taktischen Spielzüge zum Lernen.')}
      ${z('Schlagarten', 'Ein Buch mit allen Schlägen: Wie sieht er aus, wofür ist er gut, wie spielst du ihn.')}
      ${z('Tennis-Wissen', 'Kapitel zum Lesen und Fragen zum Üben: Regeln, Technik, Taktik, Turniere, Geschichte.')}
    </table></div>
    <div class="panel"><h3 style="margin-top:0">Entdecken</h3><table class="erklaer">
      ${z('Turniergelände', 'Herumlaufen auf den Anlagen der großen Turniere. Stempel sammeln, Sehenswürdigkeiten ansehen.')}
      ${z('Mini-Spiele und Quiz', 'Die kleinen Spiele vom Turniertag (Kraftraum, Autogramme, Bespannen …) ohne Turnier spielen.')}
    </table></div>
    <div class="panel"><h3 style="margin-top:0">Gut zu wissen</h3>
      <p><b>Schwierigkeit:</b> ${Object.keys(STUFE_TEXT).map((k) => `<b>${D.DIFFICULTY[k].name}</b> – ${STUFE_TEXT[k]}`).join(' ')}</p>
      <p><b>Wer spielt?</b> Spielt ihr zu zweit an einem Gerät, legt für jeden ein Profil an (oben im Hauptmenü). Dann hat jeder seine eigene Karriere und seine eigene Steuerung.</p>
      <p><b>Pause:</b> Im Match oben rechts auf „II“ tippen. Daneben zeigt „?“ deine Steuerung als Spickzettel.</p></div>`);
};
// Die Stufen in einem Satz (steht auch in den Einstellungen)
const STUFE_TEXT = {
  leicht: 'Deine Bälle bleiben im Feld. Schlägst du einmal nicht, kommt ein schwacher Hilfs-Schlag – dann greift der Gegner aber an.',
  mittel: 'Du musst jeden Ball selbst schlagen. Wer nur in die Mitte spielt, wird angegriffen – also zielen!',
  schwer: 'Deine Bälle können ins Aus gehen, der Gegner macht wenig Fehler und greift oft an.',
  profi: 'Wie Schwer, aber ohne die Anzeige, wo der Ball landet.',
};

// ---------------------------------------------------------------
// „Wer spielt?“ – Profile für mehrere Leute an einem Gerät, Spielstand als Datei sichern (siehe js/profile.js)
// ---------------------------------------------------------------
let profilWeg = null;          // dieses Profil soll gelöscht werden (zweimal tippen)
actions.profile = (meldung) => {
  const P = PR.laden();
  show(`
    <div class="bar">${back()}<h2>Wer spielt?</h2></div>
    ${typeof meldung === 'string' && meldung ? `<div class="panel"><b>${meldung}</b></div>` : ''}
    <div class="panel"><p class="dim" style="margin-top:0">Jedes Profil hat seine eigene Karriere, Saison, Einstellungen (auch die Steuerung), gelernte Spielzüge, Stempel und Bestnoten.</p>
      ${P.liste.map((x) => `<div class="profilzeile ${x.id === P.aktiv ? 'an' : ''}">
        <div class="grow"><b>${x.id === P.aktiv ? '▶ ' : ''}${esc(x.name)}</b><br><small class="dim">${esc(PR.inhalt(x.id))}${x.id === P.aktiv ? ' · spielt gerade' : ''}</small></div>
        ${x.id === P.aktiv ? '' : `<button class="primary" data-a="profilWechsel" data-v="${x.id}">Spielen</button>
          <button data-a="profilLoeschen" data-v="${x.id}">${profilWeg === x.id ? 'Wirklich löschen? Alles von ' + esc(x.name) + ' ist dann weg. Nochmal tippen' : 'Löschen'}</button>`}
      </div>`).join('')}
      <label>Name ändern (für „${esc(PR.aktiv().name)}“) oder neues Profil anlegen</label>
      <div class="row"><input id="pname" type="text" maxlength="16" placeholder="Name" style="flex:1;min-width:120px">
        <button data-a="profilName">Diesen Namen nehmen</button>
        ${P.liste.length < PR.HOECHSTENS ? '<button class="primary" data-a="profilNeu">Neues Profil anlegen</button>' : ''}</div>
      <p class="dim" style="font-size:13px">Ein neues Profil fängt ganz von vorne an. Beim Wechseln lädt das Spiel einmal neu.</p></div>
    <div class="panel"><h3 style="margin-top:0">Spielstand sichern</h3>
      <p class="dim">Alle Profile zusammen in eine Datei schreiben – zum Aufheben oder um auf einem anderen Gerät weiterzuspielen.</p>
      <div class="row"><button data-a="standSichern">💾 In eine Datei sichern</button>
        <button data-a="standLaden">📂 Aus einer Datei laden</button><input id="standDatei" type="file" accept=".json,application/json" hidden></div>
      <p class="dim" style="font-size:13px">Achtung: „Aus einer Datei laden“ ersetzt alle Profile auf diesem Gerät durch die aus der Datei.</p></div>`);
  const d = $('#standDatei');
  if (d) d.addEventListener('change', () => {
    const f = d.files && d.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (PR.einspielen(String(r.result))) location.reload();
      else actions.profile('Das ist keine Powershot-Sicherung. Es wurde nichts geändert.');
    };
    r.readAsText(f);
  });
};
actions.profilNeu = () => {
  const name = ($('#pname').value || '').trim();
  if (!name) return actions.profile('Schreib zuerst einen Namen in das Feld.');
  const id = PR.neu(name);
  if (!id) return actions.profile('Das hat nicht geklappt (zu viele Profile?).');
  if (PR.wechseln(id)) location.reload(); else actions.profile('Der Speicher ist voll – das Profil gibt es jetzt, aber wechseln ging nicht.');
};
actions.profilName = () => {
  const name = ($('#pname').value || '').trim();
  actions.profile(name && PR.umbenennen(PR.laden().aktiv, name) ? '' : 'Schreib zuerst einen Namen in das Feld.');
};
actions.profilWechsel = (id) => { if (PR.wechseln(id)) location.reload(); else actions.profile('Wechseln ging nicht (Speicher voll?).'); };
actions.profilLoeschen = (id) => {
  if (profilWeg !== id) { profilWeg = id; return keepScroll(() => actions.profile()); }
  profilWeg = null; PR.loeschen(id); actions.profile('Profil gelöscht.');
};
actions.standSichern = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([PR.paket()], { type: 'application/json' }));
  a.download = `powershot-spielstand-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
actions.standLaden = () => { const d = $('#standDatei'); if (d) d.click(); };

// ---------------------------------------------------------------
// „Erste Schritte“ – vier kurze Lektionen für den Anfang. Jede benutzt etwas, das es schon gibt
// (Ballmaschine, Aufschlag-Training, ein kurzes Match), nur kürzer, auf Stufe „Leicht“ und mit Erklärung davor.
// ---------------------------------------------------------------
const ERSTE_KEY = 'powershot.erste.v1';
let ersteStand = (() => { try { return JSON.parse(localStorage.getItem(ERSTE_KEY)) || {}; } catch (e) { return {}; } })();
const ersteSichern = () => { try { localStorage.setItem(ERSTE_KEY, JSON.stringify(ersteStand)); } catch (e) { /* dann eben ohne Merken */ } };
// So schlägt man mit jeder Steuerung (ganz kurz – die lange Fassung steht unter „Steuerung“)
const ERSTE_TIPP = {
  klassik: { schlag: 'Halte die <b>linke Maustaste</b> gedrückt, wenn der Ball kommt, und lass los. Länger halten = härter und tiefer.', ziel: 'Bewege die <b>Maus nach links oder rechts</b> (oder dreh das Mausrad): Der Zielpunkt auf der anderen Seite wandert mit.', aufschlag: 'Maustaste halten (der Ball fliegt hoch) und oben <b>loslassen</b>. Mit der Maus zielst du ins Aufschlagfeld.' },
  profi: { schlag: 'Drück die <b>Leertaste</b>, wenn der Ball bei dir ist. Länger halten = härter.', ziel: 'Halte beim Schlagen <b>← oder →</b> gedrückt: Dorthin fliegt der Ball. ↑ = tief, ↓ = kurz.', aufschlag: '<b>Leertaste</b> halten und loslassen, mit ← → zielen.' },
  touch: { schlag: '<b>Wisch nach oben</b>, wenn der Ball bei dir ist.', ziel: 'Wisch <b>schräg</b>: nach links oben = Ball nach links, nach rechts oben = Ball nach rechts. Länger wischen = tiefer.', aufschlag: '<b>Nach oben wischen.</b> Schräg wischen = Richtung.' },
  wisch: { schlag: '<b>Wisch schräg nach oben</b>, wenn der Ball bei dir ist. Schneller wischen = härter.', ziel: 'Hier zielst du mit dem <b>Zeitpunkt</b>: früh wischen = quer über den Platz (cross), spät wischen = die Linie entlang. Die Ziellinie auf dem Platz zeigt es dir.', aufschlag: '<b>Nach oben wischen.</b> Schräg wischen = Richtung.' },
  controller: { schlag: '<b>Schwing</b> den Controller oder drück <b>A</b>, wenn der Ball bei dir ist.', ziel: 'Der <b>Stick</b> zielt. Beim Schwingen zählt der Zeitpunkt: früh = cross, spät = die Linie entlang.', aufschlag: 'Schwingen oder <b>A</b>. Der Stick zielt.' },
};
const ERSTE = [
  { id: 'schlagen', name: 'Ball treffen', mode: 'ballmaschine', balls: 8, ziel: 'Schlag 4 von 8 Bällen ins Feld zurück.', tipp: 'schlag',
    text: 'Die Ballmaschine spielt dir 8 Bälle zu. Dein Spieler läuft von allein zum Ball – du musst nur im richtigen Moment schlagen.',
    geschafft: (r) => r.training && (r.training.drin || 0) >= 4 },
  { id: 'zielen', name: 'Zielen', mode: 'ballmaschine', balls: 10, ziel: 'Triff 2-mal eines der bunten Zielfelder.', tipp: 'ziel',
    text: 'Jetzt kommt es darauf an, wohin der Ball fliegt. Auf der anderen Seite liegen drei Zielfelder: in den Ecken und hinten in der Mitte.',
    geschafft: (r) => r.training && (r.training.treffer || 0) >= 2 },
  { id: 'aufschlag', name: 'Aufschlag', mode: 'aufschlag', balls: 6, ziel: 'Bring 3 von 6 Aufschlägen ins Aufschlagfeld.', tipp: 'aufschlag',
    text: 'Jeder Punkt beginnt mit einem Aufschlag. Er muss schräg gegenüber in das kleine Feld vorn am Netz – das Aufschlagfeld.',
    geschafft: (r) => r.training && (r.training.drin || 0) >= 3 },
  { id: 'match', name: 'Dein erstes Match', mode: 'match', ziel: 'Spiel einen kurzen Satz bis 3 zu Ende. Gewinnen ist schön, muss aber nicht sein.', tipp: 'schlag',
    text: 'Jetzt alles zusammen: Aufschlag, schlagen, zielen. Gezählt wird 15, 30, 40, Spiel. Wer zuerst 3 Spiele hat, gewinnt. Du spielst auf Stufe „Leicht“ gegen einen Nachwuchsspieler.',
    geschafft: (r) => !r.aborted && !r.training },
];
actions.erste = (meldung) => {
  const T = ERSTE_TIPP[settings.control] || ERSTE_TIPP.touch;
  const offen = ERSTE.findIndex((L) => !ersteStand[L.id]);
  show(`
    <div class="bar">${back()}<h2>Erste Schritte</h2></div>
    ${typeof meldung === 'string' && meldung ? `<div class="panel neuhier"><b>${meldung}</b></div>` : ''}
    <div class="panel"><p style="margin-top:0">Deine Steuerung ist <b>${CONTROL_NAMES[settings.control]}</b>. <button data-a="settings" data-v="erste">Ändern</button> <button data-a="help" data-v="erste">Alles zur Steuerung</button></p>
      ${ERSTE.map((L, i) => `<div class="lektion ${ersteStand[L.id] ? 'ok' : ''}">
        <div class="grow"><b>${ersteStand[L.id] ? '✓' : i + 1 + '.'} ${L.name}</b><br><span class="dim">${L.text}</span>
          <br><span>🎯 ${L.ziel}</span><br><span>👉 ${T[L.tipp]}</span></div>
        <button class="${i === offen ? 'primary' : ''}" data-a="ersteLos" data-v="${i}">${ersteStand[L.id] ? 'Noch einmal' : 'Los ›'}</button></div>`).join('')}
    </div>
    ${ersteStand.fertig ? `<div class="panel"><b>🎉 Du kannst alles, was du für den Anfang brauchst.</b> Wie wäre es jetzt mit der <b>Karriere</b> – oder einem Freien Spiel auf Stufe „Mittel“?
      <div class="row" style="margin-top:8px"><button class="primary" data-a="career">Zur Karriere ›</button><button data-a="free">Freies Spiel</button><button data-a="training">Mehr Training</button></div></div>` : ''}`);
};
actions.ersteWeg = () => { ersteStand.weg = true; ersteSichern(); actions.home(); };
actions.ersteLos = (v) => {
  const i = +v, L = ERSTE[i];
  const me = getPlayer('zverev');
  const lehrling = D.PLAYERS[D.PLAYERS.length - 1];
  const opp = L.mode === 'match' ? lehrling : { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' };
  startMatch({
    me, opp, def: D.tournamentById(free.venue), mode: L.mode, balls: L.balls, title: 'Erste Schritte', difficulty: 'leicht', length: 'kurz', ohneHilfe: L.mode !== 'match',
    ohneEinlauf: true,       // in den Lektionen geht es gleich los
    hinweis: `Lektion ${i + 1}: ${L.ziel}`,
    onEnd: (res) => {
      if (res.aborted) return actions.erste();
      if (!L.geschafft(res)) return actions.erste(`${L.name}: noch nicht ganz. Probier es gleich noch einmal – ${L.ziel}`);
      ersteStand[L.id] = true;
      if (ERSTE.every((x) => ersteStand[x.id])) ersteStand.fertig = true;
      ersteSichern();
      actions.erste(L.mode === 'match' ? (res.won ? '🏆 Gewonnen! Dein erstes Match ist geschafft.' : 'Dein erstes Match ist gespielt – beim nächsten Mal klappt es mit dem Sieg.') : `✓ ${L.name} geschafft!`);
    },
  });
};

function enterMenu() {
  match = null; paused = false;
  controls.enabled = false;
  controls.showStick(false);
  game.detach();
  game.loadVenue(D.tournamentById(menuVenue));
  hudEl.hidden = true;
  $('#einlauf').hidden = true;
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
      ${settings.control === 'wisch' ? `<p class="dim" style="margin:6px 0 0;font-size:13px">👆 <b>Wischen:</b> Du schlägst nur mit einem Wisch.
        <b>Wann</b> du wischst, bestimmt die Richtung: früh = cross (quer über den Platz), spät = longline (die Linie entlang). Die Ziellinie auf dem Platz wandert mit – bei der Vorhand von links nach rechts, bei der Rückhand von rechts nach links.
        <b>Wohin</b> du wischst, bestimmt den Schlag: ↑ hoher Topspin · ↗ Topspin · → gerader, flacher Schlag · ↘ langer Slice · ↓ kurzer Slice (ganz langsam = Stoppball).
        <b>Wie schnell</b> du wischst, bestimmt die Härte. Zwei Finger nach oben = Lob. Doppelt tippen = ans Netz und zurück.<br>
        <b>Aufschlag:</b> ↑ gerade · ↓ Slice · zwei Finger ↑ Kick · zwei Finger ↓ von unten. Schräg wischen = Richtung.
        Mit Laufhilfe „Voll“ kannst du überall wischen. Bei „Nur seitlich“ oder „Aus“ läufst du mit dem Finger links (auflegen und ziehen) – ein schneller Wisch zählt auch dort als Schlag.</p>` : ''}
      <p class="dim" style="margin:6px 0 0;font-size:13px">🎮 ${controls.pad.connected
        ? `Verbunden: ${esc(controls.pad.name)} · ${controls.pad.motion ? 'Schwingen wird erkannt' : 'nur Tasten und Stick (kein Schwingen)'}`
        : 'Kein Controller verbunden. Koppeln: iPad-Einstellungen → Bluetooth, am Joy-Con die kleine runde Taste gedrückt halten.'}</p>
      <div class="row" style="margin-top:8px"><button data-a="handySchlaeger">📱 Handy als Schläger verbinden (QR-Code)</button></div>
      ${window.webkit?.messageHandlers?.powershot ? `<div class="row" style="margin-top:8px">
        <button data-a="schlaeger">📱 Dieses Gerät als Schläger für ein anderes benutzen</button></div>` : ''}
      <label>Laufen mit der Kamera</label><div class="row">
        <button data-a="kamera" data-v="settings">📷 ${settings.kamera === 'aus' ? 'Aus – einrichten …' : KAMERA_NAMES[settings.kamera] + (kameraLauf.bereit ? ' · eingemessen' : ' · noch einmessen!')}</button></div>
      ${optionRow('Laufhilfe', 'assist', ASSIST_NAMES)}
      ${optionRow('Schwierigkeit', 'difficulty', Object.fromEntries(Object.entries(D.DIFFICULTY).map(([k, d]) => [k, d.name])))}
      <p class="dim" style="margin:6px 0 0;font-size:13px"><b>${D.DIFFICULTY[settings.difficulty].name}:</b> ${STUFE_TEXT[settings.difficulty]}</p>
      ${optionRow('Matchlänge', 'length', Object.fromEntries(Object.entries(D.LENGTHS).map(([k, d]) => [k, d.name])))}
      ${optionRow('Taktische Spielzüge', 'spielzuege', { aus: 'Aus', an: 'An' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">Mit „An“ zählen im Match die Spielzüge, die du im Training gelernt hast (${SZ.gelerntAnzahl(zugSpeicher)} von ${SZ.ZUG_IDS.length}).
        Ein richtig gespielter Spielzug setzt den Gegner unter Druck. Auch der Computer spielt dann seine Lieblings-Spielzüge.</p>
    </div>
    <div class="panel">
      ${optionRow('Ton', 'sound', { true: 'An', false: 'Aus' })}
      ${optionRow('Lautstärke', 'volume', { 0.4: 'Leise', 0.8: 'Normal', 1.2: 'Laut' })}
      ${optionRow('Publikum und Umgebung', 'umgebung', { 1: 'Normal', 0.5: 'Leise', 0: 'Aus' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">Applaus, Stadion und die Geräusche auf dem Turniergelände. Schläge und Knöpfe hörst du weiter.
        Auf iPad und iPhone bleibt alles still, solange der Schalter „Stumm“ an ist.</p>
      ${optionRow('Schiedsrichter spricht', 'voice', { true: 'Ja', false: 'Nein' })}
      ${optionRow('Grafik', 'quality', { hoch: 'Schön', niedrig: 'Schnell (ältere Geräte)' })}
      ${optionRow('Bildschärfe', 'schaerfe', { auto: 'Automatisch', fest: 'Immer voll' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">„Automatisch“: Wenn das Bild ruckelt (zum Beispiel auf einem großen Turniergelände), malt das Spiel
        etwas weniger scharf und läuft dafür flüssig. Läuft es wieder gut, wird es von selbst wieder schärfer.</p>
      ${optionRow('Steuerung auf dem Turniergelände', 'gelaende', { reit: 'Wie im Reitturnier', frei: 'Mit freier Kamera' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">„Wie im Reitturnier“: Ein Finger läuft immer, zwei Finger drehen, neigen und zoomen die Kamera, die Kamera bleibt bei deiner Figur.
        „Mit freier Kamera“: Zusätzlich schiebst du die Ansicht mit drei Fingern frei über das Gelände.</p>
      ${optionRow('Spielerfiguren', 'figures', { echt: 'Realistisch', einfach: 'Einfach' })}
      ${optionRow('Blick auf den Platz', 'blick', { tv: 'Wie im Fernsehen', nah: 'Nah am Spieler' })}
      ${optionRow('Einlaufen vor dem Match', 'einlauf', { an: 'Ganze Szene', kurz: 'Nur Steckbriefe', aus: 'Aus' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">Vor jedem Match kommen die Spieler auf den Platz, spielen sich kurz ein und werden mit einem Steckbrief vorgestellt.
        Ein Tipp auf den Bildschirm springt zum nächsten Teil, „Überspringen“ gleich zum Match.</p>
      ${optionRow('Schweif am Ball', 'schweif', { aus: 'Aus', an: 'An' })}
      ${optionRow('Spieltempo', 'tempo', { echt: 'Echt', schnell: 'Schnell', turbo: 'Turbo' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">Wie schnell die Zeit im Match läuft. „Schnell“ spielt alles 10 % flotter ab (Ball und Spieler zusammen),
        „Turbo“ 22 %. Je schneller, desto weniger Zeit hast du zum Schlagen.</p>
      <p class="dim" style="margin:6px 0 0;font-size:13px">Der Platz hat immer die echten Maße (23,77 m lang). „Wie im Fernsehen“ schaut von weit hinten und oben –
        beide Spieler sehen ähnlich groß aus. „Nah am Spieler“ ist der alte Blick: du bist groß, der Gegner klein.</p>
    </div>
    <div class="panel">
      ${optionRow('Match-Rekorder', 'rekorder', { aus: 'Aus', an: 'An ⏺' })}
      <p class="dim" style="margin:6px 0 0;font-size:13px">Mit „An“ schreibt das Spiel bei jedem Match und Training mit, was passiert: jede Eingabe, jeden Schlag,
        jeden verpassten Ball und jeden Punkt (keine Bilder, nur Zahlen). Damit lässt sich prüfen, wie gut Steuerung und Schwierigkeit passen.
        Die letzten ${RS.HOECHSTENS} Aufnahmen bleiben auf diesem Gerät.</p>
      <div class="row" style="margin-top:8px"><button data-a="rekorder">📼 Aufnahmen ansehen, auswerten und sichern</button></div>
    </div>
    ${window.__powershotVersion ? `<p class="dim" style="font-size:12px">App-Version ${esc(window.__powershotVersion)} – iPad, iPhone und Uhr sollten dieselbe Nummer haben.</p>` : ''}
    <p class="dim">Auf „Leicht“ bleiben deine Bälle immer im Feld, und du schlägst auch ohne Eingabe zurück.
    Auf „Schwer“ und „Profi“ kannst du ins Aus und ins Netz schlagen.</p>`);
};
actions.set = (v, el) => {
  const [key, raw] = v.split(':');
  let val = raw;
  if (raw === 'true' || raw === 'false') val = raw === 'true';
  else if (key === 'volume' || key === 'umgebung') val = parseFloat(raw);
  settings[key] = val;
  saveSettings();
  sound.voice = settings.voice;
  sound.setVolume(settings.volume);
  sound.setUmgebung(settings.umgebung);
  sound.setEnabled(settings.sound);
  game.setQuality(settings.quality);
  game.setScharfAuto(settings.schaerfe !== 'fest');
  game.anlage.artSetzen(settings.gelaende);
  if (game.anlage.an) anlageZeigen();
  game.blick = settings.blick;
  game.schweifAn = settings.schweif === 'an';
  game.realFigures = settings.figures === 'echt';
  if (key === 'quality') game.loadVenue(D.tournamentById(menuVenue));
  if (key === 'control' && match) { controls.setMode(settings.control); match.cfg.controlMode = settings.control; }
  controls.laufhilfe = settings.assist;
  if (key === 'assist' && match) match.cfg.assist = settings.assist;
  if (el && el.dataset.nach === 'rekorder') return actions.rekorder();
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
    <li><b>Mit zwei Fingern nach oben wischen:</b> ans Netz laufen. <b>Mit zwei Fingern nach unten:</b> zurück an die Grundlinie. (Geht überall auf dem Bildschirm, auch schon vor dem Aufschlag.)</li>
    <li>Du kannst wischen, sobald der Gegner geschlagen hat. Der Schlag kommt, wenn der Ball bei dir ist.</li></ul></div>
  <div class="panel help"><h3>Wischen (iPad / Handy)</h3><ul>
    <li><b>Geschlagen wird nur mit einem Wisch</b> – irgendwo rechts auf dem Bildschirm. Der Schlag zählt in dem Moment, in dem du den Finger hebst.</li>
    <li><b>Wann du wischst = wohin der Ball fliegt.</b> Früh = cross (quer über den Platz), spät = longline (die Linie entlang), genau richtig = Mitte. Die Ziellinie auf dem Platz wandert mit.</li>
    <li><b>Wohin du wischst = welcher Schlag:</b> ↑ hoher Topspin · ↗ Topspin · → gerader, flacher Schlag · ↘ langer Slice · ↓ kurzer Slice (ganz langsam nach unten = Stoppball). Ob nach links oder rechts, ist egal.</li>
    <li><b>Wie schnell du wischst = wie hart du schlägst.</b></li>
    <li><b>Zwei Finger nach oben:</b> Lob. <b>Doppelt tippen:</b> ans Netz laufen – noch einmal doppelt tippen: zurück an die Grundlinie.</li>
    <li><b>Laufen:</b> links auf dem Bildschirm den Finger auflegen und ziehen (Joystick). Ohne Finger läuft dein Spieler von allein zum Ball.</li>
    <li><b>Aufschlag:</b> ↑ gerade · ↓ Slice · zwei Finger ↑ Kick · zwei Finger ↓ von unten. Wischst du dabei schräg, geht der Aufschlag in diese Richtung.</li></ul></div>
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
      <b>Timing = Richtung:</b> früh schwingen = cross (Vorhand: nach links, Rückhand: nach rechts), genau richtig = Mitte, spät = die Linie entlang.
      Aufschlag und Schmetterball (hoher Ball): von oben nach unten schwingen.
      Lass am besten die Laufhilfe auf „Voll“. Achtung: gut festhalten, am besten mit Hülle!</li></ul></div>
  <div class="panel help"><h3>Laufen mit der Kamera (Webcam oder Kamera vom iPad)</h3><ul>
    <li>Einstellungen → „Laufen mit der Kamera“. Die Kamera schaut dir zu und dein Spieler läuft dorthin, wo du im Zimmer stehst.</li>
    <li><b>Einmessen:</b> Stell dich 2 bis 3 Meter vor die Kamera in die Mitte. Kopf bis Hüfte müssen im Bild sein, und nur eine Person.</li>
    <li>Ein Schritt im Zimmer sind mehrere Meter auf dem Platz. Wie viele, stellst du bei „Wie viel Platz hast du?“ ein.</li>
    <li><b>Auch vor und zurück:</b> Ein Schritt auf die Kamera zu = ans Netz. Das klappt nicht ganz so genau wie links und rechts.</li>
    <li>Bist du nah genug am Ball, macht dein Spieler den letzten Schritt allein (außer bei Laufhilfe „Aus“).</li>
    <li>Geschlagen wird wie sonst: mit Uhr, iPhone-Schläger, Controller, Maus oder Tastatur.</li></ul></div>
  <div class="row" style="margin-bottom:14px"><button data-a="schlagbuch">📖 Alle Schlagarten mit Bildern</button><button data-a="uhrAufnahme">⌚ Schläge mit der Uhr aufnehmen</button></div>
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
// Das Schlagbuch: alle Schlagarten mit Bildern (die Seiten selbst baut js/schlagbuch.js). v = Kürzel des gewählten Schlags
let schlagWahl = 'vorhand-topspin';
// „So spielst du ihn“: jede Schlagart des Schlagbuchs mit jeder Steuerung (null = geht mit dieser Steuerung nicht)
const NICHT = null;
const SPIEL_TIPP = {
  klassik: { drive: 'Linke Maustaste halten und loslassen. Die Maus (oder das Mausrad) zielt.', flach: NICHT, slice: NICHT, drop: NICHT, lob: 'Doppelklick oder rechte Maustaste.',
    volley: 'Mit ↑ ans Netz laufen, dann ganz normal schlagen – am Netz wird daraus von selbst ein Volley.', smash: 'Kommt der Ball hoch über deinen Kopf, wird dein normaler Schlag von selbst ein Schmetterball.',
    gerade: 'Taste 1 (oder unten anklicken), dann Maustaste halten und loslassen.', asl: 'Taste 2, dann Maustaste halten und loslassen.', kick: 'Taste 3, dann Maustaste halten und loslassen.', unten: 'Taste 4, dann Maustaste halten und loslassen.' },
  profi: { drive: 'Leertaste oder J. Die Pfeiltasten beim Treffen bestimmen das Ziel. Taste O = noch höherer Topspin.', flach: 'Taste U.', slice: 'Taste K.', drop: 'Taste I.', lob: 'Taste L.',
    volley: 'Mit W oder ↑ ans Netz laufen, dann Leertaste – am Netz wird daraus von selbst ein Volley.', smash: 'Kommt der Ball hoch über deinen Kopf, wird die Leertaste von selbst ein Schmetterball.',
    gerade: 'Beim Aufschlag Taste J (oder Leertaste beim ersten Aufschlag).', asl: 'Beim Aufschlag Taste K.', kick: 'Beim Aufschlag Taste L (oder Leertaste beim zweiten Aufschlag).', unten: 'Beim Aufschlag Taste I.' },
  touch: { drive: 'Nach oben wischen. Schräg wischen = Richtung, länger = tiefer.', flach: NICHT, slice: 'Zur Seite wischen.', drop: 'Nach unten wischen.', lob: 'Doppelt tippen.',
    volley: 'Mit zwei Fingern nach oben wischen = ans Netz. Dann normal schlagen – am Netz wird daraus von selbst ein Volley.', smash: 'Kommt der Ball hoch über deinen Kopf, wird dein Wisch nach oben von selbst ein Schmetterball.',
    gerade: 'Vor dem Aufschlag unten „Gerade“ antippen, dann nach oben wischen.', asl: 'Unten „Slice“ antippen, dann nach oben wischen.', kick: 'Unten „Kick“ antippen, dann nach oben wischen.', unten: 'Unten „Von unten“ antippen, dann nach oben wischen.' },
  wisch: { drive: 'Schräg nach oben wischen ↗. Steil nach oben ↑ = noch höherer Topspin.', flach: 'Waagerecht zur Seite wischen →.', slice: 'Schräg nach unten wischen ↘ (ganz nach unten ↓ = kurzer Slice).', drop: 'Ganz langsam nach unten wischen.', lob: 'Mit zwei Fingern nach oben wischen.',
    volley: 'Doppelt tippen = ans Netz. Dann normal wischen – am Netz wird daraus von selbst ein Volley.', smash: 'Kommt der Ball hoch über deinen Kopf, wird dein Wisch von selbst ein Schmetterball.',
    gerade: 'Beim Aufschlag nach oben wischen ↑.', asl: 'Beim Aufschlag nach unten wischen ↓.', kick: 'Beim Aufschlag mit zwei Fingern nach oben wischen.', unten: 'Beim Aufschlag mit zwei Fingern nach unten wischen.' },
  controller: { drive: 'Schwingen oder Taste A.', flach: NICHT, slice: 'Taste B – oder von oben nach unten schwingen.', drop: 'Taste Y.', lob: 'Taste X.',
    volley: 'Ans Netz (Doppelklopfen oder Netz-Taste), dann schwingen – am Netz wird daraus von selbst ein Volley.', smash: 'Kommt der Ball hoch über deinen Kopf: von oben nach unten schwingen.',
    gerade: 'Beim Aufschlag schwingen oder A (erster Aufschlag).', asl: 'Beim Aufschlag Taste B.', kick: 'Beim Aufschlag Taste X.', unten: 'Beim Aufschlag Taste Y.' },
};
const SPIEL_SONDER = {
  'aufschlag-gerade': 'gerade', 'aufschlag-slice': 'asl', 'aufschlag-kick': 'kick', 'aufschlag-unten': 'unten',
  halbvolley: 'Den Halbvolley gibt es im Spiel nicht als eigenen Schlag. Stehst du am Netz und der Ball springt kurz vor dir auf, schlägst du ihn ganz normal.',
  'stopp-volley': 'Den Stopp-Volley gibt es im Spiel noch nicht als eigenen Schlag. Am Netz kommt immer der normale Volley.',
  'slice-lob': 'Im Spiel gibt es einen Lob – er hat Topspin. Den Slice-Lob kannst du nur mit der Uhr aufnehmen.',
  tweener: 'Der Tweener ist ein Show-Schlag. Er kommt im Spiel erst, wenn es dafür eine eigene Bewegungs-Aufnahme gibt.',
  doppelklopfen: 'Mit der Apple Watch: zweimal kurz die Hände aneinander klopfen = ans Netz laufen und wieder zurück.',
  'kein-schlag': 'Das brauchst du nur beim Aufnehmen mit der Uhr.',
};
function soSpielstDu(sch) {
  const T = SPIEL_TIPP[settings.control] || SPIEL_TIPP.touch, name = CONTROL_NAMES[settings.control];
  const sonder = SPIEL_SONDER[sch.k];
  if (sonder && !T[sonder]) return `<b>Im Spiel:</b> ${sonder}`;
  const art = sonder || sch.spiel;
  if (!(art in T)) return '';
  if (T[art] === NICHT) {
    const geht = Object.keys(SPIEL_TIPP).filter((k) => SPIEL_TIPP[k][art]).map((k) => '„' + CONTROL_NAMES[k] + '“').join(', ');
    return `<b>So spielst du ihn:</b> Mit deiner Steuerung „${name}“ geht dieser Schlag nicht. Er geht mit ${geht} (Einstellungen → Steuerung).`;
  }
  return `<b>So spielst du ihn mit deiner Steuerung „${name}“:</b> ${T[art]}`;
}
actions.schlagbuch = (v) => {
  if (v) schlagWahl = v;
  show(`<div class="bar">${back('home')}<h2>Schlagarten</h2><button data-a="uhrAufnahme">⌚ Mit der Uhr aufnehmen – so geht's</button></div>${schlagbuchHtml(schlagWahl, soSpielstDu)}`);
};
actions.uhrAufnahme = () => show(`<div class="bar">${back('schlagbuch')}<h2>⌚ Schläge mit der Uhr aufnehmen</h2></div>${uhrHtml()}`);

// ---------------------------------------------------------------
// Tennis-Wissen: der Lernmodus (Texte und Lernstand in js/lernen.js, Fragen aus js/quiz.js)
// ---------------------------------------------------------------
const LERN_KEY = 'powershot.lernen.v1';
let lernStand = (() => { try { return { ...LE.neuerStand(), ...JSON.parse(localStorage.getItem(LERN_KEY) || '{}') }; } catch (e) { return LE.neuerStand(); } })();
const lernSichern = () => { try { localStorage.setItem(LERN_KEY, JSON.stringify(lernStand)); } catch (e) { /* voll oder gesperrt: dann eben ohne Merken */ } };
// Leere Sterne sind grau, damit man auf einen Blick sieht, wie viele man schon hat
const leereSterne = (n) => (n > 0 ? `<span class="sternleer">${'☆'.repeat(n)}</span>` : '');
const lernSterne = (n) => '★'.repeat(n) + leereSterne(3 - n);
const lernBalken = (anteil) => `<div class="lernbalken"><i style="width:${Math.round(anteil * 100)}%"></i></div>`;
let lernRunde = null;               // die Übungsrunde, die gerade läuft: { thema, fragen, nr, richtig, wahl }

// Übersicht: zehn Kapitel
actions.wissen = () => {
  enterMenu();
  lernRunde = null;
  const alles = LE.fortschritt(lernStand);
  show(`
    <div class="bar">${back('home')}<h2>Tennis-Wissen</h2></div>
    <div class="panel">
      <p style="margin-top:0">Hier lernst du alles rund ums Tennis – in zehn Kapiteln. Lies ein Kapitel und <b>übe</b> es danach mit Fragen.
        Was du falsch hattest, kommt beim nächsten Mal zuerst wieder dran. Das Wissen hilft dir auch beim Quiz mit dem Trainer auf dem Turniergelände.</p>
      <p class="dim" style="margin-bottom:6px">Du kannst <b>${alles.gekonnt} von ${alles.fragen}</b> Fragen · ${alles.gelesen} von ${alles.seiten} Seiten gelesen</p>
      ${lernBalken(alles.anteil)}
      <div class="row" style="margin-top:12px"><button class="primary" data-a="wissenUeben" data-v="alles">🎲 Bunt gemischt üben</button></div>
    </div>
    <div class="grid lern">${Object.keys(LE.KAPITEL).map((id) => {
      const f = LE.fortschritt(lernStand, id);
      return `<button class="lernkarte" data-a="wissenThema" data-v="${id}">
        <b>${LE.THEMEN[id]}</b><span class="gold">${lernSterne(f.sterne)}</span>
        <small>${esc(LE.KAPITEL[id].kurz)}</small>
        ${lernBalken(f.anteil)}<small class="dim">${f.gekonnt} von ${f.fragen} Fragen gekonnt · ${f.gelesen} von ${f.seiten} Seiten gelesen</small></button>`;
    }).join('')}</div>
    <p class="dim">Regeln, Maße und Geschichte sind nachgeschlagen (Tennisregeln der ITF und ATP-Regelbuch 2026, Wimbledon, Wikipedia). Technik, Taktik und Training sind allgemeines Trainer-Wissen – dein Trainer darf es anders sehen.</p>`);
};
// Ein Kapitel lesen. v = 'thema' oder 'thema:seite'
actions.wissenThema = (v) => {
  const [id, nr] = String(v).split(':'), K = LE.KAPITEL[id];
  if (!K) return actions.wissen();
  const seite = Math.max(0, Math.min(K.seiten.length - 1, +nr || 0)), S = K.seiten[seite], f = LE.fortschritt(lernStand, id);
  LE.gelesen(lernStand, id, seite); lernSichern();
  show(`
    <div class="bar">${back('wissen')}<h2>${LE.THEMEN[id]}</h2><span class="gold">${lernSterne(f.sterne)}</span></div>
    <div class="row lernreiter">${K.seiten.map((s, i) => `<button class="${i === seite ? 'sel' : ''}" data-a="wissenThema" data-v="${id}:${i}">${(lernStand.g[id] || []).includes(i) ? '✓ ' : ''}${esc(s.titel)}</button>`).join('')}</div>
    <div class="panel lernseite">
      <h3 style="margin-top:0">${esc(S.titel)}</h3>
      ${S.bild && LE.BILDER[S.bild] ? LE.BILDER[S.bild]() : ''}
      ${(S.text || []).map((t) => `<p>${t}</p>`).join('')}
      ${S.liste ? `<dl>${S.liste.map(([w, e]) => `<dt>${esc(w)}</dt><dd>${esc(e)}</dd>`).join('')}</dl>` : ''}
      ${S.merke ? `<div class="merke"><b>📌 Merke dir</b><ul>${S.merke.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    </div>
    <div class="row">
      ${seite > 0 ? `<button data-a="wissenThema" data-v="${id}:${seite - 1}">‹ Zurückblättern</button>` : ''}
      ${seite < K.seiten.length - 1 ? `<button class="primary grow" data-a="wissenThema" data-v="${id}:${seite + 1}">Weiter: ${esc(K.seiten[seite + 1].titel)} ›</button>`
        : `<button class="primary grow" data-a="wissenUeben" data-v="${id}">🎯 Jetzt üben (${f.gekonnt} von ${f.fragen} gekonnt)</button>`}
    </div>
    <div class="row" style="margin-top:10px"><button data-a="wissenUeben" data-v="${id}">🎯 Üben</button><button data-a="wissenKarten" data-v="${id}">📋 Alle ${f.fragen} Fragen mit Antworten</button></div>`);
};
// Alle Fragen eines Kapitels mit Antwort zum Nachlesen
actions.wissenKarten = (id) => {
  if (!LE.KAPITEL[id]) return actions.wissen();
  const zeichen = (n) => (n >= LE.SICHER ? '✅' : n >= 1 ? '🙂' : n === 0 ? '❌' : '▫️');
  show(`
    <div class="bar">${back('wissen')}<h2>${LE.THEMEN[id]} – alle Fragen</h2><button data-a="wissenThema" data-v="${id}">📖 Zum Kapitel</button></div>
    <p class="dim">✅ sitzt · 🙂 einmal richtig · ❌ zuletzt falsch · ▫️ noch nicht geübt</p>
    <div class="panel lernseite"><dl>${LE.karten(id).map((k) => `<dt>${zeichen(lernStand.f[k.id])} ${esc(k.frage)}</dt><dd><b>${esc(k.antwort)}</b> – ${esc(k.erkl)}</dd>`).join('')}</dl></div>
    <div class="row"><button class="primary grow" data-a="wissenUeben" data-v="${id}">🎯 Üben</button></div>`);
};
// Üben: eine Runde Fragen. v = Thema oder 'alles'
actions.wissenUeben = (v) => {
  const thema = LE.KAPITEL[v] ? v : null;
  lernRunde = { thema, fragen: LE.naechste(lernStand, thema), nr: 0, richtig: 0, wahl: null };
  lernFrage();
};
function lernFrage() {
  const R = lernRunde, F = R.fragen[R.nr], fertig = R.wahl != null;
  show(`
    <div class="bar"><button class="ghost" data-a="${R.thema ? 'wissenThema' : 'wissen'}" data-v="${R.thema || ''}">‹ Aufhören</button><h2>${R.thema ? LE.THEMEN[R.thema] : '🎲 Bunt gemischt'}</h2><span class="dim">Frage ${R.nr + 1} von ${R.fragen.length} · ${R.richtig} richtig</span></div>
    ${lernBalken((R.nr + (fertig ? 1 : 0)) / R.fragen.length)}
    <div class="panel lernfrage">
      ${R.thema ? '' : `<p class="dim" style="margin:0 0 6px">${LE.THEMEN[F.thema]}</p>`}
      <h3 style="margin-top:0">${esc(F.frage)}</h3>
      <div class="antworten">${F.antworten.map((a, i) => `<button class="${fertig ? (i === F.richtig ? 'gut' : i === R.wahl ? 'falsch' : '') : ''}" ${fertig ? 'disabled' : `data-a="wissenAntwort" data-v="${i}"`}>${esc(a)}</button>`).join('')}</div>
      ${fertig ? `<div class="merke"><b>${R.wahl === F.richtig ? '✅ Richtig!' : '❌ Leider falsch.'}</b> ${esc(F.erkl)}</div>` : ''}
    </div>
    ${fertig ? `<div class="row"><button class="primary grow" data-a="wissenWeiter">${R.nr + 1 < R.fragen.length ? 'Nächste Frage ›' : 'Zum Ergebnis ›'}</button></div>` : ''}`);
}
actions.wissenAntwort = (v) => {
  const R = lernRunde; if (!R || R.wahl != null) return;
  const F = R.fragen[R.nr]; R.wahl = +v;
  const stimmt = R.wahl === F.richtig;
  if (stimmt) R.richtig++;
  LE.eintragen(lernStand, F.id, stimmt); lernSichern();
  if (stimmt) sound.richtig(); else sound.falsch();
  lernFrage();
};
actions.wissenWeiter = () => {
  const R = lernRunde; if (!R) return actions.wissen();
  if (R.nr + 1 < R.fragen.length) { R.nr++; R.wahl = null; return lernFrage(); }
  const f = LE.fortschritt(lernStand, R.thema), q = R.richtig / R.fragen.length;
  show(`
    <div class="bar">${back('wissen')}<h2>Ergebnis</h2></div>
    <div class="panel" style="text-align:center">
      <div style="font-size:56px">${q === 1 ? '🏆' : q >= 0.75 ? '😀' : q >= 0.5 ? '🙂' : '💪'}</div>
      <h3>${R.richtig} von ${R.fragen.length} richtig</h3>
      <p>${q === 1 ? 'Perfekt – alles gewusst!' : q >= 0.75 ? 'Stark! Nur noch Kleinigkeiten.' : q >= 0.5 ? 'Gut gemacht. Die falschen Fragen kommen gleich noch einmal dran.' : 'Kein Problem: Lies das Kapitel noch einmal und probiere es wieder.'}</p>
      <p class="dim">${R.thema ? LE.THEMEN[R.thema] : 'Alle Kapitel'}: ${f.gekonnt} von ${f.fragen} Fragen gekonnt, ${f.sicher} sitzen richtig <span class="gold">${lernSterne(f.sterne)}</span></p>
      ${lernBalken(f.anteil)}
      <p class="dim" style="font-size:13px">★ ab der Hälfte · ★★ ab 8 von 10 · ★★★ wenn du jede Frage ${LE.SICHER}-mal hintereinander richtig hattest</p>
    </div>
    <div class="row"><button class="primary grow" data-a="wissenUeben" data-v="${R.thema || 'alles'}">Noch eine Runde ›</button>
      ${R.thema ? `<button data-a="wissenThema" data-v="${R.thema}">📖 Kapitel lesen</button>` : ''}<button data-a="wissen">Alle Kapitel</button></div>`);
  lernRunde = null;
};
// Die Seite „Steuerung“: Der Kasten zu DEINER Steuerung steht ganz oben und ist gelb markiert, die anderen folgen darunter.
const HELP_TITEL = { touch: 'Touch', wisch: 'Wischen', klassik: 'Klassik', profi: 'Profi', controller: 'Controller' };
function helpHtml() {
  const marke = '<div class="panel help"><h3>' + HELP_TITEL[settings.control];
  const von = HELP.indexOf(marke);
  if (von < 0) return HELP;
  const bis = HELP.indexOf('</div>', von) + 6;
  const meins = HELP.slice(von, bis).replace('<div class="panel help"><h3>', '<div class="panel help meins"><h3>⭐ Deine Steuerung: ');
  return meins + HELP.slice(0, von) + HELP.slice(bis);
}
actions.help = (v) => { if (v) helpBack = v; show(`<div class="bar">${back(helpBack)}<h2>Steuerung</h2></div>${helpHtml()}`); };

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
  startMatch({ me, opp, def: D.tournamentById(free.venue), title: 'Freies Spiel', revanche: true, onEnd: () => actions.free() });
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
      ${fromCareer ? '' : `<button class="big" data-a="spielzuege">Spielzüge lernen <small>${SZ.gelerntAnzahl(zugSpeicher)} von ${SZ.ZUG_IDS.length} gelernt · Schritt für Schritt mit Zielfeld</small></button>`}
    </div>`);
};

// ---------------------------------------------------------------
// Spielzug-Buch: alle taktischen Spielzüge ansehen, üben und lernen (siehe js/spielzuege.js)
// ---------------------------------------------------------------
// So macht man die Schläge mit der gewählten Steuerung (steht im Training unter dem Schritt, der dran ist)
const ZUG_TIPP = {
  touch: { aufschlag: 'nach oben wischen – schräg wischen = Richtung', drive: 'nach oben wischen – schräg = Richtung, länger = tiefer',
    slice: 'zur Seite wischen', drop: 'nach unten wischen', lob: 'doppelt tippen', netz: 'mit zwei Fingern nach oben wischen' },
  wisch: { aufschlag: 'nach oben wischen – schräg wischen = Richtung', drive: 'schräg nach oben wischen – früh wischen = cross, spät = die Linie entlang',
    slice: 'schräg nach unten wischen (ganz nach unten = kurzer Slice)', drop: 'ganz langsam nach unten wischen', lob: 'mit zwei Fingern nach oben wischen', netz: 'doppelt tippen' },
  klassik: { aufschlag: 'Mausrad zielt, linke Maustaste halten und loslassen', drive: 'Mausrad zielt, linke Maustaste halten = Kraft (mehr Kraft = tiefer)',
    slice: 'geht mit der Maus nicht – nimm die Steuerung „Profi“ oder „Touch“', drop: 'geht mit der Maus nicht – nimm die Steuerung „Profi“ oder „Touch“',
    lob: 'Doppelklick', netz: 'Pfeil nach oben halten' },
  profi: { aufschlag: 'Leertaste halten und loslassen, mit ← → zielen', drive: 'Leertaste – die Pfeiltasten beim Treffen bestimmen das Ziel',
    slice: 'Taste K', drop: 'Taste I', lob: 'Taste L', netz: 'W oder ↑ halten' },
  controller: { aufschlag: 'schwingen oder A – der Stick zielt', drive: 'schwingen oder A – Stick oder Timing zielt',
    slice: 'Taste B', drop: 'Taste Y', lob: 'Taste X', netz: 'Doppelklopfen oder Netz-Taste' },
};
function zugTipp(step) {
  const T = ZUG_TIPP[settings.control] || ZUG_TIPP.touch;
  const art = step.wer === 'aufschlag' ? 'aufschlag' : step.art && T[step.art[0]] ? step.art[0] : 'drive';
  return T[art] + (step.dannNetz ? ' · danach ans Netz: ' + T.netz : '');
}
actions.spielzuege = () => {
  const st = zugSpeicher, n = SZ.gelerntAnzahl(st);
  const karte = (id) => {
    const z = SZ.ZUEGE[id], stufe = SZ.stufe(st, id), frei = SZ.offen(st, id), e = st[id] || {};
    const status = stufe ? `<span class="gold">${SZ.STUFEN[stufe].stern} ${SZ.STUFEN[stufe].name}</span>`
      : frei ? `<span class="dim">noch nicht gelernt (${Math.min(e.t || 0, SZ.lernenOft)} von ${SZ.lernenOft})</span>` : '<span class="dim">🔒</span>';
    return `<div class="panel zug ${frei ? '' : 'zu'}"><h3>${esc(z.name)} ${status}</h3>
      <p>${esc(z.kurz)}</p>
      <ol>${z.schritte.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>
      <p class="dim"><b>Warum klappt das?</b> ${esc(z.warum)}</p>
      ${frei ? `<div class="row"><button class="${stufe ? '' : 'primary'}" data-a="zugUeben" data-v="${id}">${stufe ? 'Noch einmal üben' : 'Üben ›'}</button>
          ${stufe ? `<span class="dim" style="align-self:center">im Match geschafft: ${e.m || 0}${stufe < 3 ? ` · nächster Stern bei ${SZ.STUFEN[stufe + 1].abMatch}` : ''}</span>` : ''}</div>`
        : `<p class="dim">🔒 Lerne erst ${z.ab === 1 ? 'einen Spielzug' : z.ab + ' Spielzüge'} (du hast ${n}).</p>`}</div>`;
  };
  show(`
    <div class="bar">${back('training')}<h2>Spielzüge</h2></div>
    <div class="panel">
      <p style="margin-top:0">Ein Spielzug ist ein Plan aus zwei oder drei Schlägen. Im Training zeigt dir ein <b style="color:#35e06a">grünes Feld</b>, wohin der nächste Schlag gehen soll.
        Schaffst du einen Spielzug <b>${SZ.lernenOft}-mal</b>, hast du ihn gelernt. Dann wirkt er auch im Match: Der Gegner reagiert später und schlägt ungenauer.</p>
      <p class="dim">Aber Vorsicht: Spielst du immer denselben Spielzug, durchschaut dich der Gegner. Wechsle ab!</p>
      <label>Spielzüge im Match</label><div class="row">
        <button class="${settings.spielzuege === 'aus' ? 'sel' : ''}" data-a="zugModus" data-v="aus">Aus</button>
        <button class="${settings.spielzuege === 'an' ? 'sel' : ''}" data-a="zugModus" data-v="an">An</button>
        <span class="dim" style="align-self:center">${n} von ${SZ.ZUG_IDS.length} gelernt</span></div>
    </div>
    ${Object.keys(SZ.GRUPPEN).map((g) => `<h3>${SZ.GRUPPEN[g]}</h3><div class="grid zuege">${SZ.ZUG_IDS.filter((id) => SZ.ZUEGE[id].gruppe === g).map(karte).join('')}</div>`).join('')}`);
};
actions.zugModus = (v) => { settings.spielzuege = v; saveSettings(); keepScroll(actions.spielzuege); };
actions.zugUeben = (id) => {
  const me = getPlayer(free.me === 'me' && !career ? 'zverev' : free.me);
  const trainer = { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' };
  startMatch({ me, opp: trainer, def: D.tournamentById(free.venue), lernen: id, title: 'Spielzug: ' + SZ.ZUEGE[id].name, onEnd: () => actions.spielzuege() });
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
  } else if (m && mitLeben() && lebenC().abendOffen && def.cat !== 'LIGA') {
    // Nach einem Sieg: Was machst du am Abend? (Liste ABEND in turniertag.js)
    // Vorher hat dein Team noch Aufgaben für dich auf der Anlage (aufgaben.js) – wer mag, fährt gleich ins Hotel.
    TA.nachAufgaben(lebenC(), def, nachKennung());
    const nachOffen = TA.offen(lebenC(), 'nach');
    top = `<div class="panel"><h3 style="margin-top:0">📋 Nach dem Match: Aufgaben von deinem Team</h3>${aufgabenHtml('nach', false)}
      <div class="center">${nachOffen ? `<button class="primary" data-a="nachAnlage">🚶 Auf die Anlage <small>noch ${nachOffen} ${nachOffen === 1 ? 'Aufgabe' : 'Aufgaben'} offen</small></button>` : '<b class="gold">⭐ Alles erledigt – dein Team ist stolz auf dich!</b>'}</div></div>
      <div class="panel"><h3 style="margin-top:0">🌙 Der Abend nach deinem Sieg</h3><p class="dim">Morgen geht das Turnier für dich weiter. Was machst du heute Abend noch?${nachOffen ? ' (Danach ist der Tag vorbei – offene Aufgaben verfallen.)' : ''}</p>
      <div class="row">${Object.entries(TT.ABEND).map(([id, A]) => `<button data-a="abend" data-v="${id}">${A.name} <small>${A.bringt}</small></button>`).join('')}</div>
      ${hotelKnopf(def)}</div>`;
  } else if (m) {
    const oppId = m.a === T.humanId ? m.b : m.a;
    const opp = getPlayer(oppId), me = ctxT.season ? ichJetzt(oppId) : getPlayer(T.humanId);
    top = `${ctxT.season ? saisonVorMatch(oppId) : ''}<div class="panel"><div class="center dim">${def.cat === 'LIGA' ? 'Liga-Spiel' : D.ROUND_NAMES[label]}${m.group != null ? ' · Gruppe ' + 'AB'[m.group] : ''}</div>
      <div class="vs"><div><div class="who">${flag(me.country)} ${esc(me.short)}</div><div class="dim">Stärke ${D.overall(me.stats)}</div></div>
      <div class="x">gegen</div>
      <div><div class="who">${flag(opp.country)} ${esc(opp.short)}</div><div class="dim">${def.cat === 'LIGA' ? 'Spieler des anderen Vereins' : T.players[oppId].seed ? 'Nr. ' + T.players[oppId].seed + ' der Setzliste' : 'nicht gesetzt'} · Stärke ${D.overall(opp.stats)}</div></div></div>
      <div class="center">${mitLeben() && def.cat !== 'LIGA' ? `<button data-a="tagAnlage">🚶 Erst auf die Anlage <small>${lebenC().tag && lebenC().tag.aufg ? `📋 ${TA.offen(lebenC(), 'vor')} Aufgaben vom Team offen · noch ${TT.freieFenster(lebenC())} Zeitfenster` : '📋 Dein Team hat Aufgaben für dich'}</small></button> ` : ''}<button class="primary" data-a="tourPlay">Match spielen ›</button></div></div>`;
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
    me: ctxT.season ? ichJetzt(oppId) : getPlayer(T.humanId), opp: getPlayer(oppId), def, title: def.cat === 'LIGA' ? def.name : `${def.name} · ${D.ROUND_NAMES[TN.currentLabel(T)]}`,
    finale: def.cat !== 'LIGA' && TN.currentLabel(T) === 'F',
    bilanz: ctxT.season && season && season.profi ? season.profi.h2h[oppId] : null,      // Saison: deine Siege und Niederlagen gegen diesen Gegner (für den Steckbrief)
    onEnd: (res) => {
      TN.playRound(T, { winner: res.won ? T.humanId : oppId, score: res.score, setDiff: res.setDiff });
      let danach = renderTournament;
      if (ctxT.season) {
        // Saison: müde werden, Bilanz gegen diesen Gegner, Rivalen-Duell, Erfahrung (profisaison.js)
        const r = PS.matchGespielt(season, res.won, oppId, roundIdx);
        if (r.ups) danach = () => showInfo('Level ' + season.profi.level + '!', 'Dein Profi hat dazugelernt. Verteile die neuen Fähigkeitspunkte im Saison-Menü unter „Fähigkeiten & Körper“.', 'tourShow');
      }
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
  const r = TT.abend(lebenC(), v);
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
let anlageTag = null;        // { def, phase } wenn die Anlage gerade ein Turniertag ist (phase: 'vor' oder 'nach' dem Match), sonst null
const phaseJetzt = () => (anlageTag && anlageTag.phase) || 'vor';
// Kennung des Matches, nach dem die Aufgaben „nach dem Match“ gelten (damit es nach jedem Sieg neue gibt)
const nachKennung = () => `${ctxT.def.id}:${ctxT.T.rounds.length}`;
// Welche Quiz-Fragen hattest du schon? (gilt für alle Spielarten zusammen, damit sich die Fragen nicht so schnell wiederholen)
const QUIZ_KEY = 'powershot.quiz.v1';
let quizGesehen = [];
try { quizGesehen = JSON.parse(localStorage.getItem(QUIZ_KEY)) || []; } catch (e) { quizGesehen = []; }
function quizMerken(ids) {
  quizGesehen = [...new Set([...quizGesehen, ...ids])];
  if (quizGesehen.length > QZ.ANZAHL - 10) quizGesehen = ids.slice();       // fast alle durch: wieder von vorn
  try { localStorage.setItem(QUIZ_KEY, JSON.stringify(quizGesehen)); } catch (e) { /* voller Speicher: dann wiederholen sich Fragen eben eher */ }
}
MS.klaenge({ gut: () => sound.richtig(), tipp: () => sound.tipp(), schlecht: () => sound.falsch(), fertig: () => sound.geschafft(), stift: () => sound.stift(), plopp: () => sound.plopp() });
MS.setzeBuehne(new MiniBuehne(game.renderer));      // die Mini-Spiele bekommen ihr Bild in 3D (minibuehne.js)
// Die Liste „Aufgaben vom Team“ (wie das Aufgabenbuch im Reitturnier). mitWeg = mit Knöpfen „Hinlaufen“
function aufgabenHtml(phase, mitWeg = true) {
  const c = lebenC(), L = TA.liste(c, phase);
  if (!L.length) return '';
  const alle = L.every((a) => a.note != null);
  return `<div class="aufgaben">${L.map(({ id, A, note }) => `<div class="aufg${note != null ? ' ok' : ''}"><span class="bild">${note != null ? '✅' : '⬜'}</span>
      <span class="was"><b>${A.bild} ${esc(A.name)}</b> <small>${note != null ? (note >= 0.75 ? '⭐⭐⭐' : note >= 0.4 ? '⭐⭐' : '⭐') : `${esc(TA.werSagt(c, A.von))}: „${esc(TA.auftragText(id, phase))}“`}</small></span>
      ${note == null && mitWeg ? `<button data-a="anlageGeh" data-v="${A.ort}">Hinlaufen ›</button>` : ''}</div>`).join('')}</div>
    <p class="dim klein">${alle ? `⭐ Alle Aufgaben geschafft! ${TA.STERN[phase].text}.` : `Aufgaben vom Team kosten keine Zeit. Schaffst du alle, gibt es einen <b>Team-Stern ⭐</b> und einen Bonus (${TA.STERN[phase].text.split(': ')[1]}).`} Team-Sterne bisher: ⭐ ${c.teamSterne || 0}</p>`;
}
let anlageWo = 'wim';        // welches Gelände man sich im Hauptmenü ansieht (Kürzel des Turniers)
// Das Stempelheft: Welche Sehenswürdigkeiten (blaue Kreise ℹ️) hast du schon entdeckt? Gilt für alle Spielarten zusammen.
const STEMPEL_KEY = 'powershot.stempel.v1';
let stempel = {};
try { stempel = JSON.parse(localStorage.getItem(STEMPEL_KEY)) || {}; } catch (e) { stempel = {}; }
const stempelVon = (G) => stempel[G.name] || [];
let anlageListe = false;     // ist die Liste „Gelände wechseln“ gerade aufgeklappt?
// Welches Gelände wird gerade gezeigt? Die großen Turniere haben ihr eigenes, die kleinen die einfache Anlage (null).
const anlageGelaende = () => (hotelWeg && hotelWeg.stadt) || GL.gelaendeFuer(anlageTag ? anlageTag.def : D.tournamentById(anlageWo));
// Für die Auswahl im Hauptmenü: ein paar kleine Turniere als Beispiele (je Stadt das erste im Kalender) und dein Heimatverein
const ANLAGE_KLEIN = ['Halle', 'Hamburg', 'London', 'Dubai', 'Tokio', 'Basel', 'Kitzbühel', 'Umag', 'Stuttgart', 'Hongkong', 'Heilbronn', 'Ortisei', 'Neapel', 'Saarlouis', 'Monastir', 'Nußloch']
  .map((stadt) => KT.KLEINE_TURNIERE.find((t) => t.city === stadt)).filter(Boolean).concat([KT.LIGA]);
let anlageErgebnis = null;   // was die letzte Tätigkeit gebracht hat: { ort, text, bringt }
let anlageMeldung = null;    // was nach einem Zufall (Ereignis) passiert ist: { text, bringt }
// Der Kasten unten auf dem Gelände lässt sich klein machen, damit man mehr vom Gelände sieht
let anlageKlein = false;
// Unten auf dem Gelände liegt nur eine schmale Leiste mit Knöpfen. Ein Tipp darauf klappt EINE Sache auf:
// 'aufgaben' (Liste vom Team), 'wohin' (Knöpfe zum Hinlaufen), 'hilfe' (wie man steuert). null = nichts ist aufgeklappt.
let anlageAuf = null;
let anlageWeg = null;        // den Kasten zu diesem Ort hat man mit ✕ weggetippt (id des Ortes) – er kommt wieder, wenn man neu an die Tür tritt
actions.anlageAuf = (v) => { anlageAuf = anlageAuf === v ? null : v; anlageListe = false; anlageZeigen(); };
actions.anlageZu = () => { if (anlageAuf || anlageListe) { anlageAuf = null; anlageListe = false; } else { anlageWeg = game.anlage.amOrt ? game.anlage.amOrt.id : '-'; anlageMeldung = null; } anlageZeigen(); };
// Die Kamera-Knöpfe rechts, genau wie auf dem Pferdehof im Reitturnier: drehen, zoomen, neigen (solange gedrückt)
const KAM_KNOEPFE = [['links', '⟲', 'Kamera nach links drehen'], ['rechts', '⟳', 'Kamera nach rechts drehen'], ['nah', '＋', 'näher'], ['fern', '－', 'weiter weg'],
  ['hoch', '▲', 'Kamera höher, mehr von oben'], ['flach', '▼', 'Kamera flacher, mehr von der Seite']];
actions.anlagePanel = () => actions.anlageZu();      // (alter Name, falls ihn noch jemand ruft)
function anlageZeigen() {
  if (hotelWeg || (anlageTag && anlageTag.abend)) return hotelZeigen();      // Fahrt oder Fußweg ins Hotel: eigenes Fenster (weiter unten)
  const A = game.anlage, ort = A.amOrt;
  const reit = A.reit();
  // Zwei Arten der Steuerung (Einstellungen → „Steuerung auf dem Turniergelände“): wie auf dem Pferdehof im Reitturnier oder mit freier Kamera
  const hilfe = reit
    ? 'Laufen: Pfeiltasten oder W A S D. Auf dem iPad: Finger auflegen und ziehen. Tippe auf ein Gebäude, dann läuft deine Figur von selbst hin. In viele Häuser kannst du durch die Tür hineingehen – dann verschwindet das Dach und du siehst die Möbel. Rechts sind die Knöpfe für die Kamera: 🗺️ Übersicht, ⟲ ⟳ drehen, ＋ － näher und weiter weg, ▲ ▼ mehr von oben oder flacher. Mit zwei Fingern geht das auch: zur Seite wischen = drehen, hoch oder runter = neigen, kneifen = zoomen. Am PC: rechte Maustaste ziehen und Mausrad, Tasten Q und R drehen, T und G zoomen, M = Übersicht, K = Lageplan, B = Beschriftungen.'
    : 'Laufen: W A S D oder mit einem Finger ziehen. Tippe auf ein Gebäude, dann läuft deine Figur von selbst hin. In viele Häuser kannst du durch die Tür hineingehen – dann verschwindet das Dach und du siehst die Möbel. Kamera mit zwei Fingern: kneifen = nah oder ganz weit weg, zur Seite wischen = rundherum drehen, hoch oder runter wischen = Blickwinkel. Mit drei Fingern schiebst du die Ansicht frei über das Gelände (danach reicht ein Finger), Doppel-Tipp oder 🎯 = zurück zur Figur. 🏷️ schaltet die Beschriftungen an und aus. Am PC: rechte Maustaste ziehen und Mausrad, mittlere Maustaste oder Umschalt + ziehen = verschieben, F = zurück zur Figur, B = Beschriftungen.';
  // Reihenfolge wie im Reitturnier: Übersicht, drehen, zoomen, neigen – danach unsere eigenen Knöpfe (Beschriftungen, Tageszeit, Wetter, Foto)
  const kam = [['karte', '🗺️', 'Übersicht von oben (Taste M) – den Lageplan öffnest du mit einem Tipp auf das Radar oder Taste K'], ['schilder', '🏷️', 'Beschriftungen an oder aus (Taste B)'], ...KAM_KNOEPFE,
    ...stimmungKnoepfe(), ...(reit ? [] : [['figur', '🎯', 'Zurück zur Figur (Doppel-Tipp oder Taste F)']])];
  let unten = `<p class="dim">${hilfe}</p>`, zeit = '', tagListe = '';
  if (anlageTag && phaseJetzt() === 'nach') {
    // Nach dem Match: nur noch die Aufgaben vom Team, dann geht es ins Hotel
    const offen = TA.offen(lebenC(), 'nach');
    zeit = `<span class="zeit">${esc(anlageTag.def.name)} · Nach dem Match · ${offen ? `noch ${offen} ${offen === 1 ? 'Aufgabe' : 'Aufgaben'}` : 'alles erledigt ⭐'} · Frische ${Math.round(lebenC().frische)}</span>`;
    unten = `<h3>📋 Aufgaben von deinem Team</h3>${aufgabenHtml('nach')}<p class="dim">${offen ? 'Lauf zu den Orten und erledige die Aufgaben.' : 'Geschafft!'} Zum Schluss geht es mit dem <b>Fahrdienst ins Hotel</b> (oder oben auf „Zurück“).</p>`;
  } else if (anlageTag) {
    // Der Tag vor dem Match: oben steht, wie viel Zeit noch ist
    const frei = TT.freieFenster(lebenC()), offen = TA.offen(lebenC(), 'vor');
    zeit = `<span class="zeit">${esc(anlageTag.def.name)} · ${TT.fensterName(lebenC())} · 📋 ${offen ? `noch ${offen} ${offen === 1 ? 'Aufgabe' : 'Aufgaben'}` : 'Aufgaben erledigt ⭐'} · ${frei ? `${frei} Zeitfenster frei` : 'keine freie Zeit mehr'} · Frische ${Math.round(lebenC().frische)}</span>`;
    const court = A.orte.find((o) => o.id === 'court');
    unten = `<h3>📋 Aufgaben von deinem Team</h3>${aufgabenHtml('vor')}<p class="dim">${frei ? `Dazu hast du noch <b>${frei} Zeitfenster</b> für Freiwilliges – an jedem Ort siehst du, was dort geht.` : 'Für Freiwilliges ist keine Zeit mehr.'} Dein Match wartet im <b>${esc(court ? court.name : 'Centre Court')}</b>.</p>`;
  }
  tagListe = anlageTag ? unten : '';       // die Aufgabenliste merken: Am Morgen (noch am Fahrdienst) bleibt sie zu sehen
  // Auf einem großen Gelände: oben steht, wo man ist, und unten gibt es Knöpfe zum Hinlaufen (die Wege sind lang)
  const G = A.plan ? A.plan.g : null;
  let wohin = '', listeHtml = '';
  if (G) {
    if (!anlageTag) {
      zeit = `<span class="zeit">${esc(G.name)} · <span class="dim">${esc(G.stadt)}</span></span><button data-a="anlageListe">🌍 Gelände wechseln</button>`;
      if (anlageListe) unten = anlageListe
        ? `<h3>Welches Turniergelände möchtest du sehen?</h3><div class="row wahl">${GL.GELAENDE_LISTE.map((id) => `<button class="${id === anlageWo ? 'primary' : ''}" data-a="anlageWahlOrt" data-v="${id}">${esc(D.tournamentById(id).name)} <small>${esc(GL.GELAENDE[id].name)}</small></button>`).join('')}</div>
          <p class="dim klein">Kleinere Turniere (Beispiele – in der Karriere hat jedes Turnier sein eigenes Gelände):</p>
          <div class="row wahl">${ANLAGE_KLEIN.map((t) => `<button class="${t.id === anlageWo ? 'primary' : ''}" data-a="anlageWahlOrt" data-v="${t.id}">${esc(t.city === 'Zu Hause' ? 'Heimatverein' : t.city)} <small>${esc(t.catName)}</small></button>`).join('')}</div>`
        : `<p class="dim">${G.klein ? 'Dieses Gelände ist ausgedacht und nur an den echten Ort angelehnt.' : 'Dieses Gelände ist dem echten nachempfunden.'} Lauf herum und sieh dir alles an – an den blauen Kreisen ℹ️ erfährst du etwas über den Ort.</p>`;
    }
    if (anlageListe && !anlageTag) listeHtml = unten;      // die Liste „Gelände wechseln“ merken (weiter unten wird „unten“ vielleicht vom Ort überschrieben)
    const hab = stempelVon(G), infos = A.orte.filter((o) => o.info);
    // Am Turniertag: Orte, die es bei so kleinen Turnieren noch nicht gibt (Kraftraum, Physio …), bekommen ein Schloss
    const zu = (o) => { if (!anlageTag || o.info || o.id === 'court' || o.id === 'hotel') return false; const hier = TA.AUFGABEN_IDS.filter((id) => TA.AUFGABEN[id].ort === o.id); return hier.length > 0 && !hier.some((id) => TA.gibtEs(id, anlageTag.def)); };
    const knopf = (o) => (zu(o) ? `<button class="zu" data-a="anlageGeh" data-v="${o.id}" title="Das gibt es erst bei größeren Turnieren">🔒 ${esc(o.name)}</button>`
      : `<button data-a="anlageGeh" data-v="${o.id}">${o.info ? (hab.includes(o.name) ? '✅ ' : 'ℹ️ ') : ''}${esc(o.name)}</button>`);
    wohin = `<div class="wohin"><span class="dim">Hinlaufen:</span> ${A.orte.filter((o) => !o.info && o.id !== 'hotel').map(knopf).join('')}${infos.map(knopf).join('')}</div>
      <p class="dim klein">📒 Stempelheft: ${infos.filter((o) => hab.includes(o.name)).length} von ${infos.length} Orten entdeckt${infos.length && infos.every((o) => hab.includes(o.name)) ? ' – alle gefunden! ⭐' : ''}${A.ball ? ' · 🟡 Irgendwo liegt heute ein goldener Glücksball …' : ''}</p>`;
  }
  const E = anlageTag ? TT.ereignis(lebenC()) : null;
  if (E) {
    // Heute ist etwas Besonderes passiert: erst entscheiden, dann geht der Tag weiter
    unten = `<h3>${E.bild} Heute Morgen …</h3><p>${esc(E.text)}</p><div class="row">${E.wahl.map((w, i) => `<button class="${i ? '' : 'primary'}" data-a="tagEreignis" data-v="${i}">${esc(w[0])}</button>`).join('')}</div>`;
  } else if (anlageMeldung && !ort) {
    unten = `<p>${esc(anlageMeldung.text)}</p>${anlageMeldung.bringt.length ? `<p class="gold">${anlageMeldung.bringt.join(' · ')}</p>` : ''}<p class="dim">Und jetzt: Such dir aus, was du vor dem Match machst.</p>`;
  } else if (ort) {
    unten = `<h3>${esc(ort.name)}</h3><p>${ort.text}</p>${ort.info || G ? '' : '<p class="dim klein">Hier passiert noch nichts. Später gehst du hier hinein.</p>'}`;
    if (G && !ort.info && !anlageTag && ort.id !== 'hotel') unten += `<p class="dim klein">${esc({ court: 'In der Karriere spielst du hier dein Match.' }[ort.id] || 'In der Karriere erledigst du hier am Turniertag Aufgaben von deinem Team.')}</p>`;
    if (G && !anlageTag && ort.id === 'hotel') unten = hotelAmWagen(G);
    if (anlageTag && !ort.info) {
      const phase = phaseJetzt(), c = lebenC();
      // Was gerade hier herausgekommen ist (nach einem Mini-Spiel), steht oben
      const ergebnis = anlageErgebnis && anlageErgebnis.ort === ort.id ? `<p>${anlageErgebnis.text}</p><p class="gold">${anlageErgebnis.bringt.join(' · ')}</p>` : '';
      if (ort.id === 'court') {
        const offen = TA.offen(c, 'vor');
        unten = phase === 'nach' ? `<h3>${esc(ort.name)}</h3><p>Dein Match ist vorbei. Die Zuschauer gehen nach Hause.</p>`
          : `<h3>${esc(ort.name)}</h3><p>Dein Gegner wartet schon. Bist du bereit?${offen ? ` <span class="dim">(Du hast noch ${offen} ${offen === 1 ? 'Aufgabe' : 'Aufgaben'} vom Team offen – die verfallen dann.)</span>` : ''}</p><button class="primary" data-a="anlageMatch">Match spielen ›</button>`;
      } else if (ort.id === 'hotel') {
        const nachOffen = TA.offen(c, 'nach');
        unten = phase === 'nach' ? `${tagListe}<p>${nachOffen ? 'Du hast noch Aufgaben offen.' : 'Alles erledigt!'} Im Hotel suchst du dir aus, was du am Abend machst.</p><button class="${nachOffen ? '' : 'primary'}" data-a="nachHotel">🏨 ${nachOffen ? 'Trotzdem schon ins Hotel' : 'Ab ins Hotel'} ›</button>`
          : `<h3>${esc(ort.name)}</h3><p class="dim">Du bist mit dem Fahrdienst angekommen. Erst nach dem Match geht es zurück ins Hotel. Was dein Team heute von dir möchte, steht unten bei <b>📋 Aufgaben</b>.</p>`;
      } else {
        // Alles, was man an diesem Ort machen kann: Aufgaben vom Team zuerst, dann Freiwilliges. Jedes ist ein Mini-Spiel.
        const liste = TA.amOrt(c, ort.id, anlageTag.def, phase);
        const zeile = (a) => (a.note != null || (!a.ok && a.warum === 'Das hast du heute schon gemacht.') ? `<div class="aufg ok"><span class="bild">✅</span><span class="was"><b>${a.A.bild} ${esc(a.A.name)}</b> <small>heute schon gemacht</small></span></div>`
          : a.ok ? `<button class="${a.team ? 'primary' : ''}" data-a="aufgabe" data-v="${a.id}">${a.A.bild} ${esc(a.A.name)} <small>${a.team ? '📋 Aufgabe vom Team · kostet keine Zeit' : 'freiwillig · braucht 1 Zeitfenster'}</small></button>`
            : `<div class="aufg"><span class="bild">🚫</span><span class="was"><b>${a.A.bild} ${esc(a.A.name)}</b> <small>${esc(a.warum)}</small></span></div>`);
        unten = `<h3>${esc(ort.name)}</h3>${ergebnis || `<p>${ort.text}</p>`}` + (liste.length ? `<div class="spalte">${liste.map(zeile).join('')}</div>`
          : `<p class="dim">${phase === 'nach' ? 'Hier hat dein Team heute keine Aufgabe mehr für dich.' : 'Hier gibt es heute nichts zu tun.'}</p>`);
      }
    } else if (anlageErgebnis && anlageErgebnis.ort === ort.id && !(G && ort.id === 'hotel')) {
      unten = `<h3>${esc(ort.name)}</h3><p>${anlageErgebnis.text}</p><p class="gold">${anlageErgebnis.bringt.join(' · ')}</p>`;
    }
  }
  // --- Was ist unten zu sehen? Immer nur die schmale Leiste – und darüber höchstens EIN kleiner Kasten. ---
  //   1. Etwas, das man entscheiden muss (Zufall am Morgen)            → Kasten bleibt, bis man gewählt hat
  //   2. Etwas, das man selbst aufgeklappt hat (Aufgaben, Hinlaufen, Hilfe, Gelände wechseln)
  //   3. Man steht an einer Tür                                         → Kasten zu diesem Ort (mit ✕ wegzutippen)
  //   4. Sonst nichts: Das Gelände ist frei zu sehen.
  const offenZahl = anlageTag ? TA.offen(lebenC(), phaseJetzt() === 'nach' ? 'nach' : 'vor') : 0;
  let kasten = '', muss = false;
  if (E) { kasten = unten; muss = true; }
  else if (listeHtml) kasten = listeHtml;
  else if (anlageAuf === 'hilfe') kasten = `<h3>❓ So steuerst du</h3><p class="dim">${hilfe}</p>`;
  else if (anlageAuf === 'wohin' && wohin) kasten = `<h3>🧭 Wohin möchtest du?</h3>${wohin}`;
  else if (anlageAuf === 'aufgaben' && tagListe) kasten = tagListe;
  else if (ort && anlageWeg !== ort.id) kasten = unten;
  else if (anlageMeldung && !ort && anlageWeg !== '-') kasten = unten;
  const chip = (id, text) => `<button class="${anlageAuf === id ? 'sel' : ''}" data-a="anlageAuf" data-v="${id}">${text}</button>`;
  const leiste = muss ? '' : `<div class="leiste">
    ${anlageTag ? chip('aufgaben', `📋 Aufgaben${offenZahl ? ` <b class="zahl">${offenZahl}</b>` : ' ⭐'}`) : ''}
    ${wohin ? chip('wohin', '🧭 Hinlaufen') : ''}
    ${chip('hilfe', '❓ Hilfe')}</div>`;
  anlageEl.innerHTML = `<div class="oben"><button class="ghost" data-a="anlageEnde">‹ Zurück</button>${zeit}</div>
    <div class="kam">${kam.map(([k, z, t]) => `<button data-kam="${k}"${(k === 'schilder' && !game.anlage.schilderAn) || (k === 'figur' && !game.anlage.frei) ? ' class="aus"' : ''} title="${t}" aria-label="${t}">${z}</button>`).join('')}</div>
    ${kasten ? `<div class="panel${muss ? ' muss' : ''}">${muss ? '' : '<button class="klappe" data-a="anlageZu" title="Kasten schließen" aria-label="Kasten schließen">✕</button>'}${kasten}</div>` : ''}${leiste}`;
  anlageEl.classList.add('on');
}
// Taste B schaltet die Beschriftungen auch – dann den Knopf 🏷️ mit umfärben
game.anlage.wennSchilder = (an) => { const b = anlageEl.querySelector('[data-kam="schilder"]'); if (b) b.classList.toggle('aus', !an); };
// Der Knopf 🎯 ist blass, solange die Kamera sowieso bei der Figur ist
game.anlage.wennFrei = (frei) => { const b = anlageEl.querySelector('[data-kam="figur"]'); if (b) b.classList.toggle('aus', !frei); };
// Kamera-Knöpfe: solange gedrückt, dreht oder zoomt die Kamera
anlageEl.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-kam]');
  if (!b) return;
  e.preventDefault();
  if (b.dataset.kam === 'zeit' || b.dataset.kam === 'wetter') stimmungWeiter(b.dataset.kam);
  else if (b.dataset.kam === 'foto') fotoStart();
  else if (b.dataset.kam === 'karte') game.anlage.uebersicht();
  else if (b.dataset.kam === 'figur') game.anlage.zurFigur();
  else if (b.dataset.kam === 'schilder') b.classList.toggle('aus', !game.anlage.schilderSchalten());
  else game.anlage.kamTaste = b.dataset.kam;
});
for (const n of ['pointerup', 'pointercancel', 'pointerleave']) anlageEl.addEventListener(n, () => { game.anlage.kamTaste = null; }, true);

// ---- Tageszeit und Wetter auf dem Gelände (gelaendewetter.js, Idee aus dem Reitturnier). Man wählt selbst; abends nach dem Match ist von allein Abend.
const STIMMUNG_KEY = 'powershot.stimmung.v1';
let stimmung = { zeit: null, wetter: 'sonne' };       // zeit null = von allein (Mittag, am Abend nach dem Match Abend)
try { stimmung = { ...stimmung, ...(JSON.parse(localStorage.getItem(STIMMUNG_KEY)) || {}) }; } catch (e) { /* dann eben Mittag und Sonne */ }
const zeitJetzt = () => (GW.ZEITEN[stimmung.zeit] ? stimmung.zeit : (hotelWeg || (anlageTag && anlageTag.abend) ? 'abend' : 'tag'));
const wetterJetzt = () => (GW.WETTER[stimmung.wetter] ? stimmung.wetter : 'sonne');
const stimmungKnoepfe = () => [
  ['zeit', GW.ZEITEN[zeitJetzt()].bild, `Tageszeit: ${GW.ZEITEN[zeitJetzt()].name} – antippen wechselt (Mittag, Abend, Nacht, Morgen)`],
  ['wetter', GW.WETTER[wetterJetzt()].bild, `Wetter: ${GW.WETTER[wetterJetzt()].name} – antippen wechselt (Sonne, Wolken, Regen, Nebel)`],
  ['foto', '📷', 'Fotomodus: alle Knöpfe weg, Kamera frei drehen, Foto speichern (Taste P)'],
];
function stimmungWeiter(was) {
  if (was === 'zeit') stimmung.zeit = GW.ZEIT_REIHE[(GW.ZEIT_REIHE.indexOf(zeitJetzt()) + 1) % GW.ZEIT_REIHE.length];
  else stimmung.wetter = GW.WETTER_REIHE[(GW.WETTER_REIHE.indexOf(wetterJetzt()) + 1) % GW.WETTER_REIHE.length];
  try { localStorage.setItem(STIMMUNG_KEY, JSON.stringify(stimmung)); } catch (e) { /* ohne Speicher gilt es nur bis zum Neuladen */ }
  const Z = GW.ZEITEN[zeitJetzt()], W = GW.WETTER[wetterJetzt()];
  for (const b of document.querySelectorAll('[data-kam="zeit"]')) { b.textContent = Z.bild; b.title = `Tageszeit: ${Z.name}`; }
  for (const b of document.querySelectorAll('[data-kam="wetter"]')) { b.textContent = W.bild; b.title = `Wetter: ${W.name}`; }
  fotoEl.querySelector('.was').textContent = `${Z.bild} ${Z.name} · ${W.bild} ${W.name}`;
}

// ---- Radar und Lageplan (gelaendekarte.js, Idee aus Police Quest). Ein Tipp auf einen Ort im Plan = die Figur läuft hin.
const gKarte = new GelaendeKarte((ort) => { game.anlage.geheZu(ort.id); });

// ---- Fotomodus (Idee aus dem Reitturnier): Knöpfe und Schilder verschwinden, die Kamera dreht man wie immer, 📸 speichert das Bild.
let fotoAn = false, fotoRahmen = true, fotoSchilder = true;
const fotoEl = document.createElement('div');
fotoEl.id = 'fotoLeiste';
fotoEl.innerHTML = `<span class="was"></span><button data-kam="zeit" title="Tageszeit wechseln">☀️</button><button data-kam="wetter" title="Wetter wechseln">☀️</button>
  <button data-foto="rahmen" title="Mit oder ohne Rahmen">🖼️ Rahmen: an</button><button class="primary" data-foto="knips">📸 Foto machen</button><button data-foto="zu">✕ Fertig</button>`;
document.body.appendChild(fotoEl);
const fotoBlitz = document.createElement('div');
fotoBlitz.id = 'fotoBlitz';
document.body.appendChild(fotoBlitz);
function fotoStart() {
  const A = game.anlage;
  if (fotoAn || !A.an) return;
  fotoAn = true; fotoSchilder = A.schilderAn; A.schilderAn = false;       // die Beschriftungen stören auf dem Foto (nur solange der Fotomodus an ist)
  A.kamTaste = null;
  const Z = GW.ZEITEN[zeitJetzt()], W = GW.WETTER[wetterJetzt()];
  fotoEl.querySelector('[data-kam="zeit"]').textContent = Z.bild; fotoEl.querySelector('[data-kam="wetter"]').textContent = W.bild;
  fotoEl.querySelector('.was').textContent = `${Z.bild} ${Z.name} · ${W.bild} ${W.name}`;
  document.body.classList.add('foto');
}
function fotoEnde() {
  if (!fotoAn) return;
  fotoAn = false; game.anlage.schilderAn = fotoSchilder;
  document.body.classList.remove('foto');
}
function fotoKnips() {
  game.frame(0);                     // das Bild frisch malen – gleich danach kann man es von der Malfläche abnehmen
  const quelle = game.renderer.domElement, c = document.createElement('canvas'), G = game.anlage.plan ? game.anlage.plan.g : null;
  if (fotoRahmen) {
    // Rahmen wie bei einem Sofortbild, unten der Ort und das Datum
    const rand = Math.round(quelle.width * 0.03), unten = Math.round(quelle.width * 0.085), k = c.getContext('2d');
    c.width = quelle.width + rand * 2; c.height = quelle.height + rand + unten;
    k.fillStyle = '#fffaf0'; k.fillRect(0, 0, c.width, c.height);
    k.drawImage(quelle, rand, rand);
    k.fillStyle = '#1a2440'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.font = `bold ${Math.round(unten * 0.4)}px system-ui, "Segoe UI", Arial, sans-serif`;
    k.fillText(`🎾 ${G ? `${G.name} · ` : ''}${new Date().toLocaleDateString('de-DE')}`, c.width / 2, quelle.height + rand + unten / 2);
  } else { c.width = quelle.width; c.height = quelle.height; c.getContext('2d').drawImage(quelle, 0, 0); }
  fotoBlitz.classList.remove('an'); void fotoBlitz.offsetWidth; fotoBlitz.classList.add('an');
  sound.play('klick');
  const name = `powershot-foto-${Date.now()}.png`;
  c.toBlob((blob) => {
    if (!blob) return;
    // Auf iPad und iPhone über „Teilen“ (dort kann man das Bild in den Fotos sichern), sonst als Datei speichern
    try {
      const datei = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [datei] }) && (/iPad|iPhone|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1)) {
        navigator.share({ files: [datei], title: 'Powershot Tennis' }).catch(() => {});
        return;
      }
    } catch (e) { /* dann eben als Datei */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }, 'image/png');
  return c;
}
fotoEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.kam) stimmungWeiter(b.dataset.kam);
  else if (b.dataset.foto === 'rahmen') { fotoRahmen = !fotoRahmen; b.textContent = `🖼️ Rahmen: ${fotoRahmen ? 'an' : 'aus'}`; }
  else if (b.dataset.foto === 'knips') fotoKnips();
  else fotoEnde();
});
window.addEventListener('keydown', (e) => {
  if (!game.anlage.an || MS.offen() || e.target.closest('input, textarea')) return;
  if (e.code === 'KeyP') (fotoAn ? fotoEnde : fotoStart)();
  else if (e.code === 'KeyK' && !fotoAn) (gKarte.offen() ? gKarte.zu() : gKarte.stand && gKarte.auf(gKarte.stand));
  else if (e.code === 'Escape') { fotoEnde(); gKarte.zu(); }
});
// Jedes Bild: Stimmung weitergeben und das Radar malen
function gelaendeFrame() {
  const A = game.anlage, an = A.an && !!A.plan;
  if (!an) { if (fotoAn) fotoEnde(); gKarte.setze(null); return; }
  if (A.stimmung.zeit !== zeitJetzt() || A.stimmung.wetter !== wetterJetzt()) A.stimmungSetzen(zeitJetzt(), wetterJetzt());
  gKarte.setze(A.plan);
  const wo = A.kamZiel || A.p, punkte = [];
  // Am Rand des Radars: im Städtchen das Hotel (gelb), auf dem Gelände am Turniertag der Platz, auf dem dein Match wartet (weiß)
  const fest = A.orte.find((o) => o.id === (gKarte.istStadt() ? 'ziel' : 'court'));
  if (fest && (gKarte.istStadt() || anlageTag)) punkte.push({ x: fest.tx, z: fest.tz, farbe: gKarte.istStadt() ? '#ffd23a' : '#ffffff' });
  gKarte.radar({ x: wo.x, z: wo.z, blick: A.p.blick, kamW: A.kam.w, ziel: A.ziel, punkte });
}

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
    anlageWeg = null;                       // neu an einer Tür (oder weg von ihr): Der Kasten darf wiederkommen
    if (ort) { anlageAuf = null; anlageListe = false; }      // was aufgeklappt war, macht Platz für den Ort
    // Eine Sehenswürdigkeit zum ersten Mal besucht? Dann gibt es einen Stempel ins Heft (und in der Karriere etwas Erfahrung).
    const G = game.anlage.plan && game.anlage.plan.g;
    if (ort && ort.info && G && !stempelVon(G).includes(ort.name)) {
      stempel[G.name] = [...stempelVon(G), ort.name];
      try { localStorage.setItem(STEMPEL_KEY, JSON.stringify(stempel)); } catch (e) { /* voller Speicher: dann eben ohne Stempel */ }
      sound.stern();
      anlageErgebnis = { ort: ort.id, text: ort.text, bringt: ['📒 Neuer Stempel im Heft!', ...(anlageTag ? TT.entdeckt(lebenC()) : [])] };
    }
    anlageZeigen();
  };
  anlageAuf = anlageTag && !ergebnis && !woher ? 'aufgaben' : null; anlageWeg = null;      // am Morgen zeigt das Team einmal seine Aufgaben, sonst ist das Gelände frei
  game.anlage.start(woher, anlageGelaende());
  // Der Glücksball: in der Karriere einer pro Turniertag, beim freien Herumlaufen immer einer (nicht nach dem Match, nicht am Abend und nicht im Städtchen)
  if (hotelWeg || (anlageTag && (anlageTag.abend || anlageTag.phase === 'nach'))) { /* heute kein Glücksball mehr */ } else if (!anlageTag || !TT.ballGefunden(lebenC())) game.anlage.ballLegen();
  game.anlage.wennBall = () => {
    sound.stern();
    const bringt = anlageTag ? TT.gluecksball(lebenC()) || [] : [];
    anlageMeldung = { text: '🟡 Du hast den goldenen Glücksball gefunden! ' + (anlageTag ? 'Mit so einem Glücksbringer in der Tasche gehst du ganz ruhig ins Match.' : 'In der Karriere bringt er dir Glück für das Match des Tages.'), bringt };
    anlageZeigen();
  };
  anlageZeigen();
}
// Knopf „Hinlaufen“: Die Figur sucht sich den Weg selbst
actions.anlageGeh = (v) => { game.anlage.geheZu(v); anlageAuf = null; anlageZeigen(); };      // losgelaufen: Die Liste klappt wieder zu
actions.anlageListe = () => { anlageListe = !anlageListe; anlageAuf = null; anlageZeigen(); };
// Ein anderes Gelände ansehen (nur im Hauptmenü)
actions.anlageWahlOrt = (v) => { if (anlageTag || !D.tournamentById(v)) return; anlageWo = v; anlageListe = false; anlageStart(career ? CA.mePlayer(career) : D.PLAYERS[0]); };
function anlageSchluss() { hotelSchluss(); anlageMeldung = null; game.anlage.ende(); anlageEl.classList.remove('on'); anlageEl.innerHTML = ''; }
// Aus dem Hauptmenü: einfach nur herumlaufen (mit deinem Karriere-Spieler, sonst mit dem ersten Spieler der Liste)
actions.anlage = () => { anlageTag = null; hotelWeg = null; anlageListe = false; anlageStart(career ? CA.mePlayer(career) : D.PLAYERS[0]); };
// In der Karriere: der Tag vor dem Match. Wer schon auf der Anlage war und zurückkommt, macht dort weiter.
actions.tagAnlage = () => {
  if (!mitLeben()) return;
  if (!lebenC().tag) TT.tagStart(lebenC(), ctxT.def);
  if (!lebenC().tag.aufg) TA.tagAufgaben(lebenC(), ctxT.def);       // das Team sucht die Aufgaben für heute aus (aufgaben.js)
  anlageTag = { def: ctxT.def, phase: 'vor' };
  anlageStart(ichJetzt());
};
// Nach einem Sieg: noch einmal auf die Anlage, für die Aufgaben nach dem Match
actions.nachAnlage = () => {
  if (!mitLeben() || !lebenC().abendOffen) return;
  TA.nachAufgaben(lebenC(), ctxT.def, nachKennung());
  anlageTag = { def: ctxT.def, phase: 'nach' };
  anlageStart(ichJetzt());
};
// Ein Zufall am Morgen: Antwort wählen
actions.tagEreignis = (v) => { if (anlageTag) anlageMeldung = TT.ereignisWahl(lebenC(), +v); anlageZeigen(); };
// Welchen Spielzug übt der Trainer heute mit dir? Am liebsten einen, den du noch nicht gelernt hast.
function zugFuerHeute() {
  const frei = SZ.ZUG_IDS.filter((id) => SZ.offen(zugSpeicher, id)), neu = frei.filter((id) => !SZ.stufe(zugSpeicher, id));
  const aus = neu.length ? neu.slice(0, 2) : frei;
  return aus[Math.floor(Math.random() * aus.length)] || SZ.ZUG_IDS[0];
}
// Eine Aufgabe oder etwas Freiwilliges an einem Ort starten (v = Kennung aus AUFGABEN in aufgaben.js). Jedes ist ein Mini-Spiel.
actions.aufgabe = (v) => {
  const A = TA.AUFGABEN[v];
  if (!anlageTag || !A) return;
  const c = lebenC(), def = anlageTag.def, phase = phaseJetzt(), tag = anlageTag;
  if (!TA.kann(c, v, def, phase).ok) return;
  // Wenn das Spiel vorbei ist: Belohnung ausrechnen und als Ergebnis am Ort zeigen
  const abrechnen = (note, davor = '') => {
    const r = TA.fertig(c, v, def, phase, note);
    return r ? { ort: A.ort, text: `<b>${A.bild} ${esc(A.name)}:</b> ${davor}${r.text}`, bringt: r.bringt.concat(r.stern ? ['⭐ Team-Stern! ' + TA.STERN[phase].text] : []) } : null;
  };
  if (A.spiel === 'platz') {
    // Auf dem echten Platz in 3D: Zielübung, Aufschlag-Ziele oder ein Spielzug. Danach geht es zurück auf die Anlage.
    const trainer = { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' };
    const zug = A.modus === 'lernen' ? zugFuerHeute() : null;
    anlageSchluss();
    startMatch({
      me: ichJetzt(), opp: trainer, def, title: zug ? 'Spielzug: ' + SZ.ZUEGE[zug].name : A.name,
      ...(zug ? { lernen: zug } : { mode: A.modus, balls: A.baelle }),
      onEnd: (res) => {
        let ergebnis = null;
        // Wer abbricht, hat die Aufgabe noch nicht gemacht
        if (!res.aborted && res.training) {
          const tr = res.training;
          ergebnis = zug ? abrechnen(Math.min(1, tr.score / 4), `${tr.score}-mal geschafft. `) : abrechnen(tr.score / (A.baelle * TT.PUNKTE_PRO_BALL), `${tr.score} von ${A.baelle * TT.PUNKTE_PRO_BALL} Punkten. `);
        }
        anlageTag = tag;
        anlageStart(ichJetzt(), A.ort, ergebnis);
      },
    });
    return;
  }
  // Alle anderen Spiele laufen in einem Fenster über dem Gelände (minispiele.js)
  const hemd = ichJetzt().look && ichJetzt().look.shirt;
  MS.starte(A.spiel, {
    titel: `${A.bild} ${A.name}`, wer: TA.werSagt(c, A.von), auftrag: TA.auftragText(v, phase), phase,
    farbe: typeof hemd === 'number' ? '#' + hemd.toString(16).padStart(6, '0') : undefined,
    anzahl: A.anzahl, gesehen: quizGesehen, themen: A.themen && A.themen[phase],
    look: ichJetzt().look,
  }, (r) => {
    if (!r.abbruch) {
      if (r.ids) quizMerken(r.ids);
      anlageErgebnis = abrechnen(r.note);
    }
    if (anlageTag) anlageZeigen();
  });
};
// ---------------------------------------------------------------
// Mini-Spiele und Quiz frei spielen (Hauptmenü): alle Aufgaben vom Turniergelände, ohne Turnier und ohne Belohnung
// ---------------------------------------------------------------
const MINI_KEY = 'powershot.minifrei.v1';          // deine beste Note je Spiel (0…1)
let miniBeste = {};
try { miniBeste = JSON.parse(localStorage.getItem(MINI_KEY)) || {}; } catch (e) { miniBeste = {}; }
let miniLetztes = null;                             // was nach dem letzten Spiel oben im Kasten steht
const miniIch = () => (career ? CA.mePlayer(career) : D.PLAYERS[0]);
const miniSterne = (note) => (note == null ? '<span class="dim">noch nicht gespielt</span>' : `<span class="gold">${'★'.repeat(note >= 0.75 ? 3 : note >= 0.4 ? 2 : 1)}${leereSterne(note >= 0.75 ? 0 : note >= 0.4 ? 1 : 2)}</span> <span class="dim">beste Note ${Math.round(note * 100)} %</span>`);
function miniFertig(id, note, davor = '') {
  const A = TA.AUFGABEN[id], neu = miniBeste[id] == null || note > miniBeste[id];
  if (neu) { miniBeste[id] = note; try { localStorage.setItem(MINI_KEY, JSON.stringify(miniBeste)); } catch (e) { /* dann eben ohne Merken */ } }
  miniLetztes = `<b>${A.bild} ${esc(A.name)}:</b> ${davor}${Math.round(note * 100)} % – ${esc(TA.stufeFuer(id, note)[2])}${neu ? ' <span class="gold">Neue Bestnote!</span>' : ''}`;
}
actions.miniMenu = () => {
  enterMenu();
  const karte = (id) => { const A = TA.AUFGABEN[id]; return `<button class="lernkarte" data-a="miniSpiel" data-v="${id}"><b>${A.bild} ${esc(A.name)}</b><span>${A.spiel === 'platz' ? '🏟️ auf dem Platz' : ''}</span><small>${miniSterne(miniBeste[id])}</small></button>`; };
  const ids = TA.AUFGABEN_IDS.filter((id) => TA.AUFGABEN[id].spiel !== 'quiz');
  const quizId = TA.AUFGABEN_IDS.find((id) => TA.AUFGABEN[id].spiel === 'quiz');
  show(`
    <div class="bar">${back('home')}<h2>Mini-Spiele und Quiz</h2></div>
    ${miniLetztes ? `<div class="panel merke" style="margin-top:0">${miniLetztes}</div>` : ''}
    <div class="panel"><p style="margin:0">Hier kannst du alle Aufgaben vom Turniergelände <b>jederzeit üben</b> – ohne Turnier. Es gibt dafür keine Pluspunkte, aber das Spiel merkt sich deine beste Note.
      Gespielt wird mit ${career ? 'deiner Karriere-Figur' : 'einer Beispiel-Figur'}.</p></div>
    <h3>Mini-Spiele</h3>
    <div class="grid lern">${ids.map(karte).join('')}</div>
    <h3>Tennis-Quiz mit der Trainerin</h3>
    <div class="panel"><p style="margin-top:0" class="dim">10 Fragen – such dir ein Thema aus. ${quizId ? miniSterne(miniBeste[quizId]) : ''}</p>
      <div class="row"><button class="primary" data-a="miniQuiz" data-v="alles">🎲 Alle Themen gemischt</button>
        ${Object.keys(LE.THEMEN).map((t) => `<button data-a="miniQuiz" data-v="${t}">${LE.THEMEN[t]}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button data-a="wissen">📖 Erst lernen: Tennis-Wissen ›</button></div></div>`);
};
actions.miniSpiel = (id) => {
  const A = TA.AUFGABEN[id];
  if (!A) return;
  const ich = miniIch(), phase = A.phase === 'nach' ? 'nach' : 'vor';
  if (A.spiel === 'platz') {
    // Die drei Aufgaben auf dem echten Platz: Zielübung, Aufschlag-Ziele, Spielzug
    const trainer = { ...D.PLAYERS[59], name: 'Trainer', short: 'Trainer' }, zug = A.modus === 'lernen' ? zugFuerHeute() : null;
    startMatch({
      me: ich, opp: trainer, def: D.tournamentById(menuVenue), title: zug ? 'Spielzug: ' + SZ.ZUEGE[zug].name : A.name,
      ...(zug ? { lernen: zug } : { mode: A.modus, balls: A.baelle }),
      onEnd: (res) => {
        if (!res.aborted && res.training) {
          const tr = res.training;
          if (zug) miniFertig(id, Math.min(1, tr.score / 4), `${tr.score}-mal geschafft. `);
          else miniFertig(id, Math.min(1, tr.score / (A.baelle * TT.PUNKTE_PRO_BALL)), `${tr.score} von ${A.baelle * TT.PUNKTE_PRO_BALL} Punkten. `);
        }
        actions.miniMenu();
      },
    });
    return;
  }
  const hemd = ich.look && ich.look.shirt;
  MS.starte(A.spiel, {
    titel: `${A.bild} ${A.name}`, wer: 'Dein Team', auftrag: TA.auftragText(id, phase), phase,
    farbe: typeof hemd === 'number' ? '#' + hemd.toString(16).padStart(6, '0') : undefined, anzahl: A.anzahl, look: ich.look,
  }, (r) => { if (!r.abbruch) miniFertig(id, r.note); actions.miniMenu(); });
};
actions.miniQuiz = (thema) => {
  const id = TA.AUFGABEN_IDS.find((k) => TA.AUFGABEN[k].spiel === 'quiz'), A = TA.AUFGABEN[id];
  if (!A) return;
  const ich = miniIch();
  MS.starte('quiz', { titel: `${A.bild} Tennis-Quiz${LE.THEMEN[thema] ? ': ' + LE.THEMEN[thema] : ''}`, phase: 'vor', anzahl: 10, gesehen: quizGesehen, themen: LE.THEMEN[thema] ? [thema] : null, look: ich.look },
    (r) => { if (!r.abbruch) { if (r.ids) quizMerken(r.ids); miniFertig(id, r.note); } actions.miniMenu(); });
};
actions.anlageMatch = () => { anlageSchluss(); actions.tourPlay(); };
// Nach den Aufgaben nach dem Match: Am Fahrdienst geht es weiter mit dem Weg ins Hotel (Fahrt oder zu Fuß, siehe unten)
actions.nachHotel = () => { if (!anlageTag || !lebenC().abendOffen) return; anlageTag = { def: anlageTag.def, abend: true }; anlageZeigen(); };

// ---------------------------------------------------------------
// Ins Hotel: mit dem Fahrdienst (große Turniere) oder zu Fuß durch das Städtchen (kleine Turniere)
// ---------------------------------------------------------------
// Die Fahrt selbst steht in anlage.js (hotelFahrt), das Hotel und die Strecke rechnet hotelfahrt.js aus,
// das Städtchen für den Fußweg baut hotelweg.js. Hier sind nur die Knöpfe und Texte.
let hotelWeg = null;         // läuft gerade der Weg ins Hotel? { art: 'fahrt' | 'fuss' | 'heim', phase, def, stadt, … }
const HOTELWEG_KEY = 'powershot.hotelweg.v1';      // deine besten Zeiten zu Fuß, je Städtchen
let hotelZeiten = {};
try { hotelZeiten = JSON.parse(localStorage.getItem(HOTELWEG_KEY)) || {}; } catch (e) { hotelZeiten = {}; }
const uhrText = (sek) => `${Math.floor(sek / 60)}:${String(Math.floor(sek % 60)).padStart(2, '0')}`;
function hotelSchluss() { if (hotelWeg && hotelWeg.uhr) clearInterval(hotelWeg.uhr); hotelWeg = null; }
// Der Knopf in der Turnier-Ansicht (Abend nach einem Sieg): erst ins Hotel fahren oder laufen
function hotelKnopf(def) {
  const art = hotelArt(GL.gelaendeFuer(def));
  if (art === 'hier') return '<p class="dim klein">🏨 Dein Zimmer ist gleich hier im Hotel auf der Anlage.</p>';
  if (art === 'heim') return '';
  return `<p class="dim klein" style="margin-top:10px">Oder zuerst:</p><button class="primary" data-a="hotelAbend">${art === 'fahrt' ? '🚗 Mit dem Fahrdienst ins Hotel fahren' : '🚶 Zu Fuß zum Hotel <small>Hier gibt es keinen Fahrdienst – du musst den Weg selbst finden!</small>'}</button>`;
}
// Der Text am Wagen vom Fahrdienst (beim freien Herumlaufen und am Abend nach dem Match)
function hotelAmWagen(G) {
  const art = hotelArt(G), H = hotelFuer(G);
  if (art === 'fahrt') return `<h3>Fahrdienst</h3><p>Der Fahrer wartet schon. Er bringt dich ins <b>${esc(H ? H.name : 'Hotel')}</b>${game.anlage.plan.hotel ? ' – schau zu, wie der Wagen über die Straße dorthin fährt.' : '.'}</p>
    <button class="primary" data-a="hotelLos">🚗 Einsteigen und ins Hotel fahren</button>`;
  if (art === 'hier') return '<h3>Fahrdienst</h3><p>Den brauchst du hier nicht: Dein Zimmer ist gleich im Hotel auf der Anlage. Bei solchen Turnieren wohnen, essen und spielen alle am selben Ort.</p>';
  return `<h3>${art === 'heim' ? 'Vereinsbus' : 'Fahrdienst'}</h3><p>${art === 'heim' ? 'Der Bus fährt nur zu Auswärtsspielen. Nach Hause läufst du – das ist nicht weit.' : 'Der Fahrer hat schon Feierabend. Bei kleinen Turnieren gibt es abends keinen Fahrdienst: Zum Hotel läufst du selbst.'} <b>Findest du den Weg durch das Städtchen?</b></p>
    <button class="primary" data-a="hotelLos">🚶 ${art === 'heim' ? 'Nach Hause laufen' : 'Zu Fuß zum Hotel'}</button>`;
}
// Das Fenster während der Fahrt, im Städtchen und im Hotel
function hotelZeigen() {
  const A = game.anlage, ort = A.amOrt, G = A.plan ? A.plan.g : null, W = hotelWeg, abend = !!(anlageTag && anlageTag.abend);
  const kam = [['karte', '🗺️', 'Weiter weg / näher'], ['schilder', '🏷️', 'Beschriftungen an oder aus (Taste B)'], ...KAM_KNOEPFE, ...stimmungKnoepfe()];
  const abendWahl = () => `<p class="dim">Was machst du heute Abend noch?</p><div class="row wahl">${Object.entries(TT.ABEND).map(([id, B]) => `<button data-a="hotelAbendWahl" data-v="${id}">${B.name} <small>${B.bringt}</small></button>`).join('')}</div>`;
  let zeit = '', unten = '';
  if (!W) {
    // Am Abend nach dem Match, noch auf der Anlage: Der Weg führt zum Fahrdienst
    zeit = `<span class="zeit">${esc(anlageTag.def.name)} · 🌙 Abend nach deinem Sieg</span>`;
    unten = ort && ort.id === 'hotel' ? hotelAmWagen(G) : `<p>Geschafft für heute! ${ort ? `<b>${esc(ort.name)}</b> hat schon zu. ` : ''}Geh zum Fahrdienst – dort geht es ins Hotel.</p><button data-a="anlageGeh" data-v="hotel">Zum Fahrdienst laufen</button>`;
  } else if (W.art === 'fahrt') {
    const H = W.hotel;
    zeit = `<span class="zeit">🚗 Fahrt ins Hotel · <span class="dim">${esc(H.name)}</span></span>`;
    if (W.phase === 'da') {
      unten = `<h3>🏨 ${esc(H.name)}</h3><p>${esc(H.text)} <span class="dim">(Der Name ist ausgedacht.)</span></p>${abend ? abendWahl() : '<button class="primary" data-a="hotelZurueck">🚗 Zurück zum Turniergelände</button>'}`;
    } else {
      unten = `<p>${A.fahrt && A.fahrt.phase === 'fahren' ? 'Lehn dich zurück: Der Fahrer bringt dich ins Hotel. An Einmündungen wartet er, bis die Straße frei ist.' : 'Du steigst ein …'}</p><button data-a="hotelSpringen">⏭ Fahrt überspringen</button>`;
    }
  } else {
    // Zu Fuß durch das Städtchen
    const S = W.stadt, rekord = hotelZeiten[S.name];
    zeit = `<span class="zeit">🚶 ${esc(S.name)} · ⏱ <span id="hoteluhr">${uhrText(A.zeit || 0)}</span>${rekord ? ` <span class="dim">· Bestzeit ${uhrText(rekord)}</span>` : ''}</span>`;
    if (W.phase === 'da') {
      const E = W.ergebnis;
      unten = `<h3>🏨 ${esc(S.ziel.name)} gefunden!</h3><p>${'⭐'.repeat(E.sterne)}${'☆'.repeat(3 - E.sterne)} Du hast <b>${uhrText(E.zeit)}</b> gebraucht${E.neu ? ' – <b class="gold">neue Bestzeit!</b>' : rekord ? ` (Bestzeit ${uhrText(rekord)})` : ''}.
        <span class="dim">Der kürzeste Weg war ${Math.round(E.weg)} Meter lang.</span></p>${E.bringt.length ? `<p class="gold">${E.bringt.join(' · ')}</p>` : ''}
        ${abend ? abendWahl() : `<div class="row"><button class="primary" data-a="hotelNochmal">🔁 Noch einmal laufen</button><button data-a="hotelZurueck">Zurück zum Tennisclub</button></div>`}`;
    } else if (W.hinweis) {
      unten = `<p><b>${esc(W.hinweis)}</b></p>`;
    } else if (ort && anlageErgebnis && anlageErgebnis.ort === ort.id) {
      unten = `<h3>${esc(ort.name)}</h3><p>${anlageErgebnis.text}</p><p class="gold">${anlageErgebnis.bringt.join(' · ')}</p>`;
    } else if (ort && ort.info) {
      unten = `<h3>${esc(ort.name)}</h3><p>${ort.text}</p>`;
    } else {
      unten = `<p>${S.heim ? 'Lauf nach Hause!' : `Dein Hotel heißt <b>${esc(S.ziel.name)}</b>.`} Die gelben <b>Wegweiser</b> zeigen in die Richtung, in der es liegt – aber manche Gassen sind gesperrt, dann musst du außen herum.
        <span class="dim">Laufen: mit einem Finger ziehen oder W A S D. Wer schnell ist, bekommt drei Sterne${abend ? ' und geht früher ins Bett (+' + TT.HOTELWEG_FRISCHE + ' Frische)' : ''}.</span></p>`;
    }
  }
  anlageEl.innerHTML = `<div class="oben"><button class="ghost" data-a="anlageEnde">‹ Zurück</button>${zeit}</div>
    <div class="kam">${kam.map(([k, z, t]) => `<button data-kam="${k}"${k === 'schilder' && !A.schilderAn ? ' class="aus"' : ''} title="${t}" aria-label="${t}">${z}</button>`).join('')}</div>
    <div class="panel">${unten}</div>`;
  anlageEl.classList.add('on');
}
// Am Abend nach einem Sieg (Karriere und Saison): auf die Anlage, direkt neben den Fahrdienst
actions.hotelAbend = () => {
  if (!mitLeben() || !lebenC().abendOffen) return;
  hotelWeg = null;
  anlageTag = { def: ctxT.def, abend: true };
  anlageStart(ichJetzt(), 'hotel');
};
// Einsteigen – oder loslaufen
actions.hotelLos = () => {
  const A = game.anlage, G = A.plan && A.plan.g, art = hotelArt(G);
  if (!G || hotelWeg || art === 'hier') return;
  const def = anlageTag ? anlageTag.def : D.tournamentById(anlageWo), ich = anlageTag ? ichJetzt() : (career ? CA.mePlayer(career) : D.PLAYERS[0]);
  if (art === 'fahrt') {
    hotelWeg = { art, def, hotel: hotelFuer(G), phase: 'fahrt' };
    A.wennHotel = () => { if (hotelWeg) { hotelWeg.phase = 'da'; sound.coin(); anlageZeigen(); } };
    // Gibt es hier keine Straße zum Hotel, kommt man ohne sichtbare Fahrt an
    if (!A.hotelFahrt()) hotelWeg.phase = 'da';
    else hotelWeg.uhr = setInterval(() => { if (hotelWeg && hotelWeg.phase === 'fahrt' && A.fahrt && A.fahrt.phase !== hotelWeg.gezeigt) { hotelWeg.gezeigt = A.fahrt.phase; anlageZeigen(); } }, 300);
    anlageZeigen();
    return;
  }
  // Zu Fuß: Das Städtchen wird als eigenes Gelände gebaut, du startest am Tor des Tennisclubs
  const stadt = stadtGelaende(def, G);
  hotelWeg = { art, def, stadt, phase: 'weg', ich };
  anlageStart(ich, 'start');
  const ziel = A.orte.find((o) => o.id === 'ziel');
  hotelWeg.weg = ziel ? A.wegLaenge(ziel.tx, ziel.tz) : 100;
  A.wennZuWeit = () => {
    if (!hotelWeg) return;
    hotelWeg.hinweis = 'So weit läuft deine Figur hier nicht von allein – den Weg musst du selbst finden! (Finger ziehen oder W A S D)';
    anlageZeigen();
    setTimeout(() => { if (hotelWeg && hotelWeg.hinweis) { hotelWeg.hinweis = null; anlageZeigen(); } }, 3500);
  };
  A.wennAngekommen = (zeit) => {
    if (!hotelWeg || hotelWeg.phase === 'da') return;
    const W = hotelWeg, sterne = sterneFuer(W.weg, zeit), alt = hotelZeiten[W.stadt.name], neu = !alt || zeit < alt;
    if (neu) { hotelZeiten[W.stadt.name] = Math.round(zeit * 10) / 10; try { localStorage.setItem(HOTELWEG_KEY, JSON.stringify(hotelZeiten)); } catch (e) { /* ohne Speicher gibt es eben keine Bestzeit */ } }
    W.ergebnis = { zeit, sterne, weg: W.weg, neu: neu && !!alt, bringt: anlageTag && anlageTag.abend ? TT.hotelweg(lebenC(), sterne) : [] };
    W.phase = 'da';
    sound.coin();
    anlageZeigen();
  };
  // Die Stoppuhr oben einmal pro Sekunde neu schreiben
  hotelWeg.uhr = setInterval(() => { const u = document.getElementById('hoteluhr'); if (u && hotelWeg && hotelWeg.phase === 'weg') u.textContent = uhrText(game.anlage.zeit || 0); }, 500);
  anlageZeigen();
};
actions.hotelSpringen = () => { game.anlage.fahrtSpringen(); };
// Zurück aufs Turniergelände (nur beim freien Herumlaufen)
actions.hotelZurueck = () => {
  if (!hotelWeg || (anlageTag && anlageTag.abend)) return;
  const W = hotelWeg;
  hotelSchluss();
  if (W.art === 'fahrt') { game.anlage.fahrtZurueck(); anlageZeigen(); }
  else anlageStart(W.ich, 'hotel');
};
actions.hotelNochmal = () => {
  if (!hotelWeg || !hotelWeg.stadt) return;
  const W = hotelWeg;
  hotelSchluss();
  anlageStart(W.ich, 'hotel');
  actions.hotelLos();
};
// Im Hotel angekommen: Was machst du am Abend? (dieselbe Auswahl wie in der Turnier-Ansicht)
actions.hotelAbendWahl = (v) => { anlageSchluss(); actions.abend(v); };
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
      `<button data-a="ehrungRede" data-v="${k}">${r.knopf}${mitLeben() ? `<small>${r.bringt}</small>` : ''}</button>`).join('')}</div>`;
  } else if (schritt === 'rede') {
    const r = CA.REDEN[e.rede];
    html = `<p>„${r.satz}“</p><p class="dim">Die Zuschauer klatschen.${mitLeben() ? ' ' + r.bringt : ''}</p>${weiter('Zum Siegerfoto ›')}`;
  } else if (schritt === 'foto' && !e.fertig) html = `<p>Die Fotografen warten. Bitte lächeln!</p><button class="primary" data-a="ehrungFoto">📸 Foto machen</button>`;
  else {
    html = `${e.foto ? `<img class="siegerfoto" src="${e.foto}" alt="Siegerfoto">` : ''}<p>${ctxT.career ? 'Das Foto steht jetzt in deinem Pokalschrank (Karriere-Menü).' : ctxT.season ? 'Das Foto steht jetzt in deinem Pokalschrank (Saison-Menü → Team & Sponsoren).' : 'Ein schönes Foto!'}</p>
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
  if (mitLeben()) CA.siegerRede(lebenC(), v);
  game.ehrung.jubeln(0.8);
  ehrungZeigen();
};
actions.ehrungFoto = () => {
  sound.kamera();
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
  if (ctxT.season) PS.pokalMerken(season, e.def, e.art, e.foto);
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
  if (s.netto > 0) sound.kasse();
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
    <div class="panel neufigur"><canvas id="neufigur" width="320" height="400"></canvas>
      <p class="dim">So sieht dein Spieler aus. Probier unten Farben und Figuren aus – das Bild ändert sich sofort.</p></div>
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
  // Die Vorschau: deine Figur in 3D, sie dreht sich langsam
  const bild = $('#neufigur');
  if (bild) game.figurZeigen(bild, { skin: draft.skin, hair: draft.hair, shirt: draft.shirt, shorts: draft.shorts, head: draft.head, model: draft.model, pattern: draft.pattern, trim: draft.trim, shoes: 0xffffff, racket: 0x202020 }, draft.hand);
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
actions.planKauf = (v) => { if (CA.buy(career, v)) sound.kasse(); keepScroll(renderCareer); };
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
    // „Dein nächster Schritt“: genau EIN Vorschlag, damit man am Anfang nicht vor acht Reitern steht und nicht weiß, wohin
    const schritt = c.verletzung ? null
      : c.skillPoints ? ['Verteile deine ' + c.skillPoints + ' Fähigkeitspunkte', 'Damit wird dein Spieler stärker. Für den Anfang lohnen sich Vorhand, Rückhand und Beinarbeit.', 'skills', 'Zu den Fähigkeiten ›']
        : !CA.traegt(c, 'Schläger') && c.money >= 150 ? ['Sieh dich im Shop um', 'Du spielst noch mit dem alten Vereinsschläger. Ein besserer Schläger hilft bei jedem Schlag.', 'shop', 'Zur Ausrüstung ›']
          : ['Such dir ein Turnier für diese Woche aus', 'Unten steht, wo du diese Woche spielen darfst. Für den Anfang: ein ITF-Turnier oder ein Liga-Spiel. Punkte bringen dich in der Weltrangliste nach oben.', '', ''];
    const anfang = rk > 600 && !c.titles;
    const schrittHtml = schritt ? `<div class="panel schritt"><b>👉 Dein nächster Schritt: ${schritt[0]}</b><br><span class="dim">${schritt[1]}</span>
      ${schritt[2] ? ` <button class="primary" data-a="career" data-v="${schritt[2]}">${schritt[3]}</button>` : ''}
      ${anfang ? '<br><small class="dim">Die Reiter „Saison-Planer“, „Team & Sponsoren“ und „Profi-Service“ werden erst später wichtig. Du kannst sie am Anfang einfach liegen lassen.</small>' : ''}</div>` : '';
    body = `${schrittHtml}
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
      <p class="klein">Was die Pluspunkte bedeuten: <b>Kraft</b> = deine Schläge werden härter · <b>Präzision</b> = sie landen genauer dort, wohin du zielst · <b>Tempo</b> = du läufst schneller.</p>
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
actions.ausbau = (v) => { if (CA.ausbauKaufen(career, v)) sound.kasse(); keepScroll(renderCareer); };
actions.technik = (v) => { if (CA.technikLernen(career, v)) sound.kasse(); keepScroll(renderCareer); };
actions.skill = (v) => { CA.raiseSkill(career, v); keepScroll(renderCareer); };
actions.buy = (v) => { if (CA.buy(career, v)) sound.kasse(); keepScroll(renderCareer); };
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
// Dazu kommt das „Profileben“ aus profisaison.js: Punkte verteidigen, Erwartungen, Sponsoren-Ziele, Rivalen,
// Zeitung, Team, Körper und die Wochen zwischen den Turnieren.
const pickS = { me: 'zverev', page: 0 };
let saisonTab = 'start';
let zwTraining = false;      // ist die Auswahl „Woran trainierst du?“ gerade aufgeklappt?
let zwMeldung = null;        // was die letzte Auswahl zwischen den Turnieren gebracht hat: { name, bringt }
let sPlanWoche = null;       // diese Woche ist im Saison-Planer gerade aufgeklappt
const SAISON_TABS = ['start', 'planer', 'zeitung', 'team', 'profi', 'race', 'welt', 'punkte'];

actions.saison = (v) => {
  if (!season) return renderSeasonPick();
  // Läuft gerade ein Turnier? Dann geht es dort weiter. (Über „‹ Zurück“ im Turnier kommt man mit v = 'start' zur Übersicht.)
  if (season.tournament && !v) return showSeasonTournament();
  if (SAISON_TABS.includes(v)) saisonTab = v;
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
    <p class="dim">Such dir einen Profi aus. Mit ihm spielst du die 4 Grand Slams und 9 Masters-Turniere – und in den freien Wochen dazwischen kleine Turniere, wenn du magst.
    Für jedes Ergebnis gibt es Punkte im ATP Race. Schaffst du es unter die besten 8, darfst du zu den ATP Finals!</p>
    <p class="dim">Dein Profi hat schon alles: Trainer, Physio, Sponsoren und Fans. Dafür <b>erwarten</b> alle etwas von ihm:
    Er muss die Punkte vom letzten Jahr verteidigen, die Ziele der Sponsoren schaffen und sich gegen seine Rivalen behaupten.
    Je weiter vorn dein Profi steht, desto größer ist der Druck – mit einem Spieler von weiter hinten kannst du dafür alle überraschen.
    Im <b>Saison-Planer</b> teilst du dir das Jahr ein: Wer zu viel spielt, wird müde und verletzt sich.</p>
    <div class="panel"><h3 style="margin-top:0">Dein Profi: ${esc(getPlayer(pickS.me).name)}</h3>${pageTabs('saisonSeite', pickS.page)}
      <div class="grid">${pagePlayers(pickS.page).map((p) => playerCard(p, 'saisonWahl', pickS.me === p.id)).join('')}</div></div>
    <button class="primary" data-a="saisonNeu">Saison starten ›</button>`);
}
actions.saisonSeite = (v) => { pickS.page = +v; keepScroll(renderSeasonPick); };
actions.saisonWahl = (v) => { pickS.me = v; keepScroll(renderSeasonPick); };
actions.saisonNeu = () => {
  season = PS.einrichten(SE.newSeason(pickS.me));
  SE.saveSeason(season);
  saisonTab = 'start'; zwMeldung = null; zwTraining = false;
  renderSeason();
};

// Ein Balken von 0 bis 100 % (farbe: grün, gelb oder rot)
const balken = (anteil, farbe) => `<i class="frische"><b style="width:${Math.round(100 * Math.max(0, Math.min(1, anteil)))}%;background:${farbe}"></b></i>`;
const MUT_NAMEN = ['am Boden', 'verunsichert', 'etwas wacklig', 'normal', 'gut drauf', 'sehr stark', 'unschlagbar'];
const mutText = (P) => MUT_NAMEN[P.mut + PS.MUT_MAX];
const druckText = (P) => (P.druck >= PS.DRUCK_SEHR_HOCH ? 'riesig' : P.druck >= PS.DRUCK_HOCH ? 'hoch' : P.druck >= 35 ? 'normal' : 'gering');
const ampel = (gut) => (gut > 0.66 ? '#7ae89a' : gut > 0.33 ? '#ffd166' : '#ff8a7a');
const formListe = (liste) => (liste.length ? `<table class="form">${liste.map((e) => `<tr><td>${esc(e.name)}</td><td class="num ${Object.values(e.bonus).some((n) => n < 0) ? 'minus' : 'plus'}">${bonusText(e.bonus)}</td></tr>`).join('')}</table>`
  : '<p class="dim klein">Gerade wirkt nichts Besonderes. Dein Profi spielt mit seinen normalen Werten.</p>');

// Der Kasten über dem Match in der Turnier-Ansicht: Rivalen-Duell, Bilanz, Erwartung, Form
function saisonVorMatch(oppId) {
  const s = season, P = s.profi, def = ctxT.def, opp = D.playerById(oppId), b = P.h2h[oppId] || [0, 0];
  const rivale = P.rivalen.includes(oppId), E = P.vorher ? P.vorher.erwartet : null;
  return `<div class="panel ${rivale ? 'duell' : ''}">
    ${rivale ? `<h3 style="margin-top:0">⚔️ Rivalen-Duell gegen ${esc(opp.name)}!</h3><p class="dim">Die ganze Tenniswelt schaut zu. Ein Sieg gibt Selbstvertrauen – eine Niederlage steht morgen groß in der Zeitung.</p>` : ''}
    <div class="kpi">
      <div><b>${b[0]} : ${b[1]}</b><span>deine Bilanz gegen ${esc(opp.short)}${b[0] - b[1] >= 1 ? ' · Lieblingsgegner' : b[1] - b[0] >= 1 ? ' · Angstgegner' : ''}</span></div>
      <div><b>${Math.round(P.frische)} %</b><span>Frische</span>${balken(P.frische / 100, ampel(P.frische / 100))}</div>
      <div><b>${mutText(P)}</b><span>Selbstvertrauen</span></div>
      <div><b>${E ? D.ROUND_NAMES[E] || E : '–'}</b><span>erwartet wird mindestens</span></div>
    </div>
    <details><summary>Was heute im Match wirkt</summary>${formListe(PS.bonusListe(s, def, oppId))}</details></div>`;
}

// Der Saison-Planer: das ganze Jahr auf einen Blick, mit Vorschau auf die Frische (Belastungssteuerung)
function saisonPlanerHtml(s) {
  const P = s.profi, V = PS.vorschau(s), platz = PS.weltPlatz(s), me = SE.seasonPlayer(s);
  const zeile = Object.fromEntries(V.wochen.map((z) => [z.nr, z]));
  const gross = Object.fromEntries(s.history.map((h) => [h.tid, h])), klein = Object.fromEntries((P.kleine || []).map((h) => [h.kw, h]));
  const zeichen = { schlecht: '🔴', achtung: '🟡', info: 'ℹ️', gut: '🟢' };
  const wahlText = (wahl) => { const [id, k] = String(wahl).split(':'), A = PS.ZWISCHEN[id]; return A ? `${A.bild} ${A.kurz}${k ? ' (' + D.STAT_NAMES[k] + ')' : ''}` : ''; };
  const streifen = `<div class="jahr">${KA.WOCHEN.map((w) => { const Ph = KA.phaseVon(w.nr), z = zeile[w.nr];
    const punkt = !z || z.art === 'zweite' ? '' : z.art === 'gross' ? (z.wahl === 'aus' && !z.vorbei ? '✕' : gross[z.def.id] && !gross[z.def.id].label ? '' : '●') : klein[w.nr] || (z.def && !z.vorbei) ? '•' : z.wahl === 'pause' && !z.vorbei ? '☾' : '';
    return `<i class="${w.nr === P.kw ? 'heute' : w.nr < P.kw ? 'war' : ''}" style="background:${Ph.farbe}" title="KW ${KA.kw(w.nr)}: ${Ph.name}" data-a="sPlanAuf" data-v="${w.nr}">${punkt}</i>`; }).join('')}</div>`;
  const kopf = `<div class="panel"><h3 style="margin-top:0">🗓️ Dein Tennisjahr ${s.year}</h3>${streifen}
      <p class="dim klein">● = großes Turnier · • = kleines Turnier · ☾ = Urlaub · ✕ = du lässt es aus · weißer Rahmen = diese Woche. Tippe auf ein Kästchen, um zu der Woche zu springen.</p>
      <div class="kpi vier"><div><b>${V.turniere}</b><span>Turniere (gespielt und geplant)</span></div>
        <div><b class="${V.belastung === 'hoch' ? 'minus' : V.belastung === 'mittel' ? 'gold' : 'plus'}">${V.belastung}</b><span>Belastung für den Körper</span></div>
        <div><b class="${V.regel && V.n500 < PS.REGEL_500.zahl ? 'minus' : ''}">${V.n500}${V.regel ? ' von ' + PS.REGEL_500.zahl : ''}</b><span>ATP-500-Turniere${V.regel ? ' (Pflicht für die Top ' + PS.REGEL_500.bisPlatz + ')' : ''}</span></div>
        <div><b class="${V.gefehlt ? 'minus' : 'plus'}">${V.gefehlt}</b><span>Pflichtturniere ausgelassen${V.strafen ? ' · Strafen ' + money(V.strafen) : ''}</span></div></div></div>
    <div class="cols breit"><div class="panel"><h3 style="margin-top:0">🧑‍🏫 Der Trainer schaut auf deinen Plan</h3>
      ${V.hinweise.map((h) => `<p class="klein">${zeichen[h.art]} ${esc(h.text)}</p>`).join('') || '<p class="dim klein">Noch nichts geplant: In jeder freien Woche steht erst einmal Urlaub.</p>'}
      <p><b>Vorschlag vom Trainer</b> <span class="dim klein">– plant alle Wochen neu, die noch kommen</span></p>
      <div class="row">${Object.entries(PS.AUTO).map(([id, A]) => `<button data-a="sPlanAuto" data-v="${id}" title="${A.text}">${A.bild} ${A.name}</button>`).join('')}
        <button class="ghost" data-a="sPlanLeeren">Plan leeren</button></div>
      <p class="dim klein">${Object.values(PS.AUTO).map((A) => `${A.bild} ${A.name}: ${A.text}`).join(' ')}</p></div>
    <div class="panel"><h3 style="margin-top:0">📜 Was ist Pflicht?</h3>
      <p class="klein"><b>Pflicht</b> sind die 4 Grand Slams und 8 Masters. <b>Monte-Carlo</b> ist das einzige Masters, das man ohne Folgen auslassen darf. Die kleinen Turniere sind freiwillig.</p>
      <p class="klein"><b>Wenn du ein Pflichtturnier auslässt:</b> Die Punkte vom letzten Jahr sind immer weg. Beim <b>1. Mal</b> im Jahr gibt es nur eine Verwarnung, und die Sponsoren murren.
        Ab dem <b>2. Mal</b> kostet es Geld – jedes Mal mehr –, die Sponsoren zahlen weniger und die Zeitungen machen Druck.</p>
      <p class="klein"><b>Mit Attest:</b> Wer Beschwerden hat oder verletzt ist, ist entschuldigt. Dann gibt es keine Strafe.</p>
      ${V.regel ? `<p class="klein"><b>Regel für die besten ${PS.REGEL_500.bisPlatz}:</b> mindestens ${PS.REGEL_500.zahl} ATP-500-Turniere im Jahr (Monte-Carlo zählt mit). Für jedes fehlende zahlst du am Jahresende ${money(PS.REGEL_500.strafe)}.</p>` : ''}
      <p class="dim klein">Die Regeln gibt es im echten Tennis wirklich. Dort bekommt man statt einer Verwarnung gleich null Punkte und eine Geldstrafe; die Höhe der Strafen im Spiel ist geschätzt.</p></div></div>`;
  let letzter = -1;
  const reihen = V.wochen.map((z) => {
    const mo = KA.monatVon(s.year, z.nr), Ph = KA.phaseVon(z.nr);
    let out = '';
    if (mo !== letzter) { letzter = mo; out += `<tr class="monat"><td colspan="4"><b>${KA.MONATE[mo]}</b></td></tr>`; }
    const kleine = PS.kleineDerWoche(z.nr);
    let was, plan, frische = '';
    if (z.art === 'zweite') { was = `<span class="dim">${esc(z.def.name)} · 2. Woche</span>`; plan = ''; }
    else if (z.art === 'gross') {
      const h = gross[z.def.id], pflicht = CA.istPflicht(z.def);
      was = `<b>${esc(z.def.name)}</b> ${catTag(z.def)} <span class="belag ${z.def.surface}">${BELAG_KURZ[z.def.surface]}</span><br><small class="dim">${z.def.cat === 'F' ? 'nur die besten 8 im Race' : pflicht ? 'Pflichtturnier' : 'keine Pflicht'}</small>`;
      if (h) plan = `<span class="dim">${h.label === 'W' ? '🏆 Sieg' : h.label ? D.ROUND_NAMES[h.label] : 'nicht dabei'} · ${h.points} P.</span>`;
      else if (z.vorbei) plan = '<span class="dim">läuft gerade</span>';
      else if (z.def.cat === 'F') plan = '<span class="dim">wenn du dich qualifizierst</span>';
      else plan = `<button class="${z.wahl === 'aus' ? 'sel' : 'ghost'} planknopf" data-a="sPlanAuf" data-v="${z.nr}">${z.wahl === 'aus' ? '📌 ✕ auslassen' : '✓ spielen'}</button>
        ${z.wahl === 'aus' ? `<br><small class="minus">${z.verloren ? `−${z.verloren} Punkte vom Vorjahr · ` : ''}${z.folgen.strafe ? 'Strafe ' + money(z.folgen.strafe) : z.folgen.pflicht ? 'Verwarnung' : 'keine Strafe'}</small>` : z.verteidigen ? `<br><small class="dim">🛡️ ${z.verteidigen} Punkte verteidigen</small>` : ''}`;
    } else {
      const h = klein[z.nr];
      was = kleine.length ? `<span class="klein">${kleine.map((k) => `${esc(k.city)} <span class="dim">(${k.catName})</span>`).join(' · ')}</span>` : '<span class="dim">kein Turnier</span>';
      if (z.vorbei) plan = `<span class="dim">${h ? `${esc(h.name)} · ${h.label === 'W' ? '🏆 Sieg' : D.ROUND_NAMES[h.label] || ''} · ${h.points} P.` : esc((P.getan || {})[z.nr] || '–')}</span>`;
      else plan = `<button class="${z.wahl ? 'sel' : 'ghost'} planknopf" data-a="sPlanAuf" data-v="${z.nr}">${z.def ? '📌 🎾 ' + esc(z.def.name) : z.wahl ? '📌 ' + wahlText(z.wahl) : '＋ planen'}</button>
        ${z.def && !PS.darfSpielen(s, z.def, platz).ok ? `<br><small class="minus">🔒 ${PS.darfSpielen(s, z.def, platz).warum}</small>` : ''}`;
    }
    if (z.art !== 'zweite' && !z.vorbei) frische = `${z.frischeVor != null ? `<small class="dim">Start ${z.frischeVor} %</small><br>` : ''}<b style="color:${ampel(z.frische / 100)}">${z.frische} %</b>${balken(z.frische / 100, ampel(z.frische / 100))}
      ${z.warn.length ? `<small class="minus">⚠️ ${z.warn.map(esc).join(' · ')}</small>` : ''}`;
    out += `<tr class="${z.nr === P.kw ? 'me' : ''}" id="skw${z.nr}"><td class="kwzelle" style="border-left:6px solid ${Ph.farbe}"><b>KW ${KA.kw(z.nr)}</b><br><small class="dim">${KA.datumKurz(s.year, z.nr)}</small></td>
      <td>${was}</td><td>${plan}</td><td class="frv">${frische}</td></tr>`;
    // Aufgeklappt: alle Möglichkeiten dieser Woche
    if (sPlanWoche === z.nr && !z.vorbei && z.art !== 'zweite' && z.def !== undefined && !(z.art === 'gross' && z.def.cat === 'F')) {
      let knoepfe;
      if (z.art === 'gross') {
        const F = z.folgen || PS.auslassFolgen(s, z.def, V.gefehlt, false);
        knoepfe = `<button class="${z.wahl === 'aus' ? '' : 'sel'}" data-a="sPlanSetzen" data-v="${z.nr}:">✓ Spielen</button>
          <button class="${z.wahl === 'aus' ? 'sel' : ''}" data-a="sPlanSetzen" data-v="${z.nr}:aus">✕ Auslassen <small>${esc(F.text)}</small></button>`;
      } else {
        knoepfe = kleine.map((k) => { const d = PS.darfSpielen(s, k, platz); return `<button class="${z.wahl === k.id ? 'sel' : ''} ${d.ok ? '' : 'zu'}" data-a="sPlanSetzen" data-v="${z.nr}:${k.id}">🎾 ${esc(k.name)} <small>${k.catName} · ${BELAG_KURZ[k.surface]} · Sieger ${k.points.W} P.${d.ok ? '' : ' · 🔒 ' + d.warum}</small></button>`; }).join('')
          + Object.entries(PS.ZWISCHEN).filter(([id]) => id !== 'training').map(([id, A]) => `<button class="${z.wahl === id ? 'sel' : ''}" data-a="sPlanSetzen" data-v="${z.nr}:${id}">${A.bild} ${A.kurz} <small>${A.bringt}</small></button>`).join('')
          + `</div><p class="klein" style="margin:8px 0 4px">🏋️ Trainingsblock (+2 beim nächsten Turnier) für:</p><div class="row">`
          + Object.entries(D.STAT_NAMES).map(([k, n]) => `<button class="${z.wahl === 'training:' + k ? 'sel' : ''}" data-a="sPlanSetzen" data-v="${z.nr}:training:${k}">${n} <small>${Math.round(me.stats[k] + P.plus[k])}</small></button>`).join('')
          + (z.wahl ? `<button class="ghost" data-a="sPlanSetzen" data-v="${z.nr}:">✕ Woche wieder freigeben</button>` : '');
      }
      out += `<tr class="planwahl"><td colspan="4"><b>KW ${KA.kw(z.nr)} · ${Ph.bild} ${esc(Ph.name)}</b> – was hast du vor?<div class="row">${knoepfe}</div></td></tr>`;
    }
    return out;
  }).join('');
  return `${kopf}<div class="panel" style="overflow-x:auto"><table class="planer"><tr><th>Woche</th><th>Turniere der Woche</th><th>Dein Plan</th><th>Frische danach (Vorschau)</th></tr>${reihen}</table>
    <p class="dim klein">Die Vorschau rechnet so: Du kommst bei jedem Turnier so weit, wie man es von deinem Platz erwartet. Wer weiter kommt, spielt mehr Matches und wird müder; wer früh verliert, bleibt frischer.
      Eine Woche ohne Plan zählt als Urlaub. Der Plan verpflichtet dich zu nichts: Jede Woche entscheidest du auf der Saison-Seite neu – dort steht dann „📌 in deinem Plan“.
      Kalender und Turnierorte sind die echten von 2026. Alle Zahlen für Frische, Verletzungsgefahr und Strafen sind geschätzt.</p></div>`;
}

function renderSeason() {
  const s = season, P = s.profi, me = SE.seasonPlayer(s), ich = SE.myRace(s), def = SE.nextTournament(s);
  const table = SE.raceTable(s);
  const achter = table[SE.FINALS_PLAETZE - 1], neunter = table[SE.FINALS_PLAETZE];
  const dabei = SE.qualified(s);
  const platz = PS.weltPlatz(s);
  // Wie weit ist es bis zur Finals-Linie (Platz 8)?
  const abstand = ich.rank <= SE.FINALS_PLAETZE ? `${(ich.points - neunter.points).toLocaleString('de-DE')} P. vor Platz 9` : `${(achter.points - ich.points).toLocaleString('de-DE')} P. bis Platz 8`;
  const tabs = [['start', 'Saison'], ['planer', 'Saison-Planer'], ['zeitung', 'Zeitung & Rivalen'], ['team', 'Team & Sponsoren'], ['profi', 'Fähigkeiten & Körper' + (P.skillPoints >= PS.PLUS_KOSTET ? ' ●' : P.koerper || P.verletzung ? ' 🩹' : '')], ['race', 'ATP Race'], ['welt', 'Weltrangliste'], ['punkte', 'Punkte-Regeln']];
  const ziele = (liste) => `<table class="ziele">${liste.map((z) => { const st = z.ok != null ? z : { ...z, ...PS.zielStand(s, z) };
    return `<tr><td>${st.ok ? '✅' : '⬜'}</td><td><b>${esc(z.text)}</b><br><small class="dim">${esc(st.stand)}</small></td><td class="num gold">${money(z.geld)}</td></tr>`; }).join('')}</table>`;
  let body = '';
  if (saisonTab === 'start') {
    let next, zwischen = '';
    if (s.over) {
      const sieger = s.history[s.history.length - 1], J = PS.jahresBilanz(s);
      next = `<div class="panel center"><h2 class="gold">Saison ${s.year} beendet</h2>
        <p>Du beendest das Jahr auf <b>Platz ${ich.rank}</b> im ATP Race mit <b>${ich.points.toLocaleString('de-DE')} Punkten</b> und ${s.titles} Titel${s.titles === 1 ? '' : 'n'}.
        In der Weltrangliste: <b>Platz ${J.platz}</b> <span class="${J.platz < J.startPlatz ? 'plus' : J.platz > J.startPlatz ? 'minus' : 'dim'}">(Start: Platz ${J.startPlatz})</span>.</p>
        <p class="dim">ATP-Finals-Sieger: ${esc(sieger.champion)} · Du hast ${J.turniere} Turniere gespielt, davon ${J.kleine.length} kleine.</p>
        <h3>Die Ziele deiner Sponsoren: ${'⭐'.repeat(J.geschafft)}${'☆'.repeat(J.ziele.length - J.geschafft)}</h3>${ziele(J.ziele)}
        <table class="rechnung"><tr><td>Preisgeld</td><td class="num plus">+ ${money(J.bilanz.preis)}</td></tr><tr><td>Sponsoren</td><td class="num plus">+ ${money(J.bilanz.sponsor)}</td></tr>
          ${J.bilanz.praemie ? `<tr><td>Prämien für geschaffte Ziele</td><td class="num plus">+ ${money(J.bilanz.praemie)}</td></tr>` : ''}
          <tr><td>Trainer und Physio</td><td class="num minus">− ${money(J.bilanz.team)}</td></tr><tr><td>Reisen</td><td class="num minus">− ${money(J.bilanz.reise)}</td></tr>
          ${J.strafen ? `<tr><td>Strafen der ATP${J.fehlen500 ? ` (auch für ${J.fehlen500} fehlende ATP-500-Turniere)` : ''}</td><td class="num minus">− ${money(J.strafen)}</td></tr>` : ''}
          <tr class="summe"><td>Dieses Jahr verdient</td><td class="num ${J.gewinn >= 0 ? 'plus' : 'minus'}">${J.gewinn >= 0 ? '+' : '−'} ${money(Math.abs(J.gewinn))}</td></tr></table>
        <div class="row" style="justify-content:center"><button class="primary" data-a="saisonWeiterJahr">Weiter mit ${esc(me.short)} ins Jahr ${s.year + 1} › <small>Jetzt musst du deine eigenen Punkte verteidigen</small></button>
        <button data-a="saisonEnde">Anderen Profi wählen</button></div></div>`;
    } else {
      const J = PS.jetzt(s), laeuft = !!s.tournament, finals = def.cat === 'F';
      const verletzt = PS.istVerletzt(s);
      if (zwMeldung) zwischen = `<div class="panel zwischen"><b>KW ${KA.kw(zwMeldung.kw)} · ${zwMeldung.name}:</b> <span class="gold">${zwMeldung.bringt.map(esc).join(' · ')}</span></div>`;
      if (J.art === 'klein') {
        // Ein kleines Turnier läuft gerade
        const k = J.def;
        next = `<div class="panel"><div class="dim">Läuft gerade · KW ${KA.kw(J.kw)}</div><h2 style="margin:6px 0">${esc(k.name)}</h2>
          <p>${catTag(k)} · ${esc(k.city)} · ${D.SURFACE_NAMES[k.surface]} · Sieger: ${k.points.W} Punkte</p>
          <div class="row"><button class="primary" data-a="saisonWeiter">Weiter im Turnier ›</button></div></div>`;
      } else {
        if (J.art === 'frei') {
          // Eine freie Woche: kleines Turnier spielen oder etwas anderes tun (genau eine Sache)
          const wahl = PS.planVon(s, J.kw), ruhe = Math.round(PS.erholung(s)), pin = ' · 📌 in deinem Plan';
          const tKnopf = (k) => { const d = PS.darfSpielen(s, k, platz), an = wahl === k.id;
            return `<button class="${an ? 'sel' : ''}" data-a="saisonKlein" data-v="${k.id}" ${d.ok ? '' : 'disabled'}>🎾 ${esc(k.name)} <small>${k.catName} · ${D.SURFACE_NAMES[k.surface]} · Sieger ${k.points.W} P.${d.ok ? '' : ' · 🔒 ' + d.warum}${an ? pin : ''}</small></button>`; };
          const aKnopf = ([id, A]) => { const g = PS.zwischenGeht(s, id), an = !!wahl && wahl.split(':')[0] === id, f = ruhe + A.frische;
            return `<button class="${an ? 'sel' : ''}" data-a="saisonWoche" data-v="${an && id === 'training' ? wahl : id}" ${g.ok ? '' : 'disabled'}>${A.name} <small>${A.bringt} · Frische ${f >= 0 ? '+' : '−'}${Math.abs(f)}${g.ok ? '' : ' · ' + g.warum}${an ? pin : ''}</small></button>`; };
          const muede = P.koerper ? `<p class="minus">🩹 Du hast Beschwerden (${esc(P.koerper.teil)}). Eine Woche ohne Turnier heilt das.</p>` : P.frische < 60 ? '<p class="minus">😮‍💨 Dein Profi ist müde. Ein Turnier wäre jetzt gefährlich für den Körper.</p>' : '';
          zwischen += `<div class="panel zwischen"><h3 style="margin-top:0">🗓️ KW ${KA.kw(J.kw)} (${KA.datumKurz(s.year, J.kw)}) – freie Woche</h3>
            <p class="dim">Noch ${J.bisGross === 1 ? 'eine Woche' : J.bisGross + ' Wochen'} bis <b>${esc(def.name)}</b> · Frische ${Math.round(P.frische)} %. Diese Woche geht genau eine Sache: ein kleines Turnier spielen – oder etwas anderes tun.</p>${muede}
            ${verletzt ? `<div class="verletzt"><b>🚑 Verletzt: ${esc(P.verletzung.name)}</b><br>Noch etwa ${P.verletzung.wochen} ${P.verletzung.wochen === 1 ? 'Woche' : 'Wochen'} Pause.</div><div class="row"><button class="primary" data-a="saisonWoche" data-v="pause">🩹 Reha-Woche ›</button></div>`
              : zwTraining ? `<p>Woran arbeitest du im Trainingsblock?</p><div class="row">${Object.entries(D.STAT_NAMES).map(([k, n]) => `<button data-a="saisonWoche" data-v="training:${k}">${n} <small>${Math.round(me.stats[k] + P.plus[k])}</small></button>`).join('')}</div>`
              : `${J.turniere.length ? `<p><b>Turniere dieser Woche</b></p><div class="row">${J.turniere.map(tKnopf).join('')}</div>` : '<p class="dim">Diese Woche gibt es kein kleines Turnier für dich.</p>'}
                <p><b>Oder ohne Turnier</b></p><div class="row">${Object.entries(PS.ZWISCHEN).map(aKnopf).join('')}</div>`}
            <p class="dim klein">Tipp: Im Reiter „Saison-Planer“ siehst du das ganze Jahr und kannst ausrechnen lassen, wann dein Profi müde wird.</p></div>`;
        }
        const dran = J.art === 'gross';
        const V = PS.verteidigen(s, def), E = PS.erwartung(s, def), K = PS.kosten(s), G = PS.sponsorGeld(s);
        const vorSieger = D.playerById(s.vorjahrSieger[def.id]);
        const fehlt = verletzt && !finals;
        const F = PS.auslassFolgen(s, def), geplantAus = PS.planVon(s, KA.wocheVon(def.id)) === 'aus';
        const alt = V.punkte ? `Letztes Jahr: <b>${V.titel ? '🏆 Turniersieg' : D.ROUND_NAMES[V.label] || ''}</b> – du musst <b>${V.punkte.toLocaleString('de-DE')} Punkte verteidigen</b>.` : 'Letztes Jahr hast du hier keine Punkte geholt. Du kannst nur gewinnen!';
        next = `<div class="panel"><div class="dim">${laeuft ? 'Läuft gerade' : dran ? 'Diese Woche · KW ' + KA.kw(J.kw) : 'Das nächste große Turnier'}</div>
          <h2 style="margin:6px 0">${def.name}</h2>
          <p>${catTag(def)} · ${def.city} · ${def.month} · ${D.SURFACE_NAMES[def.surface]}${finals ? '' : CA.istPflicht(def) ? ' · <b>Pflichtturnier</b>' : ' · keine Pflicht'}</p>
          <p class="dim">${finals ? 'Nur die besten 8 im Race. ' + (dabei ? 'Du bist dabei!' : 'Du hast es diesmal nicht geschafft – du kannst zuschauen.')
            : def.draw + ' Spieler · Sieger: ' + def.points.W.toLocaleString('de-DE') + ' Punkte'}${vorSieger ? ` · Titelverteidiger: ${V.titel ? '<b class="gold">du!</b>' : esc(vorSieger.short)}` : ''}</p>
          ${finals && !dabei ? '' : `<p>🛡️ ${alt}</p><p>🎯 ${E.text}</p>
            <p class="dim klein">Kosten für Team und Reise: ${money(K.summe)} · Sponsoren zahlen: ${money(G.summe)}${P.vertrag.schlaeger && P.vertrag.kleidung ? '' : ' · <b class="minus">Du hast noch nicht beide Ausrüster gewählt (Team & Sponsoren) – so verschenkst du Geld!</b>'}</p>`}
          ${fehlt && dran ? `<div class="verletzt"><b>🚑 Verletzt: ${esc(P.verletzung.name)}</b><br>Noch etwa ${P.verletzung.wochen} ${P.verletzung.wochen === 1 ? 'Woche' : 'Wochen'} Pause. Dieses Turnier findet ohne dich statt${V.punkte ? ` – die ${V.punkte.toLocaleString('de-DE')} Punkte vom letzten Jahr sind weg` : ''}.</div>` : ''}
          ${P.koerper && !verletzt && dran ? `<p class="minus">🩹 Beschwerden: ${esc(P.koerper.teil)}. Urlaub, der Physio auf der Anlage oder ein ausgelassenes Turnier heilen das. Wer einfach weiterspielt, riskiert eine Verletzung.</p>` : ''}
          ${dran || laeuft ? `<div class="row"><button class="primary" data-a="${laeuft ? 'saisonWeiter' : fehlt ? 'saisonSkip' : 'saisonPlay'}">${laeuft ? 'Weiter im Turnier ›' : fehlt ? 'Turnier ohne dich ansehen ›' : !finals || dabei ? 'Turnier spielen ›' : 'Turnier ansehen ›'}</button>
          ${!laeuft && !finals && !fehlt ? `<button class="${geplantAus ? 'sel' : ''}" data-a="saisonSkip">Auslassen <small>${V.punkte ? `−${V.punkte.toLocaleString('de-DE')} Punkte · ` : ''}viel Erholung${F.strafe ? ' · Strafe ' + money(F.strafe) : F.entschuldigt ? ' · mit Attest' : F.pflicht ? ' · Verwarnung' : ' · keine Strafe'}${geplantAus ? ' · 📌 in deinem Plan' : ''}</small></button>` : ''}</div>
          ${!laeuft && !finals && !fehlt ? `<p class="dim klein">Wenn du auslässt: ${esc(F.text)}</p>` : ''}` : ''}</div>`;
      }
    }
    body = `${timelineHtml(s)}
      <div class="cols">
        <div>${zwischen}${next}
          <div class="panel"><div class="kpi vier">
            <div><b>${platz}.</b><span>Weltrangliste <span class="${platz < P.startPlatz ? 'plus' : platz > P.startPlatz ? 'minus' : ''}">(Start: ${P.startPlatz}.)</span></span></div>
            <div><b>${ich.rank}.</b><span>ATP Race · ${ich.points.toLocaleString('de-DE')} Punkte</span></div>
            <div><b class="${dabei ? 'gold' : ''}">${dabei ? '✓ dabei' : 'noch nicht'}</b><span>ATP Finals · ${abstand}</span></div>
            <div><b>${s.titles}</b><span>Titel${s.titelGesamt ? ` · ${s.titelGesamt + s.titles} insgesamt` : ''}</span></div>
          </div>
          <div class="kpi vier" style="margin-top:10px">
            <div><b>${mutText(P)}</b><span>Selbstvertrauen</span>${balken((P.mut + PS.MUT_MAX) / (2 * PS.MUT_MAX), ampel((P.mut + PS.MUT_MAX) / (2 * PS.MUT_MAX)))}</div>
            <div><b>${druckText(P)}</b><span>Medien-Druck</span>${balken(P.druck / 100, ampel(1 - P.druck / 100))}</div>
            <div><b>${Math.round(P.frische)} %</b><span>Frische</span>${balken(P.frische / 100, ampel(P.frische / 100))}</div>
            <div><b class="gold">${money(P.money)}</b><span>Konto</span></div>
          </div></div>
          <div class="panel"><h3 style="margin-top:0">🎯 Ziele deiner Sponsoren für ${s.year}</h3>${ziele(P.ziele)}
            <p class="dim klein">Die Prämie gibt es am Jahresende für jedes geschaffte Ziel.</p></div>
          <div class="panel">${playerCard(me, 'saison', false)}</div>
        </div>
        <div><div class="panel"><h3 style="margin-top:0">📰 Tennis-Zeitung</h3>${zeitungHtml(s, 4)}
            <div class="center" style="margin-top:10px"><button data-a="saison" data-v="zeitung">Alles lesen ›</button></div></div>
          <div class="panel"><h3 style="margin-top:0">ATP Race – Stand</h3>${raceHtml(s, true)}
          <div class="center" style="margin-top:10px"><button data-a="saison" data-v="race">Ganze Tabelle ›</button></div></div></div>
      </div>`;
  } else if (saisonTab === 'planer') {
    body = s.over ? '<div class="panel"><p class="dim">Die Saison ist vorbei. Im nächsten Jahr gibt es einen neuen Plan.</p></div>' : saisonPlanerHtml(s);
  } else if (saisonTab === 'zeitung') {
    // Rivalen: die zwei, die in der Rangliste neben dir stehen
    const welt = PS.weltTabelle(s);
    const rivale = (id) => { const p = D.playerById(id), w = welt.find((x) => x.id === id), b = P.h2h[id] || [0, 0], r = table.find((x) => x.id === id);
      return `<div class="panel teil duell"><b>⚔️ ${flag(p.country)} ${esc(p.name)}</b><br><small class="dim">Weltrangliste Platz ${w.rank} (${w.points.toLocaleString('de-DE')} P.) · Race Platz ${r.rank}</small>
        <div class="kpi" style="margin-top:8px"><div><b>${b[0]} : ${b[1]}</b><span>deine Bilanz</span></div><div><b>${w.rank < platz ? '▲ vor dir' : '▼ hinter dir'}</b><span>${Math.abs(w.points - welt.find((x) => x.me).points).toLocaleString('de-DE')} Punkte Abstand</span></div></div></div>`; };
    const gegner = Object.entries(P.h2h).map(([id, b]) => ({ p: D.playerById(id), b })).filter((x) => x.p).sort((x, y) => (y.b[0] + y.b[1]) - (x.b[0] + x.b[1]) || x.p.rank - y.p.rank).slice(0, 12);
    body = `<div class="panel"><h3 style="margin-top:0">⚔️ Deine Rivalen</h3>
        <p class="dim">Diese zwei stehen in der Weltrangliste direkt neben dir. Ein Sieg gegen sie gibt Selbstvertrauen, eine Niederlage macht Druck. Mit „Gegner studieren“ in einer freien Woche bereitest du dich auf sie vor.</p>
        <div class="grid">${P.rivalen.map(rivale).join('')}</div></div>
      <div class="cols"><div class="panel"><h3 style="margin-top:0">📰 Tennis-Zeitung</h3>${zeitungHtml(s)}
        <p class="dim klein">Die Meldungen schreibt das Spiel selbst – sie sind ausgedacht.</p></div>
      <div class="panel"><h3 style="margin-top:0">Deine Bilanz gegen einzelne Spieler</h3>
        ${gegner.length ? `<table><tr><th>Gegner</th><th class="num">Siege : Niederlagen</th><th></th></tr>${gegner.map(({ p, b }) => `<tr><td>${flag(p.country)} ${esc(p.short)}${P.rivalen.includes(p.id) ? ' ⚔️' : ''}</td><td class="num"><b>${b[0]} : ${b[1]}</b></td>
          <td class="${b[0] > b[1] ? 'plus' : b[1] > b[0] ? 'minus' : 'dim'}">${b[0] > b[1] ? `Lieblingsgegner (+${Math.min(2, b[0] - b[1])} Mental)` : b[1] > b[0] ? `Angstgegner (−${Math.min(2, b[1] - b[0])} Mental)` : 'ausgeglichen'}</td></tr>`).join('')}</table>` : '<p class="dim">Noch kein Match gespielt.</p>'}
        <p class="dim klein">Wer gegen jemanden oft verloren hat, geht nervös ins nächste Match. Ein Sieg dreht das wieder um.</p></div></div>`;
  } else if (saisonTab === 'team') {
    const S = AU.VERTRAGS_STUFEN[PS.sponsorStufe(platz)], G = PS.sponsorGeld(s), K = PS.kosten(s);
    const person = (p, aktiv, extra) => `<div class="panel teil"><b>${p.name}</b><br><small class="dim">${p.text}</small><br><small class="gold">${extra}</small><br>
      <button class="${aktiv ? 'sel' : ''}" data-a="saisonTeam" data-v="${p.id}" style="margin-top:8px">${aktiv ? '✓ In deinem Team' : p.lohn ? 'Einstellen · ' + money(p.lohn) + ' pro Turnier' : 'Auswählen'}</button></div>`;
    const markenWahl = (art, liste) => `<div class="row">${liste.map((m) => `<button class="${P.vertrag[art] === m ? 'sel' : ''}" data-a="saisonVertrag" data-v="${art}:${m}">${m}</button>`).join('')}</div>`;
    const reise = Object.entries(AU.REISEN).map(([k, R]) => `<button class="${P.reise === k ? 'sel' : ''}" data-a="saisonReise" data-v="${k}">${R.name} <small>${money(R.fest || PS.REISE_GRUND * R.mal)} · Frische bei der Ankunft ${R.frische > 0 ? '+' : R.frische < 0 ? '−' : '±'}${Math.abs(R.frische)}</small></button>`).join('');
    const b = P.bilanz;
    body = `<div class="panel"><h3 style="margin-top:0">Sponsoren</h3>
        <div class="kpi"><div><b class="gold">${money(G.summe)}</b><span>pro Turnier</span></div><div><b>${PS.fans(s)} ⭐</b><span>Fans (+${PS.fans(s) * AU.FAN_PROZENT} %)</span></div>
          <div><b>${Math.round(P.gunst)} %</b><span>Laune der Sponsoren (zahlen ${Math.round(100 * PS.gunstMal(s))} %)</span>${balken(P.gunst / 100, ampel(P.gunst / 100))}</div></div>
        <p class="dim klein">Die Sponsoren sind zufrieden, wenn du weiter kommst als erwartet, Turniere gewinnst und zu ihren Terminen gehst. Früh verlieren und Turniere auslassen mögen sie nicht.</p>
        <table>${G.posten.map((g) => `<tr><td>✓ <b>${esc(g.name)}</b></td><td class="num">${money(g.geld)}</td></tr>`).join('') || '<tr><td class="dim">Noch kein Sponsor zahlt. Wähle unten deine Ausrüster!</td></tr>'}</table></div>
      <div class="panel"><h3 style="margin-top:0">Ausrüster</h3>
        <p>Als Nummer ${platz} der Welt bekommst du einen <b class="gold">${S.name}</b>${S.geld ? `: Jede der zwei Marken zahlt dir etwa <b>${money(S.geld)}</b> pro Turnier.` : '. Geld gibt es dafür aber noch keins.'}
        <span class="dim">Such dir aus, mit welchen Marken dein Profi im Spiel unterwegs ist. (Das Spiel weiß nicht, was der echte Spieler benutzt.)</span></p>
        <label>Schläger, Saiten und Tasche von</label>${markenWahl('schlaeger', AU.SCHLAEGER_MARKEN)}
        <label>Kleidung und Schuhe von</label>${markenWahl('kleidung', AU.KLEIDER_MARKEN)}</div>
      <div class="panel"><h3 style="margin-top:0">Trainer</h3><p class="dim">Dein Profi hat sein Team schon. Du kannst es umbauen: Ein besserer Trainer bringt mehr Erfahrung, kostet aber bei jedem Turnier – auch wenn du früh verlierst.</p>
        <div class="grid">${AU.TRAINER.map((t) => person(t, P.trainer === t.id, t.xp > 1 ? `+${Math.round((t.xp - 1) * 100)} % Erfahrung` : 'keine Hilfe')).join('')}</div></div>
      <div class="panel"><h3 style="margin-top:0">Physio</h3><p class="dim">Der Physio bestimmt, wie viel Frische ein Match kostet und wie schnell du dich zwischen den Turnieren erholst.</p>
        <div class="grid">${AU.PHYSIOS.map((p) => person(p, P.physio === p.id, `freie Woche: Frische +${Math.round(8 + p.erholung * 0.2)} · ein Match kostet etwa ${Math.round((3 + p.last * 0.4) * PS.MATCH_KOSTET)}`)).join('')}</div></div>
      <div class="panel"><h3 style="margin-top:0">Reisen</h3><p class="dim">Pro Turnier zahlst du zurzeit ${money(K.summe)} für Team und Reise.</p><div class="row">${reise}</div></div>
      <div class="panel"><h3 style="margin-top:0">Geld in diesem Jahr</h3>
        <table class="rechnung"><tr><td>Preisgeld</td><td class="num plus">+ ${money(b.preis)}</td></tr><tr><td>Sponsoren</td><td class="num plus">+ ${money(b.sponsor)}</td></tr>
          <tr><td>Trainer und Physio</td><td class="num minus">− ${money(b.team)}</td></tr><tr><td>Reisen</td><td class="num minus">− ${money(b.reise)}</td></tr>
          ${b.strafen ? `<tr><td>Strafen der ATP</td><td class="num minus">− ${money(b.strafen)}</td></tr>` : ''}
          <tr class="summe"><td>Konto</td><td class="num gold">${money(P.money)}</td></tr></table></div>
      <div class="panel"><h3 style="margin-top:0">🏆 Pokalschrank</h3>${P.pokale.length ? `<div class="grid">${P.pokale.slice().reverse().map((p) => `<div class="panel teil pokalkarte">${p.foto ? `<img src="${p.foto}" alt="Siegerfoto">` : `<div class="ohnefoto">${p.art === 'silber' ? '🏆' : p.art === 'stern' ? '⭐' : '🥇'}</div>`}
        <b>${esc(p.name)}</b><div class="dim klein">${p.ort ? esc(p.ort) + ' · ' : ''}${p.jahr}</div></div>`).join('')}</div>` : '<p class="dim">Noch leer. Gewinn ein Turnier – dann gibt es eine Siegerehrung und ein Foto für den Schrank.</p>'}</div>`;
  } else if (saisonTab === 'profi') {
    const need = CA.xpNeed(P.level);
    const zeile = ([k, n]) => { const voll = P.plus[k] >= PS.PLUS_MAX || me.stats[k] + P.plus[k] >= 99;
      return `<tr><td><b>${n}</b><br><small class="dim">${D.STAT_INFO[k] || ''}</small></td><td class="num">${Math.round(me.stats[k])}${P.plus[k] ? ` <b class="plus">+${P.plus[k]}</b>` : ''}</td>
        <td><button data-a="saisonSkill" data-v="${k}" ${P.skillPoints >= PS.PLUS_KOSTET && !voll ? '' : 'disabled'}>${voll ? 'fertig' : '+1'}</button></td></tr>`; };
    body = `<div class="cols"><div class="panel"><h3 style="margin-top:0">Fähigkeiten</h3>
        <p>Level <b>${P.level}</b> · Erfahrung ${P.xp} von ${need} · <b class="gold">${P.skillPoints} Fähigkeitspunkte</b></p>${balken(P.xp / need, '#ffd166')}
        <p class="dim klein">Dein Profi kann schon fast alles. Mit Matches, Training und dem Tag auf der Anlage lernt er trotzdem noch dazu: +1 kostet ${PS.PLUS_KOSTET} Punkte, höchstens +${PS.PLUS_MAX} je Fähigkeit.</p>
        <table>${Object.entries(D.STAT_NAMES).map(zeile).join('')}</table></div>
      <div><div class="panel"><h3 style="margin-top:0">Körper</h3>
        <p>Frische: <b>${Math.round(P.frische)} %</b></p>${balken(P.frische / 100, ampel(P.frische / 100))}
        ${P.verletzung ? `<div class="verletzt"><b>🚑 Verletzt: ${esc(P.verletzung.name)}</b><br>Noch etwa ${P.verletzung.wochen} Wochen Pause.<br><b>Warum ist das passiert?</b><ul>${P.verletzung.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`
          : P.koerper ? `<p class="minus">🩹 Beschwerden: ${esc(P.koerper.teil)} (−${AB.BESCHWERDEN_ABZUG} auf eine Fähigkeit). Das ist eine Warnung! Urlaub oder der Physio auf der Anlage heilen das.</p>` : '<p class="plus">Alles gesund.</p>'}
        <p class="dim klein">Jedes Match kostet Frische – wer weit kommt, wird also müder als einer, der früh verliert. Massage und früh schlafen helfen für den nächsten Tag, aber richtig erholt sich der Körper erst in einer Woche ohne Turnier (im Urlaub am meisten). Unter 70 % wird dein Profi langsamer. Wer müde oder mit Beschwerden weiterspielt, kann sich verletzen und verpasst dann Turniere – und die Punkte vom Vorjahr sind weg.</p></div>
      <div class="panel"><h3 style="margin-top:0">Was gerade wirkt</h3>${formListe(PS.bonusListe(s, def))}
        <p class="dim klein">Selbstvertrauen: <b>${mutText(P)}</b> · Medien-Druck: <b>${druckText(P)}</b>. Gegen einzelne Gegner kommt noch deine Bilanz dazu (Zeitung & Rivalen).</p></div></div></div>`;
  } else if (saisonTab === 'race') {
    body = `<div class="panel"><p class="dim" style="margin-top:0">Alle starten im Januar bei 0. Die besten 8 nach dem Paris Masters fahren zu den ATP Finals. 🏆 = hat dieses Jahr einen Grand Slam gewonnen.</p>${raceHtml(s, false)}</div>`;
  } else if (saisonTab === 'welt') {
    body = `<div class="panel"><p class="dim" style="margin-top:0">Die Weltrangliste zählt die Punkte der letzten 52 Wochen. Wird ein Turnier wieder gespielt, fällt das Ergebnis vom letzten Jahr weg und das neue kommt dazu.
      Darum muss man seine Punkte <b>verteidigen</b>: Wer letztes Jahr gewonnen hat und jetzt früh verliert, rutscht ab. ⚔️ = dein Rivale.</p>${weltHtml(s)}
      <p class="dim klein">Start = die echte Weltrangliste. Die Ergebnisse des Vorjahres bei den einzelnen Turnieren hat der Computer passend dazu ausgerechnet (sie sind nicht die echten). Die Punkte von kleinen Turnieren aus dem letzten Jahr fallen Woche für Woche weg – dafür zählen die kleinen Turniere, die du dieses Jahr spielst.</p></div>`;
  } else {
    body = pointsHtml();
  }
  show(`<div class="bar">${back()}<h2>${flag(me.country)} ${esc(me.name)} <small class="dim">Saison ${s.year}</small></h2><button class="ghost" data-a="saisonDelete">Saison löschen</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="${saisonTab === k ? 'sel' : ''}" data-a="saison" data-v="${k}">${n}</button>`).join('')}</div>${body}`);
  // Die Zeitleiste so hinschieben, dass „Du bist hier“ in der Mitte steht
  const now = $('#tlNow'), box = screen.querySelector('.tlscroll');
  if (box) box.scrollLeft = now ? Math.max(0, now.offsetLeft - box.clientWidth / 2 + now.offsetWidth / 2) : box.scrollWidth;
}
actions.saisonPlay = () => {
  if (PS.jetzt(season).art !== 'gross' || season.tournament) return renderSeason();
  zwMeldung = null; zwTraining = false; baumTeil = null; PS.turnierStart(season); showSeasonTournament();
};
actions.saisonWeiter = () => showSeasonTournament();
actions.saisonSkip = () => {
  if (PS.jetzt(season).art !== 'gross' || season.tournament) return renderSeason();
  zwMeldung = null; zwTraining = false; baumTeil = null;
  const T = PS.turnierStart(season, true);
  TN.simulateRest(T);
  SE.saveSeason(season);
  showSeasonTournament();
};
// Ein kleines Turnier in einer freien Woche spielen
actions.saisonKlein = (v) => {
  zwMeldung = null; zwTraining = false; baumTeil = null;
  if (PS.kleinStart(season, v)) showSeasonTournament(); else keepScroll(renderSeason);
};
// Eine freie Woche ohne Turnier. v = 'pause' | 'sponsor' | … | 'training' (klappt die Auswahl auf) | 'training:s'
actions.saisonWoche = (v) => {
  const [id, wahl] = String(v).split(':');
  if (id === 'training' && !wahl && !PS.istVerletzt(season)) { zwTraining = true; return keepScroll(renderSeason); }
  const r = PS.wocheFrei(season, id, wahl);
  zwTraining = false;
  if (r) { zwMeldung = r; sound.click(); }
  keepScroll(renderSeason);
};
// --- Saison-Planer ---
actions.sPlanAuf = (v) => { sPlanWoche = sPlanWoche === +v ? null : +v; keepScroll(renderSeason); const el = document.getElementById('skw' + v); if (el && sPlanWoche != null) el.scrollIntoView({ block: 'center' }); };
actions.sPlanSetzen = (v) => { const i = String(v).indexOf(':'); PS.planSetzen(season, +String(v).slice(0, i), String(v).slice(i + 1) || null); sPlanWoche = null; keepScroll(renderSeason); };
actions.sPlanAuto = (v) => { PS.autoPlan(season, v); sPlanWoche = null; keepScroll(renderSeason); };
let sPlanLeerArmed = false;
actions.sPlanLeeren = (v, el) => {
  if (!sPlanLeerArmed) { sPlanLeerArmed = true; el.textContent = 'Wirklich leeren? Nochmal tippen'; setTimeout(() => { sPlanLeerArmed = false; }, 4000); return; }
  sPlanLeerArmed = false; PS.planLeeren(season); keepScroll(renderSeason);
};
actions.saisonTeam = (v) => { PS.setTeam(season, v); keepScroll(renderSeason); };
actions.saisonReise = (v) => { PS.setReise(season, v); keepScroll(renderSeason); };
actions.saisonVertrag = (v) => { const [art, marke] = v.split(':'); PS.setVertrag(season, art, marke); keepScroll(renderSeason); };
actions.saisonSkill = (v) => { if (PS.steigern(season, v)) sound.coin(); keepScroll(renderSeason); };
function seasonTournamentDone() {
  const s = PS.turnierFertig(season), r = s.rechnung, P = season.profi;
  const lines = [
    s.label ? `Dein Ergebnis: <b>${s.label === 'W' ? 'Turniersieg 🏆' : D.ROUND_NAMES[s.label]}</b>` : s.verteidigt.punkte || s.tid !== 'fin' ? 'Du hast nicht mitgespielt.' : 'Du warst nicht qualifiziert.',
    `Punkte fürs ATP Race: <b class="gold">+${s.points.toLocaleString('de-DE')}</b> · Platz ${s.rank} im Race (${s.total.toLocaleString('de-DE')} Punkte)`,
  ];
  const platzText = `Du stehst auf <b>Platz ${s.platz}</b>${s.platzVorher !== s.platz ? ` <span class="${s.platz < s.platzVorher ? 'plus' : 'minus'}">(${s.platz < s.platzVorher ? '▲' : '▼'} ${Math.abs(s.platzVorher - s.platz)})</span>` : ''}.`;
  if (s.klein) {
    lines.push(`🛡️ Weltrangliste: Die ${s.points.toLocaleString('de-DE')} Punkte zählen sofort dazu. ${platzText}`);
    if (s.label === 'W') lines.push('<b class="gold">Ein Titel! Das gibt Selbstvertrauen für die großen Turniere.</b>');
    else if (s.abstand <= -2) lines.push(`<b class="minus">🎯 Erwartet war ${D.ROUND_NAMES[s.erwartet] || s.erwartet}.</b> Ausgerechnet bei einem kleinen Turnier – das kratzt am Selbstvertrauen.`);
  } else {
    // Punkte verteidigen: Was fiel weg, was kam dazu?
    const d = s.points - s.verteidigt.punkte;
    lines.push(`🛡️ Weltrangliste: ${s.verteidigt.punkte.toLocaleString('de-DE')} Punkte vom letzten Jahr fallen weg, ${s.points.toLocaleString('de-DE')} neue kommen dazu
      = <b class="${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('de-DE')}</b>. ${platzText}`);
    if (s.abstand != null && s.label !== 'W') lines.push(s.abstand > 0 ? '<b class="plus">🎯 Besser als erwartet!</b> Das gibt Selbstvertrauen, und die Sponsoren freuen sich.'
      : s.abstand < 0 ? `<b class="minus">🎯 Erwartet war mindestens ${D.ROUND_NAMES[s.erwartet] || s.erwartet}.</b> Die Zeitungen schreiben böse Sätze – der Druck steigt, das Selbstvertrauen sinkt.` : '🎯 Genau so weit, wie alle erwartet haben.');
    if (s.label === 'W') lines.push('<b class="gold">Ein Titel! Dein Selbstvertrauen ist riesig, und der Druck ist wie weggeblasen.</b>');
    const riv = (s.rivalen || []).filter((x) => x.label);
    if (riv.length) lines.push(`<span class="dim">⚔️ Deine Rivalen: ${riv.map((x) => `${esc(x.name)} – ${x.label === 'W' ? '🏆 Sieg' : D.ROUND_NAMES[x.label]}`).join(' · ')}</span>`);
    // Ausgelassen: Was sagt die ATP dazu?
    const F = s.auslassen;
    if (F) lines.push(F.strafe ? `<b class="minus">⚠️ Das war schon dein ${F.nr}. Pflichtturnier ohne Grund in diesem Jahr: ${money(F.strafe)} Strafe.</b> Beim nächsten Mal wird es noch teurer, und die Sponsoren sind sauer.`
      : F.entschuldigt ? '📝 Pflichtturnier – aber der Arzt hat ein Attest geschrieben. Keine Strafe.'
      : F.pflicht ? '<b class="minus">⚠️ Verwarnung der ATP:</b> Das war ein Pflichtturnier. Beim ersten Mal im Jahr bleibt es dabei – ab dem zweiten Mal kostet es Geld.' : 'Das war kein Pflichtturnier. Niemand ist dir böse.');
  }
  if (s.beschwerden) lines.push(`<b class="minus">🩹 Beschwerden: ${esc(s.beschwerden.leicht)}</b> Das ist eine Warnung deines Körpers. Urlaub, der Physio auf der Anlage oder ein ausgelassenes Turnier heilen das.`);
  if (s.verletzung) lines.push(`<div class="verletzt"><b>🚑 Verletzt: ${esc(s.verletzung.name)}</b><br>Du musst etwa <b>${s.verletzung.wochen} Wochen</b> pausieren.<br><b>Warum ist das passiert?</b><ul>${s.verletzung.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    Turniere in dieser Zeit finden ohne dich statt – und die Punkte, die du dort letztes Jahr geholt hast, sind dann weg.</div>`);
  if (s.gesund) lines.push(`<b class="plus">Du bist wieder gesund!</b> Die Verletzung (${esc(s.gesund)}) ist ausgeheilt.`);
  if (s.geheilt) lines.push('<b class="plus">Die Pause hat gutgetan:</b> Deine Beschwerden sind weg.');
  const z = (name, betrag) => (betrag ? `<tr><td>${name}</td><td class="num ${betrag > 0 ? 'plus' : 'minus'}">${betrag > 0 ? '+' : '−'} ${money(Math.abs(betrag))}</td></tr>` : '');
  const strafe = s.auslassen ? s.auslassen.strafe || 0 : 0, summe = s.netto - strafe;
  lines.push(`<table class="rechnung">${z('Preisgeld', r.preis)}${r.sponsoren.map((g) => z('Sponsor: ' + esc(g.name), g.geld)).join('')}${z('Trainer und Physio', -r.team)}${z('Reise', -r.reise)}${z('Strafe der ATP', -strafe)}
    <tr class="summe"><td>Dieses Turnier</td><td class="num ${summe >= 0 ? 'plus' : 'minus'}">${summe >= 0 ? '+' : '−'} ${money(Math.abs(summe))}</td></tr></table>`);
  if (s.finalsQualified === true) lines.push('<b class="gold">Geschafft! Du bist unter den besten 8 und fährst zu den ATP Finals nach Turin!</b>');
  if (s.finalsQualified === false) lines.push('Für die ATP Finals hat es diesmal leider nicht gereicht.');
  if (s.seasonOver) lines.push(`<b>Die Saison ist zu Ende!</b> Du hast ${s.jahr.geschafft} von ${s.jahr.ziele.length} Zielen deiner Sponsoren geschafft.`);
  else if (s.naechstes) lines.push(`<span class="dim">Als Nächstes: ${s.naechstes === 'frei' ? 'eine freie Woche – kleines Turnier, Urlaub oder Training?' : esc(s.naechstes) + ' – gleich nächste Woche, ohne Pause.'} Frische jetzt: ${Math.round(P.frische)} %.</span>`);
  if (s.label === 'W') sound.coin();
  saisonTab = 'start'; zwMeldung = null; zwTraining = false;
  showInfo(s.name, lines.join('<br>'), 'saisonStart');
}
actions.saisonStart = () => actions.saison('start');
actions.saisonEnde = () => { season = null; SE.deleteSeason(); renderSeasonPick(); };
// Mit demselben Profi ins nächste Jahr: Jetzt sind die eigenen Ergebnisse das, was verteidigt werden muss
actions.saisonWeiterJahr = () => { season = PS.naechsteSaison(season); saisonTab = 'start'; zwMeldung = null; renderSeason(); };
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
  const len = D.LENGTHS[o.length || settings.length];        // „Erste Schritte“ geben Länge und Stufe selbst vor
  const mode = o.mode || 'match';
  menuVenue = o.def.id;
  game.loadVenue(o.def);
  game.setPlayers(o.me, o.opp);
  // In der Karriere steht deine Schlägertasche neben der Bank
  const tasche = career && o.me && o.me.me ? CA.traegt(career, 'Tasche') : null;
  game.tascheZeigen(tasche ? tasche.color ?? 0x2a2a34 : null);
  game.showAvatars(true);
  controls.setMode(settings.control);
  controls.laufhilfe = settings.assist;      // beim Wischen mit Laufhilfe „Voll“ gibt es keinen Joystick
  controls.enabled = true;
  const names = [o.me.short, o.opp.short];
  // Spielzug-Training (o.lernen): läuft wie ein Match, aber gezählt werden nur die Versuche – deshalb "unendlich" lange Sätze
  const lernen = o.lernen || null;
  const mitZuegen = !lernen && mode === 'match' && settings.spielzuege === 'an';
  session = { o, names, over: false, mode: lernen ? 'spielzug' : mode, zugScore: 0, zuege: [0, 0], mitZuegen };
  rekStart(o);
  match = new Match({
    rekorder: rek,
    players: [o.me, o.opp], human: 0, surface: o.def.surface, difficulty: o.difficulty || settings.difficulty,
    sets: lernen ? 3 : len.sets, games: lernen ? 99 : len.games, mode, balls: o.balls, assist: settings.assist, controlMode: settings.control,
    ohneHilfe: !!o.ohneHilfe,
    finale: !!o.finale,      // im Endspiel heißt der Matchball "Championship Point"
    lernen, changeover: lernen ? false : undefined,
    spielzuege: mitZuegen ? { an: true, stufen: SZ.gelernte(zugSpeicher) } : null,
  }, game.makeFx(names), controls);
  game.attach(match, hud);
  paused = false;
  hudEl.hidden = false;
  $('#trainBox').classList.toggle('on', mode !== 'match' || !!lernen);
  $('#scoreboard').style.display = mode === 'match' && !lernen ? '' : 'none';
  zugKey = '';
  if (lernen) hud.training(match.training);
  $('#hint').textContent = {
    touch: 'Links: laufen · Rechts: nach oben wischen = Schlag · unten = Stopp · Doppeltipp = Lob · zwei Finger hoch = ans Netz, runter = zurück',
    wisch: 'Wischen = Schlag: ↑ hoher Topspin · ↗ Topspin · → gerade · ↘ langer Slice · ↓ kurzer Slice · früh = cross, spät = Linie entlang · schnell = hart · zwei Finger ↑ = Lob · Doppeltipp = Netz',
    klassik: 'Mausrad/←→ zielen · Linke Taste halten = Kraft · Doppelklick = Lob · ↑↓ laufen',
    controller: 'Schwingen oder A = Schlag · B Slice · X Lob · Y Stopp · früh = cross, spät = Linie entlang',
    profi: 'WASD laufen · Leertaste Topspin · U gerade · O hoher Topspin · K Slice · L Lob · I Stopp · Richtung beim Treffen halten',
  }[settings.control] + (settings.kamera !== 'aus' ? ' · 📷 laufen mit der Kamera' : '');
  if (o.hinweis) $('#hint').textContent = '🎯 ' + o.hinweis + ' · ' + $('#hint').textContent;     // „Erste Schritte“: das Ziel der Lektion steht vorn
  // Auf dem Handy blendet sich der Hinweis nach ein paar Sekunden aus (siehe style.css). Dafür die Klasse neu setzen.
  $('#hint').classList.remove('kurz'); void $('#hint').offsetWidth; $('#hint').classList.add('kurz');
  hud.update();
  hud.message(o.title || '', 'info');
  sound.setCrowd(0.05);
  // Vor einem richtigen Match: die Einlaufszene (Einstellungen → „Einlaufen vor dem Match“)
  if (mode === 'match' && !lernen && !o.ohneEinlauf && settings.einlauf !== 'aus') einlaufLos(o);
}

// ---------------------------------------------------------------
// Einlaufszene vor dem Match: Die Spieler kommen auf den Platz, spielen sich ein und werden vorgestellt.
// Der Ablauf steht in einlauf.js, gezeichnet wird in game3d.js. Hier: Titel, Steckbrief-Karte, Antippen.
// ---------------------------------------------------------------
const einlaufEl = $('#einlauf');
let einlaufSeit = 0;        // wann der Teil begonnen hat, der gerade läuft (damit ein Doppeltipp nicht gleich zwei Teile überspringt)
const einlaufAn = () => !!(game.einlauf && game.einlauf.an);
function einlaufLos(o) {
  controls.enabled = false;
  hudEl.hidden = true;
  einlaufEl.hidden = false;
  // Was im Steckbrief steht, das die Spieler-Daten nicht wissen: dein Platz in der Karriere, deine Turniersiege, die Bilanz
  const inKarriere = career && o.me.me;
  const ichMehr = { du: true };
  if (inKarriere) {
    const ich = CA.ranking(career).find((p) => p.me);
    Object.assign(ichMehr, { platz: ich.rank, punkte: ich.points, titel: career.titles });
  }
  const karten = [steckbrief(o.me, ichMehr), steckbrief(o.opp, { bilanz: o.bilanz })];
  const farbe = (p) => '#' + ((p.look && p.look.shirt) ?? 0xffffff).toString(16).padStart(6, '0');
  const titel = (klein) => { $('#einlaufTitel').innerHTML = `<small>${esc(o.title || '')}</small><b>${esc(o.me.short)} <i>gegen</i> ${esc(o.opp.short)}</b><span>${klein}</span>`; };
  game.einlaufStart(settings.einlauf === 'kurz' ? 'kurz' : 'an', [o.me, o.opp], (name, info) => {
    if (name === 'fertig') return einlaufFertig(o);
    if (name !== 'teil') return;
    einlaufSeit = performance.now();
    const karte = $('#einlaufKarte');
    if (info.seite == null) {
      karte.className = '';
      titel(info.teil === 'einlaufen' ? 'Die Spieler kommen auf den Platz' : 'Einspielen');
      $('#einlaufTitel').className = info.teil === 'einlaufen' ? 'on' : 'on klein';      // beim Einspielen nur ein kleines Schild, damit man die Spieler sieht
      if (info.teil === 'einlaufen') sound.say('Bitte begrüßen Sie die Spieler!');
      return;
    }
    // Steckbrief: Wer wird gerade gezeigt?
    const k = karten[info.seite], p = info.seite === 0 ? o.me : o.opp;
    $('#einlaufTitel').className = '';
    karte.style.setProperty('--hemd', farbe(p));
    karte.innerHTML = `<div class="kopf"><span class="flagge">${flag(k.land)}</span>
        <div class="wer"><small>${k.du ? 'Das bist du' : 'Dein Gegner'}${k.land ? ' · ' + esc(k.land) : ''}</small><b>${esc(k.name)}</b></div>
        ${k.platz ? `<div class="platz"><small>Platz</small>${k.platz}</div>` : ''}</div>
      <table>${k.zeilen.map((z) => `<tr><td>${esc(z[0])}</td><td>${esc(z[1])}</td></tr>`).join('')}</table>
      ${k.merkmal ? `<p>${esc(k.merkmal)}</p>` : ''}`;
    karte.className = '';
    void karte.offsetWidth;           // kurz „ausschalten“, damit die Karte jedes Mal neu hereingleitet
    karte.className = 'on';
    sound.say(k.name);
  });
}
// Die Szene ist vorbei (oder übersprungen): Jetzt beginnt das Match.
function einlaufFertig(o) {
  einlaufEl.hidden = true;
  $('#einlaufKarte').className = ''; $('#einlaufTitel').className = '';
  if (!match) return;
  match.timer = 1.2;                // kurz durchatmen, dann kommt der erste Aufschlag
  hudEl.hidden = false;
  controls.enabled = !paused;
  $('#hint').classList.remove('kurz'); void $('#hint').offsetWidth; $('#hint').classList.add('kurz');
  hud.message(o.title || '', 'info');
}
// Antippen (irgendwo) = zum nächsten Teil, Knopf „Überspringen“ = gleich zum Match
function einlaufTipp(alles) {
  if (!einlaufAn() || paused) return;
  sound.unlock();
  if (alles) return game.einlauf.ueberspringen();
  if (performance.now() - einlaufSeit < 350) return;
  game.einlauf.weiter();
}
einlaufEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); einlaufTipp(!!e.target.closest('#einlaufSkip')); });

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
  // Dein harter Schlag im Ballwechsel: kurz das Tempo zeigen (stark = 0 bis 1, ab 0.6 mit Flamme)
  schlagTempo(kmh, stark) {
    const s = $('#speed');
    s.textContent = (stark >= 0.6 ? '🔥 ' : '') + kmh + ' km/h'; s.classList.add('on');
    speedTimer = 1.1;
  },
  training(tr, pts, ok) {
    if (tr.lernen) {
      // Spielzug-Training: Jeder geschaffte Spielzug wird sofort gemerkt
      $('#trainBox').innerHTML = `${tr.score}-mal geschafft<small>Versuch ${Math.min(tr.done + 1, tr.balls)} von ${tr.balls} · ${SZ.lernenOft}-mal geschafft = gelernt</small>`;
      while (session.zugScore < tr.score) {
        session.zugScore++;
        if (SZ.eintragen(zugSpeicher, tr.lernen, 't')) hud.message(`★ Gelernt: ${SZ.ZUEGE[tr.lernen].name}!`, 'wichtig');
        zugSichern();
      }
      return;
    }
    $('#trainBox').innerHTML = `${tr.score} Punkte<small>Ball ${Math.min(tr.done + 1, tr.balls)} von ${tr.balls} · Gelb = 5, Blau = 3</small>`;
    if (pts !== undefined) hud.message(ok ? (pts >= 3 ? `Zielfeld! +${pts}` : `Im Feld +${pts}`) : 'Daneben', pts >= 3 ? 'info' : ok ? '' : 'warn');
  },
  // Im Match ist ein Spielzug fertig geworden (deiner oder der des Gegners)
  spielzug(info) {
    session.zuege[info.side]++;
    if (info.mensch) {
      const neu = SZ.eintragen(zugSpeicher, info.id, 'm');
      zugSichern();
      if (info.durchschaut) hud.message(`„${info.name}“ – der Gegner kennt den Trick schon. Wechsle ab!`, 'warn');
      else hud.message(neu ? `${SZ.STUFEN[SZ.stufe(zugSpeicher, info.id)].stern} ${info.name} – neue Stufe!` : `Spielzug: ${info.name}! Der Gegner ist unter Druck`, neu ? 'wichtig' : 'info');
    } else if (!info.durchschaut) {
      hud.message(`${session.names[info.side]} spielt „${info.name}“ – du bist unter Druck!`, 'warn');
    }
  },
  trainingOver(tr) {
    session.over = true;
    if (session.wiedergabe) return setTimeout(wiedergabeEnde, 1500);
    setTimeout(() => showResult({ training: tr }), 600);
  },
  matchOver(score) {
    session.over = true;
    if (session.wiedergabe) return setTimeout(wiedergabeEnde, 1500);
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

// Spielzug-Training: der Kasten links mit den Schritten. Der Schritt, der dran ist, leuchtet.
let zugKey = '';
function zugFrame() {
  const zs = match && match.zugStand && !session.over ? match.zugStand() : null;
  const box = $('#zugBox');
  box.classList.toggle('on', !!zs);
  if (!zs) return;
  const key = [zs.i, zs.fertig, zs.dran, zs.netz, zs.meldung && zs.meldung.text, settings.control, match.state === 'pointOver'].join('|');
  if (key === zugKey) return;         // nur neu schreiben, wenn sich etwas geändert hat
  zugKey = key;
  const T = ZUG_TIPP[settings.control] || ZUG_TIPP.touch;
  const zeilen = zs.zug.schritte.map((s, n) => {
    const fertig = zs.fertig || (zs.i > n);
    const jetzt = !zs.fertig && zs.i === n;
    return `<li class="${fertig ? 'fertig' : jetzt ? 'jetzt' : ''}">${fertig ? '✓ ' : ''}${esc(s.text)}${jetzt ? `<small>${esc(zs.netz ? 'Erst ans Netz: ' + T.netz : zugTipp(s))}</small>` : ''}</li>`;
  }).join('');
  const unten = zs.fertig ? '<p class="gut">✓ Geschafft!</p>'
    : zs.i < 0 ? `<p class="schlecht">${esc(zs.meldung ? zs.meldung.text : '')}<br>Gleich noch einmal!</p>`
    : zs.meldung && (!zs.meldung.ok || match.state === 'pointOver') ? `<p class="schlecht">${esc(zs.meldung.text)}</p>` : '';
  box.innerHTML = `<b>${esc(zs.zug.name)}</b><ol>${zeilen}</ol>${unten}`;
}

function hudFrame(dt) {
  if (hudEl.hidden) return;
  diagFrame(dt);
  zugFrame();
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
  controls.enabled = !paused && !einlaufAn();
  if (paused) {
    show(`<div class="panel modal"><h2>Pause</h2><div class="menu">
      <button class="primary" data-a="resume">Weiterspielen</button>
      <button data-a="settings" data-v="pauseMenu">Einstellungen</button>
      <button data-a="help" data-v="pauseMenu">Steuerung</button>
      <button data-a="quit">${session.wiedergabe ? 'Wiedergabe beenden' : session.mode === 'match' ? 'Match aufgeben' : 'Training beenden'}</button></div></div>`);
    quitArmed = false;
  } else hide();
}
actions.resume = () => { if (paused) togglePause(); };
// Der Spickzettel („?“ oben rechts im Match): hält das Spiel an und zeigt nur DEINE Steuerung
actions.spick = () => {
  if (!match || !session || session.over) return;
  if (!paused) togglePause();
  if (!paused) return;
  const alles = helpHtml(), bis = alles.indexOf('</div>') + 6;
  show(`<div class="panel modal spick">${alles.startsWith('<div class="panel help meins">') ? alles.slice(0, bis) : alles}
    <div class="row" style="margin-top:10px"><button class="primary grow" data-a="resume">Weiterspielen</button><button data-a="help" data-v="pauseMenu">Alle Steuerungen</button></div></div>`);
};
actions.pauseMenu = () => { paused = false; togglePause(); };
// „Match aufgeben“ muss man zweimal antippen – sonst verliert man aus Versehen ein ganzes Turnier.
let quitArmed = false;
actions.quit = (v, el) => {
  if (session.mode === 'match' && !quitArmed && el) {
    quitArmed = true;
    el.textContent = 'Wirklich aufgeben? Das zählt als Niederlage. Nochmal tippen';
    setTimeout(() => { quitArmed = false; if (el.isConnected) el.textContent = 'Match aufgeben'; }, 4000);
    return;
  }
  quitArmed = false;
  const o = session.o;
  const training = match ? match.training : { score: 0 };
  session.over = true;
  endMatch();
  enterMenu();
  o.onEnd({ won: false, aborted: true, score: 'Aufgabe', setDiff: 2, training });
};

function endMatch() {
  rekEnde();
  wgBox.classList.remove('on');
  kameraBild.stop();                // Kamera aus, das Einmessen bleibt gemerkt
  controls.enabled = false;
  controls.showStick(false);
  hudEl.hidden = true;
  paused = false;
}

function showResult(r) {
  const o = session.o;
  const hilfen = match ? match.hilfsZahl || 0 : 0;      // Stufe „Leicht“: so oft hat das Spiel für dich geschlagen
  endMatch();
  if (r.training) {
    const tr = r.training;
    if (tr.lernen) {
      // Spielzug-Training: Wie oft hat es geklappt, und ist der Spielzug jetzt gelernt?
      const z = SZ.ZUEGE[tr.lernen], stufe = SZ.stufe(zugSpeicher, tr.lernen), bisher = (zugSpeicher[tr.lernen] || {}).t || 0;
      sound.applause(0.6, tr.score > 0);
      pendingEnd = () => o.onEnd({ won: true, training: tr });
      return show(`<div class="panel modal"><h2>${esc(z.name)}</h2><div class="score gold">${tr.score} von ${tr.balls}</div>
        <p class="center dim">Versuchen geschafft</p>
        <p class="center">${stufe ? `<span class="gold">${SZ.STUFEN[stufe].stern} Gelernt!</span> Schalte „Spielzüge im Match“ ein, dann wirkt er auch im Match.`
          : `Noch ${SZ.lernenOft - bisher}-mal schaffen, dann hast du ihn gelernt.`}</p>
        <div class="center"><button class="primary" data-a="resultNext">Weiter</button></div></div>`);
    }
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
      ${line('1. Aufschlag im Feld', (s) => (s.firstTotal ? Math.round(100 * s.firstIn / s.firstTotal) + ' %' : '–'))}
      ${session.mitZuegen ? `<tr><td class="num">${session.zuege[0]}</td><td class="center dim">Spielzüge</td><td>${session.zuege[1]}</td></tr>` : ''}</table>
    ${hilfen ? `<p class="center dim">🤝 ${hilfen}-mal hat das Spiel für dich geschlagen (Hilfs-Schlag der Stufe „Leicht“). Je öfter du selbst schlägst, desto mehr Punkte machst du.</p>` : ''}
    <div class="center" style="margin-top:14px"><button class="primary" data-a="resultNext">Weiter</button>
      ${o.revanche ? ` <button data-a="revanche">${won ? '🔁 Noch einmal gegen ' : '🔁 Revanche gegen '}${esc(n[1])}</button>` : ''}</div></div>`);
  revancheO = o.revanche ? o : null;
}
let pendingEnd = null;
// Freies Spiel: gleich noch einmal gegen denselben Gegner im selben Stadion
let revancheO = null;
actions.revanche = () => { const o = revancheO; revancheO = null; pendingEnd = null; if (!o) return actions.home(); enterMenu(); startMatch(o); };
actions.resultNext = () => { const f = pendingEnd; pendingEnd = null; enterMenu(); if (f) f(); };

// ---------------------------------------------------------------
// Spielschleife
// ---------------------------------------------------------------
// Geräusche auf dem Turniergelände: Stimmen und Vögel im Hintergrund, Schritte der eigenen Figur, Wagentür und Motor vom Fahrdienst.
const SCHRITT_GEHEN = 0.75, SCHRITT_JOGGEN = 1.15;      // so viele Meter liegen zwischen zwei Schritten
const ton = { weg: 0, fahrt: '' };
function gelaendeTon(dt) {
  const A = game.anlage, an = A.an && !match;
  sound.gelaende(an ? (A.zuFuss && A.zuFuss() ? 0.6 : 1) : 0);          // im Städtchen ist weniger los
  if (!an) { ton.fahrt = ''; return; }
  // Fahrt ins Hotel: Tür zu, dann fährt der Wagen los
  const phase = A.fahrt ? A.fahrt.phase : '';
  if (phase !== ton.fahrt) {
    if (phase === 'fahren') { sound.autotuer(); sound.auto(); }
    else if (phase === 'aus' && ton.fahrt === 'fahren') sound.autotuer();
    ton.fahrt = phase;
  }
  if (phase === 'fahren') return;
  // Schritte: nach jedem Stück Weg einer (schnell = joggen = längere Schritte)
  const tempo = Math.hypot(A.p.vx || 0, A.p.vz || 0);
  if (tempo < 0.3) { ton.weg = 0.5; return; }
  const joggt = tempo > 2.4;
  ton.weg += tempo * dt;
  if (ton.weg >= (joggt ? SCHRITT_JOGGEN : SCHRITT_GEHEN)) { ton.weg = 0; sound.schritt(joggt); }
}

let last = performance.now();
function loop(now) {
  const roh = (now - last) / 1000, dt = Math.min(0.05, roh);
  last = now;
  if (!MS.offen() && !document.hidden) game.tempoPruefen(roh);      // ruckelt es? Dann malt das Spiel mit weniger Bildpunkten (game3d.js)
  handy.pruefen();                  // meldet sich das Handy (als Schläger) noch?
  controls.pollPad();               // Controller im Browser abfragen (auch in der Pause, wegen der Pause-Taste)
  // Läuft ein Mini-Spiel (minispiele.js), bleibt das Gelände dahinter als Standbild stehen: Das spart Rechenzeit fürs Mini-Spiel.
  if (MS.offen()) return requestAnimationFrame(loop);
  // Im Match läuft die Zeit nach dem eingestellten Spieltempo. Bei einem langen Bild rechnen wir in zwei halben Schritten,
  // damit ein sehr schneller Ball nicht in einem einzigen Schritt am Schläger vorbeifliegt.
  const dm = match ? dt * (session && session.wiedergabe ? wgMal : tempoMal()) : dt;
  if (match && session && session.wiedergabe) wgFrame();
  if (match && !paused && !einlaufAn()) {
    controls.update(dt);       // die Steuerung rechnet in echter Zeit: Die Zeitfenster zum Schlagen werden durch das Spieltempo nicht kürzer
    const teile = dm > 0.022 ? 2 : 1;
    for (let i = 0; i < teile; i++) match.update(dm / teile);
  }
  game.frame(match && paused ? 0 : dm);
  gelaendeFrame();
  gelaendeTon(dt);
  hudFrame(dt);
  kameraFrame();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------
// Match-Rekorder: schreibt mit, was im Match passiert (js/rekorder.js). Nur wenn er in den Einstellungen an ist.
// Hier: Aufnahme beginnen und speichern, die Liste der Aufnahmen, Auswertung, Sichern als Datei, Abspielen.
// ---------------------------------------------------------------
let rek = null;             // die Aufnahme, die gerade läuft (null = Rekorder aus)
let rekLetzte = null;       // die zuletzt fertig gewordene Aufnahme (für Tests und für die Liste)
function rekStart(o) {
  rek = null; controls.onRek = null;
  if (settings.rekorder !== 'an') return;
  rek = new Rekorder({
    titel: o.title || '', ort: o.def.id, steuerung: settings.control, kamera: settings.kamera,
    tempo: settings.tempo, tempoMal: tempoMal(), laenge: o.length || settings.length, blick: settings.blick,
    spielzuege: settings.spielzuege, version: window.__powershotVersion || '',
    geraet: { touch: touchDevice, breit: window.innerWidth, hoch: window.innerHeight, app: !!window.webkit?.messageHandlers?.powershot },
  });
  controls.onRek = (was, d) => { if (rek) rek.eingabe(was, d); };
}
// Das Match ist vorbei (oder wurde abgebrochen): Aufnahme abschließen und aufheben
function rekEnde() {
  if (!rek) return;
  const r = rek;
  rek = null; controls.onRek = null;
  if (!r.fertig) r.ende(match && match.score, true);
  // Womit wurde geschwungen? (Das weiß man erst am Ende sicher.)
  if (settings.control === 'controller') { r.kopf.schlaeger = controls.pad.connected ? controls.pad.name : ''; r.kopf.uhr = !!controls.uhrAktiv; }
  if (match && match.hilfsZahl) r.kopf.hilfsSchlaege = match.hilfsZahl;
  const a = r.daten();
  if (!a.punkte.length) return;          // gleich wieder abgebrochen: nichts zum Aufheben
  rekLetzte = a;
  RS.speichern(a);
}
const datumKurz = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
let rekListe = [];
actions.rekorder = async (meldung) => {
  rekListe = await RS.alle();
  const zeile = (a) => {
    const K = a.kopf;
    return `<div class="rekZeile"><div><b>${esc(kurzName(a))}</b><br><small class="dim">${esc(datumKurz(K.wann))} · ${esc(K.titel || K.modus)} · Stufe ${esc(K.stufe)} · ${esc(STEUERUNG_NAME[K.steuerung] || K.steuerung)} · ${a.punkte.length} Punkte</small></div>
      <div class="row"><button data-a="rekZahlen" data-v="${esc(a.id)}">📊</button><button data-a="rekAbspielen" data-v="${esc(a.id)}">▶</button><button data-a="rekWeg" data-v="${esc(a.id)}">🗑</button></div></div>`;
  };
  show(`<button class="back" data-a="settings">‹ Zurück</button><h1>Match-Rekorder</h1>
    ${meldung && typeof meldung === 'string' ? `<p class="gold">${esc(meldung)}</p>` : ''}
    <div class="panel">
      <p>Der Rekorder ist <b>${settings.rekorder === 'an' ? 'an ⏺' : 'aus'}</b>. ${settings.rekorder === 'an' ? 'Jedes Match und jedes Training wird mitgeschrieben.' : 'Schalte ihn in den Einstellungen ein, dann wird jedes Match mitgeschrieben.'}</p>
      <div class="row"><button data-a="set" data-v="rekorder:${settings.rekorder === 'an' ? 'aus' : 'an'}" data-nach="rekorder">${settings.rekorder === 'an' ? 'Rekorder ausschalten' : '⏺ Rekorder einschalten'}</button></div>
    </div>
    <div class="panel"><h3>${rekListe.length} Aufnahme${rekListe.length === 1 ? '' : 'n'}</h3>
      ${rekListe.length ? `<div class="row"><button class="primary" data-a="rekZahlen" data-v="alle">📊 Alle auswerten</button>
        <button data-a="rekSichern">💾 Als Datei sichern</button><button data-a="rekAllesWeg">🗑 Alle löschen</button></div>
        <p class="dim" style="font-size:13px">📊 = Zahlen und Auffälligkeiten · ▶ = im Stadion abspielen · Die Datei kannst du Claude geben („Spiel als externer Reviewer prüfen“)
          oder mit <code>node tools/rekorder.mjs datei.json</code> auswerten.</p>
        ${rekListe.map(zeile).join('')}` : '<p class="dim">Noch keine Aufnahmen. Schalte den Rekorder ein und spiele ein Match.</p>'}
    </div>`);
};
actions.rekZahlen = (id) => {
  const l = id === 'alle' ? rekListe : rekListe.filter((a) => a.id === id);
  const text = bericht(auswerten(l)).join('\n');
  show(`<button class="back" data-a="rekorder">‹ Zurück</button><h1>Auswertung</h1>
    <p class="dim">${l.length === 1 ? esc(kurzName(l[0])) : l.length + ' Aufnahmen, getrennt nach Steuerung und Stufe'}. „Auffällig“ sind einfache Faustregeln – sie zeigen, wo man hinschauen sollte.</p>
    <div class="panel"><pre class="rekText">${esc(text)}</pre></div>`);
};
let rekWegArm = '';
actions.rekWeg = async (id, el) => {
  if (rekWegArm !== id) { rekWegArm = id; el.textContent = 'Löschen?'; setTimeout(() => { rekWegArm = ''; }, 3000); return; }
  rekWegArm = ''; await RS.loeschen(id); actions.rekorder();
};
actions.rekAllesWeg = async (v, el) => {
  if (rekWegArm !== 'alle') { rekWegArm = 'alle'; el.textContent = 'Wirklich alle löschen? Nochmal tippen'; setTimeout(() => { rekWegArm = ''; }, 4000); return; }
  rekWegArm = ''; await RS.allesLoeschen(); actions.rekorder('Alle Aufnahmen gelöscht.');
};
// Alle Aufnahmen in eine Datei: auf iPad und iPhone über „Teilen“ (dort gibt es kein einfaches Herunterladen), sonst als Download
actions.rekSichern = async () => {
  const text = await RS.paket(), name = `powershot-aufnahmen-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  try {
    const datei = new File([text], name, { type: 'application/json' });
    if (touchDevice && navigator.canShare && navigator.canShare({ files: [datei] })) { await navigator.share({ files: [datei], title: 'Powershot-Aufnahmen' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; /* Teilen ging nicht – dann eben herunterladen */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};

// Eine Aufnahme im Stadion abspielen. Die Wiedergabe (js/wiedergabe.js) tut so, als wäre sie ein Match.
const wgBox = $('#wgBox');
let wgMal = 1, wgKey = '';
actions.rekAbspielen = (id) => {
  const a = rekListe.find((x) => x.id === id);
  if (!a) return;
  const K = a.kopf, sp = K.spieler || [];
  const def = D.tournamentById(K.ort) || D.TOURNAMENTS[0];
  const figur = (s, i) => ({ name: s.name || (i ? 'Gegner' : 'Du'), short: s.kurz || s.name || (i ? 'Gegner' : 'Du'), hand: s.hand || 1, look: s.look || {}, stats: s.stats || {} });
  const me = figur(sp[0] || {}, 0), opp = figur(sp[1] || {}, 1);
  hide();
  menuVenue = def.id;
  game.loadVenue(def);
  game.setPlayers(me, opp);
  game.tascheZeigen(null);
  game.showAvatars(true);
  controls.enabled = false;
  const names = [me.short, opp.short];
  session = { o: { title: '▶ Aufnahme vom ' + datumKurz(K.wann), def, me, opp, onEnd: () => actions.rekorder() }, names, over: false, mode: 'wiedergabe', wiedergabe: true, zugScore: 0, zuege: [0, 0] };
  match = new Wiedergabe(a, game.makeFx(names), [me, opp]);
  game.attach(match, hud);
  paused = false;
  hudEl.hidden = false;
  $('#trainBox').classList.remove('on');
  $('#scoreboard').style.display = match.mode === 'match' ? '' : 'none';
  $('#hint').textContent = `${STEUERUNG_NAME[K.steuerung] || K.steuerung} · Stufe ${K.stufe} · Laufhilfe ${K.laufhilfe}`;
  wgMal = K.tempoMal || 1; wgKey = '';
  wgBox.classList.add('on');
  hud.update();
};
function wiedergabeEnde() {
  if (!session || !session.wiedergabe) return;
  endMatch();
  enterMenu();
  actions.rekorder();
}
// Der Kasten unten bei der Wiedergabe: was gerade passiert ist, dazu Knöpfe für Punkt zurück/vor und das Tempo
function wgFrame() {
  const m = match, P = m.punkt;
  const key = [m.i, m.zeilen.length, wgMal, paused].join('|');
  if (key === wgKey) return;
  wgKey = key;
  const zeilen = m.zeilen.slice(-4).map((z, i, l) => `<div class="${i === l.length - 1 ? 'neu' : ''}">${esc(z)}</div>`).join('');
  const tempo = [0.25, 0.5, 1, 2].map((t) => `<button class="${Math.abs(wgMal - t) < 0.13 ? 'an' : ''}" data-a="wgTempo" data-v="${t}">${t === 0.25 ? '¼' : t === 0.5 ? '½' : t}×</button>`).join('');
  wgBox.innerHTML = `<div class="wgText"><b>Punkt ${P ? P.nr : m.anzahl} von ${m.anzahl}</b>${zeilen}</div>
    <div class="wgKnopf"><button data-a="wgPunkt" data-v="-1">⏮</button><button data-a="wgPunkt" data-v="0">↺</button><button data-a="wgPunkt" data-v="1">⏭</button>${tempo}<button data-a="wgAus">✕</button></div>`;
}
actions.wgPunkt = (v) => { if (match && match.wiedergabe) { match.springe(match.i + (+v)); hud.update(); } };
actions.wgTempo = (v) => { wgMal = +v; };
actions.wgAus = () => wiedergabeEnde();

// Für Tests: das Spiel von Hand um n Bilder weiterdrehen
function step(n = 60) {
  for (let i = 0; i < n; i++) {
    if (match && !paused && !einlaufAn()) { controls.update(1 / 60); match.update(1 / 60); }
    game.frame(1 / 60);
    gelaendeFrame();
    gelaendeTon(1 / 60);
    hudFrame(1 / 60);
  }
}
// iPad/iPhone: Wechselt man zu einer anderen App oder sperrt den Bildschirm, macht das Spiel Pause.
// Kommt man zurück, wird der Ton wieder aufgeweckt (iOS hält ihn sonst an).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (match && !paused) togglePause(); if (sound.ctx) sound.ctx.suspend(); }      // im Hintergrund ist das Spiel still
  else if (sound.ctx) sound.unlock();
});

// ---------------------------------------------------------------
// Menüs mit dem Controller bedienen (z. B. wenn das Spiel auf dem Fernseher läuft)
// ---------------------------------------------------------------
// Ein Knopf ist "ausgewählt" (gelber Rahmen, Klasse .fokus). Der Stick springt zum nächsten Knopf
// in der gedrückten Richtung, A drückt den Knopf, B drückt "Zurück".
function menuTaste(was) {
  // Einlaufszene: A = nächster Teil, B = gleich zum Match
  if (einlaufAn() && !paused && (was === 'ok' || was === 'zurueck')) return einlaufTipp(was === 'zurueck');
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

// ---- Handy als Schläger über einen QR-Code (handyschlaeger.js, Idee aus dem Rennspiel: Handy als Lenkrad).
// Das Handy schickt seine Bewegung, das Spiel behandelt es wie einen Controller mit Bewegungssensor.
const handy = new SchlaegerEmpfang();
let handyDa = false;
const HANDY_TEXT = { aus: '', laden: '⏳ Verbindung wird vorbereitet …', bereit: '📡 Wartet auf dein Handy …', fehler: '⚠️ Kein Internet oder der Vermittler antwortet nicht – der QR-Code geht gerade nicht.' };
const handyText = () => (handy.status === 'verbunden' ? `✅ ${handy.geraet || 'Handy'} ist verbunden. Schwinge einmal zur Probe!` : HANDY_TEXT[handy.status] || '');
handy.wennDaten = (d) => {
  if (d.t !== 's') return;
  window.__powershotPad({ name: `${handy.geraet || 'Handy'} als Schläger`, lx: 0, ly: 0, motion: d.m || null, x: !!d.x, y: !!d.y, netz: !!d.netz, pause: !!d.pause });
};
handy.wennStatus = (st) => {
  if (st === 'verbunden' && !handyDa) {
    handyDa = true;
    // Geschwungen wird in der Steuerung „Controller“ – die stellen wir gleich ein
    if (settings.control !== 'controller') { settings.control = 'controller'; saveSettings(); controls.setMode('controller'); if (match) match.cfg.controlMode = 'controller'; }
  } else if (st !== 'verbunden' && handyDa) { handyDa = false; window.__powershotPadWeg(); }
  const el = document.getElementById('handyStatus');
  if (el) el.textContent = handyText();
  const c = document.getElementById('handyCode');
  if (c) c.textContent = handy.code || '';
};
// Das Handy darf kurz anzeigen (und rütteln), wenn das Spiel einen Schwung erkannt hat
controls.onSchwung = (kraft) => { if (handyDa) handy.senden({ t: 'schwung', hart: kraft > 0.7 }); };
actions.handySchlaeger = () => {
  handy.start();
  show(`<div class="bar">${back('settings')}<h2>📱 Handy als Schläger</h2></div>
    <div class="panel" style="text-align:center">
      <p>Scanne den Code mit der Kamera deines Handys. Es öffnet sich eine Seite – dort auf <b>„Los geht’s“</b> tippen und „Bewegung“ erlauben.</p>
      <canvas id="handyQr" width="264" height="264" style="width:220px;height:220px;border-radius:12px"></canvas>
      <p>Oder am Handy <b>kvb1982.github.io/Powershot/schlaeger.html</b> öffnen und diesen Code eintippen: <b id="handyCode" style="font-size:26px;letter-spacing:4px;color:var(--accent)">${handy.code || ''}</b></p>
      <p id="handyStatus" style="font-weight:600">${handyText()}</p>
      <p class="dim" style="font-size:13px;text-align:left">So geht es: Das Handy fest halten wie einen Schlägergriff (mit Hülle, am besten mit Schlaufe ums Handgelenk!) und schwingen, wenn der Ball kommt.
        Früh schwingen = cross, spät = longline. Von unten nach oben = Topspin, von oben nach unten = Slice, fest = hart. Lob, Stoppball und „Ans Netz“ sind Knöpfe auf dem Handy.
        Die Steuerung stellt sich von selbst auf „Controller“, am besten mit Laufhilfe „Voll“ – dann läuft deine Figur von allein.
        Beide Geräte brauchen Internet (nur für den ersten Kontakt). Mit dem iPhone geht es auch ohne Internet über die Powershot-App.</p>
    </div>`);
  qrMalen(document.getElementById('handyQr'), handy.adresse());
};

// Controller: Die Pause-Taste hält das Spiel an. Die iOS-App meldet den Controller über diese beiden Funktionen.
controls.onPause = () => togglePause();
window.__powershotPad = (s) => { controls.nativePad = true; controls.setPad(s); };
window.__powershotPadWeg = () => { controls.nativePad = false; controls.padWeg(); };

window.__powershot = { game, controls, settings, step, kameraLauf, kameraBild, get match() { return match; }, get career() { return career; }, get season() { return season; }, actions, rekorder: { speicher: RS, get laeuft() { return rek; }, get letzte() { return rekLetzte; } }, karte: gKarte, handy, foto: { start: fotoStart, knips: fotoKnips, ende: fotoEnde } };
// Das Spielermodell laden (höchstens 8 Sekunden warten – sonst geht es mit den einfachen Figuren los)
await Promise.race([Promise.all([loadFigure(), loadMocap(), loadGang(), ladeRequisiten()]), new Promise((r) => setTimeout(r, 8000))]);
$('#loading').remove();
actions.home();
requestAnimationFrame(loop);
