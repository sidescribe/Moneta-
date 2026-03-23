Add-Type -AssemblyName System.Drawing
$public = (Join-Path (Join-Path $PSScriptRoot '..') 'public' | Resolve-Path).Path
foreach ($s in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
  $fontSize = [int]($s / 4)
  $font = New-Object System.Drawing.Font 'Segoe UI', $fontSize, ([System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF 0, 0, $s, $s
  $g.DrawString('M', $font, [System.Drawing.Brushes]::White, $rect, $sf)
  $g.Dispose()
  $out = Join-Path $public "icon-${s}x${s}.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $out"
}
