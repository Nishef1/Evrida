# Regenerates the Evrida launcher icon, adaptive icon layers and splash mark.
# The mark: a rising sun over seven stripes, one per planning horizon (Day to Life).
# Usage (Windows): powershell -NoProfile -File scripts/generate-brand-assets.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\assets\brand'
$night = '#FFA45E','#FF7D8F','#E477BC','#B58AF0','#8C8CFF','#6FA8E8','#6283BE'
$paper = '#D9722A','#D6455D','#B83C86','#8444C0','#5654D4','#2F6FB5','#1F3A5F'
function C($hex, $a = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B) }

function Draw-Mark($g, $size, $scale, $mono, $stripes, $sunHex) {
  # Geometry is authored on a 1024 grid and scaled around the canvas center.
  $k = $size / 1024.0 * $scale
  $ox = ($size - 1024 * $k) / 2
  $oy = ($size - 1024 * $k) / 2 - 34 * $k
  $g.SmoothingMode = 'AntiAlias'
  $horizon = 560
  $sunColor = if ($mono) { C '#FFFFFF' } else { C $sunHex }
  $sun = New-Object System.Drawing.SolidBrush $sunColor
  $g.SetClip((New-Object System.Drawing.RectangleF ($ox), ($oy), (1024 * $k), ($horizon * $k)))
  $g.FillEllipse($sun, ($ox + 322 * $k), ($oy + 200 * $k), (380 * $k), (380 * $k))
  $g.ResetClip()
  for ($i = 0; $i -lt 7; $i++) {
    $y = $horizon + 40 + $i * 44
    $inset = $i * 18
    $w = 640 - 2 * $inset
    $x = 192 + $inset
    $col = if ($mono) { C '#FFFFFF' } else { C $stripes[$i] }
    $b = New-Object System.Drawing.SolidBrush $col
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 14 * $k; $rx = $ox + $x * $k; $ry = $oy + $y * $k; $rw = $w * $k; $rh = 28 * $k
    $path.AddArc($rx, $ry, 2*$r, 2*$r, 180, 90); $path.AddArc($rx + $rw - 2*$r, $ry, 2*$r, 2*$r, 270, 90)
    $path.AddArc($rx + $rw - 2*$r, $ry + $rh - 2*$r, 2*$r, 2*$r, 0, 90); $path.AddArc($rx, $ry + $rh - 2*$r, 2*$r, 2*$r, 90, 90)
    $path.CloseFigure(); $g.FillPath($b, $path)
  }
}
function Save-Png($name, $size, $bg, $scale, $mono, $stripes, $sunHex) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  if ($bg) { $g.Clear((C $bg)) } else { $g.Clear([System.Drawing.Color]::Transparent) }
  Draw-Mark $g $size $scale $mono $stripes $sunHex
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Save-Png 'icon.png'                1024 '#14182B' 1.0  $false $night '#FFB36B'
Save-Png 'adaptive-foreground.png' 1024 $null     0.66 $false $night '#FFB36B'
Save-Png 'monochrome.png'          1024 $null     0.66 $true  $night '#FFFFFF'
Save-Png 'splash-light.png'        1024 $null     0.9  $false $paper '#E8833A'
Save-Png 'splash-dark.png'         1024 $null     0.9  $false $night '#FFB36B'
Write-Output 'brand assets written'
