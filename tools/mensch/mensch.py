# Powershot – baut einen Menschen mit MakeHuman / MPFB (ohne Fenster) und speichert ihn als GLB für das Spiel.
#   python3 mensch.py aus.glb '{"gender":1,"age":0.5,"haut":"young_caucasian_male","haare":"short01","hemd":"…","hose":"…","schuhe":"…"}'
#
# Abgeschaut bei Police Quest (tools/figur/mensch.py). Was hier anders ist:
#   1. Die Figur wird in die T-Pose von Powershot gebogen (Arme waagerecht, Hände flach, Gelenke genau dort,
#      wo js/figur.js sie erwartet: REST und HAND). So passen alle Bewegungen aus js/avatar.js ohne Änderung.
#   2. Für jeden Punkt wird ausgerechnet, welchen der 27 Powershot-Knochen er folgt (aus den sauberen
#      Gewichten von MakeHuman) – gespeichert als _SKINI (Knochen-Nummern) und _SKINW (Gewichte).
#   3. Alle Teile (Körper, Augen, Haare, Hemd, Hose, Schuhe …) werden EINE Form mit EINEM Bild.
#      Jedes Teil hat sein festes Feld im Bild (FELDER) – daran erkennt das Spiel, was Hemd, Hose, Haut und Haare sind,
#      und kann sie umfärben.
# Die Teile kommen aus den CC0-Paketen von MakeHuman; sie müssen im Daten-Ordner von MPFB ausgepackt liegen.
import sys, bpy, os, json, glob, math
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mh
HumanService, TargetService, HOP, AssetService = mh.start()
aus, wahl = sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
DATEN = os.path.expanduser('~/.config/blender/%d.%d/extensions/.user/user_default/mpfb/data' % bpy.app.version[:2])

# ---- Maße aus js/figur.js (dort heißen sie REST und HAND). [vor, seite, hoch] in Metern, seite: + = rechts ----
REST = dict(hip=[0, 0, 0.93], neck=[0, 0, 1.555], sh=[-0.05, 0.192, 1.411], elbow=[-0.06, 0.467, 1.411], grip=[0.02, 0.805, 1.40],
            leg=[0, 0.09, 0.93], knee=[-0.022, 0.124, 0.512], ankle=[-0.062, 0.146, 0.09])
HAND = dict(gelenk=0.745, finger=[0.835, 0.865, 0.89], daumen=[0.775, 0.045], daumenKnick=[0.798, 0.078])
BONES = ['pelvis', 'chest', 'head', 'upperR', 'foreR', 'upperL', 'foreL', 'thighR', 'shinR', 'thighL', 'shinL', 'footR', 'footL',
         'drehR', 'handR', 'finR1', 'finR2', 'finR3', 'daumR1', 'daumR2', 'drehL', 'handL', 'finL1', 'finL2', 'finL3', 'daumL1', 'daumL2']
# Felder im Bild: [links, unten, Breite, Höhe] als Anteil (0…1). Das Bild ist doppelt so breit wie hoch.
FELDER = dict(haut=[0, 0, 0.5, 1], hemd=[0.5, 0.5, 0.25, 0.5], hose=[0.75, 0.5, 0.25, 0.5], haare=[0.5, 0, 0.25, 0.5],
              schuhe=[0.75, 0.25, 0.125, 0.25], extra=[0.875, 0.25, 0.125, 0.25], extra2=[0.75, 0.125, 0.125, 0.125], extra3=[0.875, 0.125, 0.125, 0.125],
              augen=[0.75, 0, 0.0625, 0.125], brauen=[0.8125, 0, 0.0625, 0.125], wimpern=[0.875, 0, 0.0625, 0.125])
BILD = wahl.get('bild', 2048)                 # Breite des Bildes in Punkten (Höhe = die Hälfte)
HAUT_SOLL = np.array([0xad, 0x80, 0x68]) / 255     # mittlerer Hautton im Bild (REF_SKIN in js/figur.js) – das Spiel färbt von dort aus um
GRAU_SOLL = 0.68                              # so hell ist Kleidung im Bild (das Spiel malt die Farbe darüber)

