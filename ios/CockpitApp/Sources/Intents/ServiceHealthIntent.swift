import AppIntents

struct ServiceHealthIntent: AppIntent {
    static let title: LocalizedStringResource = "Check Service Health"
    static let description = IntentDescription("Check if your homelab services are up")
    static let openAppWhenRun = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIClient.shared
        do {
            let services: ServiceHealthResponse = try await api.request(path: "/api/homelab/services")
            let total = services.services.count
            let up = services.services.filter { $0.status == "up" }.count
            let down = services.services.filter { $0.status != "up" }

            if down.isEmpty {
                return .result(dialog: "All \(total) services are online.")
            } else {
                let names = down.map(\.name).joined(separator: ", ")
                return .result(dialog: "\(up) of \(total) services online. Down: \(names).")
            }
        } catch {
            return .result(dialog: "Unable to check service health.")
        }
    }
}

private struct ServiceHealthResponse: Codable {
    let services: [ServiceHealthEntry]
}

private struct ServiceHealthEntry: Codable {
    let name: String
    let status: String
}
