import SwiftUI

struct DedupView: View {
    @ObservedObject private var service = DedupService.shared
    @State private var selectedDir: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                // Directory picker
                if !service.allowedDirs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Scan Directory")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.text)

                        ForEach(service.allowedDirs, id: \.self) { dir in
                            Button {
                                selectedDir = dir
                                Task { await service.startScan(directory: dir) }
                            } label: {
                                HStack {
                                    Image(systemName: "folder")
                                        .foregroundStyle(Theme.accent)
                                    Text(dir)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.text)
                                    Spacer()
                                    Image(systemName: "play.fill")
                                        .font(.caption)
                                        .foregroundStyle(Theme.accent)
                                }
                                .padding(10)
                                .background(Theme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Active scan progress
                if let scan = service.activeScan {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Scan: \(scan.directory)")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Theme.text)
                            Spacer()
                            StatusBadge(
                                text: scan.status,
                                color: scan.isComplete ? Theme.success : Theme.warning
                            )
                        }

                        if scan.isScanning {
                            ProgressView()
                                .tint(Theme.accent)
                        }

                        if let total = scan.totalFiles {
                            Text("\(total) files scanned")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }

                        if let groups = scan.duplicateGroups, !groups.isEmpty {
                            Text("\(groups.count) duplicate groups • \(scan.reclaimableHuman) reclaimable")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)

                            ForEach(groups) { group in
                                DuplicateGroupCard(group: group)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                // Previous scans
                if !service.scans.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Previous Scans")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal)

                        ForEach(service.scans) { scan in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(scan.directory)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.text)
                                    Text("\(scan.totalFiles ?? 0) files • \(scan.duplicateGroups?.count ?? 0) groups")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.textMuted)
                                }
                                Spacer()
                                StatusBadge(text: scan.status, color: scan.isComplete ? Theme.success : Theme.textMuted)
                            }
                            .padding(10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .padding(.horizontal)
                        }
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Dedup")
        .task {
            await service.fetchAllowedDirs()
            await service.fetchScans()
        }
        .onDisappear { service.stopPolling() }
    }
}

private struct DuplicateGroupCard: View {
    let group: DuplicateGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Hash: \(group.hash.prefix(12))…")
                .font(.caption2.monospaced())
                .foregroundStyle(Theme.textMuted)
            ForEach(group.files, id: \.self) { file in
                Text(file)
                    .font(.caption2.monospaced())
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
            }
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))
    }
}
