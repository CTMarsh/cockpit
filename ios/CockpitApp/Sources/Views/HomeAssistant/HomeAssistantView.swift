import SwiftUI

struct HomeAssistantView: View {
    @ObservedObject private var service = HomeAssistantService.shared
    @StateObject private var sse = SSEClient { eventType, data in
        guard let jsonData = data.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
              let entityId = json["entity_id"] as? String,
              let newState = json["state"] as? String else { return }
        HomeAssistantService.shared.updateEntityState(entityId: entityId, state: newState)
    }
    @State private var isLive = false

    var sortedDomains: [String] {
        service.groupedEntities.keys.sorted()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.entities.isEmpty {
                    LoadingView()
                } else if !service.isAvailable {
                    VStack(spacing: 12) {
                        Image(systemName: "house.slash")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("Home Assistant unavailable")
                            .foregroundStyle(Theme.textMuted)
                        Text("Check HA_TOKEN configuration")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    // Summary
                    HStack {
                        StatusBadge(text: "\(service.entities.count) entities", color: Theme.info)
                        StatusBadge(text: "\(sortedDomains.count) domains", color: Theme.textMuted)
                        Spacer()
                    }
                    .padding(.horizontal)

                    // Grouped by domain
                    ForEach(sortedDomains, id: \.self) { domain in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(domain.capitalized)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.text)
                                .padding(.horizontal)

                            ForEach(service.groupedEntities[domain] ?? []) { entity in
                                EntityRow(entity: entity)
                            }
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Home Assistant")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    if isLive {
                        sse.disconnect()
                        isLive = false
                    } else {
                        sse.connect(path: "/api/homeassistant/events")
                        isLive = true
                    }
                } label: {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(isLive ? Theme.success : Theme.textMuted)
                            .frame(width: 6, height: 6)
                        Text(isLive ? "Live" : "Paused")
                            .font(.caption2)
                    }
                }
            }
        }
        .refreshable { await service.fetchEntities() }
        .task {
            await service.fetchEntities()
            sse.connect(path: "/api/homeassistant/events")
            isLive = true
        }
        .onDisappear {
            sse.disconnect()
            isLive = false
        }
    }
}

private struct EntityRow: View {
    let entity: HAEntity
    @ObservedObject private var service = HomeAssistantService.shared

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entity.displayName)
                    .font(.body)
                    .foregroundStyle(Theme.text)
                Text(entity.entityId)
                    .font(.caption2.monospaced())
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            if entity.isToggleable {
                Toggle("", isOn: Binding(
                    get: { entity.isOn },
                    set: { _ in
                        Task { await service.toggleEntity(entity) }
                    }
                ))
                .tint(Theme.accent)
                .labelsHidden()
            } else {
                HStack(spacing: 4) {
                    Text(entity.state)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.text)
                    if let unit = entity.unit {
                        Text(unit)
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                    }
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal)
    }
}
