# Woher die Menschen kommen (assets/mensch_*.glb)

Alle Figuren sind mit **MakeHuman / MPFB2** gebaut (https://static.makehumancommunity.org/), so wie Dr. Thomsen im
Schwester-Spiel Police Quest. Körper, Haut, Haare und Kleidung stammen aus den Paketen der MakeHuman-Community.
Benutzt werden **nur Pakete mit der Lizenz CC0** (frei für alles, auch zum Weitergeben – der Dateiname endet auf `_cc0.zip`).
Die Gesichter sind aus Reglern (Alter, Gewicht, Muskeln, Herkunft) entstanden, niemand ist einem echten Menschen nachgebaut.

| Paket (CC0) | Daraus benutzt |
|---|---|
| `makehuman_system_assets_cc0` | Körper, Augen, Augenbrauen, Haut (`young_caucasian_male`, `young_caucasian_male2`, `young_african_male`, `young_asian_male`), Haare (`short01`, `short02`, `short04`, `afro01`, `ponytail01`), Schuhe (`shoes05`) |
| `shirts01_cc0` | Polohemd (`namuhekam_male_polo_shirt`), T-Shirt (`elvs_crude_t-shirt_male`) |
| `pants01_cc0` | Hose (`cortu_cargo_pants`, im Bau-Skript zur kurzen Hose abgeschnitten) |
| `hats01_cc0` | Kappe (`toigo_maga_hat` – nur die Form; die Aufschrift ist entfernt, die Kappe ist einfarbig) |

Stirnband und Schweißbänder baut `tools/mensch/mensch.py` selbst.
Geladen von `https://files2.makehumancommunity.org/asset_packs/<paket>/<paket>_cc0.zip` (Stand 21.11.2026).
Wie die Dateien entstehen: `tools/mensch/LIESMICH.md`, Rezepte in `tools/mensch/rezepte.sh`.
