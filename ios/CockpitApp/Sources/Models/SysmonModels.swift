import Foundation

struct ClusterMetrics: Decodable {
    let configured: Bool
    let nodeCount: Int?
    let onlineCount: Int?
    let cpu: ClusterCPU?
    let memory: ClusterMemory?
    let disk: ClusterDisk?
    let timestamp: String?
}

struct ClusterCPU: Decodable {
    let cores: Int
    let usedPercent: Double
}

struct ClusterMemory: Decodable {
    let totalGb: Double
    let usedGb: Double
    let percent: Double

    enum CodingKeys: String, CodingKey {
        case totalGb = "totalGB"
        case usedGb = "usedGB"
        case percent
    }
}

struct ClusterDisk: Decodable {
    let totalGb: Double
    let usedGb: Double
    let percent: Double

    enum CodingKeys: String, CodingKey {
        case totalGb = "totalGB"
        case usedGb = "usedGB"
        case percent
    }
}

struct SysmonNodesResponse: Decodable {
    let nodes: [SysmonNode]
}

struct SysmonNode: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let status: String
    let uptime: Int
    let cpu: NodeCPU
    let memory: NodeMemory
    let disk: NodeDisk
}

struct NodeCPU: Decodable {
    let cores: Int
    let percent: Double
}

struct NodeMemory: Decodable {
    let totalGb: Double
    let usedGb: Double
    let percent: Double

    enum CodingKeys: String, CodingKey {
        case totalGb = "totalGB"
        case usedGb = "usedGB"
        case percent
    }
}

struct NodeDisk: Decodable {
    let totalGb: Double
    let usedGb: Double
    let percent: Double

    enum CodingKeys: String, CodingKey {
        case totalGb = "totalGB"
        case usedGb = "usedGB"
        case percent
    }
}

struct PodsResponse: Decodable {
    let available: Bool
    let pods: [K8sPod]?
}

struct K8sPod: Decodable, Identifiable {
    var id: String { name + namespace }
    let name: String
    let namespace: String
    let status: String
    let ready: String
    let restarts: Int
    let age: String?
    let node: String?
}
