# Tennis 2 - die neue Version mit echtem Spielfeld, Aus, Netz und Zielen
#
# So wird gespielt:
#   Sobald der Computer den Ball geschlagen hat, erscheint bei dir eine
#   Richtungslinie. Sie schwingt von links nach rechts und wieder zurück.
#
#   Linke Maustaste  = Richtung festlegen und LANGEN Ball spielen
#                      (danach gehst du zurück hinter die Grundlinie)
#   Rechte Maustaste = Richtung festlegen und KURZEN Ball spielen
#                      (danach gehst du ans Netz)
#
#   Zum Ball laufen musst du nicht - das macht deine Figur von allein.
#   Aber: Hast du nicht geklickt, bevor der Ball bei dir ist, verpasst du ihn!
#   Beim Aufschlag schlägst du sofort, wenn du klickst.
#
#   1 / 2 / 3 = Schwierigkeit wählen (leicht / mittel / schwer)
#   Leertaste = nochmal spielen
#
# Gezählt wird wie beim echten Tennis: 15, 30, 40, Einstand, Vorteil.
# Ein Satz bis 6 Spiele, bei 6:6 Tiebreak.

import copy
import math
import random
import pgzrun

WIDTH = 1100
HEIGHT = 650
TITLE = "Tennis 2"

# Farben
AUSSEN = (30, 105, 55)      # Rasen neben dem Platz
PLATZ = (45, 145, 70)       # Rasen im Spielfeld
WEISS = (255, 255, 255)
GELB = (230, 255, 60)
ORANGE = (255, 160, 40)
SCHATTEN = (20, 70, 35)
BLAU = (60, 120, 230)
ROT = (220, 60, 60)

# Das Spielfeld (in Pixeln)
FELD_LINKS = 150      # linke Grundlinie
FELD_RECHTS = 950     # rechte Grundlinie
FELD_OBEN = 125       # obere Seitenauslinie
FELD_UNTEN = 525      # untere Seitenauslinie
NETZ_X = 550
HALBES_FELD = NETZ_X - FELD_LINKS
NETZ_HOEHE = 15

# Hier stehen die Spieler: etwas hinter der Grundlinie - oder am Netz
HINTER_GRUNDLINIE = 40
AM_NETZ = 90

# Ball und Schläger
BALL_RADIUS = 7
START_HOEHE = 20      # so hoch ist der Ball, wenn er geschlagen wird
REICHWEITE = 35       # so weit reicht man mit dem Schläger
REICH_HOEHE = 70      # noch höhere Bälle erreicht man nicht

# Die zwei Schlagarten:
#   tiefe      = wie weit ins gegnerische Feld (0 = am Netz, 1 = Grundlinie)
#   tempo      = Pixel pro Bild
#   bogen      = wie hoch der Ball fliegt
#   nachsprung = wie weit er nach dem Aufprall noch springt
SCHLAEGE = {
    "lang": {"tiefe": 0.8, "tempo": 9, "bogen": 70, "nachsprung": 0.45},
    "kurz": {"tiefe": 0.3, "tempo": 6.5, "bogen": 40, "nachsprung": 0.3},
}

# Richtungslinie
MAX_WINKEL = 35       # so viel Grad nach links und rechts
LINIEN_LAENGE = 140

SPIELER_TEMPO = 6

# Version 1: Deine eigenen Bälle gehen nie ins Aus.
# Stell das auf False, dann musst du selbst genau zielen!
EIGENE_BAELLE_IMMER_DRIN = True

# Ohne Klick kein Schlag: Wer zu spät klickt, verpasst den Ball.
# Auf False gestellt, schlägt deine Figur dann von allein einen langen Ball.
KLICK_PFLICHT = True

# Die Schwierigkeitsstufen. Hier kannst du alles nach Lust einstellen:
#   computer_tempo = wie schnell der Computer läuft
#   reaktion       = wie viele Bilder er wartet, bevor er losläuft
#   fehler         = wie oft er ins Aus oder ins Netz schlägt (0.3 = 30 %)
#   linien_tempo   = wie schnell deine Richtungslinie schwingt
STUFEN = {
    1: {"name": "Leicht", "computer_tempo": 2.5, "reaktion": 25, "fehler": 0.30, "linien_tempo": 1.2},
    2: {"name": "Mittel", "computer_tempo": 3.5, "reaktion": 15, "fehler": 0.18, "linien_tempo": 1.8},
    3: {"name": "Schwer", "computer_tempo": 4.5, "reaktion": 8, "fehler": 0.08, "linien_tempo": 2.5},
}

