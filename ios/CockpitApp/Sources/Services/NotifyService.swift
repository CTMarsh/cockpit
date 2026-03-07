import Foundation

@MainActor class NotifyModuleService: ObservableObject {
    static let shared = NotifyModuleService()
    @Published var projects: [NotifyProject] = []
    @Published var devices: [NotifyDevice] = []
    @Published var notifications: [NotifyNotification] = []
    @Published var health: NotifyHealthResponse?
    @Published var isLoading = false
    @Published var error: String?

    func fetchHealth() async {
        do {
            health = try await APIClient.shared.request(path: "/api/notify/health")
        } catch { self.error = error.localizedDescription }
    }

    func fetchProjects() async {
        isLoading = projects.isEmpty
        do {
            let resp: NotifyProjectsResponse = try await APIClient.shared.request(path: "/api/notify/projects")
            projects = resp.projects
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchDevices(projectId: Int? = nil) async {
        do {
            var path = "/api/notify/devices"
            if let projectId { path += "?project_id=\(projectId)" }
            let resp: NotifyDevicesResponse = try await APIClient.shared.request(path: path)
            devices = resp.devices
        } catch { self.error = error.localizedDescription }
    }

    func fetchNotifications(limit: Int = 50) async {
        do {
            let resp: NotifyNotificationsResponse = try await APIClient.shared.request(path: "/api/notify/notifications?limit=\(limit)")
            notifications = resp.notifications
        } catch { self.error = error.localizedDescription }
    }

    func testNotification(projectId: Int) async -> Bool {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/notify/test/\(projectId)", method: "POST")
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deleteDevice(id: Int) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/notify/devices/\(id)", method: "DELETE")
            devices.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }
}
