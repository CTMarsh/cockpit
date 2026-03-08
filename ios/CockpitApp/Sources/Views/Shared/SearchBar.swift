import SwiftUI

struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search..."
    var onChange: ((String) -> Void)?

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.textMuted)
                .font(.subheadline)

            TextField(placeholder, text: $text)
                .font(.subheadline)
                .foregroundStyle(Theme.text)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .onChange(of: text) { _, newValue in
                    onChange?(newValue)
                }

            if !text.isEmpty {
                Button {
                    text = ""
                    onChange?("")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.textMuted)
                        .font(.subheadline)
                }
            }
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}
