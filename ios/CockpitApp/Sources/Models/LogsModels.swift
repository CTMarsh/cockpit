import Foundation

struct LogSource: Codable, Identifiable {
    let id: String
    let name: String
    let state: String?
    let type: String
}

struct LogSourcesResponse: Codable {
    let sources: [LogSource]
}

struct ContainerLogsResponse: Codable {
    let lines: [String]
    let containerId: String?
    let count: Int
}

struct SystemLogsResponse: Codable {
    let lines: [String]
    let unit: String?
    let count: Int
}

struct SystemUnit: Codable, Identifiable {
    let name: String
    let load: String
    let active: String
    let sub: String

    var id: String { name }
    var isRunning: Bool { active == "active" && sub == "running" }
}

struct SystemUnitsResponse: Codable {
    let units: [SystemUnit]
}
