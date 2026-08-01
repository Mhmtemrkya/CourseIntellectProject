import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getBrandAccentHex } from './financeDocuments';

// Sınav sonuç raporu (A4). Sınav kâğıdı üreticisiyle (examPaperPdf.js) aynı
// yöntem: ekran dışında gerçek HTML sayfa kurulur, html2canvas ile görüntülenir
// ve jsPDF'e basılır. Böylece Türkçe karakterler ve marka rengi bozulmaz.
const PAGE_W = 794; // A4 @96dpi
const PAGE_H = 1123;
const ROWS_FIRST_PAGE = 18;
const ROWS_PER_PAGE = 26;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function scoreColor(score) {
  if (score >= 85) return '#16A34A';
  if (score >= 70) return '#2563EB';
  if (score >= 50) return '#D97706';
  return '#DC2626';
}

function pageShell(inner, { pageNo, pageCount, institutionName }) {
  return `
    <div style="width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;color:#0F172A;
                font-family:'Inter','Helvetica Neue',Arial,sans-serif;position:relative;
                padding:40px 44px 64px;box-sizing:border-box;">
      ${inner}
      <div style="position:absolute;left:44px;right:44px;bottom:26px;display:flex;
                  justify-content:space-between;font-size:10px;color:#94A3B8;
                  border-top:1px solid #E2E8F0;padding-top:10px;">
        <span>${escapeHtml(institutionName)}</span>
        <span>Sayfa ${pageNo} / ${pageCount}</span>
      </div>
    </div>`;
}

