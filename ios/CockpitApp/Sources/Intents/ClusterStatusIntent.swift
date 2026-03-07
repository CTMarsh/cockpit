import AppIntents

struct ClusterStatusIntent: AppIntent {
    static let title: LocalizedStringResource = "Check Cluster Status"
    static let description = IntentDescription("Check the health of your k8s cluster")
    static let openAppWhenRun = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIClient.shared
        do {
            let stats: DashboardStats = try await api.request(path: "/api/dashboard/stats")
            let nodesOnline = stats.clusterOnline ?? 0
            let nodesTotal = stats.clusterNodes ?? 0
            let services = stats.serviceCount ?? 0
            return .result(dialog: "\(nodesOnline) of \(nodesTotal) nodes online. \(services) services monitored.")
        } catch {
            return .result(dialog: "Unable to reach Cockpit dashboard.")
        }
    }
}
