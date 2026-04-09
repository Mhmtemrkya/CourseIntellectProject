$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$logoPath = Join-Path $repoRoot 'src\assets\brand\logo.png'
if (-not (Test-Path $logoPath)) {
  throw "Logo not found: $logoPath"
}

$outDir = Join-Path $repoRoot 'src-tauri\installer'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

try {
  Add-Type -AssemblyName System.Drawing.Common -ErrorAction Stop
} catch {
  Add-Type -AssemblyName System.Drawing -ErrorAction Stop
}

function New-BrandBitmap {
  param(
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height,
    [Parameter(Mandatory = $true)][ValidateSet('Horizontal', 'Vertical')][string]$Gradient,
    [Parameter()][System.Drawing.Imaging.PixelFormat]$PixelFormat = [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, $PixelFormat)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $rect = New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)
  $brandA = [System.Drawing.Color]::FromArgb(255, 0, 53, 79)   # #00354F
  $brandB = [System.Drawing.Color]::FromArgb(255, 0, 74, 110)  # #004A6E

  $mode = if ($Gradient -eq 'Horizontal') {
    [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
  } else {
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  }

  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $brandA, $brandB, $mode)
  $graphics.FillRectangle($brush, $rect)
  $brush.Dispose()

  return @{
    Bitmap   = $bitmap
    Graphics = $graphics
  }
}

