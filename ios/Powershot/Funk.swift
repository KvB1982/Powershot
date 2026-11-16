// Powershot – die Funkverbindung zwischen zwei Geräten.
//
// Damit wird ein iPhone zum Schläger für das Spiel auf dem iPad (oder auf einem anderen iPhone):
//   • Das Gerät mit dem Spiel sagt in die Runde: "Hier läuft Powershot!"
//   • Das Gerät im Schläger-Modus sucht danach und verbindet sich von selbst.
//   • Dann schickt der Schläger 60-mal pro Sekunde, wie er bewegt wird und welche Taste gedrückt ist.
// Das geht über WLAN oder Bluetooth, ganz ohne Internet (Apples "Multipeer Connectivity").

import Foundation
import MultipeerConnectivity
import UIKit

final class Funk: NSObject, ObservableObject {
    static let shared = Funk()

    /// Name des verbundenen Geräts – oder nil, wenn keines verbunden ist
    @Published var partner: String?

    private let ich = MCPeerID(displayName: UIDevice.current.name)
    /// Alle Geräte in der Nähe, auf denen Powershot läuft (nur im Schläger-Modus gefüllt)
    @Published var gefunden: [MCPeerID] = []

    // Der Name des Funkkanals. Simulatoren auf dem Mac bekommen einen eigenen Kanal,
    // damit sich ein echtes iPhone nie versehentlich mit einem Simulator verbindet.
    #if targetEnvironment(simulator)
    private let dienst = "powershot-sim"
    #else
    private let dienst = "powershot"
    #endif
    // Mit welchem Gerät waren wir zuletzt verbunden? Das nehmen wir beim nächsten Mal wieder.
    private let merkSchluessel = "schlaegerZiel"
    private lazy var sitzung: MCSession = neueSitzung()

    /// Eine frische Verbindung. Nach einem Abbruch nehmen wir immer eine neue – die alte lässt sich nicht gut wiederverwenden.
    private func neueSitzung() -> MCSession {
        let s = MCSession(peer: ich, securityIdentity: nil, encryptionPreference: .required)
        s.delegate = self
        return s
    }
    private lazy var rufer = MCNearbyServiceAdvertiser(peer: ich, discoveryInfo: nil, serviceType: dienst)
    private lazy var sucher = MCNearbyServiceBrowser(peer: ich, serviceType: dienst)

    // Das Letzte, was der Schläger geschickt hat, und wann
    private var letzte: [String: Any] = [:]
    private var letzteZeit = Date.distantPast
    private let schloss = NSLock()
    // (Schläger) Welches Spiel-Gerät haben wir gerade eingeladen? Jedes nur einmal, sonst kommt die Verbindung durcheinander.
    private var eingeladen: MCPeerID?

    /// Dieses Gerät zeigt das Spiel: auf einen Schläger warten.
    func alsSpielStarten() {
        sucher.stopBrowsingForPeers()
        rufer.delegate = self
        rufer.startAdvertisingPeer()
    }

    /// Dieses Gerät ist der Schläger: ein Spiel in der Nähe suchen.
    func alsSchlaegerStarten() {
        rufer.stopAdvertisingPeer()
        sitzung.disconnect()
        sitzung = neueSitzung()
        eingeladen = nil
        gefunden = []
        sucher.delegate = self
        sucher.startBrowsingForPeers()
    }

    /// Schläger-Modus beenden, wieder normales Spiel-Gerät sein.
    func schlaegerBeenden() {
        sitzung.disconnect()
        sitzung = neueSitzung()
        alsSpielStarten()
    }

    /// (Schläger) Den aktuellen Zustand an das Spiel schicken.
    func schicken(_ zustand: [String: Any]) {
        guard !sitzung.connectedPeers.isEmpty,
              let daten = try? JSONSerialization.data(withJSONObject: zustand) else { return }
        // "unreliable" = schnell statt sicher: Geht ein Päckchen verloren, kommt gleich das nächste.
        try? sitzung.send(daten, toPeers: sitzung.connectedPeers, with: .unreliable)
    }

    /// (Spiel) Was hat der Schläger zuletzt gemeldet? nil, wenn seit einer halben Sekunde nichts kam.
    func vomSchlaeger() -> [String: Any]? {
        schloss.lock(); defer { schloss.unlock() }
        return Date().timeIntervalSince(letzteZeit) < 0.5 ? letzte : nil
    }
}

extension Funk: MCSessionDelegate {
    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            guard session === self.sitzung else { return }       // Meldungen einer alten Verbindung überhören
            self.partner = session.connectedPeers.first?.displayName
            // Hat es nicht geklappt oder ist die Verbindung weg? Dann mit frischer Verbindung von vorn anfangen.
            guard state == .notConnected, session.connectedPeers.isEmpty else { return }
            self.sitzung = self.neueSitzung()
            self.eingeladen = nil
            if Spiel.shared.schlaegerModus {                     // Schläger: neu suchen
                self.gefunden = []
                self.sucher.stopBrowsingForPeers()
                self.sucher.startBrowsingForPeers()
            } else {                                             // Spiel: wieder auf einen Schläger warten
                self.rufer.stopAdvertisingPeer()
                self.rufer.startAdvertisingPeer()
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        guard let zustand = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        schloss.lock()
        letzte = zustand
        letzteZeit = Date()
        schloss.unlock()
    }

    // Diese drei braucht Apple, wir benutzen sie nicht.
    func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

extension Funk: MCNearbyServiceAdvertiserDelegate {
    // (Spiel) Ein Schläger will sich verbinden: annehmen, wenn noch keiner da ist.
    func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID,
                    withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(sitzung.connectedPeers.isEmpty, sitzung)
    }
}

extension Funk: MCNearbyServiceBrowserDelegate {
    // (Schläger) Ein Spiel gefunden: in die Liste aufnehmen und – wenn klar ist, welches gemeint ist – verbinden.
    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        DispatchQueue.main.async {
            if !self.gefunden.contains(peerID) { self.gefunden.append(peerID) }
            // Das Gerät vom letzten Mal nehmen wir sofort wieder.
            if peerID.displayName == UserDefaults.standard.string(forKey: self.merkSchluessel) {
                self.verbinden(mit: peerID)
                return
            }
            // Sonst kurz warten: Gibt es nur ein einziges Gerät, verbinden wir uns von selbst.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                if self.gefunden.count == 1, let einziges = self.gefunden.first { self.verbinden(mit: einziges) }
            }
        }
    }

    /// (Schläger) Mit genau diesem Gerät verbinden – von selbst oder weil es angetippt wurde.
    func verbinden(mit peer: MCPeerID, gewaehlt: Bool = false) {
        if gewaehlt { UserDefaults.standard.set(peer.displayName, forKey: merkSchluessel) }
        if sitzung.connectedPeers.contains(peer) { return }
        if eingeladen != nil && !gewaehlt { return }               // es läuft schon eine Einladung
        if !sitzung.connectedPeers.isEmpty || eingeladen != nil {   // erst die alte Verbindung lösen
            sitzung.disconnect()
            sitzung = neueSitzung()
            partner = nil
        }
        eingeladen = peer
        sucher.invitePeer(peer, to: sitzung, withContext: nil, timeout: 15)
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
        DispatchQueue.main.async {
            self.gefunden.removeAll { $0 == peerID }
            if peerID == self.eingeladen, self.sitzung.connectedPeers.isEmpty { self.eingeladen = nil }
        }
    }
}
