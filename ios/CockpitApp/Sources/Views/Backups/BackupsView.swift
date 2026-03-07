import SwiftUI

struct BackupsView: View {
    @ObservedObject private var service = BackupService.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
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
    }
}
