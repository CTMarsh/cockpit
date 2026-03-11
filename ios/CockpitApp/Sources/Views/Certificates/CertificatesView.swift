import SwiftUI

struct CertificatesView: View {
    @ObservedObject private var service = CertificateService.shared
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Certificates").tag(0)
                Text("Issuers").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if service.isLoading && service.certificates.isEmpty {
                LoadingView()
            } else {
                if selectedTab == 0 {
                    certificatesList
                } else {
                    issuersList
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("Certificates")
        .refreshable {
            await service.refresh()
        }
        .task {
            await service.refresh()
        }
    }

    private var certificatesList: some View {
        List {
            ForEach(service.certificates) { cert in
                CertificateRow(cert: cert)
                    .listRowBackground(Theme.surface)
                    .listRowSeparatorTint(Theme.border)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }

    private var issuersList: some View {
        List {
            ForEach(service.issuers) { issuer in
                IssuerRow(issuer: issuer)
                    .listRowBackground(Theme.surface)
                    .listRowSeparatorTint(Theme.border)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

// MARK: - Certificate Row

private struct CertificateRow: View {
    let cert: Certificate

    private var expiryColor: Color {
        guard let days = cert.daysUntilExpiry else { return Theme.textMuted }
        if days < 7 { return Theme.danger }
        if days <= 30 { return Theme.warning }
        return Theme.success
    }

    private var expiryText: String {
        guard let days = cert.daysUntilExpiry else { return "Unknown" }
        if days < 0 { return "Expired" }
        return "\(days)d"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(cert.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(cert.namespace)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    StatusBadge(
                        text: cert.ready ? "Ready" : "Not Ready",
                        color: cert.ready ? Theme.success : Theme.danger
                    )
                    Text(expiryText)
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(expiryColor)
                }
            }

            if !cert.dnsNames.isEmpty {
                Text(cert.dnsNames.joined(separator: ", "))
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textMuted)
                    .lineLimit(2)
            }

            HStack(spacing: 12) {
                Label(cert.issuerName, systemImage: "building.columns")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)

                if let msg = cert.message, !msg.isEmpty, !cert.ready {
                    Label(msg, systemImage: "exclamationmark.triangle")
                        .font(.caption2)
                        .foregroundStyle(Theme.warning)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Issuer Row

private struct IssuerRow: View {
    let issuer: CertIssuer

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(issuer.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)

                HStack(spacing: 8) {
                    Label(issuer.kind, systemImage: "key")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)

                    if let email = issuer.email {
                        Label(email, systemImage: "envelope")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                }

                if let server = issuer.server {
                    Text(server)
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            StatusBadge(
                text: issuer.ready ? "Ready" : "Not Ready",
                color: issuer.ready ? Theme.success : Theme.danger
            )
        }
        .padding(.vertical, 4)
    }
}
