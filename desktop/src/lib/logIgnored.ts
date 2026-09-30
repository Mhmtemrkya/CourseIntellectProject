// Bilinçli olarak yutulan (kullanıcıya gösterilmeyen) hatalar için ortak
// kaydedici. Boş `catch {}` yerine kullanılır ki hata en azından konsolda
// görünür kalsın (arka plan yenileme, video oynatma, en iyi çaba temizlik).
export function logIgnored(context: string): (error: unknown) => void {
  return (error: unknown): void => {
    console.warn(`[${context}] yok sayılan hata`, error);
  };
}
