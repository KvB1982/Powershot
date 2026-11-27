# Macht aus den erzeugten Publikums-Klängen (3D AI Studio, generate_sound_effect) kleine Dateien für das Spiel.
# Aufruf: python3 tools/publikum_bau.py <Ordner mit den Roh-Dateien>      (braucht ffmpeg und numpy)
# Jede Datei wird: auf gleiche Lautstärke gebracht, hinten an der Stille abgeschnitten, weich ausgeblendet
# und als kleines Stereo-MP3 nach sounds/publikum/ki_<name>.mp3 gespeichert.
import subprocess, sys, glob, os
import numpy as np

ROH = sys.argv[1]
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds', 'publikum')
RATE = 44100
SPITZE = 0.89        # so laut ist die lauteste Stelle jeder Datei
AUS = 0.35           # Sekunden weiches Ausblenden am Ende
EIN = 0.03           # Sekunden weiches Einblenden am Anfang (kein Knacken)

for f in sorted(glob.glob(os.path.join(ROH, '*.mp3'))):
    name = os.path.basename(f)[:-4]
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f, '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-'], capture_output=True).stdout
    d = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    laut = np.abs(d).max(axis=1)
    # hinten abschneiden, wo es fast still ist (unter 1,5 % der lautesten Stelle)
    da = np.where(laut > 0.015 * laut.max())[0]
    d = d[:min(len(d), da[-1] + int(0.1 * RATE))]
    d *= SPITZE / np.abs(d).max()
    n_aus, n_ein = int(AUS * RATE), int(EIN * RATE)
    d[-n_aus:] *= np.linspace(1, 0, n_aus)[:, None] ** 2
    d[:n_ein] *= np.linspace(0, 1, n_ein)[:, None]
    ziel = os.path.join(ZIEL, 'ki_' + name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '80k', ziel], input=d.tobytes(), check=True)
    rms = float(np.sqrt((d ** 2).mean()))
    print(f'{name:14s} {len(d) / RATE:5.2f} s  {os.path.getsize(ziel) / 1024:6.1f} KB  Pegel {rms:.3f}')
