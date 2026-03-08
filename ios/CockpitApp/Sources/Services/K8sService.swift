import Foundation

@MainActor class K8sService: ObservableObject {
    static let shared = K8sService()
    @Published var namespaces: [String] = []
    @Published var selectedNamespace: String = ""
    @Published var workloads: [K8sWorkload] = []
    @Published var events: [K8sEvent] = []
    @Published var isAvailable = true
    @Published var isLoading = false
    @Published var error: String?

    private var pollTask: Task<Void, Never>?

    func fetchNamespaces() async {
        error = nil
        do {
            let resp: NamespacesResponse = try await APIClient.shared.request(path: "/api/k8s/namespaces")
            namespaces = resp.namespaces
            isAvailable = resp.available
        } catch { self.error = error.localizedDescription }
    }

    func fetchWorkloads() async {
        isLoading = workloads.isEmpty
        do {
            let path = selectedNamespace.isEmpty
                ? "/api/k8s/workloads"
                : "/api/k8s/workloads?namespace=\(selectedNamespace)"
            let resp: WorkloadsResponse = try await APIClient.shared.request(path: path)
            workloads = resp.workloads
            isAvailable = resp.available
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchEvents() async {
        do {
            let path = selectedNamespace.isEmpty
                ? "/api/k8s/events"
                : "/api/k8s/events?namespace=\(selectedNamespace)"
            let resp: EventsResponse = try await APIClient.shared.request(path: path)
            events = resp.events
        } catch { self.error = error.localizedDescription }
    }

    func restartDeployment(ns: String, name: String) async -> Bool {
        do {
            let _: K8sActionResponse = try await APIClient.shared.request(path: "/api/k8s/deployments/\(ns)/\(name)/restart", method: "POST")
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func scaleDeployment(ns: String, name: String, replicas: Int) async -> Bool {
        do {
            let body = ["replicas": replicas]
            let _: K8sActionResponse = try await APIClient.shared.request(path: "/api/k8s/deployments/\(ns)/\(name)/scale", method: "PATCH", body: body)
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deletePod(ns: String, name: String) async -> Bool {
        do {
            let _: K8sActionResponse = try await APIClient.shared.request(path: "/api/k8s/pods/\(ns)/\(name)", method: "DELETE")
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func fetchPodLogs(ns: String, name: String, tail: Int = 100) async -> String {
        do {
            let resp: PodLogsResponse = try await APIClient.shared.request(path: "/api/k8s/pods/\(ns)/\(name)/logs?tail=\(tail)")
            return resp.logs
        } catch { return "Error: \(error.localizedDescription)" }
    }

    func startPolling() {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                await fetchWorkloads()
                await fetchEvents()
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }

    func stopPolling() { pollTask?.cancel() }
}
