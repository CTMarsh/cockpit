import SwiftUI

struct RandomizerView: View {
    @ObservedObject private var service = RandomizerService.shared
    @State private var selectedStack: String?
    @State private var selectedDifficulty: String?
    @State private var selectedCategory: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                // Filters
                if let filters = service.filters {
                    VStack(spacing: 10) {
                        FilterPicker(title: "Stack", options: filters.stacks, selection: $selectedStack)
                        FilterPicker(title: "Difficulty", options: filters.difficulties, selection: $selectedDifficulty)
                        FilterPicker(title: "Category", options: filters.categories, selection: $selectedCategory)
                    }
                    .padding(.horizontal)
                }

                // Spin button
                Button {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    Task {
                        await service.spin(
                            stack: selectedStack,
                            difficulty: selectedDifficulty,
                            category: selectedCategory
                        )
                    }
                } label: {
                    if service.isLoading {
                        ProgressView()
                            .tint(Theme.background)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                    } else {
                        Label("Spin", systemImage: "dice.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(14)
                    }
                }
                .background(Theme.accent)
                .foregroundStyle(Theme.background)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                // Idea card
                if let idea = service.currentIdea {
                    IdeaCard(idea: idea, isFavorite: service.favorites.contains(idea.id)) {
                        Task { await service.toggleFavorite(id: idea.id) }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Randomizer")
        .task {
            await service.fetchFilters()
            await service.fetchFavorites()
        }
    }
}

private struct FilterPicker: View {
    let title: String
    let options: [String]
    @Binding var selection: String?

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(Theme.textMuted)
                .frame(width: 70, alignment: .leading)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    FilterChip(label: "Any", selected: selection == nil) { selection = nil }
                    ForEach(options, id: \.self) { option in
                        FilterChip(label: option, selected: selection == option) {
                            selection = selection == option ? nil : option
                        }
                    }
                }
            }
        }
    }
}

private struct FilterChip: View {
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(selected ? Theme.accent : Theme.surface)
                .foregroundStyle(selected ? Theme.background : Theme.text)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Theme.border, lineWidth: selected ? 0 : 1))
        }
    }
}

private struct IdeaCard: View {
    let idea: ProjectIdea
    let isFavorite: Bool
    let onToggleFavorite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(idea.title)
                    .font(.title3.bold())
                    .foregroundStyle(Theme.text)
                Spacer()
                Button(action: onToggleFavorite) {
                    Image(systemName: isFavorite ? "star.fill" : "star")
                        .foregroundStyle(isFavorite ? Theme.accent : Theme.textMuted)
                }
            }

            if let description = idea.description, !description.isEmpty {
                Text(description)
                    .font(.body)
                    .foregroundStyle(Theme.textMuted)
            }

            HStack(spacing: 8) {
                if let difficulty = idea.difficulty {
                    StatusBadge(text: difficulty, color: Theme.warning)
                }
                if let category = idea.category {
                    StatusBadge(text: category, color: Theme.info)
                }
                if let hours = idea.estimatedHours {
                    StatusBadge(text: "\(hours)h", color: Theme.textMuted)
                }
            }

            if let stack = idea.stack, !stack.isEmpty {
                HStack(spacing: 4) {
                    ForEach(stack, id: \.self) { tech in
                        Text(tech)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.accent.opacity(0.15))
                            .foregroundStyle(Theme.accent)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.3), lineWidth: 1))
    }
}
