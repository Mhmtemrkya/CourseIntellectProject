import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Asistanın "ekranda bakılan öğrenci" bağlamı. Öğrenci detayı gösteren sayfalar
 * `useAssistantFocus` ile bildirir; panel "devamsızlığı nasıl?" sorusunu ad yazılmadan bu
 * öğrenciye yöneltir. Detay penceresi kapanınca bağlam silinmez ("son baktığınız öğrenci"),
 * yalnız sayfa değişince ya da kullanıcı kaldırınca düşer. Sunucu bunu yalnız ipucu sayar:
 * eşleşme yine kullanıcının rol kapsamındaki öğrenciler arasında yapılır.
 */
export interface AssistantFocus {
  /** Öğrenci profili ya da kullanıcı kimliği; bilinmiyorsa ad yeter. */
  studentId: string | null;
  studentName: string;
  /** Bağlamın oluştuğu adres; başka sayfaya geçilince bağlam düşer. */
  route: string;
}

let current: AssistantFocus | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setAssistantFocus(focus: AssistantFocus | null) {
  if (focus?.studentId === current?.studentId && focus?.studentName === current?.studentName && focus?.route === current?.route) return;
  current = focus;
  emit();
}

/**
 * Bağlam başka bir sayfada oluşmuşsa siler. Değer çağrı anında okunur: sayfa ile panel aynı
 * render'da effect çalıştırdığında (A öğrencisinden B'ye doğrudan geçiş) sayfanın az önce
 * yazdığı yeni bağlam, panelin eski render'daki kopyasıyla silinmez.
 */
export function clearStaleAssistantFocus(pathname: string) {
  if (current && current.route !== pathname) setAssistantFocus(null);
}

export function useAssistantFocusValue(): AssistantFocus | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => current,
  );
}

/** Sayfa tarafı: seçili öğrenci değiştikçe bağlamı günceller (boş seçim bağlamı silmez). */
export function useAssistantFocus(student: { id?: string | null; name?: string | null } | null | undefined) {
  const id = student?.id ?? null;
  const name = student?.name?.trim() ?? '';
  const { pathname } = useLocation();
  useEffect(() => {
    if (!name && !id) return;
    setAssistantFocus({ studentId: id, studentName: name, route: pathname });
  }, [id, name, pathname]);
}
