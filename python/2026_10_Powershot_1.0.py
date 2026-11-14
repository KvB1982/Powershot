# Tennisspiel - die fertige Version zum Spielen
#
# Steuerung:
#   Spieler links:  W / S = hoch / runter,  A / D = zurück / ans Netz
#   Spieler rechts: Pfeiltasten (hoch / runter / links / rechts)
#   Maus: Ist der Mauszeiger über deiner Spielfeldhälfte, folgt dein
#         Schläger der Maus. Je schneller du zum Ball hin schlägst,
#         desto schneller fliegt er zurück!
#   1 = gegen den Computer spielen, 2 = zu zweit spielen
#   Leertaste = neues Spiel nach Spielende
#
# Gezählt wird wie beim echten Tennis: 15, 30, 40, Einstand, Vorteil.
# Gespielt wird ein Satz bis 6 Spiele (mit 2 Spielen Vorsprung),
# bei 6:6 entscheidet der Tiebreak.

import random
import pgzrun

WIDTH = 800
HEIGHT = 500
TITLE = "Tennis"

# Farben
RASEN = (40, 140, 60)
WEISS = (255, 255, 255)
GELB = (230, 255, 60)

# Größen und Geschwindigkeiten
SCHLAEGER_BREITE = 17
SCHLAEGER_HOEHE = 90
SCHLAEGER_TEMPO = 8
GRUNDLINIE = 30          # so weit vom Rand stehen die Spieler am Anfang
NETZ_ABSTAND = 40        # so nah dürfen die Spieler ans Netz
BALL_GROESSE = 14
BALL_START_TEMPO = 5
BALL_MIN_TEMPO = 3
BALL_MAX_TEMPO = 10
COMPUTER_TEMPO = 2
MAUS_TEMPO = 25          # so schnell kann der Schläger der Maus folgen
SCHLAG_FAKTOR = 0.7      # wie stark die Schlagbewegung den Ball beschleunigt

# Die Schläger und der Ball sind Rechtecke: Rect(x, y, breite, höhe)
links = Rect(0, 0, SCHLAEGER_BREITE, SCHLAEGER_HOEHE)
rechts = Rect(0, 0, SCHLAEGER_BREITE, SCHLAEGER_HOEHE)
ball = Rect(0, 0, BALL_GROESSE, BALL_GROESSE)

# Wo die Schläger im letzten Bild waren - daraus berechnen wir,
# wie schnell der Schläger gerade geschwungen wird
vorher = [Rect(links), Rect(rechts)]

# Wohin die Maus den Schläger ziehen will (None = Maus macht gerade nichts)
maus_ziel = [None, None]

# Der Ball fliegt mit dieser Geschwindigkeit (pro Bild)
ball_dx = 0
ball_dy = 0

# Spielstand: Stelle 0 = links, Stelle 1 = rechts
punkte = [0, 0]   # Punkte im aktuellen Spiel (0, 1, 2, 3 = 0, 15, 30, 40)
spiele = [0, 0]   # gewonnene Spiele im Satz
tiebreak = False
aufschlaeger = 0  # wer gerade Aufschlag hat (0 = links, 1 = rechts)
meldung = ""      # kurzer Text wie "Spiel Links!"

# "start", "spiel" oder "ende"
zustand = "start"
gegen_computer = True
pause_bis_aufschlag = 0


def ton(hoehe, dauer=0.05):
    # Kleiner Piepton - falls Töne nicht gehen, spielen wir einfach ohne
    try:
        tone.play(hoehe, dauer)
    except Exception:
        pass


def name(spieler):
    if spieler == 0:
        return "Links"
    if gegen_computer:
        return "Computer"
    return "Rechts"


def aufschlag():
    # Beide Spieler zurück an die Grundlinie, Ball zum Aufschläger
    global ball_dx, ball_dy, pause_bis_aufschlag
    links.midleft = (GRUNDLINIE, HEIGHT / 2)
    rechts.midright = (WIDTH - GRUNDLINIE, HEIGHT / 2)
    maus_ziel[0] = None
    maus_ziel[1] = None
    if aufschlaeger == 0:
        ball.center = (links.right + 20, HEIGHT / 2)
        ball_dx = BALL_START_TEMPO
    else:
        ball.center = (rechts.left - 20, HEIGHT / 2)
        ball_dx = -BALL_START_TEMPO
    ball_dy = random.choice([-3, -2, 2, 3])
    pause_bis_aufschlag = 60  # 60 Bilder = ca. 1 Sekunde warten


