import Foundation

struct NotifyProject: Codable, Identifiable {
    let id: Int
    let name: String
    let slug: String
    let apiKey: String?
    let createdAt: String?
}

struct NotifyDevice: Codable, Identifiable {
    let id: Int
    let projectId: Int
    let deviceToken: String?
    let name: String?
    let enabled: Bool
    let lastSeen: String?
    let createdAt: String?
}

struct NotifyNotification: Codable, Identifiable {
    let id: Int
    let projectId: Int?
    let title: String
    let body: String?
    let priority: String?
    let createdAt: String?
}

struct NotifyHealthResponse: Codable {
    let reachable: Bool
    let status: String?
    let version: String?
    let uptime: Double?
    let apnsConfigured: Bool?
    let projectsCount: Int?
    let devicesCount: Int?
}

struct NotifyProjectsResponse: Codable {
    let projects: [NotifyProject]
}

struct NotifyDevicesResponse: Codable {
    let devices: [NotifyDevice]
}

struct NotifyNotificationsResponse: Codable {
    let notifications: [NotifyNotification]
}
