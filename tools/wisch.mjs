// Prüft die Steuerung "Wischen" ohne Browser und ohne iPad: Wir tun so, als würden Finger über den Bildschirm wischen,
// und schauen, welcher Schlag dabei herauskommt.   Aufruf:  node tools/wisch.mjs
globalThis.window = { addEventListener() {} };
const { Controls, wischArt } = await import('../js/controls.js');

// Ein Bildschirm zum So-tun-als-ob (1024 × 768 wie ein iPad quer)
const el = { addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 768 }) };
let fehler = 0;
const pruefe = (text, ok, zusatz = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + text + (zusatz ? '  → ' + zusatz : '')); if (!ok) fehler++; };

function neu(ctx) {
  const c = new Controls(el, null);
  c.setMode('wisch'); c.enabled = true; c.begin(ctx); c.time = 10;
  c.hinweis = null; c.onHint = (t) => { c.hinweis = t; };
  return c;
}
let uhr = 1000;      // Zeit der Finger-Ereignisse in Millisekunden
// Finger wischen gleichzeitig von (x, y) um (dx, dy) in "ms" Millisekunden. finger = [[x, y], …]
function wisch(c, finger, dx, dy, ms) {
  const ev = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, timeStamp: uhr, preventDefault() {} });
  finger.forEach(([x, y], i) => c.onDown(ev(i + 1, x, y)));
  for (let s = 1; s <= 5; s++) {
    uhr += ms / 5; c.update(ms / 5000);
    finger.forEach(([x, y], i) => c.onMove(ev(i + 1, x + dx * s / 5, y + dy * s / 5)));
  }
  finger.forEach(([x, y], i) => c.onUp(ev(i + 1, x + dx, y + dy)));
  uhr += 600;
}
const tipp = (c, x, y) => { const e = { pointerId: 9, clientX: x, clientY: y, timeStamp: uhr, preventDefault() {} }; c.onDown(e); uhr += 60; c.update(0.06); c.onUp({ ...e, timeStamp: uhr }); uhr += 100; c.update(0.1); };
const EINER = [[700, 400]], ZWEI = [[650, 400], [760, 410]];

console.log('Schlagart aus der Wisch-Richtung (Ballwechsel, ein Finger):');
for (const [name, dx, dy, type, depth] of [
  ['nach oben', 0, -200, 'topspin', 0.8], ['schräg nach oben rechts', 150, -150, 'drive', 0.78], ['schräg nach oben links', -150, -150, 'drive', 0.78],
  ['zur Seite rechts', 200, 0, 'flach', 0.8], ['zur Seite links', -200, 10, 'flach', 0.8],
  ['schräg nach unten', 150, 150, 'slice', 0.85], ['nach unten', 0, 200, 'slice', 0.45]]) {
  const c = neu('rally'); wisch(c, EINER, dx, dy, 120);
  const r = c.peek(false, 0.16);
  pruefe(name, !!r && r.type === type && r.depth === depth, r ? `${r.type}, Tiefe ${r.depth}, Kraft ${r.power.toFixed(2)}` : 'nichts');
}

console.log('Härte aus dem Wisch-Tempo:');
const kraft = (ms) => { const c = neu('rally'); wisch(c, EINER, 150, -150, ms); return c.peek(false, 0.16).power; };
const [schnell, mittel, langsam] = [kraft(60), kraft(150), kraft(500)];
pruefe('schnell > mittel > langsam', schnell > mittel && mittel > langsam, [schnell, mittel, langsam].map((v) => v.toFixed(2)).join(' > '));
{ const c = neu('rally'); wisch(c, EINER, 0, 120, 600); const r = c.peek(false, 0.16); pruefe('ganz langsam nach unten = Stoppball', r && r.type === 'drop', r && r.type); }
{ const c = neu('rally'); wisch(c, EINER, 0, 250, 60); const r = c.peek(false, 0.16); pruefe('kurzer Slice ist nie hart', r && r.type === 'slice' && r.power <= 0.6, r && r.power.toFixed(2)); }

console.log('Richtung aus dem Zeitpunkt (früh = cross, spät = longline):');
// seite: +1 = Ball rechts von dir (Vorhand beim Rechtshänder), -1 = Ball links von dir (Rückhand)
for (const [seite, wo] of [[1, 'Vorhand'], [-1, 'Rückhand']]) {
  for (const [name, warten, soll] of [['0,44 s vor dem Treffen', 0.44, -1], ['0,23 s vorher', 0.23, 0], ['0,03 s vorher', 0.03, 1]]) {
    const c = neu('rally'); wisch(c, EINER, 150, -150, 100);
    c.time += warten - 0.05;                 // 0,05 s rechnet die Steuerung selbst zurück (WISCH_VERZUG)
    c.schlagSeite = seite;
    const r = c.consume(0);
    const ok = r && (soll === 0 ? Math.abs(r.aim) < 0.2 : Math.sign(r.aim) === soll * seite && Math.abs(r.aim) > 0.6);
    pruefe(`${wo}, ${name}`, ok, r && `Ziel ${r.aim.toFixed(2)} (${r.aim < -0.2 ? 'links' : r.aim > 0.2 ? 'rechts' : 'Mitte'})`);
  }
  { const c = neu('rally'); wisch(c, EINER, 150, -150, 100); c.schlagSeite = seite; const r = c.consume(0.1); pruefe(`${wo}, zu spät gewischt = ganz longline`, r && Math.sign(r.aim) === seite, r && 'Ziel ' + r.aim.toFixed(2)); }
  { const c = neu('rally'); c.schlagSeite = seite; const a = c.peek(false, 0.44).aim, b = c.peek(false, 0.03).aim;
    pruefe(`${wo}: Ziellinie läuft von ${seite > 0 ? 'links nach rechts' : 'rechts nach links'}`, Math.sign(b - a) === seite, `${a.toFixed(2)} → ${b.toFixed(2)}`); }
}
{ const c = neu('rally'); wisch(c, EINER, 150, -150, 100); c.update(0.7); pruefe('0,7 s zu früh gewischt gilt noch (ganz cross)', !!c.consume(0)); }
{ const c = neu('rally'); wisch(c, EINER, 150, -150, 100); c.update(0.9); pruefe('viel zu früh gewischt (0,9 s) verfällt', c.consume(0) === null); }

