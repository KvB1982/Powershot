// Powershot – Die Turnieranlage (PROBE).
//
// Du läufst frei über die Anlage. Gesteuert und geschaut wird wie auf dem Pferdehof im Spiel „Reitturnier“:
//   Laufen: Tasten W A S D / Pfeile oder mit einem Finger ziehen (wie ein Steuerknüppel). „Oben“ heißt immer: von der Kamera weg.
//           Ein kurzer Tipp auf ein Gebäude lässt die Figur von selbst hinlaufen.
//   Kamera: kreist um die Figur. Knöpfe ⟲ ⟳ ＋ － und 🗺️ (Übersicht), Tasten Q/R drehen, T/G zoomen, M Übersicht,
//           Maus: rechte Taste ziehen und Mausrad, iPad: mit zwei Fingern drehen, neigen und zoomen.
// Die Gebäude sind noch einfache Klötze. In den Gebäuden passiert noch nichts.
//
// Alle Gebäude stehen im Kreis um einen Platz in der Mitte, die Türen zeigen zur Mitte.
// So kommt man von jeder Tür geradeaus zu jeder anderen, ohne durch ein Haus zu laufen.
import * as THREE from 'three';
import { requisit } from './requisiten.js';

// ---- Zahlen zum Einstellen ----
const TEMPO = 3.4;            // so schnell läuft die Figur (Meter pro Sekunde)
const GEH_BIS = 2.0;          // bis zu diesem Tempo wird gegangen, darüber gejoggt
// Kamera: w = Drehung um die Figur (0 = von vorn/Süden), e = Neigung (0 flach … 1.5 von oben), d = Abstand in Metern
const KAM_START = { w: 0, e: 0.7, d: 15 }, KAM_WEIT = { e: 1.05, d: 46 };
const TUER_NAH = 1.6;         // so nah an der Tür (Meter) gilt: „du bist da“
const RING_X = 17, RING_Z = 13;   // so groß ist der Kreis, auf dem die Gebäude stehen
const RAND = 24;              // weiter als so kommt man nicht von der Mitte weg

// Die Orte: wo auf dem Kreis (winkel in Grad, 0 = hinten in der Mitte), wie groß (breit, tief, hoch), Farbe und was man dort machen wird
export const ORTE = [
  { id: 'court', name: 'Centre Court', winkel: 0, b: 12, t: 7, h: 5, farbe: 0x1f3a5a, text: 'Hier spielst du dein Match.' },
  { id: 'training', name: 'Trainingsplatz', winkel: 48, b: 8, t: 6, h: 0.1, farbe: 0x2f6aa8, platz: true, text: 'Einschlagen, Aufschlag-Ziele, Beinarbeit – Übung für genau eine Fähigkeit.' },
  { id: 'kraft', name: 'Kraftraum', winkel: 92, b: 6, t: 5, h: 3, farbe: 0x8a3a2a, text: 'Macht deinen Aufschlag schneller und dich ausdauernder – kostet aber Frische.' },
  { id: 'physio', name: 'Physio', winkel: 130, b: 5, t: 4, h: 2.8, farbe: 0x2a8a7a, text: 'Massage, Tapen und Eisbad: Du bekommst Frische zurück.' },
  { id: 'hotel', name: 'Fahrdienst zum Hotel', winkel: 180, b: 4.4, t: 2, h: 1.5, farbe: 0xe8e8ee, auto: true, text: 'Der Tag ist zu Ende. Morgen geht es weiter.' },
  { id: 'essen', name: 'Spieler-Restaurant', winkel: 228, b: 6, t: 4.5, h: 2.8, farbe: 0xc88a2a, text: 'Nudeln vor dem Match geben Kraft für lange Ballwechsel.' },
  { id: 'saiten', name: 'Besaiter', winkel: 268, b: 4.5, t: 4, h: 2.6, farbe: 0x6a4ac8, text: 'Schläger neu bespannen: fester für mehr Kontrolle, lockerer für mehr Kraft.' },
  { id: 'presse', name: 'Pressesaal', winkel: 312, b: 6, t: 5, h: 3.2, farbe: 0x4a5a6a, text: 'Die Reporter haben Fragen. Gute Antworten bringen Fans.' },
];
// Autogramme gibt es am Zaun mitten auf dem Platz
const ZAUN = { id: 'fans', name: 'Autogramm-Zaun', x: -4.5, z: -2.5, text: 'Kinder halten Bälle und Kappen hin. Unterschreiben bringt Fans.' };

