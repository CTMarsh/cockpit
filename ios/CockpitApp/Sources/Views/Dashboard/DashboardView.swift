import SwiftUI

struct DashboardView: View {
    @ObservedObject private var service = DashboardService.shared
    @ObservedObject private var api = APIClient.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Server info
                if let health = service.health {
                    HStack {
                        StatusBadge(text: "Online", color: Theme.success)
                        Spacer()
                        Text("v\(health.version)")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        Text("\(health.modules) modules")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.horizontal)
                }

                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.stats == nil {
                    LoadingView()
                } else if let stats = service.stats {
                    // Stats cards
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 12) {
                        StatCard(title: "Services", value: "\(stats.serviceCount)", icon: "server.rack", color: Theme.accent)
                        StatCard(title: "Bookmarks", value: "\(stats.bookmarkCount)", icon: "bookmark.fill", color: Theme.info)
                        StatCard(title: "Documents", value: "\(stats.docCount)", icon: "doc.text.fill", color: Theme.success)
                        StatCard(title: "Cron Jobs", value: "\(stats.cronEnabled)/\(stats.cronTotal)", icon: "clock.fill", color: Theme.warning)
                        StatCard(title: "WoL Devices", value: "\(stats.wolDeviceCount)", icon: "wake", color: Theme.info)
                        StatCard(title: "Ideas", value: "\(stats.ideaCount)", icon: "lightbulb.fill", color: Theme.accent)
                    }
                    .padding(.horizontal)

                    // Module grid
                    SectionHeader(title: "Modules")

                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 12) {
                        ModuleCard(title: "Homelab", icon: "server.rack", color: Theme.accent)
                        ModuleCard(title: "Bookmarks", icon: "bookmark.fill", color: Theme.info)
                        ModuleCard(title: "Markdown", icon: "doc.text", color: Theme.success)
                        ModuleCard(title: "Graph", icon: "point.3.connected.trianglepath.dotted", color: Theme.warning)
                        ModuleCard(title: "Monitor", icon: "chart.bar.fill", color: Theme.info)
                        ModuleCard(title: "Proxmox", icon: "cpu", color: Theme.danger)
                        ModuleCard(title: "Logs", icon: "text.alignleft", color: Theme.textMuted)
                        ModuleCard(title: "Cron", icon: "clock.fill", color: Theme.warning)
                        ModuleCard(title: "WoL", icon: "wake", color: Theme.success)
                    }
                    .padding(.horizontal)

                    // Recent items
                    if !stats.recentBookmarks.isEmpty {
                        SectionHeader(title: "Recent Bookmarks")

                        VStack(spacing: 8) {
                            ForEach(stats.recentBookmarks) { bookmark in
                                HStack {
                                    Image(systemName: "bookmark.fill")
                                        .foregroundStyle(Theme.accent)
                                    Text(bookmark.title ?? bookmark.url)
                                        .foregroundStyle(Theme.text)
                                        .lineLimit(1)
                                    Spacer()
                                }
                                .padding(12)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Dashboard")
        .refreshable {
            await service.fetchStats()
            await service.fetchHealth()
        }
        .task {
            await service.fetchHealth()
            await service.fetchStats()
        }
    }
}

// MARK: - Subviews

private struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(Theme.text)
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.textMuted)
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}

private struct ModuleCard: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.text)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}

private struct SectionHeader: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.text)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }
}