GRUND_LINKS = FELD_LINKS - HINTER_GRUNDLINIE    # Platz für dich
GRUND_RECHTS = FELD_RECHTS + HINTER_GRUNDLINIE  # Platz für den Computer


# ---------------------------------------------------------------
# Der Ballflug
# ---------------------------------------------------------------

def im_feld(x, y, seite):
    # Liegt der Punkt (x, y) im Feld von seite? (0 = deins, 1 = Computer)
    if y < FELD_OBEN or y > FELD_UNTEN:
        return False
    if seite == 0:
        return FELD_LINKS <= x < NETZ_X
    return NETZ_X < x <= FELD_RECHTS


class Flug:
    # Ein Ballflug: vom Schläger bis zum Aufprall - und danach noch ein Stück weiter.
    # x, y = wo der Ball über dem Boden ist (da ist sein Schatten)
    # z    = wie hoch der Ball gerade ist

    def __init__(self, start, ziel, art, schlaeger, bogen=None):
        schlag = SCHLAEGE[art]
        self.schlaeger = schlaeger   # wer hat geschlagen? 0 = du, 1 = Computer
        self.tempo = schlag["tempo"]
        self.nachsprung = schlag["nachsprung"]
        self.phase = 1               # 1 = vor dem Aufprall, 2 = danach
        self.vorbei = False
        self.verpasst = False        # zu spät geklickt?
        self.aus = not im_feld(ziel[0], ziel[1], 1 - schlaeger)
        self.x, self.y, self.z = start[0], start[1], START_HOEHE
        if bogen is None:
            bogen = schlag["bogen"]
        self.strecke(start, ziel, START_HOEHE, bogen)

    def strecke(self, start, ziel, start_hoehe, bogen):
        self.start = start
        self.ziel = ziel
        self.start_hoehe = start_hoehe
        self.bogen = bogen
        self.dauer = max(1, math.dist(start, ziel) / self.tempo)
        self.t = 0

    def schritt(self):
        # Ball ein Bild weiterbewegen. Gibt zurück, was dabei passiert ist.
        self.t += 1
        s = min(self.t / self.dauer, 1)   # 0 = Anfang, 1 = Ende der Strecke
        alt_x = self.x
        self.x = self.start[0] + (self.ziel[0] - self.start[0]) * s
        self.y = self.start[1] + (self.ziel[1] - self.start[1]) * s
        # Ein Bogen (Parabel): unten anfangen, hoch, wieder runter
        self.z = self.start_hoehe * (1 - s) + 4 * self.bogen * s * (1 - s)

        # Fliegt der Ball gerade übers Netz - und ist er zu tief?
        ueber_netz = (alt_x < NETZ_X) != (self.x < NETZ_X)
        if self.phase == 1 and ueber_netz and self.z < NETZ_HOEHE:
            self.x = NETZ_X - 6 if alt_x < NETZ_X else NETZ_X + 6
            self.vorbei = True
            return "netz"

        if s >= 1:
            if self.phase == 1:
                if self.aus:
                    self.vorbei = True
                    return "aus"
                # Aufprall im Feld: der Ball springt in dieselbe Richtung weiter
                dx = self.ziel[0] - self.start[0]
                dy = self.ziel[1] - self.start[1]
                neues_ziel = (self.ziel[0] + dx * self.nachsprung,
                              self.ziel[1] + dy * self.nachsprung)
                self.phase = 2
                self.strecke(self.ziel, neues_ziel, 0, self.bogen * 0.45)
                return "aufprall"
            self.vorbei = True
            return "zweiter_aufprall"

        if self.phase == 2 and not (0 <= self.x <= WIDTH and 0 <= self.y <= HEIGHT):
            self.vorbei = True
            return "zweiter_aufprall"
        return None


