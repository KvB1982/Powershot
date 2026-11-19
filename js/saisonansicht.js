// Powershot – Saison-Ansichten: Turnierbaum, Zeitleiste der Saison, Tabelle des ATP Race.
// Jede Funktion hier baut nur ein Stück HTML (also Text) zusammen. app.js setzt es dann auf die Seite.
// Das Aussehen dazu steht in css/style.css (unter "Turnierbaum" und "Saison").

import * as D from './data.js';
import * as SE from './season.js';
import * as PS from './profisaison.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flag = (c) => D.FLAGS[c] || '🏳️';
const zahl = (n) => n.toLocaleString('de-DE');
const KURZ = { W: 'Sieg', F: 'Finale', SF: 'Halbfinale', QF: 'Viertelfinale', R16: 'Achtelfinale', R32: 'Runde der 32', R64: 'Runde der 64', R128: 'Runde der 128', RR: 'Gruppenphase' };
const catClass = (def) => (def.cat === 'GS' ? 'gs' : def.cat === 'M' ? 'm' : 'f');

// ---------------------------------------------------------------
// Turnierbaum
// ---------------------------------------------------------------

// Aus '6:4 3:6 7:5' werden die Spiele pro Satz für Spieler a und Spieler b: [[6,3,7],[4,6,5]]
function saetze(T, m) {
  if (!m.winner || !/^\d/.test(m.score)) return [[], []];
  const paare = m.score.split(' ').map((x) => x.split(':').map(Number));
  // Dein eigenes Ergebnis ist aus deiner Sicht aufgeschrieben. Stehst du unten (b), drehen wir es um.
  const drehen = m.humanFirst && m.b === T.humanId;
  return [paare.map((x) => x[drehen ? 1 : 0]), paare.map((x) => x[drehen ? 0 : 1])];
}

// Eine Zeile im Baum: Setzplatz, Flagge, Name, Satzergebnisse
function zeile(T, m, id, games, otherGames) {
  if (!id && m.bye) return '<div class="bp leer"><span class="sd"></span><span class="nm">Freilos</span></div>';
  if (!id) return '<div class="bp leer"><span class="sd"></span><span class="nm">noch offen</span></div>';
  const p = T.players[id];
  const cls = [id === T.humanId ? 'me' : '', m.winner === id ? 'w' : '', m.winner && m.winner !== id ? 'l' : ''].join(' ');
  let sc = games.map((g, i) => `<b class="${g > otherGames[i] ? 'hi' : ''}">${g}</b>`).join('');
  if (m.winner === id && !games.length) sc = '<b class="hi">✓</b>';
  return `<div class="bp ${cls}"><span class="sd">${p.seed || ''}</span><span class="nm">${flag(p.country)} ${esc(p.short)}</span><span class="sc">${sc}</span></div>`;
}

function kasten(T, m, aktuell) {
  const [ga, gb] = saetze(T, m);
  const meins = T.humanId && (m.a === T.humanId || m.b === T.humanId);
  const cls = [meins ? 'mine' : '', aktuell && !m.winner && m.a ? 'cur' : ''].join(' ');
  return `<div class="bm ${cls}">${zeile(T, m, m.a, ga, gb)}${zeile(T, m, m.b, gb, ga)}</div>`;
}

