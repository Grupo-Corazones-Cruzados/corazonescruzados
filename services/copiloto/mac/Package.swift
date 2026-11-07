// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "Copiloto",
  platforms: [.macOS("14.2")],
  targets: [
    .target(name: "CapturaObjC", path: "Sources/CapturaObjC"),
    .executableTarget(name: "Copiloto", dependencies: ["CapturaObjC"], path: "Sources/Copiloto"),
  ]
)
