import SwiftUI

struct HomelabView: View {
    @ObservedObject private var service = HomelabService.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.services.isEmpty {
                    LoadingView()
                } else {
                    // Summary bar
                    let upCount = service.summary?.up ?? service.services.filter(\.isUp).count
                    let total = service.summary?.total ?? service.services.count

                    HStack {
                        StatusBadge(
                            text: "\(upCount)/\(total) up",
                            color: upCount == total ? Theme.success : Theme.warning
                        )
                        Spacer()
                    }
                    .padding(.horizontal)

                    // Service cards
                    LazyVStack(spacing: 10) {
                        ForEach(service.services) { svc in
                            ServiceCard(service: svc)
                        }
                    }
                    .padding(.horizontal)

                    // Containers section
                    if !service.containers.isEmpty {
                        HStack {
                            Text("Docker Containers")
                                .font(.headline)
                                .foregroundStyle(Theme.text)
                            Spacer()
                            Text("\(service.containers.count)")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                        .padding(.horizontal)
                        .padding(.top, 8)

                        LazyVStack(spacing: 8) {
                            ForEach(service.containers) { container in
                                ContainerRow(container: container)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Homelab")
        .refreshable {
            await service.fetchServices()
            await service.fetchContainers()
        }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }
}

// MARK: - Subviews

private struct ServiceCard: View {
    let service: ServiceStatus

    private var statusColor: Color {
        switch service.status {
        case "up": Theme.success
        case "down": Theme.danger
        default: Theme.textMuted
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(service.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                Text(service.url)
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                    .lineLimit(1)
            }

            Spacer()

            if let responseTime = service.responseTime {
                Text("\(responseTime)ms")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.textMuted)
            }

            StatusBadge(
                text: service.status ?? "unknown",
                color: statusColor
            )
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

private struct ContainerRow: View {
    let container: DockerContainer

    private var stateColor: Color {
        switch container.state {
        case "running": Theme.success
        case "exited": Theme.danger
        case "paused": Theme.warning
        default: Theme.textMuted
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(stateColor)
                .frame(width: 8, height: 8)

            Text(container.name.hasPrefix("/") ? String(container.name.dropFirst()) : container.name)
                .font(.subheadline)
                .foregroundStyle(Theme.text)

            Spacer()

            Text(container.state)
                .font(.caption)
                .foregroundStyle(stateColor)
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
