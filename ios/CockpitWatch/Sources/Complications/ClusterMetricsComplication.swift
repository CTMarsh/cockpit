import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct ClusterMetricsEntry: TimelineEntry {
    let date: Date
    let cpuPercent: Double
    let memPercent: Double
    let nodesOnline: Int
    let nodesTotal: Int
    let isPlaceholder: Bool

    static var placeholder: ClusterMetricsEntry {
        ClusterMetricsEntry(
            date: .now,
            cpuPercent: 42,
            memPercent: 65,
            nodesOnline: 6,
            nodesTotal: 6,
            isPlaceholder: true
        )
    }
}

// MARK: - Timeline Provider

struct ClusterMetricsProvider: TimelineProvider {
    private static let cachePrefix = "clusterMetrics_"
    private static let cpuKey = "clusterCpuPercent"
    private static let memKey = "clusterMemPercent"
    private static let nodesOnlineKey = "clusterNodesOnline"
    private static let nodesTotalKey = "clusterNodesTotal"

    func placeholder(in context: Context) -> ClusterMetricsEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (ClusterMetricsEntry) -> Void) {
        completion(cachedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ClusterMetricsEntry>) -> Void) {
        Task { @MainActor in
            let entry = await fetchEntry()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: .now) ?? .now
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func cachedEntry() -> ClusterMetricsEntry {
        let defaults = UserDefaults.standard
        return ClusterMetricsEntry(
            date: .now,
            cpuPercent: defaults.double(forKey: Self.cpuKey),
            memPercent: defaults.double(forKey: Self.memKey),
            nodesOnline: defaults.integer(forKey: Self.nodesOnlineKey),
            nodesTotal: defaults.integer(forKey: Self.nodesTotalKey),
            isPlaceholder: false
        )
    }

    private func fetchEntry() async -> ClusterMetricsEntry {
        do {
            let response: ClusterMetrics = try await WatchAPIClient.shared.request(path: "/api/sysmon/cluster")
            let cpu = response.cpu?.usedPercent ?? 0
            let mem = response.memory?.percent ?? 0
            let online = response.onlineCount ?? 0
            let total = response.nodeCount ?? 0

            // Cache locally
            let defaults = UserDefaults.standard
            defaults.set(cpu, forKey: Self.cpuKey)
            defaults.set(mem, forKey: Self.memKey)
            defaults.set(online, forKey: Self.nodesOnlineKey)
            defaults.set(total, forKey: Self.nodesTotalKey)

            return ClusterMetricsEntry(
                date: .now,
                cpuPercent: cpu,
                memPercent: mem,
                nodesOnline: online,
                nodesTotal: total,
                isPlaceholder: false
            )
        } catch {
            return cachedEntry()
        }
    }
}

// MARK: - Complication Views

struct ClusterCircularView: View {
    let entry: ClusterMetricsEntry

    var body: some View {
        Gauge(value: entry.cpuPercent / 100.0) {
            Text("CPU")
                .font(.system(size: 8))
        } currentValueLabel: {
            Text("\(Int(entry.cpuPercent))%")
                .font(.system(size: 12, weight: .semibold))
        }
        .gaugeStyle(.accessoryCircular)
        .tint(gaugeGradient(percent: entry.cpuPercent))
    }
}

struct ClusterRectangularView: View {
    let entry: ClusterMetricsEntry

    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 2) {
                Gauge(value: entry.cpuPercent / 100.0) {
                    EmptyView()
                }
                .gaugeStyle(.accessoryCircular)
                .tint(gaugeGradient(percent: entry.cpuPercent))
                .scaleEffect(0.6)

                Text("CPU")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 2) {
                Gauge(value: entry.memPercent / 100.0) {
                    EmptyView()
                }
                .gaugeStyle(.accessoryCircular)
                .tint(gaugeGradient(percent: entry.memPercent))
                .scaleEffect(0.6)

                Text("Mem")
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("\(Int(entry.cpuPercent))%")
                    .font(.caption2)
                    .fontWeight(.semibold)
                Text("\(Int(entry.memPercent))%")
                    .font(.caption2)
                    .fontWeight(.semibold)
            }
        }
    }
}

struct ClusterCornerView: View {
    let entry: ClusterMetricsEntry

    var body: some View {
        Text("\(Int(entry.cpuPercent))%")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(gaugeColor(percent: entry.cpuPercent))
            .widgetLabel {
                Gauge(value: entry.cpuPercent / 100.0) {
                    Text("CPU")
                }
                .gaugeStyle(.accessoryLinear)
                .tint(gaugeGradient(percent: entry.cpuPercent))
            }
    }
}

// MARK: - Helpers

private func gaugeColor(percent: Double) -> Color {
    if percent >= 90 { return .red }
    if percent >= 70 { return .yellow }
    return .green
}

private func gaugeGradient(percent: Double) -> Gradient {
    let color = gaugeColor(percent: percent)
    return Gradient(colors: [color.opacity(0.6), color])
}

// MARK: - Widget

struct ClusterMetricsComplication: Widget {
    let kind = "ClusterMetricsComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClusterMetricsProvider()) { entry in
            ClusterCircularView(entry: entry)
        }
        .configurationDisplayName("Cluster Metrics")
        .description("Shows k3s cluster CPU and memory usage.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
