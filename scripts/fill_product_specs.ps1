# Fill rich product specs (ASCII-safe script; Azerbaijani via tokens)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProductsPath = Join-Path $Root "data\products.json"

function A([string]$t) {
  # tokens are case-sensitive via unique spellings
  $pairs = @(
    ,('@ae', [char]0x0259)   # e
    ,('@AE', [char]0x018F)   # E
    ,('@ch', [char]0x00E7)   # c
    ,('@CH', [char]0x00C7)   # C
    ,('@gh', [char]0x011F)   # g
    ,('@GH', [char]0x011E)   # G
    ,('@ix', [char]0x0131)   # i (dotless)
    ,('@IX', [char]0x0130)   # I
    ,('@oe', [char]0x00F6)   # o
    ,('@OE', [char]0x00D6)   # O
    ,('@sh', [char]0x015F)   # s
    ,('@SH', [char]0x015E)   # S
    ,('@ue', [char]0x00FC)   # u
    ,('@UE', [char]0x00DC)   # U
    ,('@dash', [char]0x2013)
  )
  $out = $t
  foreach ($pair in $pairs) { $out = $out.Replace($pair[0], [string]$pair[1]) }
  return $out
}

function Pick([object[]]$arr, [uint32]$seed) {
  if (-not $arr -or $arr.Count -eq 0) { return $null }
  return $arr[$seed % $arr.Count]
}

function SeedOf([string]$text) {
  $b = [Text.Encoding]::UTF8.GetBytes($text)
  $h = [Security.Cryptography.SHA1]::Create().ComputeHash($b)
  return [BitConverter]::ToUInt32($h, 0)
}

function Has([string]$n, [string]$pat) { return $n -match $pat }

