import SwiftUI

struct MinIOView: View {
    @ObservedObject private var service = MinioService.shared
    @State private var showCreateBucket = false
    @State private var newBucketName = ""

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
                        ForEach(service.buckets) { bucket in
                            Button {
                                Task { await service.fetchObjects(bucket: bucket.name) }
                            } label: {
                                HStack {
                                    Image(systemName: "folder.fill")
                                        .foregroundStyle(Theme.accent)
                                    Text(bucket.name)
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
                        Text(object.name.split(separator: "/").last.map(String.init) ?? object.name)
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
                }
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.horizontal)
    }
}