def schlagbar(b, seite):
    # Kann seite (0 = du, 1 = Computer) diesen Ball jetzt schlagen?
    if b is None or b.vorbei or b.schlaeger == seite or b.verpasst:
        return False
    if seite == 0 and b.x >= NETZ_X:
        return False
    if seite == 1 and b.x <= NETZ_X:
        return False
    if b.phase == 1 and b.aus:
        return False   # Bälle, die ins Aus gehen, lässt man fliegen
    return b.z <= REICH_HOEHE


def abfangpunkt(b, seite, pos, tempo, reaktion, volley):
    # Schaut in die Zukunft: Wo kann der Läufer den Ball rechtzeitig erreichen?
    # Wir spielen den Flug mit einer Kopie des Balls im Voraus durch.
    # volley = True: Ball darf auch vor dem Aufprall genommen werden (am Netz)
    probe = copy.copy(b)
    letzter = None
    for bild in range(1, 600):
        probe.schritt()
        if probe.vorbei:
            break
        if probe.phase == 1 and not volley:
            continue
        if schlagbar(probe, seite):
            punkt = (probe.x, probe.y)
            letzter = punkt
            weg = math.dist(pos, punkt) - REICHWEITE * 0.6
            if weg <= tempo * max(0, bild - reaktion):
                return punkt
    return letzter   # nicht zu schaffen - trotzdem so nah wie möglich ran


# ---------------------------------------------------------------
# Spielzustand
# ---------------------------------------------------------------

stufe = 2
zustand = "start"       # "start", "spiel" oder "ende"
phase = "aufschlag"     # "aufschlag", "ballwechsel" oder "pause"
ball = None

spieler = [GRUND_LINKS, HEIGHT / 2]
computer = [GRUND_RECHTS, HEIGHT / 2]
spieler_heim_x = GRUND_LINKS   # wohin du nach deinem Schlag zurückgehst
spieler_ziel = None
computer_ziel = None
computer_warten = 0
aufschlag_warten = 0
pause_warten = 0

# Richtungslinie
linie_aktiv = False
linie_fest = False
linie_art = "lang"
winkel = -MAX_WINKEL
winkel_richtung = 1

meldung = ""
abdruck = None          # (x, y, wie lange noch, war es aus?)

# Spielstand: Stelle 0 = du, Stelle 1 = Computer
punkte = [0, 0]
spiele = [0, 0]
tiebreak = False
aufschlaeger = 0


def ton(hoehe, dauer=0.05):
    # Kleiner Piepton - falls Töne nicht gehen, spielen wir einfach ohne
    try:
        tone.play(hoehe, dauer)
    except Exception:
        pass


def name(seite):
    return "Du" if seite == 0 else "Computer"


# ---------------------------------------------------------------
# Schlagen
# ---------------------------------------------------------------

def linie_starten():
    global linie_aktiv, linie_fest, linie_art, winkel, winkel_richtung
    linie_aktiv = True
    linie_fest = False
    linie_art = "lang"
    winkel = -MAX_WINKEL     # fängt links an (von dir aus gesehen)
    winkel_richtung = 1


def schlagen(wer, ziel, art, bogen=None):
    global ball, phase, spieler_ziel, computer_ziel, computer_warten, linie_aktiv
    start = spieler if wer == 0 else computer
    ball = Flug((start[0], start[1]), ziel, art, wer, bogen)
    phase = "ballwechsel"
    ton("A4" if art == "lang" else "E4")

    einstellung = STUFEN[stufe]
    if wer == 0:
        # Du hast geschlagen - der Computer überlegt, wo er hinläuft
        linie_aktiv = False
        spieler_ziel = None
        computer_warten = einstellung["reaktion"]
        am_netz = computer[0] < NETZ_X + AM_NETZ * 2
        computer_ziel = abfangpunkt(ball, 1, computer, einstellung["computer_tempo"],
                                    einstellung["reaktion"], am_netz)
    else:
        # Der Computer hat geschlagen - du läufst automatisch zum Ball
        computer_ziel = None
        am_netz = spieler_heim_x == NETZ_X - AM_NETZ
        spieler_ziel = abfangpunkt(ball, 0, spieler, SPIELER_TEMPO, 0, am_netz)
        linie_starten()


