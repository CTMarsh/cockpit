import Foundation

struct TraefikIngressRoute: Codable, Identifiable {
    let name: String
    let namespace: String
    let entryPoints: [String]?
    let routes: [TraefikRoute]
    let tls: TraefikTLS?

    var id: String { "\(namespace)/\(name)" }
}

struct TraefikRoute: Codable, Identifiable {
    let match: String
    let services: [TraefikRouteService]?
    let middlewares: [TraefikRouteMiddleware]?

    var id: String { match }
}

struct TraefikRouteService: Codable, Identifiable {
    let name: String
    let namespace: String?
    let port: Int?
    let kind: String?

    var id: String { "\(namespace ?? "")/\(name)" }
}

struct TraefikRouteMiddleware: Codable, Identifiable {
    let name: String
    let namespace: String?

    var id: String { "\(namespace ?? "")/\(name)" }
}

struct TraefikTLS: Codable {
    let certResolver: String?
    let domains: [TraefikTLSDomain]?
    let secretName: String?
}

struct TraefikTLSDomain: Codable, Identifiable {
    let main: String?
    let sans: [String]?

    var id: String { main ?? UUID().uuidString }
}

struct TraefikMiddleware: Codable, Identifiable {
    let name: String
    let namespace: String
    let type: String
    let config: [String: String]?

    var id: String { "\(namespace)/\(name)" }
}

struct TraefikEntrypoint: Codable, Identifiable {
    let name: String
    let address: String

    var id: String { name }
}

struct TraefikOverview: Codable {
    let routeCount: Int
    let middlewareCount: Int
    let entrypointCount: Int
}

struct IngressRoutesResponse: Codable {
    let ok: Bool
    let ingressRoutes: [TraefikIngressRoute]
}

struct MiddlewaresResponse: Codable {
    let ok: Bool
    let middlewares: [TraefikMiddleware]
}

struct EntrypointsResponse: Codable {
    let ok: Bool
    let entrypoints: [TraefikEntrypoint]
}

struct TraefikOverviewResponse: Codable {
    let ok: Bool
    let overview: TraefikOverview
}
