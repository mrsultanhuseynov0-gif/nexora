# Download curated web product photos and assign strictly by brand/category pool
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"
$PoolsPath = Join-Path $Root "data\image-pools.json"
$PhotoDir = Join-Path $Root "assets\products\real"
New-Item -ItemType Directory -Force -Path $PhotoDir | Out-Null

# Wipe previous real photos so stale cross-brand files are not reused
Get-ChildItem $PhotoDir -File -ErrorAction SilentlyContinue | Remove-Item -Force

$headers = @{
  "User-Agent" = "NEXORALocalCatalog/1.0 (product image fetcher; educational demo)"
  "Accept"     = "image/*,*/*"
}

# PowerShell vars are case-insensitive — do not use $pools / $Pools together
$rawPools = Get-Content $PoolsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$poolMap = @{}
foreach ($prop in $rawPools.PSObject.Properties) {
  $clean = @($prop.Value | Where-Object {
    $_ -and
    $_ -match '^https?://' -and
    $_ -notmatch '\.pdf' -and
    $_ -notmatch 'page1-' -and
    $_ -notmatch '\.svg(\?|$)'
  })
  $poolMap[$prop.Name] = $clean
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

function Get-Ext([string]$url) {
  if ($url -match '\.png') { return '.png' }
  if ($url -match '\.webp') { return '.webp' }
  return '.jpg'
}

function Get-StableSeed([string]$s) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($s)
  $hash = [Security.Cryptography.SHA1]::Create().ComputeHash($bytes)
  return [BitConverter]::ToUInt32($hash, 0)
}

$data = Get-Content $ProductsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$needed = New-Object 'System.Collections.Generic.HashSet[string]'
$assign = @{}
$poolHits = @{}

foreach ($p in $data.products) {
  $key = Resolve-Pool $p
  $pool = $poolMap[$key]
  if (-not $pool -or $pool.Count -eq 0) {
    $key = 'laptop'
    $pool = $poolMap['laptop']
  }
  $seed = Get-StableSeed ("$($p.id)|$($p.name)|$key")
  $url = $pool[$seed % $pool.Count]
  $assign[$p.id] = @{ url = $url; key = $key }
  [void]$needed.Add($url)
  if (-not $poolHits.ContainsKey($key)) { $poolHits[$key] = 0 }
  $poolHits[$key]++
}

Write-Host "Unique URLs to download: $($needed.Count)"
$poolHits.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host ("  {0,-16} {1}" -f $_.Key, $_.Value) }

$urlToLocal = @{}
$i = 0
foreach ($url in ($needed | Sort-Object)) {
  $i++
  $hash = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($url))).Replace('-','').Substring(0,16).ToLowerInvariant()
  $ext = Get-Ext $url
  $fileName = "$hash$ext"
  $full = Join-Path $PhotoDir $fileName
  $rel = "assets/products/real/$fileName"
  try {
    Invoke-WebRequest -Uri $url -OutFile $full -UseBasicParsing -TimeoutSec 45 -Headers $headers
    $len = (Get-Item $full).Length
    if ($len -lt 5000) { Remove-Item $full -Force; throw "too small $len" }
    # Reject PDF magic / HTML error pages
    $fs = [IO.File]::OpenRead($full)
    $buf = New-Object byte[] 8
    [void]$fs.Read($buf, 0, 8)
    $fs.Close()
    $sig = [Text.Encoding]::ASCII.GetString($buf)
    if ($sig.StartsWith('%PDF') -or $sig.StartsWith('<!DOC') -or $sig.StartsWith('<html')) {
      Remove-Item $full -Force
      throw "not an image ($sig)"
    }
    Write-Host "[$i/$($needed.Count)] OK $fileName ($len)"
    $urlToLocal[$url] = $rel
  } catch {
    Write-Host "[$i/$($needed.Count)] FAIL $($_.Exception.Message) :: $url"
  }
  Start-Sleep -Milliseconds 150
}

$updated = 0
$miss = 0
$byPoolOk = @{}
foreach ($p in $data.products) {
  $url = $assign[$p.id].url
  $key = $assign[$p.id].key
  $local = $null
  if ($urlToLocal.ContainsKey($url)) { $local = $urlToLocal[$url] }
  if (-not $local) {
    foreach ($u in $poolMap[$key]) {
      if ($urlToLocal.ContainsKey($u)) { $local = $urlToLocal[$u]; break }
    }
  }
  if (-not $local) {
    $local = "assets/products/$($p.id).svg"
    $miss++
  } else {
    if (-not $byPoolOk.ContainsKey($key)) { $byPoolOk[$key] = 0 }
    $byPoolOk[$key]++
  }
  $g = if ($p.gradient) { [string]$p.gradient } else { "linear-gradient(135deg,#111,#333)" }
  $p.image = $local
  $p.images = @(
    [ordered]@{ src = $local; alt = [string]$p.name; gradient = $g },
    [ordered]@{ src = $local; alt = "$($p.name) 2"; gradient = $g },
    [ordered]@{ src = $local; alt = "$($p.name) 3"; gradient = $g }
  )
  $updated++
}

$data.version = 9
$manat = [char]0x20BC
$json = $data | ConvertTo-Json -Depth 12
$json = [regex]::Replace($json, '"currency"\s*:\s*"[^"]*"', "`"currency`": `"$manat`"")
$json = $json.Replace("L'Or" + [char]0x00C3 + [char]0x00A9 + "al", "L'Oreal")
[IO.File]::WriteAllText($ProductsPath, $json, [Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Updated $updated products (version 9). SVG fallbacks: $miss"
Write-Host "Photo files: $((Get-ChildItem $PhotoDir -File).Count)"
Write-Host "OK by pool:"
$byPoolOk.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host ("  {0,-16} {1}" -f $_.Key, $_.Value) }

@('Samsung Galaxy S24 Ultra','Apple iPhone 15 Pro','Google Pixel 8 Pro','Xiaomi Redmi Note 13 Pro','Sony Xperia 1 VI','Nike Air Runner') | ForEach-Object {
  $n = $_
  $p = $data.products | Where-Object { $_.name -like "$n*" } | Select-Object -First 1
  if ($p) { "{0,-40} {1}" -f $p.name, $p.image }
}