def finde(ordner, name, endung):             # "clothes", "shoes01" -> die Datei shoes01/….mhclo
    if not name: return None
    if name.endswith(endung): return os.path.join(DATEN, ordner, name)
    treffer = sorted(glob.glob(os.path.join(DATEN, ordner, name, '*' + endung)))
    if not treffer:
        print('FEHLT:', ordner + '/' + name); return None
    return treffer[0]

# ---------------------------------------------------------------- 1. Mensch bauen
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
makro = TargetService.get_default_macro_info_dict()
makro['race'] = wahl.get('race', {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0})
for k, v in wahl.items():
    if k in makro and k != 'race': makro[k] = v
h = HumanService.create_human(macro_detail_dict=makro, scale=0.1)
rig = HumanService.add_builtin_rig(h, "mixamo")
h['feld'] = 'haut'
if wahl.get('haut') and finde('skins', wahl['haut'], '.mhmat'): HumanService.set_character_skin(finde('skins', wahl['haut'], '.mhmat'), h, skin_type='GAMEENGINE')
teile = []
def dazu(ordner, name, art, feld, bunt=False):
    d = finde(ordner, name, '.mhclo')
    if not d: return
    t = HumanService.add_mhclo_asset(d, h, asset_type=art, material_type='GAMEENGINE', subdiv_levels=0)
    t['teil'] = art; t['feld'] = feld; t['bunt'] = bunt; teile.append(t); return t
augen = dazu('eyes', wahl.get('augen', 'low-poly'), 'Eyes', 'augen', True)
dazu('eyebrows', wahl.get('brauen'), 'Eyebrows', 'brauen')
dazu('eyelashes', wahl.get('wimpern'), 'Eyelashes', 'wimpern', True)
dazu('hair', wahl.get('haare'), 'Hair', 'haare')
dazu('clothes', wahl.get('hemd'), 'Clothes', 'hemd')
dazu('clothes', wahl.get('hose'), 'Clothes', 'hose')
dazu('clothes', wahl.get('schuhe'), 'Clothes', 'schuhe')
for i, k in enumerate(wahl.get('extra', [])): dazu('clothes', k, 'Clothes', ['extra', 'extra2', 'extra3'][i], True)
if augen and wahl.get('augenfarbe'):
    bild = bpy.data.images.load(os.path.join(DATEN, 'eyes', 'materials', wahl['augenfarbe'] + '_eye.png'))
    for n in augen.material_slots[0].material.node_tree.nodes:
        if n.type == 'TEX_IMAGE': n.image = bild

def aktiv(o):
    bpy.context.view_layer.objects.active = o
    for x in bpy.data.objects: x.select_set(x == o)

# Formen fest einrechnen, alles Versteckte (Hilfs-Geometrie, Haut unter der Kleidung) wirklich löschen
for o in [h] + teile:
    aktiv(o)
    if o.data.shape_keys: bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(o.modifiers):
        if m.type == 'MASK': bpy.ops.object.modifier_apply(modifier=m.name)
        elif m.type != 'ARMATURE': o.modifiers.remove(m)
    spar = wahl.get('sparen', {}).get(o['feld'])
    if spar and spar < 1:
        m = o.modifiers.new('sparen', 'DECIMATE'); m.ratio = spar
        bpy.ops.object.modifier_move_to_index(modifier=m.name, index=0); bpy.ops.object.modifier_apply(modifier=m.name)

