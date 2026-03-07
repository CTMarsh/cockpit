import Foundation

struct GraphNode: Codable, Identifiable {
    let id: String
    let label: String
    let type: String?
    let url: String?
}

struct GraphEdge: Codable, Identifiable {
    let source: String
    let target: String
    let label: String?

    var id: String { "\(source)-\(target)" }
}

struct GraphData: Codable {
    let nodes: [GraphNode]
    let edges: [GraphEdge]
}
