// Lautsprecher-Klang für den Schiedsrichter (ohne three.js).
//
// In echt spricht der Schiedsrichter in ein Mikrofon, und seine Stimme kommt aus den Lautsprechern des Stadions.
// Das klingt anders als jemand, der neben dir steht:
//   1. Es fehlen die ganz tiefen und die ganz hohen Töne (Lautsprecher im Stadion sind dafür nicht gebaut).
//   2. Die Stimme klingt etwas „nasal“ und ein kleines bisschen kratzig.
//   3. Man hört sie mehrmals: erst aus dem nahen Lautsprecher, dann leiser aus denen weiter weg (Echo),
//      und zum Schluss hallt sie in den Tribünen nach.
// Genau diese drei Dinge baut diese Datei aus fertigen Bausteinen des Browsers (WebAudio) zusammen.
// Die Aufnahmen selbst bleiben, wie sie sind – der Klang wird erst beim Abspielen gemacht.
//
// Die Linienrichter rufen ohne Mikrofon. Sie gehen NICHT durch den Lautsprecher.

// Zahlen zum Einstellen
const TIEF_WEG = 300;        // alles unter so vielen Hertz wird leiser (kein Brummen)
const HOCH_WEG = 3800;       // alles über so vielen Hertz wird leiser (kein Zischen)
const NASE = 1800;           // dieser Ton wird betont – das macht den „Durchsage“-Klang
const NASE_DB = 5;           // … um so viele Dezibel
const KRATZEN = 1.6;         // wie stark die Stimme leicht übersteuert (1 = gar nicht, 3 = wie ein Megafon)
const LAUT = 0.8;             // Lautstärke hinter dem Kratzen (das Kratzen macht lauter, das hier gleicht es aus)
const ECHO_1 = 0.11;         // nach so vielen Sekunden kommt die Stimme aus dem zweiten Lautsprecher
const ECHO_2 = 0.27;         // … und aus dem ganz hinten
const HALL_ZEIT = 1.6;       // so viele Sekunden klingt der Nachhall aus

// Wie stark Echo und Hall je nach Ort sind: [erstes Echo, zweites Echo, Hall]
const ORT = {
  klein: [0.10, 0.03, 0.08],     // kleiner Platz: nur ein Lautsprecher am Stuhl
  gross: [0.30, 0.16, 0.22],     // volles Stadion
  halle: [0.16, 0.08, 0.42]      // Halle: wenig Echo, dafür viel Hall unter dem Dach
};

// Baut den Nachhall selbst: Rauschen, das langsam leiser und dumpfer wird (dafür braucht man keine Datei)
function hallSpur(ctx) {
  const n = Math.floor(ctx.sampleRate * HALL_ZEIT);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let k = 0; k < 2; k++) {
    const d = buf.getChannelData(k);
    let alt = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const roh = (Math.random() * 2 - 1) * Math.pow(1 - t, 3);
      const dumpf = 0.25 + 0.6 * t;                 // je später, desto dumpfer
      alt = alt * dumpf + roh * (1 - dumpf);
      d[i] = i < ctx.sampleRate * 0.03 ? 0 : alt;   // die ersten 30 Millisekunden bleiben leer (der Hall kommt nach der Stimme)
    }
  }
  return buf;
}

// Die Kurve für das leichte Kratzen: leise Töne bleiben, laute werden oben weich abgeschnitten
function kratzKurve() {
  const kurve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = i / 511.5 - 1;
    kurve[i] = Math.tanh(x * KRATZEN) / Math.tanh(KRATZEN);
  }
  return kurve;
}

// Baut den Lautsprecher. ctx = der Ton-Baukasten des Browsers, ziel = wohin der fertige Klang geht.
// Zurück kommt { eingang, ort(gross, halle) }: An „eingang“ schließt man die Stimme an.
export function baueLautsprecher(ctx, ziel) {
  const eingang = ctx.createGain();
  const tief = ctx.createBiquadFilter(); tief.type = 'highpass'; tief.frequency.value = TIEF_WEG; tief.Q.value = 0.7;
  const hoch = ctx.createBiquadFilter(); hoch.type = 'lowpass'; hoch.frequency.value = HOCH_WEG; hoch.Q.value = 0.7;
  const nase = ctx.createBiquadFilter(); nase.type = 'peaking'; nase.frequency.value = NASE; nase.Q.value = 1; nase.gain.value = NASE_DB;
  const kratz = ctx.createWaveShaper(); kratz.curve = kratzKurve();
  const laut = ctx.createGain(); laut.gain.value = LAUT;
  eingang.connect(tief).connect(hoch).connect(nase).connect(kratz).connect(laut);
  laut.connect(ziel);                                          // der nahe Lautsprecher

  // Zwei Echos: dieselbe Stimme noch einmal, später, leiser und dumpfer
  const echo = (zeit, dumpfAb) => {
    const d = ctx.createDelay(1); d.delayTime.value = zeit;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = dumpfAb;
    const g = ctx.createGain(); g.gain.value = 0;
    laut.connect(d).connect(f).connect(g).connect(ziel);
    return g;
  };
  const e1 = echo(ECHO_1, 2600), e2 = echo(ECHO_2, 1800);

  // Der Nachhall
  const hall = ctx.createConvolver(); hall.buffer = hallSpur(ctx);
  const hallLaut = ctx.createGain(); hallLaut.gain.value = 0;
  laut.connect(hall).connect(hallLaut).connect(ziel);

  // Stellt ein, wo wir sind: gross = wie groß und voll das Stadion ist (0 … 1), halle = true unter einem Dach
  function ort(gross = 1, halle = false) {
    const k = Math.min(1, Math.max(0, gross));
    const a = ORT.klein, b = halle ? ORT.halle : ORT.gross;
    const mix = (i) => a[i] + (b[i] - a[i]) * (halle ? 0.5 + 0.5 * k : k);
    e1.gain.value = mix(0); e2.gain.value = mix(1); hallLaut.gain.value = mix(2);
  }
  ort(1, false);
  return { eingang, ort };
}

// Jede Aufnahme hat vorn und hinten ein Stück Stille (zusammen etwa 0,2 Sekunden). Spielt man zwei Aufnahmen
// hintereinander, entsteht daraus eine unnatürlich lange Pause („Advantage … … Sinner“).
// Diese Funktion sucht, wo wirklich gesprochen wird: { ab, lang } in Sekunden. Abgespielt wird dann nur dieses Stück.
const LEISE = 0.02;          // alles darunter gilt als Stille
const RAND = 0.012;          // so viel Stille bleibt vorn und hinten stehen, damit nichts abgehackt klingt
export function sprechTeil(buffer) {
  const d = buffer.getChannelData(0), sr = buffer.sampleRate;
  let a = 0, b = d.length - 1;
  while (a < b && Math.abs(d[a]) < LEISE) a++;
  while (b > a && Math.abs(d[b]) < LEISE) b--;
  const ab = Math.max(0, a / sr - RAND);
  const bis = Math.min(buffer.duration, b / sr + RAND * 3);       // hinten etwas mehr: Stimmen klingen leise aus
  return { ab, lang: Math.max(0.05, bis - ab) };
}
