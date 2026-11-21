#!/bin/bash
# Baut die Menschen für Powershot neu:   tools/mensch/bau.sh          (alle)
#                                        tools/mensch/bau.sh a b      (nur diese)
#                                        tools/mensch/bau.sh kind richter   (die Vorlagen für die Statisten, siehe statist.mjs)
# Braucht: bpy + MPFB + die CC0-Pakete von MakeHuman (siehe LIESMICH.md) und npx (für das Verkleinern der Bilder).
cd "$(dirname "$0")/../.." || exit 1
source tools/mensch/rezepte.sh
TMP=${TMPDIR:-/tmp}/powershot-menschen; mkdir -p "$TMP"
for k in ${@:-a b c d e f}; do
  K=${k^^}; echo "== Mensch $k"
  python3 tools/mensch/mensch.py "$TMP/$k.glb" "${!K}" 2>&1 | grep -E "FEHLT|Maße|Error|Traceback|File |line "
  # Bild als WebP speichern: macht die Datei etwa halb so groß
  case $k in ?) ZIEL="assets/mensch_$k.glb";; *) ZIEL="tools/mensch/statisten/$k.glb";; esac      # ein Buchstabe = Spieler, ein Wort = Statist
  npx --yes @gltf-transform/cli webp "$TMP/$k.glb" "$ZIEL" --quality 85 2>&1 | grep info
done
