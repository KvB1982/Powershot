// Powershot – die Landschaft RUND UM ein Turniergelände, damit es nicht wie auf einer leeren Platte liegt.
//
// Jedes Gelände sagt für seine vier Seiten (n = Norden, o = Osten, s = Süden, w = Westen) in ein paar Wörtern,
// was dort ist, zum Beispiel  um: { n: 'wald alpen', o: 'vorort huegel', s: 'meer', w: 'stadt skyline' }.
//
//   In der Nähe (bis etwa 260 m vor dem Zaun, dort ist alles flach):
//     wald · vorort (Straßen mit kleinen Häusern) · stadt (Häuserblocks) · felder · park · parkplatz · wueste
//   In der Ferne (dahinter steigt der Boden an):
//     huegel · waldberge · berge · alpen (mit Schnee) · fels (kahle Wüstenberge) · skyline (Hochhäuser am Horizont)
//   meer = dort ist nur Wasser.   ab:80 = der Boden steigt schon 80 m vor dem Zaun an.   Eine Zahl hinter dem Wort ändert die Höhe: 'berge:90' = etwa 90 m hoch.
//
// Gebaut wird alles aus einfachen Formen, die zu wenigen großen Formen verschmolzen werden (schnell fürs iPad).
// Die Berge sind EIN großes Tuch aus Dreiecken, das draußen hochgezogen wird; ein „Rauschen“ macht es buckelig.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const HALB = Math.PI / 2;
// ---- Zahlen zum Einstellen ----
const FLACH_BIS = 260;        // so viele Meter vor dem Zaun bleibt der Boden flach (dort liegen Straßen, Flüsse, Häuser)
const TUCH = 3400, MASCHEN = 136;   // das Berg-Tuch: Kantenlänge in Metern und wie viele Kästchen je Seite
// Die Berg-Arten: hoch = Höhe in Metern · breit = auf so vielen Metern steigt es an · zackig = wie schroff (0 = sanft, 1 = wild)
const FERN = {
  huegel: { hoch: 30, breit: 240, zackig: 0.1 },
  waldberge: { hoch: 75, breit: 300, zackig: 0.35 },
  berge: { hoch: 130, breit: 340, zackig: 0.6 },
  alpen: { hoch: 230, breit: 380, zackig: 0.9 },
  fels: { hoch: 150, breit: 340, zackig: 0.8 },
};
const NAH = ['wald', 'vorort', 'stadt', 'felder', 'park', 'parkplatz', 'wueste'];
// Farben der Häuser je Gegend: [Wände], [Dächer], [Hochhäuser]
const HAUS_FARBEN = {
  modern: [[0xe8e4dc, 0xd8d0c0, 0xc8bca8, 0xb86a4a], [0x6a4a3e, 0x5a5e66, 0x8a4a3a], [0x8aa2bc, 0x9aa6b0, 0xc8ccd0, 0x6a8aa8]],
  europa: [[0xe8dcc4, 0xd8c8a8, 0xe4d4b8, 0xc8b89a], [0x5a5e68, 0x6a6e78, 0x8a4a3a], [0xd8ccb4, 0xc8c0b0, 0x9aa6b0, 0xe0d8c8]],
  england: [[0xa8553a, 0x9a4a34, 0xb8664a, 0xd8ccb8], [0x4a4a52, 0x5a4a44, 0x3e4048], [0xa8553a, 0x9aa6b0, 0xb8a898, 0x8a8e96]],
  mittelmeer: [[0xf0dcc0, 0xe8c8a0, 0xf4e8d4, 0xe0b890], [0xc86a4a, 0xb85e42, 0xd07a56], [0xe8dcc8, 0xf0e4d0, 0xd8c8b0, 0xe4d0b8]],
  wueste: [[0xe8d8b8, 0xd8c4a0, 0xf0e4cc, 0xc8b08a], [0xb8805a, 0xc8a078, 0xa87050], [0xd8ccb8, 0xe8dcc8, 0xc8bca8, 0xb8c4cc]],
  usa: [[0xe8e4dc, 0xc8d0d8, 0xd8c8b0, 0xb8a898], [0x4a4e56, 0x5a4a44, 0x6a6e76], [0x7a92ac, 0x8a9aa8, 0x5a7290, 0xa8b4bc]],
  asien: [[0xe4e4e0, 0xd8d8d4, 0xc8ccd0, 0xe8dcd0], [0x5a6068, 0x6a7078, 0x8a4a3a], [0xa8b8c8, 0xc8d0d8, 0x8aa2bc, 0xd8dce0]],
  alpen: [[0xf0ece0, 0x8a5a36, 0xe8dcc8, 0x9a6a44], [0x4a3a2c, 0x5a4636, 0x6a4a3a], [0xe8e0d0, 0xd8d0c0, 0xc8c0b0, 0xb8b0a0]],
};
const LACK = [0xd8d8dc, 0x30343c, 0xb83a2a, 0x2a4a8a, 0x8a8e96, 0xe8e4d8, 0x1c1c20, 0xf4f4f0];

