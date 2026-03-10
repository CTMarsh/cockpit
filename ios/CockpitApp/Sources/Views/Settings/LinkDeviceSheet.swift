import SwiftUI

struct LinkDeviceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var isApproving = false
    @State private var isApproved = false
    @State private var error: String?

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 24) {
                    if isApproved {
                        approvedView
                    } else {
                        inputView
                    }
                }
                .padding(24)
            }
            .navigationTitle("Link Device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
    }

    // MARK: - Input View

    private var inputView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "applewatch.and.arrow.forward")
                .font(.system(size: 56))
                .foregroundStyle(Theme.accent)

            VStack(spacing: 8) {
                Text("Link Your Apple Watch")
                    .font(.title2.bold())
                    .foregroundStyle(Theme.text)

                Text("Enter the 6-character code shown on your Apple Watch to sign it in.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
            }

            // Code input
            TextField("ABC123", text: $code)
                .font(.system(size: 32, weight: .bold, design: .monospaced))
                .multilineTextAlignment(.center)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(16)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Theme.border, lineWidth: 1)
                )
                .foregroundStyle(Theme.text)
                .onChange(of: code) { _, newValue in
                    // Uppercase and limit to 6 chars
                    let filtered = String(newValue.uppercased().prefix(6))
                    if filtered != newValue {
                        code = filtered
                    }
                }

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Theme.danger)
            }

            Button {
                Task { await approve() }
            } label: {
                if isApproving {
                    ProgressView()
                        .tint(Theme.background)
                        .frame(maxWidth: .infinity)
                        .padding(14)
                } else {
                    Text("Approve")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(14)
                }
            }
            .background(code.count == 6 ? Theme.accent : Theme.accent.opacity(0.4))
            .foregroundStyle(Theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .disabled(code.count != 6 || isApproving)

            Spacer()
            Spacer()
        }
    }

    // MARK: - Approved View

    private var approvedView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(Theme.success)

            VStack(spacing: 8) {
                Text("Device Linked")
                    .font(.title2.bold())
                    .foregroundStyle(Theme.text)

                Text("Your Apple Watch is now signed in to Cockpit.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textMuted)
                    .multilineTextAlignment(.center)
            }

            Button {
                dismiss()
            } label: {
                Text("Done")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(14)
            }
            .background(Theme.accent)
            .foregroundStyle(Theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            Spacer()
            Spacer()
        }
    }

    // MARK: - Approve

    private func approve() async {
        isApproving = true
        error = nil

        do {
            let _: ApproveResponse = try await api.request(
                path: "/api/auth/device-code/\(code)/approve",
                method: "POST"
            )
            isApproved = true
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = "Failed to approve device."
        }

        isApproving = false
    }
}

private struct ApproveResponse: Decodable {
    let ok: Bool
}
