# Menschen aus MakeHuman für Powershot

Abgeschaut beim Schwester-Spiel Police Quest (`tools/figur/mensch.py` dort): Körper, Haut, Haare und Kleidung kommen aus
MakeHuman / MPFB. Alles davon ist CC0 (frei, auch zum Weitergeben) – nur Pakete nehmen, bei denen „cc0“ im Namen steht.

## Einmal einrichten

```bash
pip install bpy                                   # Blender als Python-Modul (ohne Fenster)
git clone --depth 1 https://github.com/makehumancommunity/mpfb2.git
mkdir -p ~/.config/blender/5.3/extensions/user_default
cp -r mpfb2/src/mpfb ~/.config/blender/5.3/extensions/user_default/mpfb
```

Dazu die Pakete von `https://files2.makehumancommunity.org/asset_packs/<paket>/<paket>_cc0.zip`
(zuerst `makehuman_system_assets`, dann `shirts01`, `pants01`, `hats01`; die Adresse `files.…` ohne die 2 geht aus dem Test-Rechner nicht)
in den Daten-Ordner auspacken: `~/.config/blender/5.3/extensions/.user/user_default/mpfb/data`.
Ohne die Pakete entsteht nur ein nackter, einfarbiger Körper ohne Augen.

## Einen Menschen bauen

```bash
python3 tools/mensch/mensch.py assets/mensch_a.glb '{"gender":1,"age":0.5,"weight":0.45,"muscle":0.65,"haut":"…","haare":"…","hemd":"…","hose":"…","schuhe":"…"}'
```

Die sechs Spieler baut `tools/mensch/bau.sh` (alle) oder `tools/mensch/bau.sh a b` (einzelne) aus den Rezepten in `rezepte.sh`.
Das Spiel nimmt für jeden Buchstaben in `MENSCHEN` (`js/figur.js`) den Menschen statt `assets/spieler_a.glb`; mit `?altefiguren` in der Adresse
kommen zum Vergleich die alten Modelle.

Ansehen: `http://localhost:8765/tools/mensch/schau.html` (Knöpfe für Figur, Bewegung und Blick, mit der Maus drehen).
Neue Figuren immer dort von allen Seiten und in Bewegung ansehen (bereit, Aufschlag, laufen), bevor sie ins Spiel kommen.

Was man im Rezept noch angeben kann: `schnitt` (ein Teil abschneiden: `{"hose":{"unter":0.6}}` = kurze Hose, `{"hemd":{"aussen":0.185}}` = ohne Ärmel),
`saum` (so hoch hängt der Hemd-Saum; das Hemd wird darüber gelegt, die Hose darunter weggeschnitten), `baender` (`stirn`, `handgelenke`),
`extra` (Kappe …), `glatt` (Aufdruck eines Teils entfernen).

Was das Skript anders macht als das von Police Quest:

1. Es biegt die Figur in die T-Pose von Powershot (`REST` und `HAND` aus `js/figur.js`). Deshalb passen alle Bewegungen
   aus `js/avatar.js` (Schläge, Griff um den Schläger, Laufen aus `assets/gang.json` und `assets/lauf.json`) ohne Änderung.
2. Es rechnet die sauberen Gewichte von MakeHuman auf die 27 Knochen von Powershot um und speichert sie mit in der Datei.
3. Es macht aus allen Teilen eine Form mit einem Bild. Jedes Teil hat sein festes Feld im Bild (`FELDER`):
   daran erkennt das Spiel Haut, Hemd, Hose, Haare und Schuhe und färbt sie je Spieler um.
