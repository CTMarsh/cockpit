import Foundation

struct BookmarksResponse: Decodable {
    let bookmarks: [Bookmark]
    let total: Int
}

struct Bookmark: Decodable, Identifiable {
    let id: Int
    let url: String
    let title: String?
    let summary: String?
    let tags: String?
    let createdAt: String?

    var tagList: [String] {
        guard let tags, !tags.isEmpty else { return [] }
        return tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    }
}

struct TagsResponse: Decodable {
    let tags: [String: Int]
}

struct CreateBookmarkBody: Encodable {
    let url: String
    let tags: [String]?
}

struct UpdateBookmarkBody: Encodable {
    let title: String?
    let tags: [String]?
}
