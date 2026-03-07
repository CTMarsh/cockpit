import WidgetKit
import SwiftUI

// MARK: - Models

struct AlertWidgetItem: Decodable {
    let id: Int
    let ruleName: String
    let metricType: String
    let value: Double
    let threshold: Double
    let message: String
    let firedAt: String
}

struct AlertWidgetResponse: Decodable {
    let history: [AlertWidgetItem]
}

// MARK: - Timeline Entry

struct AlertCountEntry: TimelineEntry {
    let date: Date
    let alertCount: Int
    let lastAlertTime: String?
    let lastAlertName: String?
    let isPlaceholder: Bool

    static let placeholder = AlertCountEntry(
        date: .now,
        alertCount: 2,
        lastAlertTime: "5m ago",
        lastAlertName: "CPU High",
        isPlaceholder: true
    )
}

// MARK: - Timeline Provider

struct AlertCountProvider: TimelineProvider {
    func placeholder(in context: Context) -> AlertCountEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (AlertCountEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        Task {
            let entry = await fetchEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<AlertCountEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 10, to: entry.date)!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func fetchEntry() async -> AlertCountEntry {
        guard let response = await SharedAuth.fetch(
            "/api/alerts/history?limit=5",
            as: AlertWidgetResponse.self
        ) else {
            return AlertCountEntry(
                date: .now,
                alertCount: 0,
                lastAlertTime: nil,
                lastAlertName: nil,
                isPlaceholder: false
            )
        }

        let alerts = response.history
        let lastAlert = alerts.first
        let relativeTime = lastAlert.flatMap { formatRelativeTime($0.firedAt) }

        return AlertCountEntry(
            date: .now,
            alertCount: alerts.count,
            lastAlertTime: relativeTime,
            lastAlertName: lastAlert?.ruleName,
            isPlaceholder: false
        )
    }

    private func formatRelativeTime(_ isoString: String) -> String? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var date = formatter.date(from: isoString)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: isoString)
        }

        guard let parsed = date else { return nil }

        let interval = Date().timeIntervalSince(parsed)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }
}

// MARK: - Entry View

struct AlertCountEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: AlertCountEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            AlertCountCircularView(entry: entry)
        default:
            AlertCountSmallView(entry: entry)
        }
    }
}

// MARK: - Small View

struct AlertCountSmallView: View {
    let entry: AlertCountEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "bell.badge")
                    .foregroundStyle(WidgetTheme.accent)
                Text("Alerts")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(WidgetTheme.text)
            }

            Spacer()

            Text("\(entry.alertCount)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(entry.alertCount > 0 ? WidgetTheme.warning : WidgetTheme.success)
            Text("recent alerts")
                .font(.caption2)
                .foregroundStyle(WidgetTheme.textMuted)

            Spacer()

            if let name = entry.lastAlertName, let time = entry.lastAlertTime {
                VStack(alignment: .leading, spacing: 1) {
                    Text(name)
                        .font(.system(size: 9))
                        .foregroundStyle(WidgetTheme.text)
                        .lineLimit(1)
                    Text(time)
                        .font(.system(size: 9))
                        .foregroundStyle(WidgetTheme.textMuted)
                }
            } else {
                Text("No recent alerts")
                    .font(.system(size: 9))
                    .foregroundStyle(WidgetTheme.success)
            }
        }
        .padding()
        .containerBackground(WidgetTheme.background, for: .widget)
    }
}

// MARK: - Lock Screen Circular View

struct AlertCountCircularView: View {
    let entry: AlertCountEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Image(systemName: entry.alertCount > 0 ? "bell.badge.fill" : "bell.fill")
                    .font(.caption)
                Text("\(entry.alertCount)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
            }
        }
        .containerBackground(.clear, for: .widget)
    }
}

// MARK: - Widget Configuration

struct AlertCountWidget: Widget {
    let kind = "AlertCountWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AlertCountProvider()) { entry in
            AlertCountEntryView(entry: entry)
                .redacted(reason: entry.isPlaceholder ? .placeholder : [])
        }
        .configurationDisplayName("Alert Count")
        .description("See recent alert count at a glance.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}