function Build-Specs([object]$p) {
  $n = ([string]$p.name).ToLowerInvariant()
  $brand = [string]$p.brand
  $sub = ([string]$p.subcategory).ToLowerInvariant()
  $cat = ([string]$p.category).ToLowerInvariant()
  $seed = SeedOf ($p.id + "|" + $p.name)
  $sku = [string]$p.sku
  $price = 0
  try { $price = [int]$p.price } catch { $price = 0 }

  $common = [ordered]@{}
  $common[(A "Brend")] = $brand
  $common[(A "Model")] = [string]$p.name
  $common["SKU"] = $sku
  $common[(A "Kateqoriya")] = $cat
  $common[(A "Alt kateqoriya")] = $sub
  $common[(A "Z@aeman@aet")] = A "12 ay r@aesmi z@aeman@aet"
  $common[(A "@CHatd@ixr@ixlma")] = A "1@dash3 i@sh g@uen@ue (Bak@ix), 2@dash5 g@uen (regionlar)"
  $common[(A "Qaytarma")] = A "14 g@uen @aerzind@ae d@aeyi@shm@ae / qaytarma"
  $common[(A "M@aen@sh@ae")] = A "R@aesmi distribyutor"
  $common[(A "R@aeng variant@ix")] = Pick @((A "Qara"),(A "Boz"),(A "G@uem@ue@sh@ue"),(A "A@gh"),(A "T@uend mavi"),(A "Q@ixrm@ixz@ix")) $seed
  $common[(A "Qutu i@chind@ae")] = A "M@aehsul, s@aen@aedl@aer, z@aeman@aet kart@ix"

  $specs = [ordered]@{}

  if ($sub -eq "smartphones" -or (Has $n "iphone|galaxy|pixel|redmi|poco|xperia|nova")) {
    $isUltra = (Has $n "ultra|pro max") -or (Has $n "\bpro\b")
    $isApple = (Has $n "iphone|apple") -or ($brand -eq "Apple")
    $isSam = (Has $n "galaxy|samsung") -or ($brand -eq "Samsung")
    $ram = if ($isUltra) { Pick @("12 GB","16 GB") $seed } else { Pick @("6 GB","8 GB","12 GB") $seed }
    $storage = if ($isUltra) { Pick @("256 GB","512 GB","1 TB") $seed } else { Pick @("128 GB","256 GB") $seed }
    $screen = if ($isUltra) { Pick @('6.8" AMOLED 120Hz','6.7" LTPO OLED 120Hz') $seed } else { Pick @('6.5" AMOLED 120Hz','6.6" AMOLED 90Hz','6.1" OLED 60Hz') $seed }
    $bat = if ($isUltra) { Pick @("5000 mAh","5400 mAh") $seed } else { Pick @("4000 mAh","4500 mAh","5000 mAh") $seed }
    $cam = if ($isUltra) { "200 MP + 12 MP + 50 MP (tele)" } elseif ($isApple) { A "48 MP @aesas + 12 MP ultrawide" } else { Pick @("50 MP + 8 MP + 2 MP","64 MP + 8 MP ultrawide","108 MP") $seed }
    $cpu = if ($isApple) { Pick @("A17 Pro","A16 Bionic") $seed } elseif ($isSam) { Pick @("Snapdragon 8 Gen 3","Exynos 2400") $seed } elseif (Has $n "pixel") { "Google Tensor G3" } elseif (Has $n "xiaomi|redmi|poco") { Pick @("Snapdragon 7s Gen 2","Dimensity 7200") $seed } else { Pick @("Snapdragon 8 Gen 2","Dimensity 8200") $seed }
    $specs[(A "Ekran")] = $screen
    $specs[(A "Prosessor")] = $cpu
    $specs["RAM"] = $ram
    $specs[(A "Yadda@sh")] = $storage
    $specs[(A "@AEm@aeliyyat sistemi")] = $(if ($isApple) { "iOS 17" } else { "Android 14" })
    $specs[(A "Kamera")] = $cam
    $specs[(A "@OEn kamera")] = $(if ($isApple) { "12 MP" } else { Pick @("12 MP","16 MP","32 MP") $seed })
    $specs[(A "Batareya")] = $bat
    $specs[(A "S@uer@aetli @sharj")] = $(if ($isApple) { "20W / MagSafe" } else { Pick @("25W","45W","67W","80W") $seed })
    $specs["SIM"] = $(if ($isApple) { "Dual eSIM / nano-SIM" } else { "Dual nano-SIM + eSIM" })
    $specs[(A "@SH@aeb@aek@ae")] = "5G / Wi-Fi 6 / Bluetooth 5.3"
    $specs[(A "Su ke@chirm@aem@ae")] = $(if ($isUltra -or $isApple) { "IP68" } else { Pick @("IP67","IP53","IP54") $seed })
    $specs[(A "@OEl@ch@ue / @CHeki")] = Pick @("163 x 78 x 8.6 mm / 195 q","161 x 75 x 7.8 mm / 172 q","168 x 77 x 8.9 mm / 220 q") $seed
    $specs[(A "Biometrik")] = $(if ($isApple) { "Face ID" } else { A "Ekranalt@ix barmaq izi + @uez tan@ixma" })
  }
  elseif ($sub -eq "laptops" -or (Has $n "macbook|laptop|notebook|zenbook|thinkpad|ideapad|pavilion|xps|victus|latitude")) {
    $isMac = (Has $n "macbook") -or ($brand -eq "Apple")
    $isGaming = Has $n "victus|gaming|rog"
    $cpu = if ($isMac) { Pick @("Apple M3","Apple M3 Pro","Apple M2") $seed } elseif ($isGaming) { Pick @("Intel Core i7-13700H","AMD Ryzen 7 7840HS") $seed } else { Pick @("Intel Core i5-1335U","Intel Core i7-1355U","AMD Ryzen 5 7530U") $seed }
    $ram = if ($isMac -or $isGaming) { Pick @("16 GB","32 GB") $seed } else { Pick @("8 GB","16 GB") $seed }
    $ssd = if ($price -gt 3000) { Pick @("512 GB SSD","1 TB SSD") $seed } else { Pick @("256 GB SSD","512 GB SSD") $seed }
    $screen = if ($isMac) { Pick @('13.6" Liquid Retina','14" Liquid Retina XDR','15.3" Liquid Retina') $seed } elseif ($isGaming) { '15.6" FHD 144Hz IPS' } else { Pick @('14" FHD IPS','15.6" FHD IPS','13.3" FHD') $seed }
    $specs[(A "Ekran")] = $screen
    $specs[(A "Prosessor")] = $cpu
    $specs["RAM"] = $ram
    $specs[(A "Yadda@sh")] = $ssd
    $specs[(A "Qrafika")] = $(if ($isMac) { "Integrated Apple GPU" } elseif ($isGaming) { Pick @("RTX 4050 6GB","RTX 4060 8GB") $seed } else { "Integrated Intel / AMD graphics" })
    $specs[(A "@AEm@aeliyyat sistemi")] = $(if ($isMac) { "macOS Sonoma" } else { "Windows 11 Home" })
    $specs[(A "Batareya")] = Pick @((A "max 12 saat"),(A "max 15 saat"),(A "max 18 saat")) $seed
    $specs[(A "Klaviatura")] = $(if ($isMac) { "Magic Keyboard backlit" } else { "Backlit keyboard (EN/RU)" })
    $specs[(A "Portlar")] = $(if ($isMac) { "Thunderbolt / USB-C, MagSafe" } else { "USB-C, USB-A, HDMI, audio jack" })
    $specs["Wi-Fi / BT"] = "Wi-Fi 6E + Bluetooth 5.3"
    $specs[(A "@CHeki")] = Pick @("1.24 kq","1.55 kq","1.8 kq","2.1 kq") $seed
    $specs[(A "Kamera")] = "1080p webcam"
  }
  elseif ($sub -eq "audio" -or (Has $n "headphone|earbuds|buds|speaker|soundbar|headset|airpods|neckband")) { # audio
    $isBuds = Has $n "earbud|buds|airpods|wf "
    $specs[(A "Tip")] = $(if ($isBuds) { A "Simsiz qulaql@ixq (TWS)" } elseif (Has $n "speaker|soundbar") { "Portativ dinamik / soundbar" } else { A "Over-ear simsiz qulaql@ixq" })
    $specs[(A "S@aes")] = Pick @("Hi-Res Audio","40mm drivers","Spatial audio") $seed
    $specs[(A "Aktiv s@aes-k@ueuy azaltma")] = $(if ($isBuds -or (Has $n "xm|noise|pro")) { "ANC" } else { A "Passiv izolyasiya" })
    $specs[(A "Batareya")] = $(if ($isBuds) { Pick @((A "6 saat + 24 saat qutu"),(A "8 saat + 30 saat qutu")) $seed } else { Pick @("30 saat","40 saat","50 saat") $seed })
    $specs[(A "Sharj")] = $(if ($isBuds) { A "USB-C / simsiz sharj" } else { "USB-C" })
    $specs["Bluetooth"] = Pick @("Bluetooth 5.2","Bluetooth 5.3") $seed
    $specs[(A "Mikrofon")] = A "S@aesli z@aeng @ue@ch@ueun daxili mikrofonlar"
    $specs[(A "Su m@ueqavim@aeti")] = $(if ($isBuds) { Pick @("IPX4","IPX5") $seed } else { "-" })
    $specs[(A "Idar@aeetm@ae")] = A "Sensor / d@ueym@ae + app"
    $specs[(A "Uy@ghunluq")] = "iOS / Android / Windows"
  }
  elseif ($sub -eq "tv" -or (Has $n "\btv\b|oled|qled|smart tv")) {
    $size = if (Has $n "55") { '55"' } elseif (Has $n "65") { '65"' } elseif (Has $n "75") { '75"' } elseif (Has $n "43") { '43"' } else { Pick @('43"','50"','55"','65"') $seed }
    $specs[(A "Ekran")] = "$size 4K UHD"
    $specs[(A "Panel")] = Pick @("LED","QLED","OLED") $seed
    $specs[(A "Yenil@aenm@ae")] = Pick @("60 Hz","120 Hz") $seed
    $specs["HDR"] = "HDR10 / HLG"
    $specs[(A "@AEm@aeliyyat sistemi")] = Pick @("Tizen","webOS","Google TV","Android TV") $seed
    $specs[(A "S@aes")] = Pick @("20W 2.0","40W 2.1","Dolby Atmos") $seed
    $specs[(A "Smart funksiyalar")] = "Netflix, YouTube, browser, screen share"
    $specs["HDMI / USB"] = "3x HDMI, 2x USB"
    $specs["Wi-Fi / BT"] = "Wi-Fi 5 + Bluetooth"
    $specs[(A "S@aes @ch@ixx@ix@sh@ix")] = "Optical / HDMI eARC"
    $specs[(A "Divar montaj@ix")] = A "VESA uy@ghun"
  }
  elseif ($sub -eq "gaming" -or (Has $n "controller|keyboard|gaming mouse|vr ")) {
    $isKb = Has $n "keyboard"
    $isMouse = Has $n "mouse"
    $specs[(A "Tip")] = $(if ($isKb) { A "Mexaniki oyun klaviaturas@ix" } elseif ($isMouse) { A "Oyun si@chan@ix" } elseif (Has $n "vr") { "VR" } else { A "Simsiz oyun kontrolleri" })
    $specs[(A "Ba@ghlant@ix")] = Pick @("2.4GHz + Bluetooth","USB-C wired / wireless") $seed
    $specs[(A "Batareya")] = Pick @("20 saat","40 saat","USB-C") $seed
    $specs["RGB"] = $(if ($isKb -or $isMouse) { A "RGB i@sh@ixqland@ixrma" } else { "LED" })
    $specs[(A "Uy@ghunluq")] = "PC / consoles"
    $specs[(A "X@ueususiyy@aet")] = Pick @("Pro ergonomics","Hall-effect sticks","Hot-swap switches","16000 DPI") $seed
    $specs[(A "Material")] = "ABS + soft-touch"
    $specs[(A "@CHeki")] = Pick @("180 q","220 q","850 q","980 q") $seed
  }
  elseif ($sub -eq "cameras" -or (Has $n "camera|drone|gimbal|mirrorless|action cam")) { # cameras
    $specs[(A "Tip")] = $(if (Has $n "action") { "Action kamera" } elseif (Has $n "drone") { "Drone" } elseif (Has $n "gimbal") { "Gimbal" } else { A "Mirrorless foto-aparat d@aesti" })
    $specs[(A "Video")] = Pick @("4K 60fps","4K 30fps","5.7K 30fps") $seed
    $specs[(A "Foto")] = Pick @("20 MP","24 MP","26 MP") $seed
    $specs[(A "Sensor")] = Pick @('1" CMOS',"APS-C",'1/1.3" CMOS') $seed
    $specs[(A "Stabilizasiya")] = "Electronic + optical / gimbal"
    $specs[(A "Ekran")] = Pick @('2.0" LCD','3.0" touch LCD') $seed
    $specs[(A "Yadda@sh")] = "microSD (max 256 GB)"
    $specs[(A "Batareya")] = Pick @((A "90 d@aeq video"),(A "120 d@aeq video")) $seed
    $specs[(A "Su ke@chirm@aem@ae")] = $(if (Has $n "action") { "IP68" } else { "-" })
    $specs[(A "Paket")] = A "Kamera, batareya, kabel, @chanta"
  }
  elseif ($sub -eq "wearables" -or (Has $n "watch|fitness band")) {
    $isApple = (Has $n "apple watch") -or (($brand -eq "Apple") -and (Has $n "watch"))
    $specs[(A "Ekran")] = $(if ($isApple) { Pick @("49mm Always-On Retina","45mm Always-On Retina") $seed } else { Pick @('1.4" AMOLED','1.43" AMOLED','1.9" AMOLED') $seed })
    $specs[(A "Korpus")] = Pick @((A "Al@ueuminium"),(A "Paslanmayan polad"),"Titan") $seed
    $specs["OS"] = $(if ($isApple) { "watchOS" } else { "Wear OS / proprietary" })
    $specs[(A "Batareya")] = $(if ($isApple) { "max 36 saat" } else { Pick @((A "max 7 g@uen"),(A "max 14 g@uen")) $seed })
    $specs[(A "Sa@ghlaml@ixq")] = A "@UEr@aek ritmi, SpO2, yuxu, stress"
    $specs["GPS"] = A "B@aeli (built-in)"
    $specs[(A "Su ke@chirm@aem@ae")] = Pick @("5 ATM","10 ATM","WR50") $seed
    $specs[(A "Sensorlar")] = A "Akselerometr, giroskop, optik @uer@aek sensoru"
    $specs[(A "Ba@ghlant@ix")] = $(if ($isApple) { "Bluetooth / Wi-Fi / LTE" } else { "Bluetooth / Wi-Fi" })
    $specs[(A "Uy@ghunluq")] = $(if ($isApple) { "iPhone iOS 16+" } else { "Android 8+ / iOS 14+" })
  }
  elseif ($sub -eq "shoes" -or (Has $n "shoe|sneaker|boot|runner|ultraboost")) {
    $specs[(A "Tip")] = $(if (Has $n "boot") { "Bot" } else { A "Idman ayaqqab@ixs@ix / sneaker" })
    $specs[(A "Material")] = Pick @("Mesh + synthetic","Knit upper + rubber","Nubuck + EVA") $seed
    $specs[(A "Altliq")] = Pick @("EVA midsole","React foam","Boost foam","Rubber outsole") $seed
    $specs[(A "@OEl@ch@ue diapazonu")] = "EU 36-46"
    $specs[(A "Cins")] = Pick @("Unisex",(A "Ki@shi"),(A "Qad@ixn")) $seed
    $specs[(A "M@oevs@uem")] = Pick @((A "Yay / demiseson"),(A "B@uet@uen m@oevs@uem")) $seed
    $specs[(A "@CHeki (t@aex.)")] = Pick @("280 q","320 q","360 q") $seed
    $specs[(A "Qulluq")] = A "Soyuq su il@ae t@aemizl@aeyin"
    $specs[(A "Istehsal")] = "Orijinal brend"
  }
  elseif ($sub -eq "apparel" -or $cat -eq "fashion") {
    $specs[(A "Tip")] = $(if (Has $n "hoodie|sweat") { "Hoodie" } elseif (Has $n "jean|pants") { A "@SHalvar" } elseif (Has $n "jacket") { A "G@oeod@aek@ch@ae" } else { "Geyim" })
    $specs[(A "Material")] = Pick @((A "100% pamb@ixq"),(A "80% pamb@ixq / 20% polyester"),(A "Denim 98% pamb@ixq / 2% elastan")) $seed
    $specs[(A "@OEl@ch@ue")] = Pick @("S / M / L / XL","XS-XXL") $seed
    $specs[(A "K@aesim")] = Pick @("Regular fit","Oversized","Slim fit") $seed
    $specs[(A "Qulluq")] = A "30C ma@sh@ixn yuma"
    $specs[(A "M@oevs@uem")] = Pick @((A "B@uet@uen m@oevs@uem"),(A "Pay@ixz / q@ixsh"),(A "Yaz / yay")) $seed
    $specs[(A "Cins")] = Pick @("Unisex",(A "Ki@shi"),(A "Qad@ixn")) $seed
  }
  elseif ($sub -eq "accessories") {
    $specs[(A "Tip")] = $(if (Has $n "belt") { A "K@aem@aer" } elseif (Has $n "bag") { A "@CHanta" } elseif (Has $n "wallet") { A "Pul kis@aesi" } else { "Aksesuar" })
    $specs[(A "Material")] = Pick @((A "H@aeqiqi d@aeri"),(A "PU d@aeri"),"Textile + metal") $seed
    $specs[(A "@OEl@ch@ue")] = Pick @("Standart","Adjustable","Universal") $seed
    $specs[(A "R@aeng")] = Pick @((A "Qara"),(A "Q@aehv@aeyi"),(A "Boz")) $seed
    $specs[(A "Ba@ghlama")] = Pick @("Metal buckle","Zipper","Maqnit") $seed
    $specs[(A "Qulluq")] = A "N@aem par@cha il@ae silin"
    $specs[(A "Uy@ghunluq")] = A "G@uend@aelik / i@sh / s@aeyah@aet"
  }
  elseif ($sub -eq "appliances" -or $sub -eq "smart-home" -or $sub -eq "decor" -or $cat -eq "home") {
    $specs[(A "Tip")] = $(if (Has $n "vacuum|robot") { "Robot tozsoran" } elseif (Has $n "purifier") { A "Hava t@aemizl@aeyici" } elseif (Has $n "bulb|lamp") { A "I@sh@ixqland@ixrma" } elseif (Has $n "thermostat") { "Smart termostat" } elseif (Has $n "blanket") { "Ev tekstili" } else { A "Ev / smart m@aei@sh@aet" })
    $specs[(A "G@uec")] = Pick @("25W","40W","65W","1200W","35W LED") $seed
    $specs[(A "G@aerginlik")] = "220-240V"
    $specs[(A "Idar@aeetm@ae")] = Pick @("App + Wi-Fi","Remote + app","Manual + app") $seed
    $specs[(A "S@aes s@aeviyy@aesi")] = Pick @("<= 55 dB","<= 62 dB","<= 48 dB") $seed
    $specs[(A "@OEl@ch@ue")] = Pick @("Kompakt","Orta",(A "B@oey@uek")) $seed
    $specs["Smart"] = $(if ($sub -eq "smart-home" -or (Has $n "smart|robot|xiaomi")) { "Wi-Fi / Alexa / Google" } else { A "@AEsas model" })
    $specs[(A "Enerji sinfi")] = Pick @("A","A+","A++") $seed
    $specs[(A "Paket")] = A "Cihaz, adapter / kabel, t@aelimat"
  }
  elseif ($sub -eq "equipment" -or $cat -eq "sports") {
    $specs[(A "Tip")] = $(if (Has $n "yoga|mat") { "Yoga / fitness mat" } elseif (Has $n "dumbbell") { A "Qantell@aer" } else { A "Idman avadanl@ix@gh@ix" })
    $specs[(A "Material")] = Pick @("TPE","Natural rubber","Steel + neoprene","EVA foam") $seed
    $specs[(A "@OEl@ch@ue / @CHeki")] = Pick @("183 x 61 cm","Set 2x5 kq","Set 2x10 kq","Universal") $seed
    $specs[(A "Maks. y@uek")] = Pick @("100 kq","150 kq","-") $seed
    $specs[(A "S@aeth")] = Pick @("Anti-slip","Dual-side grip") $seed
    $specs[(A "Istifad@ae")] = A "Ev / zal / a@ch@ixq hava"
    $specs[(A "Qulluq")] = A "N@aem par@cha il@ae t@aemizl@aeyin"
    $specs[(A "Ya@sh qrupu")] = "14+"
  }
  elseif ($sub -eq "toys" -or $cat -eq "kids") {
    $specs[(A "Tip")] = $(if (Has $n "lego|block") { "Konstruktor / bloklar" } elseif (Has $n "rc |car") { A "RC ma@sh@ixn" } else { A "U@shaq oyunca@gh@ix" })
    $specs[(A "Ya@sh")] = Pick @("3+","6+","8+","12+") $seed
    $specs[(A "Hiss@ae say@ix")] = Pick @("200+","500+","800+","-") $seed
    $specs[(A "Material")] = Pick @("ABS plastic","Textile","Metal + plastic") $seed
    $specs[(A "Batareya")] = $(if (Has $n "rc |turbo|electronic") { "USB-C / AA" } else { A "T@ael@aeb olunmur" })
    $specs[(A "T@aehl@uek@aesizlik")] = "CE / EN71"
    $specs[(A "@OEl@ch@ue")] = Pick @((A "Ki@chik"),"Orta",(A "B@oey@uek d@aest")) $seed
    $specs[(A "T@aehsil d@aey@aeri")] = A "Motorika, yarad@ixc@ixl@ixq"
  }
  elseif ($sub -eq "skincare" -or $sub -eq "makeup" -or $cat -eq "beauty") {
    $specs[(A "Tip")] = $(if ($sub -eq "makeup" -or (Has $n "mascara|lip|tint")) { "Makiyaj" } else { A "D@aeriy@ae qulluq" })
    $specs[(A "H@aecm")] = Pick @("30 ml","50 ml","100 ml","8 ml") $seed
    $specs[(A "@AEsas t@aerkib")] = Pick @("Vitamin C","Hyaluronic acid","Retinol","Niacinamide","Keratin") $seed
    $specs[(A "D@aeri tipi")] = Pick @((A "B@uet@uen d@aeri tipl@aeri"),(A "Quru d@aeri"),(A "Ya@ghl@ix / qar@ix@sh@ixq")) $seed
    $specs[(A "Istifad@ae")] = Pick @((A "S@aeh@aer / ax@sham"),(A "G@uend@aelik"),(A "Makiyajdan @aevv@ael")) $seed
    $specs[(A "Effekt")] = Pick @((A "N@aeml@aendirm@ae"),(A "Par@ixlt@ix"),(A "H@aecm"),"Anti-age") $seed
    $specs[(A "T@aerkib statusu")] = Pick @((A "Parabensiz"),(A "Dermatoloji test olunub"),"Cruelty-free") $seed
    $specs[(A "@OElk@ae")] = Pick @("Fransa",(A "AB@SH"),"Koreya","Almaniya") $seed
    $specs[(A "Son istifad@ae")] = A "A@ch@ixld@ixqdan sonra 12 ay"
  }
  elseif ($sub -eq "electronics" -or $cat -eq "auto") {
    $specs[(A "Tip")] = $(if (Has $n "dash") { A "Videoqeydiyyat@ch@ix (dash cam)" } elseif (Has $n "jump") { "Jump starter" } else { "Avto elektronika" })
    $specs[(A "G@aerginlik")] = Pick @("12V","5V/12V","12-24V") $seed
    $specs[(A "G@uec / Tutum")] = Pick @("1080p Full HD","4K UHD","10000 mAh","20000 mAh") $seed
    $specs[(A "Ba@ghlant@ix")] = Pick @("USB / USB-C","Wi-Fi app","Cigarette socket") $seed
    $specs[(A "Yadda@sh")] = $(if (Has $n "dash|cam") { "microSD max 128 GB" } else { "-" })
    $specs[(A "I@sh temperaturu")] = "-20C ... +60C"
    $specs[(A "Montaj")] = Pick @((A "@SH@ue@sh@ae mount"),(A "Kabel il@ae"),"Portativ") $seed
    $specs[(A "Paket")] = A "Cihaz, kabell@aer, montaj, t@aelimat"
  }
  elseif ($sub -eq "fiction" -or $sub -eq "hobby" -or $cat -eq "books") {
    $specs[(A "Tip")] = $(if ($sub -eq "hobby") { A "Hobbi / t@aelim kitab@ix" } else { A "B@aedii @aed@aebiyyat" })
    $specs[(A "Dil")] = Pick @((A "Az@aerbaycan"),"Ingilis","Rus") $seed
    $specs[(A "S@aehif@ae")] = Pick @("220","320","480","560") $seed
    $specs[(A "Format")] = Pick @("Paperback","Hardcover") $seed
    $specs[(A "@OEl@ch@ue")] = Pick @("13 x 20 cm","15 x 23 cm") $seed
    $specs[(A "N@aeshriyyat")] = $brand
    $specs["ISBN"] = ("978-9952-" + (1000 + ($seed % 9000)))
    $specs[(A "Ka@gh@ixz")] = A "Ofset / krem ka@gh@ixz"
    $specs[(A "Ya@sh")] = Pick @("14+","16+","18+") $seed
  }
  else {
    $specs[(A "Tip")] = A "@UEmumi m@aehsul"
    $specs[(A "Material")] = A "Premium keyfiyy@aet"
    $specs[(A "@OEl@ch@ue")] = "Standart"
    $specs[(A "Istifad@ae")] = A "G@uend@aelik"
    $specs[(A "Qulluq")] = A "Istehsal@ch@ix t@aelimat@ixna uy@ghun"
  }

  $out = [ordered]@{}
  foreach ($k in $specs.Keys) { $out[$k] = [string]$specs[$k] }
  foreach ($k in $common.Keys) {
    if (-not $out.Contains($k)) { $out[$k] = [string]$common[$k] }
  }
  return $out
}

