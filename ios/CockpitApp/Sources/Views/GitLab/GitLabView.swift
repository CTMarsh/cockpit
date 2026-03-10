import SwiftUI

struct GitLabView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var selectedTab = GitLabTab.issues

    enum GitLabTab: String, CaseIterable {
        case issues = "Issues"
        case mrs = "MRs"
        case pipelines = "Pipelines"
        case releases = "Releases"
        case repo = "Repo"
    }

    var body: some View {
        VStack(spacing: 0) {
            if let error = service.error {
                ErrorBanner(message: error) {
                    service.error = nil
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }

            if let status = service.status, !status.configured {
                notConfiguredView
            } else if service.isLoading && service.projects.isEmpty {
                LoadingView()
                    .frame(maxHeight: .infinity)
            } else {
                // Project picker
                if !service.projects.isEmpty {
                    projectPicker
                        .padding(.horizontal)
                        .padding(.top, 8)
                }

                // Tab bar
                Picker("Tab", selection: $selectedTab) {
                    ForEach(GitLabTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                // Tab content
                switch selectedTab {
                case .issues:
                    GitLabIssuesView()
                case .mrs:
                    GitLabMRsView()
                case .pipelines:
                    GitLabPipelinesView()
                case .releases:
                    GitLabReleasesView()
                case .repo:
                    GitLabRepoView()
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("GitLab")
        .refreshable {
            await service.refreshAll()
        }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
        .onChange(of: service.selectedProjectId) {
            Task {
                await service.fetchIssues()
                await service.fetchMergeRequests()
                await service.fetchPipelines()
                await service.fetchReleases()
                await service.fetchLabels()
            }
        }
    }

    private var notConfiguredView: some View {
        VStack(spacing: 12) {
            Image(systemName: "server.rack")
                .font(.system(size: 48))
                .foregroundStyle(Theme.textMuted)
            Text("GitLab not configured")
                .foregroundStyle(Theme.textMuted)
            Text("Check GitLab connection settings on server")
                .font(.caption)
                .foregroundStyle(Theme.textMuted)
        }
        .frame(maxHeight: .infinity)
    }

    private var projectPicker: some View {
        Menu {
            ForEach(service.projects) { project in
                Button {
                    service.selectedProjectId = project.id
                } label: {
                    HStack {
                        Text(project.nameWithNamespace)
                        if service.selectedProjectId == project.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundStyle(Theme.accent)
                Text(selectedProjectName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(10)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
        }
    }

    private var selectedProjectName: String {
        if let id = service.selectedProjectId,
           let project = service.projects.first(where: { $0.id == id }) {
            return project.nameWithNamespace
        }
        return "Select Project"
    }
}
