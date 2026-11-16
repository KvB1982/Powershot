// Powershot – die iOS-App.
//
// Die App ist nur eine dünne Hülle: Sie zeigt ein einziges Fenster, und darin läuft das Spiel
// genau so wie im Browser (HTML, CSS, JavaScript). Die Spieldateien stecken im App-Paket,
// deshalb braucht die App kein Internet.

import SwiftUI

@main
struct PowershotApp: App {
    @UIApplicationDelegateAdaptor(AppStart.self) private var appStart
    @StateObject private var spiel = Spiel.shared

    var body: some Scene {
        WindowGroup {
            ZStack {
                Color(red: 0.043, green: 0.063, blue: 0.125)
                SpielView(aufFernseher: spiel.aufFernseher)
                if spiel.aufFernseher { FernseherHinweis() }
                if spiel.schlaegerModus { SchlaegerView() }       // dieses Gerät ist gerade nur der Schläger
            }
            .ignoresSafeArea()                         // das Spiel füllt den ganzen Bildschirm
            .statusBarHidden(true)                     // keine Uhr und kein Akku über dem Spiel
            .persistentSystemOverlays(.hidden)         // der Strich am unteren Rand blendet sich aus
            .defersSystemGestures(on: .all)            // Wischen vom Rand gehört zuerst dem Spiel
        }
    }
}

/// Das sieht man auf dem iPad/iPhone, während das Spiel auf dem Fernseher läuft.
struct FernseherHinweis: View {
    var body: some View {
        VStack(spacing: 18) {
            Text("📺").font(.system(size: 80))
            Text("Powershot läuft auf dem Fernseher").font(.title.bold())
            Text("Spiele und bediene die Menüs mit dem Controller:\nStick = auswählen · A = drücken · B = zurück")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Lieber hier weiterspielen") { Fernseher.zurueckAufsGeraet() }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.91, green: 0.94, blue: 0.29))
                .foregroundStyle(.black)
                .padding(.top, 8)
        }
        .foregroundStyle(.white)
        .padding()
    }
}
