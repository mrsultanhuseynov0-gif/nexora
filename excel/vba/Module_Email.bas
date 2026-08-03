Attribute VB_Name = "Module_Email"
' NEXORA ERP — Email Center: müştəri seçimi, mailto, Outlook COM
' Tələb: Microsoft Outlook quraşdırılıbsa CreateItem işləyir; əks halda mailto.

Option Explicit

Public Sub FillEmailFromCustomerPicker()
    Dim ws As Worksheet, custId As String, r As Long, lastRow As Long
    Set ws = ThisWorkbook.Worksheets("Email Center")
    custId = Trim$(CStr(ws.Range("G8").Value))
    If custId = "" Then
        MsgBox "G8 xanasında müştəri id seçin.", vbExclamation, "NEXORA"
        Exit Sub
    End If
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    r = lastRow + 1
    If r < 2 Then r = 2
    ws.Cells(r, 1).Value = NextEmailNo()
    ws.Cells(r, 2).Value = "order-confirm"
    ws.Cells(r, 3).Value = custId
    ws.Cells(r, 4).Value = ws.Range("G9").Value
    ws.Cells(r, 5).Value = ws.Range("G10").Value
    ws.Cells(r, 6).Value = "NEXORA - Mesaj"
    ws.Cells(r, 7).Value = "draft"
    ws.Cells(r, 8).Value = Format$(Date, "yyyy-mm-dd")
    ws.Cells(r, 10).Formula = "=HYPERLINK(""mailto:""&E" & r & "&""?subject=""&F" & r & ",""mailto ac"")"
    MsgBox "Yeni email sətri yaradıldı: " & ws.Cells(r, 1).Value, vbInformation, "NEXORA"
End Sub

Public Function NextEmailNo() As String
    Dim ws As Worksheet, lastRow As Long, maxN As Long, r As Long, v As String, n As Long
    Set ws = ThisWorkbook.Worksheets("Email Center")
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    maxN = 0
    For r = 2 To lastRow
        v = CStr(ws.Cells(r, 1).Value)
        On Error Resume Next
        n = CLng(Val(Right$(v, 4)))
        On Error GoTo 0
        If n > maxN Then maxN = n
    Next r
    NextEmailNo = "EM-" & Format$(Year(Date), "0000") & "-" & Format$(maxN + 1, "0000")
End Function

' Aktiv sətirdəki email-i Outlook ilə açır (HTML body üçün şablon yolunu göstərin)
Public Sub OpenOutlookDraftFromRow()
    Dim ws As Worksheet, r As Long
    Dim toAddr As String, subj As String, body As String
    Dim olApp As Object, olMail As Object
    Set ws = ThisWorkbook.Worksheets("Email Center")
    r = ActiveCell.Row
    If r < 2 Then Exit Sub
    toAddr = Trim$(CStr(ws.Cells(r, 5).Value))
    subj = Trim$(CStr(ws.Cells(r, 6).Value))
    body = "Salam " & Trim$(CStr(ws.Cells(r, 4).Value)) & "," & vbCrLf & vbCrLf & _
           "Sablon: " & Trim$(CStr(ws.Cells(r, 2).Value)) & vbCrLf & _
           "Tam HTML: excel/templates/email/ qovluğundan yapışdırın." & vbCrLf & vbCrLf & _
           "Hormetle," & vbCrLf & "NEXORA"
    If toAddr = "" Then
        MsgBox "toEmail bosdur.", vbExclamation, "NEXORA"
        Exit Sub
    End If
    On Error GoTo MailtoFallback
    Set olApp = CreateObject("Outlook.Application")
    Set olMail = olApp.CreateItem(0) ' olMailItem
    olMail.To = toAddr
    olMail.Subject = subj
    olMail.Body = body
    olMail.Display
    ws.Cells(r, 7).Value = "queued"
    Exit Sub
MailtoFallback:
    ActiveWorkbook.FollowHyperlink "mailto:" & toAddr & "?subject=" & WorksheetFunction.EncodeURL(subj)
End Sub
