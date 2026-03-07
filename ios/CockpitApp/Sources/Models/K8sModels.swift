import Foundation

struct K8sWorkload: Codable, Identifiable {
    let name: String
    let namespace: String
    let type: String
    let ready: Int
    let desired: Int
    let image: String
    let age: String
    let conditions: [K8sCondition]?

    var id: String { "\(namespace)/\(name)" }
    var isReady: Bool { ready >= desired && desired > 0 }
}

struct K8sCondition: Codable {
    let type: String
    let status: String
}

struct K8sEvent: Codable, Identifiable {
    let type: String
    let reason: String
    let message: String
    let object: String
    let namespace: String
    let count: Int
    let lastSeen: String

    var id: String { "\(namespace)/\(object)/\(reason)/\(lastSeen)" }
    var isWarning: Bool { type == "Warning" }
}

struct WorkloadsResponse: Codable {
    let available: Bool
    let workloads: [K8sWorkload]
}

struct NamespacesResponse: Codable {
    let available: Bool
    let namespaces: [String]
}

struct EventsResponse: Codable {
    let available: Bool
    let events: [K8sEvent]
}

struct PodLogsResponse: Codable {
    let logs: String
    let error: String?
}

struct K8sActionResponse: Codable {
    let success: Bool
    let message: String
}
