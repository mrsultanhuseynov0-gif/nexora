# Remap every product image to match subcategory / product name (Unsplash)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"

function U([string]$id) {
  "https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&h=1200&q=80"
}

# Only IDs previously used in NEXORA catalog (known-good Unsplash photos)
$Pools = @{
  smartphones = @(
    "1511707171634-5f897ff02aa9","1592899677977-9c10ca588bbd","1580910051074-3eb694886505",
    "1556656793-08538906a9f8","1610945415295-d9bbf067e59c","1601784551446-20c9e07cdbdb",
    "1565849904461-04a58ad377e0","1596461404969-9ae70f2830c1"
  )
  laptops = @(
    "1496181133206-80ce9b88a853","1517336714731-489689fd1ca8","1498050108023-c5249f4df085",
    "1525547719571-a2d4ac8945e2","1484788984921-03950022c9ef",
    "1593642632823-8f785ba67e45"
  )
  audio = @(
    "1505740420928-5e560c06d30e",
    "1487215078519-e21cc028cb29","1545127398-14699f92334b"
  )
  tv = @(
    "1593784991095-a205069470b6","1593305841991-05c297ba4575",
    "1571415060716-baff5f717c37")
  gaming = @(
    "1542751371-adc38448a05e","1538481199705-c710c4e965fc","1552820728-8b83bb6b773f",
    "1606144042614-b2417e99c4e3"
  )
  cameras = @(
    "1502920917128-1aa500764cbd","1526170375885-4d8ecf77b99f",
    "1516035069371-29a1b244cc32")
  wearables = @(
    "1523275335684-37898b6baf30","1546868871-7041f2a55e12","1579586337278-3befd40fd17a",
    "1434389677669-e08b4cac3105"
  )
  shoes = @(
    "1542291026-7eec264c27ff","1549062572-544a64fb0c56")
  apparel = @(
    "1523381210434-271e8be1f52b","1483985988355-763728e1935b","1515886657613-9f3515b0c78f",
    "1445205170230-053b83016050","1490481651871-ab68de25d43d"
  )
  bags = @(
    "1553062407-98eeb64c6a62","1571781926291-c477ebfd024b","1558064472-e5c9e0e0e0e0"
  )
  appliances = @(
    "1556911220-bff31c812dba","1586023492125-27b2c045efd7","1484154218962-a197022b5858",
    "1555041469-a586c61ea9bc"
  )
  decor = @(
    "1586023492125-27b2c045efd7","1555041469-a586c61ea9bc","1493663284031-b7e3aefcae8e",
    "1616046229478-9901c5536a45","1560184897-ae75f418493e","1484154218962-a197022b5858"
  )
  sports = @(
    "1517836357463-d25dfeac3438","1571019614242-c5c5dee9f50b","1534438327276-14e5300c3a48",
    "1541534741688-6078c6bfb5c5"
  )
  toys = @(
    "1503454537195-1dcabb73ffb9","1515488042361-ee00e0ddd4e4","1566576912321-d58ddd7a6088"
  )
  beauty = @(
    "1596462502278-27bfdc403348","1522335789203-aabd1fc54bc9","1512496015851-a90fb38ba796")
  auto = @(
    "1492144534655-ae79c964c9d7","1503376780353-7e6692767b70","1549317661-bd32c8ce0db2",
    "1494976388531-d1058494cdd8")
  books = @(
    "1512820790803-83ca734da794","1544947950-fa07a98d237f",
    "1519682337058-a94d519337bc")
}

# Fix bags pool — remove bad id
$Pools.bags = @("1553062407-98eeb64c6a62","1571781926291-c477ebfd024b","1553062407-98eeb64c6a62")

function Resolve-PoolKey([string]$sub, [string]$name) {
  $n = $name.ToLowerInvariant()

  if ($n -match 'headphone|earbuds|buds|soundbar|speaker|neckband|airpods|boombox|headset|partybox') { return 'audio' }
  if ($n -match 'iphone|galaxy [samz0-9]|galaxy a|galaxy m|galaxy z|pixel|redmi|poco|xperia|nova |smartphone|foldable|(?<![a-z])phone(?![a-z])') { return 'smartphones' }
  if ($n -match 'macbook|laptop|notebook|ultrabook|zenbook|thinkpad|ideapad|vivobook|xps |inspiron|legion|pavilion|envy|victus|latitude|galaxy book|stealth gaming|workstation') { return 'laptops' }
  # audio already handled above
  if ($n -match '\btv\b|monitor|oled|qled|ultrawide|mini led') { return 'tv' }
  if ($n -match 'controller|keyboard|gaming mouse|vr headset|capture card|racing wheel|stream mic') { return 'gaming' }
  if ($n -match 'camera|mirrorless|drone|gimbal|action cam|lens |vlog') { return 'cameras' }
  if ($n -match 'watch|fitness band|sport gps') { return 'wearables' }
  if ($n -match 'shoe|sneaker|boot|sandal|runner|ultraboost|loafer|trainer|football boot|trail run|marathon') { return 'shoes' }
  if ($n -match 'hoodie|jeans|shirt|coat|jacket|tee|pants|sweater|blazer|polo|tights|leggings|shorts|vest|chino|denim') { return 'apparel' }
  if ($n -match 'bag|backpack|belt|sunglasses|scarf|cap|tote|strap') { return 'bags' }
  if ($n -match 'vacuum|blender|kettle|iron|fryer|microwave|washer|dishwasher|espresso|purifier|thermostat|smart bulb|smart plug|smart lock|door camera|robot mop|air fryer') { return 'appliances' }
  if ($n -match 'lamp|blanket|vase|clock|diffuser|candle|organizer|basket|frame|rug ') { return 'decor' }
  if ($n -match 'yoga|dumbbell|resistance|jump rope|foam|boxing|racket|football|helmet|hiking|bottle|duffel|mat premium') { return 'sports' }
  if ($n -match 'lego|plush|toy|puzzle|robot|scooter|doll|blocks|play kitchen|train|bubble|board game|art set|magic|night light') { return 'toys' }
  if ($n -match 'serum|cream|spf|mascara|lipstick|makeup|lotion|toner|cleans|mask|balm|foundation|nail|brush kit|bb cream|lip tint') { return 'beauty' }
  if ($n -match 'dash cam|jump starter|car charger|obd|parking|headlight|inflator|seat cover|steering|sunshade|phone mount|floor mat|trunk|cup holder|emergency kit|car vacuum') { return 'auto' }
  if ($n -match 'book|novel|poetry|anthology|planner|sketchbook|classic reprint|short stories|drama|adventure|photography master|cooking|guitar|diy |coloring|travel notebook') { return 'books' }

  switch ($sub) {
    'smartphones' { return 'smartphones' }
    'laptops' { return 'laptops' }
    'audio' { return 'audio' }
    'tv' { return 'tv' }
    'gaming' { return 'gaming' }
    'cameras' { return 'cameras' }
    'wearables' { return 'wearables' }
    'shoes' { return 'shoes' }
    'apparel' { return 'apparel' }
    'accessories' {
      if ($sub -and $name -match '(?i)car|dash|tire|mount|seat|floor|steering|sunshade|trunk|emergency') { return 'auto' }
      # fashion accessories vs auto accessories — use category via caller context later
      return 'bags'
    }
    'appliances' { return 'appliances' }
    'smart-home' { return 'appliances' }
    'decor' { return 'decor' }
    'equipment' { return 'sports' }
    'toys' { return 'toys' }
    'skincare' { return 'beauty' }
    'makeup' { return 'beauty' }
    'electronics' { return 'auto' }
    'fiction' { return 'books' }
    'hobby' { return 'books' }
    default { return 'smartphones' }
  }
}

