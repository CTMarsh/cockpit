import SwiftUI

struct WatchAlertsView: View {
    @State private var alerts: [AlertHistory] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .tint(Theme.accent)
            } else if let error {
                VStack(spacing: 8) {
                    Image(systemName: "bell.slash")
                        .font(.title3)
                        .foregroundStyle(Theme.danger)
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
            } else if alerts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "bell.slash")
                        .font(.title3)
                        .foregroundStyle(Theme.textMuted)
                    Text("No recent alerts")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            } else {
                List {
                    ForEach(alerts) { alert in
                        alertRow(alert)
                    }
                }
                .listStyle(.carousel)
            }
        }
        .navigationTitle("Alerts")
        .containerBackground(Theme.background, for: .navigation)
        .task { await fetchData() }
        .refreshable { await fetchData() }
    }

    // MARK: - Alert Row

    private func alertRow(_ alert: AlertHistory) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: alertIcon(for: alert.metricType))
                    .font(.caption2)
                    .foregroundStyle(alertColor(for: alert.metricType))

                Text(alert.ruleName)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
            }

            Text(alert.message)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
                .lineLimit(2)

            Text(relativeTime(from: alert.firedAt))
                .font(.caption2)
                .foregroundStyle(Theme.textMuted.opacity(0.7))
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Helpers

    private func alertIcon(for metricType: String) -> String {
        switch metricType {
        case "cpu": return "cpu"
        case "memory": return "memorychip"
        case "disk": return "externaldrive"
        case "service": return "server.rack"
        default: return "exclamationmark.triangle"
        }
    }

    private func alertColor(for metricType: String) -> Color {
        switch metricType {
        case "cpu", "memory", "disk": return Theme.warning
        case "service": return Theme.danger
        default: return Theme.info
        }
    }

    private func relativeTime(from dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateString) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: dateString) else {
                return dateString
            }
            return formatRelative(date)
        }
        return formatRelative(date)
    }

    private func formatRelative(_ date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "Just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }

    // MARK: - Data Fetching

    private func fetchData() async {
        isLoading = true
        error = nil
        do {
            let response: AlertHistoryResponse = try await WatchAPIClient.shared.request(path: "/api/alerts/history?limit=20")
            alerts = response.history
        } catch {
            self.error = "Cannot load alerts"
        }
        isLoading = false
    }
}
