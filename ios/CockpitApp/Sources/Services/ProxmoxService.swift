import Foundation

@MainActor
final class ProxmoxService: ObservableObject {
    static let shared = ProxmoxService()

    @Published var nodes: [ProxmoxNode] = []
    @Published var vms: [ProxmoxVM] = []
    @Published var status: ProxmoxStatusResponse?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchStatus() async {
        do {
            status = try await api.request(path: "/api/proxmox/status")
        } catch {}
    }

    func fetchNodes() async {
        isLoading = nodes.isEmpty
        error = nil

        do {
            let response: ProxmoxNodesResponse = try await api.request(path: "/api/proxmox/nodes")
            nodes = response.nodes
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchVMs() async {
        do {
            let response: ProxmoxResourcesResponse = try await api.request(path: "/api/proxmox/resources")
            vms = response.vms
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func vmAction(vmid: Int, action: String, node: String, type: String) async {
        do {
            let _: VMActionResponse = try await api.request(
                path: "/api/proxmox/vms/\(vmid)/action",
                method: "POST",
                body: VMActionBody(action: action, node: node, type: type)
            )
            // Refresh after action
            try? await Task.sleep(for: .seconds(2))
            await fetchVMs()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            await fetchStatus()
            while !Task.isCancelled {
                await fetchNodes()
                await fetchVMs()
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
