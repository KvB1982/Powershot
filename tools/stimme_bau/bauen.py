# Schneidet die Stapel-Aufnahmen in einzelne kleine MP3-Dateien für das Spiel.
import json, os, subprocess, sys, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from schnitt import lade, stuecke, SR
ROH, ZIEL = sys.argv[1], sys.argv[2]        # Ordner mit den Roh-Dateien, Ordner sounds/stimme
U1 = 'p10 p20 p30 p01 p11 p21 p31 p02 p12 p22 p32 p03 p13 p23 deuce advantage'.split()
U2 = 'game game_set game_set_match tiebreak fault double_fault time play quiet thank_you break_point set_point match_point championship_point adv_server adv_receiver welcome'.split()
U3 = ['n%d' % i for i in range(21)]
U4 = ['all%d' % i for i in range(1, 13)]
namen = [k for k, _ in json.load(open(os.path.join(os.path.dirname(__file__), 'namen.json')))]
plan = [('u1.mp3', 'en', U1, 40), ('u2.mp3', 'en', U2, 40), ('u3.mp3', 'en', U3, 40), ('u4.mp3', 'en', U4, 40)]
for i, v in enumerate('123'):
    plan.append((f'l{v}.mp3', 'linie', [f'out_{i * 2 + 1}', f'fault_{i * 2 + 1}', f'out_{i * 2 + 2}', f'fault_{i * 2 + 2}'], 40))
for i in range(12):
    plan.append((f'n{i + 1:02d}.mp3', 'namen', namen[i * 20:i * 20 + 20], 32))

def kuerzen(x, schwelle=0.012, ab=0.18, auf=0.09):
    # Pausen mitten im Satz kürzen ("Fifteen ... love" → "Fifteen love")
    n = SR // 100
    laut = np.abs(x[:len(x) // n * n]).reshape(-1, n).max(axis=1) > schwelle
    teile, i = [], 0
    while i < len(laut):
        j = i
        while j < len(laut) and laut[j] == laut[i]: j += 1
        if not laut[i] and 0 < i and j < len(laut) and (j - i) / 100 > ab:
            m = int(auf * 100) // 2
            teile.append(x[i * n:(i + m) * n]); teile.append(x[(j - m) * n:j * n])
        else: teile.append(x[i * n:j * n])
        i = j
    return np.concatenate(teile)

bericht, gesamt = {}, 0
for datei, ordner, keys, kbit in plan:
    x = lade(os.path.join(ROH, datei)); s = stuecke(x)
    assert len(s) == len(keys), (datei, len(s), len(keys))
    os.makedirs(os.path.join(ZIEL, ordner), exist_ok=True)
    for (a, b), key in zip(s, keys):
        if key == 'thank_you': continue          # aufgenommen, aber im Spiel nicht benutzt
        seg = x[max(0, int((a - 0.03) * SR)):int((b + 0.09) * SR)].copy()
        if ordner == 'en': seg = kuerzen(seg)
        # gleich laut machen: mittlere Lautstärke der lauten Stellen
        aktiv = seg[np.abs(seg) > 0.02]
        rms = float(np.sqrt(np.mean(aktiv ** 2))) if len(aktiv) else 0.1
        seg *= min(0.16 / rms, 0.95 / float(np.abs(seg).max()))
        f1, f2 = int(0.008 * SR), int(0.05 * SR)
        seg[:f1] *= np.linspace(0, 1, f1); seg[-f2:] *= np.linspace(1, 0, f2)
        aus = os.path.join(ZIEL, ordner, key + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', f'{kbit}k',
                        '-map_metadata', '-1', '-write_xing', '0', aus], input=(seg * 32767).astype(np.int16).tobytes(), check=True)
        gesamt += os.path.getsize(aus)
        bericht[f'{ordner}/{key}'] = round(len(seg) / SR, 2)
print(len(bericht), 'Dateien,', round(gesamt / 1024), 'KB')
print({k: v for k, v in bericht.items() if k.startswith('en/p') or k.startswith('linie') or 'game' in k or 'welcome' in k})
