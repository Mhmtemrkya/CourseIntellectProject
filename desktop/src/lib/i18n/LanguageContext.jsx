import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TR_EN as TR_EN_BASE } from './dictionary';
import { TR_EN_EXT } from './dictionary-extended';

// Ana + genişletilmiş sözlük tek tabloda birleşir (ana öncelikli).
const TR_EN = { ...TR_EN_EXT, ...TR_EN_BASE };

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

const LanguageContext = createContext({ language: 'tr', setLanguage: () => {} });

function translate(text) {
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

function translateTextNode(node) {
  const current = node.nodeValue;
  if (!current || !current.trim()) return;
  if (node.__ciTranslated === current) return; // bizim yazdığımız değer
  const result = translate(current);
  if (result && result !== current) {
    node.__ciOriginal = current;
    node.__ciTranslated = result;
    node.nodeValue = result;
  }
}

function translateElementAttrs(el) {
  for (const attr of ATTRS) {
    const value = el.getAttribute?.(attr);
    if (!value) continue;
    const key = `__ciAttr_${attr}`;
    if (el[`${key}_translated`] === value) continue;
    const result = translate(value);
    if (result && result !== value) {
      el[key] = value;
      el[`${key}_translated`] = result;
      el.setAttribute(attr, result);
    }
  }
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(root.tagName)) return;
  translateElementAttrs(root);
  const iterator = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return SKIP_TAGS.has(node.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const elements = root.querySelectorAll?.('[placeholder],[title],[aria-label],[alt]') || [];
  elements.forEach(translateElementAttrs);
  let node = iterator.nextNode();
  while (node) {
    translateTextNode(node);
    node = iterator.nextNode();
  }
}

function restore(root) {
  const iterator = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while (node) {
    if (node.__ciOriginal && node.nodeValue === node.__ciTranslated) {
      node.nodeValue = node.__ciOriginal;
    }
    delete node.__ciOriginal;
    delete node.__ciTranslated;
    node = iterator.nextNode();
  }
  const elements = root.querySelectorAll?.('[placeholder],[title],[aria-label],[alt]') || [];
  elements.forEach((el) => {
    for (const attr of ATTRS) {
      const key = `__ciAttr_${attr}`;
      if (el[key] && el.getAttribute(attr) === el[`${key}_translated`]) {
        el.setAttribute(attr, el[key]);
      }
      delete el[key];
      delete el[`${key}_translated`];
    }
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'tr';
    } catch {
      return 'tr';
    }
  });

  const setLanguage = useCallback((next) => {
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
          translateElementAttrs(mutation.target);
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

export function useLanguage() {
  return useContext(LanguageContext);
}
