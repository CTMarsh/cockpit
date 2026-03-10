import SwiftUI

/// Compact cluster page for vertical TabView — single screen, no scroll.
struct WatchClusterPage: View {
    @State private var metrics: ClusterMetrics?
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
                Image(systemName: "server.rack")
                    .font(.title3)
                    .foregroundStyle(Theme.danger)
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                Spacer()
            } else if let metrics, metrics.configured {
                Text("Cluster")
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // CPU + Memory gauges
                HStack(spacing: 16) {
                    if let cpu = metrics.cpu {
                        circularGauge(
                            value: cpu.usedPercent / 100.0,
                            label: "CPU",
                            displayValue: "\(Int(cpu.usedPercent))%",
                            tint: gaugeColor(percent: cpu.usedPercent)
                        )
                    }

                    if let mem = metrics.memory {
                        circularGauge(
                            value: mem.percent / 100.0,
                            label: "Mem",
                            displayValue: "\(Int(mem.percent))%",
                            tint: gaugeColor(percent: mem.percent)
                        )
                    }
                }

                // Node status
                HStack(spacing: 6) {
                    let online = metrics.onlineCount ?? 0
                    let total = metrics.nodeCount ?? 0

                    Circle()
                        .fill(online == total ? Theme.success : Theme.warning)
                        .frame(width: 8, height: 8)
                    Text("\(online)/\(total) Nodes Online")
                        .font(.caption2)
                        .foregroundStyle(Theme.text)
                    Spacer()
                }
                .padding(8)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Detail link
                NavigationLink(destination: WatchClusterView()) {
                    HStack {
                        Text("Details")
                            .font(.caption2)
                            .foregroundStyle(Theme.accent)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 9))
                            .foregroundStyle(Theme.accent)
                    }
                }
                .buttonStyle(.plain)
            } else {
                Spacer()
                Text("Cluster not configured")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
            }
        }
        .padding(.horizontal, 8)
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchData() }
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

    private func gaugeColor(percent: Double) -> Color {
        if percent >= 90 { return Theme.danger }
        if percent >= 70 { return Theme.warning }
        return Theme.success
    }

    private func fetchData() async {
        isLoading = true
        do {
            let r: ClusterMetrics = try await WatchAPIClient.shared.request(path: "/api/sysmon/cluster")
            metrics = r
        } catch {
            self.error = "Cannot reach cluster"
        }
        isLoading = false
    }
}
