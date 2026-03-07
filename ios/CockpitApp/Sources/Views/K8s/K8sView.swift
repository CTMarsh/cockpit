import SwiftUI

struct K8sView: View {
    @ObservedObject private var service = K8sService.shared
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Workloads").tag(0)
                Text("Events").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if service.isLoading && service.workloads.isEmpty {
                LoadingView()
            } else {
                ScrollView {
                    if selectedTab == 0 {
                        workloadsContent
                    } else {
                        eventsContent
                    }
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("k3s Manager")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(service.namespaces, id: \.self) { ns in
                        Button(ns) {
                            service.selectedNamespace = ns
                            Task {
                                await service.fetchWorkloads()
                                await service.fetchEvents()
                            }
                        }
                    }
                } label: {
                    Label(service.selectedNamespace, systemImage: "line.3.horizontal.decrease.circle")
                        .font(.caption)
                }
            }
        }
        .refreshable {
            await service.fetchWorkloads()
            await service.fetchEvents()
        }
        .task {
            await service.fetchNamespaces()
            service.startPolling()
        }
        .onDisappear { service.stopPolling() }
    }

    private var workloadsContent: some View {
        LazyVStack(spacing: 10) {
            ForEach(service.workloads) { workload in
                WorkloadCard(workload: workload)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    private var eventsContent: some View {
        LazyVStack(spacing: 6) {
            ForEach(service.events) { event in
                EventRow(event: event)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }
}

private struct WorkloadCard: View {
    let workload: K8sWorkload
    @ObservedObject private var service = K8sService.shared
    @State private var showScale = false
    @State private var scaleReplicas = 1
    @State private var showLogs = false
    @State private var logs = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(workload.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(workload.type)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
                Spacer()
                StatusBadge(
                    text: "\(workload.ready)/\(workload.desired)",
                    color: workload.isReady ? Theme.success : Theme.warning
                )
            }

            Text(workload.image.split(separator: "/").last.map(String.init) ?? workload.image)
                .font(.caption.monospaced())
                .foregroundStyle(Theme.textMuted)
                .lineLimit(1)

            if workload.type == "Deployment" {
                HStack(spacing: 12) {
                    Button {
                        Task {
                            _ = await service.restartDeployment(ns: workload.namespace, name: workload.name)
                            await service.fetchWorkloads()
                        }
                    } label: {
                        Label("Restart", systemImage: "arrow.clockwise")
                            .font(.caption)
                    }
                    .tint(Theme.warning)

                    Button {
                        scaleReplicas = workload.desired
                        showScale = true
                    } label: {
                        Label("Scale", systemImage: "arrow.up.arrow.down")
                            .font(.caption)
                    }
                    .tint(Theme.accent)
                }
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
        .alert("Scale \(workload.name)", isPresented: $showScale) {
            TextField("Replicas", value: $scaleReplicas, format: .number)
                .keyboardType(.numberPad)
            Button("Scale") {
                Task {
                    _ = await service.scaleDeployment(ns: workload.namespace, name: workload.name, replicas: scaleReplicas)
                    await service.fetchWorkloads()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

private struct EventRow: View {
    let event: K8sEvent

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: event.isWarning ? "exclamationmark.triangle.fill" : "info.circle.fill")
                .foregroundStyle(event.isWarning ? Theme.warning : Theme.info)
                .font(.caption)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.reason)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.text)
                Text(event.message)
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                    .lineLimit(2)
                Text(event.object)
                    .font(.caption2.monospaced())
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            if event.count > 1 {
                Text("×\(event.count)")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Theme.textMuted)
            }
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
