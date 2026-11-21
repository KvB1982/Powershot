// Powershot – Die Mini-Spiele für die Aufgaben vom Team (Turniergelände).
//
// Jedes Mini-Spiel läuft in einem eigenen Fenster über dem Gelände und wird mit einfachen Strichen und Formen gemalt
// (2D, kein three.js). Am Ende kommt eine Note heraus: 0 = gar nicht geschafft, 1 = perfekt.
// Was die Note bringt, steht in aufgaben.js – hier wird nur gespielt.
//
//   nachmachen = Warmmachen: Der Trainer macht Übungen vor, du machst sie in derselben Reihenfolge nach
//   hochhalten = den Ball mit dem Schläger in der Luft halten
//   kraft      = Krafttraining: gedrückt halten zum Heben, im grünen Feld loslassen
//   massage    = harte Stellen finden und locker reiben
//   buffet     = den richtigen Teller zusammenstellen
//   bespannen  = Saiten flechten (drüber, drunter) und auf das richtige Gewicht ziehen
//   autogramm  = mit dem Finger unterschreiben
//   quiz       = Tennis-Fragen (Fragen in quiz.js)
//   presse     = Pressekonferenz (Fragen in turniertag.js)
//   dehnen     = eine Dehnung ruhig halten
//
// Bedienung: überall Finger ODER Maus; dazu Tasten (Leertaste, Pfeile, 1–4), wo es passt.
// Alle Zahlen (Zeiten, Größen der Felder, Tempo) sind geschätzt und stehen bei jedem Spiel oben.
import { ziehe, THEMEN } from './quiz.js';
import { FRAGEN as PRESSE_FRAGEN, ANTWORT_SATZ } from './turniertag.js';

const W = 900, H = 540, BODEN = 450;      // so groß ist die Malfläche (wird passend zum Bildschirm verkleinert), BODEN = Höhe des Fußbodens
const begrenzen = (x, a, b) => Math.max(a, Math.min(b, x));
const misch = (a, b, t) => a + (b - a) * t;
const P2 = (a, b, t) => [misch(a[0], b[0], t), misch(a[1], b[1], t)];

// ---------- Das Fenster ----------
let el = null, bild = null, g = null, textEl = null, knopfEl = null, infoEl = null;
let spiel = null, laeuft = false, zuletzt = 0, fertigRuf = null, klang = { gut() {}, tipp() {} };
let farbe = '#37c3ff';                   // Trikotfarbe der eigenen Figur
export function klaenge(k) { klang = { ...klang, ...k }; }

function bauen() {
  if (el) return;
  el = document.createElement('div');
  el.id = 'mini';
  el.innerHTML = '<div class="kasten"><div class="kopf"><b class="titel"></b><span class="info"></span><button class="ghost" data-mini="ab">✕ Abbrechen</button></div><canvas width="1800" height="1080"></canvas><div class="text"></div><div class="knoepfe"></div></div>';
  document.body.appendChild(el);
  bild = el.querySelector('canvas'); g = bild.getContext('2d');
  textEl = el.querySelector('.text'); knopfEl = el.querySelector('.knoepfe'); infoEl = el.querySelector('.info');
  // Wo auf der Malfläche ist der Finger? (umgerechnet auf 900 × 540)
  const ort = (e) => { const r = bild.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  // Nichts davon darf beim Gelände darunter ankommen – sonst läuft die Figur los
  for (const n of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'wheel', 'touchmove', 'contextmenu']) el.addEventListener(n, (e) => e.stopPropagation());
  bild.addEventListener('pointerdown', (e) => { e.preventDefault(); try { bild.setPointerCapture(e.pointerId); } catch (x) { /* macht nichts */ } if (laeuft && spiel.unten) spiel.unten(...ort(e)); });
  bild.addEventListener('pointermove', (e) => { if (laeuft && spiel.zieh) spiel.zieh(...ort(e), e.buttons > 0 || e.pointerType === 'touch'); });
  for (const n of ['pointerup', 'pointercancel']) bild.addEventListener(n, (e) => { if (laeuft && spiel.hoch) spiel.hoch(...ort(e)); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mini === 'ab') return schluss({ abbruch: true });
    if (b.dataset.nr != null && knopfRuf) knopfRuf(+b.dataset.nr);
  });
  // Knöpfe zum Gedrückt-Halten (Krafttraining, Bespannen)
  knopfEl.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-halten]'); if (b && laeuft && spiel.taste) { e.preventDefault(); spiel.taste('Space', true); } });
  for (const n of ['pointerup', 'pointercancel', 'pointerleave']) knopfEl.addEventListener(n, (e) => { if (e.target.closest('[data-halten]') && laeuft && spiel.taste) spiel.taste('Space', false); });
  // Tasten: nur solange ein Mini-Spiel offen ist. Sie kommen dann nicht mehr beim Gelände an.
  const taste = (e, runter) => {
    if (!el.classList.contains('on')) return;
    e.stopImmediatePropagation();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (runter && e.repeat) return;
    // Eingabetaste = der gelbe Knopf (Los geht's, Weiter, Nächste Frage)
    const gelb = knopfEl.querySelector('button.primary');
    if (runter && gelb && (e.code === 'Enter' || (e.code === 'Space' && !laeuft))) return gelb.click();
    if (laeuft && spiel.taste) spiel.taste(e.code, runter);
  };
  addEventListener('keydown', (e) => taste(e, true), true);
  addEventListener('keyup', (e) => taste(e, false), true);
}

// Knöpfe unter der Malfläche: liste = [Text, …] oder [[Text, 'primary' | 'halten'], …]; ruf(nummer) wird beim Drücken aufgerufen
let knopfRuf = null;
function knoepfe(liste, ruf) {
  knopfRuf = ruf;
  knopfEl.innerHTML = liste.map((k, i) => { const [t, art] = Array.isArray(k) ? k : [k, '']; return `<button class="${art === 'primary' ? 'primary' : ''}" ${art === 'halten' ? 'data-halten="1"' : `data-nr="${i}"`}>${t}</button>`; }).join('');
}
const text = (html) => { textEl.innerHTML = html; };
const info = (t) => { infoEl.textContent = t; };
const sterne = (note) => (note >= 0.75 ? '⭐⭐⭐' : note >= 0.4 ? '⭐⭐' : '⭐');

function schluss(ergebnis) {
  laeuft = false; spiel = null;
  el.classList.remove('on');
  const f = fertigRuf; fertigRuf = null;
  if (f) f(ergebnis);
}
// Das Spiel ist vorbei: Ergebnis zeigen, dann zurück aufs Gelände
function ende(note, satz, dazu = {}) {
  if (!laeuft) return;
  laeuft = false;
  note = begrenzen(note, 0, 1);
  if (note >= 0.4) klang.gut();
  el.classList.add('fertig');
  text(`<div class="sterne">${sterne(note)}</div><p>${satz}</p>`);
  knoepfe([['Weiter ›', 'primary']], () => schluss({ note, ...dazu }));
}

function schleife(jetzt) {
  if (!laeuft) return;
  const dt = begrenzen((jetzt - zuletzt) / 1000, 0, 0.05);
  zuletzt = jetzt;
  schritt(dt);
  requestAnimationFrame(schleife);
}
// Ein Stück Zeit weiterrechnen und malen (auch von Hand aufrufbar: window.__mini.schritt, für Tests im Browser)
function schritt(dt) {
  if (!laeuft || !spiel) return;
  if (spiel.malen) {
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
  }
  spiel.bild(dt);
}

// Ein Mini-Spiel starten. art = Name (siehe oben) · opt = { titel, auftrag, wer, farbe, … } · fertig({ note } oder { abbruch: true })
export function starte(art, opt, fertig) {
  bauen();
  const bauer = SPIELE[art];
  if (!bauer) return fertig({ abbruch: true });
  fertigRuf = fertig;
  farbe = opt.farbe || '#37c3ff';
  const S = bauer(opt);
  spiel = S; laeuft = false;
  el.className = 'on vor' + (S.malen ? '' : ' ohneBild');
  el.querySelector('.titel').textContent = opt.titel || S.titel;
  info('');
  if (S.malen) { g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, W, H); }
  text(`${opt.auftrag ? `<p class="auftrag"><b>${opt.wer || 'Dein Team'}:</b> „${opt.auftrag}“</p>` : ''}<p>${S.hilfe}</p>`);
  knoepfe([['Los geht’s!', 'primary']], () => {
    el.classList.remove('fertig', 'vor');
    laeuft = true; zuletzt = performance.now();
    text(''); knoepfe([], null);
    S.start();
    requestAnimationFrame(schleife);
  });
  if (typeof window !== 'undefined') window.__mini = { get spiel() { return spiel; }, get laeuft() { return laeuft; }, schritt };
}
export const offen = () => !!el && el.classList.contains('on');

