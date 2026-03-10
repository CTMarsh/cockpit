import Foundation
import LocalAuthentication
@preconcurrency import WatchConnectivity

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?
    @Published var biometricsAvailable = false

    var faceIDEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "faceIDEnabled") }
        set {
            UserDefaults.standard.set(newValue, forKey: "faceIDEnabled")
            objectWillChange.send()
        }
    }

    private let api = APIClient.shared

    private init() {
        checkBiometrics()
    }

    // MARK: - Biometrics

    func checkBiometrics() {
        let context = LAContext()
        var authError: NSError?
        biometricsAvailable = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &authError
        )
    }

    var hasSavedCredentials: Bool {
        KeychainHelper.loadCredentials() != nil
    }

    // MARK: - Login

    func login(username: String, password: String, remember: Bool = true) async {
        isLoading = true
        error = nil

        do {
            try await api.login(username: username, password: password)
            isAuthenticated = true

            if remember {
                KeychainHelper.saveCredentials(username: username, password: password)
                // Auto-enable Face ID on first credential save
                if biometricsAvailable && !UserDefaults.standard.bool(forKey: "faceIDConfigured") {
                    faceIDEnabled = true
                    UserDefaults.standard.set(true, forKey: "faceIDConfigured")
                }
                // Send credentials to paired Apple Watch
                syncCredentialsToWatch(username: username, password: password)
            }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func loginWithBiometrics() async {
        guard let credentials = KeychainHelper.loadCredentials() else {
            error = "No saved credentials. Please log in manually first."
            return
        }

        let context = LAContext()
        context.localizedReason = "Log in to Cockpit"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Log in to Cockpit"
            )
            if success {
                await login(username: credentials.username, password: credentials.password)
            }
        } catch {
            self.error = "Biometric authentication failed."
        }
    }

    // MARK: - Session

    func checkSession() async {
        isLoading = true
        let valid = await api.checkSession()
        isAuthenticated = valid

        // Auto-login with saved credentials if session expired
        if !valid, let credentials = KeychainHelper.loadCredentials() {
            await login(username: credentials.username, password: credentials.password)
        }

        isLoading = false
    }

    func logout() async {
        await api.logout()
        isAuthenticated = false
    }

    // MARK: - Watch Sync

    private func syncCredentialsToWatch(username: String, password: String) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.activationState == .activated, session.isPaired {
            try? session.updateApplicationContext([
                "cockpit_username": username,
                "cockpit_password": password
            ])
        }
    }
}
