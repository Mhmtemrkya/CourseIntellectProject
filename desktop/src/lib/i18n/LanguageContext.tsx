import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { TR_EN as TR_EN_BASE } from './dictionary';
import { TR_EN_EXT } from './dictionary-extended';

// Ana + genişletilmiş sözlük tek tabloda birleşir (ana öncelikli).
const TR_EN: Record<string, string> = { ...TR_EN_EXT, ...TR_EN_BASE };

// Uygulama genelinde TR→EN çeviri katmanı. Sayfaları tek tek elden geçirmek
// yerine DOM metin düğümlerini sözlükle çevirir: EN seçiliyken bir
// MutationObserver tüm yeni/değişen metinleri yakalar, sözlükte karşılığı
// olanları değiştirir; eşleşmeyenler Türkçe kalır. Yalnızca nodeValue ve
// güvenli öznitelikler değiştirilir — DOM yapısına dokunulmaz, bu sayede
// React reconcile'ı bozulmaz (Google Translate'in aksine element sarmalanmaz).

const STORAGE_KEY = 'ci-language';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const NUMBER_RE = /\d[\d.,:%]*/g;

export type Language = 'tr' | 'en';

export interface LanguageContextValue {
  language: Language;
  setLanguage: (next: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ language: 'tr', setLanguage: () => {} });

function translate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = TR_EN[trimmed];
  if (direct) return text.replace(trimmed, direct);
  // Sayısal kalıp: "3 kayıt" -> "{n} kayıt" araması, sayılar geri yerleştirilir
  if (NUMBER_RE.test(trimmed)) {
    NUMBER_RE.lastIndex = 0;
    const numbers = trimmed.match(NUMBER_RE) || [];
    const pattern = trimmed.replace(NUMBER_RE, '{n}');
    const hit = TR_EN[pattern];
    if (hit) {
      let index = 0;
      const restored = hit.replace(/\{n\}/g, () => numbers[index++] ?? '');
      return text.replace(trimmed, restored);
    }
  }
  return null;
}

// Çevirdiğimiz düğümlerin özgün/çevrilmiş değerleri. DOM düğümüne alan
// eklemek yerine WeakMap tutulur; düğüm DOM'dan düşünce kayıt da kendiliğinden
// temizlenir.
interface TranslationRecord {
  original: string;
  translated: string;
}

const textRecords = new WeakMap<Node, TranslationRecord>();
const attrRecords = new WeakMap<Element, Map<string, TranslationRecord>>();

function translateTextNode(node: Node): void {
  const current = node.nodeValue;
  if (!current || !current.trim()) return;
  if (textRecords.get(node)?.translated === current) return; // bizim yazdığımız değer
  const result = translate(current);
  if (result && result !== current) {
    textRecords.set(node, { original: current, translated: result });
    node.nodeValue = result;
  }
}

function translateElementAttrs(el: Element): void {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const records = attrRecords.get(el);
    if (records?.get(attr)?.translated === value) continue;
    const result = translate(value);
    if (result && result !== value) {
      const next = records ?? new Map<string, TranslationRecord>();
      next.set(attr, { original: value, translated: result });
      attrRecords.set(el, next);
      el.setAttribute(attr, result);
    }
  }
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }
  if (!isElement(root) || SKIP_TAGS.has(root.tagName)) return;
  translateElementAttrs(root);
  const iterator = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (isElement(node)) {
        return SKIP_TAGS.has(node.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const elements = root.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
  elements.forEach(translateElementAttrs);
  let node = iterator.nextNode();
  while (node) {
    translateTextNode(node);
    node = iterator.nextNode();
  }
}

function restore(root: Element): void {
  const iterator = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while (node) {
    const record = textRecords.get(node);
    if (record && node.nodeValue === record.translated) {
      node.nodeValue = record.original;
    }
    textRecords.delete(node);
    node = iterator.nextNode();
  }
  const elements = root.querySelectorAll('[placeholder],[title],[aria-label],[alt]');
  elements.forEach((el) => {
    const records = attrRecords.get(el);
    if (!records) return;
    for (const attr of ATTRS) {
      const record = records.get(attr);
      if (record && el.getAttribute(attr) === record.translated) {
        el.setAttribute(attr, record.original);
      }
    }
    attrRecords.delete(el);
  });
}

export function LanguageProvider({ children }: { children?: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'tr';
    } catch {
      return 'tr';
    }
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* özel mod vb. */ }
  }, []);

  useEffect(() => {
    if (language !== 'en') {
      restore(document.body);
      return undefined;
    }
    walk(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
        } else if (mutation.type === 'attributes') {
          if (isElement(mutation.target)) translateElementAttrs(mutation.target);
        } else {
          mutation.addedNodes.forEach((node) => walk(node));
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
    return () => observer.disconnect();
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
