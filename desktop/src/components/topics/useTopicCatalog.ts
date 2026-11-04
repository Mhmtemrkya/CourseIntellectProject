import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { addTopic, deleteTopic, fetchTopics } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import { topicOptions, type TopicOption } from '../../lib/topicCatalog';
import type { OpticalTopicCatalogDto } from '../../types/api/generated';

/**
 * Seçilen seviye ve derslerin konu listesi (optik cevap anahtarı ve soru stüdyosu ortak). Seviye ya da
 * dersler değişince yeniden alınır; geç gelen eski yanıt yok sayılır. Kuruma konu ekleme/kaldırma
 * listeyi yerinde günceller; kayıtlardaki konular etkilenmez.
 */
export function useTopicCatalog(level: string, subjects: readonly string[], enabled: boolean) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<OpticalTopicCatalogDto | null>(null);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const key = subjects.filter(Boolean).join('|');

  useEffect(() => {
    if (!enabled || !key) {
      request.current += 1;
      return;
    }
    const current = ++request.current;
    setError(false);
    fetchTopics(level, key.split('|'))
      .then((result) => { if (current === request.current) setCatalog(result); })
      .catch(() => { if (current === request.current) { setCatalog(null); setError(true); } });
  }, [enabled, level, key]);

  const optionsFor = useCallback((subject: string): TopicOption[] =>
    topicOptions(catalog?.subjects.find((item) => item.subject === subject)), [catalog]);

  /** Kurum listesine ekler; kaydedilen (ya da listede zaten olan) yazımı döner, başarısızsa null. */
  const add = useCallback(async (subject: string, name: string): Promise<string | null> => {
    try {
      const result = await addTopic({ subject, level, name });
      if (!result) return null;
      const saved = result.topic;
      if (saved) {
        setCatalog((current) => current && {
          ...current,
          subjects: current.subjects.map((item) => (item.subject === subject && !item.custom.some((topic) => topic.id === saved.id)
            ? { ...item, custom: [...item.custom, saved].sort((a, b) => a.name.localeCompare(b.name, 'tr')) } : item)),
        });
      }
      if (result.status === 'exists-builtin') toast({ title: 'Bu konu listede zaten var', description: `Listedeki yazım kullanıldı: ${result.name}` });
      else if (result.status === 'created') toast({ title: 'Konu listeye eklendi', description: `${subject}: ${result.name}` });
      return result.name;
    } catch (addError) {
      toast({ title: 'Konu eklenemedi', description: errorMessage(addError), variant: 'destructive' });
      return null;
    }
  }, [level, toast]);

  const remove = useCallback(async (option: TopicOption) => {
    if (!option.id) return;
    const id = option.id;
    try {
      await deleteTopic(id);
      setCatalog((current) => current && {
        ...current,
        subjects: current.subjects.map((item) => ({ ...item, custom: item.custom.filter((topic) => topic.id !== id) })),
      });
      toast({ title: 'Konu kurum listesinden kaldırıldı', description: 'Bu konuyu kullanan kayıtlar değişmez.' });
    } catch (removeError) {
      toast({ title: 'Konu kaldırılamadı', description: errorMessage(removeError), variant: 'destructive' });
    }
  }, [toast]);

  return { optionsFor, add, remove, error };
}
