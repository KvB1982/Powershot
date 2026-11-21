# Die Rezepte der sechs Spieler (a–f). Jede Zeile ist eine Beschreibung für tools/mensch/mensch.py.
# Alle Zutaten sind CC0-Teile aus den MakeHuman-Paketen (siehe assets/QUELLEN_MENSCHEN.md). Keiner ist einem echten Spieler nachgebaut.
# G = was alle gemeinsam haben: Augenbrauen, lange Hose (wird unten bei 60 cm zur kurzen abgeschnitten), Schuhe, Hemd-Saum auf 89,5 cm.
G='"brauen":"eyebrow001","hose":"cortu_cargo_pants","schuhe":"shoes05","saum":0.895'
A='{"gender":1,"age":0.45,"weight":0.45,"muscle":0.65,"haut":"young_caucasian_male","haare":"short02","augenfarbe":"brown","hemd":"elvs_crude_t-shirt_male","schnitt":{"hose":{"unter":0.60}},'"$G"'}'
B='{"gender":1,"age":0.5,"weight":0.4,"muscle":0.6,"haut":"young_caucasian_male2","haare":"short04","augenfarbe":"blue","hemd":"namuhekam_male_polo_shirt","baender":["stirn"],"schnitt":{"hose":{"unter":0.60}},'"$G"'}'
C='{"gender":1,"age":0.45,"weight":0.5,"muscle":0.85,"race":{"asian":0.0,"caucasian":0.45,"african":0.55},"haut":"young_african_male","haare":"afro01","augenfarbe":"brown","hemd":"elvs_crude_t-shirt_male","schnitt":{"hose":{"unter":0.60},"hemd":{"aussen":0.185}},'"$G"'}'
D='{"gender":1,"age":0.55,"weight":0.55,"muscle":0.8,"race":{"asian":0.15,"caucasian":0.5,"african":0.35},"haut":"young_caucasian_male","haare":"short04","augenfarbe":"brown","hemd":"elvs_crude_t-shirt_male","baender":["handgelenke"],"schnitt":{"hose":{"unter":0.60}},'"$G"'}'
E='{"gender":1,"age":0.42,"weight":0.4,"muscle":0.6,"haut":"young_caucasian_male","haare":"short01","augenfarbe":"grey","hemd":"namuhekam_male_polo_shirt","extra":["toigo_maga_hat"],"glatt":["extra"],"schnitt":{"hose":{"unter":0.60}},'"$G"'}'
F='{"gender":1,"age":0.5,"weight":0.45,"muscle":0.7,"race":{"asian":0.35,"caucasian":0.65,"african":0.0},"haut":"young_asian_male","haare":"ponytail01","augenfarbe":"brown","hemd":"elvs_crude_t-shirt_male","schnitt":{"hose":{"unter":0.60}},'"$G"'}'
# Statisten (stehen nur herum, werden mit tools/mensch/statist.mjs „gebacken“): Ballkind und Linienrichter
KIND='{"gender":0.7,"age":0.3,"weight":0.4,"muscle":0.4,"haut":"young_caucasian_male","haare":"short02","augenfarbe":"brown","hemd":"namuhekam_male_polo_shirt","extra":["toigo_maga_hat"],"glatt":["extra"],"schnitt":{"hose":{"unter":0.60}},'"$G"'}'
RICHTER='{"gender":1,"age":0.78,"weight":0.62,"muscle":0.45,"haut":"old_caucasian_male","haare":"short01","augenfarbe":"grey","hemd":"namuhekam_male_polo_shirt","extra":["toigo_maga_hat"],"glatt":["extra"],'"$G"'}'
