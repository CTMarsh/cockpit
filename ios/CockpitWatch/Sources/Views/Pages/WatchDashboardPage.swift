import SwiftUI

/// Compact dashboard page for vertical TabView — no ScrollView.
/// Tapping each card navigates to the full detail view.
struct WatchDashboardPage: View {
    @State private var services: ServiceSummary?
    @State private var cluster: ClusterMetrics?
    @State private var alertCount: Int = 0
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 6) {
            if isLoading {
                Spacer()
                ProgressView()
                    .tint(Theme.accent)
                Text("Loading...")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
            } else if let error {
                Spacer()
                Image(systemName: "wifi.slash")
                    .font(.title3)
                    .foregroundStyle(Theme.danger)
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                    .multilineTextAlignment(.center)
                Spacer()
            } else {
                // Service health card
                NavigationLink(destination: WatchServicesView()) {
                    serviceCard
                }
                .buttonStyle(.plain)

                // Cluster card
                NavigationLink(destination: WatchClusterView()) {
                    clusterCard
                }
                .buttonStyle(.plain)

                // Alerts card
                NavigationLink(destination: WatchAlertsView()) {
                    alertCard
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchAll() }
    }

    // MARK: - Cards

    private var serviceCard: some View {
        HStack(spacing: 6) {
            let up = services?.up ?? 0
            let total = services?.total ?? 0
            let allUp = (services?.down ?? 0) == 0

            Circle()
                .fill(allUp ? Theme.success : Theme.danger)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 1) {
                Text("Services")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                Text("\(up)/\(total) Up")
                    .font(.footnote)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.text)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var clusterCard: some View {
        HStack(spacing: 6) {
            Image(systemName: "cpu")
                .font(.caption)
                .foregroundStyle(Theme.accent)

            if let cluster, cluster.configured {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Cluster")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)

                    HStack(spacing: 8) {
                        Text("CPU \(cluster.cpu.map { "\(Int($0.usedPercent))%" } ?? "--")")
                            .font(.caption2)
                            .foregroundStyle(Theme.text)
                        Text("Mem \(cluster.memory.map { "\(Int($0.percent))%" } ?? "--")")
                            .font(.caption2)
                            .foregroundStyle(Theme.text)
                    }
                }
            } else {
                Text("Cluster")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var alertCard: some View {
        HStack(spacing: 6) {
            Image(systemName: alertCount > 0 ? "bell.badge.fill" : "bell.fill")
                .font(.caption)
                .foregroundStyle(alertCount > 0 ? Theme.warning : Theme.textMuted)

            VStack(alignment: .leading, spacing: 1) {
                Text("Alerts")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                Text(alertCount > 0 ? "\(alertCount) Recent" : "None")
                    .font(.footnote)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.text)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Data

    private func fetchAll() async {
        isLoading = true
        error = nil

        async let s: Void = fetchServices()
        async let c: Void = fetchCluster()
        async let a: Void = fetchAlerts()

        _ = await (s, c, a)
        isLoading = false
    }

    private func fetchServices() async {
        do {
            let r: ServicesResponse = try await WatchAPIClient.shared.request(path: "/api/homelab/services")
            services = r.summary
        } catch {
            self.error = "Cannot reach server"
        }
    }

    private func fetchCluster() async {
        do {
            let r: ClusterMetrics = try await WatchAPIClient.shared.request(path: "/api/sysmon/cluster")
            cluster = r
        } catch { /* non-critical */ }
    }

    private func fetchAlerts() async {
        do {
            let r: AlertHistoryResponse = try await WatchAPIClient.shared.request(path: "/api/alerts/history?limit=10")
            alertCount = r.history.count
        } catch { /* non-critical */ }
    }
}
