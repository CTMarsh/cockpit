import SwiftUI

struct GitLabIssuesView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var showCreateSheet = false
    @State private var selectedIssue: GitLabIssue?
    @State private var stateFilter = "opened"

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                // State filter
                HStack {
                    Picker("State", selection: $stateFilter) {
                        Text("Open").tag("opened")
                        Text("Closed").tag("closed")
                        Text("All").tag("all")
                    }
                    .pickerStyle(.segmented)

                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Theme.accent)
                    }
                }
                .padding(.horizontal)
                .padding(.top, 4)

                if service.issues.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(service.issues) { issue in
                            IssueRow(issue: issue) {
                                selectedIssue = issue
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.bottom)
        }
        .onChange(of: stateFilter) {
            Task { await service.fetchIssues(state: stateFilter) }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateIssueSheet()
        }
        .sheet(item: $selectedIssue) { issue in
            IssueDetailSheet(issue: issue)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 36))
                .foregroundStyle(Theme.textMuted)
            Text("No \(stateFilter == "opened" ? "open" : stateFilter) issues")
                .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 40)
    }
}

// MARK: - Issue Row

private struct IssueRow: View {
    let issue: GitLabIssue
    let onTap: () -> Void

    private var stateColor: Color {
        issue.state == "opened" ? Theme.success : Theme.danger
    }

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: issue.state == "opened" ? "circle.circle" : "checkmark.circle.fill")
                    .foregroundStyle(stateColor)
                    .font(.body)
                    .padding(.top, 2)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text("#\(issue.iid)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(Theme.textMuted)
                        Text(issue.title)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.text)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    HStack(spacing: 8) {
                        Text(issue.author.name)
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)

                        if let date = issue.createdAt {
                            Text(date.timeAgo)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }

                    if !issue.labels.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(issue.labels.prefix(3), id: \.self) { label in
                                Text(label)
                                    .font(.caption2)
                                    .foregroundStyle(Theme.accent)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.accent.opacity(0.15))
                                    .clipShape(Capsule())
                            }
                            if issue.labels.count > 3 {
                                Text("+\(issue.labels.count - 3)")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textMuted)
                            }
                        }
                    }
                }

                Spacer()

                if let assignee = issue.assignee {
                    Text(String(assignee.name.prefix(2)).uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 26, height: 26)
                        .background(Theme.accent.opacity(0.3))
                        .clipShape(Circle())
                }
            }
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Issue Detail Sheet

private struct IssueDetailSheet: View {
    let issue: GitLabIssue
    @ObservedObject private var service = GitLabService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var notes: [GitLabNote] = []
    @State private var newComment = ""
    @State private var isLoadingNotes = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("#\(issue.iid)")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(Theme.textMuted)
                            StatusBadge(
                                text: issue.state,
                                color: issue.state == "opened" ? Theme.success : Theme.danger
                            )
                        }
                        Text(issue.title)
                            .font(.headline)
                            .foregroundStyle(Theme.text)
                    }

                    // Description
                    if let desc = issue.description, !desc.isEmpty {
                        Text(desc)
                            .font(.subheadline)
                            .foregroundStyle(Theme.text.opacity(0.85))
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }

                    // Meta
                    VStack(alignment: .leading, spacing: 6) {
                        MetaRow(label: "Author", value: issue.author.name)
                        if let assignee = issue.assignee {
                            MetaRow(label: "Assignee", value: assignee.name)
                        }
                        if let date = issue.createdAt {
                            MetaRow(label: "Created", value: date.formatted)
                        }
                    }

                    // Labels
                    if !issue.labels.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Labels")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                            FlowLayout(spacing: 4) {
                                ForEach(issue.labels, id: \.self) { label in
                                    Text(label)
                                        .font(.caption2)
                                        .foregroundStyle(Theme.accent)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Theme.accent.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    Divider().background(Theme.border)

                    // Actions
                    HStack(spacing: 12) {
                        Button {
                            Task {
                                let event = issue.state == "opened" ? "close" : "reopen"
                                await service.updateIssueState(iid: issue.iid, stateEvent: event)
                                dismiss()
                            }
                        } label: {
                            Label(
                                issue.state == "opened" ? "Close Issue" : "Reopen Issue",
                                systemImage: issue.state == "opened" ? "xmark.circle" : "arrow.uturn.left"
                            )
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(issue.state == "opened" ? Theme.danger : Theme.success)
                        }
                        Spacer()
                    }

                    Divider().background(Theme.border)

                    // Comments
                    Text("Comments")
                        .font(.headline)
                        .foregroundStyle(Theme.text)

                    if isLoadingNotes {
                        LoadingView(message: "Loading comments...")
                    } else if notes.isEmpty {
                        Text("No comments yet")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textMuted)
                            .padding(.vertical, 8)
                    } else {
                        LazyVStack(spacing: 8) {
                            ForEach(notes) { note in
                                NoteRow(note: note)
                            }
                        }
                    }

                    // Add comment
                    HStack(spacing: 8) {
                        TextField("Add a comment...", text: $newComment, axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(.subheadline)
                            .foregroundStyle(Theme.text)
                            .padding(10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))

                        Button {
                            let text = newComment
                            newComment = ""
                            Task {
                                await service.addNote(issueIid: issue.iid, body: text)
                                notes = await service.fetchNotes(issueIid: issue.iid)
                            }
                        } label: {
                            Image(systemName: "paperplane.fill")
                                .foregroundStyle(newComment.isEmpty ? Theme.textMuted : Theme.accent)
                        }
                        .disabled(newComment.isEmpty)
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle("Issue #\(issue.iid)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
            .task {
                notes = await service.fetchNotes(issueIid: issue.iid)
                isLoadingNotes = false
            }
        }
    }
}

// MARK: - Create Issue Sheet

private struct CreateIssueSheet: View {
    @ObservedObject private var service = GitLabService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var labels = ""
    @State private var isSubmitting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Title")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        TextField("Issue title", text: $title)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .padding(10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        TextField("Description (optional)", text: $description, axis: .vertical)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .lineLimit(4...8)
                            .padding(10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Labels")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                        TextField("Comma-separated labels", text: $labels)
                            .textFieldStyle(.plain)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .padding(10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle("New Issue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        isSubmitting = true
                        Task {
                            await service.createIssue(
                                title: title,
                                description: description.isEmpty ? nil : description,
                                labels: labels.isEmpty ? nil : labels
                            )
                            dismiss()
                        }
                    }
                    .foregroundStyle(Theme.accent)
                    .disabled(title.isEmpty || isSubmitting)
                }
            }
        }
    }
}

// MARK: - Note Row

private struct NoteRow: View {
    let note: GitLabNote

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(note.author.name)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text)
                Spacer()
                if let date = note.createdAt {
                    Text(date.timeAgo)
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
            }
            Text(note.body)
                .font(.subheadline)
                .foregroundStyle(Theme.text.opacity(0.85))
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - Meta Row

private struct MetaRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.textMuted)
                .frame(width: 70, alignment: .leading)
            Text(value)
                .font(.caption)
                .foregroundStyle(Theme.text)
        }
    }
}

// MARK: - Flow Layout

private struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        for (index, offset) in result.offsets.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + offset.x, y: bounds.minY + offset.y),
                proposal: .unspecified
            )
        }
    }

    private func computeLayout(proposal: ProposedViewSize, subviews: Subviews) -> (offsets: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var offsets: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth, currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            offsets.append(CGPoint(x: currentX, y: currentY))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalWidth = max(totalWidth, currentX - spacing)
        }

        return (offsets, CGSize(width: totalWidth, height: currentY + lineHeight))
    }
}
