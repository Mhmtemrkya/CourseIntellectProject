import AppKit
import Foundation

let fileManager = FileManager.default
let scriptURL = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
let desktopRoot = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
let installerRoot = desktopRoot.appendingPathComponent("src-tauri/installer")
let baseURL = installerRoot.appendingPathComponent("dmg-background-base.png")
let logoURL = desktopRoot.appendingPathComponent("src-tauri/icons/128x128@2x.png")
let outputURL = installerRoot.appendingPathComponent("dmg-background.png")

guard fileManager.fileExists(atPath: baseURL.path),
      let baseImage = NSImage(contentsOf: baseURL),
      let logoImage = NSImage(contentsOf: logoURL) else {
    fputs("DMG background assets could not be loaded.\n", stderr)
    exit(1)
}

let canvasSize = NSSize(width: 660, height: 400)
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(canvasSize.width),
    pixelsHigh: Int(canvasSize.height),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("DMG background drawing context could not be created.\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.shouldAntialias = true

let sourceRatio = baseImage.size.width / baseImage.size.height
let canvasRatio = canvasSize.width / canvasSize.height
var sourceRect = NSRect(origin: .zero, size: baseImage.size)
if sourceRatio > canvasRatio {
    let croppedWidth = baseImage.size.height * canvasRatio
    sourceRect.origin.x = (baseImage.size.width - croppedWidth) / 2
    sourceRect.size.width = croppedWidth
} else {
    let croppedHeight = baseImage.size.width / canvasRatio
    sourceRect.origin.y = (baseImage.size.height - croppedHeight) / 2
    sourceRect.size.height = croppedHeight
}
baseImage.draw(in: NSRect(origin: .zero, size: canvasSize), from: sourceRect, operation: .sourceOver, fraction: 1)

func roundedRect(_ rect: NSRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil, lineWidth: CGFloat = 1) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = lineWidth
        path.stroke()
    }
}

func drawCenteredText(_ text: String, yFromTop: CGFloat, font: NSFont, color: NSColor) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color
    ]
    let size = text.size(withAttributes: attributes)
    let rect = NSRect(
        x: (canvasSize.width - size.width) / 2,
        y: canvasSize.height - yFromTop - size.height,
        width: size.width,
        height: size.height
    )
    text.draw(in: rect, withAttributes: attributes)
}

// Keep the brand compact and away from the Finder icon positions.
logoImage.draw(
    in: NSRect(x: 292, y: 310, width: 76, height: 76),
    from: .zero,
    operation: .sourceOver,
    fraction: 1
)

drawCenteredText(
    "CourseIntellect'i Yükleyin",
    yFromTop: 92,
    font: .systemFont(ofSize: 22, weight: .semibold),
    color: .white
)
drawCenteredText(
    "Uygulamayı Applications klasörüne sürükleyin",
    yFromTop: 124,
    font: .systemFont(ofSize: 13, weight: .regular),
    color: NSColor(calibratedWhite: 0.82, alpha: 1)
)

// Finder draws the real app and Applications icons on top of these quiet targets.
let targetFill = NSColor(calibratedRed: 0.055, green: 0.112, blue: 0.20, alpha: 0.72)
let targetStroke = NSColor(calibratedRed: 0.18, green: 0.39, blue: 0.60, alpha: 0.55)
roundedRect(NSRect(x: 103, y: 113, width: 134, height: 134), radius: 28, fill: targetFill, stroke: targetStroke)
roundedRect(NSRect(x: 423, y: 113, width: 134, height: 134), radius: 28, fill: targetFill, stroke: targetStroke)

// A centered directional cue that never sits under either Finder icon.
let arrow = NSBezierPath()
arrow.move(to: NSPoint(x: 268, y: 180))
arrow.line(to: NSPoint(x: 385, y: 180))
arrow.move(to: NSPoint(x: 365, y: 199))
arrow.line(to: NSPoint(x: 385, y: 180))
arrow.line(to: NSPoint(x: 365, y: 161))
arrow.lineCapStyle = .round
arrow.lineJoinStyle = .round
arrow.lineWidth = 7
NSColor(calibratedRed: 1, green: 0.50, blue: 0.04, alpha: 1).setStroke()
arrow.stroke()

drawCenteredText(
    "Sürükle ve bırak",
    yFromTop: 252,
    font: .systemFont(ofSize: 12, weight: .medium),
    color: NSColor(calibratedWhite: 0.75, alpha: 1)
)

roundedRect(
    NSRect(x: 202, y: 22, width: 256, height: 30),
    radius: 15,
    fill: NSColor(calibratedWhite: 1, alpha: 0.055),
    stroke: NSColor(calibratedWhite: 1, alpha: 0.10)
)
drawCenteredText(
    "CourseIntellect  •  Güvenli macOS kurulumu",
    yFromTop: 355,
    font: .systemFont(ofSize: 11, weight: .medium),
    color: NSColor(calibratedWhite: 0.72, alpha: 1)
)

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [.compressionFactor: 0.9]) else {
    fputs("DMG background PNG could not be encoded.\n", stderr)
    exit(1)
}

try png.write(to: outputURL, options: .atomic)
print("Generated \(outputURL.path)")
