import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlignCenter, AlignLeft, AlignRight, Bookmark, Check, Code2, Eye,
  GripVertical, Highlighter, Image, Italic, Link2, List, ListOrdered,
  Loader2, Maximize2, Paperclip, Plus, RotateCw, Save, Table2, Trash2,
  Upload, X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { DrawingCanvas } from '../../features/solving/canvas/DrawingCanvas';
import { desktopApiBaseUrl } from '../../lib/auth';
import {
  createPlannedExam,
  createQuestionBankItem,
  saveQuestionStudioDraft,
  uploadFile,
} from '../../lib/api/modules';

const QUESTION_TYPES = [
  'Çoktan Seçmeli', 'Açık Uçlu', 'Doğru / Yanlış', 'Boşluk Doldurma',
  'Grafik Yorumlama', 'Kod Sorusu', 'Matematik Sorusu',
];

const freshOptions = () => Array.from({ length: 4 }, (_, index) => ({
  id: `option-${Date.now()}-${index}`,
  text: '',
  imagePath: '',
  correct: index === 0,
}));

const freshSettings = () => ({
  subject: 'Matematik',
  topic: '',
  outcome: '',
  difficulty: 'Orta',
  point: '5',
  classLevel: 'Tüm Sınıflar',
  estimatedSeconds: '90',
  tags: '',
  description: '',
  publishStatus: 'Published',
  addSolution: true,
  addHint: false,
  addVisual: true,
});

function plainText(html) {
  const element = document.createElement('div');
  element.innerHTML = html || '';
  return (element.textContent || element.innerText || '').trim();
}

function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return new URL(path, desktopApiBaseUrl).toString();
}

function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

