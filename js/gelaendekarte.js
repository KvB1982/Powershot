// Powershot – das Radar (kleine runde Karte) und der große Lageplan auf dem Turniergelände.
// Vorbild: Radar und Stadtkarte im Schwester-Spiel „Blaulicht über Möwenbrück“ (KvB1982/Police-Quest, js/karte.js).
// Die Karte wird einmal aus dem Lageplan gemalt (plan.teile aus gelaende.js) und dann nur noch verschoben und gedreht.
// Auf dem Radar ist oben immer das, was auch im Bild oben ist (es dreht sich mit der Kamera) – ein kleines N zeigt nach Norden.
// Auf dem großen Plan ist Norden oben. Tippt man dort auf einen Ort, läuft die Figur hin.
// Im Städtchen (Fußweg zum Hotel) gibt es nur das Radar mit kurzer Sicht: Den Weg soll man ja selbst finden.
// Ohne three.js.

const RADAR_WEIT = 60, RADAR_STADT = 34;       // so viele Meter sieht man auf dem Radar bis zum Rand (Gelände / Städtchen)
const RAND_DAZU = 26;                          // so viele Meter rund um den Zaun sind noch auf der Karte
const BILD_MAX = 1700;                         // das Kartenbild ist höchstens so viele Bildpunkte breit oder hoch
const TIPP_NAH = 26;                           // so nah (Bildpunkte auf dem Bildschirm) muss ein Tipp an einem Ort sein

// Zeichen für die Orte des Turniertags
const ZEICHEN = { court: '🏟️', training: '🎾', kraft: '🏋️', physio: '💆', hotel: '🚗', essen: '🍽️', saiten: '🧵', presse: '🎤', fans: '✍️', start: '🚩', ziel: '🏨' };
const zeichenVon = (o) => (o.info ? 'ℹ️' : ZEICHEN[o.id] || '📍');

