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
                    // Try existing session first, then auto-login from watch's local Keychain
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
