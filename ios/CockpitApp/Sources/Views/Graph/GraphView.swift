import SwiftUI
import SpriteKit

struct GraphView: View {
    @ObservedObject private var service = GraphService.shared

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            if let error = service.error {
                VStack(spacing: 12) {
                    ErrorBanner(message: error)
                    Button("Retry") { Task { await service.fetchGraph() } }
                        .tint(Theme.accent)
                }
                .padding()
            } else if service.isLoading {
                LoadingView()
            } else if let data = service.graphData {
                SpriteView(scene: makeScene(data: data), options: [.allowsTransparency])
                    .ignoresSafeArea()
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "point.3.connected.trianglepath.dotted")
                        .font(.system(size: 48))
                        .foregroundStyle(Theme.textMuted)
                    Text("No graph data")
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
        .navigationTitle("Graph")
        .task { await service.fetchGraph() }
    }

    private func makeScene(data: GraphData) -> ForceGraphScene {
        let scene = ForceGraphScene(size: CGSize(width: 400, height: 800))
        scene.scaleMode = .resizeFill
        scene.backgroundColor = .clear
        scene.loadGraph(data: data)
        return scene
    }
}

// MARK: - SpriteKit Force-Directed Graph

class ForceGraphScene: SKScene {
    private var graphNodes: [String: SKShapeNode] = [:]
    private var graphEdges: [(SKShapeNode, String, String)] = []
    private var velocities: [String: CGVector] = [:]
    private var selectedNode: SKShapeNode?

    func loadGraph(data: GraphData) {
        removeAllChildren()
        graphNodes.removeAll()
        graphEdges.removeAll()
        velocities.removeAll()

        let center = CGPoint(x: size.width / 2, y: size.height / 2)

        // Create nodes
        for node in data.nodes {
            let radius: CGFloat = 16
            let shape = SKShapeNode(circleOfRadius: radius)
            shape.fillColor = nodeColor(type: node.type)
            shape.strokeColor = SKColor(red: 0.784, green: 0.569, blue: 0.227, alpha: 0.6) // Theme.accent
            shape.lineWidth = 1.5
            shape.name = node.id

            // Random initial position near center
            let angle = CGFloat.random(in: 0...(2 * .pi))
            let dist = CGFloat.random(in: 20...150)
            shape.position = CGPoint(
                x: center.x + cos(angle) * dist,
                y: center.y + sin(angle) * dist
            )

            let label = SKLabelNode(text: node.label)
            label.fontSize = 10
            label.fontColor = .white
            label.fontName = "Helvetica"
            label.verticalAlignmentMode = .center
            label.horizontalAlignmentMode = .center
            shape.addChild(label)

            addChild(shape)
            graphNodes[node.id] = shape
            velocities[node.id] = .zero
        }

        // Create edges (drawn in update)
        for edge in data.edges {
            let line = SKShapeNode()
            line.strokeColor = SKColor(white: 0.4, alpha: 0.5)
            line.lineWidth = 1
            line.zPosition = -1
            addChild(line)
            graphEdges.append((line, edge.source, edge.target))
        }
    }

    override func update(_ currentTime: TimeInterval) {
        applyForces()
        updateEdges()
    }

    private func applyForces() {
        let ids = Array(graphNodes.keys)
        let damping: CGFloat = 0.9
        let repulsion: CGFloat = 5000
        let attraction: CGFloat = 0.01
        let idealLength: CGFloat = 100

        // Repulsion between all node pairs
        for i in 0..<ids.count {
            for j in (i+1)..<ids.count {
                guard let a = graphNodes[ids[i]], let b = graphNodes[ids[j]] else { continue }
                let dx = a.position.x - b.position.x
                let dy = a.position.y - b.position.y
                let dist = max(sqrt(dx * dx + dy * dy), 1)
                let force = repulsion / (dist * dist)
                let fx = (dx / dist) * force
                let fy = (dy / dist) * force
                velocities[ids[i]]? = CGVector(
                    dx: (velocities[ids[i]]?.dx ?? 0) + fx,
                    dy: (velocities[ids[i]]?.dy ?? 0) + fy
                )
                velocities[ids[j]]? = CGVector(
                    dx: (velocities[ids[j]]?.dx ?? 0) - fx,
                    dy: (velocities[ids[j]]?.dy ?? 0) - fy
                )
            }
        }

        // Attraction along edges
        for (_, src, tgt) in graphEdges {
            guard let a = graphNodes[src], let b = graphNodes[tgt] else { continue }
            let dx = b.position.x - a.position.x
            let dy = b.position.y - a.position.y
            let dist = max(sqrt(dx * dx + dy * dy), 1)
            let force = attraction * (dist - idealLength)
            let fx = (dx / dist) * force
            let fy = (dy / dist) * force
            velocities[src]? = CGVector(
                dx: (velocities[src]?.dx ?? 0) + fx,
                dy: (velocities[src]?.dy ?? 0) + fy
            )
            velocities[tgt]? = CGVector(
                dx: (velocities[tgt]?.dx ?? 0) - fx,
                dy: (velocities[tgt]?.dy ?? 0) - fy
            )
        }

        // Apply velocities with damping
        for id in ids {
            guard let node = graphNodes[id], node != selectedNode else { continue }
            var vel = velocities[id] ?? .zero
            vel.dx *= damping
            vel.dy *= damping
            velocities[id] = vel
            node.position.x += vel.dx * 0.016
            node.position.y += vel.dy * 0.016

            // Keep in bounds
            node.position.x = max(20, min(size.width - 20, node.position.x))
            node.position.y = max(20, min(size.height - 20, node.position.y))
        }
    }

    private func updateEdges() {
        for (line, src, tgt) in graphEdges {
            guard let a = graphNodes[src], let b = graphNodes[tgt] else { continue }
            let path = CGMutablePath()
            path.move(to: a.position)
            path.addLine(to: b.position)
            line.path = path
        }
    }

    private func nodeColor(type: String?) -> SKColor {
        switch type {
        case "bookmark": return SKColor(red: 0.784, green: 0.569, blue: 0.227, alpha: 1) // gold
        case "document": return SKColor(red: 0.4, green: 0.6, blue: 1, alpha: 1) // blue
        case "tag": return SKColor(red: 0.4, green: 0.8, blue: 0.4, alpha: 1) // green
        default: return SKColor(red: 0.6, green: 0.6, blue: 0.6, alpha: 1) // gray
        }
    }

    // MARK: - Touch Handling

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let location = touch.location(in: self)
        let tappedNodes = nodes(at: location)
        selectedNode = tappedNodes.compactMap { $0 as? SKShapeNode }.first(where: { graphNodes.values.contains($0) })
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first, let node = selectedNode else { return }
        node.position = touch.location(in: self)
        if let id = node.name { velocities[id] = .zero }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        selectedNode = nil
    }
}
