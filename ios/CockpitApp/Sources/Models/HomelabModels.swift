import Foundation

struct ServiceStatus: Decodable, Identifiable {
    let id: Int
    let name: String
    let url: String
    let status: String?
    let responseTime: Int?
    let lastChecked: String?
    let category: String?
    let icon: String?
    let enabled: Int?
}

struct DockerContainer: Decodable, Identifiable {
    let id: String
    let name: String
    let image: String
    let state: String
    let status: String
    let hostId: Int?
}

struct DockerHost: Decodable, Identifiable {
    let id: Int
    let name: String
    let url: String
    let enabled: Int
}
