import SwiftUI

struct GitLabReleasesView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var selectedRelease: GitLabRelease?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                if service.releases.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(service.releases) { release in
                            ReleaseRow(release: release) {
                                selectedRelease = release
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical, 4)
        }
        .task {
            await service.fetchReleases()
        }
        .sheet(item: $selectedRelease) { release in
            ReleaseDetailSheet(release: release)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tag")
                .font(.system(size: 36))
                .foregroundStyle(Theme.textMuted)
            Text("No releases")
                .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 40)
    }
}

// MARK: - Release Row

private struct ReleaseRow: View {
    let release: GitLabRelease
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: "tag.fill")
                    .foregroundStyle(Theme.accent)
                    .font(.body)

                VStack(alignment: .leading, spacing: 4) {
                    Text(release.name ?? release.tagName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        Text(release.tagName)
                            .font(.caption.monospaced())
                            .foregroundStyle(Theme.accent)

                        if let date = release.releasedAt ?? release.createdAt {
                            Text(date.timeAgo)
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                }

                Spacer()

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

// MARK: - Release Detail Sheet

private struct ReleaseDetailSheet: View {
    let release: GitLabRelease
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        Text(release.name ?? release.tagName)
                            .font(.headline)
                            .foregroundStyle(Theme.text)

                        HStack(spacing: 8) {
                            Image(systemName: "tag.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                            Text(release.tagName)
                                .font(.caption.monospaced())
                                .foregroundStyle(Theme.accent)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Theme.accent.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }

                    // Dates
                    VStack(alignment: .leading, spacing: 6) {
                        if let date = release.releasedAt {
                            HStack {
                                Text("Released")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textMuted)
                                    .frame(width: 70, alignment: .leading)
                                Text(date.formatted)
                                    .font(.caption)
                                    .foregroundStyle(Theme.text)
                            }
                        }
                        if let date = release.createdAt {
                            HStack {
                                Text("Created")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textMuted)
                                    .frame(width: 70, alignment: .leading)
                                Text(date.formatted)
                                    .font(.caption)
                                    .foregroundStyle(Theme.text)
                            }
                        }
                    }

                    // Description / Release Notes
                    if let desc = release.description, !desc.isEmpty {
                        Divider().background(Theme.border)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Release Notes")
                                .font(.headline)
                                .foregroundStyle(Theme.text)

                            Text(desc)
                                .font(.subheadline)
                                .foregroundStyle(Theme.text.opacity(0.85))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .padding()
            }
            .background(Theme.background)
            .navigationTitle(release.tagName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
    }
}
