// Powershot – die Uhr erkennt den Schwung.
//
// Die Uhr misst 100-mal pro Sekunde, wie stark das Handgelenk beschleunigt wird.
// Wird es stark genug bewegt, zählt das als Schwung. Wir merken uns kurz den stärksten Wert
// und ob die Bewegung senkrecht (rauf/runter) oder eher seitlich war. Dann geht eine kleine
// Nachricht ans iPhone: "Schwung Nummer 7, Kraft 0,8, von oben, um 15:02:11,25 Uhr".
//
// Die Zahlen sind dieselben wie im Spiel (js/controls.js): SWING_START, SWING_VOLL, SWING_PAUSE.

import CoreMotion
import Foundation
import HealthKit
import WatchConnectivity
import WatchKit

/// Die Schlagarten, die man aufnehmen kann: (Kürzel für den Dateinamen, Name auf dem Bildschirm)
let schlagarten: [(kuerzel: String, name: String)] = [
    // Grundschläge
    ("vorhand-topspin", "Vorhand Topspin"), ("vorhand-flach", "Vorhand flach"), ("vorhand-slice", "Vorhand Slice"),
    ("rueckhand-topspin", "Rückhand Topspin"), ("rueckhand-flach", "Rückhand flach"), ("rueckhand-slice", "Rückhand Slice"),
    // Am Netz
    ("vorhand-volley", "Vorhand-Volley"), ("rueckhand-volley", "Rückhand-Volley"),
    ("halbvolley", "Halbvolley"), ("stopp-volley", "Stopp-Volley"),
    ("smash", "Schmetterball"), ("rueckhand-smash", "Rückhand-Schmetterball"),
    // Besondere Schläge
    ("topspin-lob", "Topspin-Lob"), ("slice-lob", "Slice-Lob"),
    ("vorhand-stopp", "Vorhand-Stopp"), ("rueckhand-stopp", "Rückhand-Stopp"),
    ("tweener", "Tweener (zwischen den Beinen)"),
    // Aufschläge
    ("aufschlag-gerade", "Aufschlag gerade"), ("aufschlag-slice", "Aufschlag Slice"),
    ("aufschlag-kick", "Aufschlag Kick"), ("aufschlag-unten", "Aufschlag von unten"),
    // Kein Schlag
    ("doppelklopfen", "Doppelklopfen (Hände aneinander)"),
    ("kein-schlag", "Kein Schlag (laufen, jubeln …)"),
]

final class Schlaeger: NSObject, ObservableObject {
    @Published var laeuft = false
    @Published var anzahl = 0
    @Published var erreichbar = false
    @Published var fehler: String?
    /// Zum Fehlersuchen: Was ist mit der letzten Nachricht ans iPhone passiert?
    @Published var funkStatus = "noch nichts gesendet"
    private var bestaetigt = 0

    private let schwungStart = 1.6      // ab dieser Beschleunigung (in g) zählt es als Schwung
    private let schwungVoll = 5.0       // so stark = volle Kraft
    private let schwungPause = 0.4      // Sekunden Ruhe nach einem Schwung
    // Doppelklopfen (zweimal kurz die Hände aneinander): Ein Klopfer ist ein harter Stoß, bei dem sich das
    // Handgelenk kaum dreht. Bei einem echten Schlag dreht es sich dagegen stark.
    private let klopfDrehung = 2.0      // dreht sich das Handgelenk langsamer als so (rad/s), ist es ein Klopfer
    private let klopfAbstand = 0.1...0.5   // so viele Sekunden dürfen zwischen den zwei Klopfern liegen
    private var staerksteDrehung = 0.0
    private var letzterKlopfer = -9.0
    private var gesten = 0

    private let bewegung = CMMotionManager()
    private let gesundheit = HKHealthStore()
    private var training: HKWorkoutSession?
    private var startNummer = 0

    // --- Schläge aufnehmen (zum Lernen, wie die verschiedenen Schlagarten aussehen) ---
    /// Welche Schlagart wird gerade aufgenommen? nil = es wird normal gespielt.
    @Published var aufnahme: (kuerzel: String, name: String)?
    @Published var aufgenommen = 0
    let serienLaenge = 10                       // so viele Schläge gehören zu einer Serie
    private var puffer: [[Double]] = []         // die letzten 3 Sekunden Messwerte
    private var serie: [[[Double]]] = []        // die fertig ausgeschnittenen Schläge dieser Serie
    private var schnitt: (von: Double, bis: Double)?   // der Schlag, auf dessen Ende wir noch warten

