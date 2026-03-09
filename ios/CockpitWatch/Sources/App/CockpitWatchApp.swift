import SwiftUI

@main
struct CockpitWatchApp: App {
    @StateObject private var connectivity = WatchConnectivityManager()
    @StateObject private var api = WatchAPIClient.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connectivity)
                .environmentObject(api)
                .task {
                    // Authenticate on launch using shared Keychain credentials
                    if !api.isAuthenticated {
                        let hasSession = await api.checkSession()
                        if !hasSession {
                            await api.loginFromKeychain()
                        }
                    }
                }
        }
    }
}
