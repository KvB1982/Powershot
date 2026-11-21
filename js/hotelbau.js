// Powershot – baut das Spieler-Hotel in 3D, dazu Wegweiser und Baustellen-Absperrungen für den Fußweg zum Hotel.
//
// Alles ist aus einfachen Formen gebaut (Kisten, Rollen, ein Dach-Dreieck) – keine fertigen Modelle.
// Vier Hotel-Arten:
//   turm    Hochhaus aus Glas auf einem breiten Sockel, oben eine Leuchtschrift
//   grand   großes altes Grandhotel mit zwei Seitenflügeln, dunklem Dach, Säulen-Eingang und Fahnen
//   resort  flaches Ferien-Hotel aus drei Teilen mit Ziegeldächern (die Palmen davor stellt gelaendebau.js hin)
//   chalet  Berghotel: unten weiß verputzt, oben Holz mit Balkonen, darüber ein großes Satteldach
// Wo das Hotel steht und wie groß es ist, rechnet hotelfahrt.js aus.
import * as THREE from 'three';

const HALB = Math.PI / 2;
const WAND_DREH = { s: 0, o: HALB, n: Math.PI, w: -HALB };      // wohin die Vorderseite schaut

// Ein Schriftzug als Bild (helle Buchstaben auf dunklem Grund), z. B. für das Dach
function schriftBild(text, hell = '#ffe9a8', dunkel = '#1c2230') {
  const b = document.createElement('canvas'); b.width = 512; b.height = 112;
  const s = b.getContext('2d');
  s.fillStyle = dunkel; s.fillRect(0, 0, 512, 112);
  s.fillStyle = hell; s.font = 'bold 76px sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle';
  s.fillText(text, 256, 60, 480);
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Glas-Fassade für das Hochhaus: helle Scheiben, die den Himmel spiegeln, schmale dunkle Rahmen, unten ein grauer Streifen je Stockwerk
function glasBild() {
  const b = document.createElement('canvas'); b.width = b.height = 64;
  const s = b.getContext('2d'), himmel = s.createLinearGradient(0, 0, 0, 64);
  himmel.addColorStop(0, '#eef7ff'); himmel.addColorStop(1, '#b9d6ee');
  s.fillStyle = himmel; s.fillRect(0, 0, 64, 64);
  s.fillStyle = '#93abc0'; s.fillRect(0, 50, 64, 14);
  s.fillStyle = '#5b6b7c'; s.fillRect(0, 0, 3, 64); s.fillRect(0, 62, 64, 2);
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// Rot-weiße Streifen für die Absperrung
function streifenBild() {
  const b = document.createElement('canvas'); b.width = 128; b.height = 16;
  const s = b.getContext('2d');
  for (let i = 0; i < 8; i++) { s.fillStyle = i % 2 ? '#f4f4f0' : '#d8342a'; s.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(b);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Baut ein Hotel. el = der Baustein aus hotelfahrt.js · w = Werkzeuge aus gelaendebau.js: { mat, bilder, schatten }
// Gibt { gruppe, hoehe, palmen } zurück (palmen = Stellen vor dem Hotel in Welt-Koordinaten, an denen eine Palme stehen soll).
export function hotelBauen(el, { mat, bilder, schatten }) {
  const G = new THREE.Group();
  G.position.set(el.x, 0, el.z);
  G.rotation.y = WAND_DREH[el.seite] ?? 0;
  const b = el.breit, t = el.tief, h = el.h, vorn = t / 2;
  const rein = (geo, material, x, y, z, wirft = true) => {
    const m = new THREE.Mesh(geo, material);
    m.userData.eigen = true;
    m.position.set(x, y, z);
    m.castShadow = wirft && schatten; m.receiveShadow = true;
    G.add(m);
    return m;
  };
  const kiste = (kb, kh, kt, x, y, z, farbe, o = {}, wirft = true) => rein(new THREE.BoxGeometry(kb, kh, kt), mat(farbe, o), x, y + kh / 2, z, wirft);
  // Eine Kiste mit Fenstern: Das Fenster-Bild wird so oft wiederholt, dass jedes Stockwerk seine Fensterreihe hat
  const fenster = (kb, kh, kt, x, y, z, farbe, stock = 3.1, o = {}) => {
    const geo = new THREE.BoxGeometry(kb, kh, kt), uv = geo.attributes.uv, wu = Math.max(1, Math.round(Math.max(kb, kt) / 3.4)), wv = Math.max(1, Math.round(kh / stock));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wu, uv.getY(i) * wv);
    return rein(geo, mat(farbe, { bild: o.glas ? glasBild() : bilder.fenster, ...o }), x, y + kh / 2, z);
  };
  // Leuchtschrift (auf beiden Seiten lesbar wäre teurer – sie schaut zur Straße)
  const schrift = (text, breit, x, y, z) => {
    kiste(breit + 0.6, breit * 0.22 + 0.5, 0.4, x, y - 0.25, z - 0.25, 0x1c2230);
    const m = rein(new THREE.PlaneGeometry(breit, breit * 0.22), new THREE.MeshBasicMaterial({ map: schriftBild(text) }), x, y + breit * 0.11, z, false);
    return m;
  };
  // Eingang: Vordach auf zwei Säulen, dunkle Glastür, roter Teppich
  // (Die Säulen stehen dicht an der Wand: Das Vordach ragt frei über die Vorfahrt, damit der Wagen darunter halten kann.)
  const eingang = (breit, farbe = 0x3a4048) => {
    kiste(breit, 0.35, 8, 0, 3.9, vorn + 4, farbe, { rau: 0.5 });
    for (const s of [-1, 1]) rein(new THREE.CylinderGeometry(0.22, 0.22, 3.9, 10), mat(0xe8e4dc), s * (breit / 2 - 0.5), 1.95, vorn + 1.7);
    kiste(Math.min(5, breit - 2), 3.2, 0.2, 0, 0, vorn + 0.05, 0x1a2230, { rau: 0.2, metall: 0.3 }, false);
    const teppich = kiste(3, 0.06, 2.6, 0, 0.1, vorn + 1.3, 0xb8302a, {}, false);
    Object.assign(teppich.material, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -60 });
  };
  const palmen = [];
  let hoehe = h;

  if (el.art === 'turm') {
    const sockel = Math.min(9, h * 0.14), tb = b * 0.6, tt = t * 0.72, glas = el.klein ? 0xf2f6f8 : 0xe4eef6;
    fenster(b, sockel, t, 0, 0, 0, 0xd8d4cc, 3.6);
    kiste(b + 0.8, 0.5, t + 0.8, 0, sockel, 0, 0x5a6068);
    fenster(tb, h - sockel, tt, 0, sockel + 0.5, 0, glas, 3.3, { rau: 0.3, metall: 0.1, glas: true });
    // Dunkle Kanten an den Seiten und eine Krone oben – so sieht der Turm nicht wie ein glatter Klotz aus
    for (const s of [-1, 1]) kiste(1.1, h - sockel + 2.5, tt + 0.7, s * (tb / 2 + 0.3), sockel + 0.5, 0, 0x39424e, { rau: 0.5 });
    kiste(tb + 1.4, 1, tt + 1.4, 0, h + 0.5, 0, 0x39424e);
    kiste(tb * 0.55, 3.6, tt * 0.6, 0, h + 1.5, 0, 0xc8ccd4, { rau: 0.5 });
    rein(new THREE.CylinderGeometry(0.12, 0.2, 9, 6), mat(0xd8d8d8, { metall: 0.5 }), tb * 0.15, h + 9.6, 0);
    schrift('HOTEL', tb * 0.8, 0, h - tb * 0.26, tt / 2 + 0.3);
    eingang(12);
    hoehe = h + 5;
  } else if (el.art === 'resort') {
    const ziegel = 0xc86a4a, wand = 0xf4e8d0;
    fenster(b * 0.36, h, t, 0, 0, 0, wand, 3.2);
    for (const s of [-1, 1]) fenster(b * 0.32, h * 0.72, t * 0.84, s * b * 0.34, 0, -t * 0.08, 0xf0dcc0, 3.2);
    // flache Ziegeldächer, die ein Stück überstehen
    kiste(b * 0.36 + 1.6, 0.7, t + 1.6, 0, h, 0, ziegel);
    for (const s of [-1, 1]) kiste(b * 0.32 + 1.4, 0.6, t * 0.84 + 1.6, s * b * 0.34, h * 0.72, -t * 0.08, ziegel);
    kiste(b * 0.2, 1.6, t * 0.5, 0, h + 0.7, 0, wand);
    schrift('RESORT', b * 0.2, 0, h * 0.62, vorn + 0.25);
    eingang(10, ziegel);
    // Palmen in einer Reihe vor dem Haus
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * b * 0.15; if (Math.abs(x) > 7) palmen.push([x, vorn + 2.4]); }
    hoehe = h + 2.3;
  } else if (el.art === 'chalet') {
    const unten = h * 0.42;
    fenster(b, unten, t, 0, 0, 0, 0xf2ece0, 3.1);
    fenster(b, h - unten, t, 0, unten, 0, 0x8a5a36, 2.9);
    // Balkone mit Blumenkästen (ein roter Streifen)
    for (let y = unten; y < h - 1; y += 2.9) { kiste(b + 0.6, 0.85, 1.1, 0, y, vorn + 0.5, 0x6a4428); kiste(b + 0.2, 0.22, 0.3, 0, y + 0.85, vorn + 0.95, 0xd8342a, {}, false); }
    // Das große Dach: ein Dreieck, in die Länge gezogen (der First läuft quer)
    const dh = Math.max(4.5, t * 0.3), halb = t / 2 + 2.2;
    const dreieck = new THREE.Shape([new THREE.Vector2(-halb, 0), new THREE.Vector2(halb, 0), new THREE.Vector2(0, dh)]);
    rein(new THREE.ExtrudeGeometry(dreieck, { depth: b + 2.4, bevelEnabled: false }).translate(0, 0, -(b + 2.4) / 2).rotateY(HALB), mat(0x4a3628), 0, h, 0);
    schrift('HOTEL', 9, 0, unten + 1.1, vorn + 1.3);      // über dem Vordach, vorn am ersten Balkon
    eingang(8, 0x6a4428);
    hoehe = h + dh;
  } else {
    // Grandhotel: Mittelteil, zwei Flügel, die etwas vorspringen, dunkles Dach mit Aufsatz, Säulen-Eingang, Fahnen
    const wand = el.klein ? 0xf0e6d0 : 0xf2e8d4, dach = 0x4a5360, mt = t * 0.84;
    fenster(b * 0.64, h, mt, 0, 0, -t * 0.08, wand, 3.4);
    for (const s of [-1, 1]) fenster(b * 0.19, h, t, s * b * 0.405, 0, 0, 0xe8dcc4, 3.4);
    kiste(b + 0.8, 0.5, t + 0.8, 0, h, 0, 0xf8f4ea);                                             // helles Gesims rundherum
    kiste(b * 0.64 + 0.2, 2.6, mt - 1.4, 0, h + 0.5, -t * 0.08, dach);
    for (const s of [-1, 1]) kiste(b * 0.19 - 0.8, 3.6, t - 1.6, s * b * 0.405, h + 0.5, 0, dach);
    kiste(b * 0.2, 2.2, mt * 0.5, 0, h + 3.1, -t * 0.08, dach);
    // Eingang mit vier Säulen und einem kleinen Balkon darüber
    kiste(12, 0.5, 8.4, 0, 4.6, vorn + 3.6, 0xf8f4ea);
    for (const x of [-5.2, -1.8, 1.8, 5.2]) rein(new THREE.CylinderGeometry(0.3, 0.34, 4.6, 12), mat(0xf8f4ea), x, 2.3, vorn + 1.6);
    kiste(5, 3.4, 0.2, 0, 0, -t * 0.08 + mt / 2 + 0.05, 0x1a2230, { rau: 0.2, metall: 0.3 }, false);
    const teppich = kiste(3, 0.06, 3.4, 0, 0.1, vorn + 0.8, 0xb8302a, {}, false);
    Object.assign(teppich.material, { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -60 });
    schrift('GRAND HOTEL', b * 0.3, 0, h + 0.9, -t * 0.08 + mt / 2 - 0.4);
    // Drei Fahnen auf dem Dach
    [0xe84a3a, 0xf4f4f0, 0x3a6ae8].forEach((f, i) => {
      const x = (i - 1) * 3.4;
      rein(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), mat(0xd8d8d8), x, h + 8.3, -t * 0.08);
      kiste(1.9, 1.1, 0.05, x + 1, h + 10, -t * 0.08, f, { beide: true }, false);
    });
    hoehe = h + 6;
  }
  // Die Palmen-Stellen vom Hotel aus in die Welt umrechnen
  G.updateMatrixWorld(true);
  const welt = palmen.map(([x, z]) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(G.matrixWorld); return [p.x, p.z]; });
  return { gruppe: G, hoehe, palmen: welt };
}