    // Der Schwung, der gerade beobachtet wird
    private var aktiv = false
    private var beginn = 0.0, staerkster = 0.0, hoch = 0.0, ende = -9.0

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    /// "Start" gedrückt: erst um Erlaubnis fragen, dann messen.
    func starten() {
        fehler = nil
        // Die Uhr schläft ein, wenn man den Arm senkt. Ein "Training" hält sie wach.
        // Es wird nichts gespeichert – wir brauchen nur das Wachbleiben.
        gesundheit.requestAuthorization(toShare: [HKObjectType.workoutType()], read: []) { _, _ in
            DispatchQueue.main.async { self.messenStarten() }
        }
    }

    private func messenStarten() {
        let plan = HKWorkoutConfiguration()
        plan.activityType = .tennis
        plan.locationType = .indoor
        do {
            let sitzung = try HKWorkoutSession(healthStore: gesundheit, configuration: plan)
            sitzung.startActivity(with: Date())
            training = sitzung
        } catch {
            fehler = "Die Uhr bleibt vielleicht nicht wach."
        }
        guard bewegung.isDeviceMotionAvailable else { fehler = "Kein Bewegungssensor"; return }
        bewegung.deviceMotionUpdateInterval = 1.0 / 100.0
        bewegung.startDeviceMotionUpdates(to: .main) { [weak self] messung, _ in
            if let messung { self?.pruefen(messung) }
        }
        anzahl = 0
        startNummer = (Int(Date().timeIntervalSince1970) % 100_000) * 1000
        laeuft = true
    }

    /// Eine Serie für eine Schlagart aufnehmen. Jeder Schwung wird von selbst erkannt und ausgeschnitten.
    func aufnahmeStarten(_ art: (kuerzel: String, name: String)) {
        aufnahme = art
        serie = []; puffer = []; schnitt = nil
        aufgenommen = 0
        funkStatus = "Aufnahme läuft"
        if !laeuft { starten() }
    }

    func letztenLoeschen() {
        guard !serie.isEmpty else { return }
        serie.removeLast()
        aufgenommen = serie.count
    }

    /// Serie fertig: als Datei speichern und ans iPhone schicken.
    func aufnahmeBeenden() {
        guard let art = aufnahme else { return }
        aufnahme = nil
        stoppen()
        guard !serie.isEmpty else { funkStatus = "Nichts aufgenommen"; return }
        let zeit = DateFormatter(); zeit.dateFormat = "yyyyMMdd-HHmmss"
        let name = "schlag_\(art.kuerzel)_\(zeit.string(from: Date())).json"
        let geraet = WKInterfaceDevice.current()
        let inhalt: [String: Any] = [
            "schlagart": art.kuerzel, "name": art.name, "datum": ISO8601DateFormatter().string(from: Date()),
            "messungenProSekunde": 100,
            "handgelenk": geraet.wristLocation == .left ? "links" : "rechts",
            "krone": geraet.crownOrientation == .left ? "links" : "rechts",
            // Was die Zahlen in jeder Messung bedeuten (in dieser Reihenfolge):
            "felder": ["t", "ax", "ay", "az", "rx", "ry", "rz", "gx", "gy", "gz", "qw", "qx", "qy", "qz"],
            "erklaerung": "t = Sekunden ab Schlagbeginn; a = Beschleunigung der Hand in g; r = Drehgeschwindigkeit in rad/s; g = Richtung nach unten; q = Lage der Uhr im Raum (Quaternion)",
            "schlaege": serie,
        ]
        let datei = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        guard let daten = try? JSONSerialization.data(withJSONObject: inhalt), (try? daten.write(to: datei)) != nil else {
            funkStatus = "Speichern hat nicht geklappt"; return
        }
        WCSession.default.transferFile(datei, metadata: ["name": name])
        funkStatus = "\(serie.count) Schläge ans iPhone geschickt"
        serie = []
    }

    func stoppen() {
        bewegung.stopDeviceMotionUpdates()
        training?.end()
        training = nil
        laeuft = false
    }