def neues_spiel(computer):
    global punkte, spiele, tiebreak, aufschlaeger, zustand, gegen_computer, meldung
    punkte = [0, 0]
    spiele = [0, 0]
    tiebreak = False
    aufschlaeger = random.choice([0, 1])
    gegen_computer = computer
    meldung = ""
    zustand = "spiel"
    aufschlag()


def punkt_fuer(spieler):
    # Hier steckt die ganze Tennis-Zählweise drin
    global aufschlaeger
    gegner = 1 - spieler
    punkte[spieler] += 1

    if tiebreak:
        # Im Tiebreak zählt man 1, 2, 3 ... - wer zuerst 7 hat (mit 2 Vorsprung)
        if punkte[spieler] >= 7 and punkte[spieler] - punkte[gegner] >= 2:
            spiel_gewonnen(spieler)
        elif (punkte[0] + punkte[1]) % 2 == 1:
            # Im Tiebreak wechselt der Aufschlag nach jedem ungeraden Punkt
            aufschlaeger = 1 - aufschlaeger
    else:
        # Normales Spiel: 4 Punkte (0-15-30-40-Spiel), aber 2 Punkte Vorsprung
        if punkte[spieler] >= 4 and punkte[spieler] - punkte[gegner] >= 2:
            spiel_gewonnen(spieler)

    if zustand == "spiel":
        aufschlag()


def spiel_gewonnen(spieler):
    global punkte, tiebreak, aufschlaeger, zustand, meldung
    gegner = 1 - spieler
    spiele[spieler] += 1
    punkte = [0, 0]

    if tiebreak or (spiele[spieler] >= 6 and spiele[spieler] - spiele[gegner] >= 2):
        zustand = "ende"
        ton("C5", 0.4)
        return

    if spiele[0] == 6 and spiele[1] == 6:
        tiebreak = True
        meldung = "Tiebreak!"
    else:
        meldung = "Spiel " + name(spieler) + "!"
    aufschlaeger = 1 - aufschlaeger  # nach jedem Spiel wechselt der Aufschlag


def punkte_text():
    a, b = punkte
    if tiebreak:
        return str(a) + " : " + str(b)
    if a >= 3 and b >= 3:
        if a == b:
            return "Einstand"
        if a > b:
            return "Vorteil " + name(0)
        return "Vorteil " + name(1)
    zahlen = ["0", "15", "30", "40"]
    return zahlen[a] + " : " + zahlen[b]


def schlaeger_bewegen():
    # Linker Spieler: W/S hoch und runter, A/D vor und zurück
    if keyboard.w:
        links.y -= SCHLAEGER_TEMPO
    if keyboard.s:
        links.y += SCHLAEGER_TEMPO
    if keyboard.a:
        links.x -= SCHLAEGER_TEMPO
    if keyboard.d:
        links.x += SCHLAEGER_TEMPO

    if gegen_computer:
        # Der Computer folgt dem Ball - aber nicht perfekt schnell
        if ball.centery < rechts.centery - 10:
            rechts.y -= COMPUTER_TEMPO
        elif ball.centery > rechts.centery + 10:
            rechts.y += COMPUTER_TEMPO
    else:
        # Rechter Spieler: Pfeiltasten
        if keyboard.up:
            rechts.y -= SCHLAEGER_TEMPO
        if keyboard.down:
            rechts.y += SCHLAEGER_TEMPO
        if keyboard.left:
            rechts.x -= SCHLAEGER_TEMPO
        if keyboard.right:
            rechts.x += SCHLAEGER_TEMPO

    # Maussteuerung: Schläger fährt zum Mauszeiger - frei in alle Richtungen,
    # aber höchstens MAUS_TEMPO Pixel pro Bild
    for spieler, schlaeger in ((0, links), (1, rechts)):
        ziel = maus_ziel[spieler]
        if ziel is None:
            continue
        dx = ziel[0] - schlaeger.centerx
        dy = ziel[1] - schlaeger.centery
        entfernung = (dx * dx + dy * dy) ** 0.5
        if entfernung <= MAUS_TEMPO:
            schlaeger.center = ziel
            maus_ziel[spieler] = None  # angekommen
        else:
            schlaeger.x += dx / entfernung * MAUS_TEMPO
            schlaeger.y += dy / entfernung * MAUS_TEMPO

    # Schläger dürfen nicht aus dem Bild fahren
    for schlaeger in (links, rechts):
        if schlaeger.top < 0:
            schlaeger.top = 0
        if schlaeger.bottom > HEIGHT:
            schlaeger.bottom = HEIGHT

    # Jeder bleibt auf seiner Seite: nicht hinter die Grundlinie, nicht übers Netz
    if links.left < 10:
        links.left = 10
    if links.right > WIDTH / 2 - NETZ_ABSTAND:
        links.right = WIDTH / 2 - NETZ_ABSTAND
    if rechts.right > WIDTH - 10:
        rechts.right = WIDTH - 10
    if rechts.left < WIDTH / 2 + NETZ_ABSTAND:
        rechts.left = WIDTH / 2 + NETZ_ABSTAND


