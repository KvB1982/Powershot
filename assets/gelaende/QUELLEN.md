# Woher die Modelle und Bilder in diesem Ordner kommen

Die meisten Dateien hier sind mit 3D AI Studio erzeugt. Die folgenden kommen von **Poly Haven**
(https://polyhaven.com), einer Sammlung freier 3D-Sachen. Lizenz: **CC0** – das heißt, jeder darf sie
für alles benutzen, auch in einem öffentlichen Repository und in einer App, und muss niemanden nennen.
(Lizenztext: https://creativecommons.org/publicdomain/zero/1.0/ · Erklärung von Poly Haven: https://polyhaven.com/license)

Wir nennen die Quelle trotzdem – das ist fair, und so findet man die Vorlage wieder. Heruntergeladen am 21.11.2026.

| Datei hier | Vorlage bei Poly Haven | Was wir geändert haben |
|---|---|---|
| `boden_gras.jpg` | Textur „grass_ground“ – https://polyhaven.com/a/grass_ground | nur das Farbbild, grau und hell gemacht (die Farbe gibt das Spiel dazu), 512 × 512 |
| `boden_pflaster.jpg` | Textur „concrete_pavement_02“ – https://polyhaven.com/a/concrete_pavement_02 | wie oben |
| `boden_asphalt.jpg` | Textur „asphalt_04“ – https://polyhaven.com/a/asphalt_04 | wie oben |
| `boden_kopfstein.jpg` | Textur „cobblestone_floor_08“ – https://polyhaven.com/a/cobblestone_floor_08 | wie oben |
| `pflanzkuebel.glb` | Modell „potted_plant_04“ – https://polyhaven.com/a/potted_plant_04 | 8.929 → 2.195 Dreiecke, nur Farbbild 512 |
| `laterne_alt.glb` | Modell „street_lamp_01“ – https://polyhaven.com/a/street_lamp_01 | 30.610 → 1.799 Dreiecke, drei Materialien zu einem zusammengefasst |
| `bistro.glb` | Modell „outdoor_table_chair_set_01“ – https://polyhaven.com/a/outdoor_table_chair_set_01 | 9.828 → 4.969 Dreiecke, zwei Materialien zu einem |
| `picknicktisch.glb` | Modell „wooden_picnic_table“ – https://polyhaven.com/a/wooden_picnic_table | 10.210 → 1.599 Dreiecke, zwei Materialien zu einem |
| `muelltonne.glb` | Modell „metal_trash_can“ (nur die saubere Tonne) – https://polyhaven.com/a/metal_trash_can | 6.428 → 1.200 Dreiecke |
| `plastikstuhl.glb` | Modell „plastic_monobloc_chair_01“ – https://polyhaven.com/a/plastic_monobloc_chair_01 | 3.356 → 1.200 Dreiecke |

Zusammen etwa 1,1 MB. Auf keinem dieser Modelle ist ein Logo oder eine Marke.

## Neue freie Modelle dazunehmen

1. Nur Sachen mit Lizenz **CC0** oder **CC-BY** nehmen (bei CC-BY muss der Name des Erstellers im Spiel stehen). Nichts mit „NC“ (nicht kommerziell) oder „Editorial“.
2. Verkleinern mit `tools/modell_klein.mjs` (steht oben in der Datei, wie es geht). Richtwert: 1.000 bis 5.000 Dreiecke, ein Netz, ein Material, nur das Farbbild.
3. Datei hier ablegen, in `js/gelaendemodelle.js` bei `MODELLE` die Größe eintragen und in diese Tabelle schreiben, woher sie kommt.
