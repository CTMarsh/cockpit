import SwiftUI
import WatchKit

struct WatchVMsView: View {
    @State private var vms: [ProxmoxVM] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var actionTarget: ProxmoxVM?
    @State private var pendingAction: VMAction?
    @State private var actingVmId: Int?

    private enum VMAction {
        case start, stop
        var apiAction: String { self == .start ? "start" : "stop" }
        var label: String { self == .start ? "Start" : "Stop" }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .tint(Theme.accent)
            } else if let error {
                VStack(spacing: 8) {
                    Image(systemName: "desktopcomputer.trianglebadge.exclamationmark")
                        .font(.title3)
                        .foregroundStyle(Theme.danger)
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
            } else if vms.isEmpty {
                Text("No VMs found")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            } else {
                List {
                    ForEach(vms) { vm in
                        vmRow(vm)
                    }
                }
                .listStyle(.carousel)
            }
        }
        .navigationTitle("VMs")
        .containerBackground(Theme.background, for: .navigation)
        .task { await fetchData() }
        .refreshable { await fetchData() }
        .alert(confirmationTitle, isPresented: .init(
            get: { actionTarget != nil },
            set: { if !$0 { actionTarget = nil; pendingAction = nil } }
        )) {
            Button(pendingAction?.label ?? "Confirm", role: pendingAction == .stop ? .destructive : nil) {
                if let vm = actionTarget, let action = pendingAction {
                    Task { await performAction(vm: vm, action: action) }
                }
            }
            Button("Cancel", role: .cancel) {
                actionTarget = nil
                pendingAction = nil
            }
        } message: {
            if let vm = actionTarget, let action = pendingAction {
                Text("\(action.label) \(vm.name)?")
            }
        }
    }

    private var confirmationTitle: String {
        guard let action = pendingAction else { return "Confirm" }
        return "\(action.label) VM?"
    }

    // MARK: - VM Row

    private func vmRow(_ vm: ProxmoxVM) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(vm.status == "running" ? Theme.success : Theme.textMuted.opacity(0.4))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(vm.name)
                        .font(.caption)
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)

                    Text(vm.type.uppercased())
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 3)
                        .padding(.vertical, 1)
                        .background(Theme.accent.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                }

                Text(vm.status.capitalized)
                    .font(.caption2)
                    .foregroundStyle(vm.status == "running" ? Theme.success : Theme.textMuted)
            }

            Spacer()

            if actingVmId == vm.vmid {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Theme.accent)
            } else {
                Button {
                    actionTarget = vm
                    pendingAction = vm.status == "running" ? .stop : .start
                } label: {
                    Image(systemName: vm.status == "running" ? "stop.fill" : "play.fill")
                        .font(.caption2)
                        .foregroundStyle(vm.status == "running" ? Theme.danger : Theme.success)
                }
                .buttonStyle(.plain)
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - VM Action

    private func performAction(vm: ProxmoxVM, action: VMAction) async {
        actingVmId = vm.vmid
        do {
            let body = VMActionBody(action: action.apiAction, node: vm.node, type: vm.type)
            let _: VMActionResponse = try await WatchAPIClient.shared.request(
                path: "/api/proxmox/vms/\(vm.vmid)/action",
                method: "POST",
                body: body
            )
            WKInterfaceDevice.current().play(.success)
            // Refresh after a brief delay to let Proxmox process
            try? await Task.sleep(for: .seconds(2))
            await fetchData()
        } catch {
            WKInterfaceDevice.current().play(.failure)
            self.error = "\(action.label) failed"
        }
        actingVmId = nil
    }

    // MARK: - Data Fetching

    private func fetchData() async {
        isLoading = true
        error = nil
        do {
            let response: ProxmoxResourcesResponse = try await WatchAPIClient.shared.request(path: "/api/proxmox/resources")
            vms = response.vms.sorted { a, b in
                if a.status == b.status { return a.name < b.name }
                return a.status == "running"
            }
        } catch {
            self.error = "Cannot reach Proxmox"
        }
        isLoading = false
    }
}
