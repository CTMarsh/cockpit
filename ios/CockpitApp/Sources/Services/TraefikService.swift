import Foundation

@MainActor final class TraefikService: ObservableObject {
    static let shared = TraefikService()
    @Published var ingressRoutes: [TraefikIngressRoute] = []
    @Published var middlewares: [TraefikMiddleware] = []
    @Published var entrypoints: [TraefikEntrypoint] = []
    @Published var overview: TraefikOverview?
    @Published var isLoading = false
    @Published var error: String?

    func fetchOverview() async {
        do {
            let resp: TraefikOverviewResponse = try await APIClient.shared.request(path: "/api/traefik/overview")
            overview = resp.overview
        } catch { self.error = error.localizedDescription }
    }

    func fetchIngressRoutes() async {
        isLoading = ingressRoutes.isEmpty
        do {
            let resp: IngressRoutesResponse = try await APIClient.shared.request(path: "/api/traefik/ingressroutes")
            ingressRoutes = resp.ingressRoutes
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchMiddlewares() async {
        isLoading = middlewares.isEmpty
        do {
            let resp: MiddlewaresResponse = try await APIClient.shared.request(path: "/api/traefik/middlewares")
            middlewares = resp.middlewares
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchEntrypoints() async {
        isLoading = entrypoints.isEmpty
        do {
            let resp: EntrypointsResponse = try await APIClient.shared.request(path: "/api/traefik/entrypoints")
            entrypoints = resp.entrypoints
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchAll() async {
        isLoading = ingressRoutes.isEmpty
        await fetchOverview()
        await fetchIngressRoutes()
        await fetchMiddlewares()
        await fetchEntrypoints()
        isLoading = false
    }
}
