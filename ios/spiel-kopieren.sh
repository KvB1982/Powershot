#!/bin/sh
# Powershot – kopiert das Spiel (HTML, CSS, JavaScript, Modelle, Sounds) in die App.
# Xcode ruft dieses Skript bei jedem Bauen auf. So steckt immer der aktuelle Stand des Spiels in der App.
# Die gekauften Bewegungsaufnahmen (mocap/) werden absichtlich NICHT mitkopiert.
set -e
SPIEL="$SRCROOT/.."
ZIEL="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/web"
rm -rf "$ZIEL"
mkdir -p "$ZIEL/vendor"
cp "$SPIEL/index.html" "$ZIEL/"
for ORDNER in css js assets sounds icons; do
  rsync -a --exclude '.DS_Store' "$SPIEL/$ORDNER" "$ZIEL/"
done
rsync -a --exclude '.DS_Store' "$SRCROOT/vendor/three" "$ZIEL/vendor/"
