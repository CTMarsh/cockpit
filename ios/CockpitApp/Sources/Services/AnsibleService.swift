import Foundation

@MainActor
final class AnsibleService: ObservableObject {
    static let shared = AnsibleService()

    @Published var playbooks: [String] = []
    @Published var runs: [AnsibleRun] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchPlaybooks() async {
        do {
            let response: AnsiblePlaybooksResponse = try await api.request(path: "/api/ansible/playbooks")
            playbooks = response.playbooks
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchRuns() async {
        isLoading = runs.isEmpty
        error = nil

        do {
            let response: AnsibleRunsResponse = try await api.request(path: "/api/ansible/runs")
            runs = response.runs
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func getRun(id: Int) async -> AnsibleRun? {
        do {
            let response: AnsibleRunResponse = try await api.request(path: "/api/ansible/runs/\(id)")
            return response.run
        } catch {
            return nil
        }
    }

    func runPlaybook(playbook: String, tags: String?, extraVars: String?, dryRun: Bool) async -> AnsibleRun? {
        do {
            let response: RunPlaybookResponse = try await api.request(
                path: "/api/ansible/run",
                method: "POST",
                body: RunPlaybookBody(
                    playbook: playbook,
                    tags: tags?.isEmpty == true ? nil : tags,
                    extraVars: extraVars?.isEmpty == true ? nil : extraVars,
                    dryRun: dryRun ? true : nil
                )
            )
            await fetchRuns()
            return response.run
        } catch let apiError as APIError {
            error = apiError.errorDescription
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteRun(id: Int) async {
        do {
            try await api.send(path: "/api/ansible/runs/\(id)", method: "DELETE")
            runs.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchPlaybooks()
                await fetchRuns()
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