function headerBlock(exam, institution, accent) {
  const meta = [
    ['Ders', exam.subject],
    ['Sınıf', exam.className],
    ['Tür', exam.type],
    ['Tarih', [exam.dateLabel, exam.startTime].filter(Boolean).join(' ')],
    ['Süre', exam.duration],
    ['Soru', exam.questionCount ? `${exam.questionCount} soru` : '—'],
  ].filter(([, value]) => value);

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div>
        <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${accent};font-weight:800;">
          Sınav Sonuç Raporu
        </p>
        <h1 style="margin:6px 0 0;font-size:26px;font-weight:900;line-height:1.2;">${escapeHtml(exam.title)}</h1>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569;line-height:1.6;">
        <div style="font-size:14px;font-weight:800;color:#0F172A;">${escapeHtml(institution.name)}</div>
        ${institution.address ? `<div>${escapeHtml(institution.address)}</div>` : ''}
        ${institution.phone ? `<div>${escapeHtml(institution.phone)}</div>` : ''}
        <div>${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>

    <div style="margin-top:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${meta.map(([label, value]) => `
        <div style="border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px;background:#F8FAFC;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#94A3B8;font-weight:700;">${escapeHtml(label)}</div>
          <div style="font-size:13px;font-weight:700;margin-top:3px;">${escapeHtml(value)}</div>
        </div>`).join('')}
    </div>`;
}

function statsBlock(stats, accent) {
  const cards = [
    ['Katılım', `${stats.count} öğrenci`],
    ['Ortalama', `${stats.average}`],
    ['En Yüksek', `${stats.highest}`],
    ['En Düşük', `${stats.lowest}`],
    ['Geçen (≥50)', `${stats.passed}`],
    ['Kalan (<50)', `${stats.failed}`],
  ];
  return `
    <div style="margin-top:18px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">
      ${cards.map(([label, value]) => `
        <div style="border:1px solid ${accent}22;border-radius:12px;padding:10px 8px;background:${accent}0A;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#64748B;font-weight:700;">${escapeHtml(label)}</div>
          <div style="font-size:17px;font-weight:900;margin-top:2px;color:${accent};">${escapeHtml(value)}</div>
        </div>`).join('')}
    </div>

    <div style="margin-top:16px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:#64748B;margin-bottom:8px;">Puan Dağılımı</div>
      <div style="display:flex;gap:8px;">
        ${stats.distribution.map((bucket) => `
          <div style="flex:1;border:1px solid #E2E8F0;border-radius:10px;padding:8px;text-align:center;background:#fff;">
            <div style="height:44px;display:flex;align-items:flex-end;justify-content:center;">
              <div style="width:60%;height:${Math.max(4, Math.round((bucket.count / Math.max(1, stats.count)) * 44))}px;
                          background:${bucket.color};border-radius:4px 4px 0 0;"></div>
            </div>
            <div style="font-size:11px;font-weight:800;margin-top:6px;">${bucket.count}</div>
            <div style="font-size:9px;color:#94A3B8;">${escapeHtml(bucket.label)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function tableBlock(rows, startIndex) {
  return `
    <div style="margin-top:18px;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:36px 1fr 110px 90px 80px;background:#F1F5F9;
                  font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#64748B;font-weight:800;
                  padding:9px 12px;gap:8px;">
        <span>#</span><span>Öğrenci</span><span>Sınıf</span><span style="text-align:right;">Net</span><span style="text-align:right;">Puan</span>
      </div>
      ${rows.map((row, index) => `
        <div style="display:grid;grid-template-columns:36px 1fr 110px 90px 80px;gap:8px;padding:9px 12px;
                    font-size:12px;border-top:1px solid #EEF2F7;${index % 2 ? 'background:#FAFBFD;' : ''}">
          <span style="color:#94A3B8;font-weight:700;">${startIndex + index + 1}</span>
          <span style="font-weight:700;">${escapeHtml(row.studentName)}</span>
          <span style="color:#64748B;">${escapeHtml(row.className || '—')}</span>
          <span style="text-align:right;color:#475569;">${escapeHtml(row.net ?? '—')}</span>
          <span style="text-align:right;font-weight:900;color:${scoreColor(Number(row.score) || 0)};">${escapeHtml(row.score)}</span>
        </div>`).join('')}
    </div>`;
}

export function computeExamStats(rows) {
  const scores = rows.map((row) => Number(row.score) || 0);
  const count = scores.length;
  const average = count ? Math.round((scores.reduce((sum, value) => sum + value, 0) / count) * 10) / 10 : 0;
  const buckets = [
    { label: '0-49', color: '#DC2626', min: 0, max: 49 },
    { label: '50-69', color: '#D97706', min: 50, max: 69 },
    { label: '70-84', color: '#2563EB', min: 70, max: 84 },
    { label: '85-100', color: '#16A34A', min: 85, max: 100 },
  ];
  return {
    count,
    average,
    highest: count ? Math.max(...scores) : 0,
    lowest: count ? Math.min(...scores) : 0,
    passed: scores.filter((value) => value >= 50).length,
    failed: scores.filter((value) => value < 50).length,
    distribution: buckets.map((bucket) => ({
      ...bucket,
      count: scores.filter((value) => value >= bucket.min && value <= bucket.max).length,
    })),
  };
}

function sanitizeFileName(value) {
  return String(value || 'sinav-raporu')
    .replace(/[^\w\-ğüşöçıİĞÜŞÖÇ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

/**
 * Sınav sonuç raporunu PDF blob'u olarak üretir.
 * @param {object} exam sınav künyesi (title, subject, className, type, dateLabel, ...)
 * @param {Array} rows sonuç satırları ({ studentName, className, score, net })
 * @param {object} institution belge künyesi (name, address, phone)
 */
export async function generateExamReportBlob(exam, rows, institution = {}) {
  const accent = getBrandAccentHex('#2563EB');
  const stats = computeExamStats(rows);
  const meta = {
    name: institution.name || institution.institutionName || 'Kurum',
    address: institution.address || '',
    phone: institution.phone || '',
  };

  const sorted = [...rows].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const chunks = [];
  chunks.push(sorted.slice(0, ROWS_FIRST_PAGE));
  for (let index = ROWS_FIRST_PAGE; index < sorted.length; index += ROWS_PER_PAGE) {
    chunks.push(sorted.slice(index, index + ROWS_PER_PAGE));
  }

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff;';
  document.body.appendChild(host);

  try {
    const pageCount = chunks.length;
    host.innerHTML = chunks.map((chunk, index) => pageShell(
      index === 0
        ? `${headerBlock(exam, meta, accent)}${statsBlock(stats, accent)}${chunk.length ? tableBlock(chunk, 0) : '<p style="margin-top:24px;color:#94A3B8;font-size:12px;">Bu sınav için henüz sonuç girilmemiş.</p>'}`
        : tableBlock(chunk, ROWS_FIRST_PAGE + (index - 1) * ROWS_PER_PAGE),
      { pageNo: index + 1, pageCount, institutionName: meta.name },
    )).join('');

    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* font yoksa devam */ }
    }

    const pdf = new jsPDF({ unit: 'px', format: [PAGE_W, PAGE_H], orientation: 'portrait', compress: true });
    const pages = Array.from(host.children);
    for (let index = 0; index < pages.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      if (index > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_W, PAGE_H);
    }
    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}

export async function downloadExamReportPdf(exam, rows, institution) {
  const blob = await generateExamReportBlob(exam, rows, institution);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileName(exam?.title)}-sonuc-raporu.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