export default function TeacherQuestionStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useApp();
  const isExamMode = searchParams.get('mode') === 'exam';
  const editorRef = useRef(null);
  const solutionRef = useRef(null);
  const imageInputRef = useRef(null);
  const solutionFileRef = useRef(null);
  const canvasSnapshotRef = useRef('');
  const draggedOptionRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const [activeType, setActiveType] = useState('Çoktan Seçmeli');
  const [questionHtml, setQuestionHtml] = useState('');
  const [solutionHtml, setSolutionHtml] = useState('');
  const [expectedAnswer, setExpectedAnswer] = useState('');
  const [options, setOptions] = useState(freshOptions);
  const [settings, setSettings] = useState(freshSettings);
  const [visual, setVisual] = useState({ align: 'center', width: 65, rotation: 0, caption: '' });
  const [assetPath, setAssetPath] = useState('');
  const [solutionAssetPath, setSolutionAssetPath] = useState('');
  const [canvasStrokes, setCanvasStrokes] = useState([]);
  const [draftId, setDraftId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState('Kayda hazır');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examForm, setExamForm] = useState({
    title: '', className: '', dateLabel: '', duration: '40 dk', type: 'MockExam',
  });

  const choiceType = activeType === 'Çoktan Seçmeli' || activeType === 'Doğru / Yanlış';
  const correctIndex = useMemo(() => options.findIndex((option) => option.correct), [options]);

  const touch = useCallback(() => {
    setDirty(true);
    setAutosave('Kaydediliyor...');
  }, []);

  const draftPayload = useCallback(() => ({
    activeType,
    questionHtml,
    solutionHtml,
    expectedAnswer,
    options,
    settings,
    visual,
    assetPath,
    solutionAssetPath,
    canvasStrokes,
    examForm: isExamMode ? examForm : null,
    examQuestions: isExamMode ? examQuestions : [],
  }), [activeType, assetPath, canvasStrokes, examForm, examQuestions, expectedAnswer, isExamMode, options, questionHtml, settings, solutionAssetPath, solutionHtml, visual]);

  const persistDraft = useCallback(async (showToast = false) => {
    const response = await saveQuestionStudioDraft({
      id: draftId,
      title: plainText(questionHtml).slice(0, 80) || (isExamMode ? examForm.title || 'Deneme Sınavı Taslağı' : 'Soru Taslağı'),
      mode: isExamMode ? 'MockExam' : 'QuestionBank',
      payloadJson: JSON.stringify(draftPayload()),
    });
    setDraftId(response.id);
    setDirty(false);
    setAutosave('Canlı taslak kaydedildi');
    if (showToast) toast({ title: 'Taslak kaydedildi', description: 'Değişiklikler canlı backend üzerinde saklandı.' });
  }, [draftId, draftPayload, examForm.title, isExamMode, questionHtml, toast]);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      persistDraft().catch((error) => setAutosave(`Kaydedilemedi: ${error.message}`));
    }, 1200);
    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [dirty, persistDraft, saving]);

  const command = (name, value = null) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    setQuestionHtml(editorRef.current?.innerHTML || '');
    touch();
  };

  const insertLink = () => {
    const url = window.prompt('Bağlantı adresi (https://...)');
    if (url) command('createLink', url);
  };

  const insertMath = () => {
    const expression = window.prompt('LaTeX formülünü yazın', '\\frac{a}{b}');
    if (!expression) return;
    command('insertHTML', `<span class="rounded bg-orange-500/10 px-2 py-1 font-mono text-orange-200" data-latex="${expression.replaceAll('"', '&quot;')}">\\(${expression}\\)</span>&nbsp;`);
  };

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    touch();
  };

  const changeQuestionType = (type) => {
    setActiveType(type);
    if (type === 'Doğru / Yanlış') {
      setOptions([
        { id: `true-${Date.now()}`, text: 'Doğru', imagePath: '', correct: true },
        { id: `false-${Date.now()}`, text: 'Yanlış', imagePath: '', correct: false },
      ]);
    } else if (activeType === 'Doğru / Yanlış') {
      setOptions(freshOptions());
    }
    touch();
  };

  const uploadAsset = async (file, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await uploadFile(formData, folder);
    return uploaded?.fileUrl || uploaded?.url || uploaded?.path || '';
  };

  const handleQuestionImage = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const path = await uploadAsset(file, 'question-studio/images');
      setAssetPath(path);
      touch();
      toast({ title: 'Görsel yüklendi', description: 'Görsel canlı depolamaya kaydedildi ve soruya bağlandı.' });
    } catch (error) {
      toast({ title: 'Görsel yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleOptionImage = async (id, file) => {
    if (!file) return;
    try {
      setUploading(true);
      const path = await uploadAsset(file, 'question-studio/options');
      setOptions((current) => current.map((option) => (option.id === id ? { ...option, imagePath: path } : option)));
      touch();
    } catch (error) {
      toast({ title: 'Şık görseli yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSolutionFile = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const path = await uploadAsset(file, 'question-studio/solutions');
      setSolutionAssetPath(path);
      touch();
      toast({ title: 'Çözüm dosyası bağlandı' });
    } catch (error) {
      toast({ title: 'Çözüm dosyası yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const uploadCanvasSnapshot = async () => {
    if (!canvasSnapshotRef.current) {
      toast({ title: 'Çizim yok', description: 'Önce çözüm alanında bir çizim yapın.', variant: 'destructive' });
      return;
    }
    const blob = await fetch(canvasSnapshotRef.current).then((response) => response.blob());
    await handleSolutionFile(new File([blob], `cozum-${Date.now()}.png`, { type: 'image/png' }));
  };

  const updateOption = (id, patch) => {
    setOptions((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    touch();
  };

  const markCorrect = (id) => {
    setOptions((items) => items.map((item) => ({
      ...item,
      correct: item.id === id,
    })));
    touch();
  };

  const moveOption = (targetId) => {
    const sourceId = draggedOptionRef.current;
    if (!sourceId || sourceId === targetId) return;
    setOptions((items) => {
      const sourceIndex = items.findIndex((item) => item.id === sourceId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      const next = [...items];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
    touch();
  };

  const resetQuestion = () => {
    setActiveType('Çoktan Seçmeli');
    setQuestionHtml('');
    setSolutionHtml('');
    setExpectedAnswer('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    if (solutionRef.current) solutionRef.current.innerHTML = '';
    setOptions(freshOptions());
    setAssetPath('');
    setSolutionAssetPath('');
    setCanvasStrokes([]);
    setVisual({ align: 'center', width: 65, rotation: 0, caption: '' });
    setSettings((current) => ({ ...freshSettings(), subject: current.subject, classLevel: current.classLevel }));
  };

  const buildQuestionPayload = () => {
    const selectedOptions = choiceType
      ? options
          .map((option, originalIndex) => ({ ...option, originalIndex }))
          .filter((item) => item.text.trim())
      : [];
    const filteredCorrectIndex = selectedOptions.findIndex((item) => item.correct);

    return {
      subject: settings.subject,
      topic: settings.topic.trim(),
      difficulty: settings.difficulty,
      type: activeType,
      questionText: plainText(questionHtml),
      teacher: user?.name || 'Öğretmen',
      imagePath: assetPath || null,
      imagePlacement: visual.align === 'left' ? 'Left' : visual.align === 'right' ? 'Right' : 'Top',
      options: selectedOptions.map((item) => item.text.trim()),
      correctOptionIndex: choiceType ? Math.max(0, filteredCorrectIndex) : null,
      classTargets: [settings.classLevel || 'Tüm Sınıflar'],
      solutionAssetPath: solutionAssetPath || null,
      solutionAssetType: solutionAssetPath ? 'studio-asset' : null,
      revealCorrectAnswerToStudent: settings.publishStatus === 'Published',
      expectedAnswer: choiceType ? null : expectedAnswer.trim() || null,
      richTextHtml: questionHtml || null,
      solutionTextHtml: solutionHtml || null,
      editorMetadataJson: JSON.stringify({
        settings,
        visual,
        optionAssets: selectedOptions.map(({ id, imagePath, originalIndex }, index) => ({
          id,
          index,
          originalIndex,
          imagePath,
        })),
        canvasStrokes,
      }),
      publicationStatus: settings.publishStatus,
    };
  };

  const validateQuestion = () => {
    if (!plainText(questionHtml) || !settings.topic.trim()) return 'Soru metni ve konu zorunlu.';
    if (choiceType && options.filter((item) => item.text.trim()).length < 2) return 'Seçenekli sorularda en az iki şık zorunlu.';
    if (choiceType && correctIndex < 0) return 'Doğru cevap seçilmelidir.';
    if (choiceType && !options[correctIndex]?.text.trim()) return 'Doğru cevap olarak seçilen şık boş olamaz.';
    if (!choiceType && !expectedAnswer.trim()) return 'Açık yanıtlı sorularda beklenen cevap zorunlu.';
    return '';
  };

  const saveQuestion = async () => {
    const invalid = validateQuestion();
    if (invalid) {
      toast({ title: 'Eksik bilgi', description: invalid, variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await createQuestionBankItem(buildQuestionPayload());
      if (isExamMode) {
        setExamQuestions((current) => [...current, created]);
        resetQuestion();
        toast({ title: 'Soru sınava eklendi', description: 'Yeni soru için editör temizlendi.' });
      } else {
        toast({ title: 'Soru kaydedildi', description: 'Biçim, görsel ve çözüm verileriyle soru bankasına kaydedildi.' });
        navigate('/t/question-bank');
      }
    } catch (error) {
      toast({ title: 'Soru kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const publishExam = async () => {
    if (!examForm.title.trim() || !examForm.className.trim() || !examForm.dateLabel || examQuestions.length === 0) {
      toast({ title: 'Deneme tamamlanmadı', description: 'Başlık, sınıf, tarih ve en az bir kayıtlı soru zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await createPlannedExam({
        ...examForm,
        subject: settings.subject,
        questionCount: examQuestions.length,
        teacherName: user?.name || 'Öğretmen',
        sourceType: 'Soru Bankası',
        sources: examQuestions.map((question) => ({
          questionId: question.id,
          title: question.questionText,
          type: question.type,
          subject: question.subject,
          imagePath: question.imagePath,
          imagePlacement: question.imagePlacement,
        })),
      });
      toast({ title: 'Deneme sınavı oluşturuldu', description: 'Sınav canlı olarak planlandı ve soruları bağlandı.' });
      navigate('/t/mock-exams');
    } catch (error) {
      toast({ title: 'Sınav oluşturulamadı', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-[34px] border border-white/10 bg-[#060b14] text-white shadow-2xl shadow-slate-950/30">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-[minmax(620px,1fr)_360px]">
        <main className="min-w-0 overflow-y-auto p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black">{isExamMode ? 'Deneme Sınavları' : 'Soru Bankası'}</h1>
              <p className="mt-1 text-sm text-slate-400">{isExamMode ? 'Yeni deneme oluştur' : 'Yeni soru oluştur'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setPreviewOpen(true)} className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Eye className="mr-2 h-4 w-4" />Önizleme</Button>
              <Button variant="outline" disabled={saving} onClick={() => persistDraft(true)} className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Bookmark className="mr-2 h-4 w-4" />Taslak Kaydet</Button>
              <Button disabled={saving} onClick={saveQuestion} className="bg-orange-500 text-white hover:bg-orange-600">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{isExamMode ? 'Soruyu Sınava Ekle' : 'Soruyu Kaydet'}</Button>
            </div>
          </div>

          {isExamMode && (
            <section className="mb-5 rounded-[28px] border border-orange-400/20 bg-orange-500/[0.07] p-5">
              <div className="grid gap-3 lg:grid-cols-5">
                <Field label="Deneme Adı"><Input value={examForm.title} onChange={(event) => { setExamForm((v) => ({ ...v, title: event.target.value })); touch(); }} placeholder="TYT Matematik Deneme 1" className="border-white/10 bg-white/5 text-white" /></Field>
                <Field label="Sınıf"><Input value={examForm.className} onChange={(event) => { setExamForm((v) => ({ ...v, className: event.target.value })); touch(); }} placeholder="12/A" className="border-white/10 bg-white/5 text-white" /></Field>
                <Field label="Tarih"><Input value={examForm.dateLabel} onChange={(event) => { setExamForm((v) => ({ ...v, dateLabel: event.target.value })); touch(); }} placeholder="25 Mayıs 2026" className="border-white/10 bg-white/5 text-white" /></Field>
                <Field label="Süre"><Input value={examForm.duration} onChange={(event) => { setExamForm((v) => ({ ...v, duration: event.target.value })); touch(); }} className="border-white/10 bg-white/5 text-white" /></Field>
                <div className="flex items-end"><Button onClick={publishExam} disabled={saving} className="w-full bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-2 h-4 w-4" />Denemeyi Yayınla</Button></div>
              </div>
              {examQuestions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {examQuestions.map((question, index) => (
                    <span key={question.id} className="rounded-xl border border-orange-400/20 bg-black/20 px-3 py-2 text-xs text-orange-100">
                      {index + 1}. {question.questionText.slice(0, 42)}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
            <h1 className="text-2xl font-black">{isExamMode ? 'Deneme İçin Soru Oluştur' : 'Yeni Soru Oluştur'}</h1>
            <p className="mt-1 text-sm text-slate-400">Biçimli metin, medya, çözüm ve çizim verileri canlı backend üzerinde saklanır.</p>
            <div className="my-5 flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => (
                <button key={type} type="button" onClick={() => changeQuestionType(type)} className={`rounded-2xl border px-4 py-2 text-sm font-bold ${activeType === type ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>{type}</button>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="font-black">Soru Metni</h2><span className="text-xs text-slate-400">Word, görsel ve LaTeX destekli</span></div>
              <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-3 text-slate-300">
                {[
                  ['bold', <b key="b">B</b>], ['italic', <Italic key="i" className="h-4 w-4" />], ['underline', <u key="u">U</u>],
                  ['strikeThrough', <span key="s">S</span>], ['insertUnorderedList', <List key="l" className="h-4 w-4" />],
                  ['insertOrderedList', <ListOrdered key="o" className="h-4 w-4" />], ['justifyLeft', <AlignLeft key="al" className="h-4 w-4" />],
                  ['justifyCenter', <AlignCenter key="ac" className="h-4 w-4" />], ['justifyRight', <AlignRight key="ar" className="h-4 w-4" />],
                ].map(([cmd, icon]) => <button key={cmd} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command(cmd)} className="rounded-xl p-2 hover:bg-white/10">{icon}</button>)}
                <span className="mx-2 h-6 w-px bg-white/10" />
                <button type="button" onClick={() => command('formatBlock', 'H3')} className="rounded-xl px-3 py-2 text-sm hover:bg-white/10">Başlık</button>
                <button type="button" onClick={() => command('hiliteColor', '#7c2d12')} className="rounded-xl p-2 hover:bg-white/10"><Highlighter className="h-4 w-4" /></button>
                <button type="button" onClick={insertLink} className="rounded-xl p-2 hover:bg-white/10"><Link2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => command('insertHTML', '<pre><code>Kodunuzu buraya yazın</code></pre>')} className="rounded-xl p-2 hover:bg-white/10"><Code2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => command('insertHTML', '<table border=\"1\"><tbody><tr><td>Hücre</td><td>Hücre</td></tr><tr><td>Hücre</td><td>Hücre</td></tr></tbody></table>')} className="rounded-xl p-2 hover:bg-white/10"><Table2 className="h-4 w-4" /></button>
                <button type="button" onClick={insertMath} className="rounded-xl px-3 py-2 font-mono text-sm hover:bg-white/10">LaTeX</button>
                <button type="button" disabled={!settings.addVisual} onClick={() => imageInputRef.current?.click()} className="rounded-xl p-2 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"><Image className="h-4 w-4" /></button>
                <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => handleQuestionImage(event.target.files?.[0])} />
              </div>
              <div ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Soru metnini yazın..." onInput={(event) => { setQuestionHtml(event.currentTarget.innerHTML); touch(); }} onPaste={(event) => { const file = Array.from(event.clipboardData.files || []).find((item) => item.type.startsWith('image/')); if (file) { event.preventDefault(); handleQuestionImage(file); } }} className="min-h-[200px] px-5 py-4 text-base leading-8 text-slate-100 outline-none empty:before:text-slate-500 empty:before:content-[attr(data-placeholder)]" />
              {settings.addVisual && assetPath && (
                <figure className={`m-5 flex flex-col ${visual.align === 'left' ? 'items-start' : visual.align === 'right' ? 'items-end' : 'items-center'}`}>
                  <img src={assetUrl(assetPath)} alt={visual.caption || 'Soru görseli'} className="rounded-2xl border border-white/10 object-contain" style={{ width: `${visual.width}%`, transform: `rotate(${visual.rotation}deg)` }} />
                  {visual.caption && <figcaption className="mt-2 text-sm text-slate-400">{visual.caption}</figcaption>}
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-2">
                    {['left', 'center', 'right'].map((align) => <button key={align} type="button" onClick={() => { setVisual((value) => ({ ...value, align })); touch(); }} className={`rounded-lg p-2 ${visual.align === align ? 'bg-orange-500/25 text-orange-200' : ''}`}>{align === 'left' ? <AlignLeft className="h-4 w-4" /> : align === 'right' ? <AlignRight className="h-4 w-4" /> : <AlignCenter className="h-4 w-4" />}</button>)}
                    <Input type="range" min="20" max="100" value={visual.width} onChange={(event) => { setVisual((value) => ({ ...value, width: Number(event.target.value) })); touch(); }} className="h-8 w-32 border-0 bg-transparent" />
                    <button type="button" onClick={() => { setVisual((value) => ({ ...value, rotation: value.rotation + 90 })); touch(); }} className="rounded-lg p-2 hover:bg-white/10"><RotateCw className="h-4 w-4" /></button>
                    <button type="button" onClick={() => { setAssetPath(''); touch(); }} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10"><X className="h-4 w-4" /></button>
                  </div>
                  <Input value={visual.caption} onChange={(event) => { setVisual((value) => ({ ...value, caption: event.target.value })); touch(); }} placeholder="Görsel açıklaması" className="mt-2 max-w-md border-white/10 bg-white/5 text-white" />
                </figure>
              )}
            </div>

            {choiceType && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between"><h2 className="font-black">Seçenekler</h2><Button variant="ghost" onClick={() => { setOptions((items) => [...items, { id: `option-${Date.now()}`, text: '', imagePath: '', correct: false }]); touch(); }} className="text-orange-300"><Plus className="mr-2 h-4 w-4" />Seçenek Ekle</Button></div>
                {options.map((option, index) => (
                  <div key={option.id} draggable onDragStart={() => { draggedOptionRef.current = option.id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => moveOption(option.id)} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${option.correct ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                    <GripVertical className="h-4 w-4 cursor-grab text-slate-500" />
                    <button type="button" onClick={() => markCorrect(option.id)} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${option.correct ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300'}`}>{optionLetter(index)}</button>
                    <Input value={option.text} onChange={(event) => updateOption(option.id, { text: event.target.value })} placeholder="Şık metni veya LaTeX" className="border-white/10 bg-transparent text-white" />
                    {option.imagePath && <img src={assetUrl(option.imagePath)} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                    <label className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-white/10"><Image className="h-4 w-4" /><input type="file" accept="image/*" className="hidden" onChange={(event) => handleOptionImage(option.id, event.target.files?.[0])} /></label>
                    <button type="button" onClick={() => { if (options.length > 2) { setOptions((items) => items.filter((item) => item.id !== option.id)); touch(); } }} className="rounded-xl p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            {settings.addSolution && (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Çözüm ve Çizim</h2><div className="flex gap-2"><Button variant="outline" onClick={() => solutionFileRef.current?.click()} className="border-white/10 text-white"><Paperclip className="mr-2 h-4 w-4" />Dosya</Button><Button variant="outline" onClick={() => setCanvasOpen(true)} className="border-white/10 text-white"><Maximize2 className="mr-2 h-4 w-4" />Çizim Alanı</Button></div></div>
                <input ref={solutionFileRef} type="file" className="hidden" onChange={(event) => handleSolutionFile(event.target.files?.[0])} />
                <div ref={solutionRef} contentEditable suppressContentEditableWarning data-placeholder="Çözüm açıklamasını yazın..." onInput={(event) => { setSolutionHtml(event.currentTarget.innerHTML); touch(); }} className="min-h-[130px] rounded-2xl border border-white/10 bg-white/[0.035] p-4 leading-7 outline-none empty:before:text-slate-500 empty:before:content-[attr(data-placeholder)]" />
                {!choiceType && <Input value={expectedAnswer} onChange={(event) => { setExpectedAnswer(event.target.value); touch(); }} placeholder="Değerlendirmede kullanılacak kısa doğru cevap" className="mt-4 border-white/10 bg-white/5 text-white" />}
                {solutionAssetPath && <a href={assetUrl(solutionAssetPath)} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-orange-300">Yüklenen çözüm dosyasını görüntüle</a>}
                {settings.addHint && <Textarea value={settings.hint || ''} onChange={(event) => updateSetting('hint', event.target.value)} placeholder="Öğrenciye gösterilecek ipucunu yazın..." className="mt-4 min-h-[72px] border-white/10 bg-white/5 text-white" />}
              </div>
            )}
          </section>
        </main>

        <aside className="overflow-y-auto border-l border-white/10 bg-slate-950/70 p-5">
          <h2 className="mb-5 text-lg font-black">Soru Ayarları</h2>
          <div className="space-y-4">
            <Field label="Ders"><Select value={settings.subject} onValueChange={(value) => updateSetting('subject', value)}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent>{['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Konu"><Input value={settings.topic} onChange={(event) => updateSetting('topic', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Kazanım"><Input value={settings.outcome} onChange={(event) => updateSetting('outcome', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Zorluk Seviyesi"><div className="grid grid-cols-3 gap-2">{['Kolay', 'Orta', 'Zor'].map((item) => <button key={item} type="button" onClick={() => updateSetting('difficulty', item)} className={`rounded-2xl border px-3 py-2 text-sm font-bold ${settings.difficulty === item ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>{item}</button>)}</div></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Puan"><Input value={settings.point} onChange={(event) => updateSetting('point', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field><Field label="Süre (sn)"><Input value={settings.estimatedSeconds} onChange={(event) => updateSetting('estimatedSeconds', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field></div>
            <Field label="Sınıf"><Input value={settings.classLevel} onChange={(event) => updateSetting('classLevel', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Etiketler"><Input value={settings.tags} onChange={(event) => updateSetting('tags', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Açıklama"><Textarea value={settings.description} onChange={(event) => updateSetting('description', event.target.value)} className="min-h-[80px] border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Yayın Durumu"><Select value={settings.publishStatus} onValueChange={(value) => updateSetting('publishStatus', value)}><SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Published">Yayında</SelectItem><SelectItem value="Draft">Taslak</SelectItem></SelectContent></Select></Field>
            {[['addSolution', 'Çözüm Alanı'], ['addHint', 'İpucu'], ['addVisual', 'Görsel']].map(([key, label]) => <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><span className="text-sm text-slate-300">{label}</span><Switch checked={!!settings[key]} onCheckedChange={(value) => updateSetting(key, value)} /></div>)}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">Autosave: <span className="font-bold text-orange-200">{autosave}</span>{uploading && <span className="ml-2">Dosya yükleniyor...</span>}</div>
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-white/10 bg-[#08111f] text-white">
          <DialogHeader><DialogTitle>Soru Önizleme</DialogTitle></DialogHeader>
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-orange-300">{settings.subject} / {settings.topic || 'Konu seçilmedi'} / {settings.difficulty}</p>
            <div className="leading-8" dangerouslySetInnerHTML={{ __html: questionHtml || '<p class=\"text-slate-500\">Soru metni henüz yazılmadı.</p>' }} />
            {assetPath && <img src={assetUrl(assetPath)} alt={visual.caption || 'Soru görseli'} className="mx-auto my-5 rounded-2xl object-contain" style={{ width: `${visual.width}%`, transform: `rotate(${visual.rotation}deg)` }} />}
            {choiceType && <div className="mt-5 grid gap-3 sm:grid-cols-2">{options.filter((item) => item.text.trim()).map((option, index) => <div key={option.id} className={`rounded-2xl border p-3 ${option.correct ? 'border-emerald-500/45 bg-emerald-500/10' : 'border-white/10'}`}><div><b className="mr-3 text-orange-300">{optionLetter(index)}</b>{option.text}</div>{option.imagePath && <img src={assetUrl(option.imagePath)} alt="" className="mt-3 h-24 w-full rounded-xl object-contain" />}</div>)}</div>}
            {solutionHtml && <div className="mt-6 rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4"><p className="mb-2 font-bold text-purple-200">Çözüm</p><div dangerouslySetInnerHTML={{ __html: solutionHtml }} /></div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={canvasOpen} onOpenChange={setCanvasOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-white/10 bg-[#08111f] text-white">
          <DialogHeader><DialogTitle>Çözüm Çizim Alanı</DialogTitle></DialogHeader>
          <DrawingCanvas questionAttemptId="question-studio-live" onSnapshot={(dataUrl) => { canvasSnapshotRef.current = dataUrl; setAutosave('Çizim kaydedilmeyi bekliyor'); }} onStrokeComplete={(stroke) => { setCanvasStrokes((items) => [...items, stroke]); touch(); }} />
          <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setCanvasOpen(false)} className="border-white/10 text-white">Kapat</Button><Button onClick={async () => { await uploadCanvasSnapshot(); setCanvasOpen(false); }} className="bg-orange-500 text-white"><Upload className="mr-2 h-4 w-4" />Çizimi Kaydet</Button></div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Field({ label, children }) {
  return <div className="space-y-2"><Label className="text-xs font-bold text-slate-400">{label}</Label>{children}</div>;
}
