import SwiftUI

struct WatchClusterView: View {
    @State private var metrics: ClusterMetrics?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .tint(Theme.accent)
                } else if let error {
                    VStack(spacing: 8) {
                        Image(systemName: "server.rack")
                            .font(.title3)
                            .foregroundStyle(Theme.danger)
                        Text(error)
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                            .multilineTextAlignment(.center)
                    }
                } else if let metrics, metrics.configured {
                    gaugeRow
                    nodeRow(metrics: metrics)
                } else {
                    Text("Cluster not configured")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Cluster")
        .containerBackground(Theme.background, for: .navigation)
        .task { await fetchData() }
        .refreshable { await fetchData() }
    }

    // MARK: - Gauges

    private var gaugeRow: some View {
        HStack(spacing: 16) {
            if let cpu = metrics?.cpu {
                circularGauge(
                    value: cpu.usedPercent / 100.0,
                    label: "CPU",
                    displayValue: "\(Int(cpu.usedPercent))%",
                    tint: gaugeColor(percent: cpu.usedPercent)
                )
            }

            if let mem = metrics?.memory {
                circularGauge(
                    value: mem.percent / 100.0,
                    label: "Mem",
                    displayValue: "\(Int(mem.percent))%",
                    tint: gaugeColor(percent: mem.percent)
                )
            }
        }
        .padding(.top, 4)
    }

    private func circularGauge(value: Double, label: String, displayValue: String, tint: Color) -> some View {
        VStack(spacing: 4) {
            Gauge(value: value) {
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            } currentValueLabel: {
                Text(displayValue)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.text)
            }
            .gaugeStyle(.accessoryCircular)
            .tint(Gradient(colors: [tint.opacity(0.6), tint]))
            .frame(width: 60, height: 60)
        }
    }

    // MARK: - Node Status

    private func nodeRow(metrics: ClusterMetrics) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "server.rack")
                .font(.caption2)
                .foregroundStyle(Theme.accent)

            let online = metrics.onlineCount ?? 0
            let total = metrics.nodeCount ?? 0

            Text("Nodes: \(online)/\(total) Online")
                .font(.caption)
                .foregroundStyle(Theme.text)

            Spacer()

            Circle()
                .fill(online == total ? Theme.success : Theme.warning)
                .frame(width: 8, height: 8)
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Helpers

    private func gaugeColor(percent: Double) -> Color {
        if percent >= 90 { return Theme.danger }
        if percent >= 70 { return Theme.warning }
        return Theme.success
    }

    // MARK: - Data Fetching

    private func fetchData() async {
        isLoading = true
        error = nil
        do {
            let response: ClusterMetrics = try await WatchAPIClient.shared.request(path: "/api/sysmon/metrics")
            metrics = response
        } catch {
            self.error = "Cannot reach cluster"
        }
        isLoading = false
    }
}