def spieler_schlag(art):
    global spieler_heim_x
    # Zielpunkt: Wir verlängern die Richtungslinie bis zur gewünschten Tiefe
    ziel_x = NETZ_X + HALBES_FELD * SCHLAEGE[art]["tiefe"]
    ziel_y = spieler[1] + math.tan(math.radians(winkel)) * (ziel_x - spieler[0])
    if EIGENE_BAELLE_IMMER_DRIN:
        ziel_y = max(FELD_OBEN + 15, min(ziel_y, FELD_UNTEN - 15))

    # Kurzer Ball: ab ans Netz! Langer Ball: zurück hinter die Grundlinie
    if art == "kurz":
        spieler_heim_x = NETZ_X - AM_NETZ
    else:
        spieler_heim_x = GRUND_LINKS
    schlagen(0, (ziel_x, ziel_y), art)


def computer_schlag():
    art = "kurz" if random.random() < 0.25 else "lang"
    tiefe = SCHLAEGE[art]["tiefe"] + random.uniform(-0.1, 0.1)
    ziel_x = NETZ_X - HALBES_FELD * tiefe
    ziel_y = random.uniform(FELD_OBEN + 30, FELD_UNTEN - 30)
    bogen = None

    # Manchmal macht der Computer einen Fehler
    if random.random() < STUFEN[stufe]["fehler"]:
        fehler = random.choice(["zu_lang", "seite", "netz"])
        if fehler == "zu_lang":
            ziel_x = FELD_LINKS - random.uniform(15, 60)
        elif fehler == "seite":
            if random.random() < 0.5:
                ziel_y = FELD_OBEN - random.uniform(15, 50)
            else:
                ziel_y = FELD_UNTEN + random.uniform(15, 50)
        else:
            bogen = 6   # viel zu flach - bleibt im Netz hängen
    schlagen(1, (ziel_x, ziel_y), art, bogen)


# ---------------------------------------------------------------
# Punkte und Spielstand (wie in tennis_fertig.py)
# ---------------------------------------------------------------

def punkt_vergeben(gewinner, grund):
    global phase, pause_warten, meldung
    if gewinner == 0:
        meldung = grund + "\nPunkt für dich!"
        ton("C5", 0.15)
    else:
        meldung = grund + "\nPunkt für den Computer"
        ton("C3", 0.2)
    punkt_fuer(gewinner)
    phase = "pause"
    pause_warten = 90


def punkt_fuer(seite):
    global aufschlaeger
    gegner = 1 - seite
    punkte[seite] += 1

    if tiebreak:
        # Im Tiebreak zählt man 1, 2, 3 ... - wer zuerst 7 hat (mit 2 Vorsprung)
        if punkte[seite] >= 7 and punkte[seite] - punkte[gegner] >= 2:
            spiel_gewonnen(seite)
        elif (punkte[0] + punkte[1]) % 2 == 1:
            aufschlaeger = 1 - aufschlaeger
    else:
        # Normales Spiel: 0-15-30-40-Spiel, aber mit 2 Punkten Vorsprung
        if punkte[seite] >= 4 and punkte[seite] - punkte[gegner] >= 2:
            spiel_gewonnen(seite)


def spiel_gewonnen(seite):
    global punkte, tiebreak, aufschlaeger, zustand, meldung
    gegner = 1 - seite
    spiele[seite] += 1
    punkte = [0, 0]

    if tiebreak or (spiele[seite] >= 6 and spiele[seite] - spiele[gegner] >= 2):
        zustand = "ende"
        return

    if spiele[0] == 6 and spiele[1] == 6:
        tiebreak = True
        meldung += "\nTiebreak!"
    elif seite == 0:
        meldung += "\nSpiel für dich!"
    else:
        meldung += "\nSpiel Computer!"
    aufschlaeger = 1 - aufschlaeger


def punkte_text():
    a, b = punkte
    if tiebreak:
        return str(a) + " : " + str(b)
    if a >= 3 and b >= 3:
        if a == b:
            return "Einstand"
        if a > b:
            return "Vorteil für dich"
        return "Vorteil Computer"
    zahlen = ["0", "15", "30", "40"]
    return zahlen[a] + " : " + zahlen[b]