// ---------- Malen: Strichfigur ----------
// Ein Arm oder Bein aus zwei Teilen von a nach b. Wo das Gelenk dazwischen hinkommt, wird ausgerechnet (seite = +1 oder −1: wohin es knickt).
function glied(a, b, l1, l2, seite) {
  let dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.01;
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const w = Math.atan2(dy, dx), k = Math.acos(begrenzen((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const j = [a[0] + Math.cos(w + seite * k) * l1, a[1] + Math.sin(w + seite * k) * l1];
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(j[0], j[1]); g.lineTo(a[0] + dx, a[1] + dy); g.stroke();
}
// Eine Figur malen. F = { hueft, schulter, kopf (wenn es fehlt: über der Schulter), handL, handR, fussL, fussR, knie, ell } – alles [x, y]
const BEIN = 48, ARM = 36;
function figur(F, trikot = farbe) {
  const kopf = F.kopf || [F.schulter[0] + (F.schulter[0] - F.hueft[0]) * 0.32, F.schulter[1] + (F.schulter[1] - F.hueft[1]) * 0.32];
  g.lineWidth = 12;
  g.strokeStyle = '#cf9f78';                                    // Beine
  glied(F.hueft, F.fussL, BEIN, BEIN, F.knie ?? -1); glied(F.hueft, F.fussR, BEIN, BEIN, F.knie2 ?? F.knie ?? -1);
  g.fillStyle = '#f2f5fb';                                      // Schuhe
  for (const f of [F.fussL, F.fussR]) { g.beginPath(); g.ellipse(f[0] + 5, f[1] - 2, 13, 7, 0, 0, 7); g.fill(); }
  g.strokeStyle = '#e8b48a';                                    // Arme
  g.lineWidth = 9;
  if (F.handL) glied(F.schulter, F.handL, ARM, ARM, F.ell ?? 1);
  g.strokeStyle = trikot; g.lineWidth = 20;                     // Trikot
  g.beginPath(); g.moveTo(F.hueft[0], F.hueft[1]); g.lineTo(F.schulter[0], F.schulter[1]); g.stroke();
  g.fillStyle = '#27324d'; g.beginPath(); g.arc(F.hueft[0], F.hueft[1], 13, 0, 7); g.fill();   // Hose
  g.strokeStyle = '#e8b48a'; g.lineWidth = 9;
  if (F.handR) glied(F.schulter, F.handR, ARM, ARM, F.ell2 ?? F.ell ?? 1);
  g.fillStyle = '#e8b48a'; g.beginPath(); g.arc(kopf[0], kopf[1], 17, 0, 7); g.fill();
}
// Die Figur steht einfach da (x = wo, u = wie weit die Füße auseinander)
const stehen = (x, u = 14) => ({ hueft: [x, BODEN - 94], schulter: [x, BODEN - 164], handL: [x - 26, BODEN - 96], handR: [x + 26, BODEN - 96], fussL: [x - u, BODEN], fussR: [x + u, BODEN], knie: -1 });
function boden(farbeBoden = '#2b3a5c') { g.fillStyle = farbeBoden; g.fillRect(0, BODEN + 6, W, H - BODEN); }
function schrift(t, x, y, gr = 22, f = '#f2f5fb', wo = 'center') { g.font = `600 ${gr}px system-ui, sans-serif`; g.textAlign = wo; g.fillStyle = f; g.fillText(t, x, y); }
function rund(x, y, b, h, r) { g.beginPath(); g.roundRect(x, y, b, h, r); }
// Ein Zeitbalken oben (rest von gesamt Sekunden)
function zeitBalken(rest, gesamt) {
  g.fillStyle = 'rgba(255,255,255,.12)'; rund(20, 14, W - 40, 10, 5); g.fill();
  g.fillStyle = rest < gesamt * 0.25 ? '#ff6b5a' : '#e8f04a'; rund(20, 14, (W - 40) * begrenzen(rest / gesamt, 0, 1), 10, 5); g.fill();
}

const SPIELE = {};

// =====================================================================
// Warmmachen: Übungen nachmachen
// =====================================================================
const WARM_RUNDEN = [3, 4, 5];           // so lang sind die drei Folgen
const WARM_ZEIGT = 0.85;                 // so viele Sekunden zeigt der Trainer jede Übung
const UEBUNGEN = [
  { name: 'Hampelmann', bild: '🤸', pose(x, s) { const f = stehen(x, 12 + 30 * s); const y = -8 * s; f.hueft[1] += y; f.schulter[1] += y; f.handL = [x - 30 - 18 * s, BODEN - 96 - 130 * s]; f.handR = [x + 30 + 18 * s, BODEN - 96 - 130 * s]; f.ell = -1; f.ell2 = 1; return f; } },
  { name: 'Kniebeuge', bild: '🦵', pose(x, s) { const f = stehen(x, 18); f.hueft = [x - 14 * s, BODEN - 94 + 40 * s]; f.schulter = [x + 4 * s, f.hueft[1] - 68]; f.handL = f.handR = [x + 62, f.schulter[1] + 4]; f.knie = -1; return f; } },
  { name: 'Knie hoch', bild: '🏃', pose(x, s, t) { const f = stehen(x, 8); const l = Math.max(0, Math.sin(t * 9)), r = Math.max(0, -Math.sin(t * 9)); f.fussL = [x + 6 + 22 * l, BODEN - 62 * l]; f.fussR = [x + 6 + 22 * r, BODEN - 62 * r]; f.handL = [x + 24 * r - 6, BODEN - 110 - 26 * r]; f.handR = [x + 24 * l - 6, BODEN - 110 - 26 * l]; f.knie = -1; return f; } },
  { name: 'Arme kreisen', bild: '🔄', pose(x, s, t) { const f = stehen(x); const w = t * 6; f.handL = [x - 8 + Math.cos(w) * 66, BODEN - 164 + Math.sin(w) * 66]; f.handR = [x + 8 + Math.cos(w + 3.14) * 66, BODEN - 164 + Math.sin(w + 3.14) * 66]; return f; } },
];
SPIELE.nachmachen = () => {
  let runde = 0, folge = [], zeige = 0, t = 0, dran = 'trainer', nr = 0, richtig = 0, meine = -1, meineT = 9, pause = 0, falsch = 0;
  const gesamt = WARM_RUNDEN.reduce((a, b) => a + b, 0);
  const neueRunde = () => { folge = Array.from({ length: WARM_RUNDEN[runde] }, () => Math.floor(Math.random() * 4)); for (let i = 1; i < folge.length; i++) if (folge[i] === folge[i - 1]) folge[i] = (folge[i] + 1) % 4; dran = 'trainer'; zeige = 0; t = -0.6; nr = 0; knoepfe([], null); };
  const tipp = (i) => {
    if (dran !== 'du' || pause > 0) return;
    meine = i; meineT = 0; klang.tipp();
    if (i === folge[nr]) { richtig++; nr++; if (nr >= folge.length) { pause = 0.9; falsch = 0; } }
    else { falsch = 1; pause = 1.1; }
  };
  return {
    titel: 'Warmmachen', malen: true, get zustand() { return { dran, folge, nr, pause }; },
    hilfe: 'Die Trainerin macht eine Folge von Übungen vor. Merk sie dir – und mach sie dann <b>in derselben Reihenfolge</b> nach (Knöpfe unten oder Tasten 1 bis 4). Es gibt drei Folgen, jede ist eine Übung länger.',
    start: neueRunde,
    taste(code, runter) { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code); if (runter && i >= 0) tipp(i); },
    bild(dt) {
      t += dt; meineT += dt;
      boden();
      if (dran === 'trainer') {
        if (t > WARM_ZEIGT) { t = 0; zeige++; if (zeige >= folge.length) { dran = 'du'; knoepfe(UEBUNGEN.map((u, i) => `${u.bild} ${u.name} <small>${i + 1}</small>`), tipp); } }
      } else if (pause > 0) {
        pause -= dt;
        if (pause <= 0) { runde++; if (runde >= WARM_RUNDEN.length) return ende(richtig / gesamt, `${richtig} von ${gesamt} Übungen richtig nachgemacht.`); neueRunde(); }
      }
      // Links die Trainerin, rechts du
      const zeigt = dran === 'trainer' && t >= 0 && zeige < folge.length ? UEBUNGEN[folge[zeige]] : null;
      const s = Math.sin(Math.min(1, Math.max(0, t) / WARM_ZEIGT) * Math.PI);
      figur(zeigt ? zeigt.pose(270, s, t) : stehen(270), '#e86a9a');
      const ich = meine >= 0 && meineT < 0.6 ? UEBUNGEN[meine].pose(630, Math.sin(meineT / 0.6 * Math.PI), meineT) : stehen(630);
      figur(ich);
      schrift('Trainerin', 270, BODEN + 40, 18, '#9fb0cc'); schrift('Du', 630, BODEN + 40, 18, '#9fb0cc');
      if (zeigt) schrift(`${zeigt.bild} ${zeigt.name}`, 270, 120, 30, '#e8f04a');
      schrift(dran === 'trainer' ? 'Schau genau hin …' : falsch ? '✗ Das war die falsche Übung!' : nr >= folge.length ? '✓ Super!' : `Jetzt du! Übung ${nr + 1} von ${folge.length}`, W / 2, 60, 26, falsch && dran === 'du' ? '#ff6b5a' : '#f2f5fb');
      // Kleine Punkte: wie weit bist du in der Folge?
      for (let i = 0; i < folge.length; i++) { g.fillStyle = dran === 'du' && i < nr ? '#4ade80' : dran === 'trainer' && i <= zeige && t >= 0 ? '#e8f04a' : 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(W / 2 + (i - (folge.length - 1) / 2) * 30, 90, 8, 0, 7); g.fill(); }
      info(`Folge ${Math.min(runde + 1, 3)} von 3 · richtig: ${richtig}`);
    },
  };
};

// =====================================================================
// Ball hochhalten
// =====================================================================
const HOCH_ZIEL = 30;                    // so viele Berührungen sind perfekt
const HOCH_BAELLE = 3;                   // so oft darf der Ball herunterfallen
const SCHWERE = 950;                     // so stark zieht es den Ball nach unten (Bildpunkte pro Sekunde²)
SPIELE.hochhalten = () => {
  let x = W / 2, xAlt = W / 2, vSchl = 0, ball, n = 0, rest = HOCH_BAELLE, links = false, rechts = false, blitz = 0, wort = '';
  const SY = 440, BREIT = 74;
  const neu = () => { ball = { x: x + (Math.random() - 0.5) * 60, y: 90, vx: 0, vy: 0 }; };
  return {
    titel: 'Ball hochhalten', malen: true, get zustand() { return { ball, x, n, rest }; },
    hilfe: `Schieb den Schläger mit dem Finger oder der Maus unter den Ball (oder Pfeiltasten ← →). Triffst du den Ball mit der <b>Mitte</b> des Schlägers, springt er gerade hoch. Am Rand springt er zur Seite weg! Ziel: <b>${HOCH_ZIEL} Berührungen</b>. Du hast ${HOCH_BAELLE} Bälle.`,
    start: neu,
    zieh(px) { x = begrenzen(px, 50, W - 50); },
    unten(px) { x = begrenzen(px, 50, W - 50); },
    taste(code, runter) { if (code === 'ArrowLeft') links = runter; if (code === 'ArrowRight') rechts = runter; },
    bild(dt) {
      if (links) x = Math.max(50, x - 620 * dt);
      if (rechts) x = Math.min(W - 50, x + 620 * dt);
      vSchl = misch(vSchl, (x - xAlt) / Math.max(dt, 0.001), 0.3); xAlt = x;
      ball.vy += SCHWERE * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < 14) { ball.x = 14; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - 14) { ball.x = W - 14; ball.vx = -Math.abs(ball.vx); }
      const ab = ball.x - x;
      if (ball.vy > 0 && ball.y + 14 >= SY - 6 && ball.y + 14 <= SY + 26 && Math.abs(ab) < BREIT + 8) {
        const rand = Math.abs(ab) > BREIT * 0.72;
        ball.vy = -(rand ? 470 : 600) - Math.random() * 50;
        ball.vx = ab * (rand ? 6.5 : 3.6) + begrenzen(vSchl, -500, 500) * 0.22 + (Math.random() - 0.5) * (50 + n * 5);
        ball.y = SY - 20; n++; blitz = 0.2; wort = rand ? 'Rahmen!' : Math.abs(ab) < 16 ? 'Mitte!' : '';
        klang.tipp();
        if (n >= HOCH_ZIEL) return ende(1, `${HOCH_ZIEL} Berührungen – perfektes Ballgefühl!`);
      }
      if (ball.y > H + 40) { rest--; if (rest <= 0) return ende(n / HOCH_ZIEL, `${n} von ${HOCH_ZIEL} Berührungen.`); neu(); }
      blitz -= dt;
      // malen: Schläger von der Seite (Griff nach rechts unten), Ball, Zähler
      boden('#24507a');
      g.strokeStyle = '#c8ccd4'; g.lineWidth = 8; g.beginPath(); g.moveTo(x + BREIT, SY + 4); g.lineTo(x + BREIT + 70, SY + 26); g.stroke();
      g.strokeStyle = blitz > 0 ? '#e8f04a' : '#f2f5fb'; g.lineWidth = 7; g.beginPath(); g.ellipse(x, SY, BREIT, 9, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x, SY, BREIT, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#d8ee3a'; g.beginPath(); g.arc(ball.x, ball.y, 14, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(ball.x - 9, ball.y, 12, -0.9, 0.9); g.stroke();
      schrift(String(n), W / 2, 130, 90, 'rgba(255,255,255,.22)');
      if (blitz > 0 && wort) schrift(wort, x, SY - 40, 22, wort === 'Mitte!' ? '#4ade80' : '#ff6b5a');
      info(`Berührungen: ${n} von ${HOCH_ZIEL} · Bälle: ${'🎾'.repeat(rest)}`);
    },
  };
};

// =====================================================================
// Krafttraining
// =====================================================================
const KRAFT_WDH = 4;                     // Wiederholungen je Übung
const KRAFT_UEBUNGEN = 3;                // so viele Übungen
const KRAFT_FELD = [0.15, 0.13, 0.11, 0.09];   // Größe des grünen Felds bei Wiederholung 1 bis 4 (es wird kleiner, weil du müde wirst)
// Jede Übung malt Gerät und Figur. p = 0 (unten) … 1 (ganz oben)
const scheibe = (x, y, r = 26) => { g.fillStyle = '#1a1f2e'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#8a93a8'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); };
const KRAFT = [
  { name: 'Bankdrücken', tipp: 'Brust und Arme: Du liegst auf der Bank und drückst die Stange nach oben.', mal(p) {
    const x = 400;
    g.fillStyle = '#5a6478'; rund(x - 110, BODEN - 62, 230, 14, 6); g.fill(); g.fillRect(x - 90, BODEN - 50, 10, 50); g.fillRect(x + 90, BODEN - 50, 10, 50);
    g.fillRect(x - 96, BODEN - 170, 8, 170);                    // Ständer für die Stange
    const hand = [x - 34, BODEN - 112 - 70 * p];
    figur({ kopf: [x - 96, BODEN - 82], hueft: [x + 40, BODEN - 74], schulter: [x - 66, BODEN - 76], handL: hand, handR: hand, fussL: [x + 104, BODEN], fussR: [x + 122, BODEN], knie: -1, ell: 1 });
    scheibe(hand[0], hand[1], 28);
  } },
  { name: 'Kreuzheben', tipp: 'Beine und Rücken: Heb die Stange vom Boden, bis du gerade stehst. Der Rücken bleibt gerade!', mal(p) {
    const x = 400, hueft = P2([x - 34, BODEN - 66], [x, BODEN - 94], p), schulter = P2([x + 26, BODEN - 108], [x, BODEN - 164], p), hand = P2([x + 30, BODEN - 34], [x + 12, BODEN - 82], p);
    figur({ hueft, schulter, handL: hand, handR: hand, fussL: [x - 6, BODEN], fussR: [x + 18, BODEN], knie: -1, ell: -1 });
    scheibe(hand[0], hand[1], 34);
  } },
  { name: 'Kniebeuge mit Stange', tipp: 'Beine: Die Stange liegt auf den Schultern. Aus der Hocke drückst du dich nach oben.', mal(p) {
    const x = 400, hueft = P2([x - 26, BODEN - 52], [x, BODEN - 94], p), schulter = P2([x + 8, BODEN - 114], [x, BODEN - 164], p);
    g.fillStyle = '#5a6478'; g.fillRect(x - 130, BODEN - 200, 8, 200); g.fillRect(x - 138, BODEN - 176, 24, 6);
    const hand = [schulter[0] + 16, schulter[1] + 2];
    figur({ hueft, schulter, handL: hand, handR: hand, fussL: [x - 8, BODEN], fussR: [x + 16, BODEN], knie: -1, ell: 1 });
    scheibe(schulter[0] - 4, schulter[1] - 6, 34);
  } },
  { name: 'Beinpresse', tipp: 'Beine: Du sitzt an der Maschine und drückst die Platte mit den Füßen weg.', mal(p) {
    const x = 340, platte = x + 96 + 62 * p;
    g.strokeStyle = '#5a6478'; g.lineWidth = 12; g.beginPath(); g.moveTo(x - 20, BODEN - 34); g.lineTo(x - 78, BODEN - 130); g.stroke();   // Lehne
    g.fillStyle = '#5a6478'; rund(x - 30, BODEN - 40, 70, 14, 6); g.fill(); g.fillRect(x - 60, BODEN - 12, 330, 12);                      // Sitz und Schiene
    g.fillStyle = '#8a93a8'; rund(platte, BODEN - 120, 14, 100, 5); g.fill();                                                           // Fußplatte
    for (let i = 0; i < 4; i++) { g.fillStyle = '#1a1f2e'; rund(platte + 20 + i * 14, BODEN - 104, 10, 70, 3); g.fill(); }               // Gewichte
    figur({ hueft: [x, BODEN - 52], schulter: [x - 50, BODEN - 112], handL: [x + 4, BODEN - 34], handR: [x + 4, BODEN - 34], fussL: [platte, BODEN - 92], fussR: [platte, BODEN - 64], knie: -1, ell: -1 });
  } },
  { name: 'Schulterdrücken mit Hanteln', tipp: 'Schultern: Drück die beiden Hanteln von den Schultern gerade nach oben. Gut für den Aufschlag!', mal(p) {
    const x = 400, f = stehen(x, 20);
    f.handL = [x - 44 + 8 * p, BODEN - 172 - 78 * p]; f.handR = [x + 44 - 8 * p, BODEN - 172 - 78 * p]; f.ell = 1; f.ell2 = -1;
    figur(f);
    for (const h of [f.handL, f.handR]) { g.strokeStyle = '#8a93a8'; g.lineWidth = 5; g.beginPath(); g.moveTo(h[0] - 18, h[1]); g.lineTo(h[0] + 18, h[1]); g.stroke(); scheibe(h[0] - 18, h[1], 11); scheibe(h[0] + 18, h[1], 11); }
  } },
];
SPIELE.kraft = () => {
  const reihe = KRAFT.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, KRAFT_UEBUNGEN);
  let ue = 0, wdh = 0, p = 0, haelt = false, lage = 'unten', sauber = 0, wort = '', wortGut = false, tempo = 1, t = 0, warte = 0;
  const feld = () => { const b = KRAFT_FELD[wdh] || 0.09; return [0.97 - b, 0.97]; };
  const neu = () => { p = 0; lage = 'unten'; tempo = 0.62 + Math.random() * 0.55; t = 0; };
  const los = () => { if (lage === 'unten' && warte <= 0) { lage = 'hoch'; klang.tipp(); } };
  const lassen = () => {
    if (lage !== 'hoch') return;
    const [a, b] = feld();
    wortGut = p >= a && p <= b;
    wort = wortGut ? 'Sauber gehoben!' : p < a ? 'Zu früh abgesetzt!' : 'Zu weit – verwackelt!';
    if (wortGut) { sauber++; klang.gut(); }
    lage = 'runter';
  };
  return {
    titel: 'Krafttraining', malen: true, get zustand() { return { p, feld: feld(), lage, sauber }; },
    hilfe: `<b>Gedrückt halten</b> (Finger, Maus oder Leertaste) = heben. Lass los, wenn der Zeiger rechts im <b>grünen Feld</b> ist – dann war die Wiederholung sauber. Zu früh loslassen oder zu weit drücken zählt nicht. ${KRAFT_UEBUNGEN} Übungen mit je ${KRAFT_WDH} Wiederholungen. Jede Wiederholung geht anders schnell!`,
    start() { neu(); knoepfe([['🏋️ Heben (gedrückt halten)', 'halten']], null); },
    unten() { haelt = true; los(); },
    hoch() { haelt = false; lassen(); },
    taste(code, runter) { if (code !== 'Space') return; haelt = runter; if (runter) los(); else lassen(); },
    bild(dt) {
      t += dt; warte -= dt;
      if (haelt) los();                          // wer schon in der kurzen Pause drückt, hebt gleich danach los
      const U = KRAFT[reihe[ue]];
      if (lage === 'hoch') {
        p += tempo * (0.75 + 0.5 * Math.sin(t * 4.5) ** 2) * dt;      // mal schneller, mal langsamer – wie ein echter Muskel
        if (p >= 1.03) { p = 1.03; haelt = false; lassen(); }
      } else if (lage === 'runter') {
        p -= 1.9 * dt;
        if (p <= 0) {
          wdh++; warte = 0.25;
          if (wdh >= KRAFT_WDH) { wdh = 0; ue++; if (ue >= reihe.length) return ende(sauber / (KRAFT_WDH * KRAFT_UEBUNGEN), `${sauber} von ${KRAFT_WDH * KRAFT_UEBUNGEN} Wiederholungen sauber.`); }
          neu();
        }
      }
      boden('#3a3340');
      U.mal(begrenzen(p, 0, 1));
      schrift(U.name, 40, 70, 30, '#e8f04a', 'left'); schrift(U.tipp, 40, 100, 16, '#9fb0cc', 'left');
      if (wort) schrift(wort, 40, 140, 22, wortGut ? '#4ade80' : '#ff6b5a', 'left');
      // rechts der Balken mit dem grünen Feld
      const bx = 760, by = 130, bh = 300, [a, b] = feld();
      g.fillStyle = 'rgba(255,255,255,.12)'; rund(bx, by, 46, bh, 12); g.fill();
      g.fillStyle = '#3ecf6e'; g.fillRect(bx, by + bh * (1 - b), 46, bh * (b - a));
      g.fillStyle = '#ff6b5a'; g.fillRect(bx, by, 46, bh * (1 - b));
      g.fillStyle = '#fff'; rund(bx - 10, by + bh * (1 - begrenzen(p, 0, 1)) - 4, 66, 8, 4); g.fill();
      schrift('oben', bx + 23, by - 12, 15, '#9fb0cc'); schrift('unten', bx + 23, by + bh + 22, 15, '#9fb0cc');
      info(`Übung ${ue + 1} von ${reihe.length} · Wiederholung ${Math.min(wdh + 1, KRAFT_WDH)} von ${KRAFT_WDH} · sauber: ${sauber}`);
    },
  };
};

// =====================================================================
// Massage: harte Stellen locker reiben
// =====================================================================
const MASSAGE_STELLEN = 6;               // so viele harte Stellen gibt es
const MASSAGE_ZEIT = 32;                 // Sekunden
const MASSAGE_REIBEN = 1300;              // so viele Bildpunkte muss man über einer Stelle hin und her reiben
const STELLEN = [['Nacken', 235, 270], ['Schulter links', 290, 215], ['Schulter rechts', 290, 325], ['Rücken oben', 350, 270], ['Rücken unten', 440, 270], ['Oberschenkel links', 570, 232], ['Oberschenkel rechts', 570, 308], ['Wade links', 700, 236], ['Wade rechts', 700, 304]];
SPIELE.massage = () => {
  const reihe = STELLEN.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, MASSAGE_STELLEN);
  let offen = [], naechste = 0, fertig = 0, rest = MASSAGE_ZEIT, alt = null, t = 0, locker = [];
  const nach = () => { while (offen.length < 2 && naechste < reihe.length) offen.push({ nr: reihe[naechste++], weg: 0 }); };
  const reib = (x, y, drueckt) => {
    if (!drueckt) { alt = null; return; }
    if (alt) {
      const d = Math.hypot(x - alt[0], y - alt[1]);
      for (const s of offen) if (Math.hypot(x - STELLEN[s.nr][1], y - STELLEN[s.nr][2]) < 46) s.weg += d;
    }
    alt = [x, y];
  };
  return {
    titel: 'Massage', malen: true, get zustand() { return { offen: offen.map((s) => STELLEN[s.nr].slice(1)), fertig }; },
    hilfe: `Auf der Liege liegt dein Spieler. Die <b>roten Stellen</b> sind verspannt. Reibe mit dem Finger (oder mit gedrückter Maustaste) über einer roten Stelle <b>hin und her</b>, bis sie grün wird. Schaffst du alle ${MASSAGE_STELLEN} Stellen in ${MASSAGE_ZEIT} Sekunden?`,
    start: nach,
    unten(x, y) { alt = [x, y]; },
    zieh: reib,
    hoch() { alt = null; },
    bild(dt) {
      t += dt; rest -= dt;
      for (const s of offen.slice()) if (s.weg >= MASSAGE_REIBEN) { offen.splice(offen.indexOf(s), 1); locker.push(s.nr); fertig++; klang.gut(); nach(); }
      if (fertig >= MASSAGE_STELLEN) return ende(1, `Alle ${MASSAGE_STELLEN} Stellen sind locker – und noch ${Math.ceil(rest)} Sekunden übrig!`);
      if (rest <= 0) return ende(fertig / MASSAGE_STELLEN, `${fertig} von ${MASSAGE_STELLEN} Stellen gelockert.`);
      // Liege und Spieler von oben (Kopf links)
      g.fillStyle = '#1f6f66'; rund(120, 150, 680, 240, 30); g.fill();
      g.fillStyle = '#f2f5fb'; rund(140, 222, 70, 96, 20); g.fill();                    // Kissen
      g.strokeStyle = '#e8b48a'; g.lineWidth = 34;
      g.beginPath(); g.moveTo(300, 200); g.lineTo(420, 172); g.moveTo(300, 340); g.lineTo(420, 368); g.stroke();   // Arme
      g.lineWidth = 46; g.beginPath(); g.moveTo(500, 236); g.lineTo(760, 240); g.moveTo(500, 304); g.lineTo(760, 300); g.stroke();   // Beine
      g.fillStyle = '#e8b48a'; rund(250, 196, 250, 148, 46); g.fill();                  // Rücken
      g.fillStyle = '#27324d'; rund(470, 204, 70, 132, 24); g.fill();                   // Hose
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.arc(196, 270, 36, 0, 7); g.fill();     // Hinterkopf
      for (const nr of locker) { const [, x, y] = STELLEN[nr]; g.fillStyle = 'rgba(74,222,128,.55)'; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); schrift('✓', x, y + 8, 22, '#fff'); }
      for (const s of offen) {
        const [name, x, y] = STELLEN[s.nr], puls = 30 + 5 * Math.sin(t * 6);
        g.fillStyle = 'rgba(255,90,70,.75)'; g.beginPath(); g.arc(x, y, puls, 0, 7); g.fill();
        g.strokeStyle = '#4ade80'; g.lineWidth = 7; g.beginPath(); g.arc(x, y, 40, -1.57, -1.57 + 6.283 * begrenzen(s.weg / MASSAGE_REIBEN, 0, 1)); g.stroke();
        schrift(name, x, y - 52, 17);
      }
      zeitBalken(rest, MASSAGE_ZEIT);
      info(`locker: ${fertig} von ${MASSAGE_STELLEN} · noch ${Math.ceil(rest)} s`);
    },
  };
};

