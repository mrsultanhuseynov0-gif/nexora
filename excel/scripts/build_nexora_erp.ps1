# NEXORA Excel ERP generator (Excel COM)
# Run: powershell -ExecutionPolicy Bypass -File excel\scripts\build_nexora_erp.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = 'C:\Users\user\Projects\nexora'
$ExcelDir = Join-Path $Root 'excel'
$OutPath = Join-Path $ExcelDir 'NEXORA_ERP.xlsx'
$DataDir = Join-Path $Root 'data'

function Read-JsonFile([string]$Path) {
    Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

$productsJson = Read-JsonFile (Join-Path $DataDir 'products.json')
$categoriesJson = Read-JsonFile (Join-Path $DataDir 'categories.json')
$brandsJson = Read-JsonFile (Join-Path $DataDir 'brands.json')

$customers = @(
    @{ id='c001'; name='Reshad Memmedov'; email='reshad@example.az'; phone='+994501112233'; company='RM Tech'; city='Baki'; address='Nizami 12'; type='retail'; status='active' }
    @{ id='c002'; name='Leyla Hesenova'; email='leyla@example.az'; phone='+994552223344'; company='LH Design'; city='Gence'; address='Ataturk 45'; type='wholesale'; status='active' }
    @{ id='c003'; name='Elvin Quliyev'; email='elvin@example.az'; phone='+994703334455'; company='EQ Trade'; city='Sumqayit'; address='28 May 8'; type='retail'; status='active' }
    @{ id='c004'; name='Nigar Eliyeva'; email='nigar@example.az'; phone='+994554445566'; company='Nexora B2B'; city='Baki'; address='Heyder Eliyev 120'; type='corporate'; status='active' }
    @{ id='c005'; name='Tural Ismayilov'; email='tural@example.az'; phone='+994505556677'; company='TI Market'; city='Mingechevir'; address='Merkez 3'; type='retail'; status='inactive' }
)

$suppliers = @(
    @{ id='s001'; name='Tech Distrib LLC'; email='sales@techdistrib.az'; phone='+994125551100'; city='Baki'; category='electronics'; paymentTerms='Net 30'; status='active' }
    @{ id='s002'; name='Fashion Hub'; email='order@fashionhub.az'; phone='+994125552200'; city='Baki'; category='fashion'; paymentTerms='Net 15'; status='active' }
    @{ id='s003'; name='Home Supplies AZ'; email='info@homesup.az'; phone='+994125553300'; city='Sumqayit'; category='home'; paymentTerms='Net 45'; status='active' }
    @{ id='s004'; name='Global Gadgets'; email='baku@globalgadgets.com'; phone='+994125554400'; city='Baki'; category='electronics'; paymentTerms='Prepaid'; status='active' }
)

function Get-Sku($product, $index) {
    $cat = ($product.category.Substring(0, [Math]::Min(3, $product.category.Length))).ToUpper()
    $br = ($product.brand -replace '[^A-Za-z0-9]', '').ToUpper()
    if ($br.Length -gt 4) { $br = $br.Substring(0, 4) }
    return ('{0}-{1}-{2:D4}' -f $cat, $br, $index)
}

$stockMap = @{
    'p001' = @{ qty = 24; minStock = 5; warehouse = 'WH-BAK-01'; location = 'A-12' }
    'p002' = @{ qty = 8; minStock = 3; warehouse = 'WH-BAK-01'; location = 'A-03' }
    'p003' = @{ qty = 2; minStock = 5; warehouse = 'WH-BAK-02'; location = 'B-08' }
    'p004' = @{ qty = 15; minStock = 4; warehouse = 'WH-BAK-02'; location = 'C-01' }
    'p005' = @{ qty = 40; minStock = 10; warehouse = 'WH-GAN-01'; location = 'D-04' }
    'p006' = @{ qty = 3; minStock = 2; warehouse = 'WH-BAK-01'; location = 'A-20' }
    'p007' = @{ qty = 1; minStock = 3; warehouse = 'WH-BAK-02'; location = 'B-02' }
    'p008' = @{ qty = 12; minStock = 5; warehouse = 'WH-BAK-01'; location = 'A-15' }
}

if (Test-Path $OutPath) { Remove-Item -LiteralPath $OutPath -Force }

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

try {
    $wb = $excel.Workbooks.Add()
    while ($wb.Worksheets.Count -lt 14) { $null = $wb.Worksheets.Add() }
    $names = @(
        'Dashboard','Products','Categories','Brands','Inventory',
        'Purchases','Sales','Customers','Suppliers','Documents',
        'Email Center','Reports','Settings','Archive'
    )
    for ($i = 0; $i -lt 14; $i++) { $wb.Worksheets.Item($i + 1).Name = $names[$i] }

    $red = 255
    $black = 1118481
    $white = 16777215
    $warn = 49407

    function Style-Header($range) {
        $range.Font.Bold = $true
        $range.Font.Color = $white
        $range.Interior.Color = $black
        $range.HorizontalAlignment = -4108
        $range.VerticalAlignment = -4108
    }

    function Auto-Fit($ws, $cols) {
        $ws.Columns.Item("A:$cols").AutoFit() | Out-Null
    }

    function Add-Table($ws, $startRow, $startCol, $endRow, $endCol, $name) {
        $addr = $ws.Range($ws.Cells.Item($startRow, $startCol), $ws.Cells.Item($endRow, $endCol)).Address($false, $false)
        $list = $ws.ListObjects.Add(1, $ws.Range($addr), $null, 1)
        $list.Name = $name
        $list.TableStyle = 'TableStyleMedium2'
        return $list
    }

    function Set-ListValidation($range, [string]$formula) {
        $range.Validation.Delete() | Out-Null
        $range.Validation.Add(3, 1, 1, $formula) | Out-Null
    }

    function Set-Cell($ws, $r, $c, $val) {
        if ($null -eq $val) { return }
        if ($val -is [double] -or $val -is [int] -or $val -is [long] -or $val -is [decimal] -or $val -is [float]) {
            $ws.Cells.Item($r, $c).Formula = ([string]([double]$val))
        } else {
            $ws.Cells.Item($r, $c).NumberFormat = '@'
            $ws.Cells.Item($r, $c).Formula = [string]$val
        }
    }

    # ===== Settings =====
    $ws = $wb.Worksheets.Item('Settings')
    $ws.Range('A1').Value2 = 'NEXORA ERP - PARAMETRLER'
    $ws.Range('A1').Font.Size = 16
    $ws.Range('A1').Font.Bold = $true
    $ws.Range('A1').Font.Color = $red
    $settings = @(
        @('Sirket adi', 'NEXORA'),
        @('Valyuta', 'AZN'),
        @('Valyuta simvolu', 'AZN'),
        @('EDV %', '18'),
        @('SKU prefiks', 'NX'),
        @('SKU ayirici', '-'),
        @('Sened prefiks', 'DOC'),
        @('Satis prefiks', 'SO'),
        @('Alis prefiks', 'PO'),
        @('Email prefiks', 'EM'),
        @('Min stok rengi', 'Qirmizi'),
        @('Anbar esas', 'WH-BAK-01'),
        @('JSON export qovlugu', '..\data\'),
        @('Son sinxron', (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        @('VBA AutoSKU', 'Aktiv (bax: vba/)'),
        @('Outlook inteqrasiya', 'mailto + VBA COM')
    )
    $ws.Range('A3').Value2 = 'Acar'
    $ws.Range('B3').Value2 = 'Deyer'
    Style-Header $ws.Range('A3:B3')
    for ($i = 0; $i -lt $settings.Count; $i++) {
        $ws.Cells.Item($i + 4, 1).Value2 = [string]$settings[$i][0]
        $val = $settings[$i][1]
        if ($val -is [int] -or $val -is [double] -or $val -is [decimal]) {
            $ws.Cells.Item($i + 4, 2).Value2 = [double]$val
        } else {
            $ws.Cells.Item($i + 4, 2).Value2 = [string]$val
        }
    }
    $ws.Range('A22').Value2 = 'Web JSON uygunluq'
    $ws.Range('A22').Font.Bold = $true
    $ws.Range('A23').Value2 = 'Products: id, name, brand, category, price, oldPrice, currency, inStock'
    $ws.Range('A24').Value2 = 'Categories: id, name, slug'
    $ws.Range('A25').Value2 = 'Brands: id, name'
    $ws.Columns.Item('A:B').AutoFit() | Out-Null

    # ===== Categories =====
    $ws = $wb.Worksheets.Item('Categories')
    $headers = @('id','name','slug','count','icon','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:F1')
    $row = 2
    foreach ($cat in $categoriesJson.categories) {
        $ws.Cells.Item($row, 1).Value2 = [string]$cat.id
        $ws.Cells.Item($row, 2).Value2 = [string]$cat.name
        $ws.Cells.Item($row, 3).Value2 = [string]$cat.slug
        $ws.Cells.Item($row, 4).Value2 = [double]$cat.count
        $ws.Cells.Item($row, 5).Value2 = [string]$cat.icon
        $ws.Cells.Item($row, 6).Value2 = 'active'
        $row++
    }
    $catLast = $row - 1
    Add-Table $ws 1 1 $catLast 6 'tblCategories' | Out-Null
    Auto-Fit $ws 'F'

    # ===== Brands =====
    $ws = $wb.Worksheets.Item('Brands')
    $headers = @('id','name','logo','color','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:E1')
    $row = 2
    foreach ($b in $brandsJson.brands) {
        $ws.Cells.Item($row, 1).Value2 = [string]$b.id
        $ws.Cells.Item($row, 2).Value2 = [string]$b.name
        $ws.Cells.Item($row, 3).Value2 = [string]$b.logo
        $ws.Cells.Item($row, 4).Value2 = [string]$b.color
        $ws.Cells.Item($row, 5).Value2 = 'active'
        $row++
    }
    $ws.Cells.Item($row, 1).Value2 = 'ray-ban'
    $ws.Cells.Item($row, 2).Value2 = 'Ray-Ban'
    $ws.Cells.Item($row, 3).Value2 = 'RB'
    $ws.Cells.Item($row, 4).Value2 = '#111111'
    $ws.Cells.Item($row, 5).Value2 = 'active'
    $brandLast = $row
    Add-Table $ws 1 1 $brandLast 5 'tblBrands' | Out-Null
    Auto-Fit $ws 'E'

    # ===== Products =====
    $ws = $wb.Worksheets.Item('Products')
    $headers = @('id','sku','name','brand','category','price','oldPrice','currency','rating','reviews','badge','inStock','isNew','minStock','cost','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { Set-Cell $ws 1 ($c + 1) $headers[$c] }
    Style-Header $ws.Range('A1:P1')
    $row = 2
    $idx = 1
    foreach ($p in $productsJson.products) {
        $sku = Get-Sku $p $idx
        $st = $stockMap[$p.id]
        $minStockVal = 5
        if ($st) { $minStockVal = [double]$st.minStock }
        Set-Cell $ws $row 1 ([string]$p.id)
        Set-Cell $ws $row 2 $sku
        Set-Cell $ws $row 3 ([string]$p.name)
        Set-Cell $ws $row 4 ([string]$p.brand)
        Set-Cell $ws $row 5 ([string]$p.category)
        Set-Cell $ws $row 6 ([double]$p.price)
        if ($null -ne $p.oldPrice) { Set-Cell $ws $row 7 ([double]$p.oldPrice) }
        Set-Cell $ws $row 8 ([string]$p.currency)
        Set-Cell $ws $row 9 ([double]$p.rating)
        Set-Cell $ws $row 10 ([double]$p.reviews)
        if ($p.badge) { Set-Cell $ws $row 11 ([string]$p.badge) }
        Set-Cell $ws $row 12 $(if ($p.inStock) { 'TRUE' } else { 'FALSE' })
        Set-Cell $ws $row 13 $(if ($p.isNew) { 'TRUE' } else { 'FALSE' })
        Set-Cell $ws $row 14 $minStockVal
        Set-Cell $ws $row 15 ([double]([Math]::Round([double]$p.price * 0.72, 2)))
        Set-Cell $ws $row 16 'active'
        $row++; $idx++
    }
    $prodLast = $row - 1
    $prodCount = $prodLast - 1
    Add-Table $ws 1 1 $prodLast 16 'tblProducts' | Out-Null
    Set-ListValidation $ws.Range("D2:D$prodLast") ('=Brands!$B$2:$B$' + $brandLast)
    Set-ListValidation $ws.Range("E2:E$prodLast") ('=Categories!$A$2:$A$' + $catLast)
    Auto-Fit $ws 'P'

    # ===== Inventory =====
    $ws = $wb.Worksheets.Item('Inventory')
    $headers = @('id','sku','name','warehouse','location','qty','minStock','reorderQty','status','alert')
    for ($c = 0; $c -lt $headers.Count; $c++) { Set-Cell $ws 1 ($c + 1) $headers[$c] }
    Style-Header $ws.Range('A1:J1')
    $row = 2
    $idx = 1
    foreach ($p in $productsJson.products) {
        $sku = Get-Sku $p $idx
        $st = $stockMap[$p.id]
        $qty = 10.0
        $min = 5.0
        $wh = 'WH-BAK-01'
        $loc = 'Z-01'
        if ($st) {
            $qty = [double]$st.qty
            $min = [double]$st.minStock
            $wh = [string]$st.warehouse
            $loc = [string]$st.location
        }
        if ($qty -le 0) { $status = 'out' } elseif ($qty -le $min) { $status = 'low' } else { $status = 'ok' }
        Set-Cell $ws $row 1 ([string]$p.id)
        Set-Cell $ws $row 2 $sku
        Set-Cell $ws $row 3 ([string]$p.name)
        Set-Cell $ws $row 4 $wh
        Set-Cell $ws $row 5 $loc
        Set-Cell $ws $row 6 $qty
        Set-Cell $ws $row 7 $min
        Set-Cell $ws $row 8 ([double]([Math]::Max($min * 2, 10)))
        Set-Cell $ws $row 9 $status
        $ws.Cells.Item($row, 10).Formula = '=IF(F' + $row + '<=G' + $row + ',"MIN STOK","OK")'
        $row++; $idx++
    }
    $invLast = $row - 1
    Add-Table $ws 1 1 $invLast 10 'tblInventory' | Out-Null
    $cfRange = $ws.Range("F2:F$invLast")
    $cf = $cfRange.FormatConditions.Add(2, 0, '=F2<=G2')
    $cf.Interior.Color = $red
    $cf.Font.Color = $white
    $cf.Font.Bold = $true
    $alertRange = $ws.Range("J2:J$invLast")
    $cf2 = $alertRange.FormatConditions.Add(1, 3, 'OK')
    $cf2.Interior.Color = $warn
    $cf2.Font.Bold = $true
    Auto-Fit $ws 'J'

    # ===== Customers =====
    $ws = $wb.Worksheets.Item('Customers')
    $headers = @('id','name','email','phone','company','city','address','type','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:I1')
    $row = 2
    foreach ($c in $customers) {
        $ws.Cells.Item($row, 1).Value2 = $c.id
        $ws.Cells.Item($row, 2).Value2 = $c.name
        $ws.Cells.Item($row, 3).Value2 = $c.email
        $ws.Cells.Item($row, 4).Value2 = $c.phone
        $ws.Cells.Item($row, 5).Value2 = $c.company
        $ws.Cells.Item($row, 6).Value2 = $c.city
        $ws.Cells.Item($row, 7).Value2 = $c.address
        $ws.Cells.Item($row, 8).Value2 = $c.type
        $ws.Cells.Item($row, 9).Value2 = $c.status
        $row++
    }
    $custLast = $row - 1
    Add-Table $ws 1 1 $custLast 9 'tblCustomers' | Out-Null
    Set-ListValidation $ws.Range("H2:H$custLast") 'retail,wholesale,corporate'
    Auto-Fit $ws 'I'

    # ===== Suppliers =====
    $ws = $wb.Worksheets.Item('Suppliers')
    $headers = @('id','name','email','phone','city','category','paymentTerms','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:H1')
    $row = 2
    foreach ($s in $suppliers) {
        $ws.Cells.Item($row, 1).Value2 = $s.id
        $ws.Cells.Item($row, 2).Value2 = $s.name
        $ws.Cells.Item($row, 3).Value2 = $s.email
        $ws.Cells.Item($row, 4).Value2 = $s.phone
        $ws.Cells.Item($row, 5).Value2 = $s.city
        $ws.Cells.Item($row, 6).Value2 = $s.category
        $ws.Cells.Item($row, 7).Value2 = $s.paymentTerms
        $ws.Cells.Item($row, 8).Value2 = $s.status
        $row++
    }
    $supLast = $row - 1
    Add-Table $ws 1 1 $supLast 8 'tblSuppliers' | Out-Null
    Auto-Fit $ws 'H'

    # ===== Purchases =====
    $ws = $wb.Worksheets.Item('Purchases')
    $headers = @('poNo','date','supplierId','supplierName','productId','sku','qty','unitCost','total','status','notes')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:K1')
    $purchases = @(
        @('PO-2026-0001','2026-07-01','s001','Tech Distrib LLC','p001','ELE-SAMS-0001',20,1350,'received','Samsung stok'),
        @('PO-2026-0002','2026-07-05','s004','Global Gadgets','p003','ELE-SONY-0003',30,300,'received','Qulaqliq'),
        @('PO-2026-0003','2026-07-12','s002','Fashion Hub','p005','FAS-NIKE-0005',50,110,'ordered','Nike partiya'),
        @('PO-2026-0004','2026-07-20','s003','Home Supplies AZ','p004','HOM-DYSO-0004',10,620,'partial','Dyson'),
        @('PO-2026-0005','2026-07-28','s001','Tech Distrib LLC','p008','ELE-SONY-0008',15,560,'ordered','PS5')
    )
    $row = 2
    foreach ($po in $purchases) {
        $ws.Cells.Item($row, 1).Value2 = $po[0]
        $ws.Cells.Item($row, 2).Value2 = $po[1]
        $ws.Cells.Item($row, 3).Value2 = $po[2]
        $ws.Cells.Item($row, 4).Value2 = $po[3]
        $ws.Cells.Item($row, 5).Value2 = $po[4]
        $ws.Cells.Item($row, 6).Value2 = $po[5]
        $ws.Cells.Item($row, 7).Value2 = [double]$po[6]
        $ws.Cells.Item($row, 8).Value2 = [double]$po[7]
        $ws.Cells.Item($row, 9).Formula = '=G' + $row + '*H' + $row
        $ws.Cells.Item($row, 10).Value2 = $po[8]
        $ws.Cells.Item($row, 11).Value2 = $po[9]
        $row++
    }
    $poLast = $row - 1
    Add-Table $ws 1 1 $poLast 11 'tblPurchases' | Out-Null
    Auto-Fit $ws 'K'

    # ===== Sales =====
    $ws = $wb.Worksheets.Item('Sales')
    $headers = @('soNo','date','customerId','customerName','productId','sku','qty','unitPrice','discount','total','channel','status')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:L1')
    $sales = @(
        @('SO-2026-0001','2026-07-03','c001','Reshad Memmedov','p001','ELE-SAMS-0001',1,1899,0,'web','paid'),
        @('SO-2026-0002','2026-07-08','c002','Leyla Hesenova','p003','ELE-SONY-0003',2,449,50,'web','paid'),
        @('SO-2026-0003','2026-07-15','c004','Nigar Eliyeva','p006','ELE-LG-0006',1,2499,100,'b2b','paid'),
        @('SO-2026-0004','2026-07-22','c003','Elvin Quliyev','p005','FAS-NIKE-0005',3,189,0,'web','shipped'),
        @('SO-2026-0005','2026-07-25','c001','Reshad Memmedov','p008','ELE-SONY-0008',1,799,0,'web','paid'),
        @('SO-2026-0006','2026-07-30','c002','Leyla Hesenova','p007','FAS-RAYB-0007',1,549,0,'web','pending')
    )
    $row = 2
    foreach ($so in $sales) {
        $ws.Cells.Item($row, 1).Value2 = $so[0]
        $ws.Cells.Item($row, 2).Value2 = $so[1]
        $ws.Cells.Item($row, 3).Value2 = $so[2]
        $ws.Cells.Item($row, 4).Value2 = $so[3]
        $ws.Cells.Item($row, 5).Value2 = $so[4]
        $ws.Cells.Item($row, 6).Value2 = $so[5]
        $ws.Cells.Item($row, 7).Value2 = [double]$so[6]
        $ws.Cells.Item($row, 8).Value2 = [double]$so[7]
        $ws.Cells.Item($row, 9).Value2 = [double]$so[8]
        $ws.Cells.Item($row, 10).Formula = '=G' + $row + '*H' + $row + '-I' + $row
        $ws.Cells.Item($row, 11).Value2 = $so[9]
        $ws.Cells.Item($row, 12).Value2 = $so[10]
        $row++
    }
    $salesLast = $row - 1
    Add-Table $ws 1 1 $salesLast 12 'tblSales' | Out-Null
    Auto-Fit $ws 'L'

    # ===== Documents =====
    $ws = $wb.Worksheets.Item('Documents')
    $headers = @('docNo','docType','title','relatedTo','party','date','status','templateFile','archivePath','notes')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:J1')
    $docs = @(
        @('DOC-2026-0001','invoice','Satis hesab-faktura','SO-2026-0001','Reshad Memmedov','2026-07-03','archived','01-hesab-faktura.html','Archive','Odenilib'),
        @('DOC-2026-0002','delivery','Catdirilma qebzi','SO-2026-0002','Leyla Hesenova','2026-07-09','active','03-catdirilma-qebzi.html','',''),
        @('DOC-2026-0003','purchase','Alis sifarisi','PO-2026-0003','Fashion Hub','2026-07-12','active','10-alis-sifarisi.html','',''),
        @('DOC-2026-0004','contract','B2B muqavile','c004','Nexora B2B','2026-07-15','review','15-b2b-muqavile.html','',''),
        @('DOC-2026-0005','return','Qaytarma akti','SO-2026-0004','Elvin Quliyev','2026-07-26','draft','07-qaytarma-akti.html','','')
    )
    $row = 2
    foreach ($d in $docs) {
        for ($c = 0; $c -lt 10; $c++) { $ws.Cells.Item($row, $c + 1).Value2 = $d[$c] }
        $row++
    }
    $docLast = $row - 1
    Add-Table $ws 1 1 $docLast 10 'tblDocuments' | Out-Null

    $ws.Range('A12').Value2 = 'Sened novleri (sablon kataloqu) - 42 sablon'
    $ws.Range('A12').Font.Bold = $true
    $ws.Range('A13').Value2 = 'code'
    $ws.Range('B13').Value2 = 'ad'
    $ws.Range('C13').Value2 = 'templateFile'
    $ws.Range('D13').Value2 = 'prefix'
    Style-Header $ws.Range('A13:D13')
    $docTypes = @(
        @('invoice','Hesab-faktura','01-hesab-faktura.html','INV'),
        @('proforma','Proforma faktura','02-proforma.html','PRF'),
        @('delivery','Catdirilma qebzi','03-catdirilma-qebzi.html','DLV'),
        @('packing','Qablasdirma siyahisi','04-qablasdirma.html','PKG'),
        @('quote','Qiymet teklifi','05-qiymet-teklifi.html','QTE'),
        @('order','Satis sifarisi','06-satis-sifarisi.html','ORD'),
        @('return','Qaytarma akti','07-qaytarma-akti.html','RTN'),
        @('credit','Kredit notasi','08-kredit-nota.html','CRN'),
        @('debit','Debet notasi','09-debet-nota.html','DBN'),
        @('purchase','Alis sifarisi','10-alis-sifarisi.html','PO'),
        @('grn','Mal qebulu','11-mal-qebulu.html','GRN'),
        @('transfer','Anbar kocurme','12-anbar-kocurme.html','TRF'),
        @('stocktake','Inventarizasiya','13-inventarizasiya.html','STK'),
        @('writeoff','Silinme akti','14-silinme-akti.html','WOF'),
        @('contract','B2B muqavile','15-b2b-muqavile.html','CTR'),
        @('nda','Konfidensialliq','16-nda.html','NDA'),
        @('poa','Etibarname','17-etibarname.html','POA'),
        @('act','Is akti','18-is-akti.html','ACT'),
        @('service','Xidmet akti','19-xidmet-akti.html','SRV'),
        @('warranty','Zemanet talonu','20-zemanet.html','WRN'),
        @('complaint','Sikayet blanki','21-sikayet.html','CMP'),
        @('refund','Geri odenis','22-geri-odenis.html','RFD'),
        @('price','Qiymet siyahisi','23-qiymet-siyahisi.html','PRC'),
        @('catalog','Katalog vereqi','24-katalog.html','CAT'),
        @('hrleave','Mezuniyyet erizesi','25-mezuniyyet.html','HR'),
        @('hrtrip','Ezamiyyet','26-ezamiyyet.html','HR'),
        @('payroll','Emekhaqqi cedveli','27-emekhaqqi.html','PAY'),
        @('memo','Daxili memo','28-daxili-memo.html','MEM'),
        @('meeting','Iclas protokolu','29-iclas-protokolu.html','MTG'),
        @('policy','Sirket siyaseti','30-siyaset.html','POL'),
        @('receipt','Kassa qebzi','31-kassa-qebzi.html','RCP'),
        @('expense','Xerc akti','32-xerc-akti.html','EXP'),
        @('asset','Esas vesait','33-esas-vesait.html','AST'),
        @('vendor','Techizatci qiymetlendirme','34-techizatci-qiymet.html','VND'),
        @('rma','RMA forma','35-rma.html','RMA'),
        @('serial','Seriya ucotu','36-seriya-ucotu.html','SER'),
        @('customs','Gomruk beyanname','37-gomruk.html','CUS'),
        @('transport','Dasima senedi','38-dasima.html','TRN'),
        @('gift','Hediye qebzi','39-hediyye-qebzi.html','GFT'),
        @('newsletter','Kampaniya flayer','40-kampaniya-flayer.html','FLY'),
        @('certificate','Keyfiyyet sertifikati','41-sertifikat.html','CRT'),
        @('handover','Tehvil-teslim','42-tehvil-teslim.html','HND')
    )
    $r = 14
    foreach ($t in $docTypes) {
        $ws.Cells.Item($r, 1).Value2 = $t[0]
        $ws.Cells.Item($r, 2).Value2 = $t[1]
        $ws.Cells.Item($r, 3).Value2 = $t[2]
        $ws.Cells.Item($r, 4).Value2 = $t[3]
        $r++
    }
    Auto-Fit $ws 'J'

    # ===== Email Center =====
    $ws = $wb.Worksheets.Item('Email Center')
    $headers = @('emailNo','template','customerId','customerName','toEmail','subject','status','created','sentAt','mailto')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:J1')
    $emails = @(
        @('EM-2026-0001','order-confirm','c001','Reshad Memmedov','reshad@example.az','NEXORA - Sifaris tesdiqi SO-2026-0001','sent','2026-07-03','2026-07-03'),
        @('EM-2026-0002','shipping','c002','Leyla Hesenova','leyla@example.az','NEXORA - Sifarisiniz yoldadir','sent','2026-07-09','2026-07-09'),
        @('EM-2026-0003','promo','c004','Nigar Eliyeva','nigar@example.az','NEXORA - Yay kampaniyasi','draft','2026-07-20',''),
        @('EM-2026-0004','low-stock-internal','','Anbar komandasi','stock@nexora.az','Min stok xeberdarligi','queued','2026-07-28','')
    )
    $row = 2
    foreach ($e in $emails) {
        for ($c = 0; $c -lt 9; $c++) { $ws.Cells.Item($row, $c + 1).Value2 = $e[$c] }
        $formula = '=HYPERLINK("mailto:"&E' + $row + '&"?subject="&F' + $row + ',"mailto ac")'
        $ws.Cells.Item($row, 10).Formula = $formula
        $row++
    }
    $emLast = $row - 1
    Add-Table $ws 1 1 $emLast 10 'tblEmails' | Out-Null

    $ws.Range('A8').Value2 = 'Email sablonlari'
    $ws.Range('A8').Font.Bold = $true
    $ws.Range('A9').Value2 = 'code'
    $ws.Range('B9').Value2 = 'ad'
    $ws.Range('C9').Value2 = 'fayl'
    $ws.Range('D9').Value2 = 'deyisenler'
    Style-Header $ws.Range('A9:D9')
    $emailTemplates = @(
        @('order-confirm','Sifaris tesdiqi','email-order-confirm.html','{{name}},{{soNo}},{{total}}'),
        @('shipping','Catdirilma izleme','email-shipping.html','{{name}},{{tracking}},{{soNo}}'),
        @('delivered','Catdirildi','email-delivered.html','{{name}},{{soNo}}'),
        @('promo','Kampaniya','email-promo.html','{{name}},{{promoCode}},{{ends}}'),
        @('welcome','Xos geldiniz','email-welcome.html','{{name}}'),
        @('password-reset','Sifre sifirlama','email-password-reset.html','{{name}},{{resetLink}}'),
        @('abandoned-cart','Sebet xatirlatma','email-abandoned-cart.html','{{name}},{{cartTotal}}'),
        @('review-request','Rey sorgusu','email-review-request.html','{{name}},{{product}}'),
        @('refund','Geri odenis','email-refund.html','{{name}},{{amount}},{{soNo}}'),
        @('b2b-quote','B2B teklif','email-b2b-quote.html','{{company}},{{quoteNo}}'),
        @('low-stock-internal','Min stok (daxili)','email-low-stock.html','{{sku}},{{qty}},{{minStock}}'),
        @('newsletter','Bulleten','email-newsletter.html','{{name}},{{month}}')
    )
    $r = 10
    foreach ($t in $emailTemplates) {
        $ws.Cells.Item($r, 1).Value2 = $t[0]
        $ws.Cells.Item($r, 2).Value2 = $t[1]
        $ws.Cells.Item($r, 3).Value2 = $t[2]
        $ws.Cells.Item($r, 4).Value2 = $t[3]
        $r++
    }
    $ws.Range('F8').Value2 = 'Musteri sec (id)'
    $ws.Range('G8').Value2 = $customers[0].id
    $ws.Range('F9').Value2 = 'Ad'
    $ws.Range('G9').Formula = '=IFERROR(VLOOKUP(G8,Customers!A:B,2,FALSE),"")'
    $ws.Range('F10').Value2 = 'Email'
    $ws.Range('G10').Formula = '=IFERROR(VLOOKUP(G8,Customers!A:C,3,FALSE),"")'
    Set-ListValidation $ws.Range('G8') ('=Customers!$A$2:$A$' + $custLast)
    Auto-Fit $ws 'J'

    # ===== Archive =====
    $ws = $wb.Worksheets.Item('Archive')
    $headers = @('archiveId','source','refNo','title','archivedAt','path','tags')
    for ($c = 0; $c -lt $headers.Count; $c++) { $ws.Cells.Item(1, $c + 1).Value2 = $headers[$c] }
    Style-Header $ws.Range('A1:G1')
    $arch = @(
        @('ARC-0001','Documents','DOC-2026-0001','Satis hesab-faktura','2026-07-10','Archive/2026/07/','invoice,paid'),
        @('ARC-0002','Sales','SO-2026-0001','Satis baglandi','2026-07-10','Archive/2026/07/','sales'),
        @('ARC-0003','Email Center','EM-2026-0001','Gonderilmis email','2026-07-03','Archive/email/','email')
    )
    $row = 2
    foreach ($a in $arch) {
        for ($c = 0; $c -lt 7; $c++) { $ws.Cells.Item($row, $c + 1).Value2 = $a[$c] }
        $row++
    }
    Add-Table $ws 1 1 4 7 'tblArchive' | Out-Null
    Auto-Fit $ws 'G'

    # ===== Reports =====
    $ws = $wb.Worksheets.Item('Reports')
    $ws.Range('A1').Value2 = 'NEXORA - HESABATLAR'
    $ws.Range('A1').Font.Size = 16
    $ws.Range('A1').Font.Bold = $true
    $ws.Range('A1').Font.Color = $red

    $ws.Range('A3').Value2 = 'Satis xulasesi'
    $ws.Range('A3').Font.Bold = $true
    $ws.Range('A4').Value2 = 'Umumi satis meblegi'
    $ws.Range('B4').Formula = '=SUM(Sales!J:J)'
    $ws.Range('A5').Value2 = 'Satis sayi'
    $ws.Range('B5').Formula = '=COUNTA(Sales!A:A)-1'
    $ws.Range('A6').Value2 = 'Orta cek'
    $ws.Range('B6').Formula = '=IFERROR(B4/B5,0)'
    $ws.Range('A7').Value2 = 'Odenilmis satislar'
    $ws.Range('B7').Formula = '=COUNTIF(Sales!L:L,"paid")'

    $ws.Range('A9').Value2 = 'Stok xulasesi'
    $ws.Range('A9').Font.Bold = $true
    $ws.Range('A10').Value2 = 'Umumi miqdar'
    $ws.Range('B10').Formula = '=SUM(Inventory!F:F)'
    $ws.Range('A11').Value2 = 'Min stok xeberdarligi'
    $ws.Range('B11').Formula = '=COUNTIF(Inventory!J:J,"MIN STOK")'
    $ws.Range('A12').Value2 = 'Mehsul sayi'
    $ws.Range('B12').Formula = '=COUNTA(Products!A:A)-1'

    $ws.Range('A14').Value2 = 'Alis xulasesi'
    $ws.Range('A14').Font.Bold = $true
    $ws.Range('A15').Value2 = 'Alis cemi'
    $ws.Range('B15').Formula = '=SUM(Purchases!I:I)'
    $ws.Range('A16').Value2 = 'Aciq PO'
    $ws.Range('B16').Formula = '=COUNTIF(Purchases!J:J,"ordered")+COUNTIF(Purchases!J:J,"partial")'

    $ws.Range('A18').Value2 = 'Kateqoriya uzre katalog qiymet cemi'
    $ws.Range('A18').Font.Bold = $true
    $ws.Range('A19').Value2 = 'category'
    $ws.Range('B19').Value2 = 'catalogPriceSum'
    Style-Header $ws.Range('A19:B19')
    $ws.Range('A20').Value2 = 'electronics'
    $ws.Range('B20').Formula = '=SUMIF(Products!E:E,"electronics",Products!F:F)'
    $ws.Range('A21').Value2 = 'fashion'
    $ws.Range('B21').Formula = '=SUMIF(Products!E:E,"fashion",Products!F:F)'
    $ws.Range('A22').Value2 = 'home'
    $ws.Range('B22').Formula = '=SUMIF(Products!E:E,"home",Products!F:F)'
    $ws.Range('A24').Value2 = 'Qeyd: Tam PivotTable uchun Sales+Products -> Insert -> PivotTable (bax excel/README.md).'
    $ws.Range('A24').Font.Italic = $true
    $ws.Columns.Item('A:C').AutoFit() | Out-Null

    # ===== Dashboard =====
    $ws = $wb.Worksheets.Item('Dashboard')
    $ws.Range('A1').Value2 = 'NEXORA'
    $ws.Range('A1').Font.Size = 28
    $ws.Range('A1').Font.Bold = $true
    $ws.Range('A1').Font.Color = $red
    $ws.Range('B1').Value2 = 'Excel ERP Dashboard'
    $ws.Range('B1').Font.Size = 18
    $ws.Range('B1').Font.Color = $black

    $ws.Range('A3').Value2 = 'Gosterici'
    $ws.Range('B3').Value2 = 'Deyer'
    Style-Header $ws.Range('A3:B3')
    $ws.Range('A4').Value2 = 'Umumi satis (AZN)'
    $ws.Range('B4').Formula = '=Reports!B4'
    $ws.Range('A5').Value2 = 'Satis sayi'
    $ws.Range('B5').Formula = '=Reports!B5'
    $ws.Range('A6').Value2 = 'Orta cek (AZN)'
    $ws.Range('B6').Formula = '=Reports!B6'
    $ws.Range('A7').Value2 = 'Stok cemi'
    $ws.Range('B7').Formula = '=Reports!B10'
    $ws.Range('A8').Value2 = 'Min stok alert'
    $ws.Range('B8').Formula = '=Reports!B11'
    $ws.Range('A9').Value2 = 'Musteri sayi'
    $ws.Range('B9').Formula = '=COUNTA(Customers!A:A)-1'
    $ws.Range('A10').Value2 = 'Techizatci'
    $ws.Range('B10').Formula = '=COUNTA(Suppliers!A:A)-1'
    $ws.Range('A11').Value2 = 'Aciq senedler'
    $ws.Range('B11').Formula = '=COUNTIF(Documents!G:G,"active")+COUNTIF(Documents!G:G,"draft")+COUNTIF(Documents!G:G,"review")'
    $ws.Range('A12').Value2 = 'Gozleyen email'
    $ws.Range('B12').Formula = "=COUNTIF('Email Center'!G:G,""draft"")+COUNTIF('Email Center'!G:G,""queued"")"

    $ws.Range('D3').Value2 = 'Min stok siyahisi'
    $ws.Range('D3').Font.Bold = $true
    $ws.Range('D4').Value2 = 'sku'
    $ws.Range('E4').Value2 = 'name'
    $ws.Range('F4').Value2 = 'qty'
    $ws.Range('G4').Value2 = 'minStock'
    Style-Header $ws.Range('D4:G4')
    $alertRow = 5
    $idx = 1
    foreach ($p in $productsJson.products) {
        $st = $stockMap[$p.id]
        if ($st -and $st.qty -le $st.minStock) {
            $ws.Cells.Item($alertRow, 4).Value2 = (Get-Sku $p $idx)
            $ws.Cells.Item($alertRow, 5).Value2 = [string]$p.name
            $ws.Cells.Item($alertRow, 6).Value2 = [double]$st.qty
            $ws.Cells.Item($alertRow, 7).Value2 = [double]$st.minStock
            $ws.Range("D${alertRow}:G${alertRow}").Interior.Color = 13551615
            $alertRow++
        }
        $idx++
    }
    $ws.Range('A14').Value2 = 'Tez kecidler: Products | Inventory | Sales | Purchases | Documents | Email Center | Reports'
    $ws.Range('A15').Value2 = 'JSON sinxron: Products/Categories/Brands saheleri data/*.json ile eynidir.'
    $ws.Range('A16').Value2 = 'VBA: Auto SKU, sened nomreleme, Outlook - excel/vba/'
    $ws.Columns.Item('A:G').AutoFit() | Out-Null

    $wb.Worksheets.Item('Dashboard').Activate() | Out-Null
    $wb.SaveAs($OutPath, 51)
    $wb.Close($false)
    Write-Output "CREATED: $OutPath"
}
finally {
    $excel.ScreenUpdating = $true
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
