import Foundation

@MainActor
final class RandomizerService: ObservableObject {
    static let shared = RandomizerService()

    @Published var currentIdea: ProjectIdea?
    @Published var favorites: Set<Int> = []
    @Published var filters: FiltersResponse?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    private init() {}

    func fetchFilters() async {
        do {
            filters = try await api.request(path: "/api/randomizer/filters")
        } catch {}
    }

    func fetchFavorites() async {
        do {
            let response: FavoritesResponse = try await api.request(path: "/api/randomizer/favorites")
            favorites = Set(response.favorites)
        } catch {}
    }

    func spin(stack: String? = nil, difficulty: String? = nil, category: String? = nil) async {
        isLoading = true
        error = nil

        var params: [String] = []
        if let stack { params.append("stack=\(stack)") }
        if let difficulty { params.append("difficulty=\(difficulty)") }
        if let category { params.append("category=\(category)") }

        let query = params.isEmpty ? "" : "?\(params.joined(separator: "&"))"

        do {
            currentIdea = try await api.request(path: "/api/randomizer/random\(query)")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func toggleFavorite(id: Int) async {
        if favorites.contains(id) {
            favorites.remove(id)
            do {
                try await api.send(path: "/api/randomizer/favorites/\(id)", method: "DELETE")
            } catch {
                favorites.insert(id) // Revert
            }
        } else {
            favorites.insert(id)
            do {
                try await api.send(path: "/api/randomizer/favorites/\(id)", method: "POST")
            } catch {
                favorites.remove(id) // Revert
            }
        }
    }
}
