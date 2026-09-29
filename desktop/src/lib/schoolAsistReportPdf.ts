import { jsPDF } from 'jspdf';
import logoUrl from '../assets/brand/logo.png';

const COLORS = {
  navy: [15, 23, 42],
  orange: [245, 158, 11],
  slate: [71, 85, 105],
  light: [241, 245, 249],
  border: [226, 232, 240],
  white: [255, 255, 255],
};

const PERIOD_LABELS = {
  week: 'Bu Hafta',
  month: 'Bu Ay',
  semester: 'Bu Dönem',
  year: 'Bu Yıl',
};

let cachedFontBase64 = null;
let cachedLogoDataUrl = null;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

async function ensureAssets(doc) {
  let fontFamily = 'helvetica';

  try {
    if (!cachedFontBase64) {
      const response = await fetch('/fonts/Roboto-Regular.ttf');
      if (!response.ok) throw new Error('font fetch failed');
      cachedFontBase64 = arrayBufferToBase64(await response.arrayBuffer());
    }
    doc.addFileToVFS('Roboto-Regular.ttf', cachedFontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
    fontFamily = 'Roboto';
  } catch {
    // Helvetica fallback keeps PDF generation available if the bundled font cannot load.
  }

  try {
    if (!cachedLogoDataUrl) {
      const response = await fetch(logoUrl);
      if (!response.ok) throw new Error('logo fetch failed');
      const blob = await response.blob();
      cachedLogoDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    cachedLogoDataUrl = null;
  }

  return { fontFamily, logoDataUrl: cachedLogoDataUrl };
}

function safeFileName(value) {
  return String(value || 'rapor')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'rapor';
}

function reportDefinition(reportId, rows) {
  if (reportId === 'teachers') {
    return {
      columns: [
        { label: 'Öğretmen', key: 'name', width: 160 },
        { label: 'Branş', key: 'branch', width: 125 },
        { label: 'Sınıf', key: 'classes', width: 60, align: 'center' },
        { label: 'Öğrenci', key: 'studentCount', width: 70, align: 'center' },
        { label: 'Ortalama', key: 'averageScore', width: 75, align: 'right' },
      ],
      rows,
    };
  }

  if (reportId === 'students') {
    return {
      columns: [
        { label: 'Öğrenci', key: 'name', width: 155 },
        { label: 'Sınıf', key: 'className', width: 80 },
        { label: 'Program', key: 'programType', width: 135 },
        { label: 'Ortalama', key: 'averageScore', width: 75, align: 'right' },
        { label: 'Devam', key: 'attendanceRate', width: 80, align: 'right', suffix: '%' },
      ],
      rows,
    };
  }

  return {
    columns: [
      { label: 'Ders', key: 'subject', width: 355 },
      { label: 'Ortalama Başarı', key: 'average', width: 170, align: 'right', suffix: '%' },
    ],
    rows,
  };
}

function drawHeader(doc, fontFamily, logoDataUrl, title, pageNumber) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, pageWidth, 94, 'F');
  doc.setFillColor(...COLORS.orange);
  doc.rect(0, 90, pageWidth, 4, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 34, 22, 50, 50);
    } catch {
      // Text branding remains visible if an embedded browser rejects the image format.
    }
  }

  doc.setFont(fontFamily, 'bold');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(19);
  doc.text('SchoolAsist', 98, 45);
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(10);
  doc.text('Okul Yönetim ve Raporlama Platformu', 98, 64);

  doc.setFont(fontFamily, 'bold');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(13);
  doc.text(title, pageWidth - 34, 46, { align: 'right' });
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(9);
  doc.text(`Sayfa ${pageNumber}`, pageWidth - 34, 64, { align: 'right' });
}

function drawFooter(doc, fontFamily) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.border);
  doc.line(34, pageHeight - 42, pageWidth - 34, pageHeight - 42);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SchoolAsist | Eğitim Yönetim Platformu', 34, pageHeight - 25);
  doc.text('schoolasist.com', pageWidth - 34, pageHeight - 25, { align: 'right' });
}

