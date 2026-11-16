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

    private let bewegung = CMMotionManager()
    private let gesundheit = HKHealthStore()
    private var training: HKWorkoutSession?
    private var startNummer = 0

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

        if !aktiv {
            guard stark >= schwungStart, jetzt - ende >= schwungPause else { return }
            aktiv = true; beginn = jetzt; staerkster = stark; hoch = nachOben
            return
        }
        if stark > staerkster { staerkster = stark; hoch = nachOben }
        guard jetzt - beginn >= 0.06 else { return }             // nur 0,06 Sekunden lang den stärksten Wert suchen – die Meldung soll schnell raus
        aktiv = false; ende = jetzt

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
