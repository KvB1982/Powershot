# Stimmen bauen (Schiedsrichter, Linienrichter, Namen)

Die Stimmen im Ordner `sounds/stimme/` sind mit **3D AI Studio** erzeugt (Werkzeug „Sprache“, eingebaute Stimmen, keine echten Menschen nachgemacht).
So sind sie entstanden – und so macht man neue:

1. **Text schreiben.** Viele kurze Ansagen kommen in EINEN Auftrag, getrennt durch `[long pause]`, zum Beispiel
   `Zverev. [long pause] Sinner. [long pause] Alcaraz.` Das ist viel billiger als ein Auftrag je Wort.
   Höchstens etwa 20 Ansagen je Auftrag. `node namen.mjs namen.json` druckt die Texte für alle Namen.
2. **Erzeugen** mit der Stimme, die schon benutzt wird (sonst klingt der Schiedsrichter plötzlich anders):
   - Schiedsrichter und alle Namen: Stimme **Daniel** (britisch), Stabilität 0,7, Sprache Englisch
   - Linienrichter: **Callum**, **Alice**, **Bill**, Stabilität 0,4, Text `[shouting] Out! [long pause] [shouting] Fault! …`
3. **Herunterladen** als `u1.mp3 … u4.mp3` (Ansagen), `l1.mp3 … l3.mp3` (Linienrichter), `n01.mp3 … n12.mp3` (Namen) in einen Ordner.
   (Die Roh-Dateien liegen nicht im Repository, sondern in den Projektdateien unter `stimmen/roh/`.)
4. **Zerschneiden:** `python3 bauen.py <Ordner mit den Roh-Dateien> ../../sounds/stimme`
   Das Programm sucht die langen Pausen, schneidet an ihnen, macht alle Stücke gleich laut und speichert kleine MP3-Dateien
   (Mono, 24 kHz). Es bricht ab, wenn die Zahl der Stücke nicht zur Liste passt. Braucht `ffmpeg` und `numpy`.
   `python3 schnitt.py datei.mp3` zeigt nur, wie viele Stücke es findet und wie lang sie sind.
5. **Eintragen** in `js/stimme.js` (`ANSAGEN` oder `NAMEN`) und prüfen: `node tools/stimme.mjs`.
6. **Anhören:** `http://localhost:8765/tools/stimmen.html`

Welche Ansage in welcher Roh-Datei an welcher Stelle steht, steht oben in `bauen.py` (`U1` … `U4`).
