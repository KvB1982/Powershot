// Powershot – Spielen auf dem Fernseher (AirPlay auf Apple TV oder ein Bildschirm am Kabel).
//
// Sobald ein zweiter Bildschirm verbunden ist UND ein Controller gekoppelt ist, zieht das Spiel auf den
// Fernseher um und füllt ihn ganz aus. Das iPad/iPhone zeigt dann nur einen Hinweis.
// Ohne Controller bleibt das Spiel auf dem Gerät – dann zeigt der Fernseher einfach dasselbe Bild (Spiegelung),
// denn tippen kann man ja nur auf dem Gerät.

import GameController
import UIKit

/// Wird beim Start der App gefragt, wie ein neuer Bildschirm eingerichtet werden soll.
final class AppStart: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let plan = UISceneConfiguration(name: nil, sessionRole: session.role)
        if session.role == .windowExternalDisplayNonInteractive { plan.delegateClass = Fernseher.self }
        return plan
    }
}

/// Kümmert sich um den zweiten Bildschirm.
final class Fernseher: UIResponder, UIWindowSceneDelegate {
    private static weak var aktiv: Fernseher?
    private var szene: UIWindowScene?
    var window: UIWindow?
    private var willNicht = false          // "Lieber hier weiterspielen" wurde gedrückt

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        szene = scene as? UIWindowScene
        Fernseher.aktiv = self
        // Wird später ein Controller gekoppelt, ziehen wir dann um.
        NotificationCenter.default.addObserver(self, selector: #selector(pruefen),
                                               name: .GCControllerDidConnect, object: nil)
        pruefen()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        NotificationCenter.default.removeObserver(self)
        zurueck()
    }

    /// Umziehen, wenn ein Fernseher da ist, ein Controller gekoppelt ist und niemand "lieber hier" gesagt hat.
    @objc private func pruefen() {
        guard let szene, window == nil, !willNicht, !GCController.controllers().isEmpty else { return }
        let fenster = UIWindow(windowScene: szene)
        let inhalt = UIViewController()
        inhalt.view.backgroundColor = .black
        fenster.rootViewController = inhalt
        fenster.isHidden = false
        window = fenster
        Spiel.shared.einsetzen(in: inhalt.view)
        Spiel.shared.aufFernseher = true
    }

    /// Das Spiel wieder auf dem iPad/iPhone zeigen. Der Fernseher spiegelt danach wieder das Gerät.
    private func zurueck() {
        window?.isHidden = true
        window = nil
        Spiel.shared.aufFernseher = false      // dadurch setzt SpielView das Spiel wieder auf dem Gerät ein
    }

    static func zurueckAufsGeraet() {
        aktiv?.willNicht = true
        aktiv?.zurueck()
        if aktiv == nil { Spiel.shared.aufFernseher = false }
    }
}
