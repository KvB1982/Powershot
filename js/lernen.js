// Powershot – Tennis-Wissen: der Lernmodus (ohne three.js, in node testbar).
//
// Hier steht alles zum Nachlesen: zehn Kapitel, passend zu den zehn Themen im Quiz (js/quiz.js).
// Jedes Kapitel hat ein paar Seiten. Eine Seite hat einen Titel, kurze Absätze (`text`), manchmal ein Bild (`bild`),
// eine Liste (`liste`: [Wort, Erklärung]) und ganz unten „Merke dir“ (`merke`).
// Danach kann man das Kapitel üben: Die Fragen kommen aus dem Quiz. Was du falsch hattest, kommt zuerst wieder dran.
//
// Woher kommt das Wissen? Regeln, Maße und Zeiten aus den Tennisregeln der ITF (Ausgabe 2026) und dem ATP-Regelbuch 2026,
// Geschichte von Wimbledon, ITF, Olympia und Wikipedia (nachgeschlagen am 21.11.2026). Technik, Taktik und Training sind
// allgemeines Trainer-Wissen – da gibt es nicht die eine richtige Quelle, und dein Trainer darf es anders sehen.

import { THEMEN, ALLE } from './quiz.js';

export const KAPITEL = {
  zaehlen: {
    kurz: 'Warum 15, 30, 40? So zählt man Punkte, Spiele, Sätze und den Tie-Break.',
    seiten: [
      { titel: 'Punkte: 15, 30, 40, Spiel', bild: 'zaehlen', text: [
        'Ein Match besteht aus <b>Sätzen</b>, ein Satz aus <b>Spielen</b>, ein Spiel aus <b>Punkten</b>.',
        'Die Punkte in einem Spiel heißen <b>15, 30, 40</b> und dann <b>Spiel</b>. Null Punkte heißen im Englischen „love“.',
        'Der Schiedsrichter sagt immer zuerst die Punkte des <b>Aufschlägers</b>. „30:15“ heißt also: Der Aufschläger hat zwei Punkte, der andere einen.',
      ], merke: ['15 – 30 – 40 – Spiel', 'Zuerst wird der Aufschläger genannt'] },
      { titel: 'Einstand und Vorteil', text: [
        'Steht es <b>40:40</b>, heißt das <b>Einstand</b>. Jetzt reicht ein Punkt nicht mehr: Man braucht <b>zwei Punkte hintereinander</b>.',
        'Wer nach Einstand den nächsten Punkt macht, hat <b>Vorteil</b>. Gewinnt er noch einen, hat er das Spiel. Verliert er ihn, ist wieder Einstand.',
        'So kann ein einziges Spiel sehr lange dauern.',
      ], merke: ['40:40 = Einstand', 'Vorteil + noch ein Punkt = Spiel'] },
      { titel: 'Sätze und Matches', text: [
        'Einen <b>Satz</b> gewinnt, wer zuerst <b>6 Spiele</b> hat – aber mit <b>zwei Spielen Vorsprung</b>: 6:4 reicht, 6:5 noch nicht. Dann geht es weiter bis 7:5.',
        'Die meisten Matches gehen über <b>zwei Gewinnsätze</b> („Best of three“). Die Männer spielen bei den vier Grand-Slam-Turnieren über <b>drei Gewinnsätze</b> („Best of five“).',
        'Ein 6:0 nennen Profis im Spaß einen „Bagel“ – weil die Null so rund ist wie das Gebäck.',
      ], merke: ['Satz: 6 Spiele, zwei Vorsprung', 'Grand Slam der Männer: drei Gewinnsätze'] },
      { titel: 'Der Tie-Break', text: [
        'Steht es im Satz <b>6:6</b>, entscheidet meistens ein <b>Tie-Break</b>. Hier zählt man ganz normal: 1, 2, 3 …',
        'Gewonnen hat, wer zuerst <b>7 Punkte</b> hat – wieder mit <b>zwei Punkten Vorsprung</b>. Der Satz endet dann 7:6.',
        'Aufschlag im Tie-Break: Der Erste schlägt <b>einmal</b> auf, danach jeder immer <b>zweimal</b>. Nach jeweils <b>sechs Punkten</b> werden die Seiten gewechselt.',
        'Der <b>Match-Tie-Break</b> geht bis <b>10</b>. Er ersetzt oft den letzten Satz, zum Beispiel im Doppel. Bei den Grand-Slam-Turnieren wird im letzten Satz bei 6:6 auch bis 10 gespielt.',
      ], merke: ['Tie-Break bis 7, Match-Tie-Break bis 10', 'Immer zwei Punkte Vorsprung'] },
      { titel: 'Wichtige Punkte', text: [
        'Ein <b>Breakball</b> ist die Chance, dem Gegner sein Aufschlagspiel abzunehmen. Gelingt das, heißt es <b>Break</b>.',
        'Ein <b>Satzball</b> ist ein Punkt, mit dem man den Satz gewinnen kann, ein <b>Matchball</b> einer, mit dem man das ganze Match gewinnt.',
        'Bei 0:40 hat der Rückschläger gleich <b>drei</b> Breakbälle hintereinander.',
      ], merke: ['Break = das Aufschlagspiel des Gegners gewinnen'] },
    ],
  },
  regeln: {
    kurz: 'Aufschlag, Linien, Netz, Seitenwechsel – was erlaubt ist und was nicht.',
    seiten: [
      { titel: 'Der Aufschlag', bild: 'aufschlag', text: [
        'Aufgeschlagen wird <b>hinter der Grundlinie</b> und immer <b>schräg (diagonal)</b> in das Aufschlagfeld gegenüber. Jedes Spiel beginnt von <b>rechts</b>, dann wird nach jedem Punkt die Seite gewechselt.',
        'Du hast <b>zwei Versuche</b>. Gehen beide daneben, ist das ein <b>Doppelfehler</b> – der Punkt geht an den Gegner.',
        'Berührt der Ball beim Aufschlag das Netz und landet trotzdem im richtigen Feld, wird der Aufschlag <b>wiederholt</b>. Das heißt auf Englisch „Let“ (deutsch: Netzaufschlag).',
        'Ein <b>Fußfehler</b> ist es, wenn du beim Aufschlag auf die Grundlinie oder ins Feld trittst, bevor du den Ball triffst.',
        'Nach jedem Spiel schlägt der andere auf.',
      ], merke: ['Diagonal, von rechts beginnen, zwei Versuche', 'Netz und im Feld = Wiederholung'] },
      { titel: 'Der Ballwechsel', text: [
        'Der Ball darf auf deiner Seite <b>höchstens einmal</b> aufspringen. Du darfst ihn auch direkt aus der Luft nehmen – das ist ein <b>Volley</b>. Nur den Aufschlag muss man erst aufspringen lassen.',
        '<b>Die Linie gehört zum Feld.</b> Berührt der Ball die Linie auch nur ein kleines bisschen, ist er gut.',
        'Im Ballwechsel darf der Ball das Netz berühren. Fällt er danach ins Feld des Gegners, geht es einfach weiter.',
        'Den Punkt verlierst du, wenn du mit Körper, Kleidung oder Schläger <b>das Netz berührst</b>, solange der Ball im Spiel ist. Auch wenn dich der Ball <b>trifft</b>, ist der Punkt weg – sogar wenn du hinter der Grundlinie stehst.',
        'Du darfst den Ball erst schlagen, wenn er <b>über das Netz gekommen</b> ist. Eine Ausnahme: Springt der Ball bei dir auf und fliegt durch Drall oder Wind von allein zurück, darfst du hinüberlangen.',
      ], merke: ['Linie = gut', 'Netz anfassen = Punkt weg'] },
      { titel: 'Seiten und Pausen', text: [
        'Die Seiten werden nach dem <b>ersten, dritten, fünften</b> Spiel eines Satzes gewechselt – also immer, wenn die Zahl der Spiele <b>ungerade</b> ist. So hat jeder mal die Sonne oder den Wind gegen sich.',
        'Zwischen zwei Punkten sind höchstens <b>25 Sekunden</b> Zeit. Beim Seitenwechsel dürfen die Spieler <b>90 Sekunden</b> sitzen, nach einem Satz <b>120 Sekunden</b>.',
        'Vor dem Match wird gelost (Münze oder Schläger drehen). Wer gewinnt, darf wählen: Aufschlag, Rückschlag oder die Seite.',
      ], merke: ['Seitenwechsel nach ungeraden Spielen', '25 Sekunden zwischen den Punkten'] },
      { titel: 'Einzel und Doppel', text: [
        'Im <b>Einzel</b> spielt einer gegen einen. Das Feld ist dann schmaler: Die äußeren Streifen (die „Korridore“) zählen nicht.',
        'Im <b>Doppel</b> spielen zwei gegen zwei, und die Korridore gehören dazu. Beim Aufschlag gilt aber auch im Doppel das normale Aufschlagfeld.',
        'Im Doppel schlagen alle vier Spieler der Reihe nach auf. Wer von einem Paar den Ball schlägt, ist im Ballwechsel egal.',
      ], merke: ['Doppel: Feld mit Korridoren'] },
      { titel: 'Schiedsrichter und Technik', text: [
        'Auf dem hohen Stuhl sitzt der <b>Stuhlschiedsrichter</b>. Er sagt den Spielstand an und entscheidet bei Streit.',
        'Früher standen an jeder Linie <b>Linienrichter</b>. Heute rufen bei allen ATP-Turnieren <b>Kameras</b> „Aus“ – in Bruchteilen einer Sekunde. Das erste Kamera-System hieß Hawk-Eye („Falkenauge“).',
        'Fairness gehört dazu: Man gibt sich nach dem Match am Netz die Hand, auch wenn man verloren hat.',
      ], merke: ['Die Kamera entscheidet, ob ein Ball aus war'] },
    ],
  },
  platz: {
    kurz: 'Wie groß ist ein Tennisplatz? Welche Beläge gibt es? Woraus sind Ball und Schläger?',
    seiten: [
      { titel: 'Der Platz und seine Linien', bild: 'platz', text: [
        'Ein Tennisplatz ist <b>23,77 m lang</b>. Im Einzel ist er <b>8,23 m breit</b>, im Doppel <b>10,97 m</b>.',
        'Hinten ist die <b>Grundlinie</b>, an den Seiten die <b>Seitenlinien</b>. Die <b>Aufschlaglinie</b> ist <b>6,40 m</b> vom Netz entfernt, die Mittellinie teilt die beiden Aufschlagfelder.',
        'Der kleine Strich in der Mitte der Grundlinie heißt <b>Mittelzeichen</b>. Er zeigt, wo rechts und links beim Aufschlag beginnt.',
        'Das Feld zwischen Aufschlaglinie und Grundlinie nennen Spieler „Niemandsland“ – dort steht man ungünstig, weil die Bälle vor den Füßen landen.',
      ], merke: ['23,77 m lang, 8,23 m (Einzel) oder 10,97 m (Doppel) breit', 'Aufschlaglinie: 6,40 m vom Netz'] },
      { titel: 'Das Netz', text: [
        'Das Netz ist in der <b>Mitte 91,4 cm</b> hoch und an den <b>Pfosten 1,07 m</b>. Es hängt also in der Mitte ein Stück durch.',
        'Das ist wichtig für die Taktik: Über die Mitte (also <b>cross</b>, diagonal) ist das Netz niedriger als außen an der Linie entlang.',
        'In der Mitte hält ein weißer Gurt das Netz unten.',
      ], merke: ['Mitte 91,4 cm, außen 1,07 m'] },
      { titel: 'Die Beläge', text: [
        '<b>Sand</b> (rote Asche): Der Ball wird langsamer und springt hoch. Ballwechsel dauern lange, man kann rutschen. Roland Garros in Paris wird auf Sand gespielt.',
        '<b>Rasen</b>: Der Ball bleibt flach und schnell. Aufschlag und Volley sind hier besonders stark. Wimbledon ist das berühmteste Rasenturnier.',
        '<b>Hartplatz</b>: liegt dazwischen und springt gleichmäßig. Die Australian Open und die US Open werden auf Hartplatz gespielt.',
        'In der <b>Halle</b> liegt meist ein Hartplatz. Dort gibt es keinen Wind und keine Sonne – gut für Aufschläger.',
        'Für jeden Belag gibt es eigene Schuhe: Sandplatzschuhe haben ein Fischgräten-Profil, Rasenschuhe kleine Noppen.',
      ], merke: ['Sand: langsam und hoch', 'Rasen: schnell und flach', 'Hartplatz: dazwischen'] },
      { titel: 'Der Ball', text: [
        'Ein Tennisball hat einen Durchmesser von <b>6,54 bis 6,86 cm</b> und wiegt <b>56 bis 59,4 Gramm</b>. Innen ist er hohl und aus Gummi, außen ist Filz.',
        'Der Filz bremst den Ball in der Luft und sorgt dafür, dass der Drall wirkt.',
        'Tennisbälle waren früher weiß. <b>Gelb</b> sind sie seit <b>1972</b>, weil man sie im Fernsehen besser sieht. Wimbledon wechselte erst 1986.',
        'Bei den Profis werden die Bälle zum ersten Mal nach <b>7 Spielen</b> und danach alle <b>9 Spiele</b> gegen neue getauscht – sie werden nämlich weich und flauschig.',
      ], merke: ['Gelb seit 1972', 'Neue Bälle nach 7, dann alle 9 Spiele'] },
      { titel: 'Der Schläger', text: [
        'Früher waren Schläger aus <b>Holz</b> und hatten einen kleinen Kopf. Seit den 1980er-Jahren sind sie aus <b>Carbon</b> (Kohlefaser, „Graphit“): leicht, steif und mit größerem Kopf.',
        'Ein normaler Erwachsenen-Schläger ist <b>68,6 cm</b> lang (27 Zoll). Erlaubt sind höchstens 73,7 cm. Kinderschläger sind kürzer.',
        'Die <b>Saiten</b> werden mit einer Maschine eingezogen und gespannt, meist mit etwa 20 bis 27 Kilogramm. <b>Fester</b> bespannt = mehr Kontrolle, <b>weicher</b> = mehr Tempo.',
        'Profis lassen ihre Schläger bei jedem Turnier neu bespannen, oft mehrere am Tag.',
      ], merke: ['Fest = Kontrolle, weich = Tempo'] },
    ],
  },
  schlaege: {
    kurz: 'Vorhand, Rückhand, Aufschlag, Volley – und was Topspin und Slice mit dem Ball machen.',
    seiten: [
      { titel: 'Vorhand und Rückhand', text: [
        'Die <b>Vorhand</b> schlägst du auf der Seite deiner Schlaghand (Rechtshänder: rechts). Für die meisten ist sie der stärkste Schlag.',
        'Die <b>Rückhand</b> schlägst du auf der anderen Seite – <b>beidhändig</b> (mehr Halt, leichter zu lernen) oder <b>einhändig</b> (mehr Reichweite).',
        'Zu jedem Schlag gehören drei Teile: <b>Ausholen</b>, <b>Treffen</b> und <b>Ausschwingen</b>. Den Ball triffst du am besten <b>vor dem Körper</b>.',
        'Vorher machst du einen kleinen Hüpfer, den <b>Split-Step</b>. So kannst du schnell in jede Richtung starten.',
      ], merke: ['Ausholen – Treffen – Ausschwingen', 'Treffpunkt vor dem Körper'] },
      { titel: 'Topspin, Slice und gerade', bild: 'drall', text: [
        '<b>Topspin</b> (Vorwärtsdrall): Der Schläger streift von <b>unten nach oben</b> über den Ball. Der Ball fliegt hoch über das Netz, fällt dann steil herunter und springt hoch weg. Sehr sicher!',
        '<b>Slice</b> (Rückwärtsdrall): Der Schläger schneidet von <b>oben nach unten</b>. Der Ball schwebt flach, wird langsam und bleibt nach dem Aufsprung niedrig.',
        'Ein <b>gerader</b> Schlag („flach“) hat kaum Drall. Er ist am schnellsten, hat aber wenig Platz über dem Netz.',
      ], merke: ['Topspin: von unten nach oben, springt hoch', 'Slice: von oben nach unten, bleibt flach'] },
      { titel: 'Der Aufschlag', text: [
        'Der Aufschlag ist der einzige Schlag, den du ganz allein bestimmst. Du wirfst den Ball hoch und triffst ihn am <b>höchsten Punkt</b> mit gestrecktem Arm.',
        'Der <b>gerade Aufschlag</b> ist der schnellste – ideal als erster Aufschlag.',
        'Der <b>Slice-Aufschlag</b> hat Seitendrall und biegt zur Seite weg. Er zieht den Gegner aus dem Feld.',
        'Der <b>Kick-Aufschlag</b> hat viel Vorwärtsdrall. Er fliegt hoch über das Netz und springt hoch weg – sehr sicher, darum oft der zweite Aufschlag.',
        'Ein <b>Ass</b> ist ein Aufschlag, den der Gegner nicht einmal berührt.',
      ], merke: ['Erster Aufschlag: Tempo', 'Zweiter Aufschlag: Sicherheit durch Drall'] },
      { titel: 'Am Netz: Volley und Schmetterball', text: [
        'Ein <b>Volley</b> ist ein Schlag aus der Luft, meist nah am Netz. Du holst kaum aus und <b>blockst</b> den Ball mit festem Handgelenk.',
        'Der <b>Schmetterball</b> (Smash) ist die Antwort auf einen zu kurzen Lob: Du schlägst den Ball über dem Kopf nach unten – ähnlich wie beim Aufschlag.',
        'Ein <b>Halbvolley</b> wird direkt nach dem Aufsprung getroffen, ganz knapp über dem Boden. Das ist schwer!',
      ], merke: ['Volley = blocken, nicht ausholen'] },
      { titel: 'Besondere Schläge', text: [
        'Der <b>Stoppball</b> fällt ganz kurz hinter das Netz. Gut, wenn der Gegner weit hinten steht.',
        'Der <b>Lob</b> fliegt hoch über einen Gegner, der am Netz steht.',
        'Der <b>Return</b> ist der Rückschlag auf den Aufschlag. Der <b>Passierball</b> geht an einem Netzspieler vorbei.',
        'Der <b>Tweener</b> ist ein Show-Schlag durch die eigenen Beine – meist, wenn man einem Lob hinterherläuft.',
      ], merke: ['Stoppball: kurz', 'Lob: hoch'] },
      { titel: 'Die Griffe', text: [
        'Wie du den Schläger hältst, nennt man <b>Griff</b>. Der Griff bestimmt, wie die Schlägerfläche beim Treffen steht.',
        'Der <b>Kontinental-Griff</b> („Hammergriff“ – so, als wolltest du mit der Kante einen Nagel einschlagen) ist für Aufschlag, Volley, Schmetterball und Slice.',
        'Für die Vorhand drehen die meisten die Hand weiter unter den Griff (Eastern oder Semi-Western). Je weiter gedreht, desto leichter gelingt Topspin.',
        'Welcher Griff zu dir passt, zeigt dir am besten dein Trainer.',
      ], merke: ['Hammergriff für Aufschlag und Volley'] },
    ],
  },
  taktik: {
    kurz: 'Tennis ist wie Schach mit Laufen: Wohin spiele ich, und warum?',
    seiten: [
      { titel: 'Regel Nummer 1: Sicherheit', text: [
        'Die meisten Punkte werden nicht durch tolle Schläge gewonnen, sondern durch <b>Fehler verloren</b>. Wer einen Ball mehr ins Feld spielt als der Gegner, gewinnt.',
        'Spiele deshalb mit <b>Abstand</b>: hoch genug über das Netz und ein gutes Stück weg von den Linien.',
        'Ein Fehler ohne Not heißt „Unforced Error“ – davon so wenige wie möglich!',
      ], merke: ['Erst sicher, dann schön'] },
      { titel: 'Cross oder longline?', bild: 'cross', text: [
        '<b>Cross</b> heißt diagonal über den Platz, <b>longline</b> gerade an der Seitenlinie entlang.',
        'Cross ist sicherer – aus zwei Gründen: Das Netz ist in der Mitte <b>niedriger</b> (91,4 cm statt 1,07 m), und der Platz ist diagonal <b>länger</b> (im Einzel etwa 25 m von Ecke zu Ecke statt 23,77 m).',
        'Longline ist der Angriff: Der Ball ist schneller beim Gegner, aber das Risiko ist größer. Spiele ihn, wenn du gut stehst und der Ball bequem kommt.',
      ], merke: ['Cross = sicher', 'Longline = Angriff mit Risiko'] },
      { titel: 'Den Gegner bewegen', text: [
        'Lass den Gegner <b>laufen</b>: einmal rechts, einmal links, mal kurz, mal lang. Wer läuft, macht eher Fehler.',
        'Spiele öfter auf die <b>schwächere Seite</b> – bei vielen ist das die Rückhand.',
        'Spiele <b>lang</b> (nah an die Grundlinie). Dann kann der Gegner nicht angreifen.',
        'Nach jedem Schlag gehst du zurück in die <b>Mitte</b> – genauer: dorthin, wo du die meisten möglichen Antworten erreichst.',
      ], merke: ['Lang spielen, auf die schwächere Seite', 'Nach dem Schlag zurück zur Mitte'] },
      { titel: 'Die ersten Schläge', text: [
        'Trainer haben nachgezählt: Ungefähr <b>7 von 10 Punkten</b> sind nach höchstens vier Schlägen vorbei. Aufschlag und Return sind also die wichtigsten Schläge.',
        '<b>Aufschlag + 1</b>: Schlage nach außen auf und spiele den nächsten Ball in die freie Ecke.',
        'Beim <b>Return</b> gilt: Hauptsache zurück, am besten lang in die Mitte. Dann hat der Aufschläger keinen Winkel.',
        'Im Spiel kannst du solche Abläufe unter Training → „Spielzüge lernen“ üben.',
      ], merke: ['Aufschlag und Return entscheiden viele Punkte'] },
      { titel: 'Angreifen und verteidigen', text: [
        'Kommt ein <b>kurzer Ball</b>, ist das deine Chance: Spiele ihn tief in eine Ecke und <b>rücke ans Netz</b> vor. Dort kannst du den Punkt mit einem Volley beenden.',
        'Bist du selbst in Not, spiele <b>hoch und lang</b> – das gibt dir Zeit, zurück in die Mitte zu kommen.',
        'Steht der Gegner am Netz, hast du drei Möglichkeiten: Passierball rechts, Passierball links oder Lob.',
        'Wechsle ab! Wer immer dasselbe spielt, wird schnell durchschaut.',
      ], merke: ['Kurzer Ball = angreifen', 'In Not = hoch und lang'] },
      { titel: 'Kopf und Nerven', text: [
        'Bei wichtigen Punkten werden viele nervös. Profis haben deshalb <b>Rituale</b>: Ball prellen, tief atmen, immer derselbe Ablauf.',
        'Denke an den <b>nächsten Punkt</b>, nicht an den letzten Fehler. Der ist vorbei.',
        'Bei Wind, Sonne oder auf einem anderen Belag muss man seinen Plan ändern. Gute Spieler merken, was heute klappt.',
      ], merke: ['Immer nur der nächste Punkt zählt'] },
    ],
  },
  turniere: {
    kurz: 'Die vier Grand Slams, die Masters, die ATP Finals, der Davis Cup und Olympia.',
    seiten: [
      { titel: 'Die vier Grand-Slam-Turniere', text: [
        'Die vier größten Turniere der Welt heißen <b>Grand Slams</b>. Sie dauern zwei Wochen, und im Einzel starten 128 Spieler.',
        '<b>Australian Open</b> – Melbourne, im Januar, Hartplatz. Das größte Stadion heißt Rod Laver Arena.',
        '<b>Roland Garros</b> (French Open) – Paris, Ende Mai und Anfang Juni, roter Sand.',
        '<b>Wimbledon</b> – London, Ende Juni und Anfang Juli, Rasen. Das älteste Turnier der Welt (seit 1877).',
        '<b>US Open</b> – New York, Ende August und Anfang September, Hartplatz.',
        'Wer alle vier in einem Kalenderjahr gewinnt, hat „den Grand Slam“ geschafft. Das ist extrem selten.',
      ], merke: ['Melbourne – Paris – London – New York', 'Hartplatz – Sand – Rasen – Hartplatz'] },
      { titel: 'Besonderheiten von Wimbledon', text: [
        'In Wimbledon müssen die Spieler fast ganz in <b>Weiß</b> spielen. Die Regel stammt aus den 1880er-Jahren.',
        'Die Zuschauer essen traditionell <b>Erdbeeren mit Sahne</b> – jedes Jahr über zwei Millionen Erdbeeren.',
        'Der Centre Court hat seit <b>2009</b> ein Dach, das man bei Regen schließen kann.',
        'Der Pokal der Männer ist aus vergoldetem Silber. Der Sieger darf ihn nicht mitnehmen – er bekommt eine kleinere Kopie.',
      ], merke: ['Weiß ist Pflicht', 'Rasen seit 1877'] },
      { titel: 'Masters, ATP 500 und ATP 250', text: [
        'Unter den Grand Slams kommt die <b>ATP Tour</b>. Die Zahl im Namen sagt, wie viele Punkte der Sieger für die Weltrangliste bekommt.',
        '<b>ATP Masters 1000</b>: neun große Turniere, zum Beispiel Indian Wells, Miami, Monte-Carlo, Madrid, Rom und Paris.',
        '<b>ATP 500</b> und <b>ATP 250</b>: kleinere Turniere, auch in Deutschland – zum Beispiel in Halle, Hamburg, München und Stuttgart.',
        'Zum Vergleich: Ein Grand-Slam-Sieg bringt <b>2000 Punkte</b>.',
      ], merke: ['Grand Slam 2000 – Masters 1000 – ATP 500 – ATP 250'] },
      { titel: 'ATP Finals', text: [
        'Am Ende des Jahres spielen nur die <b>acht besten</b> Spieler der Saison bei den <b>ATP Finals</b>.',
        'Zuerst gibt es <b>zwei Vierergruppen</b>, in denen jeder gegen jeden spielt. Die besten zwei jeder Gruppe kommen ins Halbfinale.',
        'Wer dabei sein darf, entscheidet das „Race“: die Punkte, die man nur in diesem Jahr gesammelt hat.',
      ], merke: ['Nur die besten 8 des Jahres'] },
      { titel: 'Für das eigene Land', text: [
        'Im <b>Davis Cup</b> spielen Länder gegeneinander – als Mannschaft. Es gibt ihn seit <b>1900</b>.',
        'Bei den Frauen heißt der Wettbewerb Billie Jean King Cup.',
        'Tennis ist auch <b>olympisch</b>. Nach 1924 war es lange nicht dabei, seit <b>1988</b> (Seoul) gibt es wieder Medaillen.',
      ], merke: ['Davis Cup = Länder-Mannschaften, seit 1900'] },
    ],
  },
  geschichte: {
    kurz: 'Vom alten Ballspiel in Frankreich bis zur Kamera, die „Aus“ ruft.',
    seiten: [
      { titel: 'Wie alles anfing', text: [
        'Schon vor vielen hundert Jahren spielte man in Frankreich ein Spiel namens <b>„Jeu de Paume“</b> – „Spiel mit der Handfläche“. Der Ball wurde zuerst mit der Hand geschlagen, später mit Schlägern.',
        'Vermutlich kommt das Wort „Tennis“ vom französischen <b>„tenez!“</b> („Nehmt!“), das der Aufschläger rief. Sicher bewiesen ist das nicht.',
        'Auch die seltsame Zählweise ist uralt. Eine Erklärung: Man zählte an einer Uhr in Viertelstunden – 15, 30, 45. Aus 45 wurde später das kürzere 40. Auch das ist nicht bewiesen.',
      ], merke: ['Jeu de Paume = der Urahn des Tennis'] },
      { titel: 'Tennis auf dem Rasen', text: [
        '<b>1874</b> meldete der Engländer Walter Clopton <b>Wingfield</b> ein Spiel für den Rasen zum Patent an – mit Netz, Schlägern und Regeln. Daraus wurde unser Tennis.',
        'Schon <b>1877</b> fand das erste Turnier in <b>Wimbledon</b> statt. Es ist damit das älteste Tennisturnier der Welt.',
        'Der <b>Davis Cup</b> für Länder-Mannschaften kam im Jahr <b>1900</b> dazu.',
      ], merke: ['1874 Wingfield', '1877 erstes Wimbledon'] },
      { titel: 'Profis dürfen mitspielen', text: [
        'Lange durften bei den großen Turnieren nur <b>Amateure</b> spielen – also Leute, die kein Geld dafür bekamen. Wer Profi wurde, war ausgeschlossen.',
        '<b>1968</b> änderte sich das: Seitdem dürfen alle mitspielen. Diese Zeit heißt <b>„Open Era“</b>.',
        'Die Spielergewerkschaft <b>ATP</b> (Männer) wurde 1972 gegründet, die <b>WTA</b> (Frauen) 1973. Seit 1973 gibt es auch eine Weltrangliste aus dem Computer.',
      ], merke: ['1968 beginnt die Open Era'] },
      { titel: 'Neue Regeln, neue Technik', text: [
        'Der <b>Tie-Break</b> wurde erfunden, damit Sätze nicht endlos dauern. Bei einem Grand Slam gab es ihn zuerst 1970 bei den US Open.',
        'Seit <b>1972</b> sind die Bälle gelb, damit man sie im Farbfernsehen gut sieht.',
        'In den 1980er-Jahren lösten Schläger aus <b>Carbon</b> die Holzschläger ab. Das Spiel wurde viel schneller.',
        '<b>2006</b> durften Spieler bei den US Open zum ersten Mal bei einem Grand Slam eine Entscheidung mit dem <b>Hawk-Eye</b> überprüfen lassen. Heute entscheidet bei der ATP die Kamera alle Linien.',
      ], merke: ['Gelbe Bälle 1972', 'Hawk-Eye 2006'] },
      { titel: 'Rekorde und große Namen', text: [
        '<b>Rod Laver</b> aus Australien gewann zweimal alle vier Grand Slams in einem Jahr: 1962 und 1969. Nach ihm ist das Stadion in Melbourne benannt.',
        '<b>Steffi Graf</b> schaffte 1988 den „Golden Slam“: alle vier Grand Slams und dazu Olympia-Gold in einem Jahr.',
        '<b>Boris Becker</b> gewann 1985 mit nur 17 Jahren Wimbledon – damals als jüngster Sieger.',
        'Das <b>längste Match</b> spielten John Isner und Nicolas Mahut 2010 in Wimbledon: 11 Stunden und 5 Minuten, verteilt auf drei Tage. Der letzte Satz endete 70:68.',
        '<b>Roland Garros</b>, nach dem das Turnier in Paris heißt, war gar kein Tennisspieler, sondern ein Flieger: 1913 flog er als Erster ohne Zwischenlandung über das Mittelmeer.',
      ], merke: ['Laver 1962 und 1969', 'Längstes Match: 11 Stunden 5 Minuten'] },
    ],
  },
  koerper: {
    kurz: 'Aufwärmen, Essen, Trinken, Schlafen – so bleibt ein Tennisspieler fit.',
    seiten: [
      { titel: 'Aufwärmen', text: [
        'Vor dem Spielen machst du dich <b>warm</b>: locker laufen, Hampelmann, Arme kreisen, Knie hoch. Etwa 10 Minuten.',
        'Warme Muskeln sind schneller und reißen nicht so leicht. Auch der Kopf wird wach.',
        'Danach schlägst du dich ein: erst langsam und kurz, dann immer länger und schneller.',
      ], merke: ['Erst warm machen, dann spielen'] },
      { titel: 'Essen und Trinken', text: [
        '<b>Kohlenhydrate</b> (Nudeln, Reis, Kartoffeln, Brot, Banane) sind das Benzin für die Muskeln. Davon isst man <b>vor</b> dem Match – am besten 2 bis 3 Stunden vorher.',
        '<b>Eiweiß</b> (Fisch, Hähnchen, Eier, Quark, Bohnen) repariert die Muskeln. Das ist wichtig <b>nach</b> dem Match.',
        'Fettes und sehr Süßes liegt schwer im Magen – lieber nicht direkt vor dem Spiel.',
        '<b>Trinken</b>: schon vor dem Match und bei jedem Seitenwechsel ein paar Schlucke Wasser. Wer erst trinkt, wenn er Durst hat, ist spät dran.',
        'Die Banane beim Seitenwechsel ist beliebt, weil sie schnell Kraft gibt und leicht verdaulich ist.',
      ], merke: ['Vorher Kohlenhydrate, nachher Eiweiß', 'Bei jedem Seitenwechsel trinken'] },
      { titel: 'Kraft, Tempo, Ausdauer', text: [
        'Tennis ist ein Sport aus vielen kurzen <b>Sprints</b> mit Pausen dazwischen. Man braucht schnelle Beine und Ausdauer für lange Matches.',
        'Die Kraft für einen Schlag kommt nicht nur aus dem Arm. Sie beginnt in den <b>Beinen</b>, geht durch Hüfte und Rumpf und kommt erst zum Schluss im Schläger an.',
        'Profis trainieren deshalb Beine und <b>Rumpf</b> (Bauch und Rücken) – mit Kniebeugen, Kreuzheben, Sprüngen und Medizinball.',
        'Kinder trainieren Kraft am besten mit dem eigenen Körper: Liegestütz, Kniebeuge, Seilspringen. Schwere Hanteln nur mit Trainer.',
      ], merke: ['Die Kraft kommt aus den Beinen'] },
      { titel: 'Nach dem Match', text: [
        'Nach dem Spielen: <b>auslaufen</b> und <b>dehnen</b>. Jede Dehnung ruhig halten, nicht wippen.',
        'Profis gehen zum <b>Physiotherapeuten</b>. Er lockert harte Muskeln mit einer Massage.',
        'Am wichtigsten für die Erholung ist <b>Schlaf</b>. Im Schlaf repariert sich der Körper.',
        'Wenn etwas richtig wehtut: <b>aufhören</b> und es einem Erwachsenen sagen. Mit Schmerzen weiterzuspielen macht es schlimmer.',
      ], merke: ['Dehnen, essen, schlafen'] },
      { titel: 'Sonne und Hitze', text: [
        'Tennis wird oft in der prallen Sonne gespielt. <b>Kappe, Sonnencreme</b> und viel Wasser gehören in die Tasche.',
        'Beim Seitenwechsel helfen Schatten und ein nasses Handtuch im Nacken.',
        'Typische Tennis-Wehwehchen sind Blasen an der Hand und der „Tennisarm“ (ein gereizter Ellbogen). Gute Technik und der passende Griff schützen davor.',
      ], merke: ['Kappe, Creme, Wasser'] },
    ],
  },
  tour: {
    kurz: 'Wie wird man Profi? Wie funktioniert die Weltrangliste? Wer gehört zum Team?',
    seiten: [
      { titel: 'Der Weg nach oben', text: [
        'Niemand startet in Wimbledon. Der Weg geht Stufe für Stufe:',
        '<b>ITF-Turniere</b> (M15, M25): die unterste Stufe. Kleine Clubs, wenig Preisgeld, wenige Punkte.',
        '<b>Challenger</b>: die zweite Liga des Tennis.',
        '<b>ATP 250, ATP 500, Masters 1000</b>: die große Tour.',
        '<b>Grand Slams</b>: ganz oben.',
        'Genau diesen Weg gehst du im Spiel in der Karriere.',
      ], merke: ['ITF → Challenger → ATP → Grand Slam'] },
      { titel: 'Die Weltrangliste', text: [
        'Für jede gewonnene Runde gibt es <b>Punkte</b>. Je größer das Turnier, desto mehr.',
        'Die Punkte bleiben genau <b>52 Wochen</b> stehen. Dann fallen sie weg – man muss sie „<b>verteidigen</b>“, also beim selben Turnier wieder gut spielen.',
        'Gezählt werden die besten <b>18 Turniere</b> eines Spielers (so steht es seit 2026 in den Regeln), die ATP Finals kommen obendrauf.',
        'Die Grand Slams und die meisten Masters sind für die besten Spieler <b>Pflicht</b>: Wer ohne Grund fehlt, bekommt dafür null Punkte angerechnet.',
        'Neben der Weltrangliste gibt es das <b>Race</b>: Es zählt nur die Punkte des laufenden Jahres und beginnt im Januar bei null.',
      ], merke: ['Punkte gelten 52 Wochen', 'Die besten 18 Turniere zählen'] },
      { titel: 'Wer darf mitspielen?', text: [
        'Bei jedem Turnier kommen die Spieler mit dem besten Platz direkt ins <b>Hauptfeld</b>.',
        'Wer knapp dahinter liegt, spielt vorher die <b>Qualifikation</b>.',
        'Eine <b>Wildcard</b> ist eine Einladung vom Turnier – oft für junge Spieler aus dem eigenen Land.',
        'Ein <b>Lucky Loser</b> hat in der Qualifikation verloren, rückt aber nach, weil ein anderer absagt.',
        'Die besten Spieler sind <b>gesetzt</b>: Sie werden im Turnierbaum so verteilt, dass sie erst spät aufeinandertreffen. Manchmal haben sie in der ersten Runde ein <b>Freilos</b>.',
      ], merke: ['Gesetzt = im Baum verteilt', 'Wildcard = Einladung'] },
      { titel: 'Das Team', text: [
        'Ein Profi reist selten allein. Zu seinem Team gehören oft:',
        'der <b>Trainer</b> (Technik, Taktik, Plan für das Match),',
        'der <b>Fitnesstrainer</b> (Kraft und Ausdauer),',
        'der <b>Physiotherapeut</b> (Massage, kleine Verletzungen),',
        'dazu manchmal ein Manager und ein Mentaltrainer. Der <b>Besaiter</b> arbeitet meist für das Turnier und bespannt für alle Spieler.',
        'Das alles bezahlt der Spieler selbst. Deshalb ist es weiter unten in der Rangliste schwer, vom Tennis zu leben.',
      ], merke: ['Der Spieler bezahlt sein Team selbst'] },
      { titel: 'Ein Jahr auf der Tour', text: [
        'Die Saison beginnt im Januar in <b>Australien</b>. Im Frühjahr geht es in die USA (Indian Wells, Miami), dann auf <b>Sand</b> nach Europa bis Roland Garros.',
        'Im Juni kommt die kurze <b>Rasen</b>-Zeit mit Wimbledon, im Sommer der Hartplatz in Nordamerika bis zu den US Open.',
        'Im Herbst folgen Asien und die <b>Halle</b> in Europa, am Ende die ATP Finals. Im Dezember ist Pause und Vorbereitung.',
        'Profis fliegen im Jahr um die halbe Welt und wohnen fast immer im Hotel. Ihre Pausen müssen sie gut planen – sonst wird der Körper müde.',
      ], merke: ['Hartplatz – Sand – Rasen – Hartplatz – Halle'] },
    ],
  },
  woerter: {
    kurz: 'Von „Ass“ bis „Walkover“: die Sprache der Tennisspieler.',
    seiten: [
      { titel: 'Rund um den Punkt', liste: [
        ['Ass', 'Aufschlag, den der Gegner nicht berührt.'],
        ['Doppelfehler', 'Beide Aufschläge gehen daneben – Punkt für den Gegner.'],
        ['Let (Netzaufschlag)', 'Aufschlag berührt das Netz und landet im Feld: Wiederholung.'],
        ['Winner', 'Ein Schlag, den der Gegner nicht mehr erreicht.'],
        ['Unforced Error', 'Ein Fehler ohne Not – der Ball wäre leicht gewesen.'],
        ['Rally (Ballwechsel)', 'Alle Schläge eines Punkts hintereinander.'],
        ['Einstand', 'Spielstand 40:40.'],
        ['Vorteil', 'Ein Punkt nach Einstand – noch einer, und das Spiel ist gewonnen.'],
      ] },
      { titel: 'Rund um das Match', liste: [
        ['Break', 'Ein Spiel gewinnen, in dem der Gegner aufschlägt.'],
        ['Rebreak', 'Gleich nach einem Break selbst das Aufschlagspiel des anderen gewinnen.'],
        ['Breakball / Satzball / Matchball', 'Ein Punkt, der das Break, den Satz oder das Match bringen kann.'],
        ['Tie-Break', 'Entscheidungsspiel bei 6:6, gezählt wird 1, 2, 3 …'],
        ['Bagel', 'Ein Satz, der 6:0 endet.'],
        ['Walkover', 'Sieg ohne Spiel, weil der Gegner nicht antritt.'],
        ['Aufgabe', 'Ein Spieler hört mitten im Match auf, meist wegen einer Verletzung.'],
        ['Love', 'Englisch für null Punkte. Manche glauben, es komme vom französischen „l’œuf“ (das Ei) – bewiesen ist das nicht.'],
      ] },
      { titel: 'Richtungen und Schläge', liste: [
        ['Cross', 'Diagonal über den Platz.'],
        ['Longline', 'Gerade an der Seitenlinie entlang.'],
        ['Inside-out', 'Eine Vorhand aus der Rückhand-Ecke, diagonal gespielt.'],
        ['Topspin', 'Vorwärtsdrall: Der Ball fällt steil und springt hoch.'],
        ['Slice', 'Rückwärtsdrall: Der Ball bleibt flach.'],
        ['Volley', 'Schlag aus der Luft, ohne Aufsprung.'],
        ['Smash (Schmetterball)', 'Schlag über dem Kopf nach unten.'],
        ['Lob', 'Hoher Ball über den Gegner am Netz.'],
        ['Stoppball', 'Ganz kurzer Ball knapp hinter das Netz.'],
        ['Tweener', 'Schlag durch die eigenen Beine.'],
        ['Serve-and-Volley', 'Aufschlagen und sofort ans Netz laufen.'],
        ['Split-Step', 'Kleiner Hüpfer, kurz bevor der Gegner schlägt.'],
      ] },
      { titel: 'Rund um das Turnier', liste: [
        ['Grand Slam', 'Eines der vier größten Turniere – oder alle vier in einem Jahr gewinnen.'],
        ['Setzliste', 'Die besten Spieler werden im Turnierbaum verteilt.'],
        ['Freilos', 'Ohne Match in die nächste Runde.'],
        ['Wildcard', 'Einladung vom Turnier.'],
        ['Qualifikation', 'Vor-Turnier um die letzten Plätze im Hauptfeld.'],
        ['Lucky Loser', 'Verlierer der Qualifikation, der trotzdem nachrückt.'],
        ['Hawk-Eye', 'Kamera-System, das zeigt, wo der Ball gelandet ist.'],
        ['Centre Court', 'Das größte Stadion eines Turniers.'],
        ['Race', 'Rangliste nur aus den Punkten des laufenden Jahres.'],
        ['Open Era', 'Die Zeit seit 1968, in der Profis überall mitspielen dürfen.'],
      ] },
    ],
  },
};

