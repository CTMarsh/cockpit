import Foundation

@MainActor class AlertService: ObservableObject {
    static let shared = AlertService()
    @Published var rules: [AlertRule] = []
    @Published var history: [AlertHistory] = []
    @Published var isLoading = false
    @Published var error: String?

    func fetchRules() async {
        isLoading = rules.isEmpty
        do {
            let resp: AlertRulesResponse = try await APIClient.shared.request(path: "/api/alerts/rules")
            rules = resp.rules
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchHistory(limit: Int = 50) async {
        do {
            let resp: AlertHistoryResponse = try await APIClient.shared.request(path: "/api/alerts/history?limit=\(limit)")
            history = resp.history
        } catch { self.error = error.localizedDescription }
    }

    func createRule(_ body: CreateAlertBody) async -> Bool {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/alerts/rules", method: "POST", body: body)
            await fetchRules()
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deleteRule(id: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/alerts/rules/\(id)", method: "DELETE")
            rules.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }

    func toggleRule(id: String, enabled: Bool) async {
        do {
            let body: [String: Bool] = ["enabled": enabled]
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/alerts/rules/\(id)", method: "PUT", body: body)
            if let i = rules.firstIndex(where: { $0.id == id }) {
                await fetchRules()
            }
        } catch { self.error = error.localizedDescription }
    }

    func testRule(id: String) async -> Bool {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/alerts/test/\(id)", method: "POST")
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}

struct GenericOKResponse: Codable {
    let ok: Bool?
    let message: String?
    let id: String?
}