$logo = $null
try {
  $logo = [System.Drawing.Image]::FromFile($logoPath)

  # Header image (150x57)
  $header = New-BrandBitmap -Width 150 -Height 57 -Gradient Horizontal
  try {
    $accent = [System.Drawing.Color]::FromArgb(255, 217, 121, 11) # #D9790B
    $accentBrush = New-Object System.Drawing.SolidBrush($accent)
    $header.Graphics.FillRectangle($accentBrush, 0, 55, 150, 2)
    $accentBrush.Dispose()

    $srcRectHeader = New-Object System.Drawing.Rectangle(0, 0, $logo.Width, [int]($logo.Height * 0.72))
    $destRectHeader = New-Object System.Drawing.Rectangle(8, 4, 48, 48)
    $header.Graphics.DrawImage($logo, $destRectHeader, $srcRectHeader, [System.Drawing.GraphicsUnit]::Pixel)

    $headerPath = Join-Path $outDir 'header.bmp'
    $header.Bitmap.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    Write-Host "Generated: $headerPath"
  } finally {
    $header.Graphics.Dispose()
    $header.Bitmap.Dispose()
  }

  # Sidebar image (164x314)
  $sidebar = New-BrandBitmap -Width 164 -Height 314 -Gradient Vertical
  try {
    $accent = [System.Drawing.Color]::FromArgb(255, 217, 121, 11) # #D9790B
    $accentBrush = New-Object System.Drawing.SolidBrush($accent)
    $sidebar.Graphics.FillRectangle($accentBrush, 0, 0, 6, 314)
    $accentBrush.Dispose()

    # Light panel behind the logo for better contrast
    $panelRect = New-Object System.Drawing.Rectangle(10, 14, 144, 186)
    $panelColor = [System.Drawing.Color]::FromArgb(255, 245, 248, 250)
    $panelBrush = New-Object System.Drawing.SolidBrush($panelColor)
    $sidebar.Graphics.FillRectangle($panelBrush, $panelRect)
    $panelBrush.Dispose()

    $panelBorder = [System.Drawing.Color]::FromArgb(255, 209, 222, 230)
    $panelPen = New-Object System.Drawing.Pen($panelBorder, 1)
    $sidebar.Graphics.DrawRectangle($panelPen, $panelRect)
    $panelPen.Dispose()

    $maxLogoWidth = 140
    $scale = $maxLogoWidth / $logo.Width
    $drawWidth = [int]($logo.Width * $scale)
    $drawHeight = [int]($logo.Height * $scale)
    $x = [int]((164 - $drawWidth) / 2)
    $y = 24
    $destRectSidebar = New-Object System.Drawing.Rectangle($x, $y, $drawWidth, $drawHeight)

    $sidebar.Graphics.DrawImage($logo, $destRectSidebar)

    $sidebarPath = Join-Path $outDir 'sidebar.bmp'
    $sidebar.Bitmap.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    Write-Host "Generated: $sidebarPath"
  } finally {
    $sidebar.Graphics.Dispose()
    $sidebar.Bitmap.Dispose()
  }

  # DMG background (660x400)
  $dmg = New-BrandBitmap -Width 660 -Height 400 -Gradient Horizontal -PixelFormat ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $highlight = [System.Drawing.Color]::FromArgb(45, 255, 255, 255)
    $highlightBrush = New-Object System.Drawing.SolidBrush($highlight)
    $dmg.Graphics.FillRectangle($highlightBrush, 110, 120, 140, 140)
    $dmg.Graphics.FillRectangle($highlightBrush, 410, 120, 140, 140)
    $highlightBrush.Dispose()

    $highlightBorder = [System.Drawing.Color]::FromArgb(90, 255, 255, 255)
    $highlightPen = New-Object System.Drawing.Pen($highlightBorder, 2)
    $dmg.Graphics.DrawRectangle($highlightPen, 110, 120, 140, 140)
    $dmg.Graphics.DrawRectangle($highlightPen, 410, 120, 140, 140)
    $highlightPen.Dispose()

    $accent = [System.Drawing.Color]::FromArgb(255, 217, 121, 11) # #D9790B
    $arrowPen = New-Object System.Drawing.Pen($accent, 8)
    $arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $dmg.Graphics.DrawLine($arrowPen, 270, 190, 390, 190)
    $dmg.Graphics.DrawLine($arrowPen, 360, 165, 390, 190)
    $dmg.Graphics.DrawLine($arrowPen, 360, 215, 390, 190)
    $arrowPen.Dispose()

    $panelRect = New-Object System.Drawing.Rectangle(190, 20, 280, 110)
    $panelColor = [System.Drawing.Color]::FromArgb(240, 245, 248, 250)
    $panelBrush = New-Object System.Drawing.SolidBrush($panelColor)
    $dmg.Graphics.FillRectangle($panelBrush, $panelRect)
    $panelBrush.Dispose()

    $panelBorder = [System.Drawing.Color]::FromArgb(255, 209, 222, 230)
    $panelPen = New-Object System.Drawing.Pen($panelBorder, 1)
    $dmg.Graphics.DrawRectangle($panelPen, $panelRect)
    $panelPen.Dispose()

    $maxLogoWidth = 260
    $scale = $maxLogoWidth / $logo.Width
    $drawWidth = [int]($logo.Width * $scale)
    $drawHeight = [int]($logo.Height * $scale)
    $x = [int](190 + (280 - $drawWidth) / 2)
    $y = [int](20 + (110 - $drawHeight) / 2)
    $destRectLogo = New-Object System.Drawing.Rectangle($x, $y, $drawWidth, $drawHeight)
    $dmg.Graphics.DrawImage($logo, $destRectLogo)

    $font = New-Object System.Drawing.Font('Segoe UI', 18, ([System.Drawing.FontStyle]::Bold))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near

    $text = 'Drag to Applications'
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 255, 255, 255))
    $textRectShadow = New-Object System.Drawing.RectangleF(0, 286, 660, 40)
    $textRect = New-Object System.Drawing.RectangleF(0, 284, 660, 40)
    $dmg.Graphics.DrawString($text, $font, $shadowBrush, $textRectShadow, $format)
    $dmg.Graphics.DrawString($text, $font, $textBrush, $textRect, $format)

    $shadowBrush.Dispose()
    $textBrush.Dispose()
    $format.Dispose()
    $font.Dispose()

    $dmgPath = Join-Path $outDir 'dmg-background.png'
    $dmg.Bitmap.Save($dmgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Generated: $dmgPath"
  } finally {
    $dmg.Graphics.Dispose()
    $dmg.Bitmap.Dispose()
  }
} finally {
  if ($logo) { $logo.Dispose() }
}
