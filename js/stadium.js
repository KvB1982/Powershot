// Powershot – das Stadion: Platz, Linien, Netz, Banden, Tribünen, Zuschauer, Licht

import * as THREE from 'three';
import { COURT as C, netHeightAt } from './physics.js';
import { ladeRequisiten, requisit } from './requisiten.js';

const RUN_X = 10.5;     // Auslauf seitlich (halbe Breite der Arena-Fläche)
const RUN_Z = 19.5;     // Auslauf hinten

function shade(hex, k) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(k);
}

// Bodenbelag als Bild: leichtes Rauschen, bei Rasen Mähstreifen
function surfaceTexture(surface, hex) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const col = new THREE.Color(hex);
  g.fillStyle = '#' + col.getHexString();
  g.fillRect(0, 0, 256, 256);
  if (surface === 'grass') {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      g.fillRect(0, i * 32, 256, 32);
    }
  }
  const n = surface === 'clay' ? 9000 : 5000;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * (surface === 'clay' ? 0.10 : 0.05);
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function netTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(15,15,15,0.85)';
  g.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
  for (let y = 0; y <= 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

// Erfundene Firmen für die Bandenwerbung – keine davon gibt es wirklich.
// zeichen = kleines Bildchen vor dem Namen: 'blitz', 'kreis', 'welle', 'stern', 'pfeil', 'ball'
const WERBUNG = [
  ['BLITZ SPORT', 'blitz'], ['DONNER DRINKS', 'kreis'], ['FLITZ AIR', 'pfeil'], ['QUELLO WASSER', 'welle'],
  ['ZACK MOBIL', 'stern'], ['TURBO UHREN', 'kreis'], ['GELBFILZ BÄLLE', 'ball'], ['BANK VON MORGEN', 'stern'],
];

// Malt ein kleines Zeichen (Höhe h) an die Stelle x, y und gibt zurück, wie breit es war
function werbeZeichen(g, art, x, y, h) {
  g.save();
  g.translate(x, y);
  g.lineWidth = h * 0.12; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  if (art === 'blitz') { g.moveTo(h * 0.55, -h / 2); g.lineTo(h * 0.1, h * 0.08); g.lineTo(h * 0.45, h * 0.08); g.lineTo(h * 0.25, h / 2); g.lineTo(h * 0.8, -h * 0.12); g.lineTo(h * 0.45, -h * 0.12); g.closePath(); g.fill(); }
  else if (art === 'kreis') { g.arc(h / 2, 0, h * 0.4, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(h / 2, 0, h * 0.16, 0, Math.PI * 2); g.fill(); }
  else if (art === 'pfeil') { g.moveTo(0, h * 0.3); g.lineTo(h * 0.9, -h * 0.35); g.lineTo(h * 0.45, -h * 0.3); g.moveTo(h * 0.9, -h * 0.35); g.lineTo(h * 0.75, h * 0.1); g.stroke(); }
  else if (art === 'welle') { for (const dy of [-0.2, 0.2]) { g.moveTo(0, h * dy); g.bezierCurveTo(h * 0.25, h * (dy - 0.35), h * 0.5, h * (dy + 0.35), h * 0.9, h * dy); } g.stroke(); }
  else if (art === 'stern') { for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.2 : h * 0.48, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(h / 2 + Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
  else { g.arc(h / 2, 0, h * 0.42, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = h * 0.07; g.beginPath(); g.arc(-h * 0.1, 0, h * 0.5, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(h * 1.1, 0, h * 0.5, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); }
  g.restore();
  return h;
}

// Die Bande: Farbe des Turniers, darauf abwechselnd der Turniername und erfundene Werbung in Weiß.
// start = bei welcher Firma angefangen wird (damit nicht alle vier Banden gleich aussehen)
function bannerTexture(text, bg, start = 0) {
  const cv = document.createElement('canvas');
  cv.width = 2048; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 2048, 128);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 2048, 6);      // heller Rand oben
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 118, 2048, 10);          // dunkler Sockel unten
  g.fillStyle = g.strokeStyle = '#ffffff';
  g.textBaseline = 'middle';
  let x = 40, i = 0;
  while (x < 1900) {
    const name = i % 2 === 0;                    // abwechselnd Turniername und Werbung
    const [s, art] = name ? [text, null] : WERBUNG[(start + (i >> 1)) % WERBUNG.length];
    g.font = (name ? 'bold 62px' : 'bold italic 50px') + ' Arial, sans-serif';
    g.globalAlpha = name ? 1 : 0.88;
    const breit = g.measureText(s).width + (art ? 64 : 0);
    if (x + breit > 2010) break;
    if (art) x += werbeZeichen(g, art, x, 62, 48) + 16;
    g.fillText(s, x, 66);
    x += g.measureText(s).width + 110;
    i++;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Das leuchtende Werbeband oben am Rang: bunte Felder mit erfundener Werbung
function ledTexture(start) {
  const cv = document.createElement('canvas');
  cv.width = 2048; cv.height = 64;
  const g = cv.getContext('2d');
  const farben = ['#0e2a5a', '#7a1420', '#0f5a3a', '#3a1a6a', '#1a1a22', '#8a4a0a'];
  const n = 6, w = 2048 / n;
  g.textBaseline = 'middle'; g.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    g.fillStyle = farben[(i + start) % farben.length]; g.fillRect(i * w, 0, w, 64);
    g.fillStyle = '#ffffff'; g.font = 'bold 30px Arial, sans-serif';
    g.fillText(i % 3 === 0 ? 'POWERSHOT' : WERBUNG[(i + start * 3) % WERBUNG.length][0], i * w + w / 2, 34);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Stahlträger von unten gesehen (für Dach und Hallendecke): dunkle Fläche mit hellen Streben
function traegerTexture(hell) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = hell ? '#c8ccd2' : '#14161c'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = hell ? '#8a9098' : '#3a3f4a'; g.lineWidth = 6;
  g.strokeRect(0, 0, 128, 128);
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Ein Flutlicht von vorn: viele einzelne Lampen in einem Gitter. an = leuchten sie?
function lampenTexture(an) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#1c1f26'; g.fillRect(0, 0, 128, 64);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = an ? '#fffbe6' : '#7c8590';
    g.beginPath(); g.arc(8 + x * 16, 8 + y * 16, 5.6, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Weicher Lichtschein um eine Lampe
function scheinTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const v = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  v.addColorStop(0, 'rgba(255,250,225,1)'); v.addColorStop(0.25, 'rgba(255,245,210,0.45)'); v.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// Mähstreifen für den Rasen (durchsichtig, liegt über dem Rasenbild)
function streifenTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 64;
  const g = cv.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'; g.fillRect(0, i * 8, 4, 8); }
  return new THREE.CanvasTexture(cv);
}

export class Stadium {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.lights = [];
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 512; this.boardCanvas.height = 256;
  }

  clear() {
    if (!this.group) return;
    this.group.traverse((o) => {
      // Formen und Bilder der fertigen Modelle (requisiten.js) werden weiter gebraucht – die bleiben
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (m.map && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
      }
    });
    this.scene.remove(this.group);
    for (const l of this.lights) this.scene.remove(l);
    this.lights = [];
    this.group = null;
  }

  // def = Turnier aus data.js, quality = 'hoch' | 'niedrig'
  build(def, quality = 'hoch') {
    this.clear();
    const th = def.theme, G = this.group = new THREE.Group();
    this.scene.add(G);
    const night = th.night, indoor = def.surface === 'indoor';
    const gross = (def.zuschauer ?? 1) >= 0.6;      // großes Turnier? Dann gibt es Ballkinder, Linienrichter und ein Dach
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.sky, 70, 190);
    const lader = new THREE.TextureLoader();

    const box = (w, h, d, color, x, y, z, opts = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.9, map: opts.map || null }));
      m.position.set(x, y, z);
      m.receiveShadow = opts.receive ?? true;
      m.castShadow = opts.cast ?? false;
      G.add(m);
      return m;
    };
    const flat = (w, d, color, x, y, z, map) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, roughness: 0.95, map: map || null }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      G.add(m);
      return m;
    };

    // --- Boden und Platz ---
    flat(400, 400, shade(th.outer, 0.35), 0, -0.02, 0);
    const outerTex = surfaceTexture(def.surface, th.outer); outerTex.repeat.set(6, 10);
    const aussen = flat(RUN_X * 2, RUN_Z * 2, 0, 0, 0, 0, outerTex);
    const courtTex = surfaceTexture(def.surface, th.court); courtTex.repeat.set(4, 8);
    const feld = flat(C.WD * 2, C.L * 2, 0, 0, 0.004, 0, courtTex);
    // Echter Belag als Bild (Sand, Rasen oder Hartplatz). Das Bild ist grau – die Farbe kommt vom Turnier.
    // Bis es geladen ist (oder wenn es fehlt), sieht man den einfachen gemalten Belag von oben.
    const belag = def.surface === 'clay' ? 'sand' : def.surface === 'grass' ? 'rasen' : 'hart';
    for (const [fl, farbe, bx, bz] of [[aussen, th.outer, RUN_X * 2, RUN_Z * 2], [feld, th.court, C.WD * 2, C.L * 2]]) {
      lader.load(`assets/boden_${belag}.jpg`, (tex) => {
        if (this.group !== G) { tex.dispose(); return; }           // inzwischen wurde ein anderes Stadion gebaut
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        tex.repeat.set(bx / 3.2, bz / 3.2);                         // ein Bild bedeckt etwa 3 Meter
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        fl.material.map.dispose();
        fl.material.map = tex;
        fl.material.color.set(farbe).multiplyScalar(1.28);          // das Bild ist etwas dunkler als Weiß – das gleichen wir aus
        fl.material.needsUpdate = true;
      });
    }
    if (def.surface === 'grass') {
      const st = streifenTexture(); st.wrapT = THREE.RepeatWrapping; st.repeat.set(1, 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(RUN_X * 2, RUN_Z * 2), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.006; G.add(m);
    }

    // --- Linien ---
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const line = (x0, z0, x1, z1, w = 0.05) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x0 === x1 ? w : len + w, x0 === x1 ? len + w : w), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.009, (z0 + z1) / 2);
      G.add(m);
    };
    for (const s of [-1, 1]) {
      line(s * C.WD, -C.L, s * C.WD, C.L);
      line(s * C.W, -C.L, s * C.W, C.L);
      line(-C.WD, s * C.L, C.WD, s * C.L, 0.1);
      line(-C.W, s * C.SL, C.W, s * C.SL);
      line(0, s * C.L, 0, s * (C.L - 0.15));
    }
    line(0, -C.SL, 0, C.SL);

    // --- Netz ---
    const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    // Das Netz hängt durch: an den Pfosten 1,07 m hoch, in der Mitte zieht es ein Gurt auf 0,914 m herunter (echte Maße).
    // Genau so rechnet auch der Ball (netHeightAt in physics.js) – was du siehst, ist jetzt das, was gilt.
    const netGeo = new THREE.PlaneGeometry(C.NET_W * 2, 1, 2, 1);
    const ecken = netGeo.attributes.position;
    for (let i = 0; i < ecken.count; i++) ecken.setY(i, ecken.getY(i) > 0 ? netHeightAt(ecken.getX(i)) : 0);
    const net = new THREE.Mesh(netGeo, netMat);
    G.add(net);
    // Weißes Band oben: zwei gerade Stücke, vom Pfosten schräg hinunter zur Mitte
    const schraeg = Math.atan2(C.NET_POST - C.NET_H, C.NET_W);
    for (const s of [-1, 1]) {
      const tape = box(Math.hypot(C.NET_W, C.NET_POST - C.NET_H), 0.07, 0.03, 0xffffff, s * C.NET_W / 2, (C.NET_H + C.NET_POST) / 2 - 0.035, 0, { cast: true, rough: 0.6 });
      tape.rotation.z = s * schraeg;
      tape.material.side = THREE.DoubleSide;
    }
    box(0.05, C.NET_H - 0.03, 0.02, 0xffffff, 0, (C.NET_H - 0.03) / 2, 0);        // der Gurt in der Mitte
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, C.NET_POST, 10), new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.5 }));
      post.position.set(s * C.NET_W, C.NET_POST / 2, 0);
      post.castShadow = true;
      G.add(post);
    }

    // --- Schiedsrichterstuhl, Bänke, Ballkinder, Linienrichter ---
    const chairX = -(C.NET_W + 1.2);
    // Erst die einfachen Klötze hinstellen. Sobald die richtigen Modelle geladen sind, werden sie ausgetauscht.
    const kloetze = new THREE.Group();
    G.add(kloetze);
    const klotz = (...a) => { const m = box(...a); kloetze.add(m); return m; };
    klotz(0.7, 1.9, 0.7, 0x2a4a3a, chairX, 0.95, 0, { cast: true });
    klotz(0.8, 0.5, 0.75, 0x1f3a2a, chairX, 2.1, 0, { cast: true });
    klotz(0.5, 0.6, 0.35, 0x24406a, chairX, 2.45, 0, { cast: true });
    for (const s of [-1, 1]) {
      klotz(0.6, 0.45, 2.2, 0x3a3a44, chairX - 0.3, 0.22, s * 4, { cast: true });
      klotz(0.15, 0.9, 2.2, 0x3a3a44, chairX - 0.65, 0.45, s * 4, { cast: true });
    }
    ladeRequisiten().then(() => {
      if (this.group !== G) return;                 // inzwischen wurde ein anderes Stadion gebaut
      // stellt ein Modell an die Stelle x, z und dreht es so, dass es in Richtung (bx, bz) schaut
      const stelle = (name, x, z, bx, bz, opts) => {
        const m = requisit(name, opts);
        if (!m) return null;
        m.position.set(x, 0, z);
        m.rotation.y = Math.atan2(bx, bz);
        G.add(m);
        return m;
      };
      const stuhl = stelle('schiedsrichter', chairX, 0, 1, 0);
      const bank1 = stelle('bank', chairX - 0.5, 4.2, 1, 0), bank2 = stelle('bank', chairX - 0.5, -4.2, 1, 0);
      if (stuhl && bank1 && bank2) G.remove(kloetze);
      if (!gross || quality === 'niedrig') return;  // kleine Turniere haben keine Ballkinder und Linienrichter
      const hemd = { farbe: shade(th.wall, 1.5), hell: [0.3, 0.72] };       // Kleidung in der Farbe des Turniers
      // Ballkinder: zwei am Netz, vier hinten in den Ecken
      stelle('ballkind', C.NET_W + 1.3, 0, -1, 0, hemd);
      stelle('ballkind', chairX - 0.2, -1.5, 1, 0, hemd);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stelle('ballkind', sx * (RUN_X - 1.6), sz * (RUN_Z - 0.7), 0, -sz, hemd);
      // Linienrichter: an den Grundlinien (schauen die Linie entlang) und hinten an den Seitenlinien
      for (const sz of [-1, 1]) stelle('linienrichter', RUN_X - 1.0, sz * C.L, -1, 0);
      for (const sx of [-1, 1]) stelle('linienrichter', sx * C.W, -(RUN_Z - 0.9), 0, 1);
    });

    // --- Banden mit Schriftzug ---
    const wallH = 1.05;
    const bg = '#' + new THREE.Color(th.wall).getHexString();
    // Jede der vier Banden bekommt den Turniernamen und andere erfundene Werbung.
    // Ein Kasten hat 6 Seiten: Nur die beiden langen Seiten bekommen das Bild, der Rest ist einfarbig.
    const bande = (w, d, x, z, start) => {
      const lang = w > d;
      const bild = new THREE.MeshStandardMaterial({ map: bannerTexture(def.name.toUpperCase(), bg, start), roughness: 0.85 });
      const glatt = new THREE.MeshStandardMaterial({ color: shade(th.wall, 0.8), roughness: 0.9 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), lang ? [glatt, glatt, glatt, glatt, bild, bild] : [bild, bild, glatt, glatt, glatt, glatt]);
      m.position.set(x, wallH / 2, z);
      m.receiveShadow = true;
      G.add(m);
    };
    bande(0.3, RUN_Z * 2, -RUN_X, 0, 0); bande(0.3, RUN_Z * 2, RUN_X, 0, 2);
    bande(RUN_X * 2, 0.3, 0, -RUN_Z, 4); bande(RUN_X * 2, 0.3, 0, RUN_Z, 6);

    // --- Tribünen ---
    const rows = quality === 'niedrig' ? 9 : 14;
    const stepD = 0.95, stepH = 0.5;
    const seatCol = th.seats;
    const beton = new THREE.Color(0x8d9096).lerp(new THREE.Color(seatCol), 0.25);     // die Stufen sind aus Beton
    const seats = [];   // Sitzplätze für Zuschauer: {x,y,z} und die Blickrichtung zum Platz {nx,nz}
    const GANG = 14;    // nach so vielen Sitzen kommt ein Treppen-Aufgang (dort sitzt niemand)
    for (let r = 0; r < rows; r++) {
      const y = wallH + r * stepH;
      const off = 0.6 + r * stepD;
      for (const s of [-1, 1]) {
        // Längsseiten
        const lenZ = (RUN_Z + off) * 2;
        box(stepD, y, lenZ, shade(beton, 0.8 + (r % 2) * 0.08), s * (RUN_X + off), y / 2, 0);
        let i = 0;
        for (let z = -RUN_Z; z <= RUN_Z; z += 0.62) if (i++ % GANG !== 7) seats.push({ x: s * (RUN_X + off), y, z, nx: -s, nz: 0 });
        // Kopfseiten
        const lenX = (RUN_X + off) * 2;
        box(lenX, y, stepD, shade(beton, 0.8 + (r % 2) * 0.08), 0, y / 2, s * (RUN_Z + off));
        i = 0;
        for (let x = -RUN_X; x <= RUN_X; x += 0.62) if (i++ % GANG !== 7) seats.push({ x, y, z: s * (RUN_Z + off), nx: 0, nz: -s });
      }
    }
    // Auf jedem Platz steht eine Sitzschale: eine Sitzfläche und eine Lehne in der Farbe des Turniers.
    // Alle Sitze zusammen werden in nur zwei Schritten gezeichnet – das schafft auch das iPad.
    if (quality !== 'niedrig') {
      const sitzMat = new THREE.MeshLambertMaterial({ color: shade(seatCol, night ? 0.85 : 1.1) });
      const flaeche = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), sitzMat, seats.length);
      const lehne = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.4, 0.06), sitzMat, seats.length);
      const hilf = new THREE.Object3D();
      seats.forEach((p, i) => {
        hilf.rotation.y = Math.atan2(p.nx, p.nz);                    // der Sitz schaut zum Platz
        hilf.position.set(p.x, p.y + 0.2, p.z); hilf.updateMatrix(); flaeche.setMatrixAt(i, hilf.matrix);
        hilf.position.set(p.x - p.nx * 0.2, p.y + 0.42, p.z - p.nz * 0.2); hilf.updateMatrix(); lehne.setMatrixAt(i, hilf.matrix);
      });
      flaeche.frustumCulled = lehne.frustumCulled = false;
      G.add(flaeche, lehne);
    }
    // Geländer oben auf der Bande, vor der ersten Reihe
    for (const s of [-1, 1]) {
      box(0.06, 0.06, RUN_Z * 2 + 1.2, 0xd8dce2, s * (RUN_X + 0.15), wallH + 0.45, 0, { rough: 0.4 });
      box(RUN_X * 2 + 1.2, 0.06, 0.06, 0xd8dce2, 0, wallH + 0.45, s * (RUN_Z + 0.15), { rough: 0.4 });
    }
    const topY = wallH + rows * stepH, topOff = 0.6 + rows * stepD;
    // Oberer Rand der Arena: eine Wand, daran ein leuchtendes Werbeband
    const randX = RUN_X + topOff + 0.6, randZ = RUN_Z + topOff + 0.6;
    for (const s of [-1, 1]) {
      box(1.2, 2.2, randZ * 2 + 1.2, shade(th.wall, 0.7), s * randX, topY + 1.1, 0);
      box(randX * 2 + 1.2, 2.2, 1.2, shade(th.wall, 0.7), 0, topY + 1.1, s * randZ);
      const led = (w, x, z, drehY, start) => {
        const t = ledTexture(start); t.repeat.set(Math.round(w / 30) || 1, 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), new THREE.MeshBasicMaterial({ map: t, color: night || indoor ? 0xffffff : 0xd0d0d0 }));
        m.position.set(x, topY + 1.3, z); m.rotation.y = drehY; G.add(m);
      };
      led(randZ * 2, s * (randX - 0.62), 0, -s * Math.PI / 2, s + 1);
      led(randX * 2, 0, s * (randZ - 0.62), s > 0 ? Math.PI : 0, s + 2);
    }

    // --- Dach über den beiden langen Tribünen (nur bei großen Turnieren unter freiem Himmel) ---
    // Es ragt von der Rückwand schräg nach vorn und wird von Stahlträgern gehalten.
    if (gross && !indoor) {
      const tief = 9, hoch = topY + 8.5, neig = 0.14;      // so hoch, dass die Kamera im Menü darunter durchfliegen kann
      for (const s of [-1, 1]) {
        const mitte = s * (randX - tief / 2 + 0.6);
        const unten = traegerTexture(true); unten.repeat.set(3, Math.round(randZ * 2 / 3));
        const dach = new THREE.Mesh(new THREE.BoxGeometry(tief, 0.25, randZ * 2 + 1.2),
          new THREE.MeshStandardMaterial({ color: night ? 0x9aa0aa : 0xffffff, map: unten, roughness: 0.8 }));
        dach.position.set(mitte, hoch + 0.6, 0);
        dach.rotation.z = s * neig;                  // vorn etwas höher als hinten
        G.add(dach);
        // Stützen hinten und schräge Träger nach vorn
        for (let z = -randZ; z <= randZ + 0.1; z += randZ / 4) {
          box(0.35, 6.9, 0.35, 0x5a6068, s * (randX + 0.2), topY + 5.55, z, { rough: 0.5 });
          const arm = box(tief * 0.8, 0.22, 0.22, 0x5a6068, s * (randX - tief * 0.38), hoch + 0.25, z, { rough: 0.5 });
          arm.rotation.z = s * (neig + 0.1);
        }
      }
    }

    // --- Flutlicht-Masten: abends leuchten sie, am Tag sind die Lampen aus ---
    if (!indoor) {
      const mastH = topY + (gross ? 17 : 12);
      const lampenBild = lampenTexture(night), schein = night ? scheinTexture() : null;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const mx = sx * (RUN_X + topOff + 4), mz = sz * (RUN_Z + topOff + 4);
        // Der Mast wird nach oben dünner
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, mastH, 8), new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.5, metalness: 0.3 }));
        mast.position.set(mx, mastH / 2, mz);
        G.add(mast);
        // Oben der Kopf: ein Rahmen mit drei Reihen Lampen, zum Platz geneigt
        const kopf = new THREE.Group();
        kopf.position.set(mx, mastH + 0.6, mz);
        kopf.lookAt(0, 0, 0);
        for (let r = 0; r < 3; r++) {
          const reihe = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: lampenBild, fog: false }));
          reihe.position.set(0, (r - 1) * 1.3, 0.16);
          kopf.add(reihe);
        }
        const rahmen = new THREE.Mesh(new THREE.BoxGeometry(5, 4.1, 0.25), new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.6 }));
        kopf.add(rahmen);
        G.add(kopf);
        if (schein) {
          const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: schein, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.9 }));
          s2.position.set(mx * 0.985, mastH + 0.6, mz * 0.985);
          s2.scale.set(16, 16, 1);
          G.add(s2);
        }
      }
    }

    // --- Himmel: ein großes Rundum-Bild mit Wolken (am Tag) oder einer Stadt bei Nacht ---
    if (!indoor) {
      const farbeOben = night ? 0x070f18 : 0x4894d2;       // in diese Farbe läuft das Bild oben aus
      lader.load(`assets/himmel_${night ? 'abend' : 'tag'}.jpg`, (tex) => {
        if (this.group !== G) { tex.dispose(); return; }
        tex.wrapS = THREE.MirroredRepeatWrapping; tex.repeat.set(2, 1);     // gespiegelt aneinander: so gibt es keine Naht
        tex.colorSpace = THREE.SRGBColorSpace;
        const rund = new THREE.Mesh(new THREE.CylinderGeometry(260, 260, 130, 40, 1, true),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
        rund.position.y = 58;
        rund.renderOrder = -1;
        G.add(rund);
        this.scene.background = new THREE.Color(farbeOben);
      });
    }

    // --- Zuschauer ---
    // Bei kleinen Turnieren sitzen nur wenige Leute auf der Tribüne (def.zuschauer, 1 = voll)
    const fill = (quality === 'niedrig' ? 0.45 : 0.86) * (def.zuschauer ?? 1);
    const people = seats.filter(() => Math.random() < fill);
    this.zuschauerBauen(G, people, night);

    // --- Große Anzeigetafel am hinteren Ende ---
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: this.boardTex }));
    board.position.set(0, topY + 5.2, -(RUN_Z + topOff + 0.4));
    G.add(board);
    box(11.6, 6.1, 0.4, 0x111318, 0, topY + 5.2, -(RUN_Z + topOff + 0.7));
    this.setBoard([def.name, def.city], '');

    // --- Halle: Decke mit Stahlträgern und Reihen von Lampen ---
    if (indoor) {
      const tt = traegerTexture(false); tt.repeat.set(14, 18);
      const roof = flat(randX * 2 + 6, randZ * 2 + 6, 0, 0, topY + 13, 0, tt);
      roof.rotation.x = Math.PI / 2;
      roof.material.color.set(0x9a9aa4);
      // Wände zwischen Rang und Decke
      for (const s of [-1, 1]) {
        box(0.6, 12, randZ * 2 + 6, 0x101218, s * (randX + 2.8), topY + 7, 0);
        box(randX * 2 + 6, 12, 0.6, 0x101218, 0, topY + 7, s * (randZ + 2.8));
      }
      // Lampen-Felder an der Decke (sie leuchten nur zum Ansehen, das echte Licht kommt von unten im Abschnitt "Licht")
      const lampe = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff8e0, fog: false }), 40);
      const hilf = new THREE.Object3D();
      hilf.rotation.x = Math.PI / 2;
      let n = 0;
      for (let ix = -2; ix <= 2; ix++) for (let iz = -3.5; iz <= 3.5; iz++) {
        hilf.position.set(ix * 7.5, topY + 12.9, iz * 8); hilf.updateMatrix(); lampe.setMatrixAt(n++, hilf.matrix);
      }
      G.add(lampe);
    }

    // --- Licht ---
    const hemi = new THREE.HemisphereLight(night ? 0x8a94b8 : 0xffffff, night ? 0x202028 : shade(th.outer, 0.6), night ? 0.85 : 1.15);
    const sun = new THREE.DirectionalLight(night ? 0xfff2dc : 0xfff6e6, night ? 2.0 : 2.4);
    sun.position.set(night ? 6 : 14, 34, night ? 8 : 12);
    sun.castShadow = quality !== 'niedrig';
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 24; sc.bottom = -24; sc.near = 5; sc.far = 80;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(hemi, sun);
    this.lights.push(hemi, sun);
    if (night) {
      const fillL = new THREE.DirectionalLight(0xdfe8ff, 0.9);
      fillL.position.set(-12, 25, -14);
      this.scene.add(fillL);
      this.lights.push(fillL);
    }
    this.topY = topY;
  }

  // ---------------------------------------------------------------
  // Zuschauer
  // ---------------------------------------------------------------
  // Jeder Zuschauer ist nur eine flache Bildtafel (2 Dreiecke) mit einem Bild aus assets/zuschauer.webp.
  // In diesem Bild sitzen 48 erfundene Leute (8 pro Reihe, 6 Reihen): die ersten 32 sieht man von vorn,
  // die letzten 16 von der Seite – sie schauen im Bild nach links.
  // Steht die Kamera vor einer Person, bekommt sie ein Bild von vorn. Steht die Kamera schräg daneben
  // (so wie bei den Seitentribünen), bekommt sie ein Bild von der Seite – und zwar so herum,
  // dass sie zum Spielfeld schaut und nicht in die Kamera.
  // Das ist für iPad und iPhone viel leichter als echte 3D-Figuren: alle Zuschauer zusammen
  // werden in einem einzigen Schritt gezeichnet.
  zuschauerBauen(G, people, night) {
    const SPALTEN = 8, REIHEN = 6;            // so viele Leute sind im Bild neben- und übereinander
    const VORN = 32, SEITE = 16;              // so viele davon von vorn und von der Seite
    const BREITE = 0.70, HOEHE = 1.05;        // Größe einer Bildtafel in Metern
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);                 // Nullpunkt an die Unterkante: dort "sitzt" die Person
    const n = people.length;
    const bild = new Float32Array(n * 4);     // pro Person: Bild von vorn, Bild von der Seite, gespiegelt (0/1), Größe
    const richtung = new Float32Array(n * 2); // pro Person: wohin sie schaut (zum Platz)
    const mesh = new THREE.InstancedMesh(geo, null, n);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    people.forEach((p, i) => {
      const jx = (Math.random() - 0.5) * 0.12;
      // ein kleines Stück zur Seite gewürfelt, damit nicht alle wie am Lineal sitzen
      mtx.makeTranslation(p.x + (p.nx ? 0 : jx), p.y - 0.04, p.z + (p.nz ? 0 : jx));
      mesh.setMatrixAt(i, mtx);
      bild[i * 4] = Math.floor(Math.random() * VORN);
      bild[i * 4 + 1] = Math.floor(Math.random() * SEITE);
      bild[i * 4 + 2] = Math.random() < 0.5 ? 1 : 0;
      bild[i * 4 + 3] = 0.92 + Math.random() * 0.14;
      richtung[i * 2] = p.nx; richtung[i * 2 + 1] = p.nz;
      // Jede Person etwas heller oder dunkler und mit einem Hauch Farbe – so fallen Doppelgänger weniger auf
      const hell = (night ? 0.7 : 0.95) * (0.82 + Math.random() * 0.18);
      mesh.setColorAt(i, col.setRGB(hell * (0.94 + Math.random() * 0.06), hell * (0.94 + Math.random() * 0.06), hell * (0.94 + Math.random() * 0.06)));
    });
    geo.setAttribute('aBild', new THREE.InstancedBufferAttribute(bild, 4));
    geo.setAttribute('aRichtung', new THREE.InstancedBufferAttribute(richtung, 2));

    const mat = new THREE.MeshBasicMaterial({ alphaTest: 0.4, side: THREE.DoubleSide });
    // Zwei Werte, die das Zeichenprogramm der Grafikkarte ("Shader") jedes Bild neu bekommt:
    // die Uhrzeit und wie stark gerade gejubelt wird (0 = alle sitzen still, 1 = alle hüpfen)
    this.zuschauerWerte = { uZeit: { value: 0 }, uJubel: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uZeit = this.zuschauerWerte.uZeit;
      sh.uniforms.uJubel = this.zuschauerWerte.uJubel;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aBild;
          attribute vec2 aRichtung;
          uniform float uZeit;
          uniform float uJubel;`)
        // Wo steht die Kamera – vor der Person oder seitlich? Danach wird das Bild ausgesucht.
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec4 mitte = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 zurKamera = normalize(cameraPosition.xz - mitte.xz + vec2(0.0001));
          float vorn = dot(aRichtung, zurKamera);     // 1 = Kamera genau vor der Person, 0 = genau daneben
          float seite = aRichtung.x * zurKamera.y - aRichtung.y * zurKamera.x;   // links oder rechts daneben?
          // Die Grenze ist bei jedem ein bisschen anders, damit man keine harte Linie in der Tribüne sieht
          bool vonDerSeite = vorn < 0.62 + 0.25 * fract(aBild.x * 0.618);
          float nr = vonDerSeite ? ${VORN}.0 + aBild.y : aBild.x;
          float spalte = mod(nr, ${SPALTEN}.0), reihe = floor(nr / ${SPALTEN}.0);
          bool gespiegelt = vonDerSeite ? seite > 0.0 : aBild.z > 0.5;
          vMapUv = vec2((spalte + (gespiegelt ? 1.0 - uv.x : uv.x)) / ${SPALTEN}.0,
                        (${REIHEN - 1}.0 - reihe + uv.y) / ${REIHEN}.0);`)
        // Die Tafel dreht sich um ihre Hochachse zur Kamera – aber höchstens 60 Grad weg vom Platz.
        // So sieht man die Tafeln nie "von der Kante".
        .replace('#include <project_vertex>', `
          vec2 blick = zurKamera;
          if (vorn < 0.5) {
            float c = 0.5, s = seite < 0.0 ? -0.866 : 0.866;
            blick = vec2(aRichtung.x * c - aRichtung.y * s, aRichtung.x * s + aRichtung.y * c);
          }
          vec3 welt = mitte.xyz + vec3(blick.y, 0.0, -blick.x) * (position.x * ${BREITE.toFixed(2)} * aBild.w);
          welt.y += position.y * ${HOEHE.toFixed(2)} * aBild.w;
          // Jubel: die meisten hüpfen kurz auf ihrem Platz, jeder in seinem eigenen Takt
          float takt = mitte.x * 3.1 + mitte.z * 5.7 + mitte.y * 9.0;
          welt.y += uJubel * 0.13 * max(0.0, sin(uZeit * 9.0 + takt)) * step(0.25, fract(takt * 0.37));
          vec4 mvPosition = viewMatrix * vec4(welt, 1.0);
          gl_Position = projectionMatrix * mvPosition;`);
    };
    mesh.material = mat;
    mesh.frustumCulled = false;   // die Tafeln stehen überall im Stadion – immer zeichnen
    mesh.visible = false;         // erst zeigen, wenn das Bild geladen ist
    G.add(mesh);
    new THREE.TextureLoader().load('assets/zuschauer.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex; mat.needsUpdate = true;
      mesh.visible = true;
    }, undefined, () => {
      // Das Bild konnte nicht geladen werden: dann wenigstens die einfachen Klötzchen-Zuschauer
      G.remove(mesh);
      this.klotzZuschauer(G, people, night);
    });
  }

  // Notlösung ohne Bild: ein Kasten als Körper und eine Kugel als Kopf
  klotzZuschauer(G, people, night) {
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), new THREE.MeshLambertMaterial(), people.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 6, 5), new THREE.MeshLambertMaterial(), people.length);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const shirts = [0xffffff, 0xe84a3a, 0x2e6fd8, 0xf2e85c, 0x1fb87a, 0xff9a2a, 0x9a3ad8, 0xd8d8d8, 0x303844, 0x7ac8ff];
    const skins = [0xf0c8a0, 0xe2b48c, 0xc99872, 0x9a6a48, 0x7a4a30];
    people.forEach((p, i) => {
      mtx.makeTranslation(p.x, p.y + 0.3, p.z);
      bodies.setMatrixAt(i, mtx);
      bodies.setColorAt(i, col.setHex(shirts[Math.floor(Math.random() * shirts.length)]).multiplyScalar(night ? 0.75 : 1));
      mtx.makeTranslation(p.x, p.y + 0.7, p.z);
      heads.setMatrixAt(i, mtx);
      heads.setColorAt(i, col.setHex(skins[Math.floor(Math.random() * skins.length)]).multiplyScalar(night ? 0.75 : 1));
    });
    G.add(bodies, heads);
  }

  // Die Zuschauer jubeln: staerke 0..1 (bei einem tollen Punkt mehr). Klingt von selbst wieder ab.
  jubel(staerke) {
    this.jubelStaerke = Math.max(this.jubelStaerke || 0, staerke);
  }

  // Jedes Bild aufrufen: lässt den Jubel langsam ausklingen
  update(dt) {
    if (!this.zuschauerWerte) return;
    this.jubelStaerke = Math.max(0, (this.jubelStaerke || 0) - dt * 0.35);
    this.zuschauerWerte.uZeit.value += dt;
    this.zuschauerWerte.uJubel.value = Math.min(1, this.jubelStaerke);
  }

  // Text auf der großen Anzeigetafel: lines = ['Zeile 1', 'Zeile 2'], big = große Zeile
  setBoard(lines, big) {
    const g = this.boardCanvas.getContext('2d');
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f2e85c'; g.font = 'bold 30px Arial'; g.textAlign = 'center';
    g.fillText('POWERSHOT', 256, 40);
    g.fillStyle = '#ffffff'; g.font = 'bold 34px Arial';
    lines.forEach((l, i) => g.fillText(l, 256, 100 + i * 46));
    if (big) { g.fillStyle = '#f2e85c'; g.font = 'bold 54px Arial'; g.fillText(big, 256, 226); }
    if (this.boardTex) this.boardTex.needsUpdate = true;
  }
}
