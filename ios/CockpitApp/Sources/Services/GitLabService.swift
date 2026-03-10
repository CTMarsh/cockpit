import Foundation

@MainActor
final class GitLabService: ObservableObject {
    static let shared = GitLabService()

    @Published var status: GitLabStatusResponse?
    @Published var projects: [GitLabProject] = []
    @Published var selectedProjectId: Int?
    @Published var issues: [GitLabIssue] = []
    @Published var mergeRequests: [GitLabMR] = []
    @Published var pipelines: [GitLabPipeline] = []
    @Published var releases: [GitLabRelease] = []
    @Published var labels: [GitLabLabel] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    // MARK: - Status

    func fetchStatus() async {
        do {
            status = try await api.request(path: "/api/gitlab/status")
        } catch {
            if self.error == nil { self.error = error.localizedDescription }
        }
    }

    // MARK: - Projects

    func fetchProjects() async {
        isLoading = projects.isEmpty
        error = nil

        do {
            let response: GitLabListResponse<GitLabProject> = try await api.request(path: "/api/gitlab/projects")
            projects = response.items
            // Auto-select first project if none selected
            if selectedProjectId == nil, let first = projects.first {
                selectedProjectId = first.id
            }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Issues

    func fetchIssues(state: String = "opened") async {
        guard let projectId = selectedProjectId else { return }

        do {
            let response: GitLabListResponse<GitLabIssue> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/issues?state=\(state)"
            )
            issues = response.items
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createIssue(title: String, description: String?, labels: String?) async {
        guard let projectId = selectedProjectId else { return }

        do {
            let _: GitLabIssue = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/issues",
                method: "POST",
                body: CreateIssueBody(title: title, description: description, labels: labels)
            )
            await fetchIssues()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func updateIssueState(iid: Int, stateEvent: String) async {
        guard let projectId = selectedProjectId else { return }

        do {
            let _: GitLabIssue = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/issues/\(iid)",
                method: "PUT",
                body: UpdateIssueBody(stateEvent: stateEvent)
            )
            await fetchIssues()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchNotes(issueIid: Int) async -> [GitLabNote] {
        guard let projectId = selectedProjectId else { return [] }

        do {
            let response: GitLabListResponse<GitLabNote> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/issues/\(issueIid)/notes"
            )
            return response.items
        } catch {
            return []
        }
    }

    func addNote(issueIid: Int, body: String) async {
        guard let projectId = selectedProjectId else { return }

        do {
            let _: GitLabNote = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/issues/\(issueIid)/notes",
                method: "POST",
                body: CreateNoteBody(body: body)
            )
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Merge Requests

    func fetchMergeRequests(state: String = "opened") async {
        guard let projectId = selectedProjectId else { return }

        do {
            let response: GitLabListResponse<GitLabMR> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/merge_requests?state=\(state)"
            )
            mergeRequests = response.items
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func approveMR(iid: Int) async {
        guard let projectId = selectedProjectId else { return }

        do {
            try await api.send(path: "/api/gitlab/projects/\(projectId)/merge_requests/\(iid)/approve", method: "POST")
            await fetchMergeRequests()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func mergeMR(iid: Int) async {
        guard let projectId = selectedProjectId else { return }

        do {
            try await api.send(path: "/api/gitlab/projects/\(projectId)/merge_requests/\(iid)/merge", method: "PUT")
            await fetchMergeRequests()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchMRChanges(iid: Int) async -> GitLabChangesResponse? {
        guard let projectId = selectedProjectId else { return nil }

        do {
            return try await api.request(
                path: "/api/gitlab/projects/\(projectId)/merge_requests/\(iid)/changes"
            )
        } catch {
            return nil
        }
    }

    // MARK: - Pipelines

    func fetchPipelines() async {
        guard let projectId = selectedProjectId else { return }

        do {
            let response: GitLabListResponse<GitLabPipeline> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/pipelines"
            )
            pipelines = response.items
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchJobs(pipelineId: Int) async -> [GitLabJob] {
        guard let projectId = selectedProjectId else { return [] }

        do {
            let response: GitLabListResponse<GitLabJob> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/pipelines/\(pipelineId)/jobs"
            )
            return response.items
        } catch {
            return []
        }
    }

    func retryJob(jobId: Int) async {
        guard let projectId = selectedProjectId else { return }

        do {
            try await api.send(path: "/api/gitlab/projects/\(projectId)/jobs/\(jobId)/retry", method: "POST")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func cancelJob(jobId: Int) async {
        guard let projectId = selectedProjectId else { return }

        do {
            try await api.send(path: "/api/gitlab/projects/\(projectId)/jobs/\(jobId)/cancel", method: "POST")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func fetchJobLog(jobId: Int) async -> String? {
        guard let projectId = selectedProjectId else { return nil }

        do {
            let response: GitLabJobLogResponse = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/jobs/\(jobId)/trace"
            )
            return response.log
        } catch {
            return nil
        }
    }

    // MARK: - Releases

    func fetchReleases() async {
        guard let projectId = selectedProjectId else { return }

        do {
            let response: GitLabListResponse<GitLabRelease> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/releases"
            )
            releases = response.items
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Repository

    func fetchTree(path: String = "", ref: String = "HEAD") async -> [GitLabTreeItem] {
        guard let projectId = selectedProjectId else { return [] }

        do {
            let response: GitLabListResponse<GitLabTreeItem> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/repository/tree?path=\(path)&ref=\(ref)"
            )
            return response.items
        } catch {
            return []
        }
    }

    // MARK: - Labels

    func fetchLabels() async {
        guard let projectId = selectedProjectId else { return }

        do {
            let response: GitLabListResponse<GitLabLabel> = try await api.request(
                path: "/api/gitlab/projects/\(projectId)/labels"
            )
            labels = response.items
        } catch {
            // Labels are non-critical, silently fail
        }
    }

    // MARK: - Polling

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            await fetchStatus()
            await fetchProjects()
            while !Task.isCancelled {
                await fetchIssues()
                await fetchMergeRequests()
                await fetchPipelines()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    /// Refresh all data for the selected project
    func refreshAll() async {
        await fetchStatus()
        await fetchProjects()
        await fetchIssues()
        await fetchMergeRequests()
        await fetchPipelines()
        await fetchReleases()
        await fetchLabels()
    }
}
