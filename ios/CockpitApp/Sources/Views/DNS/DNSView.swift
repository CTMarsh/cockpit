import SwiftUI

struct DNSView: View {
    @ObservedObject private var service = DNSService.shared
    @State private var showAddRecord = false

    private var recordTypes: [String] {
        let types = Set(service.records.map(\.type))
        return ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS"].filter { types.contains($0) }
            + types.sorted().filter { !["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS"].contains($0) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.records.isEmpty {
                    LoadingView()
                } else if service.records.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "globe")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("No DNS records")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    // Summary bar
                    HStack {
                        StatusBadge(text: "\(service.records.count) records", color: Theme.accent)
                        let proxiedCount = service.records.filter(\.proxied).count
                        if proxiedCount > 0 {
                            StatusBadge(text: "\(proxiedCount) proxied", color: .orange)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)

                    // Records grouped by type
                    LazyVStack(spacing: 16) {
                        ForEach(recordTypes, id: \.self) { type in
                            let typeRecords = service.records.filter { $0.type == type }
                            VStack(alignment: .leading, spacing: 8) {
                                Text(type)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.textMuted)
                                    .padding(.horizontal, 4)

                                ForEach(typeRecords) { record in
                                    DNSRecordCard(record: record)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("DNS Manager")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAddRecord = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddRecord) {
            CreateDNSRecordSheet()
        }
        .refreshable { await service.fetchRecords() }
        .task {
            await service.fetchRecords()
            await service.fetchZone()
        }
    }
}

// MARK: - Record Card

private struct DNSRecordCard: View {
    let record: DNSRecord
    @ObservedObject private var service = DNSService.shared
    @State private var showDeleteConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(record.shortName)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Spacer()

                // Proxied badge
                HStack(spacing: 4) {
                    Image(systemName: "cloud.fill")
                        .font(.caption2)
                    Text(record.proxied ? "Proxied" : "DNS only")
                        .font(.caption2)
                }
                .foregroundStyle(record.proxied ? .orange : Theme.textMuted)
            }

            Text(record.content)
                .font(.caption.monospaced())
                .foregroundStyle(Theme.textMuted)
                .lineLimit(1)

            HStack {
                Text("TTL: \(record.ttlLabel)")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)

                Spacer()

                Button(role: .destructive) { showDeleteConfirm = true } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                }
                .tint(Theme.danger)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        .confirmationDialog("Delete \(record.shortName)?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await service.deleteRecord(id: record.id) }
            }
        }
    }
}

// MARK: - Create Sheet

private struct CreateDNSRecordSheet: View {
    @ObservedObject private var service = DNSService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var type = "A"
    @State private var name = ""
    @State private var content = ""
    @State private var proxied = false
    @State private var ttl = 1
    @State private var isSaving = false

    private let recordTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS"]
    private let ttlOptions = [
        (1, "Auto"),
        (60, "1 min"),
        (300, "5 min"),
        (3600, "1 hour"),
        (86400, "1 day"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Record Type") {
                    Picker("Type", selection: $type) {
                        ForEach(recordTypes, id: \.self) { t in
                            Text(t).tag(t)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Name") {
                    TextField("subdomain", text: $name)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Content") {
                    TextField(type == "A" ? "192.168.1.1" : "target.example.com", text: $content)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                }

                Section("Options") {
                    Toggle("Proxied (Cloudflare)", isOn: $proxied)
                        .tint(.orange)

                    Picker("TTL", selection: $ttl) {
                        ForEach(ttlOptions, id: \.0) { value, label in
                            Text(label).tag(value)
                        }
                    }
                }

                if proxied {
                    Section {
                        Label("Proxied records pointing to private IPs will be rejected.", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle("New DNS Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        isSaving = true
                        Task {
                            await service.createRecord(
                                type: type,
                                name: name,
                                content: content,
                                proxied: proxied,
                                ttl: ttl
                            )
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty || content.isEmpty || isSaving)
                }
            }
        }
    }
}
