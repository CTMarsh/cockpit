import SwiftUI

struct BackupsView: View {
    @ObservedObject private var service = BackupService.shared
    @State private var downloadingKey: String?
    @State private var shareURL: URL?
    @State private var showShareSheet = false
    @State private var downloadError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if let downloadError {
                    ErrorBanner(message: downloadError) {
                        self.downloadError = nil
                    }
                    .padding(.horizontal)
                }

                if service.isLoading {
                    LoadingView()
                } else if service.backups.isEmpty && !service.isAvailable {
                    VStack(spacing: 12) {
                        Image(systemName: "externaldrive.badge.xmark")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("Backup storage unavailable")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    // Trigger button
                    Button {
                        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                        Task { _ = await service.triggerBackup() }
                    } label: {
                        if service.isTriggering {
                            ProgressView()
                                .tint(Theme.background)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                        } else {
                            Label("Create Backup", systemImage: "arrow.clockwise.circle.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(14)
                        }
                    }
                    .background(Theme.accent)
                    .foregroundStyle(Theme.background)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                    .disabled(service.isTriggering)

                    // Backup list
                    LazyVStack(spacing: 8) {
                        ForEach(service.backups) { backup in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(backup.name)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(Theme.text)
                                        .lineLimit(1)
                                    Text(backup.lastModified.prefix(16))
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.textMuted)
                                }
                                Spacer()
                                Text(backup.sizeHuman)
                                    .font(.caption)
                                    .foregroundStyle(Theme.textMuted)

                                // Download button
                                Button {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    downloadBackup(backup)
                                } label: {
                                    if downloadingKey == backup.key {
                                        ProgressView()
                                            .tint(Theme.accent)
                                    } else {
                                        Image(systemName: "arrow.down.circle")
                                            .foregroundStyle(Theme.accent)
                                            .font(.title3)
                                    }
                                }
                                .disabled(downloadingKey != nil)
                            }
                            .padding(12)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Backups")
        .refreshable { await service.fetchBackups() }
        .task { await service.fetchBackups() }
        .sheet(isPresented: $showShareSheet) {
            if let shareURL {
                ShareSheet(activityItems: [shareURL])
            }
        }
    }

    private func downloadBackup(_ backup: Backup) {
        guard let url = service.downloadURL(for: backup) else {
            downloadError = "Invalid download URL"
            return
        }
        downloadingKey = backup.key
        Task {
            do {
                let config = URLSessionConfiguration.default
                config.httpCookieStorage = HTTPCookieStorage.shared
                let session = URLSession(configuration: config)
                let (tempURL, response) = try await session.download(from: url)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    downloadError = "Download failed (server error)"
                    downloadingKey = nil
                    return
                }
                // Move to a named temporary file for sharing
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(backup.name)
                try? FileManager.default.removeItem(at: dest)
                try FileManager.default.moveItem(at: tempURL, to: dest)
                shareURL = dest
                showShareSheet = true
            } catch {
                downloadError = error.localizedDescription
            }
            downloadingKey = nil
        }
    }
}

/// UIKit share sheet wrapper for SwiftUI
private struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