// Der K.-o.-Baum: eine Spalte pro Runde, von links (erste Runde) nach rechts (Finale).
// rounds: Liste von { label, matches }. Runden, die noch nicht dran waren, zeigen leere Kästen.
function baum(T, def, rounds, aktuellIdx, ohnePokal) {
  const cols = rounds.map((r, i) => {
    const pts = def.cat === 'F' || def.cat === 'LIGA' ? '' : `<small>raus = ${zahl(def.points[r.label] || 0)} P.</small>`;
    const kopf = `<div class="bh ${i === aktuellIdx ? 'cur' : ''}"><b>${D.ROUND_NAMES[r.label]}</b>${pts}</div>`;
    const body = r.matches.map((m) => `<div class="bw">${kasten(T, m, i === aktuellIdx)}</div>`).join('');
    return `<div class="bcol ${i === 0 ? 'first' : ''} ${i === rounds.length - 1 ? 'last' : ''} ${i === aktuellIdx ? 'curcol' : ''}">${kopf}<div class="bms">${body}</div></div>`;
  }).join('');
  // Ganz rechts: der Pokal mit dem Sieger
  const champ = T.champion ? T.players[T.champion] : null;
  const pokal = `<div class="bcol pokal"><div class="bh"><b>Sieger</b>${def.cat === 'F' || def.cat === 'LIGA' ? '' : `<small>${zahl(def.points.W)} P.</small>`}</div>
    <div class="bms"><div class="bw"><div class="bsieger ${champ && T.champion === T.humanId ? 'me' : ''}">🏆<span>${champ ? flag(champ.country) + ' ' + esc(champ.short) : '?'}</span></div></div></div></div>`;
  return `<div class="bscroll"><div class="bracket">${cols}${ohnePokal ? '' : pokal}</div></div>`;
}

const leer = (n) => Array.from({ length: n }, () => ({ a: null, b: null, winner: null, score: '' }));

// In welchem Achtel des Baums steht dieser Spieler? (0 bis 7; -1 = nicht dabei)
export function abschnittVon(T, id) {
  const erste = T.rounds[0] || [];
  const i = erste.findIndex((m) => m.a === id || m.b === id);
  return i < 0 ? -1 : Math.floor(i / (erste.length / 8));
}

// Der ganze Turnierbaum für ein Turnier (K.-o.-Turnier oder ATP Finals)
// teil: Bei großen Feldern (mehr als 32 Plätze) zeigen wir nicht alles auf einmal, sondern ein Achtel des Baums
//       (teil = 0 bis 7) und darunter die Endrunde ab dem Viertelfinale. Ohne Angabe: dein eigenes Achtel.
export function bracketHtml(T, def, teil) {
  if (T.format === 'ko') {
    const size = T.size || T.rounds[0].length * 2;
    const LABEL = { 64: 'R128', 32: 'R64', 16: 'R32', 8: 'R16', 4: 'QF', 2: 'SF', 1: 'F' };
    const rounds = [];
    for (let n = size / 2, i = 0; n >= 1; n /= 2, i++) rounds.push({ label: LABEL[n], matches: T.rounds[i] || leer(n) });
    const aktuell = T.done ? -1 : T.rounds.length - 1;
    const hint = '<div class="bhint dim">Zum Blättern nach links und rechts wischen. Die kleine Zahl ist der Setzplatz.</div>';
    if (size <= 32) return `<div class="panel bpanel">${hint}${baum(T, def, rounds, aktuell)}</div>`;
    // Großes Feld: ein Achtel (bis zum Achtelfinale) und die Endrunde
    const meins = T.humanId ? abschnittVon(T, T.humanId) : -1;
    const t = teil != null && teil >= 0 && teil < 8 ? teil : Math.max(0, meins);
    const vorn = rounds.slice(0, rounds.length - 3).map((r) => { const k = r.matches.length / 8; return { label: r.label, matches: r.matches.slice(t * k, (t + 1) * k) }; });
    const knoepfe = Array.from({ length: 8 }, (_, i) => `<button class="${i === t ? 'sel' : ''}" data-a="baumTeil" data-v="${i}">${i + 1}${i === meins ? ' (du)' : ''}</button>`).join('');
    const endIdx = aktuell - (rounds.length - 3);
    return `<div class="panel bpanel"><div class="bhint dim">${Object.keys(T.players).length} Spieler – der Baum ist in 8 Teile geteilt. Der Sieger jedes Teils kommt ins Viertelfinale.</div>
      <div class="row tabs">${knoepfe}</div>${hint}${baum(T, def, vorn, aktuell, true)}</div>
      <div class="panel bpanel"><h3 style="margin-top:0">Endrunde</h3>${baum(T, def, rounds.slice(-3), T.done ? -1 : endIdx)}</div>`;
  }
  // ATP Finals: erst zwei Gruppen (jeder gegen jeden), dann Halbfinale und Finale
  const gruppen = T.groups.map((g, gi) => {
    const sortiert = [...g].sort((x, y) => T.rr[y].wins - T.rr[x].wins || T.rr[y].sets - T.rr[x].sets || T.players[x].seed - T.players[y].seed);
    const fertig = T.stage >= 3;
    const zeilen = sortiert.map((id, i) => {
      const p = T.players[id];
      return `<tr class="${id === T.humanId ? 'me' : ''} ${fertig && i < 2 ? 'weiter' : ''}"><td class="num">${i + 1}</td><td>${flag(p.country)} ${esc(p.short)}</td>
        <td class="num">${T.rr[id].wins}</td><td class="num">${T.rr[id].sets > 0 ? '+' : ''}${T.rr[id].sets}</td></tr>`;
    }).join('');
    const spiele = T.rounds.map((r, ri) => (T.labels[ri] !== 'RR' ? '' : `<div class="btag">Spieltag ${ri + 1}</div>` +
      r.filter((m) => m.group === gi).map((m) => kasten(T, m, ri === T.rounds.length - 1 && !T.done)).join(''))).join('');
    return `<div class="panel"><h3 style="margin-top:0">Gruppe ${'AB'[gi]}</h3>
      <table class="gruppe"><tr><th class="num">#</th><th>Spieler</th><th class="num">Siege</th><th class="num">Sätze</th></tr>${zeilen}</table>
      <div class="dim klein">Die ersten zwei jeder Gruppe kommen ins Halbfinale.</div><div class="bliste">${spiele}</div></div>`;
  }).join('');
  const sfIdx = T.labels.indexOf('SF'), fIdx = T.labels.indexOf('F');
  const rounds = [
    { label: 'SF', matches: sfIdx >= 0 ? T.rounds[sfIdx] : leer(2) },
    { label: 'F', matches: fIdx >= 0 ? T.rounds[fIdx] : leer(1) },
  ];
  const cur = T.done ? -1 : TNlabel(T) === 'SF' ? 0 : TNlabel(T) === 'F' ? 1 : -1;
  return `<div class="cols">${gruppen}</div><div class="panel bpanel"><h3 style="margin-top:0">Endrunde</h3>${baum(T, def, rounds, cur)}</div>`;
}
const TNlabel = (T) => T.labels[T.labels.length - 1];

