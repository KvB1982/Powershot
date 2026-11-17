// Powershot – Siegerehrung nach einem gewonnenen Finale.
//
// Die Ehrung spielt im Stadion, auf deiner Platzhälfte. Sie läuft in Schritten ab, und nach jedem Schritt
// drückst du auf „Weiter“ (das Menü dazu baut app.js):
//   aufstellen → teller (der Verlierer bekommt seinen Teller) → pokal (du bekommst den Pokal) →
//   scheck (das Preisgeld) → rede (du sagst einen Satz) → foto (das Siegerfoto)
//
// Wie groß gefeiert wird, hängt vom Turnier ab (gross = wie voll die Tribüne ist, 0…1):
// Bei einem kleinen ITF-Turnier gibt es nur einen Tisch und einen kleinen Pokal, bei den großen Turnieren
// stehen die Ballkinder Spalier und es regnet Konfetti.
import * as THREE from 'three';
import { requisit } from './requisiten.js';

// ---- Zahlen zum Einstellen ----
const MITTE_Z = 6.4;         // so weit vom Netz entfernt steht der Tisch (Meter)
const GEH_TEMPO = 1.35;      // so schnell gehen die Spieler (Meter pro Sekunde)
const KONFETTI = 420;        // so viele Schnipsel fliegen bei einem großen Turnier
const KONFETTI_AB = 0.3;     // Konfetti gibt es erst ab dieser Turniergröße
const KINDER_AB = 0.6;       // Ballkinder im Spalier erst ab dieser Turniergröße
const BUNT = [0xe8f04a, 0xff5a5a, 0x4ab8ff, 0xffffff, 0x5ae88a, 0xffa53a];

export const SCHRITTE = ['aufstellen', 'teller', 'pokal', 'scheck', 'rede', 'foto'];

// Wo die Kamera in jedem Schritt steht und wohin sie schaut: [von x, y, z, nach x, y, z]
// (Die Kamera steht am Netz und schaut zur Grundlinie, die Spieler schauen zu ihr.)
const KAMERA = {
  aufstellen: [-3.2, 2.7, 0.7, 0, 1.1, MITTE_Z],
  teller: [-2.6, 1.7, 2.0, -1.0, 1.2, MITTE_Z - 0.6],
  pokal: [1.7, 1.3, 0.9, 0.9, 1.05, MITTE_Z - 0.7],
  scheck: [3.4, 1.7, 1.6, 1.6, 1.15, MITTE_Z - 0.6],
  rede: [0.1, 1.5, 1.8, 0.9, 1.0, MITTE_Z - 0.7],
  foto: [0.9, 1.3, 0.9, 0.9, 1.05, MITTE_Z - 0.7],
};

const mischen = (a, b, k) => a + (b - a) * k;

export class Siegerehrung {
  constructor(game) {
    this.game = game;
    this.an = false;
    this.gruppe = null;
  }

