import * as React from 'react';

export type CardTone = 'brand' | 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';
export const CardToneContext = React.createContext<CardTone>('brand');

export function cardToneForPath(path: string): CardTone {
  if (/late-payment|overdue|risk|wrong-answer/.test(path)) return 'rose';
  if (/assignment|exam|question|guidance|chat|notification|announcement|refund/.test(path)) return 'violet';
  if (/attendance|service|driver/.test(path)) return 'cyan';
  if (/calendar|appointment|meeting|cafeteria|approval/.test(path)) return 'amber';
  if (/collection|payment|scholarship|progress/.test(path)) return 'emerald';
  return 'blue';
}

export function cardText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(cardText).join(' ');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return cardText(node.props.children);
  return '';
}

/** Explicit non-brand tones retain status meaning; otherwise infer from the title. */
export function cardTone(title: React.ReactNode, fallback: CardTone = 'brand'): CardTone {
  if (fallback !== 'brand') return fallback;
  const text = cardText(title).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  if (/geciken kayit/.test(text)) return 'amber';
  if (/gecik|devamsiz|risk|uyari|hata|redd|iptal/.test(text)) return 'rose';
  if (/tahsilat orani|iade|pesinat|odev|sinav|rehber|gorusme|mesaj|bildirim/.test(text)) return 'violet';
  if (/randevu|takvim|bekleyen|yaklasan|hedef|menu|yemek/.test(text)) return 'amber';
  if (/tahsilat|gelir|bakiye|tamam|basari|gelisim|onay|aktif/.test(text)) return 'emerald';
  if (/devam|yoklama|katilim|servis|ulasim/.test(text)) return 'cyan';
  if (/gider|net akis|ders|ogrenci|ogretmen|personel|kayit|sube|kurum|rapor|belge/.test(text)) return 'blue';
  return 'brand';
}

/** Finds authored headings, never table rows or arbitrary descendant data. */
export function cardHeading(children: React.ReactNode): React.ReactNode {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) continue;
    const type = child.type as { displayName?: string };
    if (type.displayName === 'CardTitle' || (typeof child.type === 'string' && /^h[1-6]$/.test(child.type))) return child.props.children;
    const nested = cardHeading(child.props.children);
    if (nested) return nested;
  }
  return null;
}
