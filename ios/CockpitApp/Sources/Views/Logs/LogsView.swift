import SwiftUI

struct LogsView: View {
    @ObservedObject private var service = LogsService.shared
    @State private var selectedSource: LogSource?
    @State private var selectedUnit: SystemUnit?
    @State private var logMode = 0 // 0 = container, 1 = system
    @State private var searchText = ""

    var filteredLines: [String] {
        if searchText.isEmpty { return service.logLines }
        return service.logLines.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $logMode) {
                Text("Containers").tag(0)
                Text("System").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if logMode == 0 {
                containerSourcePicker
            } else {
                systemUnitPicker
            }

            TextField("Search logs…", text: $searchText)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)
                .padding(.bottom, 8)

            if service.isLoading {
                LoadingView()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        ForEach(Array(filteredLines.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Theme.text)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, 8)
                }
                .background(Theme.surface)
            }
        }
        .background(Theme.background)
        .navigationTitle("Logs")
        .task {
            await service.fetchSources()
            await service.fetchSystemUnits()
        }
    }

    private var containerSourcePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(service.sources) { source in
                    Button {
                        selectedSource = source
                        Task { await service.fetchContainerLogs(id: source.id) }
                    } label: {
                        Text(source.name)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(selectedSource?.id == source.id ? Theme.accent : Theme.surface)
                            .foregroundStyle(selectedSource?.id == source.id ? Theme.background : Theme.text)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: selectedSource?.id == source.id ? 0 : 1))
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }

    private var systemUnitPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(service.systemUnits) { unit in
                    Button {
                        selectedUnit = unit
                        Task { await service.fetchSystemLogs(unit: unit.name) }
                    } label: {
                        Text(unit.name)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(selectedUnit?.id == unit.id ? Theme.accent : Theme.surface)
                            .foregroundStyle(selectedUnit?.id == unit.id ? Theme.background : Theme.text)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: selectedUnit?.id == unit.id ? 0 : 1))
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)
        }
    }
}