// ---------------------------------------------------------------
// Zeitleiste der Saison
// ---------------------------------------------------------------
// Eine Station pro Turnier. Fertige Turniere zeigen dein Ergebnis, das nächste ist hervorgehoben.
export function timelineHtml(s) {
  const fertig = Object.fromEntries(s.history.map((h) => [h.tid, h]));
  let monat = '';
  const stationen = D.TOURNAMENTS.map((t, i) => {
    const h = fertig[t.id];
    const stand = h ? 'done' : (i === s.week && !s.over ? 'now' : 'todo');
    const neuerMonat = t.month !== monat;
    monat = t.month;
    let unten = '';
    if (h) unten = h.label ? `<b class="${h.label === 'W' ? 'gold' : ''}">${h.label === 'W' ? '🏆 Sieg' : KURZ[h.label]}</b><span>+${zahl(h.points)} P.</span>` : '<b class="dim">nicht dabei</b><span>+0 P.</span>';
    else if (stand === 'now') unten = '<b class="hier">▲ Du bist hier</b>';
    else unten = `<span>bis ${zahl(t.cat === 'F' ? 1500 : t.points.W)} P.</span>`;
    // Was dein Profi hier letztes Jahr geholt hat: Diese Punkte fallen weg, wenn das Turnier wieder gespielt wird.
    const alt = s.vorjahr ? PS.verteidigen(s, t) : null;
    if (alt && !h) unten += `<span class="tlv ${alt.titel ? 'gold' : ''}" title="Diese Punkte aus dem Vorjahr musst du verteidigen">${alt.titel ? '🏆 Titel' : 'Vorjahr'}: ${zahl(alt.punkte)} P.</span>`;
    if (alt && h) { const d = h.points - alt.punkte; unten += `<span class="tlv ${d > 0 ? 'plus' : d < 0 ? 'minus' : ''}">Welt: ${d >= 0 ? '+' : '−'}${zahl(Math.abs(d))}</span>`; }
    return `<div class="tl ${stand} ${catClass(t)}" ${stand === 'now' ? 'id="tlNow"' : ''}>
      <div class="tlm">${neuerMonat ? t.month : '&nbsp;'}</div>
      <div class="tld"><i></i></div>
      <div class="tln">${esc(t.name)}</div>
      <div class="tlc">${t.catName} · ${D.SURFACE_NAMES[t.surface]}</div>
      <div class="tlr">${unten}</div></div>`;
  }).join('');
  const anteil = Math.round(100 * s.week / D.TOURNAMENTS.length);
  return `<div class="panel tlpanel"><div class="tlkopf"><b>Saison ${s.year}</b><span class="dim">${s.over ? 'Saison beendet' : `Turnier ${s.week + 1} von ${D.TOURNAMENTS.length}`}</span>
    <div class="tlbar"><i style="width:${anteil}%"></i></div></div>
    <div class="tlscroll"><div class="tlrow">${stationen}</div></div></div>`;
}

