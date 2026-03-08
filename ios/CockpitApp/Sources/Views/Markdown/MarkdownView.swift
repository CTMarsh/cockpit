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
    @StateObject private var ws = WebSocketClient()
    @State private var content = ""
    @State private var isSaving = false
    @State private var debounceTask: Task<Void, Never>?
    @State private var isRemoteUpdate = false
    @FocusState private var isEditing: Bool

    var body: some View {
        VStack(spacing: 0) {
            if ws.isConnected {
                HStack(spacing: 4) {
                    Circle().fill(Theme.success).frame(width: 6, height: 6)
                    Text("Live").font(.caption2).foregroundStyle(Theme.textMuted)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 4)
            }

            if service.isLoading {
                LoadingView()
            } else {
                TextEditor(text: $content)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Theme.text)
                    .scrollContentBackground(.hidden)
                    .background(Theme.surface)
                    .focused($isEditing)
                    .onChange(of: content) { _, newValue in
                        guard ws.isConnected, !isRemoteUpdate else { return }
                        debounceTask?.cancel()
                        debounceTask = Task {
                            try? await Task.sleep(for: .seconds(1))
                            guard !Task.isCancelled else { return }
                            ws.send(content: newValue, docId: documentId)
                        }
                    }
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
            ws.connect(docId: documentId) { message in
                // Update content from remote collaborator
                if let data = message.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let remoteContent = json["content"] as? String {
                    isRemoteUpdate = true
                    content = remoteContent
                    isRemoteUpdate = false
                }
            }
        }
        .onDisappear { ws.disconnect() }
    }
}
