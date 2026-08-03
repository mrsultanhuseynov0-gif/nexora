# Rebuild NEXORA catalog with guaranteed images + large stock
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"
$CategoriesPath = Join-Path $Root "data\categories.json"

$rng = [System.Random]::new(77)

# Image pools matched to product type (see also scripts/fix_product_images.ps1)
$IMG_POOLS = @{
  smartphones = @("1511707171634-5f897ff02aa9","1592899677977-9c10ca588bbd","1580910051074-3eb694886505","1556656793-08538906a9f8","1610945415295-d9bbf067e59c","1601784551446-20c9e07cdbdb","1565849904461-04a58ad377e0","1596461404969-9ae70f2830c1")
  laptops = @("1496181133206-80ce9b88a853","1517336714731-489689fd1ca8","1498050108023-c5249f4df085","1525547719571-a2d4ac8945e2","1484788984921-03950022c9ef","1593642632823-8f785ba67e45")
  audio = @("1505740420928-5e560c06d30e","1487215078519-e21cc028cb29","1545127398-14699f92334b")
  tv = @("1593784991095-a205069470b6","1593305841991-05c297ba4575","1571415060716-baff5f717c37")
  gaming = @("1542751371-adc38448a05e","1538481199705-c710c4e965fc","1552820728-8b83bb6b773f","1606144042614-b2417e99c4e3")
  cameras = @("1502920917128-1aa500764cbd","1526170375885-4d8ecf77b99f","1516035069371-29a1b244cc32")
  wearables = @("1523275335684-37898b6baf30","1546868871-7041f2a55e12","1579586337278-3befd40fd17a","1434389677669-e08b4cac3105")
  shoes = @("1542291026-7eec264c27ff","1549062572-544a64fb0c56")
  apparel = @("1523381210434-271e8be1f52b","1483985988355-763728e1935b","1515886657613-9f3515b0c78f","1445205170230-053b83016050","1490481651871-ab68de25d43d")
  bags = @("1553062407-98eeb64c6a62","1571781926291-c477ebfd024b")
  appliances = @("1556911220-bff31c812dba","1586023492125-27b2c045efd7","1484154218962-a197022b5858","1555041469-a586c61ea9bc")
  decor = @("1586023492125-27b2c045efd7","1555041469-a586c61ea9bc","1493663284031-b7e3aefcae8e","1616046229478-9901c5536a45","1560184897-ae75f418493e")
  sports = @("1517836357463-d25dfeac3438","1571019614242-c5c5dee9f50b","1534438327276-14e5300c3a48","1541534741688-6078c6bfb5c5")
  toys = @("1503454537195-1dcabb73ffb9","1515488042361-ee00e0ddd4e4","1566576912321-d58ddd7a6088")
  beauty = @("1596462502278-27bfdc403348","1522335789203-aabd1fc54bc9","1512496015851-a90fb38ba796")
  auto = @("1492144534655-ae79c964c9d7","1503376780353-7e6692767b70","1549317661-bd32c8ce0db2","1494976388531-d1058494cdd8")
  books = @("1512820790803-83ca734da794","1544947950-fa07a98d237f","1519682337058-a94d519337bc")
}

function U([string]$photoId) {
  "https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1200&h=1200&q=80"
}

