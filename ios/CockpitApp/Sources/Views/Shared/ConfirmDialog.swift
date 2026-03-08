import SwiftUI

struct ConfirmDialog: ViewModifier {
    let title: String
    let message: String
    let destructiveLabel: String
    @Binding var isPresented: Bool
    let onConfirm: () -> Void

    func body(content: Content) -> some View {
        content
            .confirmationDialog(title, isPresented: $isPresented, titleVisibility: .visible) {
                Button(destructiveLabel, role: .destructive) {
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    onConfirm()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(message)
            }
    }
}

extension View {
    func confirmDialog(
        title: String,
        message: String,
        destructiveLabel: String,
        isPresented: Binding<Bool>,
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(ConfirmDialog(
            title: title,
            message: message,
            destructiveLabel: destructiveLabel,
            isPresented: isPresented,
            onConfirm: onConfirm
        ))
    }
}
