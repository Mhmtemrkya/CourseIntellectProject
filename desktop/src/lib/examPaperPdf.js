import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// A4 @ 96dpi
const PAGE_W = 794;
const PAGE_H = 1123;

const C = {
  violet: '#6D28D9',
  violetSoft: '#7C3AED',
  violetTint: '#F5F3FF',
  violetBorder: '#E9E2FB',
  navy: '#1E293B',
  slate: '#475569',
  slateSoft: '#64748B',
  green: '#22C55E',
  red: '#EF4444',
  grayRing: '#CBD5E1',
  cardBorder: '#E2E8F0',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function checkSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="11" fill="${C.green}"/><path d="M7 12.5l3 3 7-7" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function crossSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="11" fill="${C.red}"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
}
function ringSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="none" stroke="${C.grayRing}" stroke-width="2"/></svg>`;
}
function brainSvg() {
  return `<svg viewBox="0 0 40 40" width="40" height="40"><rect x="2" y="2" width="36" height="36" rx="11" fill="#fff"/><path d="M14 11c-3 0-5 2-5 5 0 1-1 2-1 4s1 3 3 3c0 2 2 3 4 3M26 11c3 0 5 2 5 5 0 1 1 2 1 4s-1 3-3 3c0 2-2 3-4 3M20 9v22" stroke="${C.violet}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}
function cornerWave(position) {
  // Dekoratif mor dalga (köşe). position: 'tr' | 'bl'
  const transform = position === 'tr'
    ? 'top:-40px;right:-40px;transform:rotate(12deg);'
    : 'bottom:-50px;left:-50px;transform:rotate(180deg);';
  return `<svg style="position:absolute;${transform}width:280px;height:170px;opacity:0.9" viewBox="0 0 280 170"><path d="M0,0 C90,40 150,10 280,70 L280,0 Z" fill="${C.violetSoft}"/><path d="M0,0 C110,60 170,30 280,95 L280,0 Z" fill="${C.violet}" opacity="0.55"/></svg>`;
}

function computeStats(session) {
  const questions = session.questions || [];
  const total = questions.length;
  const correct = questions.filter((q) => q.answer?.isCorrect === true).length;
  const answered = questions.filter((q) => q.answer && (q.answer.selectedOptionIndex >= 0 || (q.answer.openAnswer || '').trim() !== '')).length;
  const empty = Math.max(0, total - answered);
  const wrong = Math.max(0, answered - correct);
  const success = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, wrong, empty, success };
}

function optionRowHtml(letter, text, marker) {
  const markerHtml = marker === 'check' ? checkSvg() : marker === 'cross' ? crossSvg() : '';
  return `
    <div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;">
      <div style="width:20px;height:20px;flex:0 0 20px;">${markerHtml}</div>
      <div style="width:20px;flex:0 0 20px;color:${C.slateSoft};font-size:13px;line-height:20px;">${escapeHtml(letter)})</div>
      <div style="flex:1;color:${C.navy};font-size:13px;line-height:20px;">${escapeHtml(text)}</div>
    </div>`;
}

function questionHtml(q, number) {
  const options = Array.isArray(q.options) ? q.options : [];
  const selected = q.answer?.selectedOptionIndex ?? -1;
  const correctIndex = q.correctOptionIndex ?? -1;
  const isWrong = selected >= 0 && correctIndex >= 0 && selected !== correctIndex;

  if (options.length === 0) {
    const ans = (q.answer?.openAnswer || '').trim();
    return `
      <div style="break-inside:avoid;border:1px solid ${C.cardBorder};border-radius:12px;padding:12px;margin-bottom:14px;">
        <div style="display:flex;gap:8px;"><span style="color:${C.violetSoft};font-weight:800;font-size:14px;">${number}.</span>
        <span style="color:${C.navy};font-weight:600;font-size:14px;">${escapeHtml(q.questionText)}</span></div>
        <div style="margin-top:6px;padding-left:24px;color:${ans ? C.navy : C.slateSoft};font-size:13px;">${ans ? escapeHtml(ans) : '(Boş bırakıldı)'}</div>
      </div>`;
  }

  const optionsHtml = options.map((text, i) => {
    const marker = i === selected ? (i === correctIndex ? 'check' : 'cross') : 'none';
    return optionRowHtml(String.fromCharCode(65 + i), text, marker);
  }).join('');

  const pill = isWrong && correctIndex >= 0 && correctIndex < options.length
    ? `<div style="display:flex;justify-content:flex-end;margin-top:8px;"><span style="background:#FEF2F2;color:${C.red};border-radius:10px;padding:5px 12px;font-size:12px;">Doğru Cevap: <b>${String.fromCharCode(65 + correctIndex)}</b></span></div>`
    : '';

  return `
    <div style="break-inside:avoid;margin-bottom:18px;">
      <div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:${C.violetSoft};font-weight:800;font-size:15px;">${number}.</span>
      <span style="color:${C.navy};font-weight:600;font-size:14px;line-height:1.35;">${escapeHtml(q.questionText)}</span></div>
      <div style="padding-left:24px;">${optionsHtml}</div>
      ${pill}
    </div>`;
}