const grad = (g) => g * Math.PI / 180;

export class Anlage {
  constructor(game) {
    this.game = game;
    this.an = false;
    this.gruppe = null;
    this.tasten = {};
    this.finger = {};          // alle Finger (oder die Maus), die gerade aufliegen: id → { x0, y0, x, y, rechts }
    this.knueppel = null;      // id des Fingers, der gerade läuft
    this.kamTaste = null;      // welcher Kamera-Knopf gerade gedrückt ist ('links', 'rechts', 'nah', 'fern')
    this.kam = { ...KAM_START, zw: KAM_START.w, ze: KAM_START.e, zd: KAM_START.d };    // z… = wohin die Kamera will
    this.amOrt = null;         // der Ort, an dessen Tür die Figur gerade steht
    this.wennDa = null;        // wird aufgerufen, wenn sich amOrt ändert (app.js zeigt dann das Fenster)
    // Tasten, Maus und Finger – hören nur zu, solange die Anlage an ist
    const meins = (e) => this.an && !e.target.closest('button, .panel');
    addEventListener('keydown', (e) => { if (!this.an) return; this.tasten[e.code] = true; if (e.code === 'KeyM') this.uebersicht(); });
    addEventListener('keyup', (e) => { this.tasten[e.code] = false; });
    addEventListener('contextmenu', (e) => { if (meins(e)) e.preventDefault(); });
    addEventListener('wheel', (e) => { if (meins(e)) { this.kam.zd *= Math.exp(e.deltaY * 0.001); this.kamGrenzen(); } }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (!meins(e)) return;
      this.finger[e.pointerId] = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, rechts: e.button === 2, weg: 0 };
      const n = Object.keys(this.finger).length;
      if (n === 1 && e.button !== 2) this.knueppel = e.pointerId; else this.knueppel = null;     // ein Finger läuft, zwei drehen die Kamera
    });
    addEventListener('pointermove', (e) => {
      const f = this.finger[e.pointerId];
      if (!f) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y, ids = Object.keys(this.finger), k = this.kam;
      f.weg += Math.hypot(dx, dy);
      if (f.rechts) { k.zw -= dx * 0.008; k.ze += dy * 0.006; }
      else if (ids.length >= 2) {
        // Zwei Finger: auseinander/zusammen = zoomen, gemeinsam schieben = drehen und neigen
        const o = this.finger[ids[0] == e.pointerId ? ids[1] : ids[0]];
        const alt = Math.hypot(f.x - o.x, f.y - o.y), neu = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        if (alt > 8 && neu > 8) k.zd *= alt / neu;
        k.zw -= dx * 0.004; k.ze += dy * 0.003;
      }
      f.x = e.clientX; f.y = e.clientY;
      this.kamGrenzen();
    });
    const los = (e) => {
      const f = this.finger[e.pointerId];
      delete this.finger[e.pointerId];
      if (this.knueppel === e.pointerId) this.knueppel = null;
      // Nur ein kurzer Tipp (kaum bewegt)? Dann ist das ein Ziel zum Hinlaufen.
      if (this.an && f && !f.rechts && f.weg < 12 && e.type === 'pointerup' && !e.target.closest('button, .panel')) this.tipp(e.clientX, e.clientY);
    };
    addEventListener('pointerup', los);
    addEventListener('pointercancel', los);
  }

  kamGrenzen() {
    const k = this.kam;
    k.ze = Math.max(0.12, Math.min(1.45, k.ze));
    k.zd = Math.max(5, Math.min(60, k.zd));
  }

  // 🗺️ Übersicht: einmal drücken = von weit oben auf die ganze Anlage, noch einmal = zurück zur Figur
  uebersicht() {
    const k = this.kam, weit = k.zd > 30;
    k.zd = weit ? KAM_START.d : KAM_WEIT.d;
    k.ze = weit ? KAM_START.e : KAM_WEIT.e;
    if (weit) k.zw = Math.round(k.zw / (Math.PI * 2)) * Math.PI * 2;
  }

  // woher = bei welchem Ort die Figur startet (ohne Angabe: beim Fahrdienst)
  start(woher = 'hotel') {
    this.ende();
    const g = this.game;
    this.an = true;
    this.amOrt = null;
    const G = this.gruppe = new THREE.Group();
    g.scene.add(G);
    if (g.stadium.group) g.stadium.group.visible = false;      // das Stadion macht Pause
    this.orte = [];
    this.klick = [];           // alles, was man antippen kann (für den Strahl von der Kamera)

    const teil = (geo, farbe, x, y, z, opts = {}) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: farbe, roughness: opts.rau ?? 0.85, map: opts.bild || null }));
      m.userData.eigen = true;
      m.position.set(x, y, z);
      m.castShadow = !!opts.schatten;
      m.receiveShadow = true;
      G.add(m);
      return m;
    };
    // Ein Schild mit Text (wird auf ein kleines Bild gemalt)
    const schild = (text, x, y, z) => {
      const bild = document.createElement('canvas');
      bild.width = 512; bild.height = 96;
      const s = bild.getContext('2d');
      s.fillStyle = '#fdfdf6'; s.fillRect(0, 0, 512, 96);
      s.fillStyle = '#16203a'; s.font = 'bold 50px sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
      s.fillText(text, 256, 50, 490);
      const tex = new THREE.CanvasTexture(bild);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      m.userData.eigen = true;
      m.scale.set(4.6, 0.86, 1);
      m.position.set(x, y, z);
      G.add(m);
      return m;
    };

    // Boden: Rasen, in der Mitte ein gepflasterter Platz
    this.boden = teil(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), 0x4f8a45, 0, 0, 0);
    // Der Rasen wird beim Malen ein kleines Stück nach hinten geschoben. Sonst flackert er aus großer Entfernung durch das Pflaster.
    Object.assign(this.boden.material, { polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 40 });
    teil(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2).scale(RING_X - 2.5, 1, RING_Z - 2.5), 0xc9c2b4, 0, 0.06, 0);
    teil(new THREE.CircleGeometry(2.2, 32).rotateX(-Math.PI / 2), 0x8fb8e0, 0, 0.12, 0);          // Brunnen in der Mitte
    teil(new THREE.CylinderGeometry(2.3, 2.3, 0.35, 32, 1, true), 0xb0a898, 0, 0.17, 0);
    this.hindernisse = [{ x: 0, z: 0, r: 2.6 }];

    for (const o of ORTE) {
      // Der Ort steht auf dem Kreis und schaut zur Mitte
      const a = grad(o.winkel), x = Math.sin(a) * RING_X, z = -Math.cos(a) * RING_Z;
      const dreh = Math.atan2(-x, -z);                   // Richtung zur Mitte
      const vorn = o.t / 2 + 1.1;                        // die Tür liegt ein Stück vor dem Haus
      const ort = { ...o, x, z, tx: x + Math.sin(dreh) * vorn, tz: z + Math.cos(dreh) * vorn };
      let haus;
      if (o.platz) {
        // Trainingsplatz: eine blaue Fläche mit weißen Linien und einem Netz
        haus = teil(new THREE.BoxGeometry(o.b, 0.06, o.t), o.farbe, x, 0.09, z);
        haus.rotation.y = dreh;
        const linien = teil(new THREE.BoxGeometry(o.b * 0.82, 0.07, o.t * 0.82), 0xffffff, x, 0.1, z);
        const feld = teil(new THREE.BoxGeometry(o.b * 0.8, 0.08, o.t * 0.78), o.farbe, x, 0.11, z);
        const netz = teil(new THREE.BoxGeometry(o.b * 0.86, 0.9, 0.05), 0xf0f0f0, x, 0.45, z, { schatten: true });
        for (const m of [linien, feld, netz]) m.rotation.y = dreh;
        const maschine = requisit('ballmaschine');
        if (maschine) { maschine.position.set(x - Math.sin(dreh) * 2, 0, z - Math.cos(dreh) * 2); maschine.rotation.y = dreh; G.add(maschine); }
      } else if (o.auto) {
        // Das Auto vom Fahrdienst: zwei Klötze und vier Räder
        haus = teil(new THREE.BoxGeometry(o.b, 0.8, o.t), o.farbe, x, 0.75, z, { schatten: true });
        teil(new THREE.BoxGeometry(o.b * 0.55, 0.65, o.t * 0.9), 0x9ab8d8, x, 1.45, z, { schatten: true });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) teil(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14).rotateX(Math.PI / 2), 0x1a1a1a, x + sx * o.b * 0.3, 0.36, z + sz * o.t * 0.5);
      } else {
        haus = teil(new THREE.BoxGeometry(o.b, o.h, o.t), o.farbe, x, o.h / 2, z, { schatten: true });
        haus.rotation.y = dreh;
        const dach = teil(new THREE.BoxGeometry(o.b + 0.6, 0.25, o.t + 0.6), 0xf0ece4, x, o.h + 0.12, z, { schatten: true });
        dach.rotation.y = dreh;
        // Tür: ein dunkles Rechteck an der Seite zur Mitte
        const tuer = teil(new THREE.BoxGeometry(1.3, 2.1, 0.1), 0x1a1a22, x + Math.sin(dreh) * o.t / 2, 1.05, z + Math.cos(dreh) * o.t / 2);
        tuer.rotation.y = dreh;
      }
      haus.userData.ort = ort;
      this.klick.push(haus);
      ort.schild = schild(o.name, x, (o.platz ? 2.2 : o.h + 1.3), z);
      // Ein heller Kreis auf dem Boden zeigt, wo man hin muss
      ort.kreis = teil(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-Math.PI / 2), 0xe8f04a, ort.tx, 0.12, ort.tz);
      // Wo man nicht durchlaufen kann: Ein breites Haus wird mit mehreren Kreisen nebeneinander nachgebaut
      if (!o.platz) {
        const r = Math.min(o.b, o.t) / 2 + 0.1, n = Math.max(1, Math.ceil(o.b / o.t)), lang = Math.max(0, o.b / 2 - r);
        for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0 : -lang + 2 * lang * i / (n - 1);
          this.hindernisse.push({ x: x + Math.cos(dreh) * u, z: z - Math.sin(dreh) * u, r });
        }
      }
      this.orte.push(ort);
    }

    // Autogramm-Zaun mit drei wartenden Kindern (die Ballkinder-Modelle)
    const zaun = { ...ZAUN, tx: ZAUN.x + 1.6, tz: ZAUN.z + 1.2 };
    const gitter = teil(new THREE.BoxGeometry(4, 1.0, 0.08), 0x3a4a5a, ZAUN.x, 0.5, ZAUN.z, { schatten: true });
    gitter.rotation.y = 0.9;
    gitter.userData.ort = zaun;
    this.klick.push(gitter);
    for (let i = 0; i < 3; i++) {
      const kind = requisit('ballkind', { farbe: [0xe8442a, 0xe8f04a, 0x2a8af0][i], hell: [0.3, 0.72] });
      if (!kind) break;
      kind.position.set(ZAUN.x - 1.4 + i * 0.7, 0, ZAUN.z - 0.3 - i * 0.9);
      kind.rotation.y = 0.9;
      G.add(kind);
    }
    zaun.schild = schild(ZAUN.name, ZAUN.x, 2.6, ZAUN.z);
    zaun.kreis = teil(new THREE.RingGeometry(0.75, 1.0, 28).rotateX(-Math.PI / 2), 0xe8f04a, zaun.tx, 0.12, zaun.tz);
    this.hindernisse.push({ x: ZAUN.x, z: ZAUN.z, r: 1.5 });
    this.orte.push(zaun);

    // Ein paar Bäume zwischen den Häusern (Stamm und Kugel)
    for (const w of [24, 70, 111, 155, 205, 248, 290, 336]) {
      const a = grad(w), x = Math.sin(a) * (RING_X + 3.5), z = -Math.cos(a) * (RING_Z + 3.5);
      teil(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 8), 0x6a4a2a, x, 0.8, z, { schatten: true });
      teil(new THREE.SphereGeometry(1.5, 12, 10), 0x2f7a3a, x, 2.7, z, { schatten: true });
    }

    // Die Figur startet beim Fahrdienst und schaut zur Mitte
    const startOrt = this.orte.find((o) => o.id === woher) || this.orte.find((o) => o.id === 'hotel');
    this.p = { x: startOrt.tx, z: startOrt.tz, vx: 0, vz: 0, blick: Math.atan2(-startOrt.tx, -startOrt.tz) };     // blick: 0 = schaut nach +z, π = nach −z
    this.ziel = null;
    g.showAvatars(false);
    if (g.avatars[0]) g.avatars[0].group.visible = true;
    g.ball.visible = g.blob.visible = g.trail.visible = false;
    if (g.maschine) g.maschine.visible = false;
    g.scene.fog.near = 60; g.scene.fog.far = 160;
    Object.assign(this.kam, KAM_START, { zw: KAM_START.w, ze: KAM_START.e, zd: KAM_START.d });
    this.kamera(1);
  }

  // Auf den Bildschirm getippt: Wohin soll die Figur laufen?
  tipp(px, py) {
    const g = this.game, el = g.renderer.domElement, r = el.getBoundingClientRect();
    const strahl = new THREE.Raycaster();
    strahl.setFromCamera(new THREE.Vector2((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1), g.camera);
    // Zuerst: Wurde ein Gebäude oder sein Schild getroffen? Dann zur Tür laufen.
    const treffer = strahl.intersectObjects([...this.klick, ...this.orte.map((o) => o.schild)], false)[0];
    if (treffer) {
      const ort = treffer.object.userData.ort || this.orte.find((o) => o.schild === treffer.object);
      this.ziel = { x: ort.tx, z: ort.tz, ort };
      return;
    }
    // Sonst: zu der Stelle auf dem Boden laufen
    const b = strahl.intersectObject(this.boden, false)[0];
    if (b) this.ziel = { x: b.point.x, z: b.point.z };
  }

  // Zu einem Ort laufen (z. B. vom Knopf im Menü)
  geheZu(id) {
    const ort = this.orte.find((o) => o.id === id);
    if (ort) this.ziel = { x: ort.tx, z: ort.tz, ort };
  }

  update(dt) {
    const g = this.game, p = this.p, t = this.tasten, k = this.kam;
    // --- Selbst steuern: Tasten oder ein Finger als Steuerknüppel ---
    let sx = (t.KeyD || t.ArrowRight ? 1 : 0) - (t.KeyA || t.ArrowLeft ? 1 : 0);
    let sz = (t.KeyS || t.ArrowDown ? 1 : 0) - (t.KeyW || t.ArrowUp ? 1 : 0);
    const f = this.finger[this.knueppel];
    if (f) {
      // Der Knüppel sitzt dort, wo der Finger aufgesetzt hat. Je weiter gezogen, desto schneller.
      const dx = (f.x - f.x0) / 70, dz = (f.y - f.y0) / 70;
      if (Math.hypot(dx, dz) > 0.18) { sx = dx; sz = dz; }
    }
    // „Oben“ auf dem Bildschirm ist immer von der Kamera weg, egal wie sie gedreht ist
    const kc = Math.cos(k.w), ks = Math.sin(k.w);
    let ex = sx * kc + sz * ks, ez = -sx * ks + sz * kc;
    const st = Math.min(1, Math.hypot(ex, ez));
    if (st > 0.05) this.ziel = null;           // wer selbst steuert, bricht das Hinlaufen ab
    if (this.ziel) {
      // Von selbst zum angetippten Ziel laufen
      const dx = this.ziel.x - p.x, dz = this.ziel.z - p.z, weit = Math.hypot(dx, dz);
      if (weit < 0.15) { p.vx = p.vz = 0; this.ziel = null; }
      else {
        // Richtung zum Ziel. Steht etwas im Weg (z. B. der Brunnen), biegt die Figur seitlich daran vorbei.
        let rx = dx / weit, rz = dz / weit;
        for (const h of this.hindernisse) {
          const hx = p.x - h.x, hz = p.z - h.z, hd = Math.hypot(hx, hz) || 0.001;
          if (hd > h.r + 1.3 || rx * hx + rz * hz > 0 || weit < hd) continue;      // weit weg, schon vorbei oder das Ziel liegt davor
          const seite = hx * dz - hz * dx >= 0 ? 1 : -1;
          rx += -hz / hd * seite * 1.4; rz += hx / hd * seite * 1.4;
        }
        const rl = Math.hypot(rx, rz) || 1, v = Math.min(TEMPO, weit * 2.5 + 0.4);
        p.vx = rx / rl * v; p.vz = rz / rl * v;
      }
    } else if (st > 0.05) {
      const v = TEMPO * Math.min(1, st * 1.2);
      p.vx = ex / st * v; p.vz = ez / st * v;
    } else { p.vx = p.vz = 0; }
    const tempo = Math.hypot(p.vx, p.vz);
    if (tempo > 0.2) {
      // Die Figur dreht sich weich in die Laufrichtung
      const soll = Math.atan2(p.vx, p.vz), diff = Math.atan2(Math.sin(soll - p.blick), Math.cos(soll - p.blick));
      p.blick += diff * Math.min(1, dt * 12);
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    // Nicht durch Häuser laufen und nicht vom Gelände herunter
    for (const h of this.hindernisse) {
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 0.001;
      if (d < h.r + 0.4) { p.x = h.x + dx / d * (h.r + 0.4); p.z = h.z + dz / d * (h.r + 0.4); }
    }
    const weg = Math.hypot(p.x, p.z);
    if (weg > RAND) { p.x *= RAND / weg; p.z *= RAND / weg; }

    // --- Die Figur ---
    const av = g.avatars[0];
    if (av) {
      av.group.visible = true;
      // (face: Die Figur von Spieler 0 schaut von sich aus nach −z, unser blick zählt ab +z. Darum wird umgerechnet.)
      // Langsam wird gegangen, schnell gejoggt.
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: tempo < GEH_BIS, face: Math.PI - p.blick, faceFest: true, ohneSchlaeger: true });
    }
    if (g.avatars[1]) g.avatars[1].group.visible = false;

    // --- Stehe ich an einer Tür? ---
    let nah = null;
    for (const o of this.orte) if (Math.hypot(p.x - o.tx, p.z - o.tz) < TUER_NAH && tempo < 0.6) nah = o;
    if (nah !== this.amOrt) { this.amOrt = nah; if (this.wennDa) this.wennDa(nah); }
    this.kamera(dt);
  }

  // Die Kamera kreist um die Figur: Knöpfe und Tasten drehen und zoomen, dann fährt sie weich an ihre neue Stelle
  kamera(dt) {
    const g = this.game, p = this.p, k = this.kam, t = this.tasten;
    const knopf = this.kamTaste;
    if (knopf === 'links' || t.KeyQ) k.zw += dt * 1.6; else if (knopf === 'rechts' || t.KeyR) k.zw -= dt * 1.6;
    if (knopf === 'nah' || t.KeyT) k.zd *= Math.exp(-dt * 1.4); else if (knopf === 'fern' || t.KeyG) k.zd *= Math.exp(dt * 1.4);
    this.kamGrenzen();
    const weich = Math.min(1, dt * 8);
    k.w += (k.zw - k.w) * weich; k.e += (k.ze - k.e) * weich; k.d += (k.zd - k.d) * weich;
    // Auf einem hohen, schmalen Bildschirm geht die Kamera etwas weiter weg
    const d = k.d * (g.aspect < 1 ? 1.35 : 1), c = Math.cos(k.e);
    // In der Übersicht (weit weg) schaut die Kamera auf die Mitte der Anlage statt auf die Figur
    const fern = Math.max(0, Math.min(1, (k.d - 22) / 16)), mx = p.x * (1 - fern), mz = p.z * (1 - fern);
    const von = new THREE.Vector3(mx + Math.sin(k.w) * c * d, 0.5 + Math.sin(k.e) * d, mz + Math.cos(k.w) * c * d);
    const nach = new THREE.Vector3(mx, 0.9 + Math.max(0, 0.6 - k.e) * 2.2, mz);      // flache Kamera schaut etwas höher
    // Die Schilder: aus der Ferne groß (sonst kann man sie nicht lesen), aus der Nähe klein
    const gross = Math.max(0.7, Math.min(2.2, k.d / 16));
    for (const o of this.orte) o.schild.scale.set(4.6 * gross, 0.86 * gross, 1);
    const kk = dt >= 1 ? 1 : 1 - Math.exp(-6 * dt);
    g.camPos.lerp(von, kk); g.camLook.lerp(nach, kk);
    g.camera.position.copy(g.camPos);
    g.camera.lookAt(g.camLook);
  }

  ende() {
    if (!this.gruppe) { this.an = false; return; }
    const g = this.game;
    this.gruppe.traverse((m) => {
      if (!m.userData.eigen) return;                    // geladene Modelle (Ballkinder, Ballmaschine) werden noch gebraucht
      if (m.isMesh) m.geometry.dispose();
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
    });
    this.gruppe.removeFromParent();
    this.gruppe = null;
    this.an = false;
    this.finger = {};
    this.knueppel = null;
    this.kamTaste = null;
    this.tasten = {};
    if (g.stadium.group) g.stadium.group.visible = true;
    g.scene.fog.near = 70; g.scene.fog.far = 190;
    if (g.avatars[0]) g.avatars[0].m.racket.visible = true;
  }
}
