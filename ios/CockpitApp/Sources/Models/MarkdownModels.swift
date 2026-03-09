import Foundation

struct MarkdownDocument: Codable, Identifiable {
    let id: String
    let title: String
    let content: String?
    let createdAt: String?
    let updatedAt: String?
    let wordCount: Int?
    let size: Int?
}

struct MarkdownListResponse: Codable {
    let docs: [MarkdownDocument]
}

struct MarkdownSaveResponse: Codable {
    let id: String
    let title: String
    let saved: Bool
    let wordCount: Int?
    let size: Int?
}
