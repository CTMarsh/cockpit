import Foundation

@MainActor
final class DashboardService: ObservableObject {
    static let shared = DashboardService()

    @Published var stats: DashboardStats?
    @Published var health: HealthResponse?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    private init() {}

    func fetchStats() async {
        isLoading = true
        error = nil

        do {
            stats = try await api.request(path: "/api/dashboard/stats")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchHealth() async {
        do {
            health = try await api.request(path: "/api/health")
        } catch {
            // Health check failure is non-fatal
        }
    }
}