function Pool-Key([string]$cat, [string]$sub) {
  if ($cat -eq 'auto') { return 'auto' }
  if ($cat -eq 'books') { return 'books' }
  if ($cat -eq 'beauty') { return 'beauty' }
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
    'accessories' { return $(if ($cat -eq 'fashion') { 'bags' } else { 'auto' }) }
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

function Pick-Imgs([int]$i, [string]$cat, [string]$sub) {
  $key = Pool-Key $cat $sub
  $pool = $IMG_POOLS[$key]
  if (-not $pool) { $pool = $IMG_POOLS['smartphones'] }
  $n = $pool.Count
  $a = $pool[$i % $n]
  $b = $pool[($i + 1) % $n]
  $c = $pool[($i + 2) % $n]
  ,@((U $a), (U $b), (U $c))
}

$GRAD = @{
  electronics = "linear-gradient(135deg,#111,#333)"
  fashion = "linear-gradient(135deg,#330000,#FF0000)"
  home = "linear-gradient(135deg,#1a472a,#2e7d32)"
  sports = "linear-gradient(135deg,#0d47a1,#1565c0)"
  kids = "linear-gradient(135deg,#e65100,#ff9800)"
  beauty = "linear-gradient(135deg,#4a148c,#7b1fa2)"
  auto = "linear-gradient(135deg,#212121,#424242)"
  books = "linear-gradient(135deg,#3e2723,#5d4037)"
}

$Catalog = @(
  @{ cat="electronics"; sub="smartphones"; brands=@(@("Samsung","samsung"),@("Apple","apple"),@("Xiaomi","xiaomi"),@("Sony","sony"),@("Huawei","huawei"),@("Google","google"));
    names=@("Galaxy S24 Ultra","Galaxy S24","Galaxy A55","Galaxy A35","Galaxy Z Flip","iPhone 15 Pro Max","iPhone 15 Pro","iPhone 15","iPhone 14","iPhone SE style","Redmi Note 13 Pro","POCO X6","Xiaomi 14","Nova 12 Pro","Xperia 1 VI","Pixel 8 Pro","Pixel 8","Camera King Phone","Battery Max Phone","Gaming Phone Turbo","Business Phone Elite","Compact Flagship","AI Phone Studio","Note Stylus Phone","Foldable Slim","Youth 5G Phone","Ultra Cam Phone","Dual SIM Pro","Lite Edition Phone","Power Phone 6000","Slim Metal Phone","Creator Phone 5G","Rugged Phone X") },
  @{ cat="electronics"; sub="laptops"; brands=@(@("Apple","apple"),@("Asus","asus"),@("Lenovo","lenovo"),@("HP","hp"),@("Dell","dell"),@("Samsung","samsung"),@("MSI","msi"));
    names=@("MacBook Pro 14","MacBook Air 13","MacBook Pro 16","ZenBook OLED","VivoBook 15","ThinkPad X1","IdeaPad Slim","Legion Gaming","Pavilion Plus","Envy x360","XPS 13","Inspiron 15","Galaxy Book4","Stealth Gaming Laptop","Creator Laptop 16","Student Notebook","Business Ultrabook","2-in-1 Convertible","Workstation Pro","Travel Laptop 1kg","Esports 165Hz Laptop","Silent Office Laptop","Touch Laptop 15","AMD Advantage Laptop","Evo Certified Laptop","Budget Laptop 8GB","Max RAM 32GB Laptop","Color Accurate Laptop","All-day Battery Laptop","OLED Creator Laptop") },
  @{ cat="electronics"; sub="audio"; brands=@(@("Sony","sony"),@("JBL","jbl"),@("Apple","apple"),@("Samsung","samsung"),@("Xiaomi","xiaomi"));
    names=@("WH-1000XM Headphones","WF Earbuds Pro","Flip Speaker","Charge Boombox","AirPods-style Pro","Galaxy Buds","Neckband Sport","Soundbar 2.1","Studio Monitor HP","Kids Safe Headphones","Open-ear Buds","Partybox Mini") },
  @{ cat="electronics"; sub="tv"; brands=@(@("Samsung","samsung"),@("LG","lg"),@("Sony","sony"),@("Xiaomi","xiaomi"));
    names=@("4K Smart TV 43","4K Smart TV 55","OLED TV 65","QLED TV 50","Gaming Monitor 27","Ultrawide 34 Monitor","Office Monitor 24","Portable Monitor 15","Mini LED TV 48") },
  @{ cat="electronics"; sub="gaming"; brands=@(@("Logitech","logitech"),@("Asus","asus"),@("Sony","sony"),@("Razer","razer"));
    names=@("Wireless Controller","Mechanical Keyboard RGB","Gaming Mouse Ultra","VR Headset Lite","Capture Card 4K","Racing Wheel","Gaming Headset","Stream Mic Kit") },
  @{ cat="electronics"; sub="cameras"; brands=@(@("Sony","sony"),@("Canon","canon"),@("GoPro","gopro"),@("DJI","dji"));
    names=@("Mirrorless Kit","Action Cam 4K","Vlog Compact","Drone Mini","Lens 50mm","Gimbal Phone") },
  @{ cat="electronics"; sub="wearables"; brands=@(@("Apple","apple"),@("Samsung","samsung"),@("Xiaomi","xiaomi"),@("Garmin","garmin"));
    names=@("Watch Ultra","Watch Series","Galaxy Watch","Fitness Band","Kids Watch GPS","Sport GPS Watch") },
  @{ cat="fashion"; sub="shoes"; brands=@(@("Nike","nike"),@("Adidas","adidas"),@("Puma","puma"),@("New Balance","newbalance"));
    names=@("Air Runner","Ultraboost Style","Classic Leather","Trail Boot","City Loafer","High-top Sneaker","Chelsea Boot","Summer Sandal","Retro Trainer","Walking Comfort") },
  @{ cat="fashion"; sub="apparel"; brands=@(@("Zara","zara"),@("H&M","hm"),@("Levi's","levis"),@("Nike","nike"),@("Adidas","adidas"));
    names=@("Oversized Hoodie","Slim Jeans","Linen Shirt","Wool Coat","Denim Jacket","Cotton Tee Pack","Chino Pants","Quilted Vest","Knit Sweater","Rain Jacket","Polo Shirt","Cargo Pants","Track Pants","Blazer Smart") },
  @{ cat="fashion"; sub="accessories"; brands=@(@("Casio","casio"),@("Nike","nike"),@("Zara","zara"));
    names=@("Leather Belt","Crossbody Bag","Aviator Sunglasses","Travel Backpack","Silk Scarf","Minimal Cap","Canvas Tote","Watch Strap") },
  @{ cat="home"; sub="appliances"; brands=@(@("Philips","philips"),@("Bosch","bosch"),@("Dyson","dyson"),@("Tefal","tefal"),@("Samsung","samsung"));
    names=@("Robot Vacuum","Air Purifier","Espresso Machine","Blender Pro","Electric Kettle","Steam Iron","Air Fryer XL","Microwave Grill","Dishwasher Compact","Washer 8kg") },
  @{ cat="home"; sub="smart-home"; brands=@(@("Xiaomi","xiaomi"),@("Philips","philips"),@("Samsung","samsung"));
    names=@("Smart Thermostat","Smart Bulb Kit","Smart Plug","Door Camera","Robot Mop","Smart Lock") },
  @{ cat="home"; sub="decor"; brands=@(@("IKEA","ikea"),@("NEXORA Home","nexorahome"));
    names=@("LED Floor Lamp","Throw Blanket","Ceramic Vase","Wall Clock","Scent Diffuser","Candle Set","Desk Organizer","Storage Basket","Photo Frame Set","Rug Soft") },
  @{ cat="sports"; sub="shoes"; brands=@(@("Nike","nike"),@("Adidas","adidas"),@("Puma","puma"),@("Reebok","reebok"));
    names=@("Running Shoes Light","Trail Run Shoe","Training Shoe","Basketball Shoe","Football Boot","Walking Shoe","Indoor Court Shoe","Marathon Racer") },
  @{ cat="sports"; sub="equipment"; brands=@(@("Decathlon","decathlon"),@("Nike","nike"),@("Adidas","adidas"));
    names=@("Yoga Mat Premium","Dumbbell Set","Resistance Bands","Jump Rope","Foam Roller","Boxing Gloves","Tennis Racket","Football Size 5","Cycling Helmet","Hiking Pack 30L","Water Bottle","Gym Duffel") },
  @{ cat="sports"; sub="apparel"; brands=@(@("Nike","nike"),@("Adidas","adidas"),@("Under Armour","underarmour"));
    names=@("Compression Tights","Training Tee","Sport Jacket","Gym Shorts","Yoga Leggings","Run Cap") },
  @{ cat="kids"; sub="toys"; brands=@(@("Lego","lego"),@("Mattel","mattel"),@("Hasbro","hasbro"),@("NEXORA Kids","nexorakids"));
    names=@("Building Blocks 500","RC Car Turbo","Plush Bear","STEM Robot","Puzzle Map","Play Kitchen","Wooden Train","Bubble Machine","Board Game","Art Set 64","Kids Scooter","Night Light","Doll House Mini","Magic Kit") },
  @{ cat="kids"; sub="apparel"; brands=@(@("NEXORA Kids","nexorakids"),@("Nike","nike"));
    names=@("Kids Sneakers","Rain Jacket Kids","School Backpack","Kids Cap","Kids Hoodie") },
  @{ cat="beauty"; sub="skincare"; brands=@(@("L'Oreal","loreal"),@("Nivea","nivea"),@("The Ordinary","theordinary"),@("NEXORA Beauty","nexorabeauty"));
    names=@("Vitamin C Serum","Hydra Cream","SPF 50","Cleansing Foam","Eye Cream","Face Mask Pack","Toner","Night Cream","Lip Balm Set","Body Lotion") },
  @{ cat="beauty"; sub="makeup"; brands=@(@("Maybelline","maybelline"),@("L'Oreal","loreal"));
    names=@("Lip Tint","Mascara Volume","BB Cream","Nail Set","Brush Kit","Foundation Matte") },
  @{ cat="auto"; sub="electronics"; brands=@(@("Baseus","baseus"),@("Philips","philips"),@("Bosch","bosch"),@("NEXORA Auto","nexoraauto"));
    names=@("Dash Cam HD","Jump Starter","Car Charger Wireless","OBD2 Scanner","Parking Sensors","LED Headlight","Tire Inflator","Car Vacuum") },
  @{ cat="auto"; sub="accessories"; brands=@(@("NEXORA Auto","nexoraauto"),@("Michelin","michelin"));
    names=@("Phone Mount","Seat Covers","Trunk Organizer","Floor Mats","Steering Cover","Sunshade","Cup Holder","Emergency Kit") },
  @{ cat="books"; sub="fiction"; brands=@(@("Penguin","penguin"),@("Local Press","localpress"),@("NEXORA Books","nexorabooks"));
    names=@("Sci-Fi Anthology","Modern Novel","Mystery Thriller","Poetry Book","Short Stories","Classic Reprint","Drama Collection","Adventure Tale") },
  @{ cat="books"; sub="hobby"; brands=@(@("Art House","arthouse"),@("NEXORA Books","nexorabooks"));
    names=@("Photography Master","Cooking Classics","Guitar Beginner","DIY Home","Sketchbook Pro","Travel Notebook","Planner 2026","Coloring Book") }
)

function Price-For($cat, $sub) {
  if ($sub -eq "smartphones") { return @(349,449,549,699,899,1199,1499,1899,2199,2599)[$rng.Next(0,10)] }
  if ($sub -eq "laptops") { return @(999,1299,1599,1899,2299,2799,3299,3799,4299)[$rng.Next(0,9)] }
  if ($cat -eq "electronics") { return @(49,79,99,149,199,299,399,599,799)[$rng.Next(0,9)] }
  return @(19,29,39,49,69,89,119,149,199,249,299)[$rng.Next(0,11)]
}

function Make-Product([int]$idx, $cat, $sub, $name, $brand, $brandId) {
  $imgs = Pick-Imgs $idx $cat $sub
  $price = Price-For $cat $sub
  $old = $null
  if ($rng.NextDouble() -lt 0.42) { $old = $price + @(30,50,80,120,200)[$rng.Next(0,5)] }
  $isNew = $rng.NextDouble() -lt 0.34
  $badge = $null
  $badgeType = "dark"
  if ($isNew) { $badge = "Yeni"; $badgeType = "primary" }
  elseif ($old) {
    $pct = [int](($old - $price) / $old * 100)
    $badge = "-$pct%"
    $badgeType = "sale"
  } elseif ($rng.NextDouble() -lt 0.1) { $badge = "Hit" }
  $g = $GRAD[$cat]
  $full = "$brand $name"
  $users = @("Elvin M.","Aysel R.","Nigar K.","Reshad T.","Leyla S.")
  [ordered]@{
    id = ("p{0:D4}" -f $idx)
    sku = ("{0}-{1}-{2:D4}" -f $brandId.Substring(0,[Math]::Min(3,$brandId.Length)).ToUpper(), $sub.Substring(0,[Math]::Min(3,$sub.Length)).ToUpper(), $idx)
    name = $full
    brand = $brand
    brandId = $brandId
    category = $cat
    subcategory = $sub
    price = $price
    oldPrice = $old
    currency = "₼"
    rating = [Math]::Round(4.0 + $rng.NextDouble(), 1)
    reviews = $rng.Next(8,421)
    badge = $badge
    badgeType = $badgeType
    inStock = $true
    stock = $rng.Next(5,161)
    isNew = $isNew
    tags = @($cat, $sub, $brandId, "nexora")
    description = "$full - NEXORA keyfiyyet ve suretli chatdirilma."
    specs = @{ Brend = $brand; Kateqoriya = $cat; Zemanet = "12 ay"; Chatdirilma = "1-3 gun" }
    images = @(
      @{ src = $imgs[0]; alt = $full; gradient = $g },
      @{ src = $imgs[1]; alt = "$full 2"; gradient = $g },
      @{ src = $imgs[2]; alt = "$full 3"; gradient = $g }
    )
    gradient = $g
    reviewList = @(@{
      user = $users[$rng.Next(0,$users.Count)]
      rating = $rng.Next(4,6)
      date = ("2026-{0:D2}-{1:D2}" -f $rng.Next(1,8), $rng.Next(1,29))
      text = "Sekiller real mehsula uygundur, keyfiyyet yaxshidir."
    })
    image = $imgs[0]
  }
}

function Resolve-Brand($name, $brands) {
  $n = $name.ToLowerInvariant()
  $want = $null
  if ($n -match 'iphone|macbook|airpods|watch series|watch ultra') { $want = 'apple' }
  elseif ($n -match 'galaxy|qled') { $want = 'samsung' }
  elseif ($n -match 'redmi|poco|xiaomi') { $want = 'xiaomi' }
  elseif ($n -match 'pixel') { $want = 'google' }
  elseif ($n -match 'xperia|wh-1000|wf earbuds') { $want = 'sony' }
  elseif ($n -match 'nova') { $want = 'huawei' }
  elseif ($n -match 'zenbook|vivobook') { $want = 'asus' }
  elseif ($n -match 'thinkpad|ideapad|legion') { $want = 'lenovo' }
  elseif ($n -match 'pavilion|envy') { $want = 'hp' }
  elseif ($n -match 'xps|inspiron') { $want = 'dell' }
  elseif ($n -match 'ultraboost|adidas') { $want = 'adidas' }
  elseif ($n -match 'air runner|nike') { $want = 'nike' }
  if ($want) {
    foreach ($b in $brands) {
      if ($b[1] -eq $want) { return $b }
    }
  }
  return $brands[0]
}

$products = [System.Collections.Generic.List[object]]::new()
$idx = 1
$variants = @("Plus","Pro","Edition","Lite")

foreach ($block in $Catalog) {
  $n_i = 0
  foreach ($name in $block.names) {
    $b = Resolve-Brand $name $block.brands
    # Base model
    $products.Add((Make-Product $idx $block.cat $block.sub $name $b[0] $b[1])) | Out-Null
    $idx++
    # Color/storage variant — never append Max if name already has Max/Pro/Ultra
    $suffix = $variants[$n_i % $variants.Count]
    if ($name -match '(Max|Pro|Ultra|Plus|Edition|Lite)\s*$') {
      $vname = "$name $((@('Black','Silver','Blue','Graphite'))[$n_i % 4])"
    } else {
      $vname = "$name $suffix"
    }
    $products.Add((Make-Product $idx $block.cat $block.sub $vname $b[0] $b[1])) | Out-Null
    $idx++
    $n_i++
  }
}

$phoneLines = @(
  @("Samsung","samsung","Galaxy A25"),
  @("Samsung","samsung","Galaxy M35"),
  @("Apple","apple","iPhone 13"),
  @("Apple","apple","iPhone 12"),
  @("Xiaomi","xiaomi","Redmi 13C"),
  @("Xiaomi","xiaomi","POCO M6"),
  @("Google","google","Pixel 7a"),
  @("Huawei","huawei","nova 11i"),
  @("Sony","sony","Xperia 10 VI")
)
$laptopLines = @(
  @("Apple","apple","MacBook Air M2"),
  @("Asus","asus","TUF Gaming F15"),
  @("Lenovo","lenovo","Yoga Slim 7"),
  @("HP","hp","Victus 15"),
  @("Dell","dell","Latitude 5440"),
  @("Samsung","samsung","Galaxy Book3"),
  @("MSI","msi","Modern 15")
)
for ($n = 1; $n -le 40; $n++) {
  $b = $phoneLines[($n - 1) % $phoneLines.Count]
  $products.Add((Make-Product $idx "electronics" "smartphones" "$($b[2]) Line $n" $b[0] $b[1])) | Out-Null
  $idx++
}
for ($n = 1; $n -le 40; $n++) {
  $b = $laptopLines[($n - 1) % $laptopLines.Count]
  $products.Add((Make-Product $idx "electronics" "laptops" "$($b[2]) Line $n" $b[0] $b[1])) | Out-Null
  $idx++
}

$payload = [ordered]@{ version = 5; products = $products }
$json = $payload | ConvertTo-Json -Depth 10 -Compress:$false
# ConvertTo-Json may emit nulls oddly; write UTF8
[System.IO.File]::WriteAllText($ProductsPath, $json, [System.Text.UTF8Encoding]::new($false))

# Update category counts
$counts = @{}
foreach ($p in $products) {
  if (-not $counts.ContainsKey($p.category)) { $counts[$p.category] = 0 }
  $counts[$p.category]++
}
$catsObj = Get-Content $CategoriesPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($c in $catsObj.categories) {
  $real = if ($counts.ContainsKey($c.id)) { $counts[$c.id] } else { 0 }
  $c.count = $real
}
$catsJson = $catsObj | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($CategoriesPath, $catsJson, [System.Text.UTF8Encoding]::new($false))

Write-Host "TOTAL $($products.Count)"
Write-Host ($counts | ConvertTo-Json -Compress)
$phones = ($products | Where-Object { $_.subcategory -eq "smartphones" }).Count
$laptops = ($products | Where-Object { $_.subcategory -eq "laptops" }).Count
Write-Host "phones $phones"
Write-Host "laptops $laptops"
