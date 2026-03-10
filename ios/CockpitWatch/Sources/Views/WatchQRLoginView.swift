import SwiftUI

struct WatchQRLoginView: View {
    @EnvironmentObject var api: WatchAPIClient
    @State private var code: String?
    @State private var isLoading = true
    @State private var error: String?
    @State private var pollTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(Theme.accent)
                    Text("Getting code...")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                } else if let error {
                    Image(systemName: "xmark.circle")
                        .font(.title3)
                        .foregroundStyle(Theme.danger)
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task { await requestCode() }
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
                } else if let code {
                    Image(systemName: "iphone.and.arrow.right.inward")
                        .font(.title2)
                        .foregroundStyle(Theme.accent)

                    // Large code display
                    Text(code)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .tracking(4)
                        .foregroundStyle(Theme.accent)

                    Text("On your iPhone, open")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textMuted)

                    Text("dashboard.noahsark.me/link")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.text)

                    Text("and enter this code")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textMuted)

                    // Countdown indicator
                    ProgressView(value: 1.0)
                        .tint(Theme.accent)
                        .padding(.top, 4)

                    Text("Expires in 5 minutes")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Link")
        .containerBackground(Theme.background, for: .navigation)
        .task {
            await requestCode()
        }
        .onDisappear {
            pollTask?.cancel()
        }
    }

    private func requestCode() async {
        isLoading = true
        error = nil
        pollTask?.cancel()

        guard let url = URL(string: "\(api.baseURL)/api/auth/device-code") else {
            error = "Invalid server URL"
            isLoading = false
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                error = "Server error"
                isLoading = false
                return
            }

            struct CodeResponse: Decodable {
                let code: String
                let expires_in: Int
            }

            let decoded = try JSONDecoder().decode(CodeResponse.self, from: data)
            code = decoded.code
            isLoading = false

            // Start polling
            pollTask = Task {
                await pollForApproval(code: decoded.code, timeout: decoded.expires_in)
            }
        } catch {
            self.error = "Cannot reach server"
            isLoading = false
        }
    }

    private func pollForApproval(code: String, timeout: Int) async {
        let deadline = Date().addingTimeInterval(TimeInterval(timeout))

        while !Task.isCancelled && Date() < deadline {
            try? await Task.sleep(for: .seconds(2))
            if Task.isCancelled { return }

            guard let url = URL(string: "\(api.baseURL)/api/auth/device-code/\(code)") else { continue }

            do {
                let (data, response) = try await api.pollRequest(url: url)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { continue }

                struct PollResponse: Decodable {
                    let status: String
                }

                let decoded = try JSONDecoder().decode(PollResponse.self, from: data)

                if decoded.status == "approved" {
                    api.isAuthenticated = true
                    return
                }

                if decoded.status == "expired" {
                    self.error = "Code expired"
                    self.code = nil
                    return
                }
            } catch {
                // Network hiccup, keep polling
            }
        }

        if !Task.isCancelled {
            self.error = "Code expired"
            self.code = nil
        }
    }
}
