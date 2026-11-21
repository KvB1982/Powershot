// Powershot – das Handy als Tennisschläger, verbunden über einen QR-Code.
// Vorbild: das Handy als Lenkrad im Schwester-Spiel Rennspiel (KvB1982/rennspiel, js/verbindung.js).
//   1. Das Spiel denkt sich einen Code aus (z. B. "K7QM") und zeigt ihn als QR-Code (Einstellungen → „Handy als Schläger“).
//   2. Das Handy scannt ihn und öffnet die Schläger-Seite (schlaeger.html).
//   3. Ein Vermittler im Internet (PeerJS) stellt die beiden einander vor. Danach reden sie direkt miteinander (WebRTC).
// Das Handy schickt 60-mal pro Sekunde, wie stark es gerade bewegt wird. Das Spiel behandelt es wie einen Controller
// mit Bewegungssensor (`Controls.setPad` → `fuehleSchwung` in controls.js) – dieselbe Erkennung wie beim iPhone-Schläger in der iOS-App.
// Zum Testen ohne Internet geht es auch zwischen zwei Fenstern desselben Browsers (BroadcastChannel, Adresse mit &lokal).
// Ohne three.js.

const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const QRCODE = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const VORSILBE = 'powershot-schlaeger-';
const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';        // ohne 0/O und 1/I/L – die verwechselt man leicht
const SEITE = 'https://kvb1982.github.io/Powershot/schlaeger.html';
const CODE_MERKEN = 'powershot.schlaegercode.v1';

const skripte = {};
function skript(url, name) {
  if (window[name]) return Promise.resolve(window[name]);
  return skripte[url] || (skripte[url] = new Promise((ok, nein) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = () => ok(window[name]); s.onerror = () => { delete skripte[url]; nein(new Error(name + ' nicht geladen')); };
    document.head.appendChild(s);
  }));
}
export const neuerCode = () => Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join('');

// ---------------------------------------------------------------- Spiel-Seite: wartet auf das Handy
export class SchlaegerEmpfang {
  constructor() {
    this.status = 'aus';      // aus, laden, bereit, verbunden, fehler
    this.code = null; this.geraet = ''; this.letzte = 0;
    this.verbindungen = new Set();
    this.wennDaten = null; this.wennStatus = null;
  }
  setzeStatus(s) { if (this.status !== s) { this.status = s; if (this.wennStatus) this.wennStatus(s); } }