// Eine Farbe (Zahl wie 0x4f8a45) als Text für die Malfläche, auf Wunsch mit Weiß aufgehellt (hell 0…1)
function farbe(zahl, hell = 0) {
  const r = (zahl >> 16) & 255, g = (zahl >> 8) & 255, b = zahl & 255, m = (v) => Math.round(v + (255 - v) * hell);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

// Den Lageplan als Bild malen. Antwort: { c: Malfläche, mass: Bildpunkte pro Meter, x0, z0: die Welt-Stelle oben links }
function male(plan, mitNamen) {
  const g = plan.g, r = g.rand, stadt = !!g.zuFuss;
  let x0 = r.x0 - RAND_DAZU, x1 = r.x1 + RAND_DAZU, z0 = r.z0 - RAND_DAZU, z1 = r.z1 + RAND_DAZU;
  // Das Hotel draußen an der Straße soll mit auf die Karte
  if (plan.hotel && plan.hotel.teil) { const h = plan.hotel.teil; x0 = Math.min(x0, h.x - h.b / 2 - 14); x1 = Math.max(x1, h.x + h.b / 2 + 14); z0 = Math.min(z0, h.z - h.t / 2 - 14); z1 = Math.max(z1, h.z + h.t / 2 + 14); }
  const mass = Math.min(5, BILD_MAX / Math.max(x1 - x0, z1 - z0));
  const c = document.createElement('canvas'); c.width = Math.round((x1 - x0) * mass); c.height = Math.round((z1 - z0) * mass);
  const k = c.getContext('2d'), kx = (x) => (x - x0) * mass, kz = (z) => (z - z0) * mass;
  const R = (el, f, rand = 0) => { k.fillStyle = f; k.fillRect(kx(el.x - el.b / 2 - rand), kz(el.z - el.t / 2 - rand), (el.b + 2 * rand) * mass, (el.t + 2 * rand) * mass); };
  const rund = (el, f) => { k.fillStyle = f; k.beginPath(); k.ellipse(kx(el.x), kz(el.z), el.b / 2 * mass, el.t / 2 * mass, 0, 0, 7); k.fill(); };
  const kante = (el, f = 'rgba(60,50,40,0.55)', dick = 1.2) => { k.strokeStyle = f; k.lineWidth = dick; k.strokeRect(kx(el.x - el.b / 2), kz(el.z - el.t / 2), el.b * mass, el.t * mass); };
  k.fillStyle = farbe(g.umland ?? 0x6f9a5a, 0.35); k.fillRect(0, 0, c.width, c.height);                    // draußen: Wiesen
  k.fillStyle = farbe(g.boden ?? 0xcfc8ba, 0.35); k.fillRect(kx(r.x0), kz(r.z0), (r.x1 - r.x0) * mass, (r.z1 - r.z0) * mass);    // drinnen: der Boden des Geländes
  const feld = g.feld ? g.feld[0] : 0x2f6fc4;
  // 1. Erst alles Flache (Wiesen, Wasser, Wege, Straßen), dann was darauf steht
  for (const el of plan.teile) {
    if (el.a === 'flaeche') (el.rund ? rund : R)(el, el.strasse ? '#a9a9ae' : farbe(el.farbe ?? 0x5c9a4c, el.wasser ? 0.25 : 0.3));
    else if (el.a === 'meer' && typeof el.ab === 'number') { k.fillStyle = '#8fc0dc'; el.ab > 0 ? k.fillRect(0, kz(el.ab), c.width, c.height) : k.fillRect(0, 0, c.width, kz(el.ab)); }
  }
  for (const el of plan.teile) if (el.a === 'strasse' && el.art !== 'schranke' && el.art !== 'warten') (el.rund ? rund : R)(el, '#a9a9ae');
  if (!stadt) { k.strokeStyle = 'rgba(70,80,70,0.7)'; k.lineWidth = 2; k.setLineDash([6, 4]); k.strokeRect(kx(r.x0), kz(r.z0), (r.x1 - r.x0) * mass, (r.z1 - r.z0) * mass); k.setLineDash([]); }   // der Zaun
  // 2. Bäume als grüne Punkte
  k.fillStyle = 'rgba(70,130,70,0.75)';
  for (const [, punkte] of plan.punkte || []) for (const p of punkte) { k.beginPath(); k.arc(kx(p[0]), kz(p[1]), Math.max(1.5, 1.6 * mass), 0, 7); k.fill(); }
  // 3. Plätze, Stadien, Häuser
  for (const el of plan.teile) {
    if (el.a === 'plaetze') {
      for (let i = 0; i < el.nx; i++) for (let j = 0; j < el.nz; j++) {
        const b = el.quer ? 13 : 7, t = el.quer ? 7 : 13, px = el.x - el.b / 2 + i * el.lx + b / 2, pz = el.z - el.t / 2 + j * el.lz + t / 2, P = { x: px, z: pz, b, t };
        R(P, farbe(el.farbe ?? feld, 0.15)); kante(P, 'rgba(255,255,255,0.9)', 1);
      }
    } else if (el.a === 'stadion') {
      const oval = el.form === 'oval' || el.form === 'rund';
      (oval ? rund : R)(el, farbe(el.sitz ?? el.farbe ?? 0x8a9aa8, 0.25));
      k.strokeStyle = 'rgba(30,40,60,0.8)'; k.lineWidth = 2;
      if (oval) { k.beginPath(); k.ellipse(kx(el.x), kz(el.z), el.b / 2 * mass, el.t / 2 * mass, 0, 0, 7); k.stroke(); } else kante(el, 'rgba(30,40,60,0.8)', 2);
      const P = { x: el.x, z: el.z, b: Math.min(el.b * 0.34, 9), t: Math.min(el.t * 0.5, 17) };       // der Platz in der Mitte
      R(P, el.wiese ? '#7fbf6a' : farbe(feld, 0.1)); kante(P, 'rgba(255,255,255,0.9)', 1);
    } else if (el.a === 'haus' || el.a === 'hotel') { R(el, farbe(el.farbe ?? 0xd8c8b0, 0.45)); kante(el); }
    else if (el.a === 'tuerme') for (const [x, z, b, t] of el.p) { const P = { x, z, b, t }; R(P, farbe(el.farbe ?? 0xb8bcc4, 0.45)); kante(P); }
    else if (el.a === 'huegel') rund(el, farbe(el.farbe ?? 0x58a048, 0.2));
    else if (el.a === 'kugel') rund({ x: el.x, z: el.z, b: el.r * 2, t: el.r * 2 }, '#d9dde4');
    else if (el.a === 'hecke') R(el, '#4f8a45');
    else if (el.a === 'zelte' && el.b > 1) R({ x: el.x, z: el.z, b: el.b, t: 4 }, 'rgba(255,255,255,0.8)');
    else if (el.a === 'auto') R(el, '#2a2a30');
  }
  // 4. Namen der großen Gebäude und die Zeichen der Orte
  k.textAlign = 'center'; k.textBaseline = 'middle';
  const schrift = (text, x, y, gross) => {
    k.font = `bold ${gross}px system-ui, sans-serif`; k.lineWidth = gross / 3.2; k.strokeStyle = 'rgba(255,255,255,0.92)'; k.strokeText(text, x, y); k.fillStyle = '#1a2440'; k.fillText(text, x, y);
  };
  if (mitNamen) for (const el of plan.teile) if ((el.a === 'stadion' || el.a === 'hotel') && el.name) schrift(el.name, kx(el.x), kz(el.z - el.t / 2) - 11, 17);
  const orte = stadt ? plan.orte.filter((o) => o.id === 'start' || o.id === 'ziel') : plan.orte;
  for (const o of orte) {
    const x = kx(o.tx), y = kz(o.tz), rr = o.info ? 9 : 13;
    k.fillStyle = 'rgba(255,255,255,0.94)'; k.strokeStyle = o.info ? '#2a7fd8' : '#1f4f9e'; k.lineWidth = 2; k.beginPath(); k.arc(x, y, rr, 0, 7); k.fill(); k.stroke();
    k.font = `${o.info ? 11 : 16}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`; k.fillStyle = '#000'; k.fillText(zeichenVon(o), x, y + 1);
    if (mitNamen && !o.info && o.name) schrift(o.name, x, y + rr + 10, 15);
  }
  return { c, mass, x0, z0 };
}

export class GelaendeKarte {
  // wennOrt(ort): wird gerufen, wenn man auf dem großen Plan einen Ort antippt
  constructor(wennOrt) {
    this.wennOrt = wennOrt;
    this.plan = null; this.klein = null; this.gross = null; this.stand = null;
    this.ansicht = { x: 0, y: 0, mal: 1 }; this.zeiger = new Map(); this.zwick = 0; this.weg = 0;
    const neu = (art, id, in_, html = '') => { const e = document.createElement(art); e.id = id; e.innerHTML = html; in_.appendChild(e); return e; };
    this.el = neu('div', 'radar', document.body, '<canvas width="300" height="300" aria-label="Radar – antippen für den Lageplan"></canvas><span class="nord">N</span>');
    this.bild = this.el.querySelector('canvas'); this.nord = this.el.querySelector('.nord');
    this.el.hidden = true;
    this.el.addEventListener('click', () => { if (this.stand) this.auf(this.stand); });
    this.fenster = neu('div', 'lageplan', document.body,
      '<div class="kopf"><b class="titel"></b><span class="wo"></span><button class="zu">✕ Schließen</button></div><div class="rahmen"><canvas></canvas></div><p class="tipp">Verschieben: ziehen · Größer und kleiner: Mausrad oder zwei Finger · Tippe auf einen Ort, dann läuft deine Figur hin.</p>');
    this.fenster.hidden = true;
    this.rahmen = this.fenster.querySelector('.rahmen'); this.plakat = this.rahmen.querySelector('canvas');
    this.fenster.querySelector('.zu').onclick = () => this.zu();
    const rahmen = this.rahmen;
    rahmen.addEventListener('wheel', (e) => { e.preventDefault(); const r = rahmen.getBoundingClientRect(); this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    rahmen.addEventListener('pointerdown', (e) => { this.zeiger.set(e.pointerId, [e.clientX, e.clientY]); rahmen.setPointerCapture(e.pointerId); this.zwick = 0; if (this.zeiger.size === 1) this.weg = 0; else this.weg = 99; });
    rahmen.addEventListener('pointermove', (e) => {
      if (!this.zeiger.has(e.pointerId)) return;
      const alt = this.zeiger.get(e.pointerId); this.zeiger.set(e.pointerId, [e.clientX, e.clientY]);
      this.weg += Math.abs(e.clientX - alt[0]) + Math.abs(e.clientY - alt[1]);
      if (this.zeiger.size === 1) { this.ansicht.x += e.clientX - alt[0]; this.ansicht.y += e.clientY - alt[1]; this.anwenden(); }
      else if (this.zeiger.size === 2) {
        const [a, b] = [...this.zeiger.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = rahmen.getBoundingClientRect();
        if (this.zwick) this.zoom(d / this.zwick, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        this.zwick = d;
      }
    });
    rahmen.addEventListener('pointerup', (e) => { if (this.zeiger.size === 1 && this.weg < 8) this.tipp(e); this.zeiger.delete(e.pointerId); this.zwick = 0; });
    rahmen.addEventListener('pointercancel', (e) => { this.zeiger.delete(e.pointerId); this.zwick = 0; });
  }

  // Ein neues Gelände (oder null = keins): Die Bilder werden beim nächsten Gebrauch neu gemalt
  setze(plan) {
    if (plan === this.plan) return;
    this.plan = plan; this.klein = null; this.gross = null; this.stand = null;
    this.el.hidden = !plan;
    this.el.classList.toggle('stadt', this.istStadt());      // im Städtchen steht nicht „Plan“ unter dem Radar
    if (!plan) this.zu();
  }
  istStadt() { return !!(this.plan && this.plan.g.zuFuss); }
  offen() { return !this.fenster.hidden; }

  // Das Radar, jedes Bild neu. s = { x, z, blick: wohin die Figur schaut, kamW: Winkel der Kamera, ziel: { x, z } oder null, punkte: [{ x, z, farbe }] }
  radar(s) {
    if (!this.plan) return;
    this.stand = s;
    if (!this.klein) this.klein = male(this.plan, false);
    const B = this.klein, c = this.bild, k = c.getContext('2d'), G = c.width, m = G / 2;
    const weit = this.istStadt() ? RADAR_STADT : RADAR_WEIT, mal = m / weit, dreh = s.kamW || 0;
    k.save(); k.clearRect(0, 0, G, G);
    k.beginPath(); k.arc(m, m, m, 0, 7); k.clip();
    k.fillStyle = '#b9d7a0'; k.fillRect(0, 0, G, G);
    k.translate(m, m); k.rotate(dreh); k.scale(mal / B.mass, mal / B.mass);
    k.drawImage(B.c, -(s.x - B.x0) * B.mass, -(s.z - B.z0) * B.mass);
    k.restore();
    const co = Math.cos(dreh), si = Math.sin(dreh);
    const punkt = (x, z, f, r, amRand) => {
      const dx = (x - s.x) * mal, dz = (z - s.z) * mal; let px = m + dx * co - dz * si, pz = m + dx * si + dz * co;
      const d = Math.hypot(px - m, pz - m);
      if (d > m - r - 5) { if (!amRand) return; px = m + (px - m) / d * (m - r - 5); pz = m + (pz - m) / d * (m - r - 5); }
      k.fillStyle = f; k.strokeStyle = '#1a2440'; k.lineWidth = 3; k.beginPath(); k.arc(px, pz, r, 0, 7); k.fill(); k.stroke();
    };
    for (const p of s.punkte || []) punkt(p.x, p.z, p.farbe, 9, true);
    if (s.ziel) punkt(s.ziel.x, s.ziel.z, '#ffd23a', 12 + Math.sin(performance.now() / 200) * 2.5, true);
    // du selbst: ein blauer Pfeil in der Mitte
    k.save(); k.translate(m, m); k.rotate(Math.PI - s.blick + dreh);
    k.fillStyle = '#1e66ff'; k.strokeStyle = '#ffffff'; k.lineWidth = 4; k.beginPath(); k.moveTo(0, -19); k.lineTo(14, 15); k.lineTo(0, 8); k.lineTo(-14, 15); k.closePath(); k.fill(); k.stroke();
    k.restore();
    const halb = c.clientWidth / 2, nr = halb - 9;                  // das N wandert am Rand mit, wenn sich das Radar dreht
    this.nord.style.left = `${halb + Math.sin(dreh) * nr}px`; this.nord.style.top = `${halb - Math.cos(dreh) * nr}px`;
  }

  // ---- der große Lageplan
  anwenden() {
    const rahmen = this.rahmen, c = this.plakat, a = this.ansicht, min = Math.min(rahmen.clientWidth / c.width, rahmen.clientHeight / c.height);
    a.mal = Math.max(min, Math.min(4, a.mal));
    const b = c.width * a.mal, h = c.height * a.mal;
    a.x = b <= rahmen.clientWidth ? (rahmen.clientWidth - b) / 2 : Math.max(rahmen.clientWidth - b, Math.min(0, a.x));
    a.y = h <= rahmen.clientHeight ? (rahmen.clientHeight - h) / 2 : Math.max(rahmen.clientHeight - h, Math.min(0, a.y));
    c.style.transform = `translate(${a.x}px, ${a.y}px) scale(${a.mal})`;
  }
  zoom(faktor, px, py) {
    const a = this.ansicht, alt = a.mal; a.mal *= faktor; this.anwenden();
    const f = a.mal / alt; a.x = px - (px - a.x) * f; a.y = py - (py - a.y) * f; this.anwenden();
  }
  auf(s) {
    if (!this.plan) return;
    const stadt = this.istStadt(), g = this.plan.g;
    this.fenster.querySelector('.titel').textContent = stadt ? 'Stadtplan' : `Lageplan ${g.name || ''}`;
    this.fenster.classList.toggle('stadt', stadt);
    this.fenster.hidden = false;
    if (stadt) {
      // Im Städtchen gibt es keinen Plan: Den Weg soll man selbst finden
      this.fenster.querySelector('.wo').textContent = '';
      this.fenster.querySelector('.tipp').textContent = 'Einen Stadtplan hast du leider nicht dabei. 🙈 Achte auf die gelben Wegweiser und auf das Radar: Der gelbe Punkt am Rand zeigt, in welcher Richtung das Hotel liegt.';
      return;
    }
    if (!this.gross) this.gross = male(this.plan, true);
    const B = this.gross, c = this.plakat; c.width = B.c.width; c.height = B.c.height;
    const k = c.getContext('2d'), kx = (x) => (x - B.x0) * B.mass, kz = (z) => (z - B.z0) * B.mass;
    k.drawImage(B.c, 0, 0);
    const marke = (x, z, f, r, text) => {
      k.fillStyle = f; k.strokeStyle = '#1a2440'; k.lineWidth = 3; k.beginPath(); k.arc(kx(x), kz(z), r, 0, 7); k.fill(); k.stroke();
      k.font = 'bold 14px system-ui, sans-serif'; k.textAlign = 'center'; k.lineWidth = 4; k.strokeStyle = '#fff'; k.strokeText(text, kx(x), kz(z) - r - 8); k.fillStyle = '#1a2440'; k.fillText(text, kx(x), kz(z) - r - 8);
    };
    if (s.ziel) marke(s.ziel.x, s.ziel.z, '#ffd23a', 10, 'Dein Ziel');
    marke(s.x, s.z, '#1e66ff', 9, 'Du');
    // Wo bin ich? Der nächste Ort mit Namen
    let nah = null, weit = 1e9;
    for (const o of this.plan.orte) { const d = Math.hypot(o.tx - s.x, o.tz - s.z); if (o.name && d < weit) { weit = d; nah = o; } }
    this.fenster.querySelector('.wo').textContent = nah ? (weit < 6 ? `Du stehst bei: ${nah.name}` : `In deiner Nähe: ${nah.name} (${Math.round(weit)} m)`) : '';
    const rahmen = this.rahmen, a = this.ansicht;
    // Zuerst das ganze Gelände bis zum Zaun zeigen (das Hotel draußen findet man durch Verschieben oder Verkleinern)
    const r = g.rand, mx = (r.x0 + r.x1) / 2, mz = (r.z0 + r.z1) / 2;
    a.mal = Math.min(rahmen.clientWidth / ((r.x1 - r.x0 + 24) * B.mass), rahmen.clientHeight / ((r.z1 - r.z0 + 24) * B.mass));
    a.x = rahmen.clientWidth / 2 - kx(mx) * a.mal; a.y = rahmen.clientHeight / 2 - kz(mz) * a.mal; this.anwenden();
  }
  zu() { this.fenster.hidden = true; this.zeiger.clear(); }
  // Ein Tipp auf den Plan: Liegt ein Ort in der Nähe, läuft die Figur dorthin
  tipp(e) {
    if (!this.gross || this.istStadt()) return;
    const B = this.gross, a = this.ansicht, r = this.rahmen.getBoundingClientRect();
    const bx = (e.clientX - r.left - a.x) / a.mal, by = (e.clientY - r.top - a.y) / a.mal;         // Stelle auf dem Kartenbild
    let nah = null, weit = TIPP_NAH / a.mal;
    for (const o of this.plan.orte) { const d = Math.hypot((o.tx - B.x0) * B.mass - bx, (o.tz - B.z0) * B.mass - by); if (d < weit) { weit = d; nah = o; } }
    if (nah && this.wennOrt) { this.zu(); this.wennOrt(nah); }
  }
}
