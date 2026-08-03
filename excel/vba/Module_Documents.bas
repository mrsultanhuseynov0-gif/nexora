Attribute VB_Name = "Module_Documents"
' NEXORA ERP — Sənəd avtomatik nömrələmə + arxiv
' Documents vərəqi + Settings (Sənəd prefiks)

Option Explicit

Public Function NextDocNo(Optional ByVal prefix As String = "DOC") As String
    Dim ws As Worksheet, lastRow As Long, maxN As Long, r As Long, v As String, n As Long
    Set ws = ThisWorkbook.Worksheets("Documents")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    maxN = 0
    For r = 2 To lastRow
        v = CStr(ws.Cells(r, 1).Value)
        If InStr(1, v, "-") > 0 Then
            On Error Resume Next
            n = CLng(Val(Right$(v, 4)))
            On Error GoTo 0
            If n > maxN Then maxN = n
        End If
    Next r
    NextDocNo = prefix & "-" & Format$(Year(Date), "0000") & "-" & Format$(maxN + 1, "0000")
End Function

' Aktiv sətirdə yeni sənəd nömrəsi yazır (Documents vərəqində)
Public Sub AssignDocNumberToSelection()
    Dim ws As Worksheet, r As Long
    Set ws = ThisWorkbook.Worksheets("Documents")
    r = ActiveCell.Row
    If r < 2 Then Exit Sub
    If Trim$(CStr(ws.Cells(r, 1).Value)) = "" Then
        ws.Cells(r, 1).Value = NextDocNo("DOC")
        If Trim$(CStr(ws.Cells(r, 6).Value)) = "" Then ws.Cells(r, 6).Value = Format$(Date, "yyyy-mm-dd")
        If Trim$(CStr(ws.Cells(r, 7).Value)) = "" Then ws.Cells(r, 7).Value = "draft"
    End If
End Sub

' Status=archived olanları Archive vərəqinə köçürür
Public Sub ArchiveClosedDocuments()
    Dim src As Worksheet, dst As Worksheet
    Dim lastSrc As Long, lastDst As Long, r As Long, i As Long
    Set src = ThisWorkbook.Worksheets("Documents")
    Set dst = ThisWorkbook.Worksheets("Archive")
    lastSrc = src.Cells(src.Rows.Count, "A").End(xlUp).Row
    lastDst = dst.Cells(dst.Rows.Count, "A").End(xlUp).Row
    For r = lastSrc To 2 Step -1
        If LCase$(Trim$(CStr(src.Cells(r, 7).Value))) = "archived" Then
            lastDst = lastDst + 1
            dst.Cells(lastDst, 1).Value = "ARC-" & Format$(lastDst, "0000")
            dst.Cells(lastDst, 2).Value = "Documents"
            dst.Cells(lastDst, 3).Value = src.Cells(r, 1).Value
            dst.Cells(lastDst, 4).Value = src.Cells(r, 3).Value
            dst.Cells(lastDst, 5).Value = Format$(Now, "yyyy-mm-dd")
            dst.Cells(lastDst, 6).Value = "Archive/" & Format$(Date, "yyyy/mm/")
            dst.Cells(lastDst, 7).Value = CStr(src.Cells(r, 2).Value)
            src.Cells(r, 9).Value = dst.Cells(lastDst, 6).Value
            i = i + 1
        End If
    Next r
    MsgBox i & " sənəd arxivə yazıldı.", vbInformation, "NEXORA"
End Sub
