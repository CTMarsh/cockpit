import Foundation

@MainActor
final class SysmonService: ObservableObject {
    static let shared = SysmonService()

    @Published var cluster: ClusterMetrics?
    @Published var nodes: [SysmonNode] = []
    @Published var pods: [K8sPod] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchCluster() async {
        isLoading = cluster == nil
        error = nil

        do {
            cluster = try await api.request(path: "/api/sysmon/cluster")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchNodes() async {
        do {
            let response: SysmonNodesResponse = try await api.request(path: "/api/sysmon/nodes")
            nodes = response.nodes
        } catch {}
    }

    func fetchPods(namespace: String? = nil) async {
        do {
            let path = namespace.map { "/api/sysmon/pods?namespace=\($0)" } ?? "/api/sysmon/pods"
            let response: PodsResponse = try await api.request(path: path)
            pods = response.pods ?? []
        } catch {}
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchCluster()
                await fetchNodes()
                try? await Task.sleep(for: .seconds(10))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