function pageShell(innerHtml, withWaves = true) {
  const page = document.createElement('div');
  page.setAttribute('data-exam-page', '');
  page.style.cssText = `position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;overflow:hidden;font-family:Inter,Poppins,'Segoe UI',Arial,sans-serif;box-sizing:border-box;`;
  page.innerHTML = `${withWaves ? cornerWave('tr') + cornerWave('bl') : ''}${innerHtml}`;
  return page;
}

function brandedHeaderHtml() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:28px 40px 0;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${brainSvg()}
        <div>
          <div style="font-size:22px;font-weight:800;color:${C.navy};">Course<span style="color:${C.violet};">Intellecte</span></div>
          <div style="font-size:11px;color:${C.slateSoft};">Akıllı Sorular, Güçlü Yarınlar</div>
        </div>
      </div>
      <div style="background:${C.violet};color:#fff;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13px;">PDF</div>
    </div>`;
}

function titleHtml() {
  return `
    <div style="text-align:center;margin-top:18px;">
      <div style="font-size:34px;font-weight:800;color:${C.navy};letter-spacing:0.5px;">SINAV KAĞIDI</div>
      <div style="margin-top:6px;font-size:13px;color:${C.slateSoft};">Aşağıda öğrencinin sınavda verdiği cevaplar yer almaktadır.</div>
    </div>`;
}

function studentCardHtml(session, stats) {
  const finished = session.completedAtUtc ? new Date(session.completedAtUtc) : new Date();
  const date = finished.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = finished.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const cell = (label, value) => `
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:${C.slate};">${label}</div>
      <div style="margin-top:5px;font-size:13px;font-weight:600;color:${C.navy};white-space:pre-line;">${value}</div>
    </div>`;
  return `
    <div style="margin:18px 40px 0;border:1px solid ${C.violetBorder};background:${C.violetTint};border-radius:18px;padding:18px;display:flex;align-items:center;gap:8px;">
      ${cell('ÖĞRENCİ ADI', escapeHtml(session.studentName || session.studentUsername || '-'))}
      ${cell('SINIF / ŞUBE', escapeHtml(session.className || '-'))}
      ${cell('SINAV ADI', escapeHtml(session.title || session.subject || '-'))}
      ${cell('SINAV TARİHİ', `${escapeHtml(date)}\n${escapeHtml(time)}`)}
      <div style="width:1px;height:64px;background:${C.violetBorder};"></div>
      <div style="flex:0 0 130px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:${C.violet};letter-spacing:0.5px;">ALDIĞI PUAN</div>
        <div style="margin:6px auto 0;width:74px;height:74px;border-radius:50%;background:#fff;border:4px solid ${C.violetBorder};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:${C.violet};">${stats.success}</div>
        <div style="margin-top:5px;font-size:10px;color:${C.slateSoft};">(100 üzerinden)</div>
      </div>
    </div>`;
}

function infoBannerHtml(stats) {
  return `
    <div style="margin:14px 40px 0;border:1px solid ${C.violetBorder};background:${C.violetTint};border-radius:14px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:13px;color:${C.slate};">Bu sınavda <b style="color:${C.violet};">${stats.total}</b> soru yer almaktadır.</div>
      <div style="display:flex;gap:22px;font-size:13px;">
        <span style="color:${C.slateSoft};">Doğru: <b style="color:${C.green};">${stats.correct}</b></span>
        <span style="color:${C.slateSoft};">Yanlış: <b style="color:${C.red};">${stats.wrong}</b></span>
        <span style="color:${C.slateSoft};">Boş: <b style="color:${C.slateSoft};">${stats.empty}</b></span>
      </div>
    </div>`;
}

function legendHtml() {
  return `
    <div style="margin:16px 40px 0;border:1px solid ${C.cardBorder};border-radius:14px;padding:10px;display:flex;justify-content:center;gap:40px;align-items:center;">
      <span style="display:flex;align-items:center;gap:6px;font-size:13px;color:${C.slate};">${checkSvg()} Doğru</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:13px;color:${C.slate};">${crossSvg()} Yanlış</span>
      <span style="display:flex;align-items:center;gap:6px;font-size:13px;color:${C.slate};">${ringSvg()} Boş</span>
    </div>`;
}

function footerHtml(pageNo, totalPages) {
  return `
    <div style="position:absolute;left:0;right:0;bottom:24px;display:flex;align-items:center;justify-content:center;padding:0 40px;">
      <div style="text-align:center;">
        <div style="font-size:13px;font-weight:700;color:${C.violet};">CourseIntellecte</div>
        <div style="font-size:11px;color:${C.slateSoft};">courseintellect.com</div>
      </div>
      <div style="position:absolute;right:40px;background:${C.violet};color:#fff;border-radius:14px;padding:7px 16px;font-size:12px;font-weight:700;">Sayfa ${pageNo} / ${totalPages}</div>
    </div>`;
}

// Soruları ölçüm-bazlı olarak sabit A4 sayfalara dağıtır (2 sütun, taşma yok).
function buildPages(session, stats, host) {
  const questionsHtml = (session.questions || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((q, i) => questionHtml(q, i + 1));

  const pages = [];
  let index = 0;
  let isFirst = true;

  while (index < questionsHtml.length || isFirst) {
    const headerBlocks = isFirst
      ? brandedHeaderHtml() + titleHtml() + studentCardHtml(session, stats) + infoBannerHtml(stats)
        + `<div style="margin:18px 40px 0;font-size:14px;font-weight:800;color:${C.navy};">SORULAR</div>`
      : brandedHeaderHtml() + `<div style="margin:14px 40px 0;font-size:14px;font-weight:800;color:${C.navy};">SORULAR (devam)</div>`;

    // Sorular için kullanılabilir yükseklik (footer + alt boşluk hariç).
    const contentMaxHeight = isFirst ? 470 : 880;
    const colWrap = `<div data-q-col style="margin:12px 40px 0;column-count:2;column-gap:24px;height:${contentMaxHeight}px;overflow:hidden;"></div>`;

    const page = pageShell(headerBlocks + colWrap);
    host.appendChild(page);
    const col = page.querySelector('[data-q-col]');

    let added = 0;
    while (index < questionsHtml.length) {
      col.insertAdjacentHTML('beforeend', questionsHtml[index]);
      if (col.scrollHeight > contentMaxHeight && added > 0) {
        col.lastElementChild.remove();
        break;
      }
      if (col.scrollHeight > contentMaxHeight && added === 0) {
        // Tek soru bile sığmıyorsa yine de bırak (taşmayı kabul et).
        index += 1;
        added += 1;
        break;
      }
      index += 1;
      added += 1;
    }

    pages.push(page);
    isFirst = false;
    if (added === 0 && index >= questionsHtml.length) break;
  }

  // Açık uçlu / boş soru yoksa ve hiç soru yoksa en az 1 sayfa kalır.
  // Legend'i son sayfanın sorular alanının altına ekle + footer'ları yerleştir.
  const last = pages[pages.length - 1];
  if (last) last.insertAdjacentHTML('beforeend', legendHtml());

  pages.forEach((page, i) => {
    page.insertAdjacentHTML('beforeend', footerHtml(i + 1, pages.length));
  });

  return pages;
}

export async function generateExamPaperBlob(session) {
  const stats = computeStats(session);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff;';
  document.body.appendChild(host);

  try {
    const pages = buildPages(session, stats, host);
    // Fontların yüklenmesini bekle (Türkçe + Inter/Poppins).
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* yoksa devam */ }
    }

    const pdf = new jsPDF({ unit: 'px', format: [PAGE_W, PAGE_H], orientation: 'portrait', compress: true });
    for (let i = 0; i < pages.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(pages[i], {
        scale: 2,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      if (i > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_W, PAGE_H);
    }
    return pdf.output('blob');
  } finally {
    document.body.removeChild(host);
  }
}

function sanitizeFileName(value) {
  return String(value || 'sinav-kagidi').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

export async function downloadExamPaperPdf(session, fileName) {
  const blob = await generateExamPaperBlob(session);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileName(fileName || `sinav-kagidi-${session.title || ''}`)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function previewExamPaperPdf(session) {
  const blob = await generateExamPaperBlob(session);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
