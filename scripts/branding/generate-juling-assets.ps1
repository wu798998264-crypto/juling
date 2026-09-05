param(
    [string]$MasterPath = "src/assets/branding/juling-core-master.png"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$master = (Resolve-Path -LiteralPath (Join-Path $repoRoot $MasterPath)).Path

function New-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$Rectangle,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Canvas {
    param([int]$Size)

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bitmap.SetResolution(96, 96)
    return $bitmap
}

function Set-Quality {
    param([System.Drawing.Graphics]$Graphics)

    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
}

function Save-Png {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$RelativePath
    )

    $outputPath = Join-Path $repoRoot $RelativePath
    $outputDir = Split-Path -Parent $outputPath
    if (-not (Test-Path -LiteralPath $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    $Bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $outputPath
}

$source = [System.Drawing.Bitmap]::FromFile($master)
try {
    $tile = New-Canvas -Size 1024
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($tile)
        try {
            Set-Quality -Graphics $graphics
            $graphics.Clear([System.Drawing.Color]::Transparent)

            $tileRect = [System.Drawing.RectangleF]::new(56, 56, 912, 912)
            $tilePath = New-RoundedRectanglePath -Rectangle $tileRect -Radius 210
            try {
                $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
                    $tileRect,
                    [System.Drawing.ColorTranslator]::FromHtml("#F9FCFD"),
                    [System.Drawing.ColorTranslator]::FromHtml("#DDF5F6"),
                    135
                )
                try {
                    $graphics.FillPath($gradient, $tilePath)
                }
                finally {
                    $gradient.Dispose()
                }

                $border = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml("#B8E4E7"), 7)
                try {
                    $graphics.DrawPath($border, $tilePath)
                }
                finally {
                    $border.Dispose()
                }
            }
            finally {
                $tilePath.Dispose()
            }

            $markRect = [System.Drawing.Rectangle]::new(176, 176, 672, 672)
            $graphics.DrawImage($source, $markRect)
        }
        finally {
            $graphics.Dispose()
        }

        Save-Png -Bitmap $tile -RelativePath "src-tauri/app-icon.png"

        foreach ($size in @(16, 48, 256, 512)) {
            $sizedIcon = New-Canvas -Size $size
            try {
                $sizedGraphics = [System.Drawing.Graphics]::FromImage($sizedIcon)
                try {
                    Set-Quality -Graphics $sizedGraphics
                    $sizedGraphics.Clear([System.Drawing.Color]::Transparent)
                    $sizedGraphics.DrawImage($tile, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
                }
                finally {
                    $sizedGraphics.Dispose()
                }
                Save-Png -Bitmap $sizedIcon -RelativePath "src-tauri/icons/${size}x${size}.png"
            }
            finally {
                $sizedIcon.Dispose()
            }
        }

        $preview = New-Canvas -Size 512
        try {
            $previewGraphics = [System.Drawing.Graphics]::FromImage($preview)
            try {
                Set-Quality -Graphics $previewGraphics
                $previewGraphics.Clear([System.Drawing.Color]::Transparent)
                $previewGraphics.DrawImage($tile, [System.Drawing.Rectangle]::new(0, 0, 512, 512))
            }
            finally {
                $previewGraphics.Dispose()
            }
            Save-Png -Bitmap $preview -RelativePath "src/assets/tray-icons/default-preview.png"
        }
        finally {
            $preview.Dispose()
        }
    }
    finally {
        $tile.Dispose()
    }

    $tray = New-Canvas -Size 512
    try {
        $trayGraphics = [System.Drawing.Graphics]::FromImage($tray)
        try {
            Set-Quality -Graphics $trayGraphics
            $trayGraphics.Clear([System.Drawing.Color]::Transparent)
            $trayGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(48, 48, 416, 416))
        }
        finally {
            $trayGraphics.Dispose()
        }

        for ($y = 0; $y -lt $tray.Height; $y++) {
            for ($x = 0; $x -lt $tray.Width; $x++) {
                $pixel = $tray.GetPixel($x, $y)
                if ($pixel.A -gt 12) {
                    $tray.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 0, 0, 0))
                }
            }
        }

        Save-Png -Bitmap $tray -RelativePath "src-tauri/icons/tray/status-template.png"
        Save-Png -Bitmap $tray -RelativePath "src/assets/tray-icons/monochrome-preview.png"
    }
    finally {
        $tray.Dispose()
    }
}
finally {
    $source.Dispose()
}
