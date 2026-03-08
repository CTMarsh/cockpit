import SwiftUI
import WatchKit

struct WatchDashboardView: View {
    @State private var services: ServiceSummary?
    @State private var cluster: ClusterMetrics?
    @State private var alertCount: Int = 0
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    if isLoading {
                        ProgressView()
                            .tint(Theme.accent)
                    } else if let error {
                        Text(error)
                            .font(.caption2)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                    } else {
                        serviceCard
                        clusterCard
                        alertCard
                    }
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("Cockpit")
            .containerBackground(Theme.background, for: .navigation)
        }
        .task { await fetchAll() }
        .refreshable { await fetchAll() }
    }

    // MARK: - Service Health Card

    private var serviceCard: some View {
        NavigationLink(destination: WatchServicesView()) {
            HStack(spacing: 6) {
                let up = services?.up ?? 0
                let total = services?.total ?? 0
                let allUp = (services?.down ?? 0) == 0

                Circle()
                    .fill(allUp ? Theme.success : Theme.danger)
                    .frame(width: 10, height: 10)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Services")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                    Text("\(up)/\(total) Up")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                }

                Spacer()
            }
            .padding(8)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Cluster Card

    private var clusterCard: some View {
        NavigationLink(destination: WatchClusterView()) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Cluster")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)

                if let cluster, cluster.configured {
                    HStack(spacing: 12) {
                        metricColumn(
                            label: "CPU",
                            value: cluster.cpu.map { "\(Int($0.usedPercent))%" } ?? "--"
                        )
                        metricColumn(
                            label: "Mem",
                            value: cluster.memory.map { "\(Int($0.percent))%" } ?? "--"
                        )
                        metricColumn(
                            label: "Nodes",
                            value: "\(cluster.onlineCount ?? 0)/\(cluster.nodeCount ?? 0)"
                        )
                    }
                } else {
                    Text("Not configured")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Alert Card

    private var alertCard: some View {
        NavigationLink(destination: WatchAlertsView()) {
            HStack(spacing: 6) {
                Image(systemName: alertCount > 0 ? "bell.badge.fill" : "bell.fill")
                    .font(.caption)
                    .foregroundStyle(alertCount > 0 ? Theme.warning : Theme.textMuted)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Alerts")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                    Text(alertCount > 0 ? "\(alertCount) Recent" : "None")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                }

                Spacer()
            }
            .padding(8)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private func metricColumn(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.footnote)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.text)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
    }

    // MARK: - Data Fetching

    private func fetchAll() async {
        isLoading = true
        error = nil

        async let servicesTask: Void = fetchServices()
        async let clusterTask: Void = fetchCluster()
        async let alertsTask: Void = fetchAlerts()

        _ = await (servicesTask, clusterTask, alertsTask)
        isLoading = false
    }

    private func fetchServices() async {
        do {
            let response: ServicesResponse = try await WatchAPIClient.shared.request(path: "/api/homelab/services")
            services = response.summary
        } catch {
            self.error = "Failed to load"
        }
    }

    private func fetchCluster() async {
        do {
            let response: ClusterMetrics = try await WatchAPIClient.shared.request(path: "/api/sysmon/metrics")
            cluster = response
        } catch {
            // Non-critical, skip silently
        }
    }

    private func fetchAlerts() async {
        do {
            let response: AlertHistoryResponse = try await WatchAPIClient.shared.request(path: "/api/alerts/history?limit=10")
            alertCount = response.history.count
        } catch {
            // Non-critical, skip silently
        }
    }
}
