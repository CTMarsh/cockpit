import SwiftUI

struct GitLabPipelinesView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var selectedPipeline: GitLabPipeline?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if service.pipelines.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(service.pipelines) { pipeline in
                            PipelineRow(pipeline: pipeline) {
                                selectedPipeline = pipeline
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical, 4)
        }
        .sheet(item: $selectedPipeline) { pipeline in
            PipelineDetailSheet(pipeline: pipeline)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "gear.badge.checkmark")
                .font(.system(size: 36))
                .foregroundStyle(Theme.textMuted)
            Text("No pipelines")
                .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 40)
    }
}

// MARK: - Pipeline Row

private struct PipelineRow: View {
    let pipeline: GitLabPipeline
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                PipelineStatusIcon(status: pipeline.status)
                    .font(.body)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("#\(pipeline.id)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Theme.textMuted)
                        Text(pipeline.ref)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }

                    HStack(spacing: 8) {
                        Text(String(pipeline.sha.prefix(8)))
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.textMuted)
                        if let date = pipeline.createdAt {
                            Text(date.timeAgo)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                }

                Spacer()

                StatusBadge(text: pipeline.status, color: pipelineStatusColor(pipeline.status))

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pipeline Detail Sheet

private struct PipelineDetailSheet: View {
    let pipeline: GitLabPipeline
    @ObservedObject private var service = GitLabService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var jobs: [GitLabJob] = []
    @State private var isLoading = true
    @State private var selectedJob: GitLabJob?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Pipeline #\(pipeline.id)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.textMuted)
                            StatusBadge(text: pipeline.status, color: pipelineStatusColor(pipeline.status))
                        }

                        HStack(spacing: 6) {
                            Image(systemName: "arrow.triangle.branch")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                            Text(pipeline.ref)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.text)
                        }

                        Text(String(pipeline.sha.prefix(8)))
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.textMuted)
                    }

                    // Meta
                    if let date = pipeline.createdAt {
                        HStack {
                            Text("Created")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                            Text(date.formatted)
                                .font(.caption)
                                .foregroundStyle(Theme.text)
                        }
                    }

                    Divider().background(Theme.border)

                    // Jobs
                    Text("Jobs")
                        .font(.headline)
                        .foregroundStyle(Theme.text)

                    if isLoading {
                        LoadingView(message: "Loading jobs...")
                    } else if jobs.isEmpty {
                        Text("No jobs")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textMuted)
                    } else {
                        // Group by stage
                        let stages = orderedStages
                        ForEach(stages, id: \.self) { stage in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(stage.uppercased())
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.textMuted)
                                    .padding(.top, 4)

                                ForEach(jobs.filter { $0.stage == stage }) { job in
                                    JobRow(job: job, onRetry: {
                                        Task {
                                            await service.retryJob(jobId: job.id)
                                            jobs = await service.fetchJobs(pipelineId: pipeline.id)
                                        }
                                    }, onCancel: {
                                        Task {
                                            await service.cancelJob(jobId: job.id)
                                            jobs = await service.fetchJobs(pipelineId: pipeline.id)
                                        }
                                    }, onViewLog: {
                                        selectedJob = job
                                    })
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle("Pipeline #\(pipeline.id)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
            .task {
                jobs = await service.fetchJobs(pipelineId: pipeline.id)
                isLoading = false
            }
            .sheet(item: $selectedJob) { job in
                JobLogSheet(job: job)
            }
        }
    }

    private var orderedStages: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for job in jobs {
            if seen.insert(job.stage).inserted {
                result.append(job.stage)
            }
        }
        return result
    }
}

// MARK: - Job Row

private struct JobRow: View {
    let job: GitLabJob
    let onRetry: () -> Void
    let onCancel: () -> Void
    let onViewLog: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            PipelineStatusIcon(status: job.status)
                .font(.caption)

            VStack(alignment: .leading, spacing: 2) {
                Text(job.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text)

                HStack(spacing: 8) {
                    if let duration = job.duration {
                        Text(formatDuration(duration))
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    StatusBadge(text: job.status, color: pipelineStatusColor(job.status))
                }
            }

            Spacer()

            HStack(spacing: 8) {
                Button(action: onViewLog) {
                    Image(systemName: "doc.text")
                        .font(.caption)
                        .foregroundStyle(Theme.accent)
                }

                if job.status == "failed" {
                    Button(action: onRetry) {
                        Image(systemName: "arrow.clockwise")
                            .font(.caption)
                            .foregroundStyle(Theme.warning)
                    }
                }

                if job.status == "running" || job.status == "pending" {
                    Button(action: onCancel) {
                        Image(systemName: "stop.fill")
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                    }
                }
            }
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
    }

    private func formatDuration(_ seconds: Double) -> String {
        let total = Int(seconds)
        if total < 60 { return "\(total)s" }
        let m = total / 60
        let s = total % 60
        return "\(m)m \(s)s"
    }
}

// MARK: - Job Log Sheet

private struct JobLogSheet: View {
    let job: GitLabJob
    @ObservedObject private var service = GitLabService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var log: String?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView(message: "Loading log...")
                        .frame(maxHeight: .infinity)
                } else if let log, !log.isEmpty {
                    ScrollView(.vertical) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            Text(log)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Theme.text.opacity(0.9))
                                .padding()
                        }
                    }
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 36))
                            .foregroundStyle(Theme.textMuted)
                        Text("No log output")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxHeight: .infinity)
                }
            }
            .background(Theme.background)
            .navigationTitle("\(job.name) log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
            .task {
                log = await service.fetchJobLog(jobId: job.id)
                isLoading = false
            }
        }
    }
}

// MARK: - Pipeline Status Helpers

private struct PipelineStatusIcon: View {
    let status: String

    var body: some View {
        Group {
            switch status {
            case "success":
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Theme.success)
            case "failed":
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Theme.danger)
            case "running":
                Image(systemName: "play.circle.fill")
                    .foregroundStyle(Theme.info)
            case "pending", "waiting_for_resource":
                Image(systemName: "clock.fill")
                    .foregroundStyle(Theme.warning)
            case "canceled", "cancelled":
                Image(systemName: "stop.circle.fill")
                    .foregroundStyle(Theme.textMuted)
            case "skipped":
                Image(systemName: "forward.fill")
                    .foregroundStyle(Theme.textMuted)
            case "created":
                Image(systemName: "circle")
                    .foregroundStyle(Theme.textMuted)
            default:
                Image(systemName: "questionmark.circle")
                    .foregroundStyle(Theme.textMuted)
            }
        }
    }
}

private func pipelineStatusColor(_ status: String) -> Color {
    switch status {
    case "success": Theme.success
    case "failed": Theme.danger
    case "running": Theme.info
    case "pending", "waiting_for_resource": Theme.warning
    case "canceled", "cancelled": Theme.textMuted
    case "skipped": Theme.textMuted
    default: Theme.textMuted
    }
}
