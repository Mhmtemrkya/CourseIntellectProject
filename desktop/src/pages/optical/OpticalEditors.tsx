import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { saveOpticalExam, saveOpticalTemplate } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  OpticalAnswerKeyDto, OpticalExamDto, OpticalSubjectBlockDto, OpticalTemplateDto, SaveOpticalTemplateRequest,
} from '../../types/api/generated';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

const EMPTY_TEMPLATE: SaveOpticalTemplateRequest = {
  name: '',
  encoding: 'windows-1254',
  studentNoStart: 1,
  studentNoLength: 10,
  nameStart: 11,
  nameLength: 25,
  classStart: 36,
  classLength: 4,
  bookletStart: 40,
  bookletLength: 1,
  subjects: [{ name: 'Türkçe', start: 41, count: 40 }],
};

type FieldKey = 'studentNo' | 'name' | 'class' | 'booklet';
const FIELDS: Array<{ key: FieldKey; label: string; hint: string }> = [
  { key: 'studentNo', label: 'Öğrenci no', hint: 'Okul numarasıyla eşleştirilir' },
  { key: 'name', label: 'Ad soyad', hint: 'Numara yoksa adla eşleştirilir' },
  { key: 'class', label: 'Sınıf', hint: 'Aynı adlı öğrencileri ayırır (isteğe bağlı)' },
  { key: 'booklet', label: 'Kitapçık', hint: 'A/B gibi kitapçık türü' },
];

function readField(form: SaveOpticalTemplateRequest, key: FieldKey): [number, number] {
  switch (key) {
    case 'studentNo': return [form.studentNoStart, form.studentNoLength];
    case 'name': return [form.nameStart, form.nameLength];
    case 'class': return [form.classStart, form.classLength];
    default: return [form.bookletStart, form.bookletLength];
  }
}

function writeField(form: SaveOpticalTemplateRequest, key: FieldKey, start: number, length: number): SaveOpticalTemplateRequest {
  switch (key) {
    case 'studentNo': return { ...form, studentNoStart: start, studentNoLength: length };
    case 'name': return { ...form, nameStart: start, nameLength: length };
    case 'class': return { ...form, classStart: start, classLength: length };
    default: return { ...form, bookletStart: start, bookletLength: length };
  }
}

