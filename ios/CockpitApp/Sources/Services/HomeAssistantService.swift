import Foundation

@MainActor final class HomeAssistantService: ObservableObject {
    static let shared = HomeAssistantService()
    @Published var entities: [HAEntity] = []
    @Published var isAvailable = false
    @Published var isLoading = false
    @Published var error: String?

    var groupedEntities: [String: [HAEntity]] {
        Dictionary(grouping: entities, by: { $0.domainName })
    }

    func fetchEntities() async {
        isLoading = entities.isEmpty
        do {
            let resp: HAStatesResponse = try await APIClient.shared.request(path: "/api/ha/states")
            entities = resp.entities
            isAvailable = resp.available
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func toggleEntity(_ entity: HAEntity) async {
        let domain = entity.domainName
        let service = entity.isOn ? "turn_off" : "turn_on"
        do {
            let body = ["entity_id": entity.entityId]
            let _: HAServiceResponse = try await APIClient.shared.request(path: "/api/ha/services/\(domain)/\(service)", method: "POST", body: body)
            await fetchEntities()
        } catch { self.error = error.localizedDescription }
    }

    func updateEntityState(entityId: String, state: String) {
        if let idx = entities.firstIndex(where: { $0.entityId == entityId }) {
            let old = entities[idx]
            entities[idx] = HAEntity(
                entityId: old.entityId,
                state: state,
                domain: old.domain,
                friendlyName: old.friendlyName,
                icon: old.icon,
                unit: old.unit,
                deviceClass: old.deviceClass,
                lastChanged: old.lastChanged,
                lastUpdated: old.lastUpdated
            )
        }
    }

    func callService(domain: String, service: String, entityId: String?) async -> Bool {
        do {
            var body: [String: String] = [:]
            if let entityId { body["entity_id"] = entityId }
            let _: HAServiceResponse = try await APIClient.shared.request(path: "/api/ha/services/\(domain)/\(service)", method: "POST", body: body)
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}