    /// Eine neue Messung: Beginnt gerade ein Schwung, läuft einer, oder ist einer fertig?
    private func pruefen(_ m: CMDeviceMotion) {
        let a = m.userAcceleration, g = m.gravity
        let stark = (a.x * a.x + a.y * a.y + a.z * a.z).squareRoot()
        let nachOben = -(a.x * g.x + a.y * g.y + a.z * g.z)      // > 0: nach oben, < 0: nach unten
        let jetzt = m.timestamp

        // Beim Aufnehmen merken wir uns laufend alle Messwerte der letzten 3 Sekunden.
        if aufnahme != nil {
            let r = m.rotationRate, q = m.attitude.quaternion
            func k(_ x: Double) -> Double { (x * 1000).rounded() / 1000 }     // auf 3 Stellen kürzen
            puffer.append([jetzt, k(a.x), k(a.y), k(a.z), k(r.x), k(r.y), k(r.z), k(g.x), k(g.y), k(g.z), k(q.w), k(q.x), k(q.y), k(q.z)])
            if puffer.count > 300 { puffer.removeFirst(puffer.count - 300) }
            // Ist der Schlag, auf den wir warten, jetzt ganz vorbei? Dann ausschneiden.
            if let s = schnitt, jetzt >= s.bis {
                schnitt = nil
                let stueck = puffer.filter { $0[0] >= s.von && $0[0] <= s.bis }.map { messung -> [Double] in
                    var z = messung; z[0] = k(messung[0] - s.von - 0.4); return z      // t = 0 ist der Schlagbeginn
                }
                serie.append(stueck)
                aufgenommen = serie.count
                WKInterfaceDevice.current().play(.click)                  // kurzes Tippen am Handgelenk: "Schlag erkannt"
                if aufgenommen >= serienLaenge { WKInterfaceDevice.current().play(.success); aufnahmeBeenden(); return }
            }
        }
        let pause = aufnahme != nil ? 1.2 : schwungPause       // beim Aufnehmen mehr Abstand zwischen den Schlägen

        if !aktiv {
            guard stark >= schwungStart, jetzt - ende >= pause else { return }
            aktiv = true; beginn = jetzt; staerkster = stark; hoch = nachOben
            staerksteDrehung = 0
            return
        }
        if stark > staerkster { staerkster = stark; hoch = nachOben }
        let dreh = m.rotationRate
        staerksteDrehung = max(staerksteDrehung, (dreh.x * dreh.x + dreh.y * dreh.y + dreh.z * dreh.z).squareRoot())
        guard jetzt - beginn >= 0.06 else { return }             // nur 0,06 Sekunden lang den stärksten Wert suchen – die Meldung soll schnell raus
        aktiv = false; ende = jetzt

        // Beim Aufnehmen: 0,4 Sekunden vor dem Schlagbeginn bis 0,7 Sekunden danach ausschneiden (sobald die Zeit um ist).
        if aufnahme != nil { schnitt = (beginn - 0.4, beginn + 0.7); return }

        // War das ein Klopfer statt eines Schlags? (harter Stoß, aber das Handgelenk hat sich kaum gedreht)
        if staerksteDrehung < klopfDrehung {
            ende = jetzt - schwungPause + 0.08                    // der zweite Klopfer darf gleich danach kommen
            if klopfAbstand.contains(jetzt - letzterKlopfer) {
                letzterKlopfer = -9
                gesten += 1
                WKInterfaceDevice.current().play(.directionUp)    // spürbares Zeichen: Doppelklopfen erkannt
                melden(["geste": "klopfen", "nr": startNummer + gesten, "zeit": Date().timeIntervalSince1970])
            } else {
                letzterKlopfer = jetzt
            }
            return
        }

        let kraft = min(1, max(0, (staerkster - schwungStart) / (schwungVoll - schwungStart)))
        anzahl += 1
        // Die Nummer enthält die Startzeit, damit nach einem neuen "Start" keine Nummer doppelt vorkommt.
        melden(["schwung": startNummer + anzahl, "kraft": kraft, "hoch": hoch / staerkster,
                "zeit": Date().timeIntervalSince1970])
    }

    private func melden(_ nachricht: [String: Any]) {
        let funk = WCSession.default
        erreichbar = funk.isReachable
        guard funk.activationState == .activated else { funkStatus = "Funk ist nicht bereit"; funk.activate(); return }
        guard funk.isReachable else {
            // Das iPhone ist gerade nicht direkt erreichbar: als Päckchen hinterherschicken (kommt später an).
            funk.transferUserInfo(nachricht)
            funkStatus = "iPhone nicht erreichbar"
            return
        }
        // Mit Antwort: So wissen wir sicher, dass das iPhone die Nachricht bekommen hat.
        funk.sendMessage(nachricht, replyHandler: { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.bestaetigt += 1
                self.funkStatus = "iPhone hat \(self.bestaetigt)× bestätigt"
            }
        }, errorHandler: { [weak self] fehler in
            DispatchQueue.main.async {
                self?.erreichbar = false
                self?.funkStatus = "Fehler: \(fehler.localizedDescription)"
            }
        })
    }

    /// Zum Fehlersuchen: eine Test-Nachricht ans iPhone schicken (ohne zu schwingen).
    func testen() {
        funkStatus = "sende Test …"
        melden(["test": true, "zeit": Date().timeIntervalSince1970])
    }
}

extension Schlaeger: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.erreichbar = session.isReachable }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.erreichbar = session.isReachable }
    }
}