// Liest die Wörter einer Seite: 'wald berge:90' → { nah: ['wald'], fern: 'berge', hoch: 90, … }
function lesen(text = '') {
  const s = { nah: [], fern: null, hoch: 0, breit: 240, zackig: 0, skyline: false, meer: false };
  for (const wort of text.split(/\s+/)) {
    const [name, zahl] = wort.split(':');
    if (NAH.includes(name)) s.nah.push(name);
    else if (FERN[name]) { s.fern = name; Object.assign(s, FERN[name]); if (zahl) s.hoch = +zahl; }
    else if (name === 'skyline') s.skyline = +zahl || 1;
    else if (name === 'meer') s.meer = true;
    else if (name === 'ab') s.ab = +zahl;                  // 'ab:80' = hier steigt der Boden schon 80 m vor dem Zaun an
  }
  return s;
}

// Rechnet für ein Gelände aus, wie hoch der Boden an jeder Stelle ist. (ohne Zeichnen – nur Zahlen)
export function landschaftVon(g) {
  const r = g.rand, um = g.um || {}, S = { n: lesen(um.n), o: lesen(um.o), s: lesen(um.s), w: lesen(um.w) };
  let saat = 0; for (const c of g.name || 'x') saat = (saat * 31 + c.charCodeAt(0)) % 9973;
  // „Rauschen“: an jedem Gitterpunkt eine feste Zufallszahl, dazwischen wird weich überblendet
  const zufallAn = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7 + saat * 0.37) * 43758.5453; return s - Math.floor(s); };
  const rausch = (x, z) => {
    const i = Math.floor(x), k = Math.floor(z), fx = x - i, fz = z - k, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    return (zufallAn(i, k) * (1 - ux) + zufallAn(i + 1, k) * ux) * (1 - uz) + (zufallAn(i, k + 1) * (1 - ux) + zufallAn(i + 1, k + 1) * ux) * uz;
  };
  // Wie stark gehört eine Stelle zu welcher Seite? (in den Ecken mischen sich zwei Seiten)
  const lage = (x, z) => {
    const dn = Math.max(0, r.z0 - z), ds = Math.max(0, z - r.z1), dw = Math.max(0, r.x0 - x), dO = Math.max(0, x - r.x1);
    const d2 = dn * dn + ds * ds + dw * dw + dO * dO;
    return d2 ? { weit: Math.sqrt(d2), n: dn * dn / d2, s: ds * ds / d2, w: dw * dw / d2, o: dO * dO / d2 } : { weit: 0, n: 0, s: 0, w: 0, o: 0 };
  };
  const hoehe = (x, z, L = lage(x, z)) => {
    if (L.weit <= 0) return 0;
    let hoch = 0, breit = 0, zackig = 0, ab = 0;
    for (const k of 'nosw') { const s = S[k]; hoch += L[k] * s.hoch; breit += L[k] * s.breit; zackig += L[k] * s.zackig; ab += L[k] * (s.ab ?? FLACH_BIS); }
    if (hoch < 0.5) return 0;
    const t = Math.max(0, Math.min(1, (L.weit - ab) / breit)), steig = t * t * (3 - 2 * t);
    if (!steig) return 0;
    const sanft = rausch(x / 300, z / 300) * 0.55 + rausch(x / 120, z / 120) * 0.3 + rausch(x / 50, z / 50) * 0.15;
    const grat = 1 - Math.abs(2 * rausch(x / 230 + 7, z / 230 + 3) - 1), wild = grat * grat * 0.75 + rausch(x / 70, z / 70) * 0.25;
    return hoch * steig * (0.3 + 0.7 * (sanft * (1 - zackig) + wild * zackig * 1.15));
  };
  return { S, lage, hoehe, rausch, saat };
}

