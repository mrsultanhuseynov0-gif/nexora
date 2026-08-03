# Generate brand-matched SVG product images (name always visible on card)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"
$OutDir = Join-Path $Root "assets\products"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Esc([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;')
}

function Wrap-Lines([string]$text, [int]$maxLen) {
  $words = $text -split '\s+'
  $lines = New-Object System.Collections.Generic.List[string]
  $cur = ""
  foreach ($w in $words) {
    if (($cur + " " + $w).Trim().Length -le $maxLen) {
      $cur = ($cur + " " + $w).Trim()
    } else {
      if ($cur) { $lines.Add($cur) }
      $cur = $w
    }
  }
  if ($cur) { $lines.Add($cur) }
  if ($lines.Count -gt 3) {
    return @($lines[0], $lines[1], ($lines[2] -replace '.{18}$', '…'))
  }
  return $lines.ToArray()
}

$BrandColors = @{
  samsung = @("#1428A0", "#000000"); apple = @("#555555", "#111111"); xiaomi = @("#FF6900", "#1a1a1a")
  google = @("#4285F4", "#202124"); huawei = @("#CF0A2C", "#1a1a1a"); sony = @("#000000", "#333333")
  nike = @("#111111", "#f5f5f5"); adidas = @("#000000", "#ebebeb"); puma = @("#000000", "#d50032")
  lg = @("#A50034", "#111"); philips = @("#0B5ED7", "#0a2540"); bosch = @("#EA0016", "#111")
  dyson = @("#6e2c8f", "#1a1a1a"); lego = @("#E3000B", "#FFD500"); nivea = @("#0033A0", "#e8f1ff")
  loreal = @("#000000", "#c9a227"); maybelline = @("#000000", "#e91e8c"); logitech = @("#00B8FC", "#111")
  asus = @("#000000", "#FF0000"); lenovo = @("#E2231A", "#111"); hp = @("#0096D6", "#111")
  dell = @("#007DB8", "#111"); msi = @("#FF0000", "#111"); jbl = @("#FF6600", "#111")
  canon = @("#CC0000", "#111"); gopro = @("#00B3E3", "#111"); dji = @("#111", "#00a0e9")
  garmin = @("#000000", "#00b5e2"); ikea = @("#0051BA", "#FFDA1A"); decathlon = @("#0082C3", "#111")
  penguin = @("#FF6900", "#111111"); default = @("#FF0000", "#111111")
}

function Glyph([string]$sub, [string]$cat, [string]$name) {
  $n = ($name + " " + $sub + " " + $cat).ToLowerInvariant()
  if ($n -match 'phone|iphone|galaxy|pixel|redmi|smartphone') {
    return '<rect x="330" y="180" width="140" height="260" rx="22" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><circle cx="400" cy="410" r="10" fill="rgba(255,255,255,0.7)"/>'
  }
  if ($n -match 'laptop|macbook|notebook|ultrabook') {
    return '<rect x="250" y="220" width="300" height="190" rx="12" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><rect x="230" y="410" width="340" height="18" rx="4" fill="rgba(255,255,255,0.5)"/>'
  }
  if ($n -match 'headphone|earbuds|buds|speaker|soundbar|headset|neckband') {
    return '<path d="M280 300c0-70 50-120 120-120s120 50 120 120v90h-50v-90c0-40-30-70-70-70s-70 30-70 70v90h-50v-90z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>'
  }
  if ($n -match 'watch|band') {
    return '<rect x="350" y="160" width="100" height="70" rx="16" fill="rgba(255,255,255,0.25)"/><rect x="355" y="230" width="90" height="120" rx="20" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><rect x="350" y="350" width="100" height="70" rx="16" fill="rgba(255,255,255,0.25)"/>'
  }
  if ($n -match 'shoe|sneaker|boot|runner|ultraboost') {
    return '<path d="M220 360c40-40 100-60 180-55 60 4 120 20 180 10 20 40 10 70-20 80-80 20-200 25-300 5-30-8-50-25-40-40z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>'
  }
  if ($n -match 'tv|monitor') {
    return '<rect x="220" y="200" width="360" height="220" rx="10" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><rect x="360" y="430" width="80" height="20" fill="rgba(255,255,255,0.5)"/>'
  }
  if ($n -match 'book|novel|planner|poetry') {
    return '<rect x="280" y="180" width="240" height="300" rx="6" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><line x1="320" y1="240" x2="480" y2="240" stroke="rgba(255,255,255,0.5)" stroke-width="6"/>'
  }
  if ($n -match 'toy|lego|plush|puzzle|robot|scooter') {
    return '<circle cx="400" cy="280" r="70" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><rect x="330" y="360" width="140" height="90" rx="16" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/>'
  }
  if ($n -match 'cream|serum|makeup|mascara|beauty|lotion|spf') {
    return '<rect x="350" y="200" width="100" height="220" rx="30" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><rect x="370" y="170" width="60" height="40" rx="8" fill="rgba(255,255,255,0.4)"/>'
  }
  if ($n -match 'car|dash|auto|tire|obd') {
    return '<path d="M240 360h320l-30-70c-10-24-30-40-56-40H326c-26 0-46 16-56 40l-30 70z" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><circle cx="300" cy="370" r="28" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><circle cx="500" cy="370" r="28" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/>'
  }
  if ($n -match 'vacuum|blender|kettle|appliance|fryer') {
    return '<rect x="320" y="210" width="160" height="220" rx="20" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><circle cx="400" cy="300" r="36" fill="rgba(255,255,255,0.25)"/>'
  }
  # bag / apparel / default pack
  return '<rect x="300" y="210" width="200" height="220" rx="18" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="8"/><path d="M340 210v-30c0-30 20-50 60-50s60 20 60 50v30" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="8"/>'
}

function Make-Svg($p) {
  $bid = [string]$p.brandId
  if (-not $BrandColors.ContainsKey($bid)) { $bid = "default" }
  $c1 = $BrandColors[$bid][0]
  $c2 = $BrandColors[$bid][1]
  # Apple / fashion light text on dark
  $brand = Esc ([string]$p.brand)
  $lines = Wrap-Lines ([string]$p.name) 22
  $glyph = Glyph ([string]$p.subcategory) ([string]$p.category) ([string]$p.name)
  $y = 520
  $textNodes = ""
  foreach ($line in $lines) {
    $textNodes += "<text x='400' y='$y' text-anchor='middle' fill='white' font-family='Segoe UI, Arial, sans-serif' font-size='28' font-weight='700'>$(Esc $line)</text>`n"
    $y += 36
  }
  @"
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="$c1"/>
      <stop offset="100%" stop-color="$c2"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="640" cy="120" r="160" fill="rgba(255,255,255,0.06)"/>
  <circle cx="120" cy="680" r="200" fill="rgba(0,0,0,0.18)"/>
  <text x="48" y="64" fill="rgba(255,255,255,0.55)" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4">NEXORA</text>
  <text x="400" y="140" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="3">$brand</text>
  $glyph
  $textNodes
  <text x="400" y="760" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-family="Segoe UI, Arial, sans-serif" font-size="18">$(Esc ([string]$p.subcategory))</text>
</svg>
"@
}

$data = Get-Content $ProductsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$i = 0
foreach ($p in $data.products) {
  $svg = Make-Svg $p
  $file = Join-Path $OutDir ($p.id + ".svg")
  [IO.File]::WriteAllText($file, $svg, [Text.UTF8Encoding]::new($false))
  $rel = "assets/products/$($p.id).svg"
  $g = if ($p.gradient) { [string]$p.gradient } else { "linear-gradient(135deg,#111,#333)" }
  $p.image = $rel
  $p.images = @(
    [ordered]@{ src = $rel; alt = [string]$p.name; gradient = $g },
    [ordered]@{ src = $rel; alt = "$($p.name) 2"; gradient = $g },
    [ordered]@{ src = $rel; alt = "$($p.name) 3"; gradient = $g }
  )
  $i++
}

$data.version = 6
$manat = [char]0x20BC
$json = $data | ConvertTo-Json -Depth 12
$json = [regex]::Replace($json, '"currency"\s*:\s*"[^"]*"', "`"currency`": `"$manat`"")
# keep L'Oreal ascii
$json = $json.Replace("L'Or" + [char]0x00C3 + [char]0x00A9 + "al", "L'Oreal")
[IO.File]::WriteAllText($ProductsPath, $json, [Text.UTF8Encoding]::new($false))
Write-Host "Generated $i SVGs in assets/products + catalog version 6"
Get-ChildItem $OutDir -Filter "*.svg" | Measure-Object | ForEach-Object { "svg_files=$($_.Count)" }
