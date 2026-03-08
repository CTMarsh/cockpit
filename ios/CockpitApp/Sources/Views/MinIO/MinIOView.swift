import SwiftUI
import UniformTypeIdentifiers

struct MinIOView: View {
    @ObservedObject private var service = MinioService.shared
    @State private var showCreateBucket = false
    @State private var newBucketName = ""
    @State private var showFileImporter = false
    @State private var downloadingKey: String?
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var objectToDelete: MinioObject?
    @State private var showDeleteConfirm = false
    @State private var isUploading = false

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading {
                    LoadingView()
                } else if service.currentBucket == nil {
                    // Bucket list
                    LazyVStack(spacing: 8) {
                        ForEach(service.buckets, id: \.self) { bucket in
                            Button {
                                Task { await service.fetchObjects(bucket: bucket) }
                            } label: {
                                HStack {
                                    Image(systemName: "folder.fill")
                                        .foregroundStyle(Theme.accent)
                                    Text(bucket)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(Theme.text)
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
                } else {
                    // Object browser
                    objectBrowser
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle(service.currentBucket ?? "MinIO")
        .toolbar {
            if service.currentBucket == nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreateBucket = true } label: {
                        Image(systemName: "plus")
                    }
                }
            } else {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        if service.currentPrefix.isEmpty {
                            service.currentBucket = nil
                            service.objects = []
                            service.prefixes = []
                        } else {
                            let parts = service.currentPrefix.split(separator: "/").dropLast()
                            let newPrefix = parts.isEmpty ? "" : parts.joined(separator: "/") + "/"
                            Task { await service.fetchObjects(bucket: service.currentBucket!, prefix: newPrefix) }
                        }
                    } label: {
                        Label("Back", systemImage: "chevron.left")
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showFileImporter = true
                    } label: {
                        if isUploading {
                            ProgressView()
                                .tint(Theme.accent)
                        } else {
                            Image(systemName: "arrow.up.doc")
                        }
                    }
                    .disabled(isUploading)
                }
            }
        }
        .refreshable { await service.fetchBuckets() }
        .task { await service.fetchBuckets() }
        .alert("Create Bucket", isPresented: $showCreateBucket) {
            TextField("Bucket name", text: $newBucketName)
            Button("Create") {
                Task { _ = await service.createBucket(name: newBucketName); newBucketName = "" }
            }
            Button("Cancel", role: .cancel) { newBucketName = "" }
        }
        .fileImporter(
            isPresented: $showFileImporter,
            allowedContentTypes: [.item],
            allowsMultipleSelection: false
        ) { result in
            handleFileImport(result)
        }
        .confirmDialog(
            title: "Delete Object",
            message: "Delete \"\(objectToDelete?.key.split(separator: "/").last.map(String.init) ?? "")\"? This cannot be undone.",
            destructiveLabel: "Delete",
            isPresented: $showDeleteConfirm,
            onConfirm: {
                guard let obj = objectToDelete, let bucket = service.currentBucket else { return }
                Task { await service.deleteObject(bucket: bucket, key: obj.key) }
                objectToDelete = nil
            }
        )
        .sheet(isPresented: $showShareSheet) {
            if let shareURL {
                MinIOShareSheet(activityItems: [shareURL])
            }
        }
    }

    private var objectBrowser: some View {
        LazyVStack(spacing: 6) {
            // Prefix folders
            ForEach(service.prefixes, id: \.self) { prefix in
                Button {
                    Task { await service.fetchObjects(bucket: service.currentBucket!, prefix: prefix) }
                } label: {
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundStyle(Theme.accent)
                        Text(prefix.split(separator: "/").last.map(String.init) ?? prefix)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(Theme.textMuted)
                            .font(.caption)
                    }
                    .padding(10)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            // Objects
            ForEach(service.objects) { object in
                HStack {
                    Image(systemName: "doc.fill")
                        .foregroundStyle(Theme.textMuted)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(object.key.split(separator: "/").last.map(String.init) ?? object.key)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        if let mod = object.lastModified {
                            Text(mod.prefix(16))
                                .font(.caption2.monospaced())
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                    Spacer()
                    Text(object.sizeHuman)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)

                    // Download button
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        downloadObject(object)
                    } label: {
                        if downloadingKey == object.key {
                            ProgressView()
                                .tint(Theme.accent)
                        } else {
                            Image(systemName: "arrow.down.circle")
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .disabled(downloadingKey != nil)
                }
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .contextMenu {
                    Button {
                        downloadObject(object)
                    } label: {
                        Label("Download", systemImage: "arrow.down.circle")
                    }
                    Button(role: .destructive) {
                        objectToDelete = object
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        objectToDelete = object
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .padding(.horizontal)
    }

    private func downloadObject(_ object: MinioObject) {
        guard let bucket = service.currentBucket,
              let url = service.downloadURL(bucket: bucket, key: object.key) else { return }
        downloadingKey = object.key
        Task {
            do {
                let config = URLSessionConfiguration.default
                config.httpCookieStorage = HTTPCookieStorage.shared
                let session = URLSession(configuration: config)
                let (tempURL, response) = try await session.download(from: url)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    service.error = "Download failed"
                    downloadingKey = nil
                    return
                }
                let fileName = object.key.split(separator: "/").last.map(String.init) ?? object.key
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: tempURL, to: dest)
                shareURL = dest
                showShareSheet = true
            } catch {
                service.error = error.localizedDescription
            }
            downloadingKey = nil
        }
    }

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first,
                  let bucket = service.currentBucket else { return }
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else {
                service.error = "Failed to read file"
                return
            }
            let fileName = url.lastPathComponent
            let contentType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            isUploading = true
            Task {
                _ = await service.uploadObject(
                    bucket: bucket,
                    prefix: service.currentPrefix,
                    fileName: fileName,
                    data: data,
                    contentType: contentType
                )
                isUploading = false
            }
        case .failure(let error):
            service.error = error.localizedDescription
        }
    }
}

private struct MinIOShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