# ---------------------------------------------------------------- 2. In die T-Pose von Powershot biegen
# Blender: x = links von der Figur, y = hinten, z = hoch.   Powershot: [vor, seite(+ = rechts), hoch]
B = lambda p: Vector((-p[1], -p[0], p[2]))
aktiv(rig)
bpy.ops.object.mode_set(mode='EDIT')
for e in rig.data.edit_bones: e.use_connect = False; e.inherit_scale = 'NONE'
bpy.ops.object.mode_set(mode='OBJECT')
RB = rig.data.bones
ruhe = {b.name: b.matrix_local.copy() for b in RB}
kopf = {b.name: b.head_local.copy() for b in RB}
ende = {b.name: b.tail_local.copy() for b in RB}
N = lambda s: 'mixamorig:' + s
neu = {}       # Knochen -> neue Matrix (im Raum des Gerüsts)

def bogen(a, b):            # kleinste Drehung, die Richtung a auf Richtung b legt
    return a.normalized().rotation_difference(b.normalized()).to_matrix()
def rahmen(d, n):           # Dreh-Matrix mit Spalten (d, n senkrecht zu d, d × n)
    d = d.normalized(); n = (n - d * n.dot(d)).normalized(); k = d.cross(n)
    return Matrix((d, n, k)).transposed()
def setze(name, wo, Q=None, lang=1.0, dick=1.0):
    R = (Q or Matrix.Identity(3)) @ ruhe[name].to_3x3()
    M = (R @ Matrix.Diagonal((dick, lang, dick))).to_4x4(); M.translation = wo
    neu[name] = M
def mit(eltern, p):         # wohin wandert Punkt p, wenn er am Knochen "eltern" hängt?
    return neu[eltern] @ ruhe[eltern].inverted() @ p
def Qvon(name):             # die Drehung, die ein Knochen schon bekommen hat
    return (neu[name].to_3x3().normalized() @ ruhe[name].to_3x3().inverted())

