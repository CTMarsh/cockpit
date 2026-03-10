import SwiftUI

struct GitLabMRsView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var selectedMR: GitLabMR?
    @State private var stateFilter = "opened"

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Picker("State", selection: $stateFilter) {
                    Text("Open").tag("opened")
                    Text("Merged").tag("merged")
                    Text("Closed").tag("closed")
                    Text("All").tag("all")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.top, 4)

                if service.mergeRequests.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(service.mergeRequests) { mr in
                            MRRow(mr: mr) {
                                selectedMR = mr
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
        .onChange(of: stateFilter) {
            Task { await service.fetchMergeRequests(state: stateFilter) }
        }
        .sheet(item: $selectedMR) { mr in
            MRDetailSheet(mr: mr)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.triangle.merge")
                .font(.system(size: 36))
                .foregroundStyle(Theme.textMuted)
            Text("No \(stateFilter == "opened" ? "open" : stateFilter) merge requests")
                .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 40)
    }
}

// MARK: - MR Row

private struct MRRow: View {
    let mr: GitLabMR
    let onTap: () -> Void

    private var stateColor: Color {
        switch mr.state {
        case "opened": Theme.success
        case "merged": Theme.info
        case "closed": Theme.danger
        default: Theme.textMuted
        }
    }

    private var stateIcon: String {
        switch mr.state {
        case "opened": "arrow.triangle.pull"
        case "merged": "arrow.triangle.merge"
        case "closed": "xmark.circle"
        default: "questionmark.circle"
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: stateIcon)
                    .foregroundStyle(stateColor)
                    .font(.body)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("!\(mr.iid)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Theme.textMuted)
                        Text(mr.title)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    HStack(spacing: 4) {
                        Text(mr.sourceBranch)
                            .font(.caption2.monospaced())
                            .foregroundStyle(Theme.accent)
                            .lineLimit(1)
                        Image(systemName: "arrow.right")
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                        Text(mr.targetBranch)
                            .font(.caption2.monospaced())
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }

                    HStack(spacing: 8) {
                        Text(mr.author.name)
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        if let date = mr.createdAt {
                            Text(date.timeAgo)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                        if let count = mr.userNotesCount, count > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "text.bubble")
                                    .font(.caption2)
                                Text("\(count)")
                                    .font(.caption2)
                            }
                            .foregroundStyle(Theme.textMuted)
                        }
                    }

                    if mr.hasConflicts == true {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2)
                            Text("Has conflicts")
                                .font(.caption2)
                        }
                        .foregroundStyle(Theme.warning)
                    }
                }

                Spacer()
            }
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - MR Detail Sheet

private struct MRDetailSheet: View {
    let mr: GitLabMR
    @ObservedObject private var service = GitLabService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var changes: GitLabChangesResponse?
    @State private var isLoadingChanges = true
    @State private var confirmMerge = false
    @State private var confirmApprove = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("!\(mr.iid)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.textMuted)
                            StatusBadge(
                                text: mr.state,
                                color: stateColor
                            )
                            if mr.hasConflicts == true {
                                StatusBadge(text: "conflicts", color: Theme.warning)
                            }
                        }
                        Text(mr.title)
                            .font(.headline)
                            .foregroundStyle(Theme.text)
                    }

                    // Branch info
                    HStack(spacing: 6) {
                        Text(mr.sourceBranch)
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Theme.accent.opacity(0.1))
                            .clipShape(Capsule())
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        Text(mr.targetBranch)
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Theme.border)
                            .clipShape(Capsule())
                    }

                    // Meta
                    VStack(alignment: .leading, spacing: 6) {
                        MRMetaRow(label: "Author", value: mr.author.name)
                        if let mergeStatus = mr.mergeStatus {
                            MRMetaRow(label: "Merge Status", value: mergeStatus.replacingOccurrences(of: "_", with: " "))
                        }
                        if let date = mr.createdAt {
                            MRMetaRow(label: "Created", value: date.formatted)
                        }
                        if let date = mr.updatedAt {
                            MRMetaRow(label: "Updated", value: date.formatted)
                        }
                    }

                    // Actions
                    if mr.state == "opened" {
                        Divider().background(Theme.border)

                        HStack(spacing: 12) {
                            Button {
                                confirmApprove = true
                            } label: {
                                Label("Approve", systemImage: "hand.thumbsup.fill")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.success)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Theme.success.opacity(0.15))
                                    .clipShape(Capsule())
                            }

                            Button {
                                confirmMerge = true
                            } label: {
                                Label("Merge", systemImage: "arrow.triangle.merge")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.info)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Theme.info.opacity(0.15))
                                    .clipShape(Capsule())
                            }
                            .disabled(mr.hasConflicts == true)

                            Spacer()
                        }
                    }

                    Divider().background(Theme.border)

                    // Changes
                    Text("Changes")
                        .font(.headline)
                        .foregroundStyle(Theme.text)

                    if isLoadingChanges {
                        LoadingView(message: "Loading diff...")
                    } else if let changes, !changes.changes.isEmpty {
                        if let count = changes.changesCount {
                            Text("\(count) file\(count == 1 ? "" : "s") changed")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }

                        LazyVStack(spacing: 8) {
                            ForEach(changes.changes) { change in
                                DiffFileRow(change: change)
                            }
                        }
                    } else {
                        Text("No changes")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textMuted)
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle("MR !\(mr.iid)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
            .task {
                changes = await service.fetchMRChanges(iid: mr.iid)
                isLoadingChanges = false
            }
            .confirmationDialog("Approve this MR?", isPresented: $confirmApprove, titleVisibility: .visible) {
                Button("Approve") {
                    Task {
                        await service.approveMR(iid: mr.iid)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .confirmationDialog("Merge this MR?", isPresented: $confirmMerge, titleVisibility: .visible) {
                Button("Merge") {
                    Task {
                        await service.mergeMR(iid: mr.iid)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var stateColor: Color {
        switch mr.state {
        case "opened": Theme.success
        case "merged": Theme.info
        case "closed": Theme.danger
        default: Theme.textMuted
        }
    }
}

// MARK: - Diff File Row

private struct DiffFileRow: View {
    let change: GitLabDiffChange
    @State private var expanded = false

    private var fileIcon: String {
        if change.newFile == true { return "plus.circle.fill" }
        if change.deletedFile == true { return "minus.circle.fill" }
        return "pencil.circle.fill"
    }

    private var fileColor: Color {
        if change.newFile == true { return Theme.success }
        if change.deletedFile == true { return Theme.danger }
        return Theme.accent
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: fileIcon)
                        .font(.caption)
                        .foregroundStyle(fileColor)
                    Text(change.newPath)
                        .font(.caption.monospaced())
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
                .padding(10)
            }
            .buttonStyle(.plain)

            if expanded {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(change.diff)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.text.opacity(0.85))
                        .padding(8)
                }
                .background(Theme.background)
            }
        }
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - MR Meta Row

private struct MRMetaRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.textMuted)
                .frame(width: 90, alignment: .leading)
            Text(value)
                .font(.caption)
                .foregroundStyle(Theme.text)
        }
    }
}