def neuer_aufschlag():
    global ball, phase, spieler, computer, spieler_heim_x, spieler_ziel, computer_ziel
    global linie_aktiv, aufschlag_warten, meldung
    ball = None
    phase = "aufschlag"
    meldung = ""
    spieler = [GRUND_LINKS, HEIGHT / 2]
    computer = [GRUND_RECHTS, HEIGHT / 2]
    spieler_heim_x = GRUND_LINKS
    spieler_ziel = None
    computer_ziel = None
    if aufschlaeger == 0:
        linie_starten()
    else:
        linie_aktiv = False
        aufschlag_warten = 60


def neues_spiel(neue_stufe):
    global stufe, zustand, punkte, spiele, tiebreak, aufschlaeger
    stufe = neue_stufe
    punkte = [0, 0]
    spiele = [0, 0]
    tiebreak = False
    aufschlaeger = random.choice([0, 1])
    zustand = "spiel"
    neuer_aufschlag()


# ---------------------------------------------------------------
# Jedes Bild: bewegen, prüfen, schlagen
# ---------------------------------------------------------------

def laufen(figur, ziel, tempo, links_vom_netz):
    # Figur ein Stück Richtung Ziel bewegen (höchstens tempo Pixel)
    dx = ziel[0] - figur[0]
    dy = ziel[1] - figur[1]
    weg = math.hypot(dx, dy)
    if weg <= tempo:
        figur[0], figur[1] = ziel
    else:
        figur[0] += dx / weg * tempo
        figur[1] += dy / weg * tempo
    # Jeder bleibt auf seiner Seite und im Bild
    if links_vom_netz:
        figur[0] = max(20, min(figur[0], NETZ_X - 25))
    else:
        figur[0] = max(NETZ_X + 25, min(figur[0], WIDTH - 20))
    figur[1] = max(20, min(figur[1], HEIGHT - 20))


def linie_bewegen():
    global winkel, winkel_richtung
    winkel += winkel_richtung * STUFEN[stufe]["linien_tempo"]
    if winkel >= MAX_WINKEL:
        winkel = MAX_WINKEL
        winkel_richtung = -1
    elif winkel <= -MAX_WINKEL:
        winkel = -MAX_WINKEL
        winkel_richtung = 1


def update():
    global pause_warten, aufschlag_warten, computer_warten, abdruck, linie_aktiv

    if zustand != "spiel":
        return

    if linie_aktiv and not linie_fest:
        linie_bewegen()

    if abdruck:
        x, y, zeit, war_aus = abdruck
        abdruck = (x, y, zeit - 1, war_aus) if zeit > 1 else None

    if phase == "pause":
        pause_warten -= 1
        if pause_warten <= 0 and zustand == "spiel":
            neuer_aufschlag()
        return

    if phase == "aufschlag":
        if aufschlaeger == 1:
            aufschlag_warten -= 1
            if aufschlag_warten <= 0:
                computer_schlag()
        return

    # --- Ballwechsel ---
    ereignis = ball.schritt()
    if ereignis == "aufprall":
        abdruck = (ball.x, ball.y, 60, False)
        ton("G3", 0.03)
    elif ereignis == "aus":
        abdruck = (ball.x, ball.y, 90, True)
        punkt_vergeben(1 - ball.schlaeger, "Aus!")
        return
    elif ereignis == "netz":
        punkt_vergeben(1 - ball.schlaeger, "Netz!")
        return
    elif ereignis == "zweiter_aufprall":
        punkt_vergeben(ball.schlaeger, "Zu spät geklickt!" if ball.verpasst else "Nicht erreicht!")
        return

    # Laufen: zum Ball, oder wenn nichts zu tun ist zurück auf die Position
    laufen(spieler, spieler_ziel or (spieler_heim_x, HEIGHT / 2), SPIELER_TEMPO, True)
    if computer_warten > 0:
        computer_warten -= 1
    else:
        laufen(computer, computer_ziel or (GRUND_RECHTS, HEIGHT / 2),
               STUFEN[stufe]["computer_tempo"], False)

    # Ist der Ball nah genug zum Schlagen?
    if schlagbar(ball, 0) and math.dist(spieler, (ball.x, ball.y)) <= REICHWEITE:
        if linie_fest:
            spieler_schlag(linie_art)
        elif KLICK_PFLICHT:
            ball.verpasst = True     # nicht geklickt - der Ball fliegt vorbei
            linie_aktiv = False
            ton("C3", 0.1)
        else:
            spieler_schlag("lang")
    elif schlagbar(ball, 1) and math.dist(computer, (ball.x, ball.y)) <= REICHWEITE:
        computer_schlag()