fuss_tief = 0.0          # so viel tiefer als im Bauplan sitzt der Fuß, damit die Sohle genau auf dem Boden steht
hand_mal = wahl.get('hand', 1.0)
def biegen():
    neu.clear()
    # Rumpf: Hüfte auf die richtige Höhe, Wirbelsäule so strecken, dass der Hals stimmt
    mitte = (kopf[N('LeftUpLeg')] + kopf[N('RightUpLeg')]) / 2
    ziel_huefte = kopf[N('Hips')] + (B(REST['hip']) - mitte)
    setze(N('Hips'), ziel_huefte)
    k = (REST['neck'][2] - ziel_huefte.z) / (kopf[N('Head')].z - kopf[N('Hips')].z)
    for b, e in (('Spine', 'Hips'), ('Spine1', 'Spine'), ('Spine2', 'Spine1'), ('Neck', 'Spine2')):
        setze(N(b), mit(N(e), kopf[N(b)]), lang=k)
    hals = mit(N('Neck'), kopf[N('Head')])
    setze(N('Head'), Vector((0, hals.y, REST['neck'][2])))
    for S, m in (('Right', 1), ('Left', -1)):
        sp = lambda p: B([p[0], p[1] * m, p[2]])
        # Schulter: bleibt vorn/hinten dort, wo sie bei diesem Menschen von Natur aus sitzt (schulterVor), Breite und Höhe wie im Spiel
        sch0 = mit(N('Spine2'), kopf[N(S + 'Arm')])
        vor = wahl.get('schulterVor', 0.02)      # (0,02 m vor der Hüfte – passt zu SCHULTER_VOR in js/figur.js)
        ab = [vor - REST['sh'][0], 0, 0]
        P = lambda name: sp([REST[name][i] + ab[i] for i in range(3)])
        sh, el, gr = P('sh'), P('elbow'), P('grip')
        t = (HAND['gelenk'] - REST['elbow'][1]) / (REST['grip'][1] - REST['elbow'][1])
        gelenk = el + (gr - el) * t
        sk = mit(N('Spine2'), kopf[N(S + 'Shoulder')])
        d0 = kopf[N(S + 'Arm')] - kopf[N(S + 'Shoulder')]
        setze(N(S + 'Shoulder'), sk, bogen(d0, sh - sk), (sh - sk).length / d0.length)
        # Arm: gerade zur Seite; die Achse des Ellbogens steht senkrecht (er knickt nach vorn)
        dO = kopf[N(S + 'ForeArm')] - kopf[N(S + 'Arm')]; dU = kopf[N(S + 'Hand')] - kopf[N(S + 'ForeArm')]
        achse = dO.cross(dU); achseZiel = Vector((0, 0, -1 if achse.z < 0 else 1))
        setze(N(S + 'Arm'), sh, rahmen(el - sh, achseZiel) @ rahmen(dO, achse).transposed(), (el - sh).length / dO.length)
        setze(N(S + 'ForeArm'), el, rahmen(gelenk - el, achseZiel) @ rahmen(dU, achse).transposed(), (gelenk - el).length / dU.length)
        # Hand: flach, Finger zeigen zur Seite, Daumen-Seite nach vorn
        seite, nachvorn = Vector((-m, 0, 0)), Vector((0, -1, 0))
        dF = kopf[N(S + 'HandMiddle1')] - kopf[N(S + 'Hand')]; dD = kopf[N(S + 'HandIndex1')] - kopf[N(S + 'HandPinky1')]
        QH = rahmen(seite, nachvorn) @ rahmen(dF, dD).transposed()
        setze(N(S + 'Hand'), gelenk, QH, hand_mal, hand_mal)
        gz = gelenk.z
        for f in ('Index', 'Middle', 'Ring', 'Pinky'):
            wo = mit(N(S + 'Hand'), kopf[N(S + 'Hand' + f + '1')])
            for i in (1, 2, 3):
                n = N(S + 'Hand' + f + str(i))
                wo = Vector((-m * HAND['finger'][i - 1], wo.y, wo.z + (gz - wo.z) * (0.5 if i == 1 else 0)))
                d0 = ende[n] - kopf[n]
                lang = (HAND['finger'][i] - HAND['finger'][i - 1]) / d0.length if i < 3 else hand_mal * wahl.get('kuppe', 1.0)
                setze(n, wo, bogen(QH @ d0, seite) @ QH, lang, hand_mal)
        # Daumen: Wurzel und Knick genau dort, wo das Spiel sie dreht
        w1 = Vector((-m * HAND['daumen'][0], gelenk.y - HAND['daumen'][1], gz - 0.012))
        w2 = Vector((-m * HAND['daumenKnick'][0], gelenk.y - HAND['daumenKnick'][1], gz - 0.016))
        n1, n2, n3 = (N(S + 'HandThumb' + str(i)) for i in (1, 2, 3))
        a1 = mit(N(S + 'Hand'), kopf[n1])
        setze(n1, a1, bogen(QH @ (ende[n1] - kopf[n1]), w1 - a1) @ QH, (w1 - a1).length / (ende[n1] - kopf[n1]).length, hand_mal)
        setze(n2, w1, bogen(QH @ (ende[n2] - kopf[n2]), w2 - w1) @ QH, (w2 - w1).length / (ende[n2] - kopf[n2]).length, hand_mal)
        setze(n3, w2, bogen(QH @ (ende[n3] - kopf[n3]), w2 - w1) @ QH, hand_mal, hand_mal)
        # Bein
        bein, knie, fuss = sp(REST['leg']), sp(REST['knee']), sp(REST['ankle'])
        dO = kopf[N(S + 'Leg')] - kopf[N(S + 'UpLeg')]; dU = kopf[N(S + 'Foot')] - kopf[N(S + 'Leg')]
        setze(N(S + 'UpLeg'), bein, bogen(dO, knie - bein), (knie - bein).length / dO.length)
        setze(N(S + 'Leg'), knie, bogen(dU, fuss - knie), (fuss - knie).length / dU.length)
        # Fuß: bleibt flach auf dem Boden (nur so weit um die Hochachse drehen, dass die Zehen geradeaus zeigen)
        dz = kopf[N(S + 'ToeBase')] - kopf[N(S + 'Foot')]
        QF = Matrix.Rotation(math.atan2(dz.x, -dz.y) * wahl.get('fussGerade', 1.0), 3, 'Z')
        setze(N(S + 'Foot'), fuss - Vector((0, 0, fuss_tief)), QF)
        setze(N(S + 'ToeBase'), mit(N(S + 'Foot'), kopf[N(S + 'ToeBase')]), QF)