// Baut die Landschaft. a = { g, plan, bilder, mat, neu, flach, G, baeume, wenig } – die Werkzeuge kommen aus gelaendebau.js
export function umgebungBauen(a) {
  const { g, plan, bilder, mat, neu, flach, baeume, wenig } = a, r = g.rand, mx = (r.x0 + r.x1) / 2, mz = (r.z0 + r.z1) / 2;
  const L = landschaftVon(g), { S } = L;
  let zz = 1000 + L.saat;
  const zf = () => { zz = (zz * 16807) % 2147483647; return zz / 2147483647; };
  const aus = (liste) => liste[Math.floor(zf() * liste.length)];
  const winter = g.umland === 0xeef2f6 || new THREE.Color(g.umland).getHSL({}).l > 0.85, wueste = g.stil === 'wueste';
  const farben = HAUS_FARBEN[g.stil] || HAUS_FARBEN.modern, c = new THREE.Color(), c2 = new THREE.Color();
  const dicht = wenig ? 0.3 : 1;                                  // bei Qualität „niedrig“ steht weniger herum
  const baumArt = g.fichte ? 'zypresse' : Object.entries({ laub: 0, palme: 0, pinie: 0, zypresse: 0, ...plan.teile.reduce((z, el) => { if (el.a === 'baeume') z[el.art] = (z[el.art] || 0) + el.n; return z; }, {}) }).sort((p, q) => q[1] - p[1])[0][0];

  // ---- Was liegt draußen schon? Dort wird nichts hingestellt (Straßen, Flüsse, Häuser aus dem Lageplan) ----
  const belegt = [{ x: mx, z: mz, b: r.x1 - r.x0 + 24, t: r.z1 - r.z0 + 24 }];
  let meerAb = Infinity;
  for (const el of plan.teile) {
    if (el.a === 'meer') meerAb = el.ab;
    else if (el.a === 'tuerme') for (const [x, z, b, t] of el.p) belegt.push({ x, z, b: b + 8, t: t + 8 });
    else if (el.a === 'kugel') belegt.push({ x: el.x, z: el.z, b: el.r * 3, t: el.r * 3 });
    else if (typeof el.x === 'number' && el.b && el.t && el.a !== 'baeume' && el.a !== 'schirme' && Math.max(el.b, el.t) < 1500) belegt.push({ x: el.x, z: el.z, b: el.b + 4, t: el.t + 4 });
  }
  const frei = (x, z, halb = 0) => z + halb < meerAb - 4 && !belegt.some((s) => Math.abs(x - s.x) < s.b / 2 + halb && Math.abs(z - s.z) < s.t / 2 + halb);

  // ---- 1. Das Berg-Tuch ----
  const bodenF = new THREE.Color(g.umland);
  const farbeAn = (art, h, hoch, x, z) => {
    // Unten sieht der Berg aus wie das Umland, weiter oben je nach Art: Wald, Fels, Schnee
    const t = Math.max(0, Math.min(1, h / Math.max(1, hoch))), fleck = L.rausch(x / 40, z / 40) * 0.12 - 0.06;
    c.copy(bodenF);
    if (art === 'alpen') { c.lerp(c2.setHex(0x3f6a40), Math.min(1, t * 5)); if (t > 0.38) c.lerp(c2.setHex(0x8a8a84), Math.min(1, (t - 0.38) * 6)); if (t > 0.6 + fleck) c.lerp(c2.setHex(0xf2f4f8), Math.min(1, (t - 0.6 - fleck) * 9)); }
    else if (art === 'berge') { c.lerp(c2.setHex(winter ? 0xdfe4ea : 0x4a7a44), Math.min(1, t * 4)); if (t > 0.55) c.lerp(c2.setHex(0x8e8a7c), Math.min(1, (t - 0.55) * 4)); }
    else if (art === 'fels') { c.lerp(c2.setHex(0xb89a74), Math.min(1, t * 4)); if (t > 0.3) c.lerp(c2.setHex(0x8e6e56), Math.min(1, (t - 0.3) * 2.5)); if (t > 0.75) c.lerp(c2.setHex(0xa8948a), (t - 0.75) * 3); }
    else if (art === 'waldberge') c.lerp(c2.setHex(winter ? 0xd8dee6 : 0x2f5e38), Math.min(1, t * 4));
    else c.lerp(c2.setHex(winter ? 0xe4e8ee : wueste ? 0xc8a878 : 0x4f8a48), Math.min(1, t * 3));
    c.offsetHSL(0, 0, fleck * 0.5);
    return c;
  };
  if ('nosw'.split('').some((k) => S[k].hoch > 0)) {
    const geo = new THREE.PlaneGeometry(TUCH, TUCH, MASCHEN, MASCHEN).rotateX(-HALB), p = geo.attributes.position, uv = geo.attributes.uv;
    const farbe = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + mx, z = p.getZ(i) + mz, lg = L.lage(x, z), h = L.hoehe(x, z, lg);
      p.setY(i, h > 0.05 ? h - 0.4 : -9);                     // im Flachen liegt das Tuch tief unter dem Boden und ist unsichtbar
      uv.setXY(i, x / 8, z / 8);
      let art = 'huegel', hoch = 1, best = 0;
      for (const k of 'nosw') if (lg[k] * S[k].hoch > best) { best = lg[k] * S[k].hoch; art = S[k].fern; hoch = S[k].hoch; }
      farbeAn(art, h, hoch, x, z).toArray(farbe, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
    geo.computeVertexNormals();
    const bild = bilder.koern.clone(); bild.needsUpdate = true;
    const tuch = neu(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: bild, roughness: 0.96 }), mx, 0, mz);
    tuch.receiveShadow = false;
  }
  // Bäume auf bewaldeten Hängen (als flache Bilder – das kostet fast nichts)
  const waldHang = { waldberge: 1, huegel: 0.35, berge: 0.6, alpen: 0.5 };
  for (let i = 0; i < 900 * dicht; i++) {
    const x = mx + (zf() - 0.5) * 2000, z = mz + (zf() - 0.5) * 2000, lg = L.lage(x, z);
    if (lg.weit < FLACH_BIS * 0.8 || lg.weit > 900 || z > meerAb) continue;
    let art = null, hoch = 1, best = 0;
    for (const k of 'nosw') if (lg[k] * S[k].hoch > best) { best = lg[k] * S[k].hoch; art = S[k].fern; hoch = S[k].hoch; }
    const h = L.hoehe(x, z, lg);
    if (!art || !waldHang[art] || zf() > waldHang[art] || h < 0.6 || h > hoch * (art === 'alpen' ? 0.36 : art === 'berge' ? 0.55 : 1)) continue;
    baeume[art === 'alpen' || winter ? 'zypresse' : baumArt === 'palme' ? 'pinie' : baumArt].push([x, h - 0.6, z, x * 3 + z, 1.2 + zf() * 0.9]);
  }

  // ---- 2. Die Nähe: für jede Seite ein Streifen vor dem Zaun ----
  // Verschmelz-Haufen: Wände mit Fenstern, glatte Flächen (Dächer, Felder), alles mit eigener Farbe je Ecke
  const fenster = [], glatt = [], boeden = [];
  const mitFarbe = (geo, hex, hell = 0) => {
    c.setHex(hex); if (hell) c.offsetHSL(0, 0, hell);
    const f = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < f.length; i += 3) c.toArray(f, i);
    geo.setAttribute('color', new THREE.BufferAttribute(f, 3));
    return geo;
  };
  // Ein Haus mit Fenstern: vier Wände (das Fenster-Bild wird passend oft wiederholt) und ein flaches Dach
  const block = (x, z, b, t, h, wand, dach, y = 0) => {
    const geo = new THREE.BoxGeometry(b, h, t), uv = geo.attributes.uv, wu = Math.max(1, Math.round(Math.max(b, t) / 3.4)), wv = Math.max(1, Math.round(h / 3.1));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wu, uv.getY(i) * wv);
    const idx = Array.from(geo.index.array); geo.setIndex(idx.slice(0, 12).concat(idx.slice(24)));       // Deckel und Boden weglassen
    fenster.push(mitFarbe(geo, wand).translate(x, y + h / 2, z));
    glatt.push(mitFarbe(new THREE.PlaneGeometry(b, t).rotateX(-HALB), dach).translate(x, y + h, z));
  };
  // Ein kleines Haus mit Satteldach (quer = der First läuft in z-Richtung)
  const haus = (x, z, quer, y = 0) => {
    const lang = 8 + zf() * 4, tief = 6.5 + zf() * 2, hoch = (zf() < 0.4 ? 3 : 5.6) + zf(), b = quer ? tief : lang, t = quer ? lang : tief;
    block(x, z, b, t, hoch, aus(farben[0]), 0x000000, y);
    glatt.pop();                                                // das flache Dach wieder weg – es kommt ein Satteldach
    const dach = new THREE.CylinderGeometry(1, 1, lang + 0.6, 4, 1).rotateZ(HALB).scale(1, 2.1 + zf() * 0.8, tief / 2 + 0.5);
    if (quer) dach.rotateY(HALB);
    glatt.push(mitFarbe(dach, aus(farben[1])).translate(x, y + hoch, z));
  };
  const flaeche = (x, z, b, t, hex, hell = 0, y = 0.02) => boeden.push(mitFarbe(new THREE.PlaneGeometry(b, t).rotateX(-HALB), hex, hell).translate(x, y, z));
  const baum = (x, z, art = baumArt, y = 0) => baeume[art].push([x, y, z, x * 5 + z, 0.9 + zf() * 0.6]);
  const autos = [], buesche = [], steine = [];

  const bis = FLACH_BIS + 30;
  for (const [k, s] of Object.entries(S)) {
    if (s.meer && !s.nah.length) continue;
    // Der Streifen dieser Seite: u läuft am Zaun entlang, v vom Zaun weg. ort(u, v) macht daraus x und z.
    const quer = k === 'o' || k === 'w', vz = k === 'n' || k === 'w' ? -1 : 1, kante = k === 'n' ? r.z0 : k === 's' ? r.z1 : k === 'o' ? r.x1 : r.x0;
    const u0 = quer ? r.z0 : r.x0 - bis, u1 = quer ? r.z1 : r.x1 + bis;
    const ort = (u, v) => (quer ? [kante + vz * v, u] : [u, kante + vz * v]);
    const teil = (art) => s.nah.includes(art);
    // Mehrere Wörter teilen sich den Streifen: das erste liegt am Zaun, das nächste dahinter
    s.nah.forEach((art, nr) => {
      const v0 = 16 + (bis - 16) * nr / s.nah.length, v1 = 16 + (bis - 16) * (nr + 1) / s.nah.length;
      if (art === 'wald') {
        for (let i = 0, n = (u1 - u0) * (v1 - v0) / 190 * dicht; i < n; i++) { const [x, z] = ort(u0 + zf() * (u1 - u0), v0 + zf() * (v1 - v0)); if (frei(x, z, 2)) baum(x, z, winter ? 'zypresse' : baumArt); }
      } else if (art === 'park') {
        for (let i = 0; i < 9; i++) { const [x, z] = ort(u0 + zf() * (u1 - u0), v0 + zf() * (v1 - v0)), gr = 40 + zf() * 60; flaeche(x, z, quer ? gr * 0.7 : gr * 1.5, quer ? gr * 1.5 : gr * 0.7, winter ? 0xf4f6fa : 0x6aa858, zf() * 0.06 - 0.03, 0.015); }
        for (let i = 0, n = (u1 - u0) * (v1 - v0) / 520 * dicht; i < n; i++) { const [x, z] = ort(u0 + zf() * (u1 - u0), v0 + zf() * (v1 - v0)); if (frei(x, z, 2)) baum(x, z); }
      } else if (art === 'felder') {
        // Flickenteppich aus Äckern und Wiesen, dazwischen Baumreihen und ab und zu ein Hof
        const farbenF = winter ? [0xf4f6fa, 0xe8ecf2, 0xdfe4ea] : wueste ? [0xd8c098, 0xc8ac80, 0xb8a070, 0x9aa868] : [0x6aa852, 0x8ab85a, 0xd8c870, 0xb89a5a, 0x4f8a45, 0xc8d078];
        for (let u = u0; u < u1;) {
          const lu = 50 + zf() * 60;
          for (let v = v0; v < v1;) {
            const lv = 40 + zf() * 50, [x, z] = ort(u + lu / 2, v + lv / 2);
            if (frei(x, z, Math.max(lu, lv) / 2)) {
              flaeche(x, z, (quer ? lv : lu) - 3, (quer ? lu : lv) - 3, aus(farbenF), zf() * 0.06 - 0.03);
              if (zf() < 0.4 * dicht) for (let i = 0; i < 6; i++) { const [bx, bz] = ort(u + 1, v + i * lv / 6 + zf() * 3); if (frei(bx, bz, 1)) baum(bx, bz); }
              if (zf() < 0.13) { haus(x, z, zf() < 0.5); haus(x + 13, z + 9, zf() < 0.5); for (let i = 0; i < 3; i++) baum(x - 9 + zf() * 4, z - 6 + i * 5); }
            }
            v += lv;
          }
          u += lu;
        }
      } else if (art === 'vorort') {
        // Wohnstraßen parallel zum Zaun, an beiden Seiten kleine Häuser mit Garten
        const [gx, gz] = ort((u0 + u1) / 2, (v0 + v1) / 2);
        flaeche(gx, gz, quer ? v1 - v0 : u1 - u0, quer ? u1 - u0 : v1 - v0, winter ? 0xf0f2f6 : wueste ? 0xd8c8a4 : 0x6a9e56, 0, 0.012);
        for (let v = v0 + 26; v < v1 - 10; v += 44) {
          const [sx, sz] = ort((u0 + u1) / 2, v);
          flaeche(sx, sz, quer ? 6 : u1 - u0, quer ? u1 - u0 : 6, 0x6e6e72, 0, 0.03);
          for (let u = u0 + 8; u < u1 - 8; u += 15 + zf() * 4) for (const seite of [-1, 1]) {
            const [x, z] = ort(u, v + seite * 12);
            if (zf() < 0.2 || !frei(x, z, 8)) continue;
            haus(x, z, quer ? zf() < 0.25 : zf() > 0.25);
            if (zf() < 0.55 * dicht) { const [bx, bz] = ort(u + 6, v + seite * 19); if (frei(bx, bz, 2)) baum(bx, bz); }
          }
        }
        for (let u = u0 + 60; u < u1 - 30; u += 120) { const [x, z] = ort(u, (v0 + v1) / 2); flaeche(x, z, quer ? v1 - v0 : 6, quer ? 6 : v1 - v0, 0x6e6e72, 0, 0.03); }      // Querstraßen
      } else if (art === 'stadt') {
        // Häuserblocks mit Straßen dazwischen – nach hinten werden die Häuser höher
        const [gx, gz] = ort((u0 + u1) / 2, (v0 + v1) / 2);
        flaeche(gx, gz, quer ? v1 - v0 : u1 - u0, quer ? u1 - u0 : v1 - v0, winter ? 0xd8dce2 : 0x84848a, 0, 0.012);
        for (let u = u0 + 24; u < u1 - 20; u += 52) for (let v = v0 + 26; v < v1 - 16; v += 50) {
          const [x, z] = ort(u, v);
          if (!frei(x, z, 21)) continue;
          flaeche(x, z, 42, 40, 0xb8b4aa, zf() * 0.04, 0.03);                                         // Gehweg rund um den Block
          const teile = zf() < 0.45 ? 2 : 1, nah = (v - 16) / (bis - 16);
          for (let i = 0; i < teile; i++) {
            const b = teile === 2 ? 17 : 26 + zf() * 10, t = 24 + zf() * 12, h = (g.stil === 'england' ? 8 : 11) + zf() * 12 + nah * zf() * (g.stil === 'england' ? 10 : 34);
            block(x + (teile === 2 ? (i ? 10 : -10) : 0), z, b, t, h, aus(h > 30 ? farben[2] : farben[0]), 0x6a6e76);
          }
          if (zf() < 0.3 * dicht) { const [bx, bz] = ort(u + 25, v); if (frei(bx, bz, 2)) baum(bx, bz); }
        }
      } else if (art === 'parkplatz') {
        // Große Parkplätze wie an amerikanischen Stadien: Reihe an Reihe
        const pu0 = Math.max(u0, (quer ? r.z0 : r.x0) - 60), pu1 = Math.min(u1, (quer ? r.z1 : r.x1) + 60), pv1 = Math.min(v1, v0 + 170);
        const [gx, gz] = ort((pu0 + pu1) / 2, (v0 + 8 + pv1) / 2);
        flaeche(gx, gz, quer ? pv1 - v0 - 8 : pu1 - pu0, quer ? pu1 - pu0 : pv1 - v0 - 8, 0x6a6a70, 0, 0.012);
        for (let v = v0 + 14; v < pv1 - 6; v += 16.5) for (const reihe of [-2.7, 2.7]) for (let u = pu0 + 4; u < pu1 - 4; u += 2.8) {
          if (Math.floor((u - pu0) / 62) !== Math.floor((u - pu0 + 7) / 62)) continue;                  // Fahrgasse quer
          const [x, z] = ort(u, v + reihe);
          if (zf() < 0.36 + 0.5 * (v - v0) / 170 || !frei(x, z, 3) || autos.length > 900 * dicht) continue;
          autos.push([x, z, quer ? HALB : 0, aus(LACK)]);
        }
        for (let u = pu0 + 31; u < pu1; u += 62) for (let v = v0 + 22; v < pv1; v += 33) { const [x, z] = ort(u, v + 8); if (frei(x, z, 2) && zf() < dicht) baum(x, z); }
      } else if (art === 'wueste') {
        for (let i = 0, n = (u1 - u0) * (v1 - v0) / 260 * dicht; i < n; i++) { const [x, z] = ort(u0 + zf() * (u1 - u0), v0 + zf() * (v1 - v0)); if (frei(x, z, 2)) (zf() < 0.72 ? buesche : steine).push([x, z, 0.5 + zf() * 1.3]); }
        for (let i = 0; i < 5 * dicht; i++) { const [x, z] = ort(u0 + zf() * (u1 - u0), v0 + zf() * (v1 - v0)); for (let j = 0; j < 5; j++) { const px = x + (zf() - 0.5) * 22, pz = z + (zf() - 0.5) * 22; if (frei(px, pz, 2)) baum(px, pz, 'palme'); } }
      }
    });
    // ---- 3. Hochhäuser am Horizont ----
    if (s.skyline) {
      const n = Math.round(15 * s.skyline);
      for (let i = 0; i < n; i++) {
        const u = (quer ? mz : mx) + (zf() - 0.5) * 760, v = FLACH_BIS + 60 + zf() * 330, [x, z] = ort(u, v);
        if (z > meerAb - 10) continue;
        const b = 20 + zf() * 16, t = 20 + zf() * 14, h = (50 + zf() * 110) * (0.7 + 0.5 * s.skyline) * (zf() < 0.15 ? 1.5 : 1), y = Math.max(0, L.hoehe(x, z) - 2), f = aus(farben[2]);
        block(x, z, b, t, h, f, 0x5a5e66, y);
        if (zf() < 0.5) block(x, z, b * 0.6, t * 0.6, h * 0.16, f, 0x5a5e66, y + h);                    // ein schmaler Aufsatz obendrauf
      }
    }
  }

  // ---- Alles verschmelzen und hinstellen ----
  const haufen = (liste, material, versatz) => {
    if (!liste.length) return;
    const geo = mergeGeometries(liste);
    for (const f of liste) f.dispose();
    const m = neu(geo, material, 0, 0, 0);
    if (versatz) Object.assign(m.material, { polygonOffset: true, polygonOffsetFactor: versatz, polygonOffsetUnits: versatz * 14 });
    return m;
  };
  const fb = bilder.fenster.clone(); fb.needsUpdate = true;
  haufen(fenster, new THREE.MeshStandardMaterial({ vertexColors: true, map: fb, roughness: 0.85 }));
  haufen(glatt, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  haufen(boeden, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 9);
  // Viele gleiche Dinge: geparkte Autos, Büsche und Felsbrocken in der Wüste
  const menge = (geo, material, liste, setze) => {
    if (!liste.length) { geo.dispose(); material.dispose(); return; }
    const im = new THREE.InstancedMesh(geo, material, liste.length), o = new THREE.Object3D();
    liste.forEach((e, i) => { setze(o, e); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (e[3] !== undefined) im.setColorAt(i, c.setHex(e[3])); });
    im.userData.eigen = true; im.frustumCulled = false; im.receiveShadow = true;
    a.G.add(im);
  };
  menge(mergeGeometries([new THREE.BoxGeometry(1.8, 0.7, 4.3).translate(0, 0.62, 0), new THREE.BoxGeometry(1.6, 0.55, 2.3).translate(0, 1.2, -0.2)]), mat(0xffffff, { rau: 0.45 }), autos, (o, [x, z, dreh]) => { o.position.set(x, 0, z); o.rotation.y = dreh + (x * 7 % 2 > 1 ? Math.PI : 0); });
  menge(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.6, 1), mat(0x7a8a52, { kantig: true }), buesche, (o, [x, z, gr]) => { o.position.set(x, gr * 0.3, z); o.scale.setScalar(gr); o.rotation.y = x; });
  menge(new THREE.DodecahedronGeometry(1, 0).scale(1, 0.55, 0.8), mat(0xa88a68, { kantig: true }), steine, (o, [x, z, gr]) => { o.position.set(x, gr * 0.2, z); o.scale.setScalar(gr * 1.3); o.rotation.y = z; });
}
