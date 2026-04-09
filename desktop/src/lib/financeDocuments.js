export function parseFinanceMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatCurrency(value) {
  return `₺${parseFinanceMoney(value).toLocaleString('tr-TR')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function downloadBlob(filename, content, type = 'text/plain;charset=utf-8') {
  const needsBom = /charset=utf-8/i.test(type) || /csv/i.test(type);
  const payload = needsBom ? ['\uFEFF', content] : [content];
  const blob = new Blob(payload, { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvRows(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8');
}

export function buildFinanceDocumentHtml({
  title,
  subtitle,
  code,
  accent = '#0f4c81',
  badge,
  summary = [],
  sections = [],
  footerNote,
}) {
  const summaryHtml = summary.map((item) => `
    <div class="summary-card">
      <div class="summary-label">${escapeHtml(item.label)}</div>
      <div class="summary-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  const sectionHtml = sections.map((section) => `
    <section class="section">
      <div class="section-head">
        <h3>${escapeHtml(section.title)}</h3>
        ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ''}
      </div>
      ${section.rows ? `
        <div class="rows">
          ${section.rows.map((row) => `
            <div class="row">
              <span class="row-label">${escapeHtml(row.label)}</span>
              <span class="row-value">${escapeHtml(row.value)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${section.table ? `
        <table>
          <thead>
            <tr>${section.table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${section.table.rows.map((row) => `
              <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </section>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            --accent: ${accent};
            --accent-soft: color-mix(in srgb, ${accent} 14%, white);
            --ink: #0f172a;
            --muted: #5b6475;
            --line: #d9e2ec;
            --panel: #ffffff;
            --surface: #f5f7fb;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 32px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: var(--ink);
            background:
              radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 10%, white), transparent 24%),
              linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%);
          }
          .sheet {
            max-width: 980px;
            margin: 0 auto;
            background: var(--panel);
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 26px 80px rgba(15, 23, 42, 0.12);
          }
          .hero {
            padding: 32px 36px;
            color: white;
            background:
              linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 65%, black) 100%);
          }
          .hero-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
          }
          .eyebrow {
            font-size: 12px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            opacity: 0.78;
          }
          h1 {
            margin: 10px 0 8px;
            font-size: 32px;
            line-height: 1.1;
          }
          .subtitle {
            margin: 0;
            font-size: 15px;
            max-width: 540px;
            opacity: 0.9;
          }
          .meta {
            min-width: 220px;
            padding: 18px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(10px);
          }
          .meta-code { font-size: 13px; opacity: 0.82; }
          .meta-value { margin-top: 8px; font-size: 24px; font-weight: 700; }
          .badge {
            display: inline-flex;
            margin-top: 12px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.16);
            font-size: 12px;
            font-weight: 600;
          }
          .body {
            padding: 28px 32px 36px;
            background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, #ffffff 100%);
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px;
            margin-bottom: 24px;
          }
          .summary-card {
            padding: 16px 18px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: var(--surface);
          }
          .summary-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
          }
          .summary-value {
            margin-top: 8px;
            font-size: 22px;
            font-weight: 700;
          }
          .section {
            margin-top: 18px;
            padding: 22px;
            border: 1px solid var(--line);
            border-radius: 24px;
            background: white;
          }
          .section-head h3 {
            margin: 0;
            font-size: 18px;
          }
          .section-head p {
            margin: 6px 0 0;
            color: var(--muted);
            font-size: 13px;
          }
          .rows { margin-top: 14px; display: grid; gap: 10px; }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            padding: 10px 0;
            border-bottom: 1px solid var(--line);
          }
          .row:last-child { border-bottom: 0; }
          .row-label { color: var(--muted); }
          .row-value { font-weight: 600; text-align: right; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            overflow: hidden;
            border-radius: 16px;
          }
          th, td {
            padding: 12px 14px;
            font-size: 13px;
            text-align: left;
            border-bottom: 1px solid var(--line);
          }
          th {
            background: var(--surface);
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            font-size: 11px;
          }
          .footer {
            margin-top: 22px;
            padding-top: 18px;
            border-top: 1px dashed var(--line);
            color: var(--muted);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }
          @media print {
            body { padding: 0; background: white; }
            .sheet { box-shadow: none; border: 0; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <header class="hero">
            <div class="hero-top">
              <div>
                <div class="eyebrow">CourseIntellect Finance</div>
                <h1>${escapeHtml(title)}</h1>
                <p class="subtitle">${escapeHtml(subtitle || '')}</p>
                ${badge ? `<div class="badge">${escapeHtml(badge)}</div>` : ''}
              </div>
              <div class="meta">
                <div class="meta-code">Belge No</div>
                <div class="meta-value">${escapeHtml(code || 'CI-FIN')}</div>
              </div>
            </div>
          </header>
          <main class="body">
            <div class="summary-grid">${summaryHtml}</div>
            ${sectionHtml}
            <div class="footer">
              <span>${escapeHtml(footerNote || 'Bu belge CourseIntellect masaüstü panelinden oluşturuldu.')}</span>
              <span>${escapeHtml(new Date().toLocaleString('tr-TR'))}</span>
            </div>
          </main>
        </div>
      </body>
    </html>
  `;
}

export function downloadFinanceHtml(filename, html) {
  downloadBlob(filename, html, 'text/html;charset=utf-8');
}

export function printFinanceHtml(title, html) {
  const printWindow = window.open('', '_blank', 'width=1140,height=900');
  if (!printWindow) {
    downloadFinanceHtml(`${title}.html`, html);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 120);
}
