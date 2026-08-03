'use strict';

/**
 * SpreadsheetML (.xls) builder — opens cleanly in Excel / LibreOffice
 * with a styled header row and typed cells.
 */

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value, type) {
  if (value == null || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (type === 'Number' || (type == null && typeof value === 'number' && Number.isFinite(value))) {
    return '<Cell><Data ss:Type="Number">' + Number(value) + '</Data></Cell>';
  }
  return '<Cell><Data ss:Type="String">' + xmlEscape(value) + '</Data></Cell>';
}

function buildWorkbook(sheets) {
  const sheetXml = (sheets || []).map((sheet) => {
    const rows = sheet.rows || [];
    const colCount = Math.max(1, ...(rows.map((r) => r.length)));
    const cols = [];
    for (let i = 0; i < colCount; i++) {
      cols.push('<Column ss:AutoFitWidth="1" ss:Width="' + (sheet.widths && sheet.widths[i] ? sheet.widths[i] : 100) + '"/>');
    }
    const rowXml = rows.map((row, ri) => {
      const style = ri === 0 ? ' ss:StyleID="sHeader"' : '';
      return '<Row' + style + '>' + row.map((c) => {
        if (c && typeof c === 'object' && 'v' in c) return cellXml(c.v, c.t);
        return cellXml(c);
      }).join('') + '</Row>';
    }).join('\n');
    return (
      '<Worksheet ss:Name="' + xmlEscape(sheet.name || 'Sheet1') + '">' +
      '<Table>' + cols.join('') + rowXml + '</Table>' +
      '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
      '<Selected/><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>' +
      '<TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>' +
      '</Worksheet>'
    );
  }).join('\n');

  const xml =
    '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
    ' xmlns:o="urn:schemas-microsoft-com:office:office"\n' +
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n' +
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n' +
    ' xmlns:html="http://www.w3.org/TR/REC-html40">\n' +
    '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">' +
    '<Title>NEXORA B2B Export</Title><Author>NEXORA</Author></DocumentProperties>\n' +
    '<Styles>' +
    '<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11"/></Style>' +
    '<Style ss:ID="sHeader"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>' +
    '<Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>' +
    '</Styles>\n' +
    sheetXml +
    '\n</Workbook>';

  return Buffer.from(xml, 'utf8');
}

function buildCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.map(esc).join(',')].concat(
    (rows || []).map((r) => r.map(esc).join(','))
  );
  // UTF-8 BOM so Excel detects encoding
  return Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf8');
}

module.exports = { buildWorkbook, buildCsv, xmlEscape };
