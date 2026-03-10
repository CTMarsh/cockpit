import Foundation
@preconcurrency import WatchConnectivity

@MainActor
final class WatchConnectivityManager: NSObject, ObservableObject {
    @Published var isPhoneReachable = false
    @Published var lastSyncData: [String: Data] = [:]

    private let session: WCSession

    override init() {
        if WCSession.isSupported() {
            session = WCSession.default
        } else {
            session = WCSession.default
        }
        super.init()
        if WCSession.isSupported() {
            session.delegate = self
            session.activate()
        }
    }

    /// When the phone is not reachable, use direct API calls instead
    var useDirectAPI: Bool {
        !isPhoneReachable
    }

    /// Request fresh data from the paired iPhone for a specific module
    func requestUpdate(for module: String) {
        guard isPhoneReachable else { return }
        session.sendMessage(
            ["request": module],
            replyHandler: { reply in
                let data = try? JSONSerialization.data(withJSONObject: reply)
                Task { @MainActor in
                    if let data {
                        self.lastSyncData[module] = data
                    }
                }
            },
            errorHandler: { _ in
                Task { @MainActor in
                    self.isPhoneReachable = false
                }
            }
        )
    }

    /// Send a command to the iPhone (e.g., wake a device, restart a container)
    func sendCommand(_ command: String, payload: [String: Any] = [:]) {
        guard isPhoneReachable else { return }
        var message = payload
        message["command"] = command
        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }
}

// MARK: - WCSessionDelegate (nonisolated for Swift 6 compliance)

extension WatchConnectivityManager: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let reachable = session.isReachable
        Task { @MainActor in
            self.isPhoneReachable = reachable
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in
            self.isPhoneReachable = reachable
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        // Handle credential transfer from iPhone
        if let username = applicationContext["cockpit_username"] as? String,
           let password = applicationContext["cockpit_password"] as? String {
            Task { @MainActor in
                KeychainHelper.saveCredentials(username: username, password: password)
                // Auto-login with the received credentials
                if !WatchAPIClient.shared.isAuthenticated {
                    await WatchAPIClient.shared.loginFromKeychain()
                }
            }
        }

        for (key, value) in applicationContext {
            guard !key.hasPrefix("cockpit_") else { continue }
            let data = try? JSONSerialization.data(withJSONObject: value)
            Task { @MainActor in
                if let data {
                    self.lastSyncData[key] = data
                }
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        if let module = message["module"] as? String,
           let payload = message["data"] {
            let data = try? JSONSerialization.data(withJSONObject: payload)
            Task { @MainActor in
                if let data {
                    self.lastSyncData[module] = data
                }
            }
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        if let module = message["module"] as? String,
           let payload = message["data"] {
            let data = try? JSONSerialization.data(withJSONObject: payload)
            Task { @MainActor in
                if let data {
                    self.lastSyncData[module] = data
                }
            }
        }
        replyHandler(["received": true])
    }
}