def anwenden():
    def tiefe(b): return 0 if not b.parent else 1 + tiefe(b.parent)
    for b in sorted(RB, key=tiefe):
        if b.name in neu:
            rig.pose.bones[b.name].matrix = neu[b.name]
            bpy.context.view_layer.update()

biegen(); anwenden()
# Sohle auf den Boden: Der Knöchel sitzt im Spiel 9 cm hoch. Steht die Sohle (mit Schuh) dann nicht genau auf dem Boden, rückt der Fuß nach.
dg = bpy.context.evaluated_depsgraph_get()
fuss_tief = min((o.evaluated_get(dg).matrix_world @ v.co).z for o in [h] + teile for v in o.evaluated_get(dg).data.vertices)
print('Fuß rückt', round(fuss_tief, 4), 'm nach unten')
biegen(); anwenden()
dg = bpy.context.evaluated_depsgraph_get()
for S in ('Right', 'Left'):
    for nme in ('Arm', 'ForeArm', 'Hand', 'HandMiddle1', 'HandThumb2', 'UpLeg', 'Leg', 'Foot'):
        pb = rig.pose.bones[N(S + nme)]; print('  ', S + nme, [round(x, 3) for x in pb.head], [round(x, 3) for x in pb.tail]) if S == 'Right' else None
for o in [h] + teile:
    aktiv(o)
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=m.name)
    o.parent = None

# ---------------------------------------------------------------- 3. Gewichte für die 27 Knochen von Powershot
ss = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(max(0.0, min(1.0, (x - a) / (b - a))))
def knochen(name, a):       # mixamo-Knochen -> [(Powershot-Knochen, Anteil)]; a = Abstand von der Körpermitte zur Seite
    n = name.replace('mixamorig:', ''); s = 'L' if n.startswith('Left') else 'R'; n = n.replace('Left', '').replace('Right', '')
    if n == 'Hips': return [('pelvis', 1)]
    if n == 'Spine': return [('pelvis', 0.5), ('chest', 0.5)]
    if n in ('Spine1', 'Spine2', 'Shoulder'): return [('chest', 1)]
    if n == 'Neck': return [('chest', 0.6), ('head', 0.4)]
    if n == 'Head': return [('head', 1)]
    if n == 'Arm': return [('upper' + s, 1)]
    if n == 'ForeArm':
        d = ss(0.50, 0.73, a); return [('fore' + s, 1 - d), ('dreh' + s, d)]
    if n in ('Hand', 'HandThumb1'): return [('hand' + s, 1)]
    if n == 'HandThumb2': return [('daum' + s + '1', 1)]
    if n == 'HandThumb3': return [('daum' + s + '2', 1)]
    if n.startswith('Hand'): return [('fin' + s + n[-1], 1)]
    if n == 'UpLeg': return [('thigh' + s, 1)]
    if n == 'Leg': return [('shin' + s, 1)]
    if n in ('Foot', 'ToeBase'): return [('foot' + s, 1)]
    return []
for o in [h] + teile:
    gr = {g.index: g.name for g in o.vertex_groups}
    wi = o.data.attributes.new('_SKINI', 'FLOAT_COLOR', 'POINT'); ww = o.data.attributes.new('_SKINW', 'FLOAT_COLOR', 'POINT')
    ohne = 0
    for v in o.data.vertices:
        w = {}
        for g in v.groups:
            for kn, teil in knochen(gr[g.group], abs(v.co.x)):
                w[kn] = w.get(kn, 0) + g.weight * teil
        if not w: w = {'head' if v.co.z > 1.45 else 'pelvis': 1}; ohne += 1
        beste = sorted(w.items(), key=lambda x: -x[1])[:4]; summe = sum(x[1] for x in beste)
        beste += [(beste[0][0], 0)] * (4 - len(beste))
        wi.data[v.index].color = [BONES.index(x[0]) for x in beste]
        ww.data[v.index].color = [x[1] / summe for x in beste]
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    print('TEIL', o.name, o['feld'], 'Punkte', len(o.data.vertices), 'Dreiecke', sum(len(p.vertices) - 2 for p in o.data.polygons), 'ohne Gewicht', ohne)

