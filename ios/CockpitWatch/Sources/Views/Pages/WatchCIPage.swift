import SwiftUI

/// Compact CI/CD page for vertical TabView — single screen, no scroll.
struct WatchCIPage: View {
    @State private var pipelines: [WatchPipelineSummary] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 6) {
            if isLoading {
                Spacer()
                ProgressView().tint(Theme.accent)
                Spacer()
            } else if let error {
                Spacer()
                Image(systemName: "hammer.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.danger)
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                Spacer()
            } else if pipelines.isEmpty {
                Spacer()
                Image(systemName: "hammer.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.textMuted)
                Text("No pipelines")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
            } else {
                // Header
                HStack {
                    Text("CI/CD")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Spacer()
                    let passed = pipelines.filter { $0.status == "success" }.count
                    Text("\(passed)/\(pipelines.count)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(passed == pipelines.count ? Theme.success : Theme.warning)
                }

                // Show first 3 pipelines
                ForEach(pipelines.prefix(3)) { pipeline in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(pipelineColor(pipeline.status))
                            .frame(width: 7, height: 7)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(pipeline.projectName)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Text(pipeline.ref)
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.textMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(pipeline.status)
                            .font(.system(size: 9))
                            .foregroundStyle(pipelineColor(pipeline.status))
                    }
                }

                if pipelines.count > 3 {
                    NavigationLink(destination: WatchCIView()) {
                        HStack {
                            Text("All \(pipelines.count) pipelines")
                                .font(.caption2)
                                .foregroundStyle(Theme.accent)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 8)
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchData() }
    }

    private func pipelineColor(_ status: String) -> Color {
        switch status {
        case "success": return Theme.success
        case "failed": return Theme.danger
        case "running": return .blue
        case "pending": return Theme.warning
        default: return Theme.textMuted
        }
    }

    private func fetchData() async {
        isLoading = true
        do {
            let r: WatchPipelineSummaryResponse = try await WatchAPIClient.shared.request(path: "/api/gitlab/pipelines/summary")
            pipelines = r.pipelines
        } catch {
            self.error = "Cannot load CI/CD"
        }
        isLoading = false
    }
}

// MARK: - Models

struct WatchPipelineSummary: Codable, Identifiable {
    let projectId: Int
    let projectName: String
    let pipelineId: Int
    let status: String
    let ref: String
    let createdAt: String?
    let webUrl: String?

    var id: Int { pipelineId }
}

struct WatchPipelineSummaryResponse: Codable {
    let pipelines: [WatchPipelineSummary]
}
