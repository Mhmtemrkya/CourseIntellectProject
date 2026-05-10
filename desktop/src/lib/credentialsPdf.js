import { jsPDF } from 'jspdf';
import logoUrl from '../assets/brand/logo.png';

let cachedFontBase64 = null;

async function loadLogoDataUrl() {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

async function ensureUnicodeFont(doc) {
  try {
    if (!cachedFontBase64) {
      const response = await fetch('/fonts/Roboto-Regular.ttf');
      if (!response.ok) throw new Error('font fetch failed');
      const buffer = await response.arrayBuffer();
      cachedFontBase64 = arrayBufferToBase64(buffer);
    }
    doc.addFileToVFS('Roboto-Regular.ttf', cachedFontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto', 'normal');
    return true;
  } catch (err) {
    console.warn('Roboto font yüklenemedi, varsayılan fonta düşülüyor', err);
    return false;
  }
}

export async function downloadCredentialsPdf({
  tenantName,
  fullName,
  role,
  username,
  temporaryPassword,
  className,
  extra,
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const hasUnicodeFont = await ensureUnicodeFont(doc);
  const fontFamily = hasUnicodeFont ? 'Roboto' : 'helvetica';

  // Brand band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 110, 'F');

  const logoData = await loadLogoDataUrl();
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 36, 30, 50, 50);
    } catch {
      // ignore
    }
  }

  doc.setFont(fontFamily, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('CourseIntellect', 100, 55);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(199, 210, 254);
  doc.text('Hesap Bilgileriniz', 100, 78);

  // Subhead
  doc.setTextColor(15, 23, 42);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(16);
  doc.text(tenantName || 'Kurum', 36, 160);

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const today = new Date().toLocaleDateString('tr-TR');
  doc.text(`Oluşturma Tarihi: ${today}`, 36, 178);

  // Body card
  let y = 220;
  const drawRow = (label, value) => {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(label, 36, y);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(String(value || '-'), 200, y);
    y += 26;
  };

  drawRow('Ad Soyad', fullName);
  drawRow('Rol', role);
  if (className) drawRow('Sınıf', className);
  drawRow('Kullanıcı Adı', username);

  // Password highlight box
  y += 10;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(36, y, pageWidth - 72, 70, 8, 8, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Geçici Şifre', 50, y + 25);
  // Şifre için monospace görünüm — Roboto fixed-pitch değil ama bold + büyük punto kafidir
  doc.setFont(hasUnicodeFont ? 'Roboto' : 'courier', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(String(temporaryPassword || ''), 50, y + 55);
  y += 100;

  // Warning
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(36, y, pageWidth - 72, 70, 8, 8, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  doc.text('Önemli Uyarı', 50, y + 22);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(10);
  doc.text('İlk girişinizde şifre değişikliği yapmanız zorunludur.', 50, y + 40);
  doc.text('Bu şifreyi güvenli bir yerde saklayın ve kimseyle paylaşmayın.', 50, y + 55);

  if (extra) {
    y += 95;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(String(extra), 36, y);
  }

  // Footer
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('CourseIntellect • Eğitim Yönetim Platformu', 36, doc.internal.pageSize.getHeight() - 30);

  const safeName = (fullName || 'kullanici').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`courseintellect-${safeName}-bilgileri.pdf`);
}
