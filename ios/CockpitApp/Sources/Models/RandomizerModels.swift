import Foundation

struct ProjectIdea: Decodable, Identifiable {
    let id: Int
    let title: String
    let description: String?
    let stack: [String]?
    let difficulty: String?
    let category: String?
    let estimatedHours: String?
    let isCustom: Bool?
    let prompt: String?
}

struct IdeasResponse: Decodable {
    let ideas: [ProjectIdea]
    let total: Int
}

struct FiltersResponse: Decodable {
    let stacks: [String]
    let difficulties: [String]
    let categories: [String]
}

struct FavoritesResponse: Decodable {
    let favorites: [Int]
}

struct CreateIdeaBody: Encodable {
    let title: String
    let description: String?
    let stack: [String]?
    let difficulty: String?
    let category: String?
    let estimatedHours: String?
}
