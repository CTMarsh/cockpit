import SwiftUI

struct LoginView: View {
    @ObservedObject private var auth = AuthService.shared

    @State private var username = ""
    @State private var password = ""

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Logo area
                VStack(spacing: 12) {
                    Image(systemName: "helm")
                        .font(.system(size: 64))
                        .foregroundStyle(Theme.accent)

                    Text("Cockpit")
                        .font(.largeTitle.bold())
                        .foregroundStyle(Theme.text)

                    Text("Homelab Dashboard")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textMuted)
                }

                // Login form
                VStack(spacing: 16) {
                    TextField("Username", text: $username)
                        .textFieldStyle(.plain)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Theme.border, lineWidth: 1)
                        )
                        .foregroundStyle(Theme.text)

                    SecureField("Password", text: $password)
                        .textFieldStyle(.plain)
                        .textContentType(.password)
                        .padding(14)
                        .background(Theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Theme.border, lineWidth: 1)
                        )
                        .foregroundStyle(Theme.text)

                    if let error = auth.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                    }

                    Button {
                        Task { await auth.login(username: username, password: password) }
                    } label: {
                        if auth.isLoading {
                            ProgressView()
                                .tint(Theme.background)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                        } else {
                            Text("Sign In")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                        }
                    }
                    .background(Theme.accent)
                    .foregroundStyle(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .disabled(username.isEmpty || password.isEmpty || auth.isLoading)

                    if auth.biometricsAvailable && auth.hasSavedCredentials {
                        Button {
                            Task { await auth.loginWithBiometrics() }
                        } label: {
                            Label("Sign in with Face ID", systemImage: "faceid")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                        }
                        .background(Theme.surface)
                        .foregroundStyle(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Theme.border, lineWidth: 1)
                        )
                    }
                }
                .padding(.horizontal, 32)

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            // Try auto-login with biometrics on appear
            if auth.biometricsAvailable && auth.hasSavedCredentials {
                Task { await auth.loginWithBiometrics() }
            }
        }
    }
}