// =====================================================================
// Buffet: den richtigen Teller zusammenstellen
// =====================================================================
const BUFFET_ZEIT = 40;                  // Sekunden
const TELLER = 5;                        // so viel passt auf den Teller
// [Bild, Name, Kohlenhydrate ⚡, Eiweiß 💪, Fett 🧈, Trinken 💧] – die Zahlen sind grob geschätzt (0 = nichts, 4 = sehr viel)
const ESSEN = [
  ['🍝', 'Nudeln', 4, 1, 0, 0], ['🍚', 'Reis', 4, 0, 0, 0], ['🍞', 'Brot', 3, 0, 0, 0], ['🥔', 'Kartoffeln', 3, 0, 0, 0], ['🍌', 'Banane', 2, 0, 0, 0],
  ['🍗', 'Hähnchen', 0, 4, 1, 0], ['🐟', 'Fisch', 0, 4, 1, 0], ['🥚', 'Ei', 0, 2, 1, 0], ['🥛', 'Quark', 0, 3, 0, 0], ['🥗', 'Salat', 1, 0, 0, 0],
  ['🍔', 'Burger', 2, 2, 4, 0], ['🍟', 'Pommes', 2, 0, 4, 0], ['🍕', 'Pizza', 3, 1, 3, 0], ['🍰', 'Torte', 2, 0, 4, 0], ['🍫', 'Schokolade', 1, 0, 3, 0],
  ['💧', 'Wasser', 0, 0, 0, 2], ['🧃', 'Saftschorle', 1, 0, 0, 2],
];
// Was soll auf den Teller? mind = mindestens so viel, max = höchstens so viel
const TELLER_ZIEL = {
  vor: [['⚡ Kohlenhydrate', 2, 8, null], ['💪 Eiweiß', 3, 2, null], ['🧈 Fett', 4, null, 2], ['💧 Trinken', 5, 2, null]],
  nach: [['⚡ Kohlenhydrate', 2, 5, null], ['💪 Eiweiß', 3, 7, null], ['🧈 Fett', 4, null, 2], ['💧 Trinken', 5, 2, null]],
};
SPIELE.buffet = (opt) => {
  const ziel = TELLER_ZIEL[opt.phase === 'nach' ? 'nach' : 'vor'];
  let band = [], teller = [], rest = BUFFET_ZEIT, naechstes = 0, sack = [];
  const summe = (spalte) => teller.reduce((s, e) => s + e[spalte], 0);
  const erfuellt = () => ziel.map(([, sp, mind, max]) => (mind == null || summe(sp) >= mind) && (max == null || summe(sp) <= max));
  const schluss = () => {
    const ok = erfuellt(), n = ok.filter(Boolean).length;
    const fehlt = ziel.filter((z, i) => !ok[i]).map((z) => z[0].slice(2) + (z[3] != null ? ' (zu viel)' : ' (zu wenig)'));
    ende(teller.length ? n / ziel.length : 0, n === ziel.length ? 'Perfekter Teller! Alles im grünen Bereich.' : `${n} von ${ziel.length} Zielen erreicht. Nicht gepasst: ${fehlt.join(', ')}.`);
  };
  const knopf = () => knoepfe([[`Fertig – guten Appetit! (${teller.length} von ${TELLER} auf dem Teller)`, 'primary']], schluss);
  return {
    titel: 'Am Buffet', malen: true, get zustand() { return { band: band.map((b) => [b.x, b.essen[1]]), teller: teller.map((e) => e[1]), ok: erfuellt() }; },
    hilfe: `Das Essen fährt auf dem Band vorbei. <b>Tippe an</b>, was auf deinen Teller soll (es passen ${TELLER} Sachen drauf). Unter jedem Essen steht, was drin ist: ⚡ Kohlenhydrate (Energie), 💪 Eiweiß (für die Muskeln), 🧈 Fett, 💧 Trinken. Oben siehst du, ob dein Teller passt: Der Balken muss <b>im grünen Bereich</b> sein. Etwas Falsches erwischt? Tippe es auf dem Teller an, dann kommt es wieder weg.`,
    start() { knopf(); },
    unten(x, y) {
      // Etwas vom Band nehmen …
      const e = band.find((b) => Math.hypot(x - b.x, y - 262) < 50);
      if (e && teller.length < TELLER) { band.splice(band.indexOf(e), 1); teller.push(e.essen); klang.tipp(); knopf(); return; }
      // … oder etwas vom Teller zurücklegen
      const i = Math.floor((x - (W / 2 - TELLER * 45)) / 90);
      if (y > 400 && i >= 0 && i < teller.length) { teller.splice(i, 1); klang.tipp(); knopf(); }
    },
    bild(dt) {
      rest -= dt; naechstes -= dt;
      if (rest <= 0) return schluss();
      if (naechstes <= 0) {
        if (!sack.length) sack = ESSEN.slice().sort(() => Math.random() - 0.5);      // jedes Essen kommt einmal vorbei, dann von vorn
        band.push({ essen: sack.pop(), x: W + 60 }); naechstes = 0.85;
      }
      for (const b of band) b.x -= 135 * dt;
      band = band.filter((b) => b.x > -70);
      // Ziele oben: Balken mit grünem Bereich
      const ok = erfuellt();
      ziel.forEach(([name, sp, mind, max], i) => {
        const x = 40 + i * 215, wert = summe(sp), voll = 12;
        schrift(name, x, 58, 16, ok[i] ? '#4ade80' : '#f2f5fb', 'left');
        g.fillStyle = 'rgba(255,255,255,.12)'; rund(x, 68, 190, 16, 8); g.fill();
        g.fillStyle = 'rgba(74,222,128,.35)'; g.fillRect(x + 190 * (mind || 0) / voll, 68, 190 * ((max ?? voll) - (mind || 0)) / voll, 16);
        g.fillStyle = ok[i] ? '#4ade80' : '#ff8a5a'; rund(x, 71, Math.max(6, 190 * Math.min(wert, voll) / voll), 10, 5); g.fill();
      });
      // das Band
      g.fillStyle = '#3a4258'; rund(0, 200, W, 150, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 12; i++) g.fillRect(((i * 90 - (BUFFET_ZEIT - rest) * 135) % (W + 90) + W + 90) % (W + 90) - 45, 200, 4, 150);
      for (const b of band) {
        const [bildE, name, k, e, f, w] = b.essen;
        g.fillStyle = '#f2f5fb'; g.beginPath(); g.arc(b.x, 256, 42, 0, 7); g.fill();
        g.font = '46px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(bildE, b.x, 273);
        schrift(name, b.x, 318, 15);
        schrift([k && `⚡${k}`, e && `💪${e}`, f && `🧈${f}`, w && `💧${w}`].filter(Boolean).join(' '), b.x, 338, 14, '#e8f04a');
      }
      // der Teller unten
      g.fillStyle = '#e8ecf4'; rund(W / 2 - TELLER * 45 - 14, 400, TELLER * 90 + 28, 100, 50); g.fill();
      for (let i = 0; i < TELLER; i++) {
        const x = W / 2 - TELLER * 45 + 45 + i * 90;
        if (teller[i]) { g.font = '50px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(teller[i][0], x, 468); }
        else { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.arc(x, 450, 30, 0, 7); g.stroke(); g.setLineDash([]); }
      }
      zeitBalken(rest, BUFFET_ZEIT);
      info(`${opt.phase === 'nach' ? 'Essen nach dem Match' : 'Essen vor dem Match'} · noch ${Math.ceil(rest)} s`);
    },
  };
};

// =====================================================================
// Besaitungsmaschine: flechten und spannen
// =====================================================================
const QUER = 6, LAENGS = 8;              // so viele Quersaiten flichst du durch so viele Längssaiten
const FLECHT_ZEIT = 28;                  // bis dahin gibt es keinen Abzug für die Zeit (Sekunden)
const SPANN_SAITEN = 4;                  // so viele Saiten ziehst du auf das richtige Gewicht
SPIELE.bespannen = (opt) => {
  const zielKg = opt.kg || 22 + Math.floor(Math.random() * 5);
  let teil = 'flechten', reihe = 0, nr = 0, fehler = 0, zeit = 0, rot = 0, gemacht = [];   // gemacht[reihe] = wie viele Kreuzungen fertig
  let saite = 0, kg = 8, haelt = false, spannT = 0, punkte = 0, wort = '', wortGut = 0, warte = 0, tempo = 1;
  const drueber = (r, i) => (r + i) % 2 === 0;                  // die Regel: immer abwechselnd, und jede Reihe fängt anders an
  const MX = 330, MY = 250, lx = (i) => MX + (i - (LAENGS - 1) / 2) * 34, qy = (r) => MY + (r - (QUER - 1) / 2) * 50;
  const flecht = (oben) => {
    if (teil !== 'flechten') return;
    if (oben === drueber(reihe, nr)) {
      klang.tipp(); nr++;
      if (nr >= LAENGS) { gemacht[reihe] = LAENGS; reihe++; nr = 0; if (reihe >= QUER) { teil = 'spannen'; spannStart(); } }
    } else { fehler++; rot = 0.35; }
  };
  const spannStart = () => { kg = 8; haelt = false; spannT = 0; tempo = 0.8 + Math.random() * 0.6; knoepfe([['🔧 Hebel ziehen (gedrückt halten)', 'halten']], null); };
  let druck = false;                                             // ist der Hebel gerade gedrückt? (auch schon in der kurzen Pause)
  const spannLos = () => { if (teil === 'spannen' && warte <= 0 && !haelt && !wort) { haelt = true; spannT = 0; } };
  const spannLassen = () => {
    if (teil !== 'spannen' || !haelt) return;
    haelt = false;
    const ab = Math.abs(kg - zielKg), p = kg > 34.9 ? 0 : ab <= 0.5 ? 1 : ab <= 1.5 ? 0.6 : ab <= 3 ? 0.3 : 0;
    punkte += p; wortGut = p; wort = kg > 34.9 ? 'Peng – Saite gerissen!' : p === 1 ? `${kg.toFixed(1)} kg – genau richtig!` : `${kg.toFixed(1)} kg – ${kg < zielKg ? 'zu locker' : 'zu fest'}`;
    if (p >= 0.6) klang.gut();
    warte = 1.1;
  };
  return {
    titel: 'An der Besaitungsmaschine', malen: true, get zustand() { return { teil, drueber: drueber(reihe, nr), kg, zielKg, haelt, warte }; },
    hilfe: `<b>1. Flechten:</b> Die Quersaite muss abwechselnd <b>über</b> und <b>unter</b> den Längssaiten durch. Drücke bei jeder Kreuzung den richtigen Knopf (oder Pfeiltaste ↑ / ↓). Achtung: Jede neue Reihe fängt anders an als die Reihe davor!<br><b>2. Spannen:</b> Halte den Hebel gedrückt, bis die Anzeige <b>${zielKg} kg</b> zeigt, und lass genau dann los (${SPANN_SAITEN} Saiten).`,
    start() { knoepfe(['⬆ drüber', '⬇ drunter'], (i) => flecht(i === 0)); },
    unten() { druck = true; spannLos(); },
    hoch() { druck = false; spannLassen(); },
    taste(code, runter) {
      if (teil === 'flechten') { if (runter && code === 'ArrowUp') flecht(true); if (runter && code === 'ArrowDown') flecht(false); }
      else if (code === 'Space') { druck = runter; if (runter) spannLos(); else spannLassen(); }
    },
    bild(dt) {
      rot -= dt; warte -= dt;
      if (teil === 'spannen' && druck) spannLos();
      if (teil === 'flechten') zeit += dt;
      else if (haelt) { spannT += dt; kg += (4 + 9 * spannT) * tempo * dt; if (kg >= 35) { kg = 35; spannLassen(); } }
      else if (warte <= 0 && wort) {
        wort = ''; saite++;
        if (saite >= SPANN_SAITEN) {
          const a = begrenzen(1 - fehler * 0.07 - Math.max(0, zeit - FLECHT_ZEIT) * 0.025, 0, 1), b = punkte / SPANN_SAITEN;
          return ende(0.5 * a + 0.5 * b, `Flechten: ${fehler} Fehler in ${Math.round(zeit)} Sekunden. Spannen: ${Math.round(b * 100)} % genau.`);
        }
        spannStart();
      }
      // Die Maschine: Tisch, Klemmen und der Schlägerkopf
      g.fillStyle = '#4a5368'; rund(90, 420, 480, 26, 8); g.fill(); g.fillRect(300, 446, 60, 60);
      g.fillStyle = '#8a93a8'; rund(108, 236, 30, 28, 6); g.fill(); rund(522, 236, 30, 28, 6); g.fill();
      g.strokeStyle = '#e8f04a'; g.lineWidth = 12; g.beginPath(); g.ellipse(MX, MY, 185, 205, 0, 0, 7); g.stroke();
      g.strokeStyle = '#e8f04a'; g.lineWidth = 16; g.beginPath(); g.moveTo(MX, MY + 205); g.lineTo(MX, 520); g.stroke();
      const laenge = (x) => 205 * Math.sqrt(Math.max(0, 1 - ((x - MX) / 185) ** 2));
      const breite = (y) => 185 * Math.sqrt(Math.max(0, 1 - ((y - MY) / 205) ** 2));
      const laengs = (i, a, b) => { g.strokeStyle = '#f2f5fb'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx(i), a); g.lineTo(lx(i), b); g.stroke(); };
      for (let i = 0; i < LAENGS; i++) laengs(i, MY - laenge(lx(i)), MY + laenge(lx(i)));
      // Quersaiten: fertige Stücke malen; wo die Saite DRUNTER durchgeht, kommt die Längssaite noch einmal obendrauf
      for (let r = 0; r < QUER; r++) {
        const n = teil === 'spannen' ? LAENGS : r < reihe ? LAENGS : r === reihe ? nr : 0;
        if (!n && r !== reihe) continue;
        const y = qy(r), bis = n >= LAENGS ? MX + breite(y) : n ? lx(n - 1) + 17 : MX - breite(y) + 14;
        g.strokeStyle = '#ffb347'; g.lineWidth = 4; g.beginPath(); g.moveTo(MX - breite(y), y); g.lineTo(bis, y); g.stroke();
        for (let i = 0; i < n; i++) if (!drueber(r, i)) laengs(i, y - 9, y + 9);
      }
      if (teil === 'flechten') {
        // die Kreuzung, die gerade dran ist
        const x = lx(nr), y = qy(reihe);
        g.strokeStyle = rot > 0 ? '#ff6b5a' : '#37c3ff'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 15, 0, 7); g.stroke();
        schrift(`Reihe ${reihe + 1} von ${QUER}`, 720, 150, 26, '#e8f04a');
        schrift(nr === 0 ? `Diese Reihe beginnt mit „${drueber(reihe, 0) ? 'drüber' : 'drunter'}“` : 'Immer abwechselnd!', 720, 190, 18);
        schrift(rot > 0 ? '✗ Falsch herum!' : '', 720, 230, 22, '#ff6b5a');
        schrift(`Fehler: ${fehler}`, 720, 300, 18, '#9fb0cc'); schrift(`Zeit: ${Math.round(zeit)} s`, 720, 326, 18, zeit > FLECHT_ZEIT ? '#ff6b5a' : '#9fb0cc');
        info('Teil 1 von 2: Flechten');
      } else {
        // Anzeige der Maschine
        g.fillStyle = '#10141f'; rund(610, 110, 230, 110, 14); g.fill();
        schrift(kg.toFixed(1) + ' kg', 725, 185, 54, Math.abs(kg - zielKg) <= 0.5 ? '#4ade80' : '#e8f04a');
        schrift(`Ziel: ${zielKg} kg`, 725, 262, 26);
        g.fillStyle = 'rgba(255,255,255,.12)'; rund(620, 290, 210, 18, 9); g.fill();
        g.fillStyle = '#3ecf6e'; g.fillRect(620 + 210 * (zielKg - 0.5 - 8) / 27, 290, 210 * 1 / 27, 18);
        g.fillStyle = '#fff'; rund(620 + 210 * (kg - 8) / 27 - 3, 284, 6, 30, 3); g.fill();
        if (wort) schrift(wort, 725, 360, 22, wortGut === 1 ? '#4ade80' : wortGut ? '#e8f04a' : '#ff6b5a');
        info(`Teil 2 von 2: Spannen · Saite ${Math.min(saite + 1, SPANN_SAITEN)} von ${SPANN_SAITEN}`);
      }
    },
  };
};