const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Optik şablon (kolon düzeni) düzenleyici. Kolonlar 1'den başlar; uzunluk 0 = alan yok. */
export function OpticalTemplateEditor({ template, open, onClose, onSaved }: {
  template: OpticalTemplateDto | null; open: boolean; onClose: () => void; onSaved: (saved: OpticalTemplateDto) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<SaveOpticalTemplateRequest>(EMPTY_TEMPLATE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(template
      ? {
          name: template.name, encoding: template.encoding,
          studentNoStart: template.studentNoStart, studentNoLength: template.studentNoLength,
          nameStart: template.nameStart, nameLength: template.nameLength,
          classStart: template.classStart, classLength: template.classLength,
          bookletStart: template.bookletStart, bookletLength: template.bookletLength,
          subjects: template.subjects.map((item) => ({ ...item })),
        }
      : EMPTY_TEMPLATE);
  }, [open, template]);

  const setSubject = (index: number, patch: Partial<OpticalSubjectBlockDto>) =>
    setForm((current) => ({ ...current, subjects: current.subjects.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const addSubject = () => setForm((current) => {
    const last = current.subjects[current.subjects.length - 1];
    const start = last ? last.start + last.count : 1;
    return { ...current, subjects: [...current.subjects, { name: '', start, count: 20 }] };
  });

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveOpticalTemplate(template?.id ?? null, form);
      if (saved) onSaved(saved);
      toast({ title: 'Şablon kaydedildi' });
      onClose();
    } catch (error) {
      toast({ title: 'Şablon kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Şablonu düzenle' : 'Yeni optik şablon'}</DialogTitle>
          <DialogDescription>Optik okuyucunun çıktısında her alanın hangi kolonda başladığını ve kaç karakter olduğunu girin. Kolonlar 1’den başlar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <Label htmlFor="tpl-name">Şablon adı</Label>
            <Input id="tpl-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Örn: Okul optik formu (LGS)" />
          </div>
          <div>
            <Label htmlFor="tpl-encoding">Dosya kodlaması</Label>
            <select id="tpl-encoding" className={selectClass} value={form.encoding} onChange={(event) => setForm({ ...form, encoding: event.target.value })}>
              <option value="windows-1254">Türkçe Windows (1254)</option>
              <option value="utf-8">UTF-8</option>
              <option value="auto">Otomatik algıla</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Öğrenci alanları</p>
          {FIELDS.map((field) => {
            const [start, length] = readField(form, field.key);
            return (
              <div key={field.key} className="grid grid-cols-[minmax(0,1fr)_90px_90px] items-end gap-2">
                <div>
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                </div>
                <div>
                  <Label className="text-xs">Başlangıç</Label>
                  <Input inputMode="numeric" value={start} onChange={(event) => setForm(writeField(form, field.key, toNumber(event.target.value), length))} />
                </div>
                <div>
                  <Label className="text-xs">Uzunluk</Label>
                  <Input inputMode="numeric" value={length} onChange={(event) => setForm(writeField(form, field.key, start, toNumber(event.target.value)))} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ders blokları (sırayla)</p>
            <Button size="sm" variant="outline" onClick={addSubject}><Plus className="mr-1 h-4 w-4" />Ders ekle</Button>
          </div>
          {form.subjects.map((subject, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_90px_40px] items-end gap-2">
              <div>
                <Label className="text-xs">Ders</Label>
                <Input value={subject.name} onChange={(event) => setSubject(index, { name: event.target.value })} placeholder="Örn: Matematik" />
              </div>
              <div>
                <Label className="text-xs">Başlangıç</Label>
                <Input inputMode="numeric" value={subject.start} onChange={(event) => setSubject(index, { start: toNumber(event.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Soru sayısı</Label>
                <Input inputMode="numeric" value={subject.count} onChange={(event) => setSubject(index, { count: toNumber(event.target.value) })} />
              </div>
              <Button size="icon" variant="ghost" aria-label="Dersi kaldır" disabled={form.subjects.length === 1}
                onClick={() => setForm((current) => ({ ...current, subjects: current.subjects.filter((_, i) => i !== index) }))}>
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={busy || !form.name.trim()}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface KeyDraft { booklet: string; subjects: Record<string, { answers: string; topics: string }> }

function toDrafts(keys: OpticalAnswerKeyDto[], template: OpticalTemplateDto | undefined): KeyDraft[] {
  const names = template?.subjects.map((item) => item.name) ?? [];
  const source = keys.length > 0 ? keys : [{ booklet: 'A', subjects: [] }];
  return source.map((key) => ({
    booklet: key.booklet,
    subjects: Object.fromEntries(names.map((name) => {
      const existing = key.subjects.find((item) => item.subject === name);
      return [name, { answers: existing?.answers ?? '', topics: (existing?.topics ?? []).join('\n') }];
    })),
  }));
}

/** Deneme: puanlama kuralları + kitapçık başına cevap anahtarı ve soru-konu listesi. */
export function OpticalExamEditor({ exam, templates, open, onClose, onSaved }: {
  exam: OpticalExamDto | null; templates: OpticalTemplateDto[]; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [penalty, setPenalty] = useState(4);
  const [multiWrong, setMultiWrong] = useState(true);
  const [cancelledMode, setCancelledMode] = useState('exclude');
  const [keys, setKeys] = useState<KeyDraft[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  const template = templates.find((item) => item.id === templateId);

  useEffect(() => {
    if (!open) return;
    const firstTemplate = exam?.templateId ?? templates[0]?.id ?? '';
    setTitle(exam?.title ?? '');
    setDate((exam?.examDateUtc ?? new Date().toISOString()).slice(0, 10));
    setTemplateId(firstTemplate);
    setPenalty(exam?.wrongPenalty ?? 4);
    setMultiWrong(exam?.multiMarkAsWrong ?? true);
    setCancelledMode(exam?.cancelledMode ?? 'exclude');
    setKeys(toDrafts(exam?.keys ?? [], templates.find((item) => item.id === firstTemplate)));
    setActive(0);
  }, [open, exam, templates]);

  const changeTemplate = (id: string) => {
    setTemplateId(id);
    setKeys((current) => toDrafts(current.map((key) => ({ booklet: key.booklet, subjects: [] })), templates.find((item) => item.id === id)));
  };

  const setSubject = (subject: string, patch: Partial<{ answers: string; topics: string }>) =>
    setKeys((current) => current.map((key, index) => {
      if (index !== active) return key;
      const previous = key.subjects[subject] ?? { answers: '', topics: '' };
      return { ...key, subjects: { ...key.subjects, [subject]: { ...previous, ...patch } } };
    }));

  const addBooklet = () => setKeys((current) => {
    const next = String.fromCharCode('A'.charCodeAt(0) + current.length);
    setActive(current.length);
    return [...current, { booklet: next, subjects: Object.fromEntries((template?.subjects ?? []).map((item) => [item.name, { answers: '', topics: '' }])) }];
  });

  /** Seçili kitapçığın konularını, aynı soru sırasıyla diğer kitapçıklara kopyalar (sıra aynıysa). */
  const copyTopicsFromFirst = () => setKeys((current) => current.map((key, index) => {
    if (index !== active || index === 0) return key;
    const first = current[0];
    if (!first) return key;
    return {
      ...key,
      subjects: Object.fromEntries(Object.entries(key.subjects).map(([name, value]) => [name, { ...value, topics: first.subjects[name]?.topics ?? '' }])),
    };
  }));

  const save = async () => {
    setBusy(true);
    try {
      await saveOpticalExam(exam?.id ?? null, {
        title,
        examDateUtc: new Date(`${date}T09:00:00Z`).toISOString(),
        templateId,
        wrongPenalty: penalty,
        multiMarkAsWrong: multiWrong,
        cancelledMode,
        keys: keys.map((key) => ({
          booklet: key.booklet,
          subjects: Object.entries(key.subjects).map(([subject, value]) => ({
            subject,
            answers: value.answers,
            topics: value.topics.trim().length === 0 ? [] : value.topics.replace(/\r/g, '').split('\n'),
          })),
        })),
      });
      toast({ title: 'Deneme kaydedildi' });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: 'Deneme kaydedilemedi', description: errorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const current = keys[active];
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? 'Denemeyi düzenle' : 'Yeni optik deneme'}</DialogTitle>
          <DialogDescription>Cevap anahtarını ve her sorunun konusunu girin. Konular, öğrenci konu analizinde kullanılır.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
          <div>
            <Label htmlFor="exam-title">Deneme adı</Label>
            <Input id="exam-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn: 3. LGS Deneme Sınavı" />
          </div>
          <div>
            <Label htmlFor="exam-date">Tarih</Label>
            <Input id="exam-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="exam-template">Optik şablon</Label>
            <select id="exam-template" className={selectClass} value={templateId} onChange={(event) => changeTemplate(event.target.value)}>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="exam-penalty">Yanlış götürme</Label>
            <select id="exam-penalty" className={selectClass} value={penalty} onChange={(event) => setPenalty(toNumber(event.target.value))}>
              <option value={3}>3 yanlış 1 doğruyu götürür (LGS)</option>
              <option value={4}>4 yanlış 1 doğruyu götürür (TYT/AYT)</option>
              <option value={0}>Yanlış doğruyu götürmez</option>
            </select>
          </div>
          <div>
            <Label htmlFor="exam-multi">Çoklu işaretleme</Label>
            <select id="exam-multi" className={selectClass} value={multiWrong ? 'wrong' : 'blank'} onChange={(event) => setMultiWrong(event.target.value === 'wrong')}>
              <option value="wrong">Yanlış sayılır</option>
              <option value="blank">Boş sayılır</option>
            </select>
          </div>
          <div>
            <Label htmlFor="exam-cancelled">İptal edilen soru (anahtarda X)</Label>
            <select id="exam-cancelled" className={selectClass} value={cancelledMode} onChange={(event) => setCancelledMode(event.target.value)}>
              <option value="exclude">Değerlendirme dışı</option>
              <option value="correct">Herkese doğru sayılır</option>
            </select>
          </div>
        </div>

        {!template ? <p className="text-sm text-muted-foreground">Önce bir optik şablon oluşturun.</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {keys.map((key, index) => (
                <Button key={key.booklet} size="sm" variant={index === active ? 'default' : 'outline'} onClick={() => setActive(index)}>{`${key.booklet} kitapçığı`}</Button>
              ))}
              <Button size="sm" variant="ghost" onClick={addBooklet} disabled={keys.length >= 6}><Plus className="mr-1 h-4 w-4" />Kitapçık ekle</Button>
              {active > 0 ? <Button size="sm" variant="ghost" onClick={copyTopicsFromFirst}>Konuları A’dan kopyala</Button> : null}
              {keys.length > 1 ? (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { setKeys((list) => list.filter((_, i) => i !== active)); setActive(0); }}>
                  <Trash2 className="mr-1 h-4 w-4" />Kitapçığı kaldır
                </Button>
              ) : null}
            </div>
            {current ? template.subjects.map((block) => {
              const value = current.subjects[block.name] ?? { answers: '', topics: '' };
              const answerCount = value.answers.replace(/\s/g, '').length;
              const topicCount = value.topics.trim().length === 0 ? 0 : value.topics.replace(/\r/g, '').split('\n').length;
              return (
                <div key={block.name} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{block.name}</p>
                    <p className={`text-xs ${answerCount === block.count ? 'text-emerald-600' : 'text-amber-600'}`}>{`${answerCount} / ${block.count} cevap`}</p>
                  </div>
                  <Label className="text-xs">Cevap anahtarı (A-E; iptal için X)</Label>
                  <Input className="font-mono tracking-widest" value={value.answers} onChange={(event) => setSubject(block.name, { answers: event.target.value.toUpperCase() })} placeholder="ABCDEABCDE…" />
                  <div className="mt-2 flex items-baseline justify-between">
                    <Label className="text-xs">Konular (her satır bir soru, isteğe bağlı)</Label>
                    <span className={`text-xs ${topicCount === 0 || topicCount === block.count ? 'text-muted-foreground' : 'text-amber-600'}`}>{`${topicCount} / ${block.count} satır`}</span>
                  </div>
                  <Textarea rows={4} value={value.topics} onChange={(event) => setSubject(block.name, { topics: event.target.value })} placeholder={'Paragraf\nParagraf\nSözcükte Anlam\n…'} />
                </div>
              );
            }) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={busy || !title.trim() || !template}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
