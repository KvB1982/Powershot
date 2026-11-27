# Woher die Geräusche kommen

Alle Aufnahmen in diesem Ordner sind **frei**: Sie stehen unter der Lizenz [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de)
(„kein Urheberrecht vorbehalten“). Man darf sie benutzen, verändern und weitergeben – auch in einer App –, ohne zu fragen und ohne den Namen zu nennen.
Wir nennen die Leute trotzdem, weil sie sich die Mühe gemacht haben. Danke!

- Gesucht bei [Freesound](https://freesound.org) (Suchfilter „Creative Commons 0“) und bei [Kenney](https://kenney.nl/assets) (alle Pakete CC0).
- Stand: 21.11.2026. Bei jeder Freesound-Aufnahme wurde die Lizenz auf der Seite der Aufnahme nachgesehen.
- Für das Spiel wurde jede Aufnahme zugeschnitten (nur die Stelle, die gebraucht wird), auf ähnliche Lautstärke gebracht und als MP3 gespeichert.
- Anhören: `python tools/server.py`, dann http://localhost:8765/tools/sounds.html · Prüfen: `node tools/sounds.mjs`
- Von Freesound wurde die MP3-Fassung zum Vorhören geladen (gleiche Aufnahme, gleiche Lizenz). Applaus und Stadion kommen seit 27.11.2026
  nicht mehr von Freesound (siehe unten, „Publikum je Spielsituation“).
- Die genaue Liste (welche Datei aus welcher Stelle welcher Aufnahme) steht in `quellen.json`.

**Nicht nehmen** für neue Geräusche: Pixabay, Mixkit, Zapsplat und ähnliche Seiten. Dort ist das Benutzen im Spiel erlaubt, aber nicht das Weitergeben der Dateien –
und dieses Repository ist öffentlich. Bei Freesound nur „Creative Commons 0“ nehmen (nicht „Attribution“ oder „Noncommercial“).

| Aufnahme | von | daraus gemacht |
|---|---|---|
| [sneaker squeak rubber.wav](https://freesound.org/people/shakaharu/sounds/88502/) | shakaharu | `match/quietschen_1.mp3`, `match/quietschen_2.mp3`, `match/quietschen_3.mp3`, `match/quietschen_4.mp3` |
| [Footdrags Dirt.wav](https://freesound.org/people/worthahep88/sounds/319209/) | worthahep88 | `match/rutschen_1.mp3`, `match/rutschen_2.mp3` |
| [Crowd Cheer](https://freesound.org/people/FoolBoyMedia/sounds/397434/) | FoolBoyMedia | `publikum/jubel.mp3` |
| [Crowd Ooohs and Ahhhs in Excitement](https://freesound.org/people/noah0189/sounds/264499/) | noah0189 | `publikum/raunen_1.mp3`, `publikum/raunen_2.mp3`, `publikum/raunen_3.mp3` |
| [small crowd gasp shock surprise](https://freesound.org/people/HowardV/sounds/264376/) | HowardV | `publikum/schreck_1.mp3` |
| [gasps small crowd.wav](https://freesound.org/people/dreamstobecome/sounds/439258/) | dreamstobecome | `publikum/schreck_2.mp3`, `publikum/schreck_3.mp3` |
| [Generic Exterior Walla](https://freesound.org/people/brunoboselli/sounds/634880/) | brunoboselli | `gelaende/stimmen.mp3` |
| [Park ambience.wav](https://freesound.org/people/Marissrar/sounds/366913/) | Marissrar | `gelaende/park.mp3` |
| [concrete_11c_sneakers_run.wav](https://freesound.org/people/sturmankin/sounds/272300/) | sturmankin | `gelaende/schritt_1.mp3`, `gelaende/schritt_2.mp3`, `gelaende/schritt_3.mp3`, `gelaende/schritt_4.mp3`, `gelaende/schritt_5.mp3`, `gelaende/schritt_6.mp3` |
| [car door close.wav](https://freesound.org/people/monotraum/sounds/208695/) | monotraum | `gelaende/autotuer.mp3` |
| [Car by slow DonFX.wav](https://freesound.org/people/Donmann/sounds/237337/) | Donmann | `gelaende/auto.mp3` |
| [Camera Shutter](https://freesound.org/people/roachpowder/sounds/170229/) | roachpowder | `gelaende/kamera.mp3` |
| [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney (kenney.nl) | `menue/klick.mp3`, `menue/zurueck.mp3`, `menue/tipp.mp3`, `menue/richtig.mp3`, `menue/falsch.mp3`, `menue/schalter.mp3`, `menue/plopp.mp3`, `menue/stern.mp3`, `menue/frage.mp3` |
| [Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney (kenney.nl) | `menue/geschafft.mp3`, `menue/sieg.mp3` |
| [Cash Register Purchase](https://freesound.org/people/Zott820/sounds/209578/) | Zott820 | `menue/kasse.mp3` |
| [PEN SIGNATURE SIGNING 2.wav](https://freesound.org/people/ListenTonyBoy/sounds/326961/) | ListenTonyBoy | `menue/stift.mp3` |

## Was noch erzeugt wird

- Wählt man in den Einstellungen „Deutsch (Stimme des Geräts)“, spricht der Schiedsrichter mit der Sprachausgabe des Geräts.
- Fehlt eine Datei oder lädt sie noch, erzeugt `js/audio.js` ein einfaches Ersatz-Geräusch im Browser.

## Publikum je Spielsituation (Dateien `publikum/ki_…`)

21 Aufnahmen (zusammen 0,85 MB), am 27.11.2026 mit **3D AI Studio** erzeugt (Geräusch-Werkzeug; laut Anbieter für eigene Projekte nutzbar,
auch gewerblich). Das sind keine fremden Aufnahmen und deshalb nicht CC0 – sie gehören zum Spiel. Erkennbar am Dateinamen `ki_…`.
Arten: Applaus von wenigen, begeisterter Applaus, Ovation, Empfang, Stöhnen, Staunen, Gemurmel, „Schhh“, Klatschen im Takt.
Die Beschreibung, mit der jede Art erzeugt wurde, steht in `quellen.json` (Feld `titel`). Zugeschnitten mit `tools/publikum_bau.py`,
die Roh-Dateien liegen in den Projektdateien unter `publikum/roh/`.

Am selben Tag sind auch die alten Applaus-Aufnahmen und die Stadion-Schleife ersetzt worden (`ki_klein_…`, `ki_mittel_…`, `ki_gross_…`,
`ki_stadion.mp3`): Die alten waren Mitschnitte echter Tennis-Matches von Freesound, und darin sprach im Hintergrund ein echter
Schiedsrichter irgendeinen Spielstand. Roh-Dateien: `publikum/roh2/`. Die Stadion-Schleife ist eine eigens erzeugte Schleife von 20 s
(`schlag/roh2/stadion.wav`), mit `tools/stadion_bau.py` gleichmäßiger und lauter gemacht.

## Schläge: echte Aufnahmen, Aufprall und Netz erzeugt

Die erzeugten Schlag-Geräusche vom 27.11.2026 klangen nicht nach Tennis (Kristian: „haben absolut gar nichts mit echten
Tennisschlag-Geräuschen zu tun“). Deshalb sind Schlag, Slice und Aufschlag jetzt wieder **echte Aufnahmen von Freesound (CC0)**,
die Kristian auf `tools/schlag_probe.html` selbst angehört und ausgesucht hat:

| Dateien | Aufnahme | Von | Lizenz |
|---|---|---|---|
| `match/vorhand_1…6.mp3` | [Tennis Forehand 2](https://freesound.org/people/jamesdrake89/sounds/662263/) | jamesdrake89 | CC0 1.0 |
| `match/schnitt_1…4.mp3` | [Tennis Slices 2](https://freesound.org/people/jamesdrake89/sounds/662269/) | jamesdrake89 | CC0 1.0 |
| `match/einzel_1.mp3` | [SFXTennis-EXT_Hitting a tennis ball](https://freesound.org/people/rvdw2004/sounds/709678/) | rvdw2004 | CC0 1.0 |

Aufprall und Netz (9 Dateien `match/ki_…`) sind weiter mit 3D AI Studio erzeugt (`tools/schlag_bau.py`, Roh-Dateien in den
Projektdateien unter `schlag/roh/` und `schlag/roh2/`). Quietschen und Rutschen der Schuhe sind von Freesound.

## Stimmen (Ordner `stimme/`)

Die Stimmen von Schiedsrichter und Linienrichtern sind **keine** Aufnahmen von Menschen und nicht von Freesound:
Sie sind am 27.11.2026 mit **3D AI Studio** erzeugt (Sprach-Werkzeug mit eingebauten Stimmen; laut Anbieter für eigene Projekte nutzbar).
Es wird kein echter Schiedsrichter nachgemacht.

| Ordner | Was | Stimme | Dateien |
|---|---|---|---|
| `stimme/en/` | Ansagen des Schiedsrichters auf Englisch (Punktestand, Deuce, Advantage, Game, Set, Match, Fault, Time, Play …) | „Daniel“ | 65 |
| `stimme/linie/` | Linienrichter: „Out!“ und „Fault!“ | „Callum“, „Alice“, „Bill“ | 12 |
| `stimme/namen/` | Nachnamen der 200 Profis und der 40 Nachwuchs-Nachnamen | „Daniel“ | 238 |

Zusammen etwa 1,2 MB. Wie sie gebaut werden: `tools/stimme_bau/LIESMICH.md`. Was wann gesagt wird: `js/stimme.js`. Prüfen: `node tools/stimme.mjs`. Anhören: `tools/stimmen.html`.
