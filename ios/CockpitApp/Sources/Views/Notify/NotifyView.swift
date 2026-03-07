import SwiftUI

struct NotifyView: View {
    @ObservedObject private var service = NotifyModuleService.shared
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Projects").tag(0)
                Text("Devices").tag(1)
                Text("History").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            // Health banner
            if let health = service.health {
                HStack(spacing: 8) {
                    StatusBadge(
                        text: health.reachable ? "Connected" : "Unreachable",
                        color: health.reachable ? Theme.success : Theme.danger
                    )
                    if let v = health.version {
                        Text("v\(v)")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }

            if service.isLoading {
                LoadingView()
            } else {
                ScrollView {
                    switch selectedTab {
                    case 0: projectsContent
                    case 1: devicesContent
                    default: notificationsContent
                    }
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("Notify")
        .refreshable {
            await service.fetchHealth()
            await service.fetchProjects()
            await service.fetchDevices()
            await service.fetchNotifications()
        }
        .task {
            await service.fetchHealth()
            await service.fetchProjects()
            await service.fetchDevices()
            await service.fetchNotifications()
        }
    }

    private var projectsContent: some View {
        LazyVStack(spacing: 10) {
            ForEach(service.projects) { project in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(project.name)
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Text(project.slug)
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.textMuted)
                    }

                    if let key = project.apiKey {
                        Text(key.prefix(20) + "…")
                            .font(.caption2.monospaced())
                            .foregroundStyle(Theme.textMuted)
                    }

                    Button {
                        Task { _ = await service.testNotification(projectId: project.id) }
                    } label: {
                        Label("Test Push", systemImage: "bell.badge")
                            .font(.caption)
                    }
                    .tint(Theme.accent)
                }
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    private var devicesContent: some View {
        LazyVStack(spacing: 8) {
            ForEach(service.devices) { device in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(device.name ?? "Unknown Device")
                            .font(.body.weight(.medium))
                            .foregroundStyle(Theme.text)
                        if let seen = device.lastSeen {
                            Text("Last seen: \(seen.prefix(16))")
                                .font(.caption2)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                    Spacer()
                    StatusBadge(
                        text: device.enabled ? "Active" : "Disabled",
                        color: device.enabled ? Theme.success : Theme.textMuted
                    )
                }
                .padding(12)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    private var notificationsContent: some View {
        LazyVStack(spacing: 6) {
            ForEach(service.notifications) { notification in
                VStack(alignment: .leading, spacing: 4) {
                    Text(notification.title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.text)
                    if let body = notification.body, !body.isEmpty {
                        Text(body)
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                            .lineLimit(2)
                    }
                    if let date = notification.createdAt {
                        Text(date.prefix(16))
                            .font(.caption2.monospaced())
                            .foregroundStyle(Theme.textMuted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }
}
