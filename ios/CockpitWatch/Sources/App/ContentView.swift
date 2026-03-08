import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connectivity: WatchConnectivityManager

    var body: some View {
        TabView {
            WatchDashboardView()
            WatchServicesView()
            WatchClusterView()
            WatchWoLView()
            WatchAlertsView()
            WatchVMsView()
        }
        .tabViewStyle(.verticalPage)
    }
}