# ---------------------------------------------------------------- 4. Ein Bild für alles
hoch = BILD // 2
atlas = np.zeros((hoch, BILD, 4), dtype=np.float32); atlas[..., :3] = 0.5
def farbbild(o):
    for s in o.material_slots:
        if not s.material or not s.material.node_tree: continue
        for n in s.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in n.outputs['Color'].links): return n.image
    return None
for o in [h] + teile:
    u0, v0, bu, bv = FELDER[o['feld']]
    x0, y0, bx, by = int(u0 * BILD), int(v0 * hoch), int(bu * BILD), int(bv * hoch)
    b = farbbild(o)
    if b:
        b = b.copy(); b.scale(bx, by)
        px = np.array(b.pixels[:], dtype=np.float32).reshape(by, bx, 4)
        deckt = px[..., 3:4] if o.get('teil') in ('Hair', 'Eyebrows', 'Eyelashes') else np.ones((by, bx, 1), np.float32)
        # (Blender rechnet hier mit Farben "wie auf dem Bildschirm", so wie sie in der Datei stehen)
        if o['feld'] == 'haut':
            mittel = px[..., :3].reshape(-1, 3).mean(0); px[..., :3] = np.clip(px[..., :3] * (HAUT_SOLL / mittel), 0, 1); print('Haut im Mittel', mittel)
        elif not o.get('bunt'):
            grau = px[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
            m = (grau * deckt[..., 0]).sum() / max(deckt.sum(), 1); grau = np.clip(grau * (GRAU_SOLL / max(m, 0.02)), 0, 1)
            px[..., :3] = grau[..., None]
        px[..., 3:4] = deckt
    else:
        px = np.ones((by, bx, 4), np.float32); px[..., :3] = HAUT_SOLL if o['feld'] == 'haut' else GRAU_SOLL
    atlas[y0:y0 + by, x0:x0 + bx] = px
    uv = o.data.uv_layers.active
    if uv is None: uv = o.data.uv_layers.new(name='UVMap')
    uv.name = 'UVMap'
    rand = 2 / BILD
    for d in uv.data:
        d.uv = (u0 + rand + min(1, max(0, d.uv[0])) * (bu - 2 * rand), v0 + 2 * rand + min(1, max(0, d.uv[1])) * (bv - 4 * rand))
bild = bpy.data.images.new('mensch', BILD, hoch, alpha=True)
bild.pixels[:] = atlas.ravel(); bild.pack()
mat = bpy.data.materials.new('mensch'); mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = bild
mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
for o in [h] + teile:
    o.data.materials.clear(); o.data.materials.append(mat)
    for a in list(o.data.color_attributes):
        if a.name not in ('_SKINI', '_SKINW'): o.data.color_attributes.remove(a)
bpy.data.objects.remove(rig)
bpy.ops.object.select_all(action='DESELECT')
for o in [h] + teile: o.select_set(True)
bpy.context.view_layer.objects.active = h
if teile: bpy.ops.object.join()
# Ins Spiel drehen: dort ist x = rechts, y = hoch, z = hinten
h.rotation_euler = (0, 0, math.pi); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.shade_smooth()
h.name = 'mensch'
print('Maße', tuple(round(x, 3) for x in h.dimensions), 'Dreiecke', sum(len(p.vertices) - 2 for p in h.data.polygons))
bpy.ops.export_scene.gltf(filepath=aus, export_format='GLB', export_yup=True, export_attributes=True, export_skins=False, export_animations=False, use_selection=True, export_tangents=False)
print('gespeichert', aus, os.path.getsize(aus))