$data = Get-Content $ProductsPath -Raw -Encoding UTF8 | ConvertFrom-Json
$count = 0
foreach ($p in $data.products) {
  $built = Build-Specs $p
  $hash = [ordered]@{}
  foreach ($k in $built.Keys) { $hash[$k] = [string]$built[$k] }
  $p.specs = [PSCustomObject]$hash
  $count++
}

$ver = 11
try { $ver = [int]$data.version + 1 } catch { $ver = 11 }
if ($ver -lt 11) { $ver = 11 }
$data.version = $ver

$manat = [char]0x20BC
$json = $data | ConvertTo-Json -Depth 12
$json = [regex]::Replace($json, '"currency"\s*:\s*"[^"]*"', ('"currency": "' + $manat + '"'))
[IO.File]::WriteAllText($ProductsPath, $json, [Text.UTF8Encoding]::new($false))

Write-Host ("Filled specs for $count products, version=$ver")
$sample = $data.products | Where-Object { $_.name -eq "Samsung Galaxy S24 Ultra" } | Select-Object -First 1
if ($sample) {
  Write-Host "--- Samsung Galaxy S24 Ultra ---"
  $sample.specs.PSObject.Properties | ForEach-Object { Write-Host ("  " + $_.Name + ": " + $_.Value) }
}
$avg = ($data.products | ForEach-Object { @($_.specs.PSObject.Properties).Count } | Measure-Object -Average).Average
$min = ($data.products | ForEach-Object { @($_.specs.PSObject.Properties).Count } | Measure-Object -Minimum).Minimum
Write-Host ("Spec fields avg={0:N1} min={1}" -f $avg, $min)