// ---------------------------------------------------------------
// Tabelle: ATP Race
// ---------------------------------------------------------------
// kurz = true: nur die ersten 10 und die Plätze rund um deinen Profi. Sonst alle, die schon Punkte haben (mindestens 20).
export function raceHtml(s, kurz = false) {
  const list = SE.raceTable(s);
  const ich = list.find((p) => p.me);
  const feld = new Set(SE.finalsField(s).map((p) => p.id));
  const rows = list.filter((p) => (kurz ? p.rank <= 10 || Math.abs(p.rank - ich.rank) <= 1 : p.rank <= 20 || p.points > 0 || p.me));
  const spitze = list[0].points || 1;
  let html = '';
  rows.forEach((p, i) => {
    if (i > 0 && rows[i - 1].rank < p.rank - 1) html += '<tr><td colspan="4" class="dim center">…</td></tr>';
    html += `<tr class="${p.me ? 'me' : ''} ${feld.has(p.id) ? 'quali' : ''}"><td class="num">${p.rank}</td>
      <td>${flag(p.country)} ${esc(kurz ? p.short : p.name)}${p.slam ? ' <span title="Grand-Slam-Sieger">🏆</span>' : ''}${feld.has(p.id) && p.rank > SE.FINALS_PLAETZE ? ' <small class="gold">Finals (Grand-Slam-Regel)</small>' : ''}
        <div class="rbar"><i style="width:${Math.round(100 * p.points / spitze)}%"></i></div></td>
      ${kurz ? '' : `<td class="num dim">${p.played}</td>`}<td class="num"><b>${zahl(p.points)}</b></td></tr>`;
    if (p.rank === SE.FINALS_PLAETZE) html += `<tr class="cut"><td colspan="4">▲ Diese 8 fahren zu den ATP Finals ▲</td></tr>`;
  });
  return `<table class="race"><tr><th class="num">Platz</th><th>Spieler</th>${kurz ? '' : '<th class="num">Turniere</th>'}<th class="num">Punkte</th></tr>${html}</table>`;
}