  async start() {
    if (this.status !== 'aus' && this.status !== 'fehler') return;
    let gemerkt = null;
    try { gemerkt = localStorage.getItem(CODE_MERKEN); } catch (e) { /* dann ein neuer Code */ }
    this.code = gemerkt && /^[A-Z0-9]{4}$/.test(gemerkt) ? gemerkt : neuerCode();
    this.setzeStatus('laden');
    this.kanalOeffnen();
    try { this.peerStarten(await skript(PEERJS, 'Peer'), 0); } catch (e) { this.setzeStatus('fehler'); }
  }
  // Zum Testen: Schläger-Seite im zweiten Fenster desselben Browsers
  kanalOeffnen() {
    if (!('BroadcastChannel' in window)) return;
    if (this.kanal) this.kanal.close();
    this.kanal = new BroadcastChannel(VORSILBE + this.code);
    this.kanal.onmessage = (e) => this.empfangen(e.data, { send: (m) => this.kanal.postMessage({ an: 'handy', ...m }) });
  }
  peerStarten(Peer, versuch) {
    const peer = this.peer = new Peer(VORSILBE + this.code.toLowerCase(), { debug: 0 });
    peer.on('open', () => { try { localStorage.setItem(CODE_MERKEN, this.code); } catch (e) { /* egal */ } if (this.status !== 'verbunden') this.setzeStatus('bereit'); });
    peer.on('connection', (conn) => {
      conn.on('open', () => { this.verbindungen.add(conn); });
      conn.on('data', (d) => this.empfangen(d, conn));
      conn.on('close', () => { this.verbindungen.delete(conn); if (!this.verbindungen.size) this.setzeStatus('bereit'); });
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && versuch < 4) {
        // Der Code ist schon vergeben (z. B. noch offen in einem anderen Fenster): einen neuen nehmen
        peer.destroy(); this.code = neuerCode(); this.kanalOeffnen(); this.peerStarten(Peer, versuch + 1);
        if (this.wennStatus) this.wennStatus(this.status);
      } else if ((e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') && this.status !== 'verbunden') this.setzeStatus('fehler');
    });
    peer.on('disconnected', () => { setTimeout(() => { if (!peer.destroyed) try { peer.reconnect(); } catch (e) { /* später noch einmal */ } }, 3000); });
  }
  empfangen(d, conn) {
    if (!d || typeof d !== 'object' || d.an === 'handy') return;
    this.letzte = performance.now();
    if (d.t === 'hallo') this.geraet = String(d.name || 'Handy').slice(0, 30);
    this.antwort = conn;
    this.setzeStatus('verbunden');
    if (this.wennDaten) this.wennDaten(d);
  }
  // Kommt länger nichts mehr an (Handy gesperrt, Seite zu)? Dann gilt es als getrennt. Einmal pro Bild aufrufen.
  pruefen() {
    if (this.status === 'verbunden' && performance.now() - this.letzte > 2500) this.setzeStatus(this.peer || this.kanal ? 'bereit' : 'fehler');
  }
  senden(m) { if (this.antwort) try { this.antwort.send(m); } catch (e) { /* Verbindung weg */ } }
  // Adresse für den QR-Code: immer die Seite im Internet (https) – Bewegungssensoren gehen nur dort, und „localhost“ findet das Handy nicht
  adresse() { return `${SEITE}?c=${this.code}`; }
}

// ---------------------------------------------------------------- Handy-Seite: verbindet sich mit dem Spiel
export class SchlaegerSender {
  constructor(code, lokal = false) {
    this.code = (code || '').toUpperCase(); this.lokal = lokal;
    this.status = 'aus'; this.conn = null; this.wennDaten = null; this.wennStatus = null;
  }
  setzeStatus(s) { if (this.status !== s) { this.status = s; if (this.wennStatus) this.wennStatus(s); } }
  async verbinden() {
    this.setzeStatus('suchen');
    if (this.lokal && 'BroadcastChannel' in window) {
      this.kanal = new BroadcastChannel(VORSILBE + this.code);
      this.kanal.onmessage = (e) => { if (e.data && e.data.an === 'handy' && this.wennDaten) this.wennDaten(e.data); };
      this.conn = { send: (m) => this.kanal.postMessage(m) };
      this.setzeStatus('verbunden');
      this.senden({ t: 'hallo', name: 'Testfenster' });
      return;
    }
    try {
      const Peer = await skript(PEERJS, 'Peer');
      if (this.peer) this.peer.destroy();
      const peer = this.peer = new Peer({ debug: 0 });
      peer.on('open', () => this.anrufen());
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') { this.setzeStatus('nichtGefunden'); setTimeout(() => this.anrufen(), 2500); }
        else if (e.type === 'network' || e.type === 'server-error') { this.setzeStatus('fehler'); setTimeout(() => this.verbinden(), 4000); }
      });
    } catch (e) { this.setzeStatus('fehler'); setTimeout(() => this.verbinden(), 4000); }
  }
  anrufen() {
    if (!this.peer || this.peer.destroyed) return;
    const conn = this.peer.connect(VORSILBE + this.code.toLowerCase(), { serialization: 'json' });
    conn.on('open', () => { this.conn = conn; this.setzeStatus('verbunden'); this.senden({ t: 'hallo', name: geraeteName() }); });
    conn.on('data', (d) => { if (this.wennDaten) this.wennDaten(d); });
    conn.on('close', () => { this.conn = null; this.setzeStatus('suchen'); setTimeout(() => this.anrufen(), 1500); });
  }
  senden(m) { if (this.conn) try { this.conn.send(m); } catch (e) { /* Verbindung weg */ } }
}
function geraeteName() {
  const u = navigator.userAgent;
  return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android-Handy' : 'Handy';
}

// Bewegung des Handys (Ereignis „devicemotion“) in die Zahlen umrechnen, die das Spiel erwartet:
// a = Beschleunigung der Hand ohne Erdanziehung (in g), g = Richtung „unten“ (Länge 1).
// iPhone und Android melden die Erdanziehung mit umgekehrtem Vorzeichen – deshalb „apfel“.
export function bewegungAus(e, apfel) {
  const a = e.acceleration, mit = e.accelerationIncludingGravity;
  if (!a || a.x == null || !mit || mit.x == null) return null;
  const G = 9.81, v = apfel ? 1 : -1;
  let gx = (mit.x - a.x) * v, gy = (mit.y - a.y) * v, gz = (mit.z - a.z) * v;
  const l = Math.hypot(gx, gy, gz) || 1;
  gx /= l; gy /= l; gz /= l;
  return { ax: a.x / G, ay: a.y / G, az: a.z / G, gx, gy, gz };
}

// Einen QR-Code auf eine Malfläche malen (Bibliothek qrcode-generator)
export async function qrMalen(cv, text) {
  const k = cv.getContext('2d'), W = cv.width;
  try {
    const lib = await skript(QRCODE, 'qrcode');
    const q = lib(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), rand = 8, z = (W - rand * 2) / n;
    k.fillStyle = '#fff'; k.fillRect(0, 0, W, W); k.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) k.fillRect(rand + c * z, rand + r * z, Math.ceil(z), Math.ceil(z));
  } catch (e) {
    k.fillStyle = '#fff'; k.fillRect(0, 0, W, W); k.fillStyle = '#000'; k.font = '15px sans-serif'; k.textAlign = 'center';
    k.fillText('QR-Code geht gerade nicht', W / 2, W / 2 - 10); k.fillText('(kein Internet?)', W / 2, W / 2 + 14);
  }
}
