// Powershot – Hauptprogramm: Menüs, Abläufe (Freies Spiel, Turnier, Karriere, Training), Anzeige im Spiel

import { Sound } from './audio.js';
import { Game3D } from './game3d.js';
import { Controls } from './controls.js';
import { Match } from './match.js';
import { loadFigure } from './figur.js';
import { loadMocap } from './mocap.js';
import * as D from './data.js';
import * as TN from './tournament.js';
import * as CA from './career.js';

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
}, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* egal */ } };

const CONTROL_NAMES = { klassik: 'Klassik (Maus)', touch: 'Touch (iPad)', profi: 'Profi (Tastatur)' };
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
const screen = $('#screen'), hudEl = $('#hud');

let match = null, paused = false, session = null;
let career = CA.loadCareer();
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

// ---------------------------------------------------------------
// Bausteine für die Menüs
// ---------------------------------------------------------------
function statBars(st) {
  return Object.keys(D.STAT_NAMES).map((k) =>
    `<div class="stat"><span>${D.STAT_NAMES[k]}</span><i><b style="width:${st[k]}%"></b></i><span>${st[k]}</span></div>`).join('');
}
function playerCard(p, act, sel) {
  return `<button class="pcard ${sel ? 'sel' : ''}" data-a="${act}" data-v="${p.id}">
    <div class="nm">${flag(p.country)} ${esc(p.name)}</div>
    <div class="meta"><span>${p.me ? 'Dein Karriere-Spieler' : 'Nr. ' + p.rank}</span><span>Stärke ${D.overall(p.stats)}</span></div>
    ${statBars(p.stats)}</button>`;
}
function optionRow(label, key, names) {
  return `<label>${label}</label><div class="row">${Object.keys(names).map((k) =>
    `<button class="${settings[key] === k ? 'sel' : ''}" data-a="set" data-v="${key}:${k}">${names[k]}</button>`).join('')}</div>`;
}
const catTag = (def) => `<span class="tag ${def.cat === 'GS' ? 'gs' : def.cat === 'M' ? 'm' : 'f'}">${def.catName}</span>`;
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

