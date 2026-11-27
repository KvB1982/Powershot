# Schneidet einzelne Schläge aus den erzeugten Aufnahmen (3D AI Studio, generate_sound_effect) für das Spiel zurecht.
# Aufruf: python3 tools/schlag_bau.py <Ordner mit den Roh-Dateien>      (braucht ffmpeg und numpy)
# Eine erzeugte Aufnahme ist eine Sekunde lang, der Schlag selbst nur einen Bruchteil davon – und nicht jede Aufnahme ist brauchbar
# (viele waren fast still oder nur ein dumpfes Wummern). In STUECKE steht, welches Stück aus welcher Datei genommen wird.
import subprocess, sys, os
import numpy as np

ROH = sys.argv[1]
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds', 'match')
RATE = 44100
SPITZE = 0.85
# Name im Spiel: (Roh-Datei, ab Sekunde, Länge in Sekunden)
STUECKE = {
    'ki_aufschlag_1': ('aufschlag_4.wav', 0.0, 0.30),
    'ki_slice_1': ('slice_2.wav', 0.683, 0.25),
}
for name, (datei, ab, lang) in STUECKE.items():
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(ROH, datei), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True).stdout
    d = np.frombuffer(raw, dtype=np.float32).copy()
    d = np.concatenate([np.zeros(int(0.01 * RATE), dtype=np.float32), d[int(ab * RATE):int((ab + lang) * RATE)]])   # 10 ms Stille davor, damit nichts knackt
    n = int(0.08 * RATE)
    d[-n:] *= np.linspace(1, 0, n) ** 2
    d *= SPITZE / np.abs(d).max()
    ziel = os.path.join(ZIEL, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '96k', ziel], input=d.astype(np.float32).tobytes(), check=True)
    print(f'{name:16s} {len(d) / RATE:.2f} s  {os.path.getsize(ziel) / 1024:.1f} KB')
