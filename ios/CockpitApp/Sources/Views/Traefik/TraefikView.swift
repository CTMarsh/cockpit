import SwiftUI

struct TraefikView: View {
    @ObservedObject private var service = TraefikService.shared
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Routes").tag(0)
                Text("Middlewares").tag(1)
                Text("Entrypoints").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if service.isLoading {
                LoadingView()
            } else {
                ScrollView {
                    switch selectedTab {
                    case 0: routesContent
                    case 1: middlewaresContent
                    case 2: entrypointsContent
                    default: EmptyView()
                    }
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("Traefik Routes")
        .refreshable {
            await service.fetchAll()
        }
        .task {
            await service.fetchAll()
        }
    }

    // MARK: - Routes Tab

    private var routesContent: some View {
        LazyVStack(spacing: 10) {
            if service.ingressRoutes.isEmpty {
                emptyState(icon: "arrow.triangle.branch", text: "No IngressRoutes found")
            }
            ForEach(service.ingressRoutes) { route in
                IngressRouteCard(route: route)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    // MARK: - Middlewares Tab

    private var middlewaresContent: some View {
        LazyVStack(spacing: 10) {
            if service.middlewares.isEmpty {
                emptyState(icon: "slider.horizontal.3", text: "No middlewares found")
            }
            ForEach(service.middlewares) { middleware in
                MiddlewareCard(middleware: middleware)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    // MARK: - Entrypoints Tab

    private var entrypointsContent: some View {
        LazyVStack(spacing: 10) {
            if service.entrypoints.isEmpty {
                emptyState(icon: "door.left.hand.open", text: "No entrypoints found")
            }
            ForEach(service.entrypoints) { ep in
                EntrypointCard(entrypoint: ep)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    private func emptyState(icon: String, text: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Theme.textMuted)
            Text(text)
                .foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

// MARK: - IngressRoute Card

private struct IngressRouteCard: View {
    let route: TraefikIngressRoute

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(route.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(route.namespace)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
                Spacer()
                if route.tls != nil {
                    StatusBadge(text: "TLS", color: Theme.success)
                } else {
                    StatusBadge(text: "HTTP", color: Theme.warning)
                }
            }

            if let entryPoints = route.entryPoints, !entryPoints.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "door.left.hand.open")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                    Text(entryPoints.joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            }

            ForEach(route.routes) { r in
                VStack(alignment: .leading, spacing: 4) {
                    Text(r.match)
                        .font(.caption.monospaced())
                        .foregroundStyle(Theme.accent)
                        .lineLimit(2)

                    if let services = r.services {
                        ForEach(services) { svc in
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.right")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textMuted)
                                Text("\(svc.name)")
                                    .font(.caption)
                                    .foregroundStyle(Theme.text)
                                if let port = svc.port {
                                    Text(":\(port)")
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.textMuted)
                                }
                                if let kind = svc.kind, kind != "Service" {
                                    Text("(\(kind))")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.info)
                                }
                            }
                        }
                    }

                    if let middlewares = r.middlewares, !middlewares.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "slider.horizontal.3")
                                .font(.caption2)
                                .foregroundStyle(Theme.textMuted)
                            Text(middlewares.map(\.name).joined(separator: ", "))
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                }
                .padding(8)
                .background(Theme.background)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - Middleware Card

private struct MiddlewareCard: View {
    let middleware: TraefikMiddleware

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(middleware.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(middleware.namespace)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
                Spacer()
                StatusBadge(text: middleware.type, color: Theme.info)
            }

            if let config = middleware.config, !config.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(config.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                        HStack(spacing: 4) {
                            Text(key)
                                .font(.caption.monospaced())
                                .foregroundStyle(Theme.textMuted)
                            Text(value)
                                .font(.caption.monospaced())
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(8)
                .background(Theme.background)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - Entrypoint Card

private struct EntrypointCard: View {
    let entrypoint: TraefikEntrypoint

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entrypoint.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                Text(entrypoint.address)
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textMuted)
            }
            Spacer()
            Image(systemName: entrypoint.name == "websecure" ? "lock.fill" : "globe")
                .foregroundStyle(entrypoint.name == "websecure" ? Theme.success : Theme.info)
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}