// ---------------------------------------------------------------
// Erklärung: So gibt es Punkte
// ---------------------------------------------------------------
export function pointsHtml() {
  const gs = D.TOURNAMENTS.find((t) => t.cat === 'GS').points, m = D.TOURNAMENTS.find((t) => t.cat === 'M').points;
  const z = (label) => `<tr><td>${label === 'W' ? '🏆 Turniersieg' : 'Raus im: ' + KURZ[label]}</td><td class="num">${gs[label] != null ? zahl(gs[label]) : '–'}</td><td class="num">${m[label] != null ? zahl(m[label]) : '–'}</td></tr>`;
  return `<div class="panel"><h3 style="margin-top:0">So gibt es Punkte</h3>
    <p>Im <b>ATP Race</b> starten im Januar alle bei 0 Punkten. Je weiter du in einem Turnier kommst, desto mehr Punkte bekommst du.
    Die Zahlen sind die echten Punkte der ATP (Regeln 2026).</p>
    <div class="scrollx"><table><tr><th>Ergebnis</th><th class="num"><span class="tag gs">Grand Slam</span></th><th class="num"><span class="tag m">Masters 1000</span></th></tr>
    ${['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'].map(z).join('')}</table></div>
    <p class="dim">Die Felder sind so groß wie in echt: Bei einem Grand Slam spielen 128 Spieler (7 Runden bis zum Titel), bei den meisten Masters 96.
    Dort haben die 32 gesetzten Spieler in der ersten Runde ein Freilos. Wer nach einem Freilos sein erstes Match verliert, bekommt nur die Punkte der ersten Runde.
    Monte-Carlo und Paris haben 56 Spieler.</p></div>
    <div class="panel"><h3 style="margin-top:0"><span class="tag f">ATP Finals</span> in Turin</h3>
    <p>Nach dem Paris Masters dürfen die <b>besten 8</b> im Race zu den ATP Finals. Dort gibt es:</p>
    <ul><li><b>${D.FINALS_POINTS.RR} Punkte</b> für jeden Sieg in der Gruppe (3 Spiele)</li><li><b>${D.FINALS_POINTS.SF} Punkte</b> für den Sieg im Halbfinale</li>
    <li><b>${D.FINALS_POINTS.F} Punkte</b> für den Sieg im Finale</li></ul>
    <p>Wer alle fünf Spiele gewinnt, holt also 1.500 Punkte.</p>
    <p class="dim">Sonderregel wie in echt: Hat jemand in diesem Jahr einen Grand Slam gewonnen und steht im Race auf Platz 8 bis 20, bekommt er den 8. Startplatz.
    Die echte Tour hat außerdem kleinere Turniere (ATP 500 und 250) – die gibt es im Spiel noch nicht.</p></div>`;
}

// ---------------------------------------------------------------
// Tabelle: Weltrangliste (Punkte der letzten 52 Wochen)
// ---------------------------------------------------------------
// kurz = true: nur die Plätze rund um deinen Profi
export function weltHtml(s, kurz = false) {
  const list = PS.weltTabelle(s), ich = list.find((p) => p.me), rivalen = s.profi.rivalen;
  const rows = list.filter((p) => (kurz ? Math.abs(p.rank - ich.rank) <= 3 : p.rank <= 30 || Math.abs(p.rank - ich.rank) <= 5));
  let html = '';
  rows.forEach((p, i) => {
    if (i > 0 && rows[i - 1].rank < p.rank - 1) html += '<tr><td colspan="4" class="dim center">…</td></tr>';
    const d = p.start - p.rank;       // so viele Plätze besser (+) oder schlechter (−) als am Jahresanfang der echten Liste
    html += `<tr class="${p.me ? 'me' : ''}"><td class="num">${p.rank}</td>
      <td>${flag(p.country)} ${esc(kurz ? p.short : p.name)}${rivalen.includes(p.id) ? ' <span title="dein Rivale">⚔️</span>' : ''}</td>
      <td class="num ${d > 0 ? 'plus' : d < 0 ? 'minus' : 'dim'}">${d > 0 ? '▲ ' + d : d < 0 ? '▼ ' + -d : '–'}</td><td class="num"><b>${zahl(p.points)}</b></td></tr>`;
  });
  return `<table class="race"><tr><th class="num">Platz</th><th>Spieler</th><th class="num">seit Start</th><th class="num">Punkte</th></tr>${html}</table>`;
}

// ---------------------------------------------------------------
// Die Zeitung: Meldungen über deinen Profi, seine Rivalen und die Sieger
// ---------------------------------------------------------------
const ZEITUNG_BILD = { gut: '🟢', schlecht: '🔴', info: '📰', rivale: '⚔️' };
export function zeitungHtml(s, wieViele = 99) {
  const liste = s.profi.zeitung.slice(0, wieViele);
  if (!liste.length) return '<p class="dim">Noch nichts los. Spiel dein erstes Turnier!</p>';
  return `<div class="zeitung">${liste.map((z) => `<div class="zm ${z.art}"><b>${ZEITUNG_BILD[z.art] || '📰'} ${esc(z.kopf)}</b><span>${esc(z.text)}</span></div>`).join('')}</div>`;
}
