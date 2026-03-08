import SwiftUI

struct DedupView: View {
    @ObservedObject private var service = DedupService.shared
    @State private var selectedDir: String?
    @State private var selectedFiles: Set<String> = []
    @State private var showDeleteConfirm = false
    @State private var deleteResult: DeleteResponse?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if let result = deleteResult {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Theme.success)
                        Text("\(result.deleted) deleted, \(result.failed) failed")
                            .font(.caption)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Button {
                            deleteResult = nil
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption)
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                    .padding(12)
                    .background(Theme.success.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
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
                                selectedFiles.removeAll()
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
                            Text("\(groups.count) duplicate groups \u{2022} \(scan.reclaimableHuman) reclaimable")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)

                            // Delete selected bar
                            if !selectedFiles.isEmpty {
                                Button {
                                    showDeleteConfirm = true
                                } label: {
                                    Label("Delete \(selectedFiles.count) Selected", systemImage: "trash")
                                        .font(.subheadline.weight(.medium))
                                        .frame(maxWidth: .infinity)
                                        .padding(12)
                                }
                                .background(Theme.danger)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            ForEach(groups) { group in
                                DuplicateGroupCard(
                                    group: group,
                                    selectedFiles: $selectedFiles
                                )
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
                                    Text("\(scan.totalFiles ?? 0) files \u{2022} \(scan.duplicateGroups?.count ?? 0) groups")
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
        .confirmDialog(
            title: "Delete Files",
            message: "Delete \(selectedFiles.count) selected duplicate files? This cannot be undone.",
            destructiveLabel: "Delete \(selectedFiles.count) Files",
            isPresented: $showDeleteConfirm,
            onConfirm: {
                let files = Array(selectedFiles)
                Task {
                    if let result = await service.deleteFiles(files) {
                        deleteResult = result
                        selectedFiles.removeAll()
                        // Re-scan to refresh groups
                        if let scan = service.activeScan {
                            await service.pollScan(id: scan.id)
                        }
                    }
                }
            }
        )
    }
}

private struct DuplicateGroupCard: View {
    let group: DuplicateGroup
    @Binding var selectedFiles: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Hash: \(group.hash.prefix(12))...")
                .font(.caption2.monospaced())
                .foregroundStyle(Theme.textMuted)
            ForEach(group.files, id: \.self) { file in
                HStack(spacing: 8) {
                    Button {
                        if selectedFiles.contains(file) {
                            selectedFiles.remove(file)
                        } else {
                            selectedFiles.insert(file)
                        }
                    } label: {
                        Image(systemName: selectedFiles.contains(file) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(selectedFiles.contains(file) ? Theme.danger : Theme.textMuted)
                            .font(.body)
                    }

                    Text(file)
                        .font(.caption2.monospaced())
                        .foregroundStyle(selectedFiles.contains(file) ? Theme.danger : Theme.text)
                        .lineLimit(1)
                        .strikethrough(selectedFiles.contains(file))

                    Spacer()
                }
            }
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))
    }
}
