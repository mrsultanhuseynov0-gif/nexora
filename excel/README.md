# NEXORA Excel ERP + Sənəd + Email (Mərhələlər 18–20)

## Fayllar

| Yol | Təsvir |
|-----|--------|
| `NEXORA_ERP.xlsx` | Əsas workbook (14 vərəq, nümunə data, formulalar) |
| `scripts/build_nexora_erp.ps1` | Workbook-u `data/*.json`-dan yenidən qurur |
| `scripts/generate_templates.ps1` | HTML sənəd/email şablonlarını generasiya edir |
| `templates/documents/` | 42 sənəd şablonu (HTML, Word-də açılır) |
| `templates/email/` | 12 email şablonu + `mailto-helper.html` |
| `vba/` | Auto SKU, sənəd nömrələmə, Outlook inteqrasiyası |

## Mərhələ 18 — Excel ERP

**Vərəqlər:** Dashboard, Products, Categories, Brands, Inventory, Purchases, Sales, Customers, Suppliers, Documents, Email Center, Reports, Settings, Archive

**Xüsusiyyətlər**

- Web JSON ilə uyğun sahələr: `id`, `name`, `brand`, `category`, `price`, `oldPrice`, `currency`, `inStock`, …
- SKU formatı: `CAT-BRAND-0001` (VBA ilə avtomatik doldurma)
- Inventory: min-stok xəbərdarlığı + conditional formatting
- Dropdown: brand / category / müştəri tipi / Email Center müştəri seçimi
- Excel Table + AutoFilter hər əsas cədvəldə
- Dashboard / Reports KPI formulaları (`SUM`, `COUNTIF`, `SUMIF`)
- Pivot: Sales + Products seçib **Insert → PivotTable** (kateqoriya × satış)

**Yenidən qurmaq**

```powershell
powershell -ExecutionPolicy Bypass -File excel\scripts\build_nexora_erp.ps1
```

**JSON export/import (əl ilə)**

1. Products / Categories / Brands cədvəlini CSV kimi export edin
2. Sahə adlarını `data/products.json`, `data/categories.json`, `data/brands.json` ilə eyni saxlayın
3. Web admin (mərhələ 17) və ya əl ilə JSON-a köçürün

## Mərhələ 19 — Sənəd dövriyyəsi

- **42 HTML şablon** (`templates/documents/01` … `42`) — hesab-faktura, proforma, çatdırılma, alış, müqavilə, HR, gömrük və s.
- Excel **Documents** vərəqi: `docNo`, `docType`, `templateFile`, status, arxiv yolu
- Avtomatik nömrələmə: VBA `AssignDocNumberToSelection` → `DOC-YYYY-NNNN`
- Arxiv: status `archived` → **Archive** vərəqi (`ArchiveClosedDocuments`)
- Şablonları Word-də açmaq: HTML faylı Word ilə açın → istəyə görə `.docx` saxlayın
- Placeholder-lər: `{{docNo}}`, `{{party}}`, `{{sku}}`, `{{total}}`, …

Şablonları yeniləmək:

```powershell
powershell -ExecutionPolicy Bypass -File excel\scripts\generate_templates.ps1
```

## Mərhələ 20 — Email template sistemi

- **12 hazır şablon** + mailto köməkçi (`templates/email/`)
- Excel **Email Center**:
  - müştəri seçimi (`G8` dropdown → ad/email `VLOOKUP`)
  - `mailto` hiperlink sütunu
  - şablon kataloqu (kod / fayl / dəyişənlər)
- Outlook: `vba/Module_Email.bas` → `OpenOutlookDraftFromRow` / `FillEmailFromCustomerPicker`
- Outlook yoxdursa mailto keçidi kifayətdir

## Tez start

1. `excel/NEXORA_ERP.xlsx` açın
2. Dashboard-da min-stok alertlərini yoxlayın
3. Şablon nümunəsi: `templates/documents/01-hesab-faktura.html`
4. VBA lazımdırsa: `vba/README.md`