def abprallen(spieler, schlaeger):
    global ball_dx, ball_dy

    # Wie schnell wurde der Schläger in diesem Bild bewegt?
    schwung_x = schlaeger.centerx - vorher[spieler].centerx
    schwung_y = schlaeger.centery - vorher[spieler].centery

    # "Vorwärts" heißt: zum Netz hin. Für links ist das nach rechts (+),
    # für rechts nach links (-).
    if spieler == 0:
        vorwaerts = schwung_x
    else:
        vorwaerts = -schwung_x

    # Stillhalten = Ball kommt gleich schnell zurück,
    # nach vorne schlagen = schneller, zurückziehen = langsamer
    tempo = abs(ball_dx) + vorwaerts * SCHLAG_FAKTOR
    tempo = max(BALL_MIN_TEMPO, min(tempo, BALL_MAX_TEMPO))
    ball_dx = tempo if spieler == 0 else -tempo

    # Je weiter außen der Ball den Schläger trifft, desto schräger fliegt er.
    # Schlägt man dabei nach oben oder unten, gibt das noch mehr Schräge.
    abstand = (ball.centery - schlaeger.centery) / (SCHLAEGER_HOEHE / 2)
    ball_dy = abstand * 6 + schwung_y * 0.3
    ball_dy = max(-10, min(ball_dy, 10))

    if vorwaerts > 10:
        ton("C5", 0.08)  # harter Schlag klingt höher
    else:
        ton("A4")


def ball_bewegen():
    global ball_dx, ball_dy, pause_bis_aufschlag, meldung

    if pause_bis_aufschlag > 0:
        pause_bis_aufschlag -= 1
        return
    meldung = ""

    ball.x += ball_dx
    ball.y += ball_dy

    # Oben und unten abprallen
    if ball.top <= 0:
        ball.top = 0
        ball_dy = -ball_dy
        ton("E4", 0.03)
    if ball.bottom >= HEIGHT:
        ball.bottom = HEIGHT
        ball_dy = -ball_dy
        ton("E4", 0.03)

    # Trifft der Ball einen Schläger? (nur von vorne, nicht von hinten)
    # Wir prüfen die ganze Strecke, die der Schläger in diesem Bild
    # zurückgelegt hat - sonst könnte ein schneller Schlag "durch" den Ball gehen.
    strecke_links = links.union(vorher[0])
    strecke_rechts = rechts.union(vorher[1])
    if ball.colliderect(strecke_links) and ball_dx < 0 and ball.centerx > vorher[0].centerx:
        ball.left = links.right
        abprallen(0, links)
    if ball.colliderect(strecke_rechts) and ball_dx > 0 and ball.centerx < vorher[1].centerx:
        ball.right = rechts.left
        abprallen(1, rechts)

    # Ball ist links oder rechts raus -> Punkt!
    if ball.right < 0:
        ton("C3", 0.2)
        punkt_fuer(1)
    elif ball.left > WIDTH:
        ton("C3", 0.2)
        punkt_fuer(0)


