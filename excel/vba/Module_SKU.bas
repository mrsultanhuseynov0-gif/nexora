Attribute VB_Name = "Module_SKU"
' NEXORA ERP — Avtomatik SKU
' Import: Excel -> Alt+F11 -> File -> Import File -> Module_SKU.bas
' Settings!B5 = SKU prefiks (isteğe bağlı), Categories/Brands siyahılarından istifadə olunur.

Option Explicit

Public Function BuildSKU(categoryId As String, brandName As String, seq As Long) As String
    Dim catPart As String, brandPart As String
    catPart = UCase$(Left$(categoryId & "XXX", 3))
    brandPart = UCase$(Left$(CleanAlpha(brandName) & "XXXX", 4))
    BuildSKU = catPart & "-" & brandPart & "-" & Format$(seq, "0000")
End Function

Private Function CleanAlpha(ByVal s As String) As String
    Dim i As Long, ch As String, out As String
    For i = 1 To Len(s)
        ch = Mid$(s, i, 1)
        If ch Like "[A-Za-z0-9]" Then out = out & ch
    Next i
    CleanAlpha = out
End Function

' Products vərəqində boş SKU-ları doldurur (başlıq sətiri 1)
Public Sub AutoFillMissingSKUs()
    Dim ws As Worksheet, lastRow As Long, r As Long, seq As Long
    Set ws = ThisWorkbook.Worksheets("Products")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    seq = Application.WorksheetFunction.CountA(ws.Range("B:B"))
    For r = 2 To lastRow
        If Trim$(CStr(ws.Cells(r, 2).Value)) = "" And Trim$(CStr(ws.Cells(r, 1).Value)) <> "" Then
            seq = seq + 1
            ws.Cells(r, 2).Value = BuildSKU(CStr(ws.Cells(r, 5).Value), CStr(ws.Cells(r, 4).Value), seq)
        End If
    Next r
    MsgBox "SKU doldurma tamamlandı.", vbInformation, "NEXORA"
End Sub
