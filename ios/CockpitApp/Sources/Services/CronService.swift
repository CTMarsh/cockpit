import Foundation

@MainActor
final class CronService: ObservableObject {
    static let shared = CronService()

    @Published var jobs: [CronJob] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchJobs() async {
        isLoading = jobs.isEmpty
        error = nil

        do {
            let response: CronJobsResponse = try await api.request(path: "/api/cron/jobs")
            jobs = response.jobs
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func toggleJob(id: String, enabled: Bool) async {
        do {
            try await api.send(
                path: "/api/cron/jobs/\(id)",
                method: "PUT",
                body: UpdateCronJobBody(name: nil, schedule: nil, command: nil, enabled: enabled)
            )
            await fetchJobs()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func runJob(id: String) async -> ManualRunResponse? {
        do {
            let response: ManualRunResponse = try await api.request(
                path: "/api/cron/jobs/\(id)/run",
                method: "POST"
            )
            await fetchJobs()
            return response
        } catch let apiError as APIError {
            error = apiError.errorDescription
            return nil
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func createJob(name: String, schedule: String, command: String) async {
        do {
            try await api.send(
                path: "/api/cron/jobs",
                method: "POST",
                body: CreateCronJobBody(name: name, schedule: schedule, command: command, enabled: true)
            )
            await fetchJobs()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteJob(id: String) async {
        do {
            try await api.send(path: "/api/cron/jobs/\(id)", method: "DELETE")
            jobs.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchRuns(jobId: String) async -> [CronRun] {
        do {
            let response: CronRunsResponse = try await api.request(path: "/api/cron/jobs/\(jobId)/runs")
            return response.runs
        } catch {
            return []
        }
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchJobs()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
