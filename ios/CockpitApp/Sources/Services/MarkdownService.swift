import Foundation

@MainActor class MarkdownService: ObservableObject {
    static let shared = MarkdownService()
    @Published var documents: [MarkdownDocument] = []
    @Published var currentDocument: MarkdownDocument?
    @Published var isLoading = false
    @Published var error: String?

    func fetchDocuments() async {
        isLoading = documents.isEmpty
        do {
            let resp: MarkdownListResponse = try await APIClient.shared.request(path: "/api/markdown/docs")
            documents = resp.docs
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchDocument(id: String) async {
        isLoading = true
        do {
            currentDocument = try await APIClient.shared.request(path: "/api/markdown/docs/\(id)")
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func createDocument(title: String, content: String = "") async -> MarkdownDocument? {
        do {
            let id = UUID().uuidString.lowercased()
            let docContent = content.isEmpty ? "# \(title)\n" : content
            let body = ["content": docContent]
            let _: MarkdownSaveResponse = try await APIClient.shared.request(path: "/api/markdown/docs/\(id)", method: "PUT", body: body)
            let doc = MarkdownDocument(id: id, title: title, content: docContent, createdAt: nil, updatedAt: nil, wordCount: nil, size: nil)
            documents.insert(doc, at: 0)
            return doc
        } catch { self.error = error.localizedDescription; return nil }
    }

    func updateDocument(id: String, title: String? = nil, content: String? = nil) async {
        do {
            let docContent = content ?? currentDocument?.content ?? ""
            let body = ["content": docContent]
            let _: MarkdownSaveResponse = try await APIClient.shared.request(path: "/api/markdown/docs/\(id)", method: "PUT", body: body)
            // Refetch to get updated document
            await fetchDocument(id: id)
        } catch { self.error = error.localizedDescription }
    }

    func deleteDocument(id: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/markdown/docs/\(id)", method: "DELETE")
            documents.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }
}
