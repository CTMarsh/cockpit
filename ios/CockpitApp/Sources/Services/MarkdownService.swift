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
            let resp: MarkdownListResponse = try await APIClient.shared.request(path: "/api/markdown/documents")
            documents = resp.documents
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchDocument(id: String) async {
        isLoading = true
        do {
            currentDocument = try await APIClient.shared.request(path: "/api/markdown/documents/\(id)")
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func createDocument(title: String, content: String = "") async -> MarkdownDocument? {
        do {
            let body = ["title": title, "content": content]
            let doc: MarkdownDocument = try await APIClient.shared.request(path: "/api/markdown/documents", method: "POST", body: body)
            documents.insert(doc, at: 0)
            return doc
        } catch { self.error = error.localizedDescription; return nil }
    }

    func updateDocument(id: String, title: String? = nil, content: String? = nil) async {
        do {
            var body: [String: String] = [:]
            if let title { body["title"] = title }
            if let content { body["content"] = content }
            let doc: MarkdownDocument = try await APIClient.shared.request(path: "/api/markdown/documents/\(id)", method: "PUT", body: body)
            currentDocument = doc
            if let i = documents.firstIndex(where: { $0.id == id }) {
                documents[i] = doc
            }
        } catch { self.error = error.localizedDescription }
    }

    func deleteDocument(id: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/markdown/documents/\(id)", method: "DELETE")
            documents.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }
}
