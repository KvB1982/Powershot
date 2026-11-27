# Woher die Geräusche kommen

Alle Aufnahmen in diesem Ordner sind **frei**: Sie stehen unter der Lizenz [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.de)
(„kein Urheberrecht vorbehalten“). Man darf sie benutzen, verändern und weitergeben – auch in einer App –, ohne zu fragen und ohne den Namen zu nennen.
Wir nennen die Leute trotzdem, weil sie sich die Mühe gemacht haben. Danke!

- Gesucht bei [Freesound](https://freesound.org) (Suchfilter „Creative Commons 0“) und bei [Kenney](https://kenney.nl/assets) (alle Pakete CC0).
- Stand: 21.11.2026. Bei jeder Freesound-Aufnahme wurde die Lizenz auf der Seite der Aufnahme nachgesehen.
- Für das Spiel wurde jede Aufnahme zugeschnitten (nur die Stelle, die gebraucht wird), auf ähnliche Lautstärke gebracht und als MP3 gespeichert.
- Anhören: `python tools/server.py`, dann http://localhost:8765/tools/sounds.html · Prüfen: `node tools/sounds.mjs`
- Von Freesound wurde die MP3-Fassung zum Vorhören geladen (gleiche Aufnahme, gleiche Lizenz). Applaus und Stadion stammen aus den beiden
  Aufnahmen, die schon vorher im Spiel waren (damals über Pixabay geladen, Konto „freesound_community“); dass es die hier genannten
  Freesound-Aufnahmen sind, wurde an Titel und Länge erkannt (298 s und 105 s).
- Die genaue Liste (welche Datei aus welcher Stelle welcher Aufnahme) steht in `quellen.json`.

**Nicht nehmen** für neue Geräusche: Pixabay, Mixkit, Zapsplat und ähnliche Seiten. Dort ist das Benutzen im Spiel erlaubt, aber nicht das Weitergeben der Dateien –
und dieses Repository ist öffentlich. Bei Freesound nur „Creative Commons 0“ nehmen (nicht „Attribution“ oder „Noncommercial“).

| Aufnahme | von | daraus gemacht |
|---|---|---|
| [Tennis Ball being hit](https://freesound.org/people/jacklilley/sounds/338122/) | jacklilley | `match/schlag_1.mp3`, `match/schlag_2.mp3`, `match/schlag_3.mp3` |
| [Tennis hit.WAV](https://freesound.org/people/14FPanskaBubik_Lukas/sounds/418547/) | 14FPanskaBubik_Lukas | `match/schlag_4.mp3` |
| [Tennis-Ball-Hit](https://freesound.org/people/kletton97/sounds/710041/) | kletton97 | `match/schlag_5.mp3` |
| [Tennis Slices 4](https://freesound.org/people/jamesdrake89/sounds/662268/) | jamesdrake89 | `match/slice_1.mp3`, `match/slice_2.mp3`, `match/slice_3.mp3` |
| [Tennis Serves 3](https://freesound.org/people/jamesdrake89/sounds/662266/) | jamesdrake89 | `match/aufschlag_1.mp3`, `match/aufschlag_2.mp3` |
| [tennis_serves.wav](https://freesound.org/people/itsadrizzit/sounds/439340/) | itsadrizzit | `match/aufschlag_3.mp3`, `match/aufschlag_4.mp3` |
| [TennisBallBounce.wav](https://freesound.org/people/drivr3joe/sounds/533410/) | drivr3joe | `match/aufprall_1.mp3`, `match/aufprall_2.mp3`, `match/aufprall_3.mp3` |
| [Sports Tennis Ball Bouncing](https://freesound.org/people/amsaenz03/sounds/788264/) | amsaenz03 | `match/aufprall_4.mp3`, `match/aufprall_5.mp3` |
| [Net Impact Tennis Ball Smacks Bounces](https://freesound.org/people/amsaenz03/sounds/788265/) | amsaenz03 | `match/netz_1.mp3`, `match/netz_2.mp3`, `match/netz_3.mp3` |
| [sneaker squeak rubber.wav](https://freesound.org/people/shakaharu/sounds/88502/) | shakaharu | `match/quietschen_1.mp3`, `match/quietschen_2.mp3`, `match/quietschen_3.mp3`, `match/quietschen_4.mp3` |
| [Footdrags Dirt.wav](https://freesound.org/people/worthahep88/sounds/319209/) | worthahep88 | `match/rutschen_1.mp3`, `match/rutschen_2.mp3` |
| [tennis match.wav](https://freesound.org/people/huubjeroen/sounds/114052/) | huubjeroen | `publikum/applaus_gross_1.mp3`, `publikum/applaus_gross_2.mp3`, `publikum/applaus_mittel_1.mp3`, `publikum/applaus_klein_1.mp3`, `publikum/applaus_klein_2.mp3`, `publikum/applaus_klein_3.mp3`, `publikum/stadion.mp3` |
| [43 Tennis.flac](https://freesound.org/people/D.jones/sounds/527843/) | D.jones | `publikum/applaus_mittel_2.mp3` |
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
