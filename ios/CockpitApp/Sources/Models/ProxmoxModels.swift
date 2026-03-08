import Foundation

struct ProxmoxStatusResponse: Decodable {
    let configured: Bool
    let url: String?
    let connected: Bool?
    let error: String?
}

struct ProxmoxNodesResponse: Decodable {
    let nodes: [ProxmoxNode]
}

struct ProxmoxNode: Decodable, Identifiable {
    var id: String { node }
    let node: String
    let status: String
    let uptime: Int
    let cpuPercent: Double
    let memTotal: Double
    let memUsed: Double
    let memPercent: Double
    let diskTotal: Double
    let diskUsed: Double
}

struct ProxmoxResourcesResponse: Decodable {
    let vms: [ProxmoxVM]
}

struct ProxmoxVM: Decodable, Identifiable {
    var id: Int { vmid }
    let vmid: Int
    let name: String
    let type: String
    let status: String
    let node: String
    let cpuPercent: Double
    let memMax: Double
    let memUsed: Double
    let memPercent: Double
    let diskMax: Double
    let diskUsed: Double
    let uptime: Int
    let tags: String?
}

struct VMActionBody: Encodable {
    let action: String
    let node: String
    let type: String
}

struct VMActionResponse: Decodable {
    let ok: Bool
    let vmid: Int?
    let action: String?
    let taskId: String?
}
