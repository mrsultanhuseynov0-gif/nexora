# Assign curated remote Unsplash/Wikimedia image URLs by brand/category.
# NOTE: PowerShell variables are case-insensitive - never use $pools and $Pools together.
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"
$PoolsPath = Join-Path $Root "data\image-pools.json"

$rawPools = Get-Content $PoolsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$poolMap = @{}
foreach ($prop in $rawPools.PSObject.Properties) {
  $clean = New-Object System.Collections.Generic.List[string]
  foreach ($u in @($prop.Value)) {
    if (-not $u) { continue }
    $s = [string]$u
    if ($s -notmatch '^https?://') { continue }
    if ($s -match '\.pdf') { continue }
    if ($s -match 'page1-') { continue }
    if ($s -match '\.svg(\?|$)') { continue }
    [void]$clean.Add($s)
  }
  $poolMap[$prop.Name] = @($clean)
  Write-Host ("{0,-16} {1}" -f $prop.Name, $clean.Count)
}

$laptopCount = @($poolMap['laptop']).Count
if ($laptopCount -lt 1) {
  throw "Pool map is empty - aborting to protect products.json"
}

function Resolve-Pool([object]$p) {
  $brand = ([string]$p.brandId).ToLowerInvariant()
  if (-not $brand) { $brand = ([string]$p.brand).ToLowerInvariant() }
  $sub = ([string]$p.subcategory).ToLowerInvariant()
  $cat = ([string]$p.category).ToLowerInvariant()
  $n = ([string]$p.name).ToLowerInvariant()

  if ($sub -eq 'smartphones' -or ($n -match '(?<![a-z])(iphone|galaxy|pixel|redmi|poco|xperia|nova)(?![a-z])' -and $n -notmatch 'watch|book|buds|airpods|earbuds')) {
    if ($brand -match 'samsung' -or $n -match 'galaxy') { return 'samsung-phone' }
    if ($brand -match 'apple' -or $n -match 'iphone') { return 'apple-phone' }
    if ($brand -match 'google' -or $n -match 'pixel') { return 'google-phone' }
    if ($brand -match 'xiaomi' -or $n -match 'redmi|poco|xiaomi') { return 'xiaomi-phone' }
    if ($brand -match 'huawei' -or $n -match 'nova|huawei') { return 'huawei-phone' }
    if ($brand -match 'sony' -or $n -match 'xperia') { return 'sony-phone' }
    return 'samsung-phone'
  }
  if ($sub -eq 'laptops' -or $n -match 'macbook|laptop|notebook|zenbook|thinkpad|ideapad|pavilion|xps|victus|latitude') {
    if ($brand -match 'apple' -or $n -match 'macbook') { return 'apple-laptop' }
    return 'laptop'
  }
  if ($sub -eq 'audio' -or $n -match 'headphone|earbuds|buds|speaker|soundbar|headset|neckband|airpods') { return 'headphones' }
  if ($sub -eq 'wearables' -or $n -match 'watch|fitness band') { return 'watch' }
  if ($sub -eq 'cameras' -or $n -match 'camera|drone|gimbal|mirrorless') { return 'camera' }
  if ($sub -eq 'tv' -or $n -match '\btv\b|monitor|oled|qled') { return 'tv' }
  if ($sub -eq 'gaming' -or $n -match 'controller|keyboard|gaming mouse|vr ') { return 'gaming' }
  if ($sub -eq 'shoes' -or $n -match 'shoe|sneaker|boot|runner|ultraboost') { return 'shoes' }
  if ($cat -eq 'beauty' -or $sub -match 'skincare|makeup') { return 'beauty' }
  if ($cat -eq 'books' -or $sub -match 'fiction|hobby') { return 'books' }
  if ($cat -eq 'kids' -or $sub -eq 'toys' -or $n -match 'lego|plush|toy|puzzle') { return 'toys' }
  if ($cat -eq 'auto') { return 'auto' }
  if ($cat -eq 'home' -or $sub -match 'appliance|smart-home|decor') { return 'home' }
  if ($cat -eq 'sports' -or $sub -eq 'equipment') { return 'sports' }
  if ($cat -eq 'fashion') { return 'fashion' }
  return 'laptop'
}

function Get-StableSeed([string]$s) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($s)
  $hash = [Security.Cryptography.SHA1]::Create().ComputeHash($bytes)
  return [BitConverter]::ToUInt32($hash, 0)
}

$data = Get-Content $ProductsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$ok = 0
foreach ($p in $data.products) {
  $key = Resolve-Pool $p
  $arr = @($poolMap[$key])
  if ($arr.Count -lt 1) {
    $key = 'laptop'
    $arr = @($poolMap['laptop'])
  }
  if ($arr.Count -lt 1) { throw ("No images for " + $p.id + " / " + $key) }
  $seedKey = $p.id + "|" + $p.name + "|" + $key
  $seed = Get-StableSeed $seedKey
  $url = $arr[$seed % $arr.Count]
  if (-not $url -or $url -notmatch '^https?://') { throw ("Bad url for " + $p.id) }
  $g = if ($p.gradient) { [string]$p.gradient } else { "linear-gradient(135deg,#111,#333)" }
  $p.image = $url
  $p.images = @(
    [ordered]@{ src = $url; alt = [string]$p.name; gradient = $g },
    [ordered]@{ src = $url; alt = ($p.name + " 2"); gradient = $g },
    [ordered]@{ src = $url; alt = ($p.name + " 3"); gradient = $g }
  )
  $ok++
}

$data.version = 10
$manat = [char]0x20BC
$json = $data | ConvertTo-Json -Depth 12
$json = [regex]::Replace($json, '"currency"\s*:\s*"[^"]*"', ("`"currency`": `"" + $manat + "`""))
[IO.File]::WriteAllText($ProductsPath, $json, [Text.UTF8Encoding]::new($false))

Write-Host ("Assigned " + $ok + " remote images (version 10)")
$names = @(
  'Samsung Galaxy S24 Ultra',
  'Apple iPhone 15 Pro',
  'Google Pixel 8 Pro',
  'Xiaomi Redmi Note 13 Pro',
  'Sony Xperia 1 VI',
  'Huawei Nova 12 Pro',
  'Nike Air Runner'
)
foreach ($n in $names) {
  $p = $data.products | Where-Object { $_.name -like ($n + "*") } | Select-Object -First 1
  if ($p) { Write-Host ($p.name); Write-Host ("  " + $p.image) }
}
