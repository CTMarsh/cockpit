import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct ServiceHealthEntry: TimelineEntry {
    let date: Date
    let upCount: Int
    let totalCount: Int
    let isPlaceholder: Bool

    static var placeholder: ServiceHealthEntry {
        ServiceHealthEntry(date: .now, upCount: 8, totalCount: 9, isPlaceholder: true)
    }

    var allUp: Bool { upCount == totalCount }
    var ratio: Double { totalCount > 0 ? Double(upCount) / Double(totalCount) : 0 }
}

// MARK: - Timeline Provider

struct ServiceHealthProvider: TimelineProvider {
    private static let appGroupId = "group.com.ctmarsh.cockpit"
    private static let upCountKey = "serviceHealthUpCount"
    private static let totalCountKey = "serviceHealthTotalCount"

    func placeholder(in context: Context) -> ServiceHealthEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (ServiceHealthEntry) -> Void) {
        completion(cachedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<ServiceHealthEntry>) -> Void) {
        Task { @MainActor in
            let entry = await fetchEntry()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: .now) ?? .now
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func cachedEntry() -> ServiceHealthEntry {
        let defaults = UserDefaults(suiteName: Self.appGroupId)
        let up = defaults?.integer(forKey: Self.upCountKey) ?? 0
        let total = defaults?.integer(forKey: Self.totalCountKey) ?? 0
        return ServiceHealthEntry(date: .now, upCount: up, totalCount: total, isPlaceholder: false)
    }

    private func fetchEntry() async -> ServiceHealthEntry {
        do {
            let response: ServicesResponse = try await WatchAPIClient.shared.request(path: "/api/homelab/services")
            let up = response.summary?.up ?? response.services.filter(\.isUp).count
            let total = response.summary?.total ?? response.services.count

            // Cache to App Group
            let defaults = UserDefaults(suiteName: Self.appGroupId)
            defaults?.set(up, forKey: Self.upCountKey)
            defaults?.set(total, forKey: Self.totalCountKey)

            return ServiceHealthEntry(date: .now, upCount: up, totalCount: total, isPlaceholder: false)
        } catch {
            return cachedEntry()
        }
    }
}

// MARK: - Complication Views

struct ServiceHealthCircularView: View {
    let entry: ServiceHealthEntry

    var body: some View {
        Gauge(value: entry.ratio) {
            Text("Svc")
                .font(.system(size: 8))
        } currentValueLabel: {
            Text("\(entry.upCount)/\(entry.totalCount)")
                .font(.system(size: 12, weight: .semibold))
        }
        .gaugeStyle(.accessoryCircular)
        .tint(entry.allUp ? Color.green : Color.red)
    }
}

struct ServiceHealthCornerView: View {
    let entry: ServiceHealthEntry

    var body: some View {
        Text("\(entry.upCount)/\(entry.totalCount)")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(entry.allUp ? Color.green : Color.red)
            .widgetLabel {
                Text("Services Up")
            }
    }
}

struct ServiceHealthRectangularView: View {
    let entry: ServiceHealthEntry

    var body: some View {
        HStack(spacing: 8) {
            Gauge(value: entry.ratio) {
                EmptyView()
            }
            .gaugeStyle(.accessoryCircular)
            .tint(entry.allUp ? Color.green : Color.red)
            .scaleEffect(0.7)

            VStack(alignment: .leading, spacing: 2) {
                Text("Services")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text("\(entry.upCount)/\(entry.totalCount) Up")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(entry.allUp ? Color.green : Color.red)
            }

            Spacer()
        }
    }
}

// MARK: - Widget

struct ServiceHealthComplication: Widget {
    let kind = "ServiceHealthComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ServiceHealthProvider()) { entry in
            switch entry.date {
            default:
                ServiceHealthCircularView(entry: entry)
            }
        }
        .configurationDisplayName("Service Health")
        .description("Shows how many services are up.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
