import SwiftUI

struct SettingsView: View {
    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var api = APIClient.shared

    @AppStorage("server_url") private var serverURL = "https://dashboard.noahsark.me"
    @AppStorage("notifications_enabled") private var notificationsEnabled = true
    @State private var deviceToken: String = UserDefaults.standard.string(forKey: "push_device_token") ?? ""
    @State private var showingSignOutConfirm = false
    @State private var showingClearCacheConfirm = false
    @State private var cacheCleared = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }

    var body: some View {
        List {
            serverSection
            securitySection
            notificationsSection
            aboutSection
            dangerZoneSection
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Settings")
        .alert("Sign Out", isPresented: $showingSignOutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) {
                    Task { await auth.logout() }
                }
            } message: {
                Text("Are you sure you want to sign out? You will need to log in again.")
            }
            .alert("Clear Cache", isPresented: $showingClearCacheConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) {
                    CacheManager.shared.clearAll()
                    cacheCleared = true
                }
            } message: {
                Text("This will remove all cached data. The app will reload fresh data from the server.")
            }
    }

    // MARK: - Server

    private var serverSection: some View {
        Section {
            HStack {
                Image(systemName: "server.rack")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                TextField("Server URL", text: $serverURL)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .foregroundStyle(Theme.text)
            }
        } header: {
            Text("Server")
                .foregroundStyle(Theme.textMuted)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Security

    private var securitySection: some View {
        Section {
            HStack {
                Image(systemName: "faceid")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                Toggle("Face ID Login", isOn: .constant(auth.biometricsAvailable && auth.hasSavedCredentials))
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.text)
            }

            if !auth.biometricsAvailable {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundStyle(Theme.textMuted)
                        .frame(width: 24)
                    Text("Face ID is not available on this device.")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            }
        } header: {
            Text("Security")
                .foregroundStyle(Theme.textMuted)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Push Notifications

    private var notificationsSection: some View {
        Section {
            HStack {
                Image(systemName: "bell.badge")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                Toggle("Push Notifications", isOn: $notificationsEnabled)
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.text)
            }

            if !deviceToken.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Device Token")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                    Text(deviceToken)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)
                }
            }
        } header: {
            Text("Push Notifications")
                .foregroundStyle(Theme.textMuted)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - About

    private var aboutSection: some View {
        Section {
            HStack {
                Image(systemName: "helm")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                Text("Cockpit iOS")
                    .foregroundStyle(Theme.text)
                Spacer()
            }

            HStack {
                Image(systemName: "tag")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                Text("Version")
                    .foregroundStyle(Theme.text)
                Spacer()
                Text(appVersion)
                    .foregroundStyle(Theme.textMuted)
            }

            HStack {
                Image(systemName: "hammer")
                    .foregroundStyle(Theme.accent)
                    .frame(width: 24)
                Text("Build")
                    .foregroundStyle(Theme.text)
                Spacer()
                Text(buildNumber)
                    .foregroundStyle(Theme.textMuted)
            }
        } header: {
            Text("About")
                .foregroundStyle(Theme.textMuted)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Danger Zone

    private var dangerZoneSection: some View {
        Section {
            Button {
                showingSignOutConfirm = true
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .frame(width: 24)
                    Text("Sign Out")
                }
                .foregroundStyle(Theme.danger)
            }

            Button {
                showingClearCacheConfirm = true
            } label: {
                HStack {
                    Image(systemName: "trash")
                        .frame(width: 24)
                    Text(cacheCleared ? "Cache Cleared" : "Clear Cache")
                }
                .foregroundStyle(cacheCleared ? Theme.success : Theme.warning)
            }
            .disabled(cacheCleared)
        } header: {
            Text("Danger Zone")
                .foregroundStyle(Theme.danger)
        }
        .listRowBackground(Theme.surface)
    }
}