console.log('Zwei Finger im Ballwechsel:');
{ const c = neu('rally'); wisch(c, ZWEI, 0, -180, 120); const r = c.peek(false, 0.16); pruefe('nach oben = Lob', r && r.type === 'lob', r && r.type); pruefe('… und nicht „ans Netz“', c.takeNetz() === null); }
{ const c = neu('rally'); wisch(c, ZWEI, 0, 180, 120); pruefe('nach unten = nichts', c.peek(false, null) === null && c.takeNetz() === null); }

console.log('Doppelt tippen:');
{ const c = neu('rally'); tipp(c, 700, 400); pruefe('ein Tipp allein macht nichts', c.takeNetz() === null && c.consume(0) === null);
  tipp(c, 720, 410); pruefe('zweiter Tipp = ans Netz / zurück', c.takeNetz() === 'wechsel'); }
{ const c = neu('rally'); tipp(c, 200, 400); tipp(c, 210, 400); pruefe('geht auch links (wo sonst der Joystick ist)', c.takeNetz() === 'wechsel'); }

console.log('Wischen auf der linken Bildschirmseite (dort wischt man gern bei der Rückhand):');
const LINKS = [[200, 420]];
{ const c = neu('rally'); wisch(c, LINKS, 150, -150, 120); const lauf = c.move(); const r = c.peek(false, 0.2);
  pruefe('Laufhilfe „Voll“: Wisch links = Schlag', !!r && r.type === 'drive', r ? r.type : 'nichts'); pruefe('… und die Figur läuft nicht los', lauf.x === 0 && lauf.f === 0); }
for (const hilfe of ['seitlich', 'aus']) {
  const c = neu('rally'); c.laufhilfe = hilfe;
  const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, timeStamp: uhr, preventDefault() {} });
  c.onDown(ev(200, 420)); let gelaufen = false;
  for (let s = 1; s <= 5; s++) { uhr += 24; c.update(0.024); c.onMove(ev(200 + 30 * s, 420 - 30 * s)); const m = c.move(); if (m.x || m.f) gelaufen = true; }
  c.onUp(ev(350, 270)); uhr += 600;
  const r = c.peek(false, 0.2);
  pruefe(`Laufhilfe „${hilfe}“: schneller Wisch links = Schlag, ohne loszulaufen`, !!r && r.type === 'drive' && !gelaufen, r ? r.type : 'nichts');
  const d = neu('rally'); d.laufhilfe = hilfe;
  d.onDown(ev(200, 420)); uhr += 100; d.update(0.1); d.onMove(ev(240, 420)); uhr += 500; d.update(0.5); d.onMove(ev(260, 420));
  const m = d.move(); d.onUp(ev(260, 420)); uhr += 600;
  pruefe(`Laufhilfe „${hilfe}“: Finger links liegen lassen und ziehen = laufen, kein Schlag`, m.x > 0.5 && d.peek(false, null) === null, 'Joystick ' + m.x.toFixed(2));
}

console.log('Aufschlag:');
for (const [name, f, dx, dy, art, seite] of [
  ['hoch = gerade', EINER, 0, -200, 'gerade', 0], ['hoch und nach rechts geneigt', EINER, 80, -200, 'gerade', 1], ['hoch und nach links geneigt', EINER, -80, -200, 'gerade', -1],
  ['runter = Slice', EINER, 0, 200, 'slice', 0], ['runter und nach links geneigt', EINER, -80, 200, 'slice', -1],
  ['zwei Finger hoch = Kick', ZWEI, 60, -200, 'kick', 1], ['zwei Finger runter = von unten', ZWEI, -60, 200, 'unten', -1]]) {
  const c = neu('serve'); wisch(c, f, dx, dy, 120);
  const r = c.takeServe();
  pruefe(name, r && r.type === 'serve' && r.art === art && Math.sign(Math.round(r.aim * 10)) === seite, r ? `${r.art}, Ziel ${r.aim.toFixed(2)}, Kraft ${r.power.toFixed(2)}` : 'nichts');
}
{ const c = neu('serve'); wisch(c, EINER, 200, 10, 120); pruefe('zur Seite = kein Aufschlag, aber ein Hinweis', c.takeServe() === null && !!c.hinweis, c.hinweis); }

console.log('Alte Touch-Steuerung bleibt, wie sie war:');
{ const c = neu('rally'); c.setMode('touch'); c.begin('rally'); wisch(c, ZWEI, 0, -180, 120); pruefe('zwei Finger hoch = ans Netz', c.takeNetz() === 'vor'); }
{ const c = neu('rally'); c.setMode('touch'); c.begin('rally'); wisch(c, EINER, 0, -200, 120); const r = c.consume(0); pruefe('nach oben wischen = Topspin', r && r.type === 'drive', r && r.type); }
pruefe('wischArt gibt für jede Richtung eine Schlagart', [...Array(36)].every((_, i) => !!wischArt(Math.cos(i / 18 * Math.PI), Math.sin(i / 18 * Math.PI)).type));

console.log(fehler ? `\n${fehler} Fehler!` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