// Schmuck für die kleine Pension im Städtchen (hotelweg.js): Leuchtschrift „HOTEL“ über der Tür, eine rote Markise
// und zwei Blumenkübel. Die Tür zeigt dort immer nach Süden (+z). Zu Hause (el.heim) gibt es keine Leuchtschrift.
export function pensionSchmuck(el, { mat, schatten }) {
  const G = new THREE.Group(), vorn = el.t / 2;
  G.position.set(el.x, 0, el.z);
  const kiste = (b, h, t, x, y, z, farbe) => { const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), mat(farbe)); m.position.set(x, y + h / 2, z); m.castShadow = schatten; m.userData.eigen = true; G.add(m); return m; };
  if (!el.heim) {
    kiste(7.6, 2, 0.3, 0, el.h * 0.47, vorn + 0.2, 0x1c2230);
    const text = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.54), new THREE.MeshBasicMaterial({ map: schriftBild('HOTEL') }));
    text.position.set(0, el.h * 0.47 + 1, vorn + 0.37); text.userData.eigen = true; G.add(text);
  }
  kiste(4.4, 0.16, 1.9, 0, 3, vorn + 0.9, el.heim ? 0x3a7a4a : 0xb8302a).rotation.x = 0.22;      // die Markise hängt vorn etwas herunter
  for (const s of [-1, 1]) {
    kiste(0.7, 0.6, 0.7, s * 2.6, 0, vorn + 0.6, 0x8a5a36);
    const busch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(0x3a8a3a)); busch.position.set(s * 2.6, 1, vorn + 0.6); busch.userData.eigen = true; G.add(busch);
  }
  return G;
}