// =====================================================================
// Autogramme mit dem Finger
// =====================================================================
const AUTO_KINDER = 6;                   // so viele Kinder warten
const AUTO_ZEIT = 48;                    // Sekunden
const AUTO_LANG = 260;                   // so viele Bildpunkte muss eine Unterschrift mindestens lang sein
const AUTO_WARTEN = 0.8;                 // so lange nach dem letzten Strich gilt die Unterschrift als fertig (Sekunden)
const NAMEN = ['Mia', 'Ben', 'Lina', 'Paul', 'Emma', 'Noah', 'Ida', 'Finn', 'Lea', 'Jonas', 'Marie', 'Elias', 'Sofia', 'Luis', 'Clara', 'Anton'];
// Was die Kinder hinhalten. feld = das weiße Feld zum Unterschreiben: [x, y, breit, hoch] (rund: true = Ellipse)
const SACHEN = [
  { name: 'einen riesigen Tennisball', feld: [310, 190, 280, 150], rund: true, mal() { g.fillStyle = '#d8ee3a'; g.beginPath(); g.arc(450, 265, 190, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(240, 265, 150, -0.75, 0.75); g.stroke(); g.beginPath(); g.arc(660, 265, 150, 3.14 - 0.75, 3.14 + 0.75); g.stroke(); } },
  { name: 'eine Kappe', feld: [330, 170, 240, 120], rund: true, mal() { g.fillStyle = '#2a5ac8'; g.beginPath(); g.arc(450, 290, 190, 3.14, 0); g.fill(); g.fillStyle = '#1f478f'; g.beginPath(); g.ellipse(450, 300, 260, 46, 0, 0, 3.14); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(450, 104, 12, 0, 7); g.fill(); } },
  { name: 'ein Foto', feld: [300, 350, 300, 90], mal() { g.fillStyle = '#fff'; rund(270, 80, 360, 380, 8); g.fill(); g.fillStyle = '#6aa8d8'; g.fillRect(290, 100, 320, 235); g.fillStyle = '#3a8a4a'; g.fillRect(290, 270, 320, 65); g.save(); g.translate(0, -160); figur(stehen(450)); g.restore(); } },
  { name: 'ein T-Shirt', feld: [345, 190, 210, 170], mal() { g.fillStyle = '#e8503a'; g.beginPath(); g.moveTo(320, 90); g.lineTo(200, 150); g.lineTo(240, 230); g.lineTo(310, 200); g.lineTo(310, 470); g.lineTo(590, 470); g.lineTo(590, 200); g.lineTo(660, 230); g.lineTo(700, 150); g.lineTo(580, 90); g.quadraticCurveTo(450, 150, 320, 90); g.fill(); } },
  { name: 'ein Heft', feld: [300, 140, 300, 260], mal() { g.fillStyle = '#3a4a6a'; rund(260, 70, 380, 410, 14); g.fill(); g.fillStyle = '#f4f2ec'; rund(280, 90, 340, 370, 6); g.fill(); g.strokeStyle = '#8a93a8'; g.lineWidth = 6; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(280, 120 + i * 52, 9, 0, 7); g.stroke(); } } },
  { name: 'einen kleinen Ball', feld: [390, 222, 120, 86], rund: true, mal() { g.fillStyle = '#d8ee3a'; g.beginPath(); g.arc(450, 265, 105, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(330, 265, 86, -0.7, 0.7); g.stroke(); g.beginPath(); g.arc(570, 265, 86, 3.14 - 0.7, 3.14 + 0.7); g.stroke(); } },
];
SPIELE.autogramm = () => {
  const namen = NAMEN.slice().sort(() => Math.random() - 0.5), sachen = Array.from({ length: AUTO_KINDER }, (_, i) => SACHEN[i % SACHEN.length]).sort(() => Math.random() - 0.5);
  sachen[AUTO_KINDER - 1] = SACHEN[5];                                 // zum Schluss kommt immer der kleine Ball – der ist am schwersten
  let nr = 0, striche = [], malt = false, still = 0, rest = AUTO_ZEIT, punkte = 0, gesichter = [], wechsel = 0;
  const drin = (S, x, y) => { const [fx, fy, fb, fh] = S.feld; return S.rund ? ((x - fx - fb / 2) / (fb / 2)) ** 2 + ((y - fy - fh / 2) / (fh / 2)) ** 2 <= 1 : x >= fx && x <= fx + fb && y >= fy && y <= fy + fh; };
  const laenge = () => striche.reduce((s, st) => s + st.reduce((l, p, i) => (i ? l + Math.hypot(p[0] - st[i - 1][0], p[1] - st[i - 1][1]) : 0), 0), 0);
  const werten = () => {
    const S = sachen[nr], pkt = striche.flat(), innen = pkt.filter((p) => drin(S, p[0], p[1])).length / Math.max(1, pkt.length);
    const p = innen >= 0.93 ? 1 : innen >= 0.7 ? 0.5 : 0;
    punkte += p; gesichter.push(p === 1 ? '😀' : p ? '🙂' : '😕');
    if (p) klang.gut();
    wechsel = 0.55;
  };
  return {
    titel: 'Autogramme', malen: true, get zustand() { return { nr, feld: sachen[Math.min(nr, AUTO_KINDER - 1)].feld, wechsel }; },
    hilfe: `${AUTO_KINDER} Kinder halten dir etwas hin. <b>Unterschreibe mit dem Finger</b> (oder mit gedrückter Maustaste) im <b>weißen Feld</b> – so, wie du wirklich unterschreiben würdest. Bleib im Feld! Wenn du kurz absetzt, ist die Unterschrift fertig und das nächste Kind ist dran. Du hast ${AUTO_ZEIT} Sekunden.`,
    start() {},
    unten(x, y) { if (wechsel <= 0) { malt = true; striche.push([[x, y]]); still = 0; } },
    zieh(x, y, drueckt) { if (malt && drueckt && wechsel <= 0) { striche[striche.length - 1].push([x, y]); still = 0; } },
    hoch() { malt = false; },
    bild(dt) {
      rest -= dt;
      if (wechsel > 0) { wechsel -= dt; if (wechsel <= 0) { nr++; striche = []; if (nr >= AUTO_KINDER) return ende(punkte / AUTO_KINDER, `${gesichter.join(' ')} – ${gesichter.filter((x) => x === '😀').length} von ${AUTO_KINDER} Kindern haben ein richtig schönes Autogramm.`); } }
      else if (!malt && striche.length) { still += dt; if (still > AUTO_WARTEN && laenge() >= AUTO_LANG) werten(); }
      if (rest <= 0) return ende(punkte / AUTO_KINDER, `Die Zeit ist um. ${gesichter.join(' ') || 'Niemand hat ein Autogramm bekommen.'}`);
      const S = sachen[Math.min(nr, AUTO_KINDER - 1)];
      g.save(); g.translate(wechsel > 0 ? -(0.55 - wechsel) * 1700 : 0, 0);
      S.mal();
      // das Feld zum Unterschreiben
      const [fx, fy, fb, fh] = S.feld;
      g.fillStyle = 'rgba(255,255,255,.92)'; g.strokeStyle = '#27324d'; g.lineWidth = 2; g.setLineDash([8, 6]);
      if (S.rund) { g.beginPath(); g.ellipse(fx + fb / 2, fy + fh / 2, fb / 2, fh / 2, 0, 0, 7); } else rund(fx, fy, fb, fh, 10);
      g.fill(); g.stroke(); g.setLineDash([]);
      // die Tinte
      g.strokeStyle = '#1a2a8a'; g.lineWidth = 5;
      for (const st of striche) { g.beginPath(); st.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (st.length === 1) g.lineTo(st[0][0] + 0.1, st[0][1]); g.stroke(); }
      g.restore();
      schrift(`${namen[nr % namen.length]} hält dir ${S.name} hin.`, W / 2, 62, 22);
      if (striche.length && !malt && laenge() < AUTO_LANG) schrift('Das ist noch zu kurz für eine Unterschrift – schreib weiter!', W / 2, 520, 17, '#e8f04a');
      schrift(gesichter.join(' '), 30, 520, 26, '#fff', 'left');
      zeitBalken(rest, AUTO_ZEIT);
      info(`Kind ${Math.min(nr + 1, AUTO_KINDER)} von ${AUTO_KINDER} · noch ${Math.ceil(rest)} s`);
    },
  };
};

// =====================================================================
// Dehnen: ruhig halten
// =====================================================================
const DEHN_ZEIT = 9;                     // Sekunden je Dehnung
const DEHN_FELD = 0.24;                  // so breit ist das grüne Feld nach jeder Seite (die ganze Leiste geht von −1 bis 1)
const DEHNUNGEN = [
  { name: 'Ausfallschritt', tipp: 'dehnt Hüfte und Oberschenkel', pose(x) { return { hueft: [x, BODEN - 60], schulter: [x + 6, BODEN - 130], handL: [x + 4, BODEN - 62], handR: [x + 4, BODEN - 62], fussL: [x + 62, BODEN], fussR: [x - 86, BODEN], knie: -1, knie2: 1, ell: 1 }; } },
  { name: 'Seitbeuge', tipp: 'dehnt die Seite und den Rücken', pose(x) { const f = stehen(x, 26); f.schulter = [x + 30, BODEN - 158]; f.handL = [x + 96, BODEN - 196]; f.handR = [x + 30, BODEN - 92]; f.ell = -1; f.ell2 = 1; return f; } },
  { name: 'Vorbeuge', tipp: 'dehnt die Rückseite der Beine', pose(x) { return { hueft: [x - 16, BODEN - 94], schulter: [x + 42, BODEN - 76], kopf: [x + 62, BODEN - 62], handL: [x + 40, BODEN - 12], handR: [x + 40, BODEN - 12], fussL: [x - 6, BODEN], fussR: [x + 10, BODEN], knie: -1, ell: 1 }; } },
];
SPIELE.dehnen = () => {
  let nr = 0, m = 0, v = 0, stoss = 0, stossT = 0, rest = DEHN_ZEIT, gut = 0, gesamt = 0, links = false, rechts = false, zeiger = 0;
  return {
    titel: 'Auslaufen und Dehnen', malen: true, get zustand() { return { m, v, nr }; },
    hilfe: `Halte jede Dehnung <b>ganz ruhig</b>. Dein Körper wackelt aber: Der weiße Zeiger unten wandert weg. Drück auf die <b>linke oder rechte Hälfte</b> des Bildes (oder Pfeiltasten ← →), um gegenzuhalten, damit der Zeiger im <b>grünen Feld</b> bleibt. Drei Dehnungen, jede ${DEHN_ZEIT} Sekunden.`,
    start() {},
    unten(x) { zeiger = x < W / 2 ? -1 : 1; },
    zieh(x, y, drueckt) { if (drueckt && zeiger) zeiger = x < W / 2 ? -1 : 1; },
    hoch() { zeiger = 0; },
    taste(code, runter) { if (code === 'ArrowLeft') links = runter; if (code === 'ArrowRight') rechts = runter; },
    bild(dt) {
      rest -= dt; stossT -= dt;
      if (stossT <= 0) { stoss = (Math.random() - 0.5) * (2.2 + nr * 0.7); stossT = 0.35 + Math.random() * 0.5; }   // alle halbe Sekunde zieht es woandershin
      const lenk = (links ? -1 : 0) + (rechts ? 1 : 0) + zeiger;
      v += (stoss + begrenzen(lenk, -1, 1) * 3.4 + m * 1.2) * dt; v *= 1 - 1.2 * dt;
      m += v * dt;
      if (Math.abs(m) > 1) { m = Math.sign(m); v = 0; }
      gesamt += dt; if (Math.abs(m) <= DEHN_FELD) gut += dt;
      if (rest <= 0) { nr++; rest = DEHN_ZEIT; m = 0; v = 0; if (nr >= DEHNUNGEN.length) { const anteil = gut / gesamt; return ende(anteil / 0.8, `Du hast ${Math.round(anteil * 100)} % der Zeit ruhig gehalten.`); } }
      const D = DEHNUNGEN[nr];
      boden('#2f5a3a');
      g.save(); g.translate(450, BODEN); g.rotate(m * 0.2); g.translate(-450, -BODEN);
      figur(D.pose(450));
      g.restore();
      schrift(D.name, W / 2, 70, 30, '#e8f04a'); schrift(D.tipp, W / 2, 100, 17, '#9fb0cc');
      // die Leiste unten
      const lx0 = 200, lb = 500, ly = 492;
      g.fillStyle = 'rgba(255,255,255,.14)'; rund(lx0, ly, lb, 22, 11); g.fill();
      g.fillStyle = '#3ecf6e'; g.fillRect(lx0 + lb / 2 - lb / 2 * DEHN_FELD, ly, lb * DEHN_FELD, 22);
      g.fillStyle = Math.abs(m) <= DEHN_FELD ? '#fff' : '#ff6b5a'; rund(lx0 + lb / 2 + m * lb / 2 - 5, ly - 6, 10, 34, 5); g.fill();
      schrift('◀', lx0 - 30, ly + 19, 24, links || zeiger < 0 ? '#e8f04a' : '#9fb0cc'); schrift('▶', lx0 + lb + 30, ly + 19, 24, rechts || zeiger > 0 ? '#e8f04a' : '#9fb0cc');
      zeitBalken(rest, DEHN_ZEIT);
      info(`Dehnung ${nr + 1} von ${DEHNUNGEN.length} · ruhig: ${Math.round(100 * gut / Math.max(gesamt, 0.01))} %`);
    },
  };
};

// =====================================================================
// Tennis-Quiz (ohne Malfläche: Text und Knöpfe)
// =====================================================================
const QUIZ_ZEIT = 20;                    // Sekunden je Frage
SPIELE.quiz = (opt) => {
  const fragen = ziehe(opt.anzahl || 5, opt.gesehen || [], Math.random, opt.themen || null);
  let nr = 0, richtig = 0, rest = QUIZ_ZEIT, beantwortet = false;
  const frage = () => {
    const F = fragen[nr];
    beantwortet = false; rest = QUIZ_ZEIT;
    text(`<p class="dim">${THEMEN[F.thema]} · Frage ${nr + 1} von ${fragen.length}</p><h3>${F.frage}</h3><div class="zeit"><i></i></div>`);
    knoepfe(F.antworten, antwort);
  };
  const antwort = (i) => {
    if (beantwortet) return;
    beantwortet = true;
    const F = fragen[nr], ok = i === F.richtig;
    if (ok) { richtig++; klang.gut(); }
    [...knopfEl.children].forEach((b, k) => { b.disabled = true; if (k === F.richtig) b.classList.add('richtig'); else if (k === i) b.classList.add('falsch'); });
    text(`<p class="dim">${THEMEN[F.thema]} · Frage ${nr + 1} von ${fragen.length}</p><h3>${F.frage}</h3><p><b class="${ok ? 'plus' : 'minus'}">${ok ? '✓ Richtig!' : i < 0 ? '⏰ Zeit um!' : '✗ Leider falsch.'}</b> ${F.erkl}</p>`);
    const weiter = document.createElement('button');
    weiter.className = 'primary'; weiter.textContent = nr + 1 < fragen.length ? 'Nächste Frage ›' : 'Fertig ›'; weiter.dataset.nr = '9';
    knopfEl.appendChild(weiter);
    knopfRuf = (k) => { if (k !== 9) return; nr++; if (nr >= fragen.length) return ende(richtig / fragen.length, `${richtig} von ${fragen.length} Fragen richtig beantwortet.`, { ids: fragen.map((f) => f.id) }); frage(); };
  };
  return {
    titel: 'Tennis-Quiz', malen: false, get zustand() { return { richtig: fragen[nr] && fragen[nr].richtig, beantwortet }; },
    hilfe: `${fragen.length} Fragen rund ums Tennis. Zu jeder Frage gibt es vier Antworten – nur eine stimmt. Du hast ${QUIZ_ZEIT} Sekunden pro Frage. Nach jeder Frage steht da, warum die Antwort richtig ist.`,
    start: frage,
    taste(code, runter) { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code); if (runter && i >= 0) antwort(i); },
    bild(dt) {
      if (beantwortet) return;
      rest -= dt;
      const b = textEl.querySelector('.zeit i'); if (b) b.style.width = begrenzen(rest / QUIZ_ZEIT, 0, 1) * 100 + '%';
      info(`richtig: ${richtig}`);
      if (rest <= 0) antwort(-1);
    },
  };
};

