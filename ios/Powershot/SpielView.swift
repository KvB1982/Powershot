// Powershot – das Fenster, in dem das Spiel läuft (ein "WKWebView", also ein eingebauter Browser).
//
// Ein Browser darf Dateien aus dem App-Paket nicht einfach so als Programm-Module laden.
// Deshalb gibt es hier einen kleinen "Datei-Ausgeber" (SpielDateien): Das Spiel fragt nach
// powershot://spiel/js/app.js, und der Ausgeber reicht die passende Datei aus dem Ordner "web" heraus.

import SwiftUI
import WebKit

struct SpielView: UIViewRepresentable {
    // Der "Merker" hält die Controller-Brücke fest, solange das Fenster lebt.
    final class Merker { var controller: ControllerBruecke? }
    func makeCoordinator() -> Merker { Merker() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(SpielDateien(), forURLScheme: "powershot")
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []      // Ton darf sofort spielen

        let web = WKWebView(frame: .zero, configuration: config)
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
        context.coordinator.controller = ControllerBruecke(web: web)   // Switch-Controller ans Spiel anschließen
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}
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
