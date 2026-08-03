# Generate HTML templates from templates_catalog.json (UTF-8)
$ErrorActionPreference = 'Stop'
$Base = 'C:\Users\user\Projects\nexora\excel'
$DocDir = Join-Path $Base 'templates\documents'
$EmailDir = Join-Path $Base 'templates\email'
$CatalogPath = Join-Path $Base 'scripts\templates_catalog.json'
New-Item -ItemType Directory -Force -Path $DocDir, $EmailDir | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding $false
$catalog = Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json

$linesTable = @'
<table>
  <thead><tr><th>#</th><th>SKU</th><th>Mehsul</th><th>Miqdar</th><th>Qiymet</th><th>Cem</th></tr></thead>
  <tbody>
    <tr>
      <td>1</td>
      <td class="placeholder">{{sku}}</td>
      <td class="placeholder">{{productName}}</td>
      <td class="placeholder">{{qty}}</td>
      <td class="placeholder">{{unitPrice}}</td>
      <td class="placeholder">{{lineTotal}}</td>
    </tr>
  </tbody>
  <tfoot><tr><td colspan="5" class="total">Yekun (AZN)</td><td class="total placeholder">{{total}}</td></tr></tfoot>
</table>
'@

function Get-Body([string]$kind) {
    switch ($kind) {
        'delivery' { return "<p>Unvan: <span class=`"placeholder`">{{address}}</span></p><p>Izleme: <span class=`"placeholder`">{{tracking}}</span></p>$linesTable" }
        'return' { return "<p>Sebeb: <span class=`"placeholder`">{{reason}}</span></p>$linesTable" }
        'purchase' { return "<p>Techizatci: <span class=`"placeholder`">{{supplierName}}</span></p>$linesTable<p>Odenis shertleri: <span class=`"placeholder`">{{paymentTerms}}</span></p>" }
        'transfer' { return "<p>Haradan: <span class=`"placeholder`">{{fromWh}}</span> -&gt; Haraya: <span class=`"placeholder`">{{toWh}}</span></p>$linesTable" }
        'stocktake' { return '<table><thead><tr><th>SKU</th><th>Sistem</th><th>Faktiki</th><th>Ferq</th></tr></thead><tbody><tr><td class="placeholder">{{sku}}</td><td class="placeholder">{{systemQty}}</td><td class="placeholder">{{countedQty}}</td><td class="placeholder">{{diff}}</td></tr></tbody></table>' }
        'contract' { return '<p>Terefler: NEXORA ve <span class="placeholder">{{party}}</span></p><ol><li>Movzu: mal/xidmet</li><li>Muddet: <span class="placeholder">{{startDate}}</span> - <span class="placeholder">{{endDate}}</span></li><li>Odenis: <span class="placeholder">{{paymentTerms}}</span></li></ol>' }
        'nda' { return '<p>Teref: <span class="placeholder">{{party}}</span></p><p>Muddet: <span class="placeholder">{{months}}</span> ay</p>' }
        'poa' { return '<p>Etibar olunan: <span class="placeholder">{{agentName}}</span></p><p>Selahiyyet: <span class="placeholder">{{scope}}</span></p><p>Etibarliliq: <span class="placeholder">{{validUntil}}</span></p>' }
        'act' { return '<p>Is: <span class="placeholder">{{workDesc}}</span></p><p>Tamamlanma: <span class="placeholder">{{percent}}</span>%</p><p>Mebleg: <span class="placeholder">{{total}}</span> AZN</p>' }
        'service' { return '<p>Xidmet: <span class="placeholder">{{serviceName}}</span></p><p>Dovr: <span class="placeholder">{{period}}</span></p><p>Mebleg: <span class="placeholder">{{total}}</span> AZN</p>' }
        'warranty' { return '<p>Mehsul: <span class="placeholder">{{productName}}</span> / SKU: <span class="placeholder">{{sku}}</span></p><p>Seriya: <span class="placeholder">{{serial}}</span></p><p>Zemanet bitme: <span class="placeholder">{{warrantyEnd}}</span></p>' }
        'complaint' { return '<p>Musteri: <span class="placeholder">{{customerName}}</span></p><p>Movzu: <span class="placeholder">{{subject}}</span></p><p>Tesvir: <span class="placeholder">{{details}}</span></p>' }
        'refund' { return '<p>Sifaris: <span class="placeholder">{{relatedTo}}</span></p><p>Mebleg: <span class="placeholder">{{amount}}</span> AZN</p>' }
        'catalog' { return '<p>Kateqoriya: <span class="placeholder">{{category}}</span> / Brend: <span class="placeholder">{{brand}}</span></p><p>Mehsul: <span class="placeholder">{{productName}}</span></p><p>Qiymet: <span class="placeholder">{{unitPrice}}</span> AZN</p>' }
        'hrleave' { return '<p>Isci: <span class="placeholder">{{employee}}</span></p><p>Tarixler: <span class="placeholder">{{startDate}}</span> - <span class="placeholder">{{endDate}}</span></p>' }
        'hrtrip' { return '<p>Isci: <span class="placeholder">{{employee}}</span></p><p>Istiqamet: <span class="placeholder">{{destination}}</span></p><p>Meqsed: <span class="placeholder">{{purpose}}</span></p>' }
        'payroll' { return '<table><thead><tr><th>Isci</th><th>Vezife</th><th>Mebleg</th><th>Bonus</th><th>Yekun</th></tr></thead><tbody><tr><td class="placeholder">{{employee}}</td><td class="placeholder">{{role}}</td><td class="placeholder">{{base}}</td><td class="placeholder">{{bonus}}</td><td class="placeholder">{{total}}</td></tr></tbody></table>' }
        'memo' { return '<p><span class="placeholder">{{from}}</span> -&gt; <span class="placeholder">{{to}}</span></p><p>Movzu: <span class="placeholder">{{subject}}</span></p><p><span class="placeholder">{{body}}</span></p>' }
        'meeting' { return '<p>Istirakcilar: <span class="placeholder">{{attendees}}</span></p><p>Gundelik: <span class="placeholder">{{agenda}}</span></p><p>Qerarlar: <span class="placeholder">{{decisions}}</span></p>' }
        'policy' { return '<p>Siyaset: <span class="placeholder">{{policyName}}</span> / Versiya: <span class="placeholder">{{version}}</span></p><p><span class="placeholder">{{body}}</span></p>' }
        'receipt' { return '<p>Mebleg: <span class="placeholder">{{amount}}</span> AZN</p><p>Odeyen: <span class="placeholder">{{payer}}</span></p><p>Teyinat: <span class="placeholder">{{purpose}}</span></p>' }
        'expense' { return '<p>Kateqoriya: <span class="placeholder">{{expenseCategory}}</span></p><p>Mebleg: <span class="placeholder">{{amount}}</span> AZN</p><p>Sebeb: <span class="placeholder">{{reason}}</span></p>' }
        'asset' { return '<p>Aktiv: <span class="placeholder">{{assetName}}</span></p><p>Inventar No: <span class="placeholder">{{assetNo}}</span></p><p>Alis deyeri: <span class="placeholder">{{cost}}</span> AZN</p>' }
        'vendor' { return '<p>Techizatci: <span class="placeholder">{{supplierName}}</span></p><p>Ballar (1-5): <span class="placeholder">{{scores}}</span></p>' }
        'rma' { return '<p>Mehsul: <span class="placeholder">{{productName}}</span> / Seriya: <span class="placeholder">{{serial}}</span></p><p>Problem: <span class="placeholder">{{issue}}</span></p>' }
        'serial' { return '<table><thead><tr><th>SKU</th><th>Seriya</th><th>Status</th><th>Sifaris</th></tr></thead><tbody><tr><td class="placeholder">{{sku}}</td><td class="placeholder">{{serial}}</td><td class="placeholder">{{status}}</td><td class="placeholder">{{relatedTo}}</td></tr></tbody></table>' }
        'transport' { return "<p>Dasiyici: <span class=`"placeholder`">{{carrier}}</span></p><p><span class=`"placeholder`">{{from}}</span> -&gt; <span class=`"placeholder`">{{to}}</span></p>$linesTable" }
        'gift' { return "<p>Kime: <span class=`"placeholder`">{{recipient}}</span></p><p>Mesaj: <span class=`"placeholder`">{{message}}</span></p>$linesTable" }
        'flyer' { return '<p>Kampaniya: <span class="placeholder">{{campaignName}}</span></p><p>Endirim: <span class="placeholder">{{discount}}</span></p><p>Bitme: <span class="placeholder">{{ends}}</span></p><p><a class="btn" href="#">Indi al</a></p>' }
        'certificate' { return '<p>Partiya: <span class="placeholder">{{batch}}</span></p><p>Standart: <span class="placeholder">{{standard}}</span></p><p>Netice: uygundur</p>' }
        default { return $linesTable }
    }
}

foreach ($d in $catalog.documents) {
    $title = [string]$d.title
    $file = [string]$d.file
    $code = [string]$d.code
    $prefix = [string]$d.prefix
    $body = Get-Body ([string]$d.kind)
    $html = @"
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NEXORA - $title</title>
  <link rel="stylesheet" href="../_base.css" />
</head>
<body>
  <div class="sheet">
    <p class="brand">NEXORA</p>
    <h1 class="doc-title">$title</h1>
    <div class="meta">
      <div>Sened No: <strong class="placeholder">{{docNo}}</strong> (prefiks: $prefix)</div>
      <div>Tarix: <strong class="placeholder">{{date}}</strong></div>
      <div>Kod: <strong>$code</strong> / Sablon: <strong>$file</strong></div>
      <div>Teref: <strong class="placeholder">{{party}}</strong></div>
      <div>Elaqeli: <strong class="placeholder">{{relatedTo}}</strong></div>
    </div>
    $body
    <div class="sig">
      <div>Hazirladi<br/><span class="placeholder">{{preparedBy}}</span></div>
      <div>Tesdiq etdi<br/><span class="placeholder">{{approvedBy}}</span></div>
    </div>
    <div class="footer">NEXORA sened dovriyyesi. Avtomatik nomreleme Excel Documents vereqinden. Cap / PDF ucun brauzerden Print.</div>
  </div>
</body>
</html>
"@
    [System.IO.File]::WriteAllText((Join-Path $DocDir $file), $html, $utf8)
}

foreach ($e in $catalog.emails) {
    $title = [string]$e.title
    $file = [string]$e.file
    $intro = [string]$e.intro
    $fieldsHtml = ''
    foreach ($f in $e.fields) {
        $fieldsHtml += "<p>$f : <span class=`"placeholder`">{{$f}}</span></p>`n"
    }
    $html = @"
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8" />
  <title>NEXORA - $title</title>
  <link rel="stylesheet" href="../_base.css" />
</head>
<body>
  <div class="sheet">
    <p class="brand">NEXORA</p>
    <h1 class="doc-title">$title</h1>
    <p>Salam, <strong class="placeholder">{{name}}</strong>,</p>
    <p>$intro</p>
    $fieldsHtml
    <p style="margin-top:24px"><a class="btn" href="{{ctaUrl}}">Davam et</a></p>
    <div class="footer">Bu email NEXORA Email Center-den hazirlanib. Outlook: excel/vba/Module_Email.bas</div>
  </div>
</body>
</html>
"@
    [System.IO.File]::WriteAllText((Join-Path $EmailDir $file), $html, $utf8)
}

$mailto = @'
<!DOCTYPE html>
<html lang="az">
<head><meta charset="UTF-8" /><title>NEXORA mailto</title><link rel="stylesheet" href="../_base.css" /></head>
<body>
<div class="sheet">
  <p class="brand">NEXORA</p>
  <h1 class="doc-title">mailto komekci</h1>
  <p>Email Center-de mailto sutunu Outlook/default poct klientini acir.</p>
  <p><a class="btn" href="mailto:musteri@example.az?subject=NEXORA%20Mesaj&body=Salam%20{{name}}">mailto numunesi</a></p>
  <p>Toplu gonderme ucun excel/vba/Module_Email.bas import edin.</p>
</div>
</body>
</html>
'@
[System.IO.File]::WriteAllText((Join-Path $EmailDir 'mailto-helper.html'), $mailto, $utf8)

Write-Output ('DOC_COUNT=' + (Get-ChildItem $DocDir -Filter '*.html').Count)
Write-Output ('EMAIL_COUNT=' + (Get-ChildItem $EmailDir -Filter '*.html').Count)
