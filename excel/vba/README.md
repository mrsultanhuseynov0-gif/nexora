# NEXORA VBA modulları

`.xlsx` faylı makrosuz saxlanılıb. VBA-nı əl ilə əlavə edin (və ya Save As `.xlsm`).

## Quraşdırma

1. `NEXORA_ERP.xlsx` açın → **Fayl → Fərqli saxla → Excel Macro-Enabled Workbook (*.xlsm)**
2. `Alt + F11` → **File → Import File**
3. Import edin:
   - `Module_SKU.bas` — avtomatik SKU
   - `Module_Documents.bas` — sənəd nömrələmə + arxiv
   - `Module_Email.bas` — müştəri seçimi + Outlook/mailto
4. İstəyə görə **Developer → Macros** düymələrinə bağlayın

## Makrolar

| Makro | Təsvir |
|-------|--------|
| `AutoFillMissingSKUs` | Products-da boş SKU-ları doldurur |
| `AssignDocNumberToSelection` | Documents aktiv sətrinə `DOC-YYYY-NNNN` |
| `ArchiveClosedDocuments` | `status=archived` sətirləri Archive-ə yazır |
| `FillEmailFromCustomerPicker` | Email Center `G8` müştərisindən yeni email sətri |
| `OpenOutlookDraftFromRow` | Aktiv email sətrini Outlook draft kimi açır |

## Qeyd

Outlook yoxdursa `OpenOutlookDraftFromRow` `mailto:` keçidinə düşür. HTML şablonlar: `excel/templates/email/`.
