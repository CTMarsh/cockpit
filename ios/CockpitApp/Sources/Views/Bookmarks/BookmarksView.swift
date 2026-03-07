import SwiftUI

struct BookmarksView: View {
    @ObservedObject private var service = BookmarkService.shared
    @State private var searchText = ""
    @State private var selectedTag: String?
    @State private var showingAdd = false
    @State private var newURL = ""

    var filteredBookmarks: [Bookmark] {
        guard let tag = selectedTag else { return service.bookmarks }
        return service.bookmarks.filter { $0.tagList.contains(tag) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.bookmarks.isEmpty {
                    LoadingView()
                } else {
                    // Tag pills
                    if !service.tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                TagPill(name: "All", count: service.bookmarks.count, selected: selectedTag == nil) {
                                    selectedTag = nil
                                }
                                ForEach(service.tags.sorted(by: { $0.value > $1.value }), id: \.key) { tag, count in
                                    TagPill(name: tag, count: count, selected: selectedTag == tag) {
                                        selectedTag = selectedTag == tag ? nil : tag
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Bookmark list
                    LazyVStack(spacing: 8) {
                        ForEach(filteredBookmarks) { bookmark in
                            BookmarkCard(bookmark: bookmark) {
                                Task { await service.deleteBookmark(id: bookmark.id) }
                            }
                        }
                    }
                    .padding(.horizontal)

                    if filteredBookmarks.isEmpty && !service.isLoading {
                        Text("No bookmarks found")
                            .foregroundStyle(Theme.textMuted)
                            .padding(.top, 40)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Bookmarks")
        .searchable(text: $searchText, prompt: "Search bookmarks")
        .onChange(of: searchText) { _, query in
            Task { await service.fetchBookmarks(query: query.isEmpty ? nil : query) }
        }
        .toolbar {
            Button { showingAdd = true } label: {
                Image(systemName: "plus")
            }
        }
        .alert("Add Bookmark", isPresented: $showingAdd) {
            TextField("URL", text: $newURL)
                .textInputAutocapitalization(.never)
            Button("Add") {
                Task {
                    await service.addBookmark(url: newURL, tags: nil)
                    newURL = ""
                }
            }
            Button("Cancel", role: .cancel) { newURL = "" }
        }
        .refreshable {
            await service.fetchBookmarks()
            await service.fetchTags()
        }
        .task {
            await service.fetchBookmarks()
            await service.fetchTags()
        }
    }
}

private struct TagPill: View {
    let name: String
    let count: Int
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("\(name) (\(count))")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(selected ? Theme.accent : Theme.surface)
                .foregroundStyle(selected ? Theme.background : Theme.text)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.border, lineWidth: selected ? 0 : 1))
        }
    }
}

private struct BookmarkCard: View {
    let bookmark: Bookmark
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(bookmark.title ?? bookmark.url)
                .font(.body.weight(.medium))
                .foregroundStyle(Theme.text)
                .lineLimit(2)

            Text(bookmark.url)
                .font(.caption)
                .foregroundStyle(Theme.accent)
                .lineLimit(1)

            if !bookmark.tagList.isEmpty {
                HStack(spacing: 4) {
                    ForEach(bookmark.tagList, id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.accent.opacity(0.15))
                            .foregroundStyle(Theme.accent)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { onDelete() } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .contextMenu {
            Button(role: .destructive) { onDelete() } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}
