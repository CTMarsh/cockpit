import WidgetKit
import SwiftUI

// MARK: - Models

struct ServiceWidgetItem: Decodable {
    let id: Int
    let name: String
    let url: String
    let status: String?
    let responseTime: Int?
    let enabled: Int?
}

struct ServicesWidgetResponse: Decodable {
    let services: [ServiceWidgetItem]
}

// MARK: - Timeline Entry

struct ServiceStatusEntry: TimelineEntry {
    let date: Date
    let totalCount: Int
    let upCount: Int
    let downServices: [String]
    let isPlaceholder: Bool

    static let placeholder = ServiceStatusEntry(
        date: .now,
        totalCount: 12,
        upCount: 12,
        downServices: [],
        isPlaceholder: true
    )
}

// MARK: - Timeline Provider

struct ServiceStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> ServiceStatusEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (ServiceStatusEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        Task {
            let entry = await fetchEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ServiceStatusEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: entry.date)!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func fetchEntry() async -> ServiceStatusEntry {
        guard let response = await SharedAuth.fetch("/api/homelab/services", as: ServicesWidgetResponse.self) else {
            return ServiceStatusEntry(
                date: .now,
                totalCount: 0, upCount: 0,
                downServices: [],
                isPlaceholder: false
            )
        }

        let enabled = response.services.filter { ($0.enabled ?? 1) == 1 }
        let up = enabled.filter { $0.status == "up" }
        let down = enabled.filter { $0.status != "up" }.map(\.name)

        return ServiceStatusEntry(
            date: .now,
            totalCount: enabled.count,
            upCount: up.count,
            downServices: down,
            isPlaceholder: false
        )
    }
}

// MARK: - Entry View

struct ServiceStatusEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: ServiceStatusEntry

    var body: some View {
        switch family {
        case .systemMedium:
            ServiceStatusMediumView(entry: entry)
        default:
            ServiceStatusSmallView(entry: entry)
        }
    }
}

// MARK: - Small View

struct ServiceStatusSmallView: View {
    let entry: ServiceStatusEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .foregroundStyle(WidgetTheme.accent)
                Text("Services")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(WidgetTheme.text)
            }

            Spacer()

            Text("\(entry.upCount)/\(entry.totalCount)")
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(entry.downServices.isEmpty ? WidgetTheme.success : WidgetTheme.danger)
            Text(entry.downServices.isEmpty ? "all services up" : "\(entry.downServices.count) down")
                .font(.caption2)
                .foregroundStyle(WidgetTheme.textMuted)

            Spacer()

            if !entry.downServices.isEmpty {
                Text(entry.downServices.prefix(2).joined(separator: ", "))
                    .font(.system(size: 9))
                    .foregroundStyle(WidgetTheme.danger)
                    .lineLimit(1)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(WidgetTheme.success)
                    .font(.caption)
            }
        }
        .padding()
        .containerBackground(WidgetTheme.background, for: .widget)
    }
}

// MARK: - Medium View

struct ServiceStatusMediumView: View {
    let entry: ServiceStatusEntry

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "antenna.radiowaves.left.and.right")
                        .foregroundStyle(WidgetTheme.accent)
                    Text("Service Status")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(WidgetTheme.text)
                }

                Spacer()

                Text("\(entry.upCount)/\(entry.totalCount)")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(entry.downServices.isEmpty ? WidgetTheme.success : WidgetTheme.danger)
                Text(entry.downServices.isEmpty ? "all services healthy" : "\(entry.downServices.count) service\(entry.downServices.count == 1 ? "" : "s") down")
                    .font(.caption)
                    .foregroundStyle(WidgetTheme.textMuted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                if entry.downServices.isEmpty {
                    Spacer()
                    Image(systemName: "checkmark.shield.fill")
                        .font(.title)
                        .foregroundStyle(WidgetTheme.success)
                    Text("All Clear")
                        .font(.caption2)
                        .foregroundStyle(WidgetTheme.textMuted)
                    Spacer()
                } else {
                    Text("Down:")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(WidgetTheme.danger)
                    ForEach(entry.downServices.prefix(4), id: \.self) { name in
                        HStack(spacing: 4) {
                            Circle()
                                .fill(WidgetTheme.danger)
                                .frame(width: 5, height: 5)
                            Text(name)
                                .font(.caption2)
                                .foregroundStyle(WidgetTheme.text)
                                .lineLimit(1)
                        }
                    }
                    if entry.downServices.count > 4 {
                        Text("+\(entry.downServices.count - 4) more")
                            .font(.system(size: 9))
                            .foregroundStyle(WidgetTheme.textMuted)
                    }
                    Spacer()
                }
            }
        }
        .padding()
        .containerBackground(WidgetTheme.background, for: .widget)
    }
}

// MARK: - Widget Configuration

struct ServiceStatusWidget: Widget {
    let kind = "ServiceStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ServiceStatusProvider()) { entry in
            ServiceStatusEntryView(entry: entry)
                .redacted(reason: entry.isPlaceholder ? .placeholder : [])
        }
        .configurationDisplayName("Service Status")
        .description("Monitor your homelab services at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