def update():
    if zustand == "spiel":
        # Position merken, bevor sich die Schläger bewegen
        vorher[0] = Rect(links)
        vorher[1] = Rect(rechts)
        schlaeger_bewegen()
        ball_bewegen()


def on_mouse_move(pos):
    # Die Maus steuert den Schläger auf der Hälfte, über der sie gerade ist
    if zustand != "spiel":
        return
    if pos[0] < WIDTH / 2:
        maus_ziel[0] = pos
    elif not gegen_computer:
        maus_ziel[1] = pos


def on_key_down(key):
    if zustand in ("start", "ende"):
        if key == keys.K_1:
            neues_spiel(True)
        elif key == keys.K_2:
            neues_spiel(False)
        elif key == keys.SPACE and zustand == "ende":
            neues_spiel(gegen_computer)


def platz_malen():
    screen.fill(RASEN)
    # Spielfeldrand
    screen.draw.rect(Rect(10, 10, WIDTH - 20, HEIGHT - 20), WEISS)
    # Netz als gestrichelte Linie
    for y in range(10, HEIGHT - 10, 30):
        screen.draw.filled_rect(Rect(WIDTH / 2 - 2, y, 4, 18), WEISS)


def anzeige_malen():
    # Namen, Aufschlag-Punkt und gewonnene Spiele
    for spieler, x in ((0, WIDTH / 4), (1, WIDTH * 3 / 4)):
        text = name(spieler)
        if spieler == aufschlaeger:
            text = "* " + text
        screen.draw.text(text, center=(x, 30), fontsize=32, color=WEISS)
        screen.draw.text(str(spiele[spieler]), center=(x, 70), fontsize=60, color=GELB)

    # Punkte im aktuellen Spiel, unten in der Mitte
    titel = "Tiebreak" if tiebreak else "Punkte"
    screen.draw.text(titel, center=(WIDTH / 2, HEIGHT - 70), fontsize=24, color=WEISS)
    screen.draw.text(punkte_text(), center=(WIDTH / 2, HEIGHT - 40), fontsize=44, color=WEISS,
                     owidth=1, ocolor="black")


def draw():
    platz_malen()

    if zustand == "start":
        screen.draw.text("TENNIS", center=(WIDTH / 2, 130), fontsize=90, color=GELB,
                         owidth=1, ocolor="black")
        screen.draw.text("1 = gegen den Computer", center=(WIDTH / 2, 230), fontsize=40, color=WEISS)
        screen.draw.text("2 = zu zweit", center=(WIDTH / 2, 275), fontsize=40, color=WEISS)
        screen.draw.text("Links: W A S D      Rechts: Pfeiltasten",
                         center=(WIDTH / 2, 360), fontsize=28, color=WEISS)
        screen.draw.text("Oder mit der Maus - schnell schlagen = schneller Ball!",
                         center=(WIDTH / 2, 395), fontsize=28, color=WEISS)
        screen.draw.text("Ein Satz bis 6 - echte Tennis-Zählweise",
                         center=(WIDTH / 2, 430), fontsize=28, color=WEISS)
        return

    anzeige_malen()

    # Schläger und Ball
    screen.draw.filled_rect(links, WEISS)
    screen.draw.filled_rect(rechts, WEISS)
    screen.draw.filled_circle(ball.center, BALL_GROESSE / 2, GELB)

    if meldung:
        screen.draw.text(meldung, center=(WIDTH / 2, 180), fontsize=60, color=GELB,
                         owidth=1, ocolor="black")

    if zustand == "ende":
        sieger = 0 if spiele[0] > spiele[1] else 1
        screen.draw.text(name(sieger) + " gewinnt den Satz!", center=(WIDTH / 2, 200),
                         fontsize=60, color=GELB, owidth=1, ocolor="black")
        screen.draw.text(str(spiele[0]) + " : " + str(spiele[1]), center=(WIDTH / 2, 260),
                         fontsize=50, color=WEISS)
        screen.draw.text("Leertaste = nochmal   1 / 2 = Modus wechseln",
                         center=(WIDTH / 2, 320), fontsize=30, color=WEISS)


pgzrun.go()
