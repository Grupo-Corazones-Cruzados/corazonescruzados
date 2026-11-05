// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "Copiloto",
  platforms: [.macOS("14.2")],
  targets: [.executableTarget(name: "Copiloto", path: "Sources/Copiloto")]
)