// Ein Wegweiser: Pfosten mit einem gelben Pfeil-Schild. el.w = die Richtung, in die der Pfeil zeigt.
export function wegweiserBauen(el, { mat, schatten }) {
  const G = new THREE.Group();
  G.position.set(el.x, 0, el.z);
  const pfosten = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.9, 8).translate(0, 1.45, 0), mat(0x4a4e56, { metall: 0.4 }));
  // Das Pfeil-Schild: ein Rechteck mit Spitze, liegt zuerst flach in der Zeichen-Ebene und wird dann aufgestellt
  const form = new THREE.Shape([[-0.2, -0.24], [1.15, -0.24], [1.6, 0], [1.15, 0.24], [-0.2, 0.24]].map(([x, y]) => new THREE.Vector2(x, y)));
  const arm = new THREE.Group();
  arm.position.y = 2.55; arm.rotation.y = el.w - HALB;             // die Spitze der Form zeigt nach +x, gedreht wird sie in Richtung w
  const brett = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03), mat(0xf0c832, { rau: 0.6 }));
  const bild = schriftBild(el.text || 'Hotel', '#1c2230', '#f0c832');
  for (const s of [-1, 1]) {
    const text = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: s > 0 ? bild : bild.clone() }));
    text.position.set(0.5, 0, s * 0.04); if (s < 0) text.rotation.y = Math.PI;
    text.userData.eigen = true; arm.add(text);
  }
  arm.add(brett);
  G.add(pfosten, arm);
  for (const m of [pfosten, brett]) { m.userData.eigen = true; m.castShadow = schatten; }
  return G;
}