const HELP = `
  <div class="panel help"><h3>Touch (iPad / Handy)</h3><ul>
    <li><b>Linke Bildschirmhälfte:</b> Finger auflegen und ziehen = laufen (Joystick). Ohne Finger läuft dein Spieler von allein zum Ball.</li>
    <li><b>Rechte Hälfte, nach oben wischen:</b> Schlag. Nach links/rechts wischen = Richtung. Je länger der Wisch, desto härter und tiefer. Zu lang = Aus!</li>
    <li><b>Nach unten wischen:</b> Stoppball. <b>Zur Seite wischen:</b> Slice. <b>Doppelt tippen:</b> Lob. <b>Einmal tippen:</b> sicherer Ball.</li>
    <li><b>Aufschlag:</b> nach oben wischen (Richtung und Länge wie beim Schlag).</li>
    <li>Du kannst wischen, sobald der Gegner geschlagen hat. Der Schlag kommt, wenn der Ball bei dir ist.</li></ul></div>
  <div class="panel help"><h3>Klassik (Maus)</h3><ul>
    <li><kbd>Mausrad</kbd> oder <kbd>←</kbd> <kbd>→</kbd>: zielen (Rad hoch = links).</li>
    <li><kbd>Linke Maustaste halten</kbd>: Kraft aufladen. Im roten Bereich geht der Ball ins Aus.</li>
    <li><kbd>Doppelklick</kbd> oder <kbd>rechte Maustaste</kbd>: Lob.</li>
    <li><kbd>↑</kbd> <kbd>↓</kbd>: ans Netz / zurück. Seitlich läuft dein Spieler von allein.</li>
    <li><b>Aufschlag:</b> Kraft aufladen und loslassen.</li></ul></div>
  <div class="panel help"><h3>Profi (Tastatur)</h3><ul>
    <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> oder Pfeiltasten: laufen. Stell die Laufhilfe auf „Aus“ für das volle Erlebnis.</li>
    <li><kbd>Leertaste</kbd>/<kbd>J</kbd>: Topspin · <kbd>K</kbd>: Slice · <kbd>L</kbd>: Lob · <kbd>I</kbd>: Stoppball. Halten = mehr Kraft.</li>
    <li>Die Richtungstasten, die du <b>beim Treffen</b> hältst, bestimmen das Ziel: links/rechts = Ecke, hoch = lang, runter = kurz.</li>
    <li><b>Aufschlag:</b> Leertaste halten und loslassen, mit links/rechts zielen. Zu lange halten = Fehler.</li></ul></div>
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
const pname = (T, id, bold) => {
  const p = T.players[id];
  return `<span class="${id === T.humanId ? 'me' : ''} ${bold ? 'w' : ''}">${flag(p.country)} ${esc(p.short)} <small class="dim">(${p.seed})</small></span>`;
};
function renderTournament() {
  const { T, def } = ctxT;
  menuVenue = def.id;
  enterMenu();
  const m = TN.humanMatch(T);
  const label = TN.currentLabel(T);
  let top;
  if (T.done) {
    const pay = T.humanId ? TN.payout(T, T.humanId) : null;
    top = `<div class="panel center"><h2 class="gold">🏆 ${esc(T.players[T.champion].name)}</h2>
      <p>gewinnt ${def.name}${T.champion === T.humanId ? ' – das bist du! Glückwunsch!' : '.'}</p>
      ${pay && pay.label ? `<p class="dim">Dein Ergebnis: ${D.ROUND_NAMES[pay.label]}</p>` : ''}
      <button class="primary" data-a="tourDone">Weiter</button></div>`;
  } else if (m) {
    const oppId = m.a === T.humanId ? m.b : m.a;
    const opp = getPlayer(oppId), me = getPlayer(T.humanId);
    top = `<div class="panel"><div class="center dim">${D.ROUND_NAMES[label]}${m.group != null ? ' · Gruppe ' + 'AB'[m.group] : ''}</div>
      <div class="vs"><div><div class="who">${flag(me.country)} ${esc(me.short)}</div><div class="dim">Stärke ${D.overall(me.stats)}</div></div>
      <div class="x">gegen</div>
      <div><div class="who">${flag(opp.country)} ${esc(opp.short)}</div><div class="dim">Nr. ${T.players[oppId].seed} der Setzliste · Stärke ${D.overall(opp.stats)}</div></div></div>
      <div class="center"><button class="primary" data-a="tourPlay">Match spielen ›</button></div></div>`;
  } else {
    top = `<div class="panel center"><p>${T.humanId ? 'Du bist ausgeschieden.' : 'Du spielst dieses Turnier nicht mit.'}</p>
      <button class="primary" data-a="tourSim">Turnier zu Ende spielen lassen</button></div>`;
  }
  let groups = '';
  if (T.format === 'finals') {
    groups = `<div class="cols">${T.groups.map((g, gi) => `<div class="panel"><h3 style="margin-top:0">Gruppe ${'AB'[gi]}</h3><table>
      <tr><th>Spieler</th><th class="num">Siege</th><th class="num">Sätze</th></tr>
      ${[...g].sort((x, y) => T.rr[y].wins - T.rr[x].wins || T.rr[y].sets - T.rr[x].sets).map((id) => `<tr class="${id === T.humanId ? 'me' : ''}"><td>${pname(T, id)}</td><td class="num">${T.rr[id].wins}</td><td class="num">${T.rr[id].sets > 0 ? '+' : ''}${T.rr[id].sets}</td></tr>`).join('')}
      </table></div>`).join('')}</div>`;
  }
  const rounds = T.rounds.map((r, i) => ({ r, l: T.labels[i], i })).reverse().map(({ r, l, i }) => `
    <div class="panel"><h3 style="margin-top:0">${D.ROUND_NAMES[l]}${l === 'RR' ? ' · Spieltag ' + (i + 1) : ''}</h3>
    ${r.map((x) => `<div class="match"><span>${pname(T, x.a, x.winner === x.a)} – ${pname(T, x.b, x.winner === x.b)}</span><span class="sc">${x.winner ? esc(x.score) : '–'}</span></div>`).join('')}</div>`).join('');
  show(`<div class="bar"><h2>${def.name} ${catTag(def)}</h2><span class="dim">${def.city} · ${D.SURFACE_NAMES[def.surface]}</span></div>${top}${groups}${rounds}`);
}
actions.tourPlay = () => {
  const { T, def } = ctxT;
  const m = TN.humanMatch(T);
  const oppId = m.a === T.humanId ? m.b : m.a;
  const roundIdx = T.rounds.length;
  startMatch({
    me: getPlayer(T.humanId), opp: getPlayer(oppId), def, title: `${def.name} · ${D.ROUND_NAMES[TN.currentLabel(T)]}`,
    onEnd: (res) => {
      TN.playRound(T, { winner: res.won ? T.humanId : oppId, score: res.score, setDiff: res.setDiff });
      if (ctxT.career) {
        const ups = CA.addXp(career, res.won ? 60 + 25 * roundIdx : 25);
        CA.saveCareer(career);
        if (ups) return showInfo('Level ' + career.level + '!', 'Du hast 3 neue Fähigkeitspunkte bekommen. Verteile sie im Karriere-Menü unter „Fähigkeiten“.', 'tourShow');
      }
      renderTournament();
    },
  });
};
actions.tourShow = () => renderTournament();
actions.tourSim = () => { TN.simulateRest(ctxT.T); if (ctxT.career) CA.saveCareer(career); renderTournament(); };
actions.tourDone = () => {
  if (!ctxT.career) return actions.home();
  const s = CA.finishTournament(career);
  const lines = [
    s.label ? `Dein Ergebnis: <b>${D.ROUND_NAMES[s.label]}</b>` : 'Du hast nicht teilgenommen.',
    `Ranglistenpunkte: <b>${s.points}</b> · Preisgeld: <b class="gold">${money(s.money)}</b>`,
    `Du stehst jetzt auf <b>Platz ${s.rank}</b> der Weltrangliste.`,
  ];
  if (s.seasonOver) lines.push(`<b>Die Saison ist zu Ende!</b> Weiter geht es mit der Saison ${career.season}.`);
  if (s.money > 0) sound.coin();
  showInfo(s.name, lines.join('<br>'), 'career');
};

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
  if (['start', 'kalender', 'rangliste', 'skills', 'shop'].includes(v)) careerTab = v;
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
    <p class="dim">Du startest auf Platz 101 der Weltrangliste mit 50.000 $ und 10 Fähigkeitspunkten.</p>
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

function renderCareer() {
  const c = career, me = CA.mePlayer(c), rk = CA.myRank(c), def = CA.nextTournament(c);
  const tabs = [['start', 'Übersicht'], ['kalender', 'Kalender'], ['rangliste', 'Weltrangliste'], ['skills', 'Fähigkeiten' + (c.skillPoints ? ' ●' : '')], ['shop', 'Ausrüstung']];
  let body = '';
  if (careerTab === 'start') {
    const qual = CA.qualified(c, def);
    body = `
      <div class="panel"><div class="kpi">
        <div><b>${rk}.</b><span>Weltrangliste</span></div>
        <div><b>${CA.ranking(c).find((p) => p.me).points}</b><span>Punkte</span></div>
        <div><b class="gold">${money(c.money)}</b><span>Preisgeld</span></div>
        <div><b>Level ${c.level}</b><span>${c.xp} / ${CA.xpNeed(c.level)} Erfahrung</span></div>
        <div><b>${c.titles}</b><span>Titel</span></div>
      </div></div>
      <div class="cols">
        <div class="panel"><div class="dim">Saison ${c.season} · Turnier ${c.week + 1} von ${D.TOURNAMENTS.length}</div>
          <h2 style="margin:6px 0">${def.name}</h2>
          <p>${catTag(def)} · ${def.city} · ${def.month} · ${D.SURFACE_NAMES[def.surface]}</p>
          <p class="dim">${def.cat === 'F' ? 'Nur die besten 8 der Weltrangliste. ' + (qual ? 'Du bist dabei!' : 'Du bist diesmal nicht qualifiziert.') : def.draw + ' Spieler · Sieger: ' + def.points.W + ' Punkte, ' + money(def.money.W)}</p>
          <div class="row"><button class="primary" data-a="careerPlay">${qual ? 'Turnier spielen ›' : 'Turnier ansehen ›'}</button>
          ${qual ? '<button data-a="careerSkip">Auslassen</button>' : ''}</div></div>
        <div class="panel">${playerCard(me, 'career', false)}
          <div class="row" style="margin-top:10px"><button class="grow" data-a="training" data-v="career" ${c.trainingLeft <= 0 ? 'disabled' : ''}>Training (${c.trainingLeft} übrig)</button></div>
          ${c.skillPoints ? `<p class="gold">Du hast ${c.skillPoints} Fähigkeitspunkte zu verteilen!</p>` : ''}</div>
      </div>`;
  } else if (careerTab === 'kalender') {
    const done = Object.fromEntries(c.history.filter((h) => h.season === c.season).map((h) => [h.tid, h]));
    body = `<div class="panel scroll"><table><tr><th>Monat</th><th>Turnier</th><th>Belag</th><th>Dein Ergebnis</th><th class="num">Punkte</th></tr>
      ${D.TOURNAMENTS.map((t, i) => `<tr class="${i === c.week ? 'me' : ''}"><td>${t.month}</td><td>${t.name} ${catTag(t)}</td><td>${D.SURFACE_NAMES[t.surface]}</td>
        <td>${done[t.id] ? (done[t.id].label ? D.ROUND_NAMES[done[t.id].label] : '–') : i === c.week ? 'als Nächstes' : ''}</td><td class="num">${done[t.id] ? done[t.id].points : ''}</td></tr>`).join('')}
      </table></div>`;
  } else if (careerTab === 'rangliste') {
    const list = CA.ranking(c);
    const rows = list.filter((p) => p.rank <= 30 || Math.abs(p.rank - rk) <= 4);
    body = `<div class="panel scroll"><table><tr><th class="num">Platz</th><th>Spieler</th><th class="num">Punkte</th></tr>
      ${rows.map((p, i) => `${i > 0 && rows[i - 1].rank < p.rank - 1 ? '<tr><td colspan="3" class="dim center">…</td></tr>' : ''}
        <tr class="${p.me ? 'me' : ''}"><td class="num">${p.rank}</td><td>${flag(p.country)} ${esc(p.name)}</td><td class="num">${p.points.toLocaleString('de-DE')}</td></tr>`).join('')}
      </table></div>`;
  } else if (careerTab === 'skills') {
    const eff = CA.effectiveStats(c);
    body = `<div class="panel"><p>Freie Fähigkeitspunkte: <b class="gold">${c.skillPoints}</b> · Level ${c.level}. Punkte gibt es für jedes neue Level (Matches und Training bringen Erfahrung).</p>
      <table>${Object.keys(D.STAT_NAMES).map((k) => `<tr><td><b>${D.STAT_NAMES[k]}</b><br><small class="dim">${SKILL_INFO[k]}</small></td>
        <td style="width:40%"><div class="stat" style="grid-template-columns:1fr 60px"><i><b style="width:${eff[k]}%"></b></i><span>${c.skills[k]}${eff[k] > c.skills[k] ? ' <span class="gold">+' + (eff[k] - c.skills[k]) + '</span>' : ''}</span></div></td>
        <td class="right"><button data-a="skill" data-v="${k}" ${c.skillPoints <= 0 || c.skills[k] >= 95 ? 'disabled' : ''}>+1</button></td></tr>`).join('')}</table></div>`;
  } else if (careerTab === 'shop') {
    body = `<p>Dein Geld: <b class="gold">${money(c.money)}</b></p>` + D.SHOP_CATS.map((cat) => `<div class="panel"><h3 style="margin-top:0">${cat}</h3><div class="grid">
      ${D.SHOP.filter((s) => s.cat === cat).map((s) => {
        const own = c.owned.includes(s.id), on = c.equipped[cat] === s.id;
        const bonus = Object.entries(s.bonus).map(([k, v]) => `+${v} ${D.STAT_NAMES[k]}`).join(', ');
        return `<div class="panel" style="margin:0"><b>${s.name}</b><br><small class="gold">${bonus}</small><br>
          ${own ? `<button class="${on ? 'sel' : ''}" data-a="equip" data-v="${s.id}" style="margin-top:8px">${on ? '✓ Ausgerüstet' : 'Ausrüsten'}</button>`
            : `<button data-a="buy" data-v="${s.id}" style="margin-top:8px" ${c.money < s.price ? 'disabled' : ''}>Kaufen · ${money(s.price)}</button>`}</div>`;
      }).join('')}</div></div>`).join('');
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
actions.careerPlay = () => { ctxT = { T: CA.startTournament(career), def: CA.nextTournament(career), career: true }; renderTournament(); };
actions.careerSkip = () => {
  const T = CA.startTournament(career);
  T.humanId = null;
  TN.simulateRest(T);
  ctxT = { T, def: D.tournamentById(T.defId), career: true };
  renderTournament();
};
let delArmed = false;
actions.careerDelete = (v, el) => {
  if (!delArmed) { delArmed = true; el.textContent = 'Wirklich löschen? Nochmal tippen'; setTimeout(() => { delArmed = false; }, 4000); return; }
  delArmed = false;
  CA.deleteCareer(); career = null; actions.home();
};

// ---------------------------------------------------------------
// Match starten, Anzeige, Pause, Ergebnis
// ---------------------------------------------------------------
// o: { me, opp, def, mode, title, onEnd(res) }
function startMatch(o) {
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
  }, game.makeFx(names), controls);
  game.attach(match, hud);
  paused = false;
  hudEl.hidden = false;
  $('#trainBox').classList.toggle('on', mode !== 'match');
  $('#scoreboard').style.display = mode === 'match' ? '' : 'none';
  $('#hint').textContent = {
    touch: 'Links: laufen · Rechts: nach oben wischen = Schlag · unten = Stopp · Doppeltipp = Lob',
    klassik: 'Mausrad/←→ zielen · Linke Taste halten = Kraft · Doppelklick = Lob · ↑↓ laufen',
    profi: 'WASD laufen · Leertaste Topspin · K Slice · L Lob · I Stopp · Richtung beim Treffen halten',
  }[settings.control];
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
    toastTimer = 1.6;
  },
  serveSpeed(kmh) {
    const s = $('#speed');
    s.textContent = kmh + ' km/h'; s.classList.add('on');
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

function hudFrame(dt) {
  if (hudEl.hidden) return;
  const off = (t, el) => { if (t > 0 && t - dt <= 0) el.classList.remove('on'); return t - dt; };
  msgTimer = off(msgTimer, $('#msg'));
  toastTimer = off(toastTimer, $('#toast'));
  speedTimer = off(speedTimer, $('#speed'));
  const h = controls.hud(), bar = $('#power');
  const myTurn = match && ((match.state === 'serveReady' && match.server === 0) || (match.state === 'rally' && match.ball.lastHitter === 1));
  const on = h.show && myTurn && !session.over && h.type !== 'lob';
  bar.classList.toggle('on', !!on);
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
  if (match && !paused) {
    controls.update(dt);
    match.update(dt);
  }
  game.frame(match && paused ? 0 : dt);
  hudFrame(dt);
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

window.__powershot = { game, controls, settings, step, get match() { return match; }, get career() { return career; }, actions };
// Das Spielermodell laden (höchstens 8 Sekunden warten – sonst geht es mit den einfachen Figuren los)
await Promise.race([Promise.all([loadFigure(), loadMocap()]), new Promise((r) => setTimeout(r, 8000))]);
$('#loading').remove();
actions.home();
requestAnimationFrame(loop);
