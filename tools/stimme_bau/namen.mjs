// Baut die Liste der Namen-Aufnahmen: Kürzel → wie der Name gesprochen wird
import { PLAYERS } from '../../js/data.js';
import { NACHWUCHS } from '../../js/kleinetour.js';
import fs from 'fs';
import { nameKuerzel as kuerzel } from '../../js/stimme.js';
// Besondere Schreibweise fürs Sprechen (voller Nachname, Akzente helfen der Stimme)
const SPRICH = { davidovich: 'Davidovich Fokina', sanchez: 'Sánchez Izquierdo', mpetshi: 'Mpetshi Perricard', pinnington: 'Pinnington Jones', gueymard: 'Gueymard Wayenburg',
  lehecka: 'Lehečka', mensik: 'Menšík', machac: 'Macháč', marozsan: 'Marozsán', kecmanovic: 'Kecmanović', carrenobusta: 'Carreño Busta', medjedovic: 'Medjedović',
  kovacevic: 'Kovačević', dzumhur: 'Džumhur', prizmic: 'Prižmić', cilic: 'Čilić', svrcina: 'Svrčina', mejia: 'Mejía', comesana: 'Comesaña', vukic: 'Vukić', moller: 'Møller',
  kumstat: 'Kumstát', schwaerzler: 'Schwärzler', baez: 'Báez', tomic: 'Tomić', pavlovic: 'Pavlović', lajovic: 'Lajović', kopriva: 'Kopřiva', molcan: 'Molčan', jodar: 'Jódar',
  merida: 'Mérida', diazacosta: 'Díaz Acosta', cerundolo: 'Cerúndolo', alcalagurri: 'Alcalá Gurri', martinez: 'Martínez', deminaur: 'de Minaur', ugocarabelli: 'Ugo Carabelli',
  jordasanchis: 'Jordà Sanchis', reisdasilva: 'Reis da Silva', oconnell: "O'Connell", augeraliassime: 'Auger-Aliassime', cina: 'Cinà', djere: 'Djere', llamasruiz: 'Llamas Ruiz' };
const liste = new Map();
for (const p of PLAYERS) { const k = kuerzel(p.short); if (!liste.has(k)) liste.set(k, SPRICH[k] || p.short.replace(/^([A-Z]\. )+/, '')); }
for (const p of NACHWUCHS) { const last = p.name.split(' ').slice(1).join(' '); const k = kuerzel(last); if (!liste.has(k)) liste.set(k, last); }
const arr = [...liste];
fs.writeFileSync(process.argv[2], JSON.stringify(arr));
const N = 20;
for (let i = 0; i < arr.length; i += N) console.log(`#${String(i / N + 1).padStart(2, '0')} ` + arr.slice(i, i + N).map((e) => e[1] + '.').join(' [long pause] '));
console.error(arr.length);
