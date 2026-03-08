import Foundation

@MainActor
final class HomelabService: ObservableObject {
    static let shared = HomelabService()

    @Published var services: [ServiceStatus] = []
    @Published var summary: ServiceSummary?
    @Published var containers: [DockerContainer] = []
    @Published var hosts: [DockerHost] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchServices() async {
        isLoading = services.isEmpty
        error = nil

        do {
            let response: ServicesResponse = try await api.request(path: "/api/homelab/services")
            services = response.services
            summary = response.summary
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchContainers() async {
        do {
            let response: ContainersResponse = try await api.request(path: "/api/homelab/containers")
            containers = response.containers
            hosts = response.hosts
        } catch {
            // Container fetch failure is non-fatal if services loaded
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
