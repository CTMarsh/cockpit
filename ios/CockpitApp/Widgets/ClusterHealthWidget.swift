import WidgetKit
import SwiftUI

// MARK: - Models

struct ClusterWidgetData: Decodable {
    let configured: Bool
    let nodeCount: Int?
    let onlineCount: Int?
    let cpu: ClusterWidgetCPU?
    let memory: ClusterWidgetMemory?
}

struct ClusterWidgetCPU: Decodable {
    let cores: Int
    let usedPercent: Double
}

struct ClusterWidgetMemory: Decodable {
    let totalGb: Double
    let usedGb: Double
    let percent: Double

    enum CodingKeys: String, CodingKey {
        case totalGb = "totalGB"
        case usedGb = "usedGB"
        case percent
    }
}

// MARK: - Timeline Entry

struct ClusterHealthEntry: TimelineEntry {
    let date: Date
    let nodeCount: Int
    let onlineCount: Int
    let cpuPercent: Double
    let memoryPercent: Double
    let memoryUsedGb: Double
    let memoryTotalGb: Double
    let isPlaceholder: Bool

    static let placeholder = ClusterHealthEntry(
        date: .now,
        nodeCount: 6,
        onlineCount: 6,
        cpuPercent: 32.5,
        memoryPercent: 58.0,
        memoryUsedGb: 83.5,
        memoryTotalGb: 144.0,
        isPlaceholder: true
    )
}

// MARK: - Timeline Provider

struct ClusterHealthProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClusterHealthEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (ClusterHealthEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        Task {
            let entry = await fetchEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ClusterHealthEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: entry.date)!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func fetchEntry() async -> ClusterHealthEntry {
        guard let data = await SharedAuth.fetch("/api/sysmon/cluster", as: ClusterWidgetData.self),
              data.configured else {
            return ClusterHealthEntry(
                date: .now,
                nodeCount: 0, onlineCount: 0,
                cpuPercent: 0, memoryPercent: 0,
                memoryUsedGb: 0, memoryTotalGb: 0,
                isPlaceholder: false
            )
        }
        return ClusterHealthEntry(
            date: .now,
            nodeCount: data.nodeCount ?? 0,
            onlineCount: data.onlineCount ?? 0,
            cpuPercent: data.cpu?.usedPercent ?? 0,
            memoryPercent: data.memory?.percent ?? 0,
            memoryUsedGb: data.memory?.usedGb ?? 0,
            memoryTotalGb: data.memory?.totalGb ?? 0,
            isPlaceholder: false
        )
    }
}

// MARK: - Entry View

struct ClusterHealthEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: ClusterHealthEntry

    var body: some View {
        switch family {
        case .systemMedium:
            ClusterHealthMediumView(entry: entry)
        default:
            ClusterHealthSmallView(entry: entry)
        }
    }
}

// MARK: - Small View

struct ClusterHealthSmallView: View {
    let entry: ClusterHealthEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "server.rack")
                    .foregroundStyle(WidgetTheme.accent)
                Text("Cluster")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(WidgetTheme.text)
            }

            Spacer()

            Text("\(entry.onlineCount)/\(entry.nodeCount)")
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(entry.onlineCount == entry.nodeCount ? WidgetTheme.success : WidgetTheme.danger)
            Text("nodes online")
                .font(.caption2)
                .foregroundStyle(WidgetTheme.textMuted)

            Spacer()

            HStack(spacing: 12) {
                ClusterMetricPill(label: "CPU", value: entry.cpuPercent)
                ClusterMetricPill(label: "RAM", value: entry.memoryPercent)
            }
        }
        .padding()
        .containerBackground(WidgetTheme.background, for: .widget)
    }
}

// MARK: - Medium View

struct ClusterHealthMediumView: View {
    let entry: ClusterHealthEntry

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "server.rack")
                        .foregroundStyle(WidgetTheme.accent)
                    Text("Cluster Health")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(WidgetTheme.text)
                }

                Spacer()

                Text("\(entry.onlineCount)/\(entry.nodeCount)")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(entry.onlineCount == entry.nodeCount ? WidgetTheme.success : WidgetTheme.danger)
                Text("nodes online")
                    .font(.caption)
                    .foregroundStyle(WidgetTheme.textMuted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 8) {
                Spacer()
                ClusterGaugeRow(label: "CPU", percent: entry.cpuPercent)
                ClusterGaugeRow(label: "RAM", percent: entry.memoryPercent)
                Text(String(format: "%.0f / %.0f GB", entry.memoryUsedGb, entry.memoryTotalGb))
                    .font(.caption2)
                    .foregroundStyle(WidgetTheme.textMuted)
                Spacer()
            }
        }
        .padding()
        .containerBackground(WidgetTheme.background, for: .widget)
    }
}

// MARK: - Subviews

private struct ClusterMetricPill: View {
    let label: String
    let value: Double

    var body: some View {
        VStack(spacing: 1) {
            Text(String(format: "%.0f%%", value))
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(clusterColorForPercent(value))
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(WidgetTheme.textMuted)
        }
    }
}

private struct ClusterGaugeRow: View {
    let label: String
    let percent: Double

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundStyle(WidgetTheme.textMuted)
                .frame(width: 30, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(WidgetTheme.surface)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(clusterColorForPercent(percent))
                        .frame(width: geo.size.width * min(percent / 100.0, 1.0))
                }
            }
            .frame(height: 8)
            Text(String(format: "%.0f%%", percent))
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(WidgetTheme.text)
                .frame(width: 32, alignment: .trailing)
        }
    }
}

private func clusterColorForPercent(_ percent: Double) -> Color {
    if percent >= 90 { return WidgetTheme.danger }
    if percent >= 70 { return WidgetTheme.warning }
    return WidgetTheme.success
}

// MARK: - Widget Configuration

struct ClusterHealthWidget: Widget {
    let kind = "ClusterHealthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClusterHealthProvider()) { entry in
            ClusterHealthEntryView(entry: entry)
                .redacted(reason: entry.isPlaceholder ? .placeholder : [])
        }
        .configurationDisplayName("Cluster Health")
        .description("Monitor your k3s cluster node status, CPU, and memory.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
