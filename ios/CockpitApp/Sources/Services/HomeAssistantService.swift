import Foundation

@MainActor class HomeAssistantService: ObservableObject {
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

    func callService(domain: String, service: String, entityId: String?) async -> Bool {
        do {
            var body: [String: String] = [:]
            if let entityId { body["entity_id"] = entityId }
            let _: HAServiceResponse = try await APIClient.shared.request(path: "/api/ha/services/\(domain)/\(service)", method: "POST", body: body)
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}
