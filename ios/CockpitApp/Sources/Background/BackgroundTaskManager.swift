@preconcurrency import BackgroundTasks
import Foundation

final class BackgroundTaskManager: @unchecked Sendable {
    static let shared = BackgroundTaskManager()
    static let taskIdentifier = "com.ctmarsh.cockpit.refresh"

    private let sharedDefaults = UserDefaults(suiteName: "group.com.ctmarsh.cockpit")
    private let minimumInterval: TimeInterval = 15 * 60 // 15 minutes

    private let endpoints: [String] = [
        "/api/sysmon/cluster",
        "/api/homelab/services",
        "/api/alerts/history?limit=5",
    ]

    private init() {}

    // MARK: - Registration (call from AppDelegate didFinishLaunching)

    func registerTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.taskIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            self.handleRefresh(task: refreshTask)
        }
    }

    // MARK: - Scheduling

    func scheduleRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: minimumInterval)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[BackgroundTaskManager] Failed to schedule refresh: \(error.localizedDescription)")
        }
    }

    // MARK: - Task Execution

    private func handleRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh before doing work
        scheduleRefresh()

        let workTask = Task {
            await fetchAndCacheAll()
        }

        task.expirationHandler = {
            workTask.cancel()
        }

        Task {
            _ = await workTask.result
            task.setTaskCompleted(success: !workTask.isCancelled)
        }
    }

    private func fetchAndCacheAll() async {
        let baseURL = sharedDefaults?.string(forKey: "serverURL")
            ?? UserDefaults.standard.string(forKey: "serverURL")
            ?? "https://dashboard.noahsark.me"

        let session = makeSession()
        defer { session.invalidateAndCancel() }

        // Authenticate first using saved credentials
        guard await authenticate(session: session, baseURL: baseURL) else {
            print("[BackgroundTaskManager] Authentication failed, skipping refresh")
            return
        }

        // Fetch all endpoints concurrently
        await withTaskGroup(of: Void.self) { group in
            for endpoint in endpoints {
                group.addTask {
                    await self.fetchAndStore(
                        session: session,
                        baseURL: baseURL,
                        endpoint: endpoint
                    )
                }
            }
        }

        // Record last successful refresh timestamp
        sharedDefaults?.set(Date().timeIntervalSince1970, forKey: "lastBackgroundRefresh")
    }

    // MARK: - Networking

    private func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 25
        return URLSession(configuration: config)
    }

    private func authenticate(session: URLSession, baseURL: String) async -> Bool {
        guard let credentials = KeychainHelper.loadCredentials(),
              let url = URL(string: baseURL + "/api/auth/login") else {
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["username": credentials.username, "password": credentials.password]
        request.httpBody = try? JSONEncoder().encode(body)

        do {
            let (_, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            return http.statusCode == 200
        } catch {
            print("[BackgroundTaskManager] Auth request failed: \(error.localizedDescription)")
            return false
        }
    }

    private func fetchAndStore(session: URLSession, baseURL: String, endpoint: String) async {
        guard let url = URL(string: baseURL + endpoint) else { return }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }

            let cacheKey = cacheKeyForEndpoint(endpoint)
            sharedDefaults?.set(data, forKey: cacheKey)
            sharedDefaults?.set(Date().timeIntervalSince1970, forKey: cacheKey + "_ts")
        } catch {
            print("[BackgroundTaskManager] Fetch failed for \(endpoint): \(error.localizedDescription)")
        }
    }

    // MARK: - Helpers

    private func cacheKeyForEndpoint(_ endpoint: String) -> String {
        // Match CacheManager's hot cache key convention
        let key = endpoint
            .replacingOccurrences(of: "/api/", with: "")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "?", with: "_")
        return "hot_\(key)"
    }
}
