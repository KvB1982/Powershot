// Powershot – das Stadion: Platz, Linien, Netz, Banden, Tribünen, Zuschauer, Licht

import * as THREE from 'three';
import { COURT as C } from './physics.js';

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

function bannerTexture(text, bg, fg = '#ffffff') {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 64);
  g.fillStyle = fg;
  g.font = 'bold 34px Arial, sans-serif';
  g.textBaseline = 'middle';
  let x = 20;
  const parts = [text, 'POWERSHOT', text, 'ATP TOUR'];
  let i = 0;
  while (x < 1000) {
    const s = parts[i++ % parts.length];
    g.globalAlpha = s === text ? 1 : 0.7;
    g.fillText(s, x, 34);
    x += g.measureText(s).width + 70;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (m.map) m.map.dispose(); m.dispose(); }
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
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.sky, 70, 190);

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
    flat(RUN_X * 2, RUN_Z * 2, 0, 0, 0, 0, outerTex);
    const courtTex = surfaceTexture(def.surface, th.court); courtTex.repeat.set(4, 8);
    flat(C.WD * 2, C.L * 2, 0, 0, 0.004, 0, courtTex);

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
    const net = new THREE.Mesh(new THREE.PlaneGeometry(C.NET_W * 2, 0.95), netMat);
    net.position.set(0, 0.475, 0);
    G.add(net);
    const tape = box(C.NET_W * 2, 0.07, 0.03, 0xffffff, 0, 0.96, 0, { cast: true, rough: 0.6 });
    tape.material.side = THREE.DoubleSide;
    box(0.05, 0.92, 0.02, 0xffffff, 0, 0.46, 0);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.5 }));
      post.position.set(s * C.NET_W, 0.55, 0);
      post.castShadow = true;
      G.add(post);
    }

    // --- Schiedsrichterstuhl und Bänke ---
    const chairX = -(C.NET_W + 1.2);
    box(0.7, 1.9, 0.7, 0x2a4a3a, chairX, 0.95, 0, { cast: true });
    box(0.8, 0.5, 0.75, 0x1f3a2a, chairX, 2.1, 0, { cast: true });
    const ump = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe6c0a0 }));
    ump.position.set(chairX, 2.75, 0); G.add(ump);
    box(0.5, 0.6, 0.35, 0x24406a, chairX, 2.45, 0, { cast: true });
    for (const s of [-1, 1]) {
      box(0.6, 0.45, 2.2, 0x3a3a44, chairX - 0.3, 0.22, s * 4, { cast: true });
      box(0.15, 0.9, 2.2, 0x3a3a44, chairX - 0.65, 0.45, s * 4, { cast: true });
    }

    // --- Banden mit Schriftzug ---
    const wallH = 1.05;
    const bg = '#' + new THREE.Color(th.wall).getHexString();
    const mkBanner = () => bannerTexture(def.name.toUpperCase(), bg);
    for (const s of [-1, 1]) {
      const a = box(0.3, wallH, RUN_Z * 2, 0xffffff, s * RUN_X, wallH / 2, 0, { map: mkBanner() });
      a.material.map.wrapS = THREE.RepeatWrapping; a.material.map.repeat.set(2, 1);
      const b = box(RUN_X * 2, wallH, 0.3, 0xffffff, 0, wallH / 2, s * RUN_Z, { map: mkBanner() });
      b.material.map.wrapS = THREE.RepeatWrapping;
    }

    // --- Tribünen ---
    const rows = quality === 'niedrig' ? 9 : 14;
    const stepD = 0.95, stepH = 0.5;
    const seatCol = th.seats;
    const seats = [];   // Sitzplätze für Zuschauer: {x,y,z}
    for (let r = 0; r < rows; r++) {
      const y = wallH + r * stepH;
      const off = 0.6 + r * stepD;
      for (const s of [-1, 1]) {
        // Längsseiten
        const lenZ = (RUN_Z + off) * 2;
        box(stepD, y, lenZ, shade(seatCol, 0.85 + (r % 2) * 0.1), s * (RUN_X + off), y / 2, 0);
        for (let z = -RUN_Z; z <= RUN_Z; z += 0.62) seats.push({ x: s * (RUN_X + off), y, z });
        // Kopfseiten
        const lenX = (RUN_X + off) * 2;
        box(lenX, y, stepD, shade(seatCol, 0.85 + (r % 2) * 0.1), 0, y / 2, s * (RUN_Z + off));
        for (let x = -RUN_X; x <= RUN_X; x += 0.62) seats.push({ x, y, z: s * (RUN_Z + off) });
      }
    }
    const topY = wallH + rows * stepH, topOff = 0.6 + rows * stepD;
    // Oberer Rand der Arena
    for (const s of [-1, 1]) {
      box(1.2, 2.2, (RUN_Z + topOff) * 2 + 2.4, shade(th.wall, 0.7), s * (RUN_X + topOff + 0.6), topY + 1.1, 0);
      box((RUN_X + topOff) * 2 + 2.4, 2.2, 1.2, shade(th.wall, 0.7), 0, topY + 1.1, s * (RUN_Z + topOff + 0.6));
    }

    // --- Zuschauer ---
    const fill = quality === 'niedrig' ? 0.45 : 0.86;
    const people = seats.filter(() => Math.random() < fill);
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 0.3);
    const headGeo = new THREE.SphereGeometry(0.13, 6, 5);
    const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), people.length);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), people.length);
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const shirts = [0xffffff, 0xe84a3a, 0x2e6fd8, 0xf2e85c, 0x1fb87a, 0xff9a2a, 0x9a3ad8, 0xd8d8d8, 0x303844, 0x7ac8ff];
    const skins = [0xf0c8a0, 0xe2b48c, 0xc99872, 0x9a6a48, 0x7a4a30];
    people.forEach((p, i) => {
      const jx = (Math.random() - 0.5) * 0.12, jy = Math.random() * 0.08;
      mtx.makeTranslation(p.x + jx, p.y + 0.3 + jy, p.z);
      bodies.setMatrixAt(i, mtx);
      bodies.setColorAt(i, col.setHex(shirts[Math.floor(Math.random() * shirts.length)]).multiplyScalar(night ? 0.75 : 1));
      mtx.makeTranslation(p.x + jx, p.y + 0.7 + jy, p.z);
      heads.setMatrixAt(i, mtx);
      heads.setColorAt(i, col.setHex(skins[Math.floor(Math.random() * skins.length)]).multiplyScalar(night ? 0.75 : 1));
    });
    G.add(bodies, heads);

    // --- Große Anzeigetafel am hinteren Ende ---
    this.boardTex = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: this.boardTex }));
    board.position.set(0, topY + 5.2, -(RUN_Z + topOff + 0.4));
    G.add(board);
    box(11.6, 6.1, 0.4, 0x111318, 0, topY + 5.2, -(RUN_Z + topOff + 0.7));
    this.setBoard([def.name, def.city], '');

    // --- Halle: Dach ---
    if (indoor) {
      const roof = flat(140, 140, 0x0a0a10, 0, topY + 16, 0);
      roof.rotation.x = Math.PI / 2;
    }

    // --- Flutlicht-Masten (abends) ---
    if (night && !indoor) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const mx = sx * (RUN_X + topOff + 3), mz = sz * (RUN_Z + topOff + 3);
        box(0.5, topY + 14, 0.5, 0x30343c, mx, (topY + 14) / 2, mz);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
        lamp.position.set(mx, topY + 14, mz);
        lamp.lookAt(0, 0, 0);
        G.add(lamp);
      }
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
