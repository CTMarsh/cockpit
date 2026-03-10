import SwiftUI

/// Compact alerts page for vertical TabView — single screen, no scroll.
struct WatchAlertsPage: View {
    @State private var alerts: [AlertHistory] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 8) {
            if isLoading {
                Spacer()
                ProgressView().tint(Theme.accent)
                Spacer()
            } else if let error {
                Spacer()
                Image(systemName: "bell.slash")
                    .font(.title3)
                    .foregroundStyle(Theme.danger)
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                Spacer()
            } else if alerts.isEmpty {
                Spacer()
                Image(systemName: "bell.slash")
                    .font(.title2)
                    .foregroundStyle(Theme.textMuted)
                Text("No recent alerts")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
            } else {
                // Header
                HStack {
                    Text("Alerts")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Text("\(alerts.count)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.warning)
                }

                // Show first 3 alerts
                ForEach(alerts.prefix(3)) { alert in
                    HStack(spacing: 6) {
                        Image(systemName: alertIcon(for: alert.metricType))
                            .font(.system(size: 9))
                            .foregroundStyle(alertColor(for: alert.metricType))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(alert.ruleName)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Text(relativeTime(from: alert.firedAt))
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.textMuted)
                        }
                        Spacer()
                    }
                }

                if alerts.count > 3 {
                    NavigationLink(destination: WatchAlertsView()) {
                        HStack {
                            Text("All \(alerts.count) alerts")
                                .font(.caption2)
                                .foregroundStyle(Theme.accent)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 8)
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchData() }
    }

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
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: dateString) else { return dateString }
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

    private func fetchData() async {
        isLoading = true
        do {
            let r: AlertHistoryResponse = try await WatchAPIClient.shared.request(path: "/api/alerts/history?limit=20")
            alerts = r.history
        } catch {
            self.error = "Cannot load alerts"
        }
        isLoading = false
    }
}