function drawTableHeader(doc, fontFamily, columns, y) {
  const left = 34;
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(left, y, 527, 28, 5, 5, 'F');
  let x = left;
  columns.forEach((column) => {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    const textX = column.align === 'right' ? x + column.width - 9 : column.align === 'center' ? x + column.width / 2 : x + 9;
    doc.text(column.label, textX, y + 18, { align: column.align || 'left' });
    x += column.width;
  });
  return y + 32;
}

function drawTableRow(doc, fontFamily, columns, row, y, index) {
  const left = 34;
  const rowHeight = 30;
  doc.setFillColor(...(index % 2 === 0 ? COLORS.light : COLORS.white));
  doc.rect(left, y, 527, rowHeight, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.line(left, y + rowHeight, left + 527, y + rowHeight);

  let x = left;
  columns.forEach((column) => {
    const rawValue = row?.[column.key];
    const value = `${rawValue ?? '-'}${rawValue !== null && rawValue !== undefined && column.suffix ? column.suffix : ''}`;
    const maxWidth = column.width - 18;
    const clipped = doc.getTextWidth(value) > maxWidth
      ? `${String(value).slice(0, Math.max(5, Math.floor(column.width / 6)))}…`
      : value;
    const textX = column.align === 'right' ? x + column.width - 9 : column.align === 'center' ? x + column.width / 2 : x + 9;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.navy);
    doc.text(clipped, textX, y + 19, { align: column.align || 'left' });
    x += column.width;
  });
  return y + rowHeight;
}

export async function createSchoolAsistReportPdf({
  report,
  classFilter,
  periodFilter,
  stats,
  rows,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const { fontFamily, logoDataUrl } = await ensureAssets(doc);
  const definition = reportDefinition(report.id, rows);
  const generatedAt = new Date();
  let pageNumber = 1;
  let y = 0;

  const startPage = (withSummary) => {
    drawHeader(doc, fontFamily, logoDataUrl, report.name, pageNumber);
    drawFooter(doc, fontFamily);
    y = 120;

    if (withSummary) {
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(...COLORS.navy);
      doc.setFontSize(20);
      doc.text(report.name, 34, y);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...COLORS.slate);
      doc.setFontSize(10);
      doc.text(report.description || 'Kurumsal rapor', 34, y + 18);
      doc.text(`Oluşturma: ${generatedAt.toLocaleDateString('tr-TR')} ${generatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`, 561, y, { align: 'right' });
      doc.text(`Sınıf: ${classFilter === 'all' ? 'Tüm Sınıflar' : classFilter} | Dönem: ${PERIOD_LABELS[periodFilter] || periodFilter}`, 561, y + 18, { align: 'right' });

      y += 50;
      const cards = [
        ['Toplam Öğrenci', stats.totalStudents],
        ['Devam Oranı', `${stats.attendanceRate}%`],
        ['Ortalama Puan', stats.averageScore],
        ['Aktif Sınav', stats.activeExams],
      ];
      cards.forEach(([label, value], index) => {
        const x = 34 + index * 134;
        doc.setFillColor(...COLORS.light);
        doc.roundedRect(x, y, 125, 55, 7, 7, 'F');
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...COLORS.navy);
        doc.setFontSize(15);
        doc.text(String(value ?? 0), x + 12, y + 23);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...COLORS.slate);
        doc.setFontSize(8.5);
        doc.text(label, x + 12, y + 41);
      });
      y += 77;
    }

    y = drawTableHeader(doc, fontFamily, definition.columns, y);
  };

  startPage(true);

  if (definition.rows.length === 0) {
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(34, y + 8, 527, 54, 6, 6, 'F');
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.slate);
    doc.text('Seçili filtrelere uygun rapor kaydı bulunamadı.', 297.5, y + 40, { align: 'center' });
  } else {
    definition.rows.forEach((row, index) => {
      if (y + 30 > 785) {
        doc.addPage();
        pageNumber += 1;
        startPage(false);
      }
      y = drawTableRow(doc, fontFamily, definition.columns, row, y, index);
    });
  }

  return {
    doc,
    fileName: `schoolasist-${safeFileName(report.name)}-${generatedAt.toISOString().slice(0, 10)}.pdf`,
  };
}

export async function downloadSchoolAsistReportPdf(options) {
  const result = await createSchoolAsistReportPdf(options);
  result.doc.save(result.fileName);
  return result;
}
