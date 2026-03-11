import Foundation

@MainActor final class UptimeMonitorService: ObservableObject {
    static let shared = UptimeMonitorService()
    @Published var services: [MonitoredService] = []
    @Published var history: [UptimeCheck] = []
    @Published var stats: UptimeStats?
    @Published var isLoading = false
    @Published var error: String?

    func fetchServices() async {
        isLoading = services.isEmpty
        do {
            let resp: UptimeServicesResponse = try await APIClient.shared.request(path: "/api/uptime/services")
            services = resp.services
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchHistory(serviceId: Int) async {
        do {
            let resp: UptimeHistoryResponse = try await APIClient.shared.request(path: "/api/uptime/history/\(serviceId)")
            history = resp.history
        } catch { self.error = error.localizedDescription }
    }

    func fetchStats(serviceId: Int) async {
        do {
            let resp: UptimeStatsResponse = try await APIClient.shared.request(path: "/api/uptime/stats/\(serviceId)")
            stats = resp.stats
        } catch { self.error = error.localizedDescription }
    }

    func checkAll() async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/uptime/check", method: "POST")
            await fetchServices()
        } catch { self.error = error.localizedDescription }
    }

    func checkOne(id: Int) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/uptime/check/\(id)", method: "POST")
            await fetchServices()
        } catch { self.error = error.localizedDescription }
    }

    func createService(_ body: CreateMonitoredServiceBody) async -> Bool {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/uptime/services", method: "POST", body: body)
            await fetchServices()
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deleteService(id: Int) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/uptime/services/\(id)", method: "DELETE")
            services.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }
}
