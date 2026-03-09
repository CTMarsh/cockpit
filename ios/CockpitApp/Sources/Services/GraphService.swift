import Foundation

@MainActor final class GraphService: ObservableObject {
    static let shared = GraphService()
    @Published var graphData: GraphData?
    @Published var isLoading = false
    @Published var error: String?

    func fetchGraph() async {
        isLoading = true
        do {
            graphData = try await APIClient.shared.request(path: "/api/graph/nodes")
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }
}
