import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)

    // Desktop benzeri pencere ayarlari
    self.title = "CourseIntellect"
    self.minSize = NSSize(width: 960, height: 640)
    self.setContentSize(NSSize(width: 1280, height: 800))
    self.center()

    // Tam ekran destegi
    self.collectionBehavior.insert(.fullScreenPrimary)

    // Baslik cubugu seffaf — sidebar ile birlesik gorunum
    self.titlebarAppearsTransparent = true
    self.titleVisibility = .hidden
    self.styleMask.insert(.fullSizeContentView)

    super.awakeFromNib()
  }
}
