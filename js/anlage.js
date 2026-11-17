// Powershot – Die Turnieranlage (PROBE).
//
// Hier probieren wir aus, wie sich die Tage auf einer Turnieranlage anfühlen sollen. Es gibt zwei Arten:
//   'tippen' = Blick von schräg oben. Du tippst auf ein Gebäude und deine Figur läuft von selbst hin.
//   'laufen' = Die Kamera ist hinter der Figur und du steuerst selbst (Tasten W A S D / Pfeile oder mit dem Finger ziehen).
// Die Gebäude sind noch einfache Klötze. In den Gebäuden passiert noch nichts – es geht nur ums Herumlaufen.
//
// Alle Gebäude stehen im Kreis um einen Platz in der Mitte, die Türen zeigen zur Mitte.
// So kommt man von jeder Tür geradeaus zu jeder anderen, ohne durch ein Haus zu laufen.
import * as THREE from 'three';
import { requisit } from './requisiten.js';

// ---- Zahlen zum Einstellen ----
const TEMPO_TIPPEN = 2.6;     // so schnell läuft die Figur von selbst (Meter pro Sekunde)
const TEMPO_LAUFEN = 2.4;     // so schnell läuft sie, wenn du steuerst
const DREH_TEMPO = 2.2;       // so schnell dreht sie sich beim Selbst-Steuern
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
    this.art = 'tippen';
    this.gruppe = null;
    this.tasten = {};
    this.zug = null;           // Finger oder Maus wird gerade gezogen: { x0, y0, x, y }
    this.amOrt = null;         // der Ort, an dessen Tür die Figur gerade steht
    this.wennDa = null;        // wird aufgerufen, wenn sich amOrt ändert (app.js zeigt dann das Fenster)
    // Tasten und Finger – hören nur zu, solange die Anlage an ist
    addEventListener('keydown', (e) => { if (this.an) this.tasten[e.code] = true; });
    addEventListener('keyup', (e) => { this.tasten[e.code] = false; });
    addEventListener('pointerdown', (e) => { if (this.an && !e.target.closest('button, .panel')) this.zug = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; });
    addEventListener('pointermove', (e) => { if (this.zug) { this.zug.x = e.clientX; this.zug.y = e.clientY; } });
    addEventListener('pointerup', (e) => {
      const z = this.zug;
      this.zug = null;
      if (!this.an || !z || e.target.closest('button, .panel')) return;
      // Nur ein kurzer Tipp (kaum bewegt)? Dann ist das ein Ziel zum Hinlaufen.
      if (Math.hypot(z.x - z.x0, z.y - z.y0) < 12) this.tipp(e.clientX, e.clientY);
    });
  }

  start() {
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
        haus = teil(new THREE.BoxGeometry(o.b, 0.06, o.t), o.farbe, x, 0.03, z);
        haus.rotation.y = dreh;
        const linien = teil(new THREE.BoxGeometry(o.b * 0.82, 0.07, o.t * 0.82), 0xffffff, x, 0.03, z);
        const feld = teil(new THREE.BoxGeometry(o.b * 0.8, 0.08, o.t * 0.78), o.farbe, x, 0.03, z);
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
      if (!o.platz) this.hindernisse.push({ x, z, r: Math.max(o.b, o.t) / 2 + 0.3 });
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
    const startOrt = this.orte.find((o) => o.id === 'hotel');
    this.p = { x: startOrt.tx, z: startOrt.tz - 1.5, vx: 0, vz: 0, blick: Math.PI };     // blick: 0 = schaut nach +z, π = nach −z
    this.ziel = null;
    g.showAvatars(false);
    if (g.avatars[0]) g.avatars[0].group.visible = true;
    g.ball.visible = g.blob.visible = g.trail.visible = false;
    if (g.maschine) g.maschine.visible = false;
    g.scene.fog.near = 60; g.scene.fog.far = 160;
    this.setArt(this.art, true);
  }

  setArt(art, sofort) {
    this.art = art;
    this.ziel = null;
    if (sofort) { this.kamera(1); }
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
    const g = this.game, p = this.p, t = this.tasten;
    // --- Selbst steuern: Tasten oder Ziehen mit dem Finger ---
    let vor = 0, dreh = 0;
    if (this.art === 'laufen') {
      vor = (t.KeyW || t.ArrowUp ? 1 : 0) - (t.KeyS || t.ArrowDown ? 1 : 0);
      dreh = (t.KeyA || t.ArrowLeft ? 1 : 0) - (t.KeyD || t.ArrowRight ? 1 : 0);
      if (this.zug) {
        // Ziehen: nach oben = vorwärts, zur Seite = drehen (wie ein Steuerknüppel, der dort ist, wo der Finger aufgesetzt hat)
        const dx = (this.zug.x - this.zug.x0) / 70, dy = (this.zug.y0 - this.zug.y) / 70;
        if (Math.hypot(dx, dy) > 0.2) { vor = Math.max(-1, Math.min(1, dy)); dreh = -Math.max(-1, Math.min(1, dx)); }
      }
      if (vor || dreh) this.ziel = null;       // wer selbst steuert, bricht das Hinlaufen ab
    }
    if (this.ziel) {
      // Von selbst zum Ziel laufen
      const dx = this.ziel.x - p.x, dz = this.ziel.z - p.z, weit = Math.hypot(dx, dz);
      if (weit < 0.15) { p.vx = p.vz = 0; this.ziel = null; }
      else {
        const v = Math.min(TEMPO_TIPPEN, weit * 2.5 + 0.4);
        p.vx = dx / weit * v; p.vz = dz / weit * v;
        p.blick = Math.atan2(p.vx, p.vz);
      }
    } else {
      p.blick += dreh * DREH_TEMPO * dt;
      const v = vor * TEMPO_LAUFEN * (vor < 0 ? 0.5 : 1);
      p.vx = Math.sin(p.blick) * v; p.vz = Math.cos(p.blick) * v;
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    // Nicht durch Häuser laufen (nur beim Selbst-Steuern nötig) und nicht vom Gelände herunter
    if (!this.ziel) {
      for (const h of this.hindernisse) {
        const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 0.001;
        if (d < h.r + 0.4) { p.x = h.x + dx / d * (h.r + 0.4); p.z = h.z + dz / d * (h.r + 0.4); }
      }
    }
    const weg = Math.hypot(p.x, p.z);
    if (weg > RAND) { p.x *= RAND / weg; p.z *= RAND / weg; }

    // --- Die Figur ---
    const av = g.avatars[0];
    if (av) {
      av.group.visible = true;
      // (face: Die Figur von Spieler 0 schaut von sich aus nach −z, unser blick zählt ab +z. Darum wird umgerechnet.)
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: true, face: Math.PI - p.blick, ohneSchlaeger: true });
    }
    if (g.avatars[1]) g.avatars[1].group.visible = false;

    // --- Stehe ich an einer Tür? ---
    let nah = null;
    for (const o of this.orte) {
      const d = Math.hypot(p.x - o.tx, p.z - o.tz);
      if (d < TUER_NAH && Math.hypot(p.vx, p.vz) < 0.6) nah = o;
    }
    if (nah !== this.amOrt) { this.amOrt = nah; if (this.wennDa) this.wennDa(nah); }
    this.kamera(dt);
  }

  kamera(dt) {
    const g = this.game, p = this.p;
    let von, nach;
    if (this.art === 'tippen') {
      // Von schräg oben auf die ganze Anlage. Auf schmalen Bildschirmen weiter weg, damit alles ins Bild passt.
      const weit = g.aspect < 1.3 ? 1.5 : 1;
      von = new THREE.Vector3(p.x * 0.15, 31 * weit, 31 * weit + p.z * 0.15);
      nach = new THREE.Vector3(p.x * 0.15, 0, p.z * 0.15 - 2);
    } else {
      // Hinter der Figur
      von = new THREE.Vector3(p.x - Math.sin(p.blick) * 6.5, 3.6, p.z - Math.cos(p.blick) * 6.5);
      nach = new THREE.Vector3(p.x + Math.sin(p.blick) * 3, 1.3, p.z + Math.cos(p.blick) * 3);
    }
    // Die Schilder: von oben gesehen groß (sonst kann man sie nicht lesen), aus der Nähe klein
    const gross = this.art === 'tippen' ? 1.9 : 0.7;
    for (const o of this.orte) o.schild.scale.set(4.6 * gross, 0.86 * gross, 1);
    const k = Math.min(1, dt * 3);
    g.camPos.lerp(von, k); g.camLook.lerp(nach, k);
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
    this.zug = null;
    this.tasten = {};
    if (g.stadium.group) g.stadium.group.visible = true;
    g.scene.fog.near = 70; g.scene.fog.far = 190;
    if (g.avatars[0]) g.avatars[0].m.racket.visible = true;
  }
}