def on_mouse_down(pos, button):
    global linie_fest, linie_art
    if zustand != "spiel" or not linie_aktiv or linie_fest:
        return
    if button == mouse.LEFT:
        art = "lang"
    elif button == mouse.RIGHT:
        art = "kurz"
    else:
        return

    if phase == "aufschlag" and aufschlaeger == 0:
        spieler_schlag(art)          # Aufschlag: sofort schlagen
    elif phase == "ballwechsel":
        linie_fest = True            # Richtung merken, geschlagen wird am Ball
        linie_art = art


def on_key_down(key):
    if zustand in ("start", "ende"):
        if key == keys.K_1:
            neues_spiel(1)
        elif key == keys.K_2:
            neues_spiel(2)
        elif key == keys.K_3:
            neues_spiel(3)
        elif key == keys.SPACE and zustand == "ende":
            neues_spiel(stufe)


# ---------------------------------------------------------------
# Malen
# ---------------------------------------------------------------

def linie(x1, y1, x2, y2, dicke=3):
    # Eine gerade weiße Linie (waagerecht oder senkrecht)
    screen.draw.filled_rect(Rect(min(x1, x2) - dicke // 2, min(y1, y2) - dicke // 2,
                                 abs(x2 - x1) + dicke, abs(y2 - y1) + dicke), WEISS)


def platz_malen():
    screen.fill(AUSSEN)
    screen.draw.filled_rect(Rect(FELD_LINKS, FELD_OBEN, FELD_RECHTS - FELD_LINKS,
                                 FELD_UNTEN - FELD_OBEN), PLATZ)
    # Seitenauslinien (oben und unten)
    linie(FELD_LINKS, FELD_OBEN, FELD_RECHTS, FELD_OBEN)
    linie(FELD_LINKS, FELD_UNTEN, FELD_RECHTS, FELD_UNTEN)
    # Grundlinien (links und rechts)
    linie(FELD_LINKS, FELD_OBEN, FELD_LINKS, FELD_UNTEN)
    linie(FELD_RECHTS, FELD_OBEN, FELD_RECHTS, FELD_UNTEN)
    # Aufschlaglinien und Mittellinie (nur zur Deko)
    abstand = HALBES_FELD * 0.55
    linie(NETZ_X - abstand, FELD_OBEN, NETZ_X - abstand, FELD_UNTEN, 2)
    linie(NETZ_X + abstand, FELD_OBEN, NETZ_X + abstand, FELD_UNTEN, 2)
    linie(NETZ_X - abstand, HEIGHT / 2, NETZ_X + abstand, HEIGHT / 2, 2)
    # Netz mit Pfosten
    screen.draw.filled_rect(Rect(NETZ_X - 3, FELD_OBEN - 20, 6, FELD_UNTEN - FELD_OBEN + 40),
                            (215, 215, 215))
    screen.draw.filled_circle((NETZ_X, FELD_OBEN - 20), 5, (90, 90, 90))
    screen.draw.filled_circle((NETZ_X, FELD_UNTEN + 20), 5, (90, 90, 90))


def figur_malen(figur, farbe, text):
    screen.draw.filled_circle((figur[0] + 4, figur[1] + 6), 14, SCHATTEN)
    screen.draw.filled_circle((figur[0], figur[1]), 15, farbe)
    screen.draw.circle((figur[0], figur[1]), 15, WEISS)
    screen.draw.text(text, center=(figur[0], figur[1] - 28), fontsize=22, color=WEISS)