// ---------- Bilder (SVG, selbst gezeichnet) ----------
const T = (x, y, s, f = '#fff', g = 13, a = 'middle') => `<text x="${x}" y="${y}" fill="${f}" font-size="${g}" font-weight="700" text-anchor="${a}">${s}</text>`;
const PF = (x1, y1, x2, y2, f) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f}" stroke-width="3" marker-end="url(#pf${f.slice(1)})"/>`;
const SPITZE = (f) => `<marker id="pf${f.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${f}"/></marker>`;
// Ein Platz von oben: 1 m = 12 Bildpunkte, das Netz liegt quer in der Mitte (x = 40 … 325, y = 20 … 152)
function platzVonOben(extra = '', hoch = 190) {
  const L = 23.77 * 12, B2 = 10.97 * 12, B1 = 8.23 * 12, x0 = 40, y0 = 24, rand = (B2 - B1) / 2, auf = 6.4 * 12, mx = x0 + L / 2;
  return `<svg viewBox="0 0 384 ${hoch}" class="lernbild" role="img"><defs>${SPITZE('#ffe14a')}${SPITZE('#ff8a5a')}${SPITZE('#7ad7ff')}</defs>
    <rect x="${x0 - 26}" y="${y0 - 16}" width="${L + 52}" height="${B2 + 32}" rx="6" fill="#2f7d4f"/><rect x="${x0}" y="${y0}" width="${L}" height="${B2}" fill="#2b62a8" stroke="#fff" stroke-width="2"/>
    <path d="M${x0} ${y0 + rand}H${x0 + L}M${x0} ${y0 + B2 - rand}H${x0 + L}M${mx - auf} ${y0 + rand}V${y0 + B2 - rand}M${mx + auf} ${y0 + rand}V${y0 + B2 - rand}M${mx - auf} ${y0 + B2 / 2}H${mx + auf}M${x0} ${y0 + B2 / 2}h5M${x0 + L} ${y0 + B2 / 2}h-5" stroke="#fff" stroke-width="2" fill="none"/>
    <line x1="${mx}" y1="${y0 - 8}" x2="${mx}" y2="${y0 + B2 + 8}" stroke="#111" stroke-width="3"/>${extra}</svg>`;
}
export const BILDER = {
  platz: () => platzVonOben(
    T(183, 12, 'Netz', '#fff', 11) + T(60, 182, 'Grundlinie', '#fff', 11, 'start') + T(183, 182, '23,77 m lang', '#ffe14a', 12) +
    T(73, 84, 'Aufschlag-', '#fff', 10) + T(73, 96, 'linie ›', '#fff', 10) + T(146, 66, 'Aufschlagfeld', '#cfe6ff', 9) + T(221, 128, '6,40 m', '#ffe14a', 11) +
    `<line x1="184" y1="114" x2="259" y2="114" stroke="#ffe14a" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    T(292, 36, 'Korridor', '#cfe6ff', 9) + T(352, 86, '8,23', '#ffe14a', 10) + T(352, 98, 'Einzel', '#ffe14a', 8) + T(352, 122, '10,97', '#ff8a5a', 10) + T(352, 134, 'Doppel', '#ff8a5a', 8)),
  aufschlag: () => platzVonOben(
    `<rect x="183" y="43.5" width="76.8" height="49.4" fill="rgba(255,225,74,.45)"/>` + PF(36, 128, 232, 70, '#ffe14a') +
    `<circle cx="34" cy="129" r="6" fill="#ff8a5a"/>` + T(34, 172, 'Du stehst rechts …', '#fff', 10, 'start') + T(222, 38, '… und triffst das Feld schräg gegenüber', '#ffe14a', 10)),
  cross: () => platzVonOben(
    PF(52, 126, 318, 50, '#ffe14a') + PF(52, 134, 318, 138, '#ff8a5a') + `<circle cx="46" cy="130" r="6" fill="#fff"/>` +
    T(200, 66, 'cross: etwa 25 m, Netz 91 cm', '#ffe14a', 10) + T(200, 124, 'longline: 23,77 m, Netz höher', '#ff8a5a', 10)),
  zaehlen: () => `<svg viewBox="0 0 366 90" class="lernbild" role="img"><defs>${SPITZE('#ffe14a')}</defs>
    ${['0', '15', '30', '40', 'Spiel'].map((w, i) => `<rect x="${8 + i * 72}" y="22" width="${i === 4 ? 64 : 52}" height="44" rx="10" fill="${i === 4 ? '#e8f04a' : '#24345c'}"/>${T(8 + i * 72 + (i === 4 ? 32 : 26), 51, w, i === 4 ? '#10182c' : '#fff', 19)}${i < 4 ? PF(62 + i * 72, 44, 78 + i * 72, 44, '#ffe14a') : ''}`).join('')}
    ${T(183, 84, 'Jeder gewonnene Punkt bringt dich ein Feld weiter', '#cfd8ee', 11)}</svg>`,
  drall: () => `<svg viewBox="0 0 366 150" class="lernbild" role="img"><defs>${SPITZE('#ffe14a')}${SPITZE('#ff8a5a')}${SPITZE('#7ad7ff')}</defs>
    <rect x="0" y="118" width="366" height="32" fill="#2b62a8"/><line x1="150" y1="118" x2="150" y2="84" stroke="#fff" stroke-width="3"/>
    <path d="M14 96 Q150 -30 250 116 Q285 60 352 58" fill="none" stroke="#ffe14a" stroke-width="3" marker-end="url(#pfffe14a)"/>
    <path d="M14 100 Q150 40 300 116 Q330 104 356 100" fill="none" stroke="#7ad7ff" stroke-width="3" marker-end="url(#pf7ad7ff)"/>
    <path d="M14 104 Q150 58 274 116 Q310 96 354 82" fill="none" stroke="#ff8a5a" stroke-width="3" stroke-dasharray="6 4" marker-end="url(#pfff8a5a)"/>
    ${T(120, 16, 'Topspin: hoch drüber, springt hoch', '#ffe14a', 11)}${T(8, 142, 'gerade', '#ff8a5a', 11, 'start')}${T(358, 142, 'Slice: bleibt flach', '#7ad7ff', 11, 'end')}${T(150, 142, 'Netz', '#fff', 10)}</svg>`,
};

// ---------- Lernstand ----------
// stand = { f: { 'regeln:3': 2, … }, g: { regeln: [0, 1], … } }
//   f: Wie oft hintereinander du eine Frage richtig hattest (0 = zuletzt falsch). g: Welche Seiten du gelesen hast.
export const SICHER = 2;            // so oft hintereinander richtig = „sitzt“
export const RUNDE = 8;             // so viele Fragen hat eine Übungsrunde
export const neuerStand = () => ({ f: {}, g: {} });
export function gelesen(stand, thema, seite) {
  const l = stand.g[thema] || (stand.g[thema] = []);
  if (!l.includes(seite)) l.push(seite);
  return stand;
}
export function eintragen(stand, id, richtig) {
  stand.f[id] = richtig ? Math.min(SICHER, (stand.f[id] || 0) + 1) : 0;
  return stand;
}
// Wie weit bist du in einem Thema? (thema = null: in allen)
export function fortschritt(stand, thema = null) {
  const pool = ALLE.filter((f) => !thema || f.thema === thema);
  const gekonnt = pool.filter((f) => stand.f[f.id] >= 1).length, sicher = pool.filter((f) => stand.f[f.id] >= SICHER).length;
  const seiten = thema ? KAPITEL[thema].seiten.length : Object.values(KAPITEL).reduce((n, k) => n + k.seiten.length, 0);
  const les = thema ? (stand.g[thema] || []).length : Object.values(stand.g).reduce((n, l) => n + l.length, 0);
  const anteil = gekonnt / pool.length;
  return { fragen: pool.length, gekonnt, sicher, seiten, gelesen: Math.min(les, seiten), anteil, sterne: sicher === pool.length ? 3 : anteil >= 0.8 ? 2 : anteil >= 0.5 ? 1 : 0 };
}
// Die nächsten Fragen zum Üben: zuerst was zuletzt falsch war, dann Neues, dann was erst einmal richtig war, zum Schluss der Rest.
export function naechste(stand, thema = null, n = RUNDE, zufall = Math.random) {
  const mischen = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = ALLE.filter((f) => !thema || f.thema === thema);
  const rang = (f) => (stand.f[f.id] === 0 ? 0 : stand.f[f.id] == null ? 1 : stand.f[f.id] < SICHER ? 2 : 3);
  const reihe = [0, 1, 2, 3].flatMap((r) => mischen(pool.filter((f) => rang(f) === r))).slice(0, n);
  return mischen(reihe).map((f) => {
    const wie = mischen([0, 1, 2, 3]);
    return { id: f.id, thema: f.thema, frage: f.zeile[0], antworten: wie.map((k) => f.zeile[1 + k]), richtig: wie.indexOf(0), erkl: f.zeile[5] };
  });
}
// Alle Fragen eines Themas mit der richtigen Antwort – zum Nachlesen
export const karten = (thema) => ALLE.filter((f) => f.thema === thema).map((f) => ({ id: f.id, frage: f.zeile[0], antwort: f.zeile[1], erkl: f.zeile[5] }));
export { THEMEN };
