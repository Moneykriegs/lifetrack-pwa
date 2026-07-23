# Generates the LifeTrack HUD app icon (arc-reactor style) as build/icon.ico
# and a tray icon at renderer/assets/tray.png. Run once: pwsh desktop/make-icons.ps1
Add-Type -AssemblyName System.Drawing

function New-ReactorBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $cx = $size / 2.0; $cy = $size / 2.0
  $cyan = [System.Drawing.Color]::FromArgb(255, 53, 226, 255)
  $cyanDim = [System.Drawing.Color]::FromArgb(160, 28, 125, 146)
  $bgDark = [System.Drawing.Color]::FromArgb(255, 7, 16, 25)

  # Dark rounded background disc
  $bgBrush = New-Object System.Drawing.SolidBrush($bgDark)
  $g.FillEllipse($bgBrush, 2, 2, $size - 4, $size - 4)

  # Outer glow ring
  $penW = [Math]::Max(2, $size / 22)
  $penOuter = New-Object System.Drawing.Pen($cyanDim, $penW)
  $m = $size * 0.13
  $g.DrawEllipse($penOuter, $m, $m, $size - 2*$m, $size - 2*$m)

  # Main cyan ring
  $penMain = New-Object System.Drawing.Pen($cyan, $penW)
  $m2 = $size * 0.24
  $g.DrawEllipse($penMain, $m2, $m2, $size - 2*$m2, $size - 2*$m2)

  # Radial ticks
  $penTick = New-Object System.Drawing.Pen($cyan, [Math]::Max(1, $size/64))
  for ($i = 0; $i -lt 12; $i++) {
    $a = $i * [Math]::PI / 6
    $r1 = $size * 0.30; $r2 = $size * 0.37
    $x1 = $cx + [Math]::Cos($a) * $r1; $y1 = $cy + [Math]::Sin($a) * $r1
    $x2 = $cx + [Math]::Cos($a) * $r2; $y2 = $cy + [Math]::Sin($a) * $r2
    $g.DrawLine($penTick, $x1, $y1, $x2, $y2)
  }

  # Bright core
  $coreR = $size * 0.13
  $coreBrush = New-Object System.Drawing.SolidBrush($cyan)
  $g.FillEllipse($coreBrush, $cx - $coreR, $cy - $coreR, $coreR*2, $coreR*2)
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230,255,255,255))
  $g.FillEllipse($whiteBrush, $cx - $coreR*0.45, $cy - $coreR*0.55, $coreR*0.8, $coreR*0.8)

  $g.Dispose()
  return $bmp
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $root 'build'
$assetsDir = Join-Path $root 'renderer\assets'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

# Tray PNG (32px)
$tray = New-ReactorBitmap 32
$tray.Save((Join-Path $assetsDir 'tray.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$tray.Dispose()

# 256px PNG for the ICO payload
$big = New-ReactorBitmap 256
$pngStream = New-Object System.IO.MemoryStream
$big.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose()
$pngBytes = $pngStream.ToArray()
$pngStream.Dispose()

# Wrap the PNG in a single-image ICO container (Vista+/electron-builder accept PNG-in-ICO)
$icoPath = Join-Path $buildDir 'icon.ico'
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)       # reserved
$bw.Write([UInt16]1)       # type = icon
$bw.Write([UInt16]1)       # count = 1
$bw.Write([Byte]0)         # width 0 = 256
$bw.Write([Byte]0)         # height 0 = 256
$bw.Write([Byte]0)         # palette
$bw.Write([Byte]0)         # reserved
$bw.Write([UInt16]1)       # color planes
$bw.Write([UInt16]32)      # bpp
$bw.Write([UInt32]$pngBytes.Length)  # size of image data
$bw.Write([UInt32]22)      # offset (6 + 16)
$bw.Write($pngBytes)
$bw.Flush(); $bw.Close(); $fs.Close()

Write-Host "Icons generated: build/icon.ico ($($pngBytes.Length) bytes payload), renderer/assets/tray.png"
