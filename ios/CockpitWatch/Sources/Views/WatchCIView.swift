import SwiftUI

/// Full scrollable CI/CD pipeline list — NavigationLink destination from WatchCIPage.
struct WatchCIView: View {
    @State private var pipelines: [WatchPipelineSummary] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        List {
            if isLoading {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.accent)
                    Spacer()
                }
                .listRowBackground(Color.clear)
            } else if let error {
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                    .listRowBackground(Color.clear)
            } else if pipelines.isEmpty {
                Text("No pipelines")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(pipelines) { pipeline in
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
                            HStack(spacing: 4) {
                                Text(pipeline.ref)
                                    .font(.system(size: 9))
                                    .foregroundStyle(Theme.textMuted)
                                    .lineLimit(1)
                                Text(pipeline.status)
                                    .font(.system(size: 9))
                                    .foregroundStyle(pipelineColor(pipeline.status))
                            }
                        }
                        Spacer()
                    }
                    .listRowBackground(Theme.surface)
                }
            }
        }
        .navigationTitle("CI/CD")
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
            self.error = "Cannot load pipelines"
        }
        isLoading = false
    }
}