function Resolve-PoolKeyFull($p) {
  $key = Resolve-PoolKey $p.subcategory $p.name
  if ($p.category -eq 'auto') { return 'auto' }
  if ($p.category -eq 'books') { return 'books' }
  if ($p.category -eq 'beauty') { return 'beauty' }
  if ($p.category -eq 'kids' -and $p.subcategory -eq 'toys') { return 'toys' }
  if ($p.category -eq 'sports' -and $p.subcategory -eq 'equipment') { return 'sports' }
  if ($p.category -eq 'sports' -and $p.subcategory -eq 'shoes') { return 'shoes' }
  if ($p.category -eq 'sports' -and $p.subcategory -eq 'apparel') { return 'apparel' }
  if ($p.category -eq 'fashion' -and $p.subcategory -eq 'accessories') { return 'bags' }
  if ($p.category -eq 'home' -and $p.subcategory -eq 'decor') { return 'decor' }
  return $key
}

function Pick-Three([string]$key, [int]$seed) {
  $pool = $Pools[$key]
  if (-not $pool -or $pool.Count -eq 0) { $pool = $Pools['smartphones'] }
  $n = $pool.Count
  $a = $pool[$seed % $n]
  $b = $pool[($seed + 1) % $n]
  $c = $pool[($seed + 2) % $n]
  return ,@((U $a), (U $b), (U $c))
}

$data = [IO.File]::ReadAllText($ProductsPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$byPool = @{}
$i = 0
foreach ($p in $data.products) {
  $key = Resolve-PoolKeyFull $p
  if (-not $byPool.ContainsKey($key)) { $byPool[$key] = 0 }
  $byPool[$key]++
  $seed = [Math]::Abs(("$($p.id)|$($p.name)").GetHashCode())
  $imgs = Pick-Three $key $seed
  $g = if ($p.gradient) { [string]$p.gradient } else { "linear-gradient(135deg,#111,#333)" }
  $p.image = $imgs[0]
  $p.images = @(
    [ordered]@{ src = $imgs[0]; alt = [string]$p.name; gradient = $g },
    [ordered]@{ src = $imgs[1]; alt = "$($p.name) 2"; gradient = $g },
    [ordered]@{ src = $imgs[2]; alt = "$($p.name) 3"; gradient = $g }
  )
  $i++
}

$data.version = 5
$json = $data | ConvertTo-Json -Depth 12
$json = $json -replace '"currency"\s*:\s*"[^"]*"', ('"currency":  "' + [char]0x20BC + '"')
$utf8 = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($ProductsPath, $json, $utf8)

Write-Host "Updated $i products → version $($data.version)"
$byPool.GetEnumerator() | Sort-Object Name | ForEach-Object { "{0,-14} {1}" -f $_.Key, $_.Value }

Write-Host "`nSamples:"
@(
  ($data.products | Where-Object { $_.name -match 'Galaxy S24 Ultra$' } | Select-Object -First 1),
  ($data.products | Where-Object { $_.name -match 'MacBook Pro 14$' } | Select-Object -First 1),
  ($data.products | Where-Object { $_.name -match 'Yoga Mat' } | Select-Object -First 1),
  ($data.products | Where-Object { $_.name -match 'Plush Bear' } | Select-Object -First 1),
  ($data.products | Where-Object { $_.name -match 'Vitamin C Serum' } | Select-Object -First 1),
  ($data.products | Where-Object { $_.name -match 'Dash Cam' } | Select-Object -First 1)
) | ForEach-Object {
  if ($_) {
    $pool = Resolve-PoolKeyFull $_
    "{0,-40} [{1}] {2}" -f $_.name, $pool, $_.image.Substring(0, [Math]::Min(72, $_.image.Length))
  }
}
