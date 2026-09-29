Add-Type -AssemblyName System.Drawing

$SourceImage = "C:\Users\Khale\.gemini\antigravity-ide\brain\252a3e2b-4eb4-453c-bc2e-5c5409eaff0d\makers_pos_icon_1790618244368.jpg"
$IconsDir    = "C:\Users\Khale\Desktop\Eslam-Makers-pos\src-tauri\icons"

function Resize-PNG {
    param([string]$Src, [string]$Dst, [int]$W, [int]$H)
    $img = [System.Drawing.Image]::FromFile($Src)
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $W, $H)
    $g.Dispose(); $img.Dispose()
    $bmp.Save($Dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  OK $Dst"
}

function Build-Ico {
    param([string[]]$Pngs, [string]$Out)
    $images = @()
    foreach ($f in $Pngs) {
        $bytes = [System.IO.File]::ReadAllBytes($f)
        $bmp   = [System.Drawing.Image]::FromFile($f)
        $images += [PSCustomObject]@{ W=$bmp.Width; H=$bmp.Height; Data=$bytes }
        $bmp.Dispose()
    }
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$images.Count)
    $offset = 6 + 16 * $images.Count
    foreach ($img in $images) {
        $bw.Write([byte](if ($img.W -ge 256) {0} else {$img.W}))
        $bw.Write([byte](if ($img.H -ge 256) {0} else {$img.H}))
        $bw.Write([byte]0); $bw.Write([byte]0)
        $bw.Write([uint16]1); $bw.Write([uint16]32)
        $bw.Write([uint32]$img.Data.Length)
        $bw.Write([uint32]$offset)
        $offset += $img.Data.Length
    }
    foreach ($img in $images) { $bw.Write($img.Data) }
    $bw.Flush()
    [System.IO.File]::WriteAllBytes($Out, $ms.ToArray())
    $bw.Dispose(); $ms.Dispose()
    Write-Host "  OK $Out (ICO $($images.Count) sizes)"
}

Write-Host "Generating Tauri icons..."

$sizes = @(
    @{Name="32x32.png";           W=32;  H=32},
    @{Name="128x128.png";         W=128; H=128},
    @{Name="128x128@2x.png";      W=256; H=256},
    @{Name="icon.png";            W=512; H=512},
    @{Name="Square30x30Logo.png"; W=30;  H=30},
    @{Name="Square44x44Logo.png"; W=44;  H=44},
    @{Name="Square71x71Logo.png"; W=71;  H=71},
    @{Name="Square89x89Logo.png"; W=89;  H=89},
    @{Name="Square107x107Logo.png";W=107; H=107},
    @{Name="Square142x142Logo.png";W=142; H=142},
    @{Name="Square150x150Logo.png";W=150; H=150},
    @{Name="Square284x284Logo.png";W=284; H=284},
    @{Name="Square310x310Logo.png";W=310; H=310},
    @{Name="StoreLogo.png";        W=50;  H=50}
)

foreach ($s in $sizes) {
    Resize-PNG -Src $SourceImage -Dst (Join-Path $IconsDir $s.Name) -W $s.W -H $s.H
}

Write-Host "Building multi-size ICO..."
$icoSizes = @(16, 32, 48, 64, 128, 256)
$tmpFiles = @()
foreach ($sz in $icoSizes) {
    $tmp = Join-Path $env:TEMP "mk_${sz}.png"
    Resize-PNG -Src $SourceImage -Dst $tmp -W $sz -H $sz
    $tmpFiles += $tmp
}

Build-Ico -Pngs $tmpFiles -Out (Join-Path $IconsDir "icon.ico")
$tmpFiles | ForEach-Object { Remove-Item $_ -ErrorAction SilentlyContinue }

Write-Host "DONE - All icons written to $IconsDir"
