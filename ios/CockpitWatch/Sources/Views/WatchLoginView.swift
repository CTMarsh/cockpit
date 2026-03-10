import SwiftUI

struct WatchLoginView: View {
    @EnvironmentObject var api: WatchAPIClient
    @State private var showQR = true

    var body: some View {
        if showQR {
            WatchQRLoginView()
                .toolbar {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Type Password") {
                            showQR = false
                        }
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                    }
                }
        } else {
            WatchPasswordLoginView()
                .toolbar {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Use QR Code") {
                            showQR = true
                        }
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                    }
                }
        }
    }
}

struct WatchPasswordLoginView: View {
    @EnvironmentObject var api: WatchAPIClient
    @State private var username = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: "lock.shield")
                    .font(.title2)
                    .foregroundStyle(Theme.accent)

                Text("Cockpit")
                    .font(.headline)
                    .foregroundStyle(Theme.text)

                TextField("Username", text: $username)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                SecureField("Password", text: $password)
                    .textContentType(.password)

                if let error {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await login() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Sign In")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .disabled(username.isEmpty || password.isEmpty || isLoading)
            }
            .padding(.horizontal, 4)
        }
        .containerBackground(Theme.background, for: .navigation)
    }

    private func login() async {
        isLoading = true
        error = nil

        do {
            try await api.login(username: username, password: password)
            KeychainHelper.saveCredentials(username: username, password: password)
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = "Cannot reach server"
        }

        isLoading = false
    }
}
