// Minimal, dependency-free PDF writer for admin data exports: a titled table on A4 landscape pages with a
// repeated header row and page numbers. Uses the standard PDF base fonts (no embedding), so the file is
// small and opens in every PDF viewer, including phones.

interface PdfColumn {
  label: string;
  align?: 'left' | 'right';
  /** Long ids (wallets, hashes) are shortened in the middle: 0x1234…abcd */
  shorten?: boolean;
}

interface PdfTableInput {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: string[][];
}

const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 32;
const CELL_PAD = 4;
const MONO_W = 0.6; // Courier glyph width, in em

/** PDF text is limited to the base font's WinAnsi set: keep plain ASCII and replace the rest. */
function pdfSafe(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/₮/g, 'T')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e]/g, '?');
}
const esc = (s: string) => pdfSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function fit(text: string, maxChars: number, shorten?: boolean): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  if (shorten && maxChars >= 9) {
    const tail = Math.floor((maxChars - 2) / 2);
    return `${text.slice(0, maxChars - 2 - tail)}..${text.slice(-tail)}`;
  }
  return text.slice(0, maxChars - 3) + '...';
}

export function buildTablePdf(input: PdfTableInput): Buffer {
  const usable = PAGE_W - MARGIN * 2;
  const cols = input.columns;
  const rows = input.rows.map((r) => r.map((c) => pdfSafe(String(c ?? ''))));

  // Natural width of each column in characters (ids capped; they are shortened in the middle)
  const natural = cols.map((c, i) => {
    const longest = rows.reduce((m, r) => Math.max(m, (r[i] || '').length), 0);
    const cap = c.shorten ? 16 : 34;
    return Math.max(Math.min(c.label.length, 26), Math.min(longest, cap), 3);
  });

  // Pick the largest font size (7.5 down to 5.5) at which the table fits; then narrow the widest columns
  let fs = 7.5;
  const widthAt = (size: number, chars: number[]) => chars.reduce((s, n) => s + n * MONO_W * size + CELL_PAD * 2, 0);
  while (fs > 5.5 && widthAt(fs, natural) > usable) fs -= 0.5;
  const chars = [...natural];
  while (widthAt(fs, chars) > usable) {
    const widest = chars.indexOf(Math.max(...chars));
    if (chars[widest] <= 6) break;
    chars[widest] -= 1;
  }
  // Spread spare width so the table spans the page
  const spare = usable - widthAt(fs, chars);
  const widths = chars.map((n) => n * MONO_W * fs + CELL_PAD * 2 + spare / chars.length);

  const rowH = fs * 2;
  const headH = rowH + 2;
  const titleBlock = input.subtitle ? 44 : 32;
  const footer = 22;
  const perFirst = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - titleBlock - headH - footer) / rowH));
  const perNext = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - headH - footer) / rowH));
  const pages: string[][][] = [];
  let i = 0;
  pages.push(rows.slice(0, perFirst));
  i = perFirst;
  while (i < rows.length) {
    pages.push(rows.slice(i, i + perNext));
    i += perNext;
  }

  const text = (font: string, size: number, x: number, y: number, s: string, rgb = '0 0 0') =>
    `BT ${rgb} rg /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET\n`;
  const rect = (x: number, y: number, w: number, h: number, rgb: string) =>
    `${rgb} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;

  const streams = pages.map((pageRows, p) => {
    let out = '';
    let y = PAGE_H - MARGIN;
    if (p === 0) {
      out += text('F2', 14, MARGIN, y - 14, input.title, '0.06 0.09 0.16');
      if (input.subtitle) out += text('F1', 8, MARGIN, y - 28, input.subtitle, '0.4 0.45 0.52');
      y -= titleBlock;
    }
    // Header row
    out += rect(MARGIN, y - headH, usable, headH, '0.12 0.16 0.23');
    let x = MARGIN;
    cols.forEach((c, ci) => {
      const label = fit(pdfSafe(c.label), chars[ci]);
      const tx = c.align === 'right' ? x + widths[ci] - CELL_PAD - label.length * MONO_W * fs : x + CELL_PAD;
      out += text('F4', fs, tx, y - headH + (headH - fs) / 2 + 1, label, '1 1 1');
      x += widths[ci];
    });
    y -= headH;
    // Data rows
    pageRows.forEach((r, ri) => {
      if (ri % 2 === 1) out += rect(MARGIN, y - rowH, usable, rowH, '0.95 0.96 0.97');
      let cx = MARGIN;
      cols.forEach((c, ci) => {
        const v = fit(r[ci] || '', chars[ci], c.shorten);
        const tx = c.align === 'right' ? cx + widths[ci] - CELL_PAD - v.length * MONO_W * fs : cx + CELL_PAD;
        out += text('F3', fs, tx, y - rowH + (rowH - fs) / 2 + 1, v, '0.1 0.12 0.16');
        cx += widths[ci];
      });
      y -= rowH;
    });
    if (rows.length === 0 && p === 0) {
      out += text('F1', 9, MARGIN + CELL_PAD, y - 16, 'No records.', '0.4 0.45 0.52');
    }
    out += text('F1', 7, MARGIN, MARGIN - 12, `${input.title}`, '0.5 0.55 0.6');
    const pn = `Page ${p + 1} of ${pages.length}`;
    out += text('F1', 7, PAGE_W - MARGIN - pn.length * 3.6, MARGIN - 12, pn, '0.5 0.55 0.6');
    return out;
  });

  // Objects: 1 catalog, 2 pages, 3-6 fonts, then a page + content stream per page
  const objects: string[] = [];
  const pageIds = pages.map((_, p) => 7 + p * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  objects[3] = font('Helvetica');
  objects[4] = font('Helvetica-Bold');
  objects[5] = font('Courier');
  objects[6] = font('Courier-Bold');
  streams.forEach((s, p) => {
    const pageId = pageIds[p];
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}endstream`;
  });

  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
