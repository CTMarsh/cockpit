import SwiftUI

struct AnsibleView: View {
    @ObservedObject private var service = AnsibleService.shared
    @State private var selectedPlaybook = ""
    @State private var tags = ""
    @State private var dryRun = false
    @State private var isRunning = false
    @State private var selectedRun: AnsibleRun?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.runs.isEmpty {
                    LoadingView()
                } else {
                    // Run Playbook Section
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Run Playbook")
                            .font(.headline)
                            .foregroundStyle(Theme.text)

                        VStack(spacing: 10) {
                            // Playbook picker
                            HStack {
                                Text("Playbook")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Spacer()
                                Picker("Playbook", selection: $selectedPlaybook) {
                                    Text("Select...").tag("")
                                    ForEach(service.playbooks, id: \.self) { playbook in
                                        Text(playbook).tag(playbook)
                                    }
                                }
                                .tint(Theme.accent)
                            }

                            // Tags field
                            HStack {
                                Text("Tags")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Spacer()
                                TextField("optional", text: $tags)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .font(.body.monospaced())
                                    .multilineTextAlignment(.trailing)
                                    .frame(maxWidth: 180)
                            }

                            // Dry run toggle
                            HStack {
                                Text("Dry Run")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Spacer()
                                Toggle("", isOn: $dryRun)
                                    .tint(Theme.accent)
                                    .labelsHidden()
                            }

                            // Run button
                            Button {
                                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                                isRunning = true
                                Task {
                                    _ = await service.runPlaybook(
                                        playbook: selectedPlaybook,
                                        tags: tags,
                                        extraVars: nil,
                                        dryRun: dryRun
                                    )
                                    isRunning = false
                                }
                            } label: {
                                HStack {
                                    if isRunning {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "play.fill")
                                    }
                                    Text(isRunning ? "Running..." : "Execute")
                                        .font(.body.weight(.semibold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Theme.accent)
                            .disabled(selectedPlaybook.isEmpty || isRunning)
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                    .padding(.horizontal)

                    // History Section
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("History")
                                .font(.headline)
                                .foregroundStyle(Theme.text)
                            Spacer()
                            Text("\(service.runs.count) runs")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }

                        if service.runs.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "terminal")
                                    .font(.system(size: 36))
                                    .foregroundStyle(Theme.textMuted)
                                Text("No runs yet")
                                    .foregroundStyle(Theme.textMuted)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                        } else {
                            LazyVStack(spacing: 8) {
                                ForEach(service.runs) { run in
                                    Button {
                                        selectedRun = run
                                    } label: {
                                        AnsibleRunRow(run: run)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Ansible")
        .sheet(item: $selectedRun) { run in
            AnsibleRunDetailSheet(run: run)
        }
        .refreshable {
            await service.fetchPlaybooks()
            await service.fetchRuns()
        }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }
}

// MARK: - Run Row

private struct AnsibleRunRow: View {
    let run: AnsibleRun
    @ObservedObject private var service = AnsibleService.shared
    @State private var showDeleteConfirm = false

    private var statusColor: Color {
        switch run.status {
        case "success": Theme.success
        case "failed": Theme.danger
        case "running": Theme.info
        default: Theme.textMuted
        }
    }

    private var statusIcon: String {
        switch run.status {
        case "success": "checkmark.circle.fill"
        case "failed": "xmark.circle.fill"
        case "running": "arrow.triangle.2.circlepath"
        default: "clock"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: statusIcon)
                .foregroundStyle(statusColor)
                .font(.body)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(run.playbook)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    if run.dryRun {
                        StatusBadge(text: "dry-run", color: Theme.warning)
                    }
                }
                HStack(spacing: 8) {
                    if let tags = run.tags, !tags.isEmpty {
                        Text(tags)
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.accent)
                    }
                    if let startedAt = run.startedAt {
                        Text(startedAt)
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                    }
                }
            }

            Spacer()

            if let exitCode = run.exitCode {
                Text("exit \(exitCode)")
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textMuted)
            }

            Button(role: .destructive) { showDeleteConfirm = true } label: {
                Image(systemName: "trash")
                    .font(.caption)
            }
            .tint(Theme.danger)
        }
        .padding(10)
        .background(Theme.background.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .confirmationDialog("Delete this run?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await service.deleteRun(id: run.id) }
            }
        }
    }
}

// MARK: - Run Detail Sheet

private struct AnsibleRunDetailSheet: View {
    let run: AnsibleRun
    @Environment(\.dismiss) private var dismiss
    @State private var fullRun: AnsibleRun?

    private var displayRun: AnsibleRun { fullRun ?? run }

    private var statusColor: Color {
        switch displayRun.status {
        case "success": Theme.success
        case "failed": Theme.danger
        case "running": Theme.info
        default: Theme.textMuted
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    HStack {
                        StatusBadge(text: displayRun.status, color: statusColor)
                        if displayRun.dryRun {
                            StatusBadge(text: "dry-run", color: Theme.warning)
                        }
                        Spacer()
                        if let exitCode = displayRun.exitCode {
                            Text("exit \(exitCode)")
                                .font(.caption.monospaced())
                                .foregroundStyle(Theme.textMuted)
                        }
                    }

                    // Metadata
                    VStack(alignment: .leading, spacing: 6) {
                        if let tags = displayRun.tags, !tags.isEmpty {
                            HStack {
                                Text("Tags:")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Text(tags)
                                    .font(.subheadline.monospaced())
                                    .foregroundStyle(Theme.text)
                            }
                        }
                        if let extraVars = displayRun.extraVars, !extraVars.isEmpty {
                            HStack {
                                Text("Extra Vars:")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Text(extraVars)
                                    .font(.subheadline.monospaced())
                                    .foregroundStyle(Theme.text)
                            }
                        }
                        if let startedAt = displayRun.startedAt {
                            HStack {
                                Text("Started:")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Text(startedAt)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text)
                            }
                        }
                        if let completedAt = displayRun.completedAt {
                            HStack {
                                Text("Completed:")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textMuted)
                                Text(completedAt)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text)
                            }
                        }
                    }

                    // Output
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Output")
                            .font(.headline)
                            .foregroundStyle(Theme.text)

                        if let output = displayRun.output, !output.isEmpty {
                            ScrollView(.horizontal, showsIndicators: true) {
                                Text(output)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(Theme.text)
                                    .textSelection(.enabled)
                            }
                            .padding(10)
                            .background(Theme.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                        } else {
                            Text("No output available")
                                .font(.subheadline)
                                .foregroundStyle(Theme.textMuted)
                                .padding(.vertical, 8)
                        }
                    }
                }
                .padding()
            }
            .background(Theme.surface)
            .navigationTitle(displayRun.playbook)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            fullRun = await AnsibleService.shared.getRun(id: run.id)
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task {
                fullRun = await AnsibleService.shared.getRun(id: run.id)
            }
        }
    }
}