  // o: { art: 'gold' | 'silber' | 'stern', gross: 0…1, geld: Preisgeld in $, turnier: Name, farbe: Farbe des Tischtuchs }
  start(o) {
    this.ende();
    const g = this.game;
    this.o = o;
    this.an = true;
    this.schritt = 'aufstellen';
    this.zeit = 0;
    this.jubelZeit = 0;
    this.blitz = 0;
    const G = this.gruppe = new THREE.Group();
    g.scene.add(G);
    const klein = o.gross < KONFETTI_AB;

    const teil = (geo, farbe, x, y, z, opts = {}) => {
      geo.userData.ehrung = true;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: farbe, roughness: opts.rau ?? 0.8, metalness: opts.metall ?? 0 }));
      m.position.set(x, y, z);
      m.castShadow = !!opts.schatten;
      m.receiveShadow = true;
      G.add(m);
      return m;
    };

    // Teppich und Tisch mit Tischtuch
    if (!klein) teil(new THREE.BoxGeometry(7.5, 0.02, 2.6), 0x8a1c2c, 0, 0.012, MITTE_Z + 0.2);
    teil(new THREE.BoxGeometry(1.3, 0.74, 0.6), o.farbe ?? 0x1f3a5a, 0, 0.37, MITTE_Z + 0.4, { schatten: true });
    teil(new THREE.BoxGeometry(1.36, 0.03, 0.66), 0xffffff, 0, 0.755, MITTE_Z + 0.4);

    // Der Pokal: bei kleinen Turnieren kleiner. Ist das Modell noch nicht geladen, steht ein einfacher goldener Becher da.
    this.pokalMass = klein ? 0.55 : o.gross < 0.8 ? 0.8 : 1;
    this.pokal = requisit('pokal_' + o.art, { rau: 0.35, metall: 0.15 });
    if (!this.pokal) {
      const becher = new THREE.CylinderGeometry(0.14, 0.07, 0.45, 16).translate(0, 0.225, 0);
      becher.userData.ehrung = true;
      this.pokal = new THREE.Mesh(becher,
        new THREE.MeshStandardMaterial({ color: 0xe8c040, roughness: 0.3, metalness: 0.6 }));
    }
    this.pokal.scale.setScalar(this.pokalMass);
    this.pokalTisch = new THREE.Vector3(0.3, 0.77, MITTE_Z + 0.4);
    this.pokal.position.copy(this.pokalTisch);
    G.add(this.pokal);
    this.pokalK = 0;          // 0 = steht auf dem Tisch, 1 = in deinen Händen

    // Der Teller für den Zweiten: eine flache silberne Scheibe, die auf dem Tisch an einem kleinen Ständer lehnt
    this.teller = teil(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 28).rotateX(Math.PI / 2), 0xd8dce4, -0.35, 0.95, MITTE_Z + 0.4, { rau: 0.25, metall: 0.7, schatten: true });
    this.teller.scale.setScalar(klein ? 0.75 : 1);
    this.tellerTisch = this.teller.position.clone();
    this.tellerK = 0;

    const steh = (name, x, z, opts) => {
      const m = requisit(name, opts);
      if (!m) return null;
      m.position.set(x, 0, z);
      m.rotation.y = Math.PI;        // schaut zum Netz, also in die Kamera
      G.add(m);
      return m;
    };
    // Ballkinder im Spalier hinter den Spielern
    if (o.gross >= KINDER_AB) {
      const hemd = { farbe: o.farbe ?? 0x1f3a5a, hell: [0.3, 0.72] };
      for (const x of [-4.1, -3.0, -1.9, 1.9, 3.0, 4.1]) steh('ballkind', x, MITTE_Z + 1.9, hemd);
    }

    // Der große Scheck: ein Schild, auf dem das Preisgeld steht
    this.scheck = null;
    if (o.geld > 0) {
      const bild = document.createElement('canvas');
      bild.width = 512; bild.height = 240;
      const s = bild.getContext('2d');
      s.fillStyle = '#fdfdf6'; s.fillRect(0, 0, 512, 240);
      s.strokeStyle = '#1f3a5a'; s.lineWidth = 10; s.strokeRect(5, 5, 502, 230);
      s.fillStyle = '#1f3a5a'; s.textAlign = 'center';
      s.font = 'bold 30px sans-serif'; s.fillText(String(o.turnier || 'Turniersieg').slice(0, 28), 256, 52);
      s.font = '24px sans-serif'; s.fillText('Preisgeld für den Sieger', 256, 92);
      s.font = 'bold 76px sans-serif'; s.fillStyle = '#167a3a';
      s.fillText('$ ' + Math.round(o.geld).toLocaleString('de-DE'), 256, 180);
      const tex = new THREE.CanvasTexture(bild);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.scheck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.03),
        [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: 0xfdfdf6 }))
          .concat([new THREE.MeshStandardMaterial({ color: 0xfdfdf6 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })]));
      // (Bei einem Quader sind die Seiten 4 und 5 vorn und hinten. Seite 5 schaut nach −z, also zur Kamera.)
      this.scheck.geometry.userData.ehrung = true;
      this.scheck.position.set(2.5, -1, MITTE_Z - 0.2);
      this.scheck.rotation.y = -0.25;
      G.add(this.scheck);
    }

    // Konfetti: viele kleine bunte Punkte, die herunterschweben
    this.konfetti = null;
    if (!klein && g.quality !== 'niedrig') {
      const n = Math.round(KONFETTI * (o.gross >= 0.8 ? 1 : 0.6));
      const ort = new Float32Array(n * 3), farbe = new Float32Array(n * 3), c = new THREE.Color();
      this.flocken = [];
      for (let i = 0; i < n; i++) {
        this.flocken.push({ x: (Math.random() - 0.5) * 9, y: 3 + Math.random() * 9, z: MITTE_Z - 3.5 + Math.random() * 6, v: 0.9 + Math.random() * 0.9, w: Math.random() * 6 });
        c.set(BUNT[i % BUNT.length]);
        farbe[i * 3] = c.r; farbe[i * 3 + 1] = c.g; farbe[i * 3 + 2] = c.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.userData.ehrung = true;
      geo.setAttribute('position', new THREE.BufferAttribute(ort, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
      this.konfetti = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.085, vertexColors: true }));
      this.konfetti.frustumCulled = false;
      this.konfetti.visible = false;
      G.add(this.konfetti);
    }

    // Die zwei Spieler: [du, dein Gegner]. Sie kommen von hinten und stellen sich links und rechts vom Tisch auf.
    this.leute = [
      { x: 3.4, z: MITTE_Z + 3.4, zx: 1.75, zz: MITTE_Z + 0.3, vx: 0, vz: 0, pose: null },
      { x: -3.4, z: MITTE_Z + 3.4, zx: -1.75, zz: MITTE_Z + 0.3, vx: 0, vz: 0, pose: null },
    ];
    g.showAvatars(true);
    g.ball.visible = g.blob.visible = g.trail.visible = false;
    if (g.maschine) g.maschine.visible = false;
    const k = KAMERA.aufstellen;
    g.camPos.set(k[0], k[1] + 2.5, k[2] - 1);
    g.camLook.set(k[3], k[4], k[5]);
  }

  // Zum nächsten Schritt. Gibt seinen Namen zurück (oder null, wenn die Ehrung vorbei ist).
  weiter() {
    let i = SCHRITTE.indexOf(this.schritt) + 1;
    if (SCHRITTE[i] === 'scheck' && !this.scheck) i++;     // ohne Preisgeld kein Scheck
    this.schritt = SCHRITTE[i] || null;
    this.zeit = 0;
    const [ich, er] = this.leute;
    if (this.schritt === 'teller') { er.zx = -0.95; er.zz = MITTE_Z - 0.6; }
    if (this.schritt === 'pokal') { er.zx = -2.3; er.zz = MITTE_Z + 0.3; ich.zx = 0.9; ich.zz = MITTE_Z - 0.7; }
    return this.schritt;
  }

  // Die Zuschauer jubeln (staerke 0…1) und das Konfetti fliegt los
  jubeln(staerke = 1) {
    const g = this.game;
    g.stadium.jubel(staerke);
    if (g.sound) g.sound.applause(Math.max(0.3, staerke * this.o.gross + 0.25), this.o.gross > 0.5);
    if (this.konfetti && staerke >= 0.8) this.konfetti.visible = true;      // Konfetti erst beim Sieger
  }

  // Jedes Bild aufrufen
  update(dt) {
    const g = this.game, o = this.o;
    this.zeit += dt;
    const [ich, er] = this.leute;

    // --- Gehen: jeder läuft zu seinem Ziel und bleibt dort stehen ---
    for (const p of this.leute) {
      const dx = p.zx - p.x, dz = p.zz - p.z, weit = Math.hypot(dx, dz);
      if (weit > 0.05) {
        const v = Math.min(GEH_TEMPO, weit * 3 + 0.3);
        p.vx = dx / weit * v; p.vz = dz / weit * v;
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.da = false;
      } else { p.vx = p.vz = 0; p.da = true; }
    }

    // --- Was passiert in diesem Schritt? ---
    const nach = SCHRITTE.indexOf(this.schritt);
    // Der Verlierer nimmt seinen Teller, sobald er am Tisch steht – und behält ihn dann
    if (nach >= 1 && (er.da || nach > 1)) {
      if (this.tellerK === 0) this.jubeln(0.45);
      this.tellerK = Math.min(1, this.tellerK + dt * 1.6);
      er.pose = 'pokal_halten';
    }
    // Du bekommst den Pokal und stemmst ihn hoch. Danach hältst du ihn vor der Brust.
    if (nach >= 2 && (ich.da || nach > 2)) {
      if (this.pokalK === 0) { this.jubeln(1); this.hochSeit = 0; }
      this.pokalK = Math.min(1, this.pokalK + dt * 1.4);
      this.hochSeit += dt;
      ich.pose = this.schritt === 'pokal' || this.schritt === 'foto' ? 'pokal_hoch' : 'pokal_halten';
    }
    // Der Scheck kommt von unten hochgefahren
    if (this.scheck) {
      const soll = nach >= 3 ? 1.15 : -1;
      this.scheck.position.y = mischen(this.scheck.position.y, soll, Math.min(1, dt * 4));
    }
    // Nach dem ersten Jubel klatschen die Zuschauer immer wieder ein bisschen weiter
    this.jubelZeit += dt;
    if (this.pokalK > 0 && this.jubelZeit > 2.2) { this.jubelZeit = 0; g.stadium.jubel(0.5 + 0.5 * o.gross); }

    // --- Die Figuren hinstellen ---
    for (let i = 0; i < 2; i++) {
      const av = g.avatars[i], p = this.leute[i];
      if (!av) continue;
      av.group.visible = true;
      // Spieler 0 schaut von sich aus zum Netz (also in die Kamera), Spieler 1 muss sich dafür umdrehen
      // (Solange jemand etwas in den Händen hält, steht er still – beim Gehen würden die Arme sonst pendeln.)
      const haelt = p.da && !!p.pose;
      av.update(dt, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, walk: !haelt, face: i === 0 ? 0 : Math.PI, mood: haelt ? p.pose : null, ohneSchlaeger: true });
    }
    // Pokal und Teller wandern vom Tisch in die Hände (genau zwischen beide Hände)
    const zwischen = (av, tiefer) => av.handLWorld.clone().add(av.handRWorld).multiplyScalar(0.5).add(new THREE.Vector3(0, -tiefer, 0));
    const weich = (k) => k * k * (3 - 2 * k);
    if (g.avatars[0] && g.avatars[0].handRWorld && this.pokalK > 0) {
      this.pokal.position.lerpVectors(this.pokalTisch, zwischen(g.avatars[0], 0.03), weich(this.pokalK));
      this.pokal.rotation.y += dt * 0.5;
    }
    if (g.avatars[1] && g.avatars[1].handRWorld && this.tellerK > 0) {
      this.teller.position.lerpVectors(this.tellerTisch, zwischen(g.avatars[1], -0.08), weich(this.tellerK));
    }

    // --- Konfetti fällt und schaukelt dabei hin und her ---
    if (this.konfetti && this.konfetti.visible) {
      const ort = this.konfetti.geometry.attributes.position;
      for (let i = 0; i < this.flocken.length; i++) {
        const f = this.flocken[i];
        f.y -= f.v * dt;
        if (f.y < 0.02) f.y = 7 + Math.random() * 4;      // unten angekommen: oben wieder anfangen
        ort.setXYZ(i, f.x + Math.sin(this.zeit * 2 + f.w) * 0.25, f.y, f.z + Math.cos(this.zeit * 1.7 + f.w) * 0.2);
      }
      ort.needsUpdate = true;
    }

    // --- Kamera ---
    const k = KAMERA[this.schritt] || KAMERA.foto;
    // Auf einem hohen, schmalen Bildschirm (Handy hochkant) passt weniger nebeneinander: Die Kamera geht weiter weg.
    const schmal = g.aspect < 1 ? 1.4 : 0;
    const ziel = new THREE.Vector3(k[0], k[1] + schmal * 0.5, Math.max(0.5, k[2] - schmal));
    g.camPos.lerp(ziel, Math.min(1, dt * 2));
    g.camLook.lerp(new THREE.Vector3(k[3], k[4], k[5]), Math.min(1, dt * 2.5));
    g.camera.position.copy(g.camPos);
    g.camera.lookAt(g.camLook);
  }

  // Das Siegerfoto: malt das Bild neu und gibt es klein als JPEG zurück (als Text, der mit "data:image/jpeg" beginnt)
  foto(breit = 320) {
    const g = this.game;
    g.renderer.render(g.scene, g.camera);
    const el = g.renderer.domElement;
    const bild = document.createElement('canvas');
    bild.width = breit;
    bild.height = Math.round(breit * 0.625);
    // Aus der Mitte einen Ausschnitt im Format 16:10 nehmen, damit das Foto auf jedem Gerät gleich aussieht
    let w = el.width, h = Math.round(w * 0.625);
    if (h > el.height) { h = el.height; w = Math.round(h / 0.625); }
    bild.getContext('2d').drawImage(el, (el.width - w) / 2, (el.height - h) / 2, w, h, 0, 0, bild.width, bild.height);
    try { return bild.toDataURL('image/jpeg', 0.72); } catch (e) { return null; }
  }

  // Alles wieder wegräumen
  ende() {
    if (!this.gruppe) { this.an = false; return; }
    this.gruppe.traverse((m) => {
      // Nur wegwerfen, was hier selbst gebaut wurde – die geladenen Modelle (Pokal, Ballkinder) werden noch gebraucht
      if (m.geometry && m.geometry.userData.ehrung) m.geometry.dispose();
      for (const mat of [].concat(m.material || [])) { if (mat.map && mat.map.isCanvasTexture) mat.map.dispose(); mat.dispose(); }
    });
    this.gruppe.removeFromParent();
    this.gruppe = null;
    this.an = false;
    for (const av of this.game.avatars) if (av) av.m.racket.visible = true;
  }
}
