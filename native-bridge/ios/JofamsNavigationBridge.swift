import WebKit

/// Jofams SmartDrive v4 WKWebView bridge.
/// Connect Kakao Navi SDK / CoreLocation / ARKit callbacks to the emit* helpers.
final class JofamsNavigationBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    var commandHandler: ((_ type: String, _ payload: [String: Any]) -> Void)?

    init(webView: WKWebView? = nil) {
        self.webView = webView
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "jofamsNavigation" else { return }
        if let body = message.body as? [String: Any] {
            let type = body["type"] as? String ?? ""
            let payload = body["payload"] as? [String: Any] ?? [:]
            commandHandler?(type, payload)
        }
    }

    func emitLane(_ packet: [String: Any]) { emit("onLaneUpdate", packet: packet) }
    func emitSafety(_ packet: [String: Any]) { emit("onSafetyUpdate", packet: packet) }
    func emitImageDirection(_ packet: [String: Any]) { emit("onImageDirection", packet: packet) }
    func emitRoadEvents(_ packet: [String: Any]) { emit("onRoadEvents", packet: packet) }
    func emitAlternativeRoute(_ packet: [String: Any]) { emit("onAlternativeRoute", packet: packet) }
    func emitLocation(_ packet: [String: Any]) { emit("onLocationUpdate", packet: packet) }
    func emitTunnelState(active: Bool) { emit("onTunnelState", packet: ["active": active]) }
    func emitARStatus(_ packet: [String: Any]) { emit("onARStatus", packet: packet) }

    private func emit(_ callback: String, packet: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(packet),
              let data = try? JSONSerialization.data(withJSONObject: packet),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.JofamsNative.\(callback)(\(json))")
        }
    }
}
