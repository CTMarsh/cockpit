import SwiftUI

struct GitLabRepoView: View {
    @ObservedObject private var service = GitLabService.shared
    @State private var treeItems: [GitLabTreeItem] = []
    @State private var pathStack: [String] = []
    @State private var isLoading = true

    private var currentPath: String {
        pathStack.joined(separator: "/")
    }

    var body: some View {
        VStack(spacing: 0) {
            // Breadcrumb
            if !pathStack.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        Button {
                            pathStack.removeAll()
                            Task { await loadTree() }
                        } label: {
                            Image(systemName: "house.fill")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                        }

                        ForEach(Array(pathStack.enumerated()), id: \.offset) { index, segment in
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundStyle(Theme.textMuted)

                            Button {
                                pathStack = Array(pathStack.prefix(index + 1))
                                Task { await loadTree() }
                            } label: {
                                Text(segment)
                                    .font(.caption)
                                    .foregroundStyle(index == pathStack.count - 1 ? Theme.text : Theme.accent)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
                .background(Theme.surface)
            }

            // Tree content
            ScrollView {
                if isLoading {
                    LoadingView(message: "Loading files...")
                } else if treeItems.isEmpty {
                    emptyState
                } else {
                    LazyVStack(spacing: 0) {
                        // Back button when in subdirectory
                        if !pathStack.isEmpty {
                            Button {
                                pathStack.removeLast()
                                Task { await loadTree() }
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "arrow.left")
                                        .font(.caption)
                                        .foregroundStyle(Theme.accent)
                                    Text("..")
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.textMuted)
                                    Spacer()
                                }
                                .padding(.horizontal)
                                .padding(.vertical, 10)
                            }
                            .buttonStyle(.plain)

                            Divider().background(Theme.border).padding(.horizontal)
                        }

                        ForEach(sortedItems) { item in
                            TreeItemRow(item: item) {
                                if item.type == "tree" {
                                    pathStack.append(item.name)
                                    Task { await loadTree() }
                                }
                            }

                            if item.id != sortedItems.last?.id {
                                Divider().background(Theme.border).padding(.horizontal)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .task {
            await loadTree()
        }
    }

    private var sortedItems: [GitLabTreeItem] {
        // Directories first, then files, alphabetically
        treeItems.sorted { a, b in
            if a.type == b.type { return a.name < b.name }
            return a.type == "tree"
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "folder")
                .font(.system(size: 36))
                .foregroundStyle(Theme.textMuted)
            Text("Empty directory")
                .foregroundStyle(Theme.textMuted)
        }
        .padding(.top, 40)
    }

    private func loadTree() async {
        isLoading = true
        treeItems = await service.fetchTree(path: currentPath)
        isLoading = false
    }
}

// MARK: - Tree Item Row

private struct TreeItemRow: View {
    let item: GitLabTreeItem
    let onTap: () -> Void

    private var icon: String {
        switch item.type {
        case "tree": "folder.fill"
        case "blob": fileIcon
        default: "doc"
        }
    }

    private var iconColor: Color {
        switch item.type {
        case "tree": Theme.accent
        default: Theme.textMuted
        }
    }

    private var fileIcon: String {
        let ext = (item.name as NSString).pathExtension.lowercased()
        switch ext {
        case "swift", "ts", "tsx", "js", "jsx", "py", "go", "rs":
            return "doc.text.fill"
        case "json", "yml", "yaml", "toml":
            return "gearshape.fill"
        case "md", "txt", "readme":
            return "doc.richtext"
        case "png", "jpg", "jpeg", "svg", "gif":
            return "photo"
        case "lock":
            return "lock.fill"
        default:
            return "doc.fill"
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(iconColor)
                    .frame(width: 20)

                Text(item.name)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Spacer()

                if item.type == "tree" {
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .disabled(item.type != "tree")
    }
}
