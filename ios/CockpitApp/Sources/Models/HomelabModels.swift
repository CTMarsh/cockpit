import Foundation

struct ServicesResponse: Decodable {
    let services: [ServiceStatus]
    let summary: ServiceSummary?
}

struct ServiceSummary: Decodable {
    let total: Int
    let up: Int
    let down: Int
}

struct ServiceStatus: Decodable, Identifiable {
    let id: String
    let name: String
    let url: String
    let status: String?
    let responseTime: Int?
    let lastChecked: String?
    let icon: String?
    let statusCode: Int?
    let uptimePercent: Double?

    var isUp: Bool { status == "up" }
}

struct ContainersResponse: Decodable {
    let containers: [DockerContainer]
    let hosts: [DockerHost]
}

struct DockerContainer: Decodable, Identifiable {
    let id: String
    let name: String
    let image: String
    let state: String
    let status: String
    let ports: [String]?
    let created: Int?
    let host: String?
    let hostUrl: String?
}

struct DockerHost: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let url: String
    let status: String?
    let containerCount: Int?
    let error: String?
}
