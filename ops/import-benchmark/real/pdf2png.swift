// pdf2png <pdf> <page 1-based> <out.png> [scale]
import Foundation
import PDFKit
import AppKit
let a = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[1])), let page = doc.page(at: Int(a[2])! - 1) else { exit(1) }
let scale = a.count > 4 ? CGFloat(Double(a[4])!) : 2.5
let box = page.bounds(for: .mediaBox)
let size = NSSize(width: box.width * scale, height: box.height * scale)
let img = NSImage(size: size)
img.lockFocus()
NSColor.white.set(); NSRect(origin: .zero, size: size).fill()
let ctx = NSGraphicsContext.current!.cgContext
ctx.scaleBy(x: scale, y: scale)
page.draw(with: .mediaBox, to: ctx)
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
