import SwiftUI

struct MarkdownView: View {
    @ObservedObject private var service = MarkdownService.shared
    @State private var showNewDoc = false
    @State private var newTitle = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.documents.isEmpty {
                    LoadingView()
                } else if service.documents.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("No documents")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(service.documents) { doc in
                            NavigationLink(destination: MarkdownEditorView(documentId: doc.id)) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(doc.title)
                                            .font(.body.weight(.medium))
                                            .foregroundStyle(Theme.text)
                                        if let date = doc.updatedAt {
                                            Text(date.prefix(16))
                                                .font(.caption2.monospaced())
                                                .foregroundStyle(Theme.textMuted)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundStyle(Theme.textMuted)
                                        .font(.caption)
                                }
                                .padding(12)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Markdown")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNewDoc = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .refreshable { await service.fetchDocuments() }
        .task { await service.fetchDocuments() }
        .alert("New Document", isPresented: $showNewDoc) {
            TextField("Title", text: $newTitle)
            Button("Create") {
                Task {
                    _ = await service.createDocument(title: newTitle)
                    newTitle = ""
                }
            }
            Button("Cancel", role: .cancel) { newTitle = "" }
        }
    }
}

struct MarkdownEditorView: View {
    let documentId: String
    @ObservedObject private var service = MarkdownService.shared
    @State private var content = ""
    @State private var isSaving = false
    @FocusState private var isEditing: Bool

    var body: some View {
        VStack(spacing: 0) {
            if service.isLoading {
                LoadingView()
            } else {
                TextEditor(text: $content)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Theme.text)
                    .scrollContentBackground(.hidden)
                    .background(Theme.surface)
                    .focused($isEditing)
            }
        }
        .background(Theme.background)
        .navigationTitle(service.currentDocument?.title ?? "Document")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isSaving = true
                    Task {
                        await service.updateDocument(id: documentId, content: content)
                        isSaving = false
                    }
                } label: {
                    if isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Text("Save")
                    }
                }
                .disabled(isSaving)
            }
        }
        .task {
            await service.fetchDocument(id: documentId)
            content = service.currentDocument?.content ?? ""
        }
    }
}
