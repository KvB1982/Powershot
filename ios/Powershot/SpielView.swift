// Powershot – das Fenster, in dem das Spiel läuft (ein "WKWebView", also ein eingebauter Browser).
//
// Ein Browser darf Dateien aus dem App-Paket nicht einfach so als Programm-Module laden.
// Deshalb gibt es hier einen kleinen "Datei-Ausgeber" (SpielDateien): Das Spiel fragt nach
// powershot://spiel/js/app.js, und der Ausgeber reicht die passende Datei aus dem Ordner "web" heraus.

import SwiftUI
import WebKit

/// Das Spiel gibt es genau einmal. Es kann auf dem iPad/iPhone gezeigt werden oder auf dem Fernseher.
final class Spiel: ObservableObject {
    static let shared = Spiel()

    /// true, solange das Spiel auf dem Fernseher (AirPlay) zu sehen ist
    @Published var aufFernseher = false

    /// true, solange dieses Gerät nur der Schläger für ein anderes Gerät ist
    @Published var schlaegerModus = false

    let web: WKWebView
    private var controller: ControllerBruecke?

    private init() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(SpielDateien(), forURLScheme: "powershot")
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []      // Ton darf sofort spielen
        // Das Spiel kann der App Bescheid sagen (z. B. der Knopf "Dieses Gerät als Schläger benutzen").
        config.userContentController.add(Botschaften(), name: "powershot")

        web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.043, green: 0.063, blue: 0.125, alpha: 1)
        web.scrollView.isScrollEnabled = false                    // die Seite selbst soll nicht verrutschen
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never    // wirklich bis an den Rand zeichnen
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        #if DEBUG
        web.isInspectable = true                                  // am Mac mit Safari hineinschauen (Entwickler-Menü)
        #endif
        web.load(URLRequest(url: URL(string: "powershot://spiel/index.html")!))
        controller = ControllerBruecke(web: web)                  // Switch-Controller ans Spiel anschließen
        Funk.shared.alsSpielStarten()                             // auf ein iPhone als Schläger warten
    }

    /// Setzt das Spiel-Fenster in eine Fläche ein (auf dem Gerät oder auf dem Fernseher) und füllt sie ganz aus.
    func einsetzen(in flaeche: UIView) {
        guard web.superview !== flaeche else { return }
        web.removeFromSuperview()
        web.frame = flaeche.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        flaeche.addSubview(web)
    }
}

/// Nimmt Botschaften aus dem Spiel entgegen (JavaScript: window.webkit.messageHandlers.powershot.postMessage("…")).
final class Botschaften: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.body as? String == "schlaeger" { Spiel.shared.schlaegerModus = true }
    }
}

/// Die Fläche auf dem iPad/iPhone, in der das Spiel sitzt (wenn es nicht gerade auf dem Fernseher läuft).
struct SpielView: UIViewRepresentable {
    let aufFernseher: Bool

    func makeUIView(context: Context) -> UIView { UIView() }

    func updateUIView(_ flaeche: UIView, context: Context) {
        if !aufFernseher { Spiel.shared.einsetzen(in: flaeche) }
    }
}

/// Reicht die Spieldateien aus dem App-Paket (Ordner "web") an das Spiel weiter.
final class SpielDateien: NSObject, WKURLSchemeHandler {
    private let ordner = Bundle.main.resourceURL!.appendingPathComponent("web").standardizedFileURL

    // Dateiendung -> Art der Datei. Der Browser will das wissen, sonst führt er z. B. JavaScript nicht aus.
    private let arten: [String: String] = [
        "html": "text/html; charset=utf-8", "css": "text/css; charset=utf-8",
        "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
        "json": "application/json; charset=utf-8", "webmanifest": "application/manifest+json",
        "glb": "model/gltf-binary", "mp3": "audio/mpeg", "png": "image/png", "jpg": "image/jpeg",
        "svg": "image/svg+xml", "webp": "image/webp",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var pfad = url.path
        if pfad.isEmpty || pfad == "/" { pfad = "/index.html" }
        let datei = ordner.appendingPathComponent(pfad).standardizedFileURL

        // Nur Dateien aus dem Ordner "web" herausgeben – und nur, wenn es sie gibt.
        guard datei.path.hasPrefix(ordner.path + "/"), var daten = try? Data(contentsOf: datei) else {
            antworten(task, url: url, status: 404, art: "text/plain", daten: Data())
            return
        }

        // Im Browser kommt three.js aus dem Internet. In der App liegt es im Paket (Ordner vendor/three),
        // also tauschen wir in der Startseite die Internet-Adresse gegen den Ordner im Paket.
        if pfad == "/index.html", let text = String(data: daten, encoding: .utf8) {
            let neu = text.replacingOccurrences(of: "https://cdn.jsdelivr.net/npm/three@0.160.0/", with: "./vendor/three/")
            daten = Data(neu.utf8)
        }
        let art = arten[datei.pathExtension.lowercased()] ?? "application/octet-stream"
        antworten(task, url: url, status: 200, art: art, daten: daten)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func antworten(_ task: WKURLSchemeTask, url: URL, status: Int, art: String, daten: Data) {
        let kopf = ["Content-Type": art, "Content-Length": String(daten.count), "Cache-Control": "no-store"]
        let antwort = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: kopf)!
        task.didReceive(antwort)
        task.didReceive(daten)
        task.didFinish()
    }
}
