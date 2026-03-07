import Foundation

@MainActor
final class BookmarkService: ObservableObject {
    static let shared = BookmarkService()

    @Published var bookmarks: [Bookmark] = []
    @Published var tags: [String: Int] = [:]
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    private init() {}

    func fetchBookmarks(query: String? = nil) async {
        isLoading = bookmarks.isEmpty
        error = nil

        do {
            let path = query.map { "/api/bookmarks?q=\($0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0)" }
                ?? "/api/bookmarks"
            let response: BookmarksResponse = try await api.request(path: path)
            bookmarks = response.bookmarks
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchTags() async {
        do {
            let response: TagsResponse = try await api.request(path: "/api/bookmarks/tags")
            tags = response.tags
        } catch {}
    }

    func addBookmark(url: String, tags: [String]?) async {
        do {
            let _: Bookmark = try await api.request(
                path: "/api/bookmarks",
                method: "POST",
                body: CreateBookmarkBody(url: url, tags: tags)
            )
            await fetchBookmarks()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteBookmark(id: Int) async {
        do {
            try await api.send(path: "/api/bookmarks/\(id)", method: "DELETE")
            bookmarks.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}
