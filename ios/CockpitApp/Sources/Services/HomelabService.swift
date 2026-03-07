import Foundation

@MainActor
final class HomelabService: ObservableObject {
    static let shared = HomelabService()

    @Published var services: [ServiceStatus] = []
    @Published var containers: [DockerContainer] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchServices() async {
        isLoading = services.isEmpty
        error = nil

        do {
            services = try await api.request(path: "/api/homelab/services")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchContainers() async {
        do {
            containers = try await api.request(path: "/api/homelab/docker/containers")
        } catch {
            // Container fetch failure is non-fatal if services loaded
        }
    }

    func checkServices() async {
        do {
            let _: [String: String] = try await api.request(
                path: "/api/homelab/services/check",
                method: "POST"
            )
            await fetchServices()
        } catch {
            self.error = "Failed to trigger health check"
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchServices()
                await fetchContainers()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
