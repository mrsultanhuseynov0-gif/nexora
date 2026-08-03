'use strict';

/**
 * Professional multi-page A4 PDF builder (Helvetica + vector graphics).
 * Azerbaijani letters are transliterated for Type1 Helvetica.
 */

function escapePdfText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function translitAz(s) {
  const map = {
    ə: 'e', Ə: 'E', ı: 'i', İ: 'I', ğ: 'g', Ğ: 'G',
    ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ş: 'sh', Ş: 'Sh',
    ç: 'ch', Ç: 'Ch'
  };
  return String(s == null ? '' : s).replace(/[əƏıİğĞöÖüÜşŞçÇ]/g, (c) => map[c] || c);
}

function t(s) {
  return escapePdfText(translitAz(s));
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0.00';
  return v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function clip(s, n) {
  const str = String(s == null ? '' : s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 40;
const MARGIN_BOTTOM = 56;
const CONTENT_TOP = 760;

function rgb(r, g, b) {
  return (r / 255).toFixed(3) + ' ' + (g / 255).toFixed(3) + ' ' + (b / 255).toFixed(3);
}

const C = {
  navy: rgb(15, 23, 42),
  brand: rgb(14, 116, 144),
  brandDark: rgb(8, 51, 68),
  muted: rgb(100, 116, 139),
  line: rgb(203, 213, 225),
  soft: rgb(241, 245, 249),
  white: '1 1 1',
  ink: rgb(30, 41, 59),
  ok: rgb(22, 163, 74),
  warn: rgb(217, 119, 6)
};

function buildPdfFromPages(pageStreams) {
  const objs = [];
  const pageCount = pageStreams.length;
  const kids = [];
  for (let i = 0; i < pageCount; i++) kids.push((4 + i * 2) + ' 0 R');

  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objs.push('2 0 obj<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pageCount + ' >>endobj\n');
  objs.push('3 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  objs.push('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n');

  // Shift: fonts are 3,4 — pages start at 5
  // Recalculate: Catalog 1, Pages 2, F1 3, F2 4, then for each page: Page N, Content N+1
  const rebuilt = [];
  rebuilt.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  const pageRefs = [];
  for (let i = 0; i < pageCount; i++) pageRefs.push((5 + i * 2) + ' 0 R');
  rebuilt.push('2 0 obj<< /Type /Pages /Kids [' + pageRefs.join(' ') + '] /Count ' + pageCount + ' >>endobj\n');
  rebuilt.push('3 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  rebuilt.push('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n');

  pageStreams.forEach((stream, i) => {
    const pageObj = 5 + i * 2;
    const contentObj = pageObj + 1;
    rebuilt.push(
      pageObj + ' 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H +
      '] /Contents ' + contentObj + ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>endobj\n'
    );
    rebuilt.push(
      contentObj + ' 0 obj<< /Length ' + Buffer.byteLength(stream, 'utf8') +
      ' >>stream\n' + stream + '\nendstream\nendobj\n'
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  rebuilt.forEach((o) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += o;
  });
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n0 ' + (rebuilt.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= rebuilt.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer<< /Size ' + (rebuilt.length + 1) + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xrefPos + '\n%%EOF\n';
  return Buffer.from(pdf, 'utf8');
}

class DocBuilder {
  constructor(meta) {
    this.meta = meta || {};
    this.pages = [];
    this.ops = [];
    this.y = CONTENT_TOP;
    this.pageNo = 1;
    this._beginPage();
  }

  _beginPage() {
    this.ops = [];
    this.y = CONTENT_TOP;
    this._drawChrome();
  }

  _drawChrome() {
    const title = this.meta.docTitle || 'NEXORA Document';
    const subtitle = this.meta.docSubtitle || 'B2B';
    const docNo = this.meta.docNo || '';
    // Header band
    this.ops.push('q', C.brandDark + ' rg', '0 792 595 50 re', 'f');
    this.ops.push(C.brand + ' rg', '0 788 595 4 re', 'f');
    this.ops.push('BT', '/F2 18 Tf', C.white + ' rg', '40 812 Td', '(NEXORA) Tj', 'ET');
    this.ops.push('BT', '/F1 9 Tf', C.white + ' rg', '120 814 Td', '(' + t(subtitle) + ') Tj', 'ET');
    this.ops.push('BT', '/F2 11 Tf', C.white + ' rg',
      (PAGE_W - 40 - Math.min(220, title.length * 5.5)).toFixed(1) + ' 814 Td',
      '(' + t(clip(title, 36)) + ') Tj', 'ET');
    // Meta strip
    this.ops.push(C.soft + ' rg', '40 768 515 18 re', 'f');
    this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', '48 774 Td',
      '(' + t('Sened No: ' + docNo + '   |   Tarix: ' + (this.meta.date || '') +
        '   |   Status: ' + (this.meta.status || 'draft')) + ') Tj', 'ET');
    this.y = 752;
  }

  _ensure(space) {
    if (this.y - space < MARGIN_BOTTOM + 24) {
      this._endPage();
      this.pageNo += 1;
      this._beginPage();
    }
  }

  _endPage() {
    // Footer
    this.ops.push(C.line + ' RG', '0.5 w', '40 42 m', '555 42 l', 'S');
    this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', '40 28 Td',
      '(' + t('NEXORA MMC  ·  Baki  ·  b2b@nexora.az  ·  +994 12 555 00 00') + ') Tj', 'ET');
    this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', '500 28 Td',
      '(Sehife ' + this.pageNo + ') Tj', 'ET');
    this.pages.push(this.ops.join('\n'));
  }

  h1(text) {
    this._ensure(28);
    this.ops.push('BT', '/F2 14 Tf', C.navy + ' rg', MARGIN_X + ' ' + this.y + ' Td',
      '(' + t(text) + ') Tj', 'ET');
    this.y -= 8;
    this.ops.push(C.brand + ' rg', MARGIN_X + ' ' + this.y + ' 80 2.5 re', 'f');
    this.y -= 18;
  }

  h2(text) {
    this._ensure(22);
    this.ops.push('BT', '/F2 11 Tf', C.brandDark + ' rg', MARGIN_X + ' ' + this.y + ' Td',
      '(' + t(text) + ') Tj', 'ET');
    this.y -= 16;
  }

  p(text, opts) {
    opts = opts || {};
    const size = opts.size || 9;
    const color = opts.color || C.ink;
    const font = opts.bold ? '/F2' : '/F1';
    const max = opts.maxWidth || 90;
    const words = String(text == null ? '' : text).split(/\s+/);
    let line = '';
    const flush = (s) => {
      if (!s) return;
      this._ensure(size + 4);
      this.ops.push('BT', font + ' ' + size + ' Tf', color + ' rg',
        MARGIN_X + ' ' + this.y + ' Td', '(' + t(s) + ') Tj', 'ET');
      this.y -= size + 4;
    };
    words.forEach((w) => {
      const next = line ? line + ' ' + w : w;
      if (next.length > max) {
        flush(line);
        line = w;
      } else line = next;
    });
    flush(line);
  }

  kvGrid(pairs) {
    this._ensure(pairs.length * 14 + 10);
    const colW = 257;
    pairs.forEach((pair, idx) => {
      const col = idx % 2;
      if (col === 0 && idx > 0) this.y -= 14;
      const x = MARGIN_X + col * colW;
      this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', x + ' ' + this.y + ' Td',
        '(' + t(pair[0]) + ') Tj', 'ET');
      this.ops.push('BT', '/F2 9 Tf', C.ink + ' rg', x + ' ' + (this.y - 11) + ' Td',
        '(' + t(clip(pair[1], 42)) + ') Tj', 'ET');
      if (col === 1) this.y -= 14;
    });
    if (pairs.length % 2 === 1) this.y -= 14;
    this.y -= 16;
  }

  infoBox(lines) {
    const h = 12 + lines.length * 12;
    this._ensure(h + 8);
    this.ops.push(C.soft + ' rg', MARGIN_X + ' ' + (this.y - h + 8) + ' 515 ' + h + ' re', 'f');
    this.ops.push(C.brand + ' rg', MARGIN_X + ' ' + (this.y - h + 8) + ' 3 ' + h + ' re', 'f');
    let yy = this.y - 4;
    lines.forEach((line) => {
      this.ops.push('BT', '/F1 9 Tf', C.ink + ' rg', (MARGIN_X + 12) + ' ' + yy + ' Td',
        '(' + t(line) + ') Tj', 'ET');
      yy -= 12;
    });
    this.y -= h + 12;
  }

  table(headers, rows, widths) {
    const totalW = widths.reduce((a, b) => a + b, 0);
    const rowH = 16;
    const headH = 18;

    const drawHeader = () => {
      this._ensure(headH + 8);
      this.ops.push(C.brandDark + ' rg', MARGIN_X + ' ' + (this.y - headH + 4) + ' ' + totalW + ' ' + headH + ' re', 'f');
      let x = MARGIN_X + 4;
      headers.forEach((h, i) => {
        this.ops.push('BT', '/F2 8 Tf', C.white + ' rg', x + ' ' + (this.y - 8) + ' Td',
          '(' + t(h) + ') Tj', 'ET');
        x += widths[i];
      });
      this.y -= headH + 2;
    };

    drawHeader();
    rows.forEach((row, ri) => {
      if (this.y - rowH < MARGIN_BOTTOM + 24) {
        this._endPage();
        this.pageNo += 1;
        this._beginPage();
        drawHeader();
      }
      if (ri % 2 === 0) {
        this.ops.push(C.soft + ' rg', MARGIN_X + ' ' + (this.y - rowH + 4) + ' ' + totalW + ' ' + rowH + ' re', 'f');
      }
      let x = MARGIN_X + 4;
      row.forEach((cell, i) => {
        const alignRight = i === row.length - 1 || i === row.length - 2;
        const txt = t(clip(cell, Math.floor(widths[i] / 5.2)));
        if (alignRight) {
          const approx = txt.length * 4.2;
          this.ops.push('BT', '/F1 8 Tf', C.ink + ' rg',
            (x + widths[i] - approx - 8) + ' ' + (this.y - 8) + ' Td', '(' + txt + ') Tj', 'ET');
        } else {
          this.ops.push('BT', '/F1 8 Tf', C.ink + ' rg', x + ' ' + (this.y - 8) + ' Td',
            '(' + txt + ') Tj', 'ET');
        }
        x += widths[i];
      });
      this.y -= rowH;
    });
    this.ops.push(C.line + ' RG', '0.4 w',
      MARGIN_X + ' ' + this.y + ' m', (MARGIN_X + totalW) + ' ' + this.y + ' l', 'S');
    this.y -= 14;
  }

  totalsBox(rows, grand) {
    const boxW = 220;
    const x0 = PAGE_W - MARGIN_X - boxW;
    const h = 16 + rows.length * 14 + 22;
    this._ensure(h + 8);
    this.ops.push(C.soft + ' rg', x0 + ' ' + (this.y - h + 8) + ' ' + boxW + ' ' + h + ' re', 'f');
    this.ops.push(C.line + ' RG', '0.6 w', x0 + ' ' + (this.y - h + 8) + ' ' + boxW + ' ' + h + ' re', 'S');
    let yy = this.y - 6;
    rows.forEach((r) => {
      this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', (x0 + 10) + ' ' + yy + ' Td',
        '(' + t(r[0]) + ') Tj', 'ET');
      this.ops.push('BT', '/F2 8 Tf', C.ink + ' rg', (x0 + boxW - 70) + ' ' + yy + ' Td',
        '(' + t(r[1]) + ') Tj', 'ET');
      yy -= 14;
    });
    this.ops.push(C.brand + ' rg', x0 + ' ' + (yy - 10) + ' ' + boxW + ' 20 re', 'f');
    this.ops.push('BT', '/F2 10 Tf', C.white + ' rg', (x0 + 10) + ' ' + (yy - 4) + ' Td',
      '(' + t('YEKUN') + ') Tj', 'ET');
    this.ops.push('BT', '/F2 10 Tf', C.white + ' rg', (x0 + boxW - 80) + ' ' + (yy - 4) + ' Td',
      '(' + t(grand) + ') Tj', 'ET');
    this.y -= h + 16;
  }

  terms(list) {
    this.h2('Serhler ve sertler');
    (list || []).forEach((term, i) => {
      this.p((i + 1) + '. ' + term, { size: 8, maxWidth: 95 });
    });
  }

  signatures(leftLabel, rightLabel) {
    this._ensure(90);
    this.y -= 8;
    this.h2('Imzalar');
    const yLine = this.y - 40;
    this.ops.push(C.line + ' RG', '0.8 w',
      '60 ' + yLine + ' m', '250 ' + yLine + ' l', 'S',
      '340 ' + yLine + ' m', '530 ' + yLine + ' l', 'S');
    this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', '60 ' + (yLine - 14) + ' Td',
      '(' + t(leftLabel || 'Satici / NEXORA') + ') Tj', 'ET');
    this.ops.push('BT', '/F1 8 Tf', C.muted + ' rg', '340 ' + (yLine - 14) + ' Td',
      '(' + t(rightLabel || 'Alici') + ') Tj', 'ET');
    this.ops.push('BT', '/F1 7 Tf', C.muted + ' rg', '60 ' + (yLine - 28) + ' Td',
      '(Ad, vezife, tarix, movhur) Tj', 'ET');
    this.ops.push('BT', '/F1 7 Tf', C.muted + ' rg', '340 ' + (yLine - 28) + ' Td',
      '(Ad, vezife, tarix, movhur) Tj', 'ET');
    this.y = yLine - 40;
  }

  finish() {
    this._endPage();
    return buildPdfFromPages(this.pages);
  }
}

function buildQuoteDocument(quote, profile, user) {
  const totals = quote.totals || {};
  const title = String(quote.title || 'Qiymət təklifi').slice(0, 80);
  const doc = new DocBuilder({
    docTitle: title,
    docSubtitle: 'B2B Price Offer / Qiymet teklifi',
    docNo: quote.id,
    date: String(quote.createdAt || '').slice(0, 10),
    status: quote.status || 'draft'
  });

  doc.h1(title);
  doc.infoBox([
    'Bu sened NEXORA terefinden hazirlanmis resmi qiymet teklifidir.',
    'Kecerlilik muddeti: ' + String(quote.validUntil || '').slice(0, 10) + ' — muddet bitdikden sonra qiymetler yenilene biler.',
    'Yuklenen fayl: PDF  ·  Teklif ID: ' + quote.id + '  ·  Sirket: ' + (profile.companyName || '')
  ]);

  doc.h2('Alici melumatlari');
  doc.kvGrid([
    ['Sirket', profile.companyName || '—'],
    ['VOEN', profile.voen || '—'],
    ['Elaqe sexsi', profile.contactPerson || user.name || '—'],
    ['Telefon', profile.contactPhone || '—'],
    ['E-poct', profile.contactEmail || user.email || '—'],
    ['Huquqi unvan', profile.legalAddress || '—']
  ]);

  doc.h2('Mehsul cedveli');
  const rows = (quote.items || []).map((it, i) => [
    String(i + 1),
    clip(it.sku || it.productId || '—', 14),
    clip(it.name || '—', 38),
    String(it.qty),
    money(it.unitPrice) + ' AZN',
    money(it.lineTotal) + ' AZN'
  ]);
  doc.table(
    ['#', 'SKU', 'Mehsul', 'Eded', 'Qiymet', 'Cem'],
    rows,
    [22, 70, 180, 40, 90, 90]
  );

  doc.totalsBox([
    ['Ara cem', money(totals.subtotal) + ' AZN'],
    ['B2B endirim (' + (totals.discountPercent || 0) + '%)', '-' + money(totals.discount) + ' AZN'],
    ['EDV 18%', money(totals.tax) + ' AZN'],
    ['Catdirilma', money(totals.shipping || 0) + ' AZN']
  ], money(totals.total) + ' AZN');

  if (quote.notes) {
    doc.h2('Qeyd');
    doc.p(quote.notes, { size: 9 });
  }

  doc.terms([
    'Teklif ' + String(quote.validUntil || '').slice(0, 10) + ' tarixine qeder kecerlidir.',
    'B2B endirim ara cem >= 200 AZN olduqda tetbiq olunur.',
    'Odeme: bank kocurmesi ve ya razilasma ile.',
    'Stok ve catdirilma muddeti sifaris tesdiqinden sonra deqiqlestirilir.',
    'Suallar ucun: b2b@nexora.az'
  ]);
  doc.signatures('NEXORA MMC', profile.companyName || 'Alici');
  return doc.finish();
}

function buildContractDocument(contract, profile, user) {
  const body = contract.body || {};
  const totals = body.totals || {};
  const doc = new DocBuilder({
    docTitle: 'Tedaruk muqavilesi',
    docSubtitle: 'B2B Supply Contract',
    docNo: contract.id,
    date: String(contract.createdAt || '').slice(0, 10),
    status: contract.status || 'draft'
  });

  doc.h1('Tedaruk muqavilesi');
  doc.infoBox([
    'Muqavile No: ' + contract.id + (contract.quoteId ? '  ·  Elaqeli teklif: ' + contract.quoteId : ''),
    'Bu PDF yuklendikde Alici sirketin resmi sened arxivine elave edilmelidir.',
    'Status: ' + (contract.status || 'draft').toUpperCase() + ' — imza tamamlanana qeder "draft" qalir.'
  ]);

  doc.h2('1. Terefler');
  doc.kvGrid([
    ['Satici', 'NEXORA MMC'],
    ['Alici', profile.companyName || '—'],
    ['Satici VOEN', '1400000001'],
    ['Alici VOEN', profile.voen || '—'],
    ['Satici unvan', 'Baki sh., Nesimi r., 28 May 15'],
    ['Alici unvan', profile.legalAddress || '—'],
    ['Satici elaqe', 'b2b@nexora.az / +994 12 555 00 00'],
    ['Alici elaqe', (profile.contactPerson || user.name || '—') + ' / ' + (profile.contactPhone || '—')]
  ]);

  doc.h2('2. Predmet');
  doc.p('Satici asagidaki mehsullari Aliciya satmagi, Alici ise odeyib qebul etmeyi ohdeye goturur. Mehsul siyahisi ve qiymetler elaqeli teklif / bu muqavile cedveli uzre muayyen edilir.', { size: 9, maxWidth: 96 });

  if ((body.items || []).length) {
    doc.h2('3. Mehsul ve mebleg cedveli');
    const rows = body.items.map((it, i) => [
      String(i + 1),
      clip(it.sku || '—', 12),
      clip(it.name || '—', 36),
      String(it.qty),
      money(it.unitPrice) + ' AZN',
      money(it.lineTotal) + ' AZN'
    ]);
    doc.table(['#', 'SKU', 'Mehsul', 'Eded', 'Qiymet', 'Cem'], rows, [22, 70, 180, 40, 90, 90]);
    if (totals && totals.total != null) {
      doc.totalsBox([
        ['Ara cem', money(totals.subtotal) + ' AZN'],
        ['Endirim', '-' + money(totals.discount) + ' AZN'],
        ['EDV', money(totals.tax) + ' AZN']
      ], money(totals.total) + ' AZN');
    }
  } else {
    doc.p('Mehsul cedveli elave razilasma / teklif uzre teyin olunacaq.', { size: 9 });
  }

  doc.h2('4. Odeme ve catdirilma');
  doc.p('Odeme qaydasi: 50% avans, 50% teslimatda (ve ya tereflerin yazili razilasmasi ile). Catdirilma Baki daxilinde razilasdirilmis muddetde heyata kecirilir. Bank rekvizitleri: ' + (profile.bankName || 'Kapital Bank') + ' / ' + (profile.bankAccount || '—'), { size: 9, maxWidth: 96 });

  doc.h2('5. Zemanet ve mesuliyyet');
  doc.p('Mehsullara istehsalci zemaneti tetbiq olunur. Terefler Azərbaycan Respublikasi qanunvericiliyine tabedir. Mubahi se hallar danishiq yoluyla, sonra ise Baki merkezi menkemelerinde hell olunur.', { size: 9, maxWidth: 96 });

  doc.terms(body.terms && body.terms.length ? body.terms : [
    'Odeme: 50% avans, 50% teslimatda (ve ya razilasma ile).',
    'Catdirilma: Baki daxilinde razilasdirilmis vaxtda.',
    'Zemanet: mehsul uzre resmi istehsalci zemaneti.',
    'Mecelle: Azərbaycan Respublikasi qanunvericiliyi.'
  ]);

  doc.signatures('Satici: NEXORA MMC', 'Alici: ' + (profile.companyName || ''));
  return doc.finish();
}

/** Keep legacy simple API */
function buildTextPdf(lines) {
  const doc = new DocBuilder({
    docTitle: 'Sened',
    docSubtitle: 'NEXORA',
    docNo: 'DOC',
    date: new Date().toISOString().slice(0, 10),
    status: 'ok'
  });
  (lines || []).forEach((line, i) => {
    if (i === 0) doc.h1(line);
    else doc.p(line, { size: 9 });
  });
  return doc.finish();
}

module.exports = {
  buildTextPdf,
  buildQuoteDocument,
  buildContractDocument,
  translitAz,
  escapePdfText,
  money
};
