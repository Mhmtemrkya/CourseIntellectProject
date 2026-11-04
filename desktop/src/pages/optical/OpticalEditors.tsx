import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, ChevronDown, ClipboardPaste, HelpCircle, Loader2, Plus, Scissors, Trash2, Wand2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import {
  saveOpticalExam, saveOpticalTemplate, suggestOpticalTemplate,
} from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type {
  OpticalExamDto, OpticalSubjectBlockDto, OpticalTemplateDto, OpticalTemplateSuggestionDto, SaveOpticalTemplateRequest,
} from '../../types/api/generated';
import {
  ANSWER_CHOICES, emptyKey, missingAnswers, normalizeAnswer, pasteAnswers, pasteTopics, refitDrafts, subjectDraft, toDrafts, toPayloadKeys,
  type KeyDraft, type SubjectDraft,
} from './answerKeyDraft';
import { MAX_SAMPLE_BYTES, OpticalSamplePreview, readSampleFile, type SampleFile } from './OpticalSamplePreview';
import { OpticalSuggestionPanel } from './OpticalSuggestionPanel';
import { applySuggestion, splitSubject } from './templateSuggestion';
import { nextFreeSubject, SUBJECT_GROUPS, ALL_SUBJECTS } from '../../lib/subjectCatalog';
import { layoutFields, layoutProblems, readingSummary, type LayoutField } from './templateLayout';
import { TopicPicker } from '../../components/topics/TopicPicker';
import { useTopicCatalog } from '../../components/topics/useTopicCatalog';
import { alignTopics, guessLevel, levelPenalty, TOPIC_LEVELS, type TopicOption } from '../../lib/topicCatalog';
import { localDateKey } from '../../lib/localDate';

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
const FIELDS: Array<{ key: FieldKey; label: string; hint: string; note?: string }> = [
  { key: 'studentNo', label: 'Öğrenci no', hint: 'Okul numarasıyla eşleştirilir' },
  {
    key: 'name', label: 'Ad soyad', hint: 'Numara yoksa adla eşleştirilir',
    note: 'Karakter sayısı, ismin harf sayısı değildir. Dosyada bu bilgiye ayrılmış alanın genişliğidir; kısa isimlerde kalan bölüm boşluk olabilir.',
  },
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

/**
 * Ders seçimi listeden yapılır; başka satırda seçilmiş ders listede çıkmaz (aynı ders iki kez
 * eklenemez). Listede olmayan eski bir ders adı varsa korunur ve ayrıca gösterilir.
 */
function SubjectSelect({ value, taken, index, onChange }: { value: string; taken: string[]; index: number; onChange: (name: string) => void }) {
  const legacy = value && !ALL_SUBJECTS.includes(value) ? value : '';
  return (
    <select className={`${selectClass} mt-0`} value={value} aria-label="Ders" onChange={(event) => onChange(event.target.value)}>
      {value ? null : <option value="" disabled>{`Cevap bloğu ${index + 1} — ders seçin`}</option>}
      {legacy ? <option value={legacy}>{`${legacy} (mevcut kayıt)`}</option> : null}
      {SUBJECT_GROUPS.map((group) => {
        const options = group.subjects.filter((subject) => subject === value || !taken.includes(subject));
        return options.length === 0 ? null : (
          <optgroup key={group.label} label={group.label}>
            {options.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

/** Alanın altındaki canlı okuma özeti; renk kutusu önizlemedeki vurguyla aynıdır. */
function ReadingSummary({ field }: { field: LayoutField | undefined }) {
  if (!field) return null;
  const off = field.length <= 0;
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid={`reading-${field.id}`}>
      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
        style={off ? undefined : { backgroundColor: `hsl(${field.color})` }} aria-hidden />
      <span className={off ? 'italic' : ''}>{readingSummary(field)}</span>
    </p>
  );
}

function PositionInputs({ id, start, length, lengthLabel, onStart, onLength }: {
  id: string; start: number; length: number; lengthLabel: string; onStart: (value: number) => void; onLength: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label htmlFor={`${id}-start`} className="text-xs">Başlangıç konumu</Label>
        <Input id={`${id}-start`} inputMode="numeric" value={start} onChange={(event) => onStart(toNumber(event.target.value))} />
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Bilgi satırın kaçıncı karakterinde başlıyor?</p>
      </div>
      <div>
        <Label htmlFor={`${id}-length`} className="text-xs">{lengthLabel}</Label>
        <Input id={`${id}-length`} inputMode="numeric" value={length} onChange={(event) => onLength(toNumber(event.target.value))} />
      </div>
    </div>
  );
}

/**
 * Optik şablon (karakter düzeni) düzenleyici. Teknik bilgisi olmayan kullanıcı için her alanın
 * altında "Her satırın 1–10. karakterleri … olarak okunacak" özeti, çakışma uyarıları ve isteğe
 * bağlı örnek dosya önizlemesi vardır. Karakter sayısı 0 = alan dosyadan okunmaz.
 */
export function OpticalTemplateEditor({ template, open, onClose, onSaved }: {
  template: OpticalTemplateDto | null; open: boolean; onClose: () => void; onSaved: (saved: OpticalTemplateDto) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<SaveOpticalTemplateRequest>(EMPTY_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<SampleFile | null>(null);
  const [suggestion, setSuggestion] = useState<OpticalTemplateSuggestionDto | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [applied, setApplied] = useState(false);
  const [numberChoice, setNumberChoice] = useState('');
  const [splitAt, setSplitAt] = useState<{ index: number; value: string } | null>(null);
  // Her analiz isteğinin numarası: dosya değişince ya da pencere kapanınca artar, geç gelen eski yanıt yok sayılır.
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    setSample(null);
    setSuggestion(null);
    setSuggesting(false);
    setSuggestError('');
    setApplied(false);
    setSplitAt(null);
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

  const fields = layoutFields(form);
  const problems = layoutProblems(fields);
  const fieldOf = (id: string) => fields.find((field) => field.id === id);

  const setSubject = (index: number, patch: Partial<OpticalSubjectBlockDto>) =>
    setForm((current) => ({ ...current, subjects: current.subjects.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const addSubject = () => setForm((current) => {
    const last = current.subjects[current.subjects.length - 1];
    const start = last ? last.start + last.count : 1;
    return { ...current, subjects: [...current.subjects, { name: nextFreeSubject(current.subjects.map((item) => item.name)), start, count: 20 }] };
  });

  const suggestFrom = async (selected: File | undefined) => {
    if (!selected) return;
    const id = ++request.current;
    setSuggestion(null);
    setApplied(false);
    setSuggestError('');
    if (selected.size > MAX_SAMPLE_BYTES) {
      setSuggestError('Dosya 5 MB’tan büyük. Optik çıktısının küçük bir bölümünü (birkaç yüz satır) seçin.');
      return;
    }
    setSuggesting(true);
    try {
      // Önizleme için okuma başarısız olsa da öneri gösterilir (renkli önizleme yalnız yardımcıdır).
      const [file, result] = await Promise.all([readSampleFile(selected).catch(() => null), suggestOpticalTemplate(selected, 'auto')]);
      if (id !== request.current) return;
      setSample(file);
      if (!result) return;
      setSuggestion(result);
      const pick = result.numberCandidates.find((item) => item.start === result.fields.find((field) => field.key === 'studentNo')?.start && !item.constant);
      setNumberChoice(pick?.id ?? '');
      // Yeni şablonda öneri forma hemen yerleşir; düzenlenen şablon ancak "Öneriyi uygula" ile değişir.
      if (!template && result.supported && !result.manualRecommended) {
        setForm((current) => applySuggestion(current, result, pick?.id));
        setApplied(true);
      }
    } catch (error) {
      if (id === request.current) setSuggestError(`Dosya analiz edilemedi: ${errorMessage(error)}. Değerleri elle girebilirsiniz.`);
    } finally {
      if (id === request.current) setSuggesting(false);
    }
  };

  /** Önizleme dosyası değişirse bekleyen analizin yanıtı artık bu dosyaya ait değildir. */
  const changeSample = (next: SampleFile | null) => {
    if (suggesting) {
      request.current += 1;
      setSuggesting(false);
    }
    setSample(next);
  };

  const applyCurrent = (choice = numberChoice) => {
    if (!suggestion) return;
    setForm((current) => applySuggestion(current, suggestion, choice || undefined));
    setApplied(true);
  };

  const chooseNumber = (id: string) => {
    setNumberChoice(id);
    // Uygulanmış öneride numara seçimi değişirse yalnız öğrenci numarası alanı güncellenir.
    const candidate = suggestion?.numberCandidates.find((item) => item.id === id);
    if (applied && candidate) setForm((current) => ({ ...current, studentNoStart: candidate.start, studentNoLength: candidate.length }));
  };

  const subjectProblems = form.subjects.flatMap((subject, index) => (subject.name ? [] : [`Cevap bloğu ${index + 1} için listeden ders seçin.`]));

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
          <DialogDescription>
            Optik okuyucunuzun oluşturduğu TXT/DAT dosyasında öğrenci bilgileri ve cevaplar belirli karakter aralıklarında bulunur. Bu şablon, sistemin her bilgiyi nereden okuyacağını belirler. Karakter sayımı 1’den başlar; boşluklar da karakter sayılır.
          </DialogDescription>
        </DialogHeader>

        <details className="group rounded-xl border px-3 py-2 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <HelpCircle className="h-4 w-4 shrink-0" />Bu değerleri nasıl bulabilirim?
            <ChevronDown className="ml-auto h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Bu sayılar okulun belirlediği bir şey değildir; optik okuyucu cihazının (ve kullanılan optik formun) dosyayı hangi düzende yazdığına göre belirlenir.</li>
            <li>Değerleri cihazın kullanım kılavuzundaki “çıktı formatı / alan düzeni” bölümünden ya da cihazı kullanan yetkiliden öğrenebilirsiniz.</li>
            <li>Yeni şablonda hazır gelen sayılar yalnız örnektir ve sizin cihazınıza uygun olmayabilir. Aşağıdan örnek bir dosya seçip renkli önizlemeyle doğru yerlere denk geldiğini kontrol edin.</li>
            <li>Şablonu bir kez doğru kurduğunuzda, aynı cihaz ve aynı form düzeniyle yapılan sonraki sınavlarda tekrar kullanabilirsiniz.</li>
          </ul>
        </details>

        <div className="min-w-0 space-y-2 rounded-xl border border-dashed p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Dosyadan otomatik şablon öner</p>
              <p className="text-xs text-muted-foreground">Optik okuyucunun TXT/DAT çıktısını seçin; sistem alanların konumlarını önerir. Dosya kaydedilmez, öğrenci ya da sınav sonucu oluşturulmaz.</p>
            </div>
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted ${suggesting ? 'pointer-events-none opacity-60' : ''}`}>
              {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {suggesting ? 'Dosya inceleniyor…' : 'TXT/DAT dosyası seç'}
              <input type="file" accept=".txt,.dat,.TXT,.DAT,text/plain" className="sr-only" aria-label="Öneri için optik dosyası"
                onChange={(event) => { void suggestFrom(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
          </div>
          {suggestError ? <p role="alert" className="text-xs text-destructive">{suggestError}</p> : null}
          {suggestion ? (
            <OpticalSuggestionPanel suggestion={suggestion} applied={applied} numberChoice={numberChoice}
              onChooseNumber={chooseNumber} onApply={() => applyCurrent()} />
          ) : null}
        </div>

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

        <div className="space-y-3">
          <p className="text-sm font-semibold">Öğrenci alanları</p>
          {FIELDS.map((field) => {
            const [start, length] = readField(form, field.key);
            return (
              <div key={field.key} className="space-y-1.5 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-start">
                  <div>
                    <p className="text-sm font-medium">{field.label}</p>
                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                  </div>
                  <PositionInputs id={`tpl-${field.key}`} start={start} length={length} lengthLabel="Karakter sayısı"
                    onStart={(value) => setForm(writeField(form, field.key, value, length))}
                    onLength={(value) => setForm(writeField(form, field.key, start, value))} />
                </div>
                <ReadingSummary field={fieldOf(field.key)} />
                {field.note ? <p className="text-xs leading-snug text-muted-foreground">{field.note}</p> : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ders cevapları (sırayla)</p>
            <Button size="sm" variant="outline" onClick={addSubject} disabled={!nextFreeSubject(form.subjects.map((item) => item.name))}><Plus className="mr-1 h-4 w-4" />Ders ekle</Button>
          </div>
          {form.subjects.map((subject, index) => (
            <div key={index} className="space-y-1.5 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_240px_40px] sm:items-start">
                <div>
                  <Label className="text-xs">Ders</Label>
                  <SubjectSelect value={subject.name} index={index} taken={form.subjects.filter((_, i) => i !== index).map((item) => item.name)}
                    onChange={(name) => setSubject(index, { name })} />
                </div>
                <PositionInputs id={`tpl-subject-${index}`} start={subject.start} length={subject.count} lengthLabel="Soru sayısı"
                  onStart={(value) => setSubject(index, { start: value })} onLength={(value) => setSubject(index, { count: value })} />
                <Button size="icon" variant="ghost" className="sm:mt-5" aria-label="Dersi kaldır" disabled={form.subjects.length === 1}
                  onClick={() => setForm((current) => ({ ...current, subjects: current.subjects.filter((_, i) => i !== index) }))}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
              <ReadingSummary field={fieldOf(`subject-${index}`)} />
              {splitAt?.index === index ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label htmlFor={`tpl-split-${index}`} className="text-xs">İlk kaç soru bu derste?</Label>
                    <Input id={`tpl-split-${index}`} inputMode="numeric" className="h-8 w-28" value={splitAt.value}
                      onChange={(event) => setSplitAt({ index, value: event.target.value })} />
                  </div>
                  <Button size="sm" variant="outline" disabled={!(toNumber(splitAt.value) >= 1 && toNumber(splitAt.value) < subject.count)}
                    onClick={() => { setForm((current) => splitSubject(current, index, toNumber(splitAt.value))); setSplitAt(null); }}>Böl</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSplitAt(null)}>Vazgeç</Button>
                  <p className="w-full text-[11px] text-muted-foreground">{`Kalan ${Math.max(0, subject.count - toNumber(splitAt.value))} soru yeni bir satıra geçer; dersini listeden seçin.`}</p>
                </div>
              ) : subject.count > 1 ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSplitAt({ index, value: '' })}>
                  <Scissors className="mr-1 h-3.5 w-3.5" />Bloğu derslere böl
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {problems.length + subjectProblems.length > 0 ? (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <p className="font-semibold">Kaydetmeden önce düzeltin:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{[...problems, ...subjectProblems].map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : null}

        <OpticalSamplePreview fields={fields} encoding={form.encoding} file={sample} onFile={changeSample} />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={busy || !form.name.trim() || form.subjects.some((item) => !item.name) || problems.length > 0}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PasteNote { kind: 'answers' | 'topics'; range: [number, number] | null; warning: string | null; unlisted?: string[] }

/**
 * Bir dersin soru tablosu: soru numarası sabit, her satırda doğru cevap (A-E, iptal için X) ve
 * isteğe bağlı konu. Satırdayken harf tuşu cevabı seçip sonraki soruya geçer. Çok sorulu
 * denemelerde toplu cevap ve satır satır konu yapıştırılabilir; yerleşen sorular tabloda vurgulanır.
 */
function SubjectKeyTable({ booklet, block, value, onChange, options, onAddTopic, onRemoveTopic }: {
  booklet: string; block: OpticalSubjectBlockDto; value: SubjectDraft; onChange: (next: SubjectDraft) => void;
  options: readonly TopicOption[];
  onAddTopic: (subject: string, name: string) => Promise<string | null>;
  onRemoveTopic: (option: TopicOption) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [topicText, setTopicText] = useState('');
  const [note, setNote] = useState<PasteNote | null>(null);

  // Kitapçık değişince yapıştırma vurgusu o kitapçığa ait değildir.
  useEffect(() => { setNote(null); }, [booklet]);

  const answered = value.answers.filter((answer) => answer).length;
  const topicCount = value.topics.filter((topic) => topic.trim()).length;
  const groupId = (index: number) => `optical-key-${booklet}-${block.name}-${index}`;
  const topicId = (index: number) => `optical-topic-${booklet}-${block.name}-${index}`;
  const [addingAll, setAddingAll] = useState(false);
  // Liste kapanırken odak bir kez daha hücreye döndüğü için sonraki hücreye bir sonraki turda geçilir.
  const focusTopic = (index: number) => window.setTimeout(() => document.getElementById(topicId(Math.min(index, block.count - 1)))?.focus(), 0);

  const setAnswer = (index: number, answer: string) =>
    onChange({ ...value, answers: value.answers.map((item, i) => (i === index ? answer : item)) });
  const setTopic = (index: number, topic: string) =>
    onChange({ ...value, topics: value.topics.map((item, i) => (i === index ? topic : item)) });

  const focusRow = (index: number) => {
    const target = document.getElementById(groupId(index));
    if (target instanceof HTMLElement) target.focus();
  };

  const onAnswerKey = (index: number, event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toUpperCase();
    if (key.length === 1 && normalizeAnswer(key)) {
      event.preventDefault();
      setAnswer(index, normalizeAnswer(key));
      focusRow(Math.min(index + 1, block.count - 1));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(Math.max(0, Math.min(block.count - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      setAnswer(index, '');
    }
  };

  const applyAnswers = () => {
    const result = pasteAnswers(value.answers, answerText);
    if (result.range) onChange({ ...value, answers: result.values });
    setNote({ kind: 'answers', range: result.range, warning: result.warning });
  };
  const applyTopics = () => {
    const result = pasteTopics(value.topics, topicText);
    // Yapıştırılan konular listedeki yazıma çevrilir; listede olmayanlar yazıldığı gibi kalır ve sayılır.
    const pasted = result.range ? alignTopics(options, result.values.slice(0, result.range[1])) : { values: [], unlisted: [] };
    if (result.range) onChange({ ...value, topics: [...pasted.values, ...result.values.slice(pasted.values.length)] });
    setNote({ kind: 'topics', range: result.range, warning: result.warning, unlisted: pasted.unlisted });
  };
  /** Yapıştırmada listede olmayan konuları kurum listesine ekler; hücreler kaydedilen yazıma güncellenir. */
  const addUnlisted = async (names: string[]) => {
    setAddingAll(true);
    const renamed = new Map<string, string>();
    for (const name of names) {
      const saved = await onAddTopic(block.name, name);
      if (saved) renamed.set(name, saved);
    }
    setAddingAll(false);
    onChange({ ...value, topics: value.topics.map((topic) => renamed.get(topic.trim()) ?? topic) });
    setNote((current) => (current ? { ...current, unlisted: names.filter((name) => !renamed.has(name)) } : current));
  };
  const inPaste = (index: number) => Boolean(note?.range && index + 1 >= note.range[0] && index + 1 <= note.range[1]);

  return (
    <section className="rounded-xl border" aria-label={`${block.name} cevap anahtarı`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <h3 className="font-semibold">{block.name}</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className={answered === block.count ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{`${answered} / ${block.count} cevap`}</span>
          <span className="text-muted-foreground">{`${topicCount} konu`}</span>
          <Button size="sm" variant="ghost" onClick={() => setPasteOpen((open) => !open)} aria-expanded={pasteOpen}>
            <ClipboardPaste className="mr-1 h-4 w-4" />Toplu yapıştır
          </Button>
        </div>
      </div>

      {pasteOpen ? (
        <div className="grid gap-3 border-b bg-muted/40 p-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Cevaplar (1. sorudan başlayarak sırayla)</Label>
            <Textarea rows={3} className="font-mono tracking-widest" value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="ABCDEABCDE… ya da 1-A 2-C 3-B" />
            <Button size="sm" variant="outline" onClick={applyAnswers} disabled={!answerText.trim()}>Cevapları yerleştir</Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Konular (her satır bir soru)</Label>
            <Textarea rows={3} value={topicText} onChange={(event) => setTopicText(event.target.value)} placeholder={'Kesirler\nDenklemler\nGeometri\n…'} />
            <Button size="sm" variant="outline" onClick={applyTopics} disabled={!topicText.trim()}>Konuları yerleştir</Button>
          </div>
        </div>
      ) : null}

      {note ? (
        <div role="status" className={`flex items-start gap-2 border-b px-3 py-2 text-xs ${note.warning ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
          {note.warning ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          <span>
            {note.range ? `${note.kind === 'answers' ? 'Cevaplar' : 'Konular'} ${note.range[0]}–${note.range[1]}. sorulara yerleşti (tabloda vurgulu).` : ''}
            {note.warning ? ` ${note.warning}` : ''}
          </span>
        </div>
      ) : null}
      {note?.unlisted && note.unlisted.length > 0 ? (
        <div role="status" className="flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {`Listede yok: ${note.unlisted.length} konu (${note.unlisted.slice(0, 4).join(', ')}${note.unlisted.length > 4 ? '…' : ''}). Yazıldığı gibi kaldı; aynı konu her denemede aynı adla yazılmalı.`}
          </span>
          <Button size="sm" variant="outline" className="h-7" disabled={addingAll} onClick={() => void addUnlisted(note.unlisted ?? [])}>
            {addingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}Hepsini listeye ekle
          </Button>
        </div>
      ) : null}

      {/* Dar ekranda her soru iki satır olur: soru + cevaplar, altında konu. */}
      <table className="block w-full text-sm sm:table">
        <thead className="hidden bg-muted/60 text-xs text-muted-foreground sm:table-header-group">
          <tr>
            <th scope="col" className="w-24 px-3 py-2 text-left font-medium">Soru</th>
            <th scope="col" className="w-64 px-3 py-2 text-left font-medium">Doğru Cevap</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Konu</th>
          </tr>
        </thead>
        <tbody className="block sm:table-row-group">
          {value.answers.map((answer, index) => (
            <tr key={index} className={`flex flex-wrap items-center border-t sm:table-row ${inPaste(index) ? 'bg-sky-500/15' : ''}`} data-testid="optical-key-row">
              <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-medium tabular-nums">{`${index + 1}. Soru`}</th>
              <td className="px-3 py-1.5">
                <div id={groupId(index)} role="radiogroup" aria-label={`${index + 1}. soru doğru cevap`} tabIndex={0}
                  onKeyDown={(event) => onAnswerKey(index, event)}
                  className="inline-flex gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {ANSWER_CHOICES.map((choice) => {
                    const selected = answer === choice;
                    return (
                      <button key={choice} type="button" role="radio" aria-checked={selected} tabIndex={-1}
                        title={choice === 'X' ? 'İptal edilen soru' : undefined}
                        onClick={() => setAnswer(index, selected ? '' : choice)}
                        className={`h-7 w-7 rounded-md border text-xs font-semibold transition ${selected
                          ? choice === 'X' ? 'border-rose-600 bg-rose-600 text-white' : 'border-foreground bg-foreground text-background'
                          : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </td>
              <td className="w-full px-3 pb-2 sm:w-auto sm:py-1.5">
                <TopicPicker inputId={topicId(index)} value={value.topics[index] ?? ''} options={options}
                  label={`${index + 1}. soru konusu`} onChange={(topic) => setTopic(index, topic)}
                  onAdd={(name) => onAddTopic(block.name, name)} onRemove={onRemoveTopic}
                  onNext={() => focusTopic(index + 1)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Deneme: puanlama kuralları + kitapçık başına soru tablosu (cevap anahtarı ve soru-konu eşleşmesi). */
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
  const [level, setLevel] = useState('');
  const levelTouched = useRef(false);
  const [keys, setKeys] = useState<KeyDraft[]>([]);
  const [active, setActive] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const template = templates.find((item) => item.id === templateId);
  const blocks = template?.subjects ?? [];

  useEffect(() => {
    if (!open) return;
    const firstTemplate = exam?.templateId ?? templates[0]?.id ?? '';
    setTitle(exam?.title ?? '');
    setDate(localDateKey(exam?.examDateUtc ? new Date(exam.examDateUtc) : new Date()));
    setTemplateId(firstTemplate);
    setPenalty(exam?.wrongPenalty ?? 4);
    setMultiWrong(exam?.multiMarkAsWrong ?? true);
    setCancelledMode(exam?.cancelledMode ?? 'exclude');
    const firstTemplateDto = templates.find((item) => item.id === firstTemplate);
    const firstBlocks = firstTemplateDto?.subjects ?? [];
    // Eski denemede seviye yoksa tahmin edilir; yalnız konu listesini daraltır, kaydedince saklanır.
    setLevel(exam?.level || guessLevel(firstBlocks, exam?.wrongPenalty ?? 4, firstTemplateDto?.name));
    setKeys(toDrafts(exam?.keys ?? [], firstBlocks));
    setActive(0);
    setProblems([]);
    levelTouched.current = false;
  }, [open, exam, templates]);

  // Konu listesi: seviye ya da şablon dersleri değişince yeniden alınır.
  const topics = useTopicCatalog(level, blocks.map((block) => block.name), open);

  const changeLevel = (next: string) => {
    setLevel(next);
    const penaltyForLevel = levelPenalty(next);
    if (!exam && penaltyForLevel !== null) setPenalty(penaltyForLevel);
  };

  const changeTemplate = (id: string) => {
    setTemplateId(id);
    // Yeni denemede seviye henüz elle seçilmediyse yeni şablona göre yeniden tahmin edilir.
    const next = templates.find((item) => item.id === id);
    if (!exam && !levelTouched.current && next) changeLevel(guessLevel(next.subjects, penalty, next.name));
    setKeys((current) => refitDrafts(current, templates.find((item) => item.id === id)?.subjects ?? []));
    setProblems([]);
  };

  const setSubject = (subject: string, next: SubjectDraft) =>
    setKeys((current) => current.map((key, index) => (index === active ? { ...key, subjects: { ...key.subjects, [subject]: next } } : key)));

  const addBooklet = () => setKeys((current) => {
    const next = String.fromCharCode('A'.charCodeAt(0) + current.length);
    setActive(current.length);
    return [...current, emptyKey(next, blocks)];
  });

  /** A kitapçığının konularını seçili kitapçığa aynı soru sırasıyla kopyalar (sıra aynıysa). */
  const copyTopicsFromFirst = () => setKeys((current) => current.map((key, index) => {
    const first = current[0];
    if (index !== active || index === 0 || !first) return key;
    return {
      ...key,
      subjects: Object.fromEntries(Object.entries(key.subjects).map(([name, value]) => [name, { ...value, topics: [...(first.subjects[name]?.topics ?? value.topics)] }])),
    };
  }));

  const save = async () => {
    const missing = missingAnswers(keys, blocks);
    setProblems(missing);
    if (missing.length > 0) {
      toast({ title: 'Cevap anahtarı eksik', description: 'Her sorunun doğru cevabını seçin (iptal edilen soru için X).', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await saveOpticalExam(exam?.id ?? null, {
        title,
        examDateUtc: new Date(`${date}T09:00:00Z`).toISOString(),
        templateId,
        wrongPenalty: penalty,
        multiMarkAsWrong: multiWrong,
        cancelledMode,
        keys: toPayloadKeys(keys, blocks),
        level,
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
  const bookletAnswered = (key: KeyDraft) => blocks.reduce((sum, block) => sum + (key.subjects[block.name]?.answers.filter((answer) => answer).length ?? 0), 0);
  const totalQuestions = blocks.reduce((sum, block) => sum + block.count, 0);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{exam ? 'Denemeyi düzenle' : 'Yeni optik deneme'}</DialogTitle>
          <DialogDescription>Her soru için doğru cevabı ve isteğe bağlı konusunu girin. Konular, öğrenci konu analizinde kullanılır.</DialogDescription>
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
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="exam-level">Seviye (konu listesi)</Label>
            <select id="exam-level" className={selectClass} value={level} onChange={(event) => { levelTouched.current = true; changeLevel(event.target.value); }}>
              <option value="">Tüm seviyeler</option>
              {TOPIC_LEVELS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
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
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Kitapçıklar">
              {keys.map((key, index) => (
                <Button key={key.booklet} size="sm" role="tab" aria-selected={index === active} variant={index === active ? 'default' : 'outline'} onClick={() => setActive(index)}>
                  {`${key.booklet} kitapçığı`}
                  <span className="ml-1.5 text-[11px] opacity-75 tabular-nums">{`${bookletAnswered(key)}/${totalQuestions}`}</span>
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={addBooklet} disabled={keys.length >= 6}><Plus className="mr-1 h-4 w-4" />Kitapçık ekle</Button>
              {active > 0 ? <Button size="sm" variant="ghost" onClick={copyTopicsFromFirst}>Konuları A’dan kopyala</Button> : null}
              {keys.length > 1 ? (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { setKeys((list) => list.filter((_, i) => i !== active)); setActive(0); }}>
                  <Trash2 className="mr-1 h-4 w-4" />Kitapçığı kaldır
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Kitapçıkların cevap ve konuları ayrı tutulur. Satırdayken A–E ya da X tuşuna basmak cevabı seçip sonraki soruya geçer.</p>
            <p className="text-xs text-muted-foreground">
              Konu hücresine yazdıkça seçilen seviyedeki dersin konuları süzülür; Enter seçip sonraki soruya geçer. Listede olmayan konuyu yalnız o soruya yazabilir ya da kurum listesine ekleyebilirsiniz.
            </p>
            {topics.error ? (
              <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Konu listesi alınamadı; konuları elle yazabilirsiniz.</p>
            ) : null}
            {current ? blocks.map((block) => (
              <SubjectKeyTable key={`${current.booklet}-${block.name}`} booklet={current.booklet} block={block}
                value={current.subjects[block.name] ?? subjectDraft(block.count, '', [])}
                onChange={(next) => setSubject(block.name, next)}
                options={topics.optionsFor(block.name)} onAddTopic={topics.add} onRemoveTopic={(option) => void topics.remove(option)} />
            )) : null}
          </div>
        )}

        {problems.length > 0 ? (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <p className="font-semibold">Kaydetmeden önce tamamlayın:</p>
            <ul className="mt-1 list-disc pl-4">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void save()} disabled={busy || !title.trim() || !template}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
