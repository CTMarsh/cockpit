import Foundation

struct GraphNode: Codable, Identifiable {
    let id: String
    let label: String
    let type: String?
    let url: String?
    let tags: [String]?
    let module: String?
    let moduleId: String?
}

struct GraphEdge: Codable, Identifiable {
    let source: String
    let target: String
    let label: String?
    let weight: Double?

    var id: String { "\(source)-\(target)" }

    private enum CodingKeys: String, CodingKey {
        case source, target, label, weight
    }
}

struct GraphSummary: Codable {
    let totalNodes: Int
    let totalEdges: Int
}

struct GraphData: Codable {
    let nodes: [GraphNode]
    let edges: [GraphEdge]
    let summary: GraphSummary?
}