def richtungslinie_malen():
    farbe = ORANGE if linie_fest else GELB
    w = math.radians(winkel)
    # Gepunktete Linie vom Spieler aus in Schlagrichtung
    for abstand in range(20, LINIEN_LAENGE + 1, 12):
        x = spieler[0] + math.cos(w) * abstand
        y = spieler[1] + math.sin(w) * abstand
        screen.draw.filled_circle((x, y), 3, farbe)
    if linie_fest:
        ende = (spieler[0] + math.cos(w) * (LINIEN_LAENGE + 30),
                spieler[1] + math.sin(w) * (LINIEN_LAENGE + 30))
        screen.draw.text(linie_art.upper(), center=ende, fontsize=26, color=ORANGE,
                         owidth=1, ocolor="black")


def ball_malen():
    screen.draw.filled_circle((ball.x, ball.y), BALL_RADIUS - 1, SCHATTEN)
    screen.draw.filled_circle((ball.x, ball.y - ball.z), BALL_RADIUS, GELB)


def anzeige_malen():
    for seite, x in ((0, WIDTH / 4), (1, WIDTH * 3 / 4)):
        text = name(seite)
        if seite == aufschlaeger:
            text = "* " + text
        screen.draw.text(text, center=(x, 30), fontsize=32, color=WEISS)
        screen.draw.text(str(spiele[seite]), center=(x, 75), fontsize=56, color=GELB)
    screen.draw.text("Stufe: " + STUFEN[stufe]["name"], center=(WIDTH / 2, 30),
                     fontsize=24, color=WEISS)

    titel = "Tiebreak" if tiebreak else "Punkte"
    screen.draw.text(titel, center=(WIDTH / 2, 560), fontsize=22, color=WEISS)
    screen.draw.text(punkte_text(), center=(WIDTH / 2, 590), fontsize=42, color=WEISS,
                     owidth=1, ocolor="black")
    screen.draw.text("Linke Maustaste = langer Ball     Rechte Maustaste = kurzer Ball (ans Netz)",
                     center=(WIDTH / 2, 630), fontsize=22, color=WEISS)


def draw():
    platz_malen()

    if zustand == "start":
        screen.draw.text("TENNIS 2", center=(WIDTH / 2, 200), fontsize=100, color=GELB,
                         owidth=1, ocolor="black")
        screen.draw.text("Schwierigkeit wählen:", center=(WIDTH / 2, 290), fontsize=36, color=WEISS)
        screen.draw.text("1 = Leicht     2 = Mittel     3 = Schwer",
                         center=(WIDTH / 2, 335), fontsize=40, color=WEISS)
        screen.draw.text("Linke Maustaste = langer Ball   Rechte Maustaste = kurzer Ball",
                         center=(WIDTH / 2, 420), fontsize=28, color=WEISS)
        screen.draw.text("Klicke, wenn die Richtungslinie in die richtige Richtung zeigt!",
                         center=(WIDTH / 2, 455), fontsize=28, color=WEISS)
        return

    anzeige_malen()

    if abdruck:
        x, y, zeit, war_aus = abdruck
        screen.draw.filled_circle((x, y), 5, ROT if war_aus else (200, 230, 200))

    figur_malen(spieler, BLAU, "Du")
    figur_malen(computer, ROT, "Computer")

    if linie_aktiv:
        richtungslinie_malen()
    if ball:
        ball_malen()

    if meldung:
        screen.draw.text(meldung, center=(WIDTH / 2, 260), fontsize=50, color=GELB,
                         owidth=1.5, ocolor="black", align="center")

    if zustand == "ende":
        if spiele[0] > spiele[1]:
            sieger = "Du gewinnst den Satz!"
        else:
            sieger = "Der Computer gewinnt den Satz!"
        screen.draw.filled_rect(Rect(200, 200, WIDTH - 400, 220), (20, 60, 30))
        screen.draw.text(sieger, center=(WIDTH / 2, 250), fontsize=56, color=GELB)
        screen.draw.text(str(spiele[0]) + " : " + str(spiele[1]), center=(WIDTH / 2, 310),
                         fontsize=50, color=WEISS)
        screen.draw.text("Leertaste = nochmal     1 / 2 / 3 = andere Stufe",
                         center=(WIDTH / 2, 380), fontsize=28, color=WEISS)


pgzrun.go()