// =====================================================================
// Pressekonferenz (ohne Malfläche)
// =====================================================================
const PRESSE_FRAGEN_ZAHL = 3;
const PRESSE_ZEIT = 14;                  // Sekunden je Frage – wer zu lange überlegt, stottert
const WITZ_KLAPPT = 0.65;                // so oft kommt ein Witz gut an
SPIELE.presse = () => {
  const fragen = PRESSE_FRAGEN.slice().sort(() => Math.random() - 0.5).slice(0, PRESSE_FRAGEN_ZAHL);
  let nr = 0, punkte = 0, rest = PRESSE_ZEIT, beantwortet = false, patzig = 0;
  const frage = () => {
    const F = fragen[nr];
    beantwortet = false; rest = PRESSE_ZEIT;
    text(`<p class="dim">🎤 Frage ${nr + 1} von ${fragen.length}</p><h3>„${F.frage}“</h3><div class="zeit"><i></i></div>`);
    knoepfe(F.antworten.map((a) => '„' + a[1] + '“'), antwort);
  };
  const antwort = (i) => {
    if (beantwortet) return;
    beantwortet = true;
    const F = fragen[nr];
    let art = i < 0 ? 'stumm' : F.antworten[i][0];
    if (art === 'witzig') art = Math.random() < WITZ_KLAPPT ? 'witzigGut' : 'witzigSchlecht';
    if (art === 'patzig') patzig++;
    const p = { nett: 1, witzigGut: 1, witzigSchlecht: 0.4, stumm: 0.3, patzig: 0 }[art];
    punkte += p; if (p === 1) klang.gut();
    const satz = art === 'stumm' ? '„Äh … öh … also …“ Du hast zu lange überlegt. Die Reporter schauen sich an.' : ANTWORT_SATZ[art];
    text(`<p class="dim">🎤 Frage ${nr + 1} von ${fragen.length}</p><h3>„${F.frage}“</h3>${i >= 0 ? `<p>Du: „${F.antworten[i][1]}“</p>` : ''}<p><b class="${p === 1 ? 'plus' : p ? '' : 'minus'}">${satz}</b></p>`);
    knoepfe([[nr + 1 < fragen.length ? 'Nächste Frage ›' : 'Fertig ›', 'primary']], () => {
      nr++;
      if (nr >= fragen.length) return ende(punkte / fragen.length, patzig >= 2 ? 'Das war ziemlich unfreundlich. Die Reporter sind sauer.' : punkte >= fragen.length * 0.8 ? 'Eine tolle Pressekonferenz – freundlich und schlagfertig.' : 'Die Pressekonferenz ist geschafft.');
      frage();
    });
  };
  return {
    titel: 'Pressekonferenz', malen: false, get zustand() { return { nett: fragen[nr] && fragen[nr].antworten.findIndex((a) => a[0] === 'nett'), beantwortet }; },
    hilfe: `Die Reporter stellen dir ${PRESSE_FRAGEN_ZAHL} Fragen. Such dir jedes Mal eine Antwort aus: <b>freundlich</b> kommt immer gut an, ein <b>Witz</b> klappt oft (aber nicht immer), <b>patzig</b> gibt Ärger. Antworte in ${PRESSE_ZEIT} Sekunden – sonst fängst du an zu stottern.`,
    start: frage,
    taste(code, runter) { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(code); if (runter && i >= 0 && !beantwortet) antwort(i); },
    bild(dt) {
      if (beantwortet) return;
      rest -= dt;
      const b = textEl.querySelector('.zeit i'); if (b) b.style.width = begrenzen(rest / PRESSE_ZEIT, 0, 1) * 100 + '%';
      if (rest <= 0) antwort(-1);
    },
  };
};

export const SPIEL_NAMEN = Object.keys(SPIELE);
