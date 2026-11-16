// Powershot – die iOS-App.
//
// Die App ist nur eine dünne Hülle: Sie zeigt ein einziges Fenster, und darin läuft das Spiel
// genau so wie im Browser (HTML, CSS, JavaScript). Die Spieldateien stecken im App-Paket,
// deshalb braucht die App kein Internet.

import SwiftUI

@main
struct PowershotApp: App {
    var body: some Scene {
        WindowGroup {
            SpielView()
                .ignoresSafeArea()                         // das Spiel füllt den ganzen Bildschirm
                .background(Color(red: 0.043, green: 0.063, blue: 0.125))
                .statusBarHidden(true)                     // keine Uhr und kein Akku über dem Spiel
                .persistentSystemOverlays(.hidden)         // der Strich am unteren Rand blendet sich aus
                .defersSystemGestures(on: .all)            // Wischen vom Rand gehört zuerst dem Spiel
        }
    }
}
