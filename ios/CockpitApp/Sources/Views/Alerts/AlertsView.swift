import SwiftUI

struct AlertsView: View {
    @ObservedObject private var service = AlertService.shared
    @State private var selectedTab = 0
    @State private var showAddRule = false

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $selectedTab) {
                Text("Rules").tag(0)
                Text("History").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if service.isLoading {
                LoadingView()
            } else {
                ScrollView {
                    if selectedTab == 0 {
                        rulesContent
                    } else {
                        historyContent
                    }
                }
            }
        }
        .background(Theme.background)
        .navigationTitle("Alerts")
        .toolbar {
            if selectedTab == 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAddRule = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .refreshable {
            await service.fetchRules()
            await service.fetchHistory()
        }
        .task {
            await service.fetchRules()
            await service.fetchHistory()
        }
        .sheet(isPresented: $showAddRule) {
            AddAlertRuleSheet()
        }
    }

    private var rulesContent: some View {
        LazyVStack(spacing: 10) {
            ForEach(service.rules) { rule in
                AlertRuleCard(rule: rule)
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }

    private var historyContent: some View {
        LazyVStack(spacing: 6) {
            ForEach(service.history) { entry in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.ruleName)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.text)
                        Text(entry.message)
                            .font(.caption2)
                            .foregroundStyle(Theme.textMuted)
                            .lineLimit(2)
                    }
                    Spacer()
                    Text(entry.firedAt.prefix(16))
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.textMuted)
                }
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.horizontal)
        .padding(.bottom)
    }
}

private struct AlertRuleCard: View {
    let rule: AlertRule
    @ObservedObject private var service = AlertService.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(rule.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { rule.enabled },
                    set: { newValue in
                        Task { await service.toggleRule(id: rule.id, enabled: newValue) }
                    }
                ))
                .tint(Theme.accent)
                .labelsHidden()
            }

            HStack(spacing: 8) {
                StatusBadge(text: rule.metricType, color: Theme.info)
                Text("\(rule.operator ?? "gt") \(String(format: "%.0f", rule.threshold))")
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textMuted)
                if let target = rule.target, !target.isEmpty {
                    Text(target)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
            }

            HStack(spacing: 12) {
                Button {
                    Task { _ = await service.testRule(id: rule.id) }
                } label: {
                    Label("Test", systemImage: "bolt.fill")
                        .font(.caption)
                }
                .tint(Theme.accent)

                Button(role: .destructive) {
                    Task { await service.deleteRule(id: rule.id) }
                } label: {
                    Label("Delete", systemImage: "trash")
                        .font(.caption)
                }
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

private struct AddAlertRuleSheet: View {
    @ObservedObject private var service = AlertService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var metricType = "cpu"
    @State private var op = "gt"
    @State private var threshold = ""
    @State private var target = ""

    let metricTypes = ["cpu", "memory", "disk", "service_down", "pod_restarts"]
    let operators = ["gt", "lt", "gte", "lte", "eq"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Rule Name", text: $name)
                Picker("Metric", selection: $metricType) {
                    ForEach(metricTypes, id: \.self) { Text($0) }
                }
                Picker("Operator", selection: $op) {
                    ForEach(operators, id: \.self) { Text($0) }
                }
                TextField("Threshold", text: $threshold)
                    .keyboardType(.decimalPad)
                TextField("Target (optional)", text: $target)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Alert Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        guard let thresholdValue = Double(threshold) else { return }
                        let body = CreateAlertBody(
                            name: name,
                            metricType: metricType,
                            operator: op,
                            threshold: thresholdValue,
                            target: target.isEmpty ? nil : target,
                            cooldownMinutes: nil,
                            enabled: true
                        )
                        Task {
                            if await service.createRule(body) { dismiss() }
                        }
                    }
                    .disabled(name.isEmpty || threshold.isEmpty)
                }
            }
        }
    }
}
