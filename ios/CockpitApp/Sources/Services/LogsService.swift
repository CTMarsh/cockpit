import Foundation

@MainActor class LogsService: ObservableObject {
    static let shared = LogsService()
    @Published var sources: [LogSource] = []
    @Published var systemUnits: [SystemUnit] = []
    @Published var logLines: [String] = []
    @Published var isLoading = false
    @Published var error: String?

    func fetchSources() async {
        isLoading = sources.isEmpty
        do {
            let resp: LogSourcesResponse = try await APIClient.shared.request(path: "/api/logs/sources")
            sources = resp.sources
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchContainerLogs(id: String, tail: Int = 200) async {
        isLoading = true
        do {
            let resp: ContainerLogsResponse = try await APIClient.shared.request(path: "/api/logs/container/\(id)?tail=\(tail)")
            logLines = resp.lines
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchSystemLogs(unit: String? = nil, lines: Int = 200) async {
        isLoading = true
        do {
            var path = "/api/logs/system?lines=\(lines)"
            if let unit { path += "&unit=\(unit)" }
            let resp: SystemLogsResponse = try await APIClient.shared.request(path: path)
            logLines = resp.lines
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchSystemUnits() async {
        do {
            let resp: SystemUnitsResponse = try await APIClient.shared.request(path: "/api/logs/system/units")
            systemUnits = resp.units
        } catch { self.error = error.localizedDescription }
    }
}