// Eine Absperrung quer über die Gasse: rot-weiße Balken auf Pfosten, dazu ein paar orange Hütchen („Baustelle“)
export function absperrungBauen(el, { mat, schatten }) {
  const G = new THREE.Group();
  G.position.set(el.x, 0, el.z);
  const quer = el.t > el.b, lang = Math.max(el.b, el.t) - 0.4;      // quer = die Absperrung läuft in z-Richtung
  if (quer) G.rotation.y = HALB;
  const bild = streifenBild(); bild.wrapS = THREE.RepeatWrapping; bild.repeat.set(Math.max(1, Math.round(lang / 2.4)), 1);
  const rot = mat(0xffffff, { bild });
  for (const y of [0.55, 1.05]) { const m = new THREE.Mesh(new THREE.BoxGeometry(lang, 0.22, 0.08), y > 1 ? rot : rot.clone()); m.position.y = y; m.userData.eigen = true; m.castShadow = schatten; G.add(m); }
  const n = Math.max(2, Math.round(lang / 2.4)), grau = mat(0x8a8e96);
  for (let i = 0; i <= n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.1), i ? grau.clone() : grau); p.position.set((i / n - 0.5) * lang, 0.62, 0); p.userData.eigen = true; G.add(p); }
  // Hütchen und ein Sandhaufen dahinter
  const orange = mat(0xf07a1e);
  for (const x of [-lang * 0.3, 0.4, lang * 0.32]) { const k = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), x < 0 ? orange : orange.clone()); k.position.set(x, 0.28, 0.7); k.userData.eigen = true; G.add(k); }
  const sand = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, HALB).scale(1.3, 0.6, 0.5), mat(0xc8a878));
  sand.position.set(-lang * 0.1, 0, -0.1); sand.userData.eigen = true; G.add(sand);
  return G;
}
