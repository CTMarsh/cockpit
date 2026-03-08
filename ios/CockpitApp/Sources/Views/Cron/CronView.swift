import SwiftUI

struct CronView: View {
    @ObservedObject private var service = CronService.shared
    @State private var showCreateJob = false

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.jobs.isEmpty {
                    LoadingView()
                } else if service.jobs.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "clock")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("No cron jobs")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    // Summary
                    let enabled = service.jobs.filter(\.isEnabled).count
                    let failed = service.jobs.filter { $0.lastRun?.exitCode != 0 && $0.lastRun != nil }.count

                    HStack {
                        StatusBadge(text: "\(enabled)/\(service.jobs.count) enabled", color: Theme.success)
                        if failed > 0 {
                            StatusBadge(text: "\(failed) failed", color: Theme.danger)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)

                    LazyVStack(spacing: 10) {
                        ForEach(service.jobs) { job in
                            CronJobCard(job: job)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Cron Jobs")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showCreateJob = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateJob) {
            CreateCronJobSheet()
        }
        .refreshable { await service.fetchJobs() }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }
}

// MARK: - Create Sheet

private struct CreateCronJobSheet: View {
    @ObservedObject private var service = CronService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var schedule = ""
    @State private var command = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Job Name") {
                    TextField("Backup databases", text: $name)
                }
                Section("Schedule (cron expression)") {
                    TextField("0 * * * *", text: $schedule)
                        .textInputAutocapitalization(.never)
                        .font(.body.monospaced())
                }
                Section("Command") {
                    TextField("/usr/bin/backup.sh", text: $command)
                        .textInputAutocapitalization(.never)
                        .font(.body.monospaced())
                }
            }
            .navigationTitle("New Cron Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        isSaving = true
                        Task {
                            await service.createJob(name: name, schedule: schedule, command: command)
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty || schedule.isEmpty || command.isEmpty || isSaving)
                }
            }
        }
    }
}

// MARK: - Job Card

private struct CronJobCard: View {
    let job: CronJob
    @ObservedObject private var service = CronService.shared
    @State private var showRuns = false
    @State private var runs: [CronRun] = []
    @State private var isRunning = false
    @State private var showDeleteConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(job.schedule)
                        .font(.caption.monospaced())
                        .foregroundStyle(Theme.textMuted)
                }

                Spacer()

                Toggle("", isOn: Binding(
                    get: { job.isEnabled },
                    set: { newValue in
                        Task { await service.toggleJob(id: job.id, enabled: newValue) }
                    }
                ))
                .tint(Theme.accent)
                .labelsHidden()
            }

            // Last run status
            if let lastRun = job.lastRun {
                HStack(spacing: 6) {
                    Image(systemName: lastRun.succeeded ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundStyle(lastRun.succeeded ? Theme.success : Theme.danger)
                        .font(.caption)
                    if let exitCode = lastRun.exitCode {
                        Text("Exit \(exitCode)")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    Spacer()
                }
            }

            HStack(spacing: 12) {
                Button {
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    isRunning = true
                    Task {
                        _ = await service.runJob(id: job.id)
                        isRunning = false
                    }
                } label: {
                    if isRunning {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Label("Run", systemImage: "play.fill")
                            .font(.caption)
                    }
                }
                .tint(Theme.accent)
                .disabled(isRunning)

                Button {
                    showRuns.toggle()
                    if showRuns && runs.isEmpty {
                        Task { runs = await service.fetchRuns(jobId: job.id) }
                    }
                } label: {
                    Label("History", systemImage: "clock.arrow.circlepath")
                        .font(.caption)
                }
                .tint(Theme.textMuted)

                Spacer()

                Button(role: .destructive) { showDeleteConfirm = true } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                }
                .tint(Theme.danger)
            }

            if showRuns && !runs.isEmpty {
                VStack(spacing: 4) {
                    ForEach(runs) { run in
                        HStack {
                            Image(systemName: run.succeeded ? "checkmark" : "xmark")
                                .font(.caption2)
                                .foregroundStyle(run.succeeded ? Theme.success : Theme.danger)
                            Text(run.startedAt ?? "—")
                                .font(.caption2.monospaced())
                                .foregroundStyle(Theme.textMuted)
                            Spacer()
                            if let exitCode = run.exitCode {
                                Text("exit \(exitCode)")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(Theme.textMuted)
                            }
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        .confirmationDialog("Delete \(job.name)?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await service.deleteJob(id: job.id) }
            }
        }
    }
}
