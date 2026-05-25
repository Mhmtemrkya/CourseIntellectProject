import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlignCenter, AlignLeft, AlignRight, BookOpen, Bookmark, Brain, Check, ChevronDown, Code2,
  Columns3, Eye, FileText, GripVertical, Highlighter, Image, Italic, LayoutDashboard,
  Lightbulb, List, ListOrdered, Loader2, Plus, Save, Sparkles, Table2, Trash2, Upload,
  Wand2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { DrawingCanvas } from '../../features/solving/canvas/DrawingCanvas';
import {
  createQuestionBankItem,
  generateQuestionStudioAi,
  saveQuestionStudioDraft,
  uploadFile,
} from '../../lib/api/modules';

const QUESTION_TYPES = [
  'Çoktan Seçmeli',
  'Açık Uçlu',
  'Doğru / Yanlış',
  'Boşluk Doldurma',
  'Eşleştirme',
  'Çoklu Doğru Cevap',
  'Sürükle Bırak',
  'Görsel İşaretleme',
  'Grafik Yorumlama',
  'Kod Sorusu',
  'Matematik Sorusu',
  'AI Destekli Soru',
];

const STUDIO_NAV = [
  [LayoutDashboard, 'Dashboard'],
  [BookOpen, 'Soru Bankam'],
  [FileText, 'Deneme Sınavları'],
  [Columns3, 'Kurumsal Sınavlar'],
  [Brain, 'Öğrenci Çözümleri'],
  [Bookmark, 'PDF Raporları'],
  [Sparkles, 'AI Araçları'],
];

const initialOptions = [
  { id: 'a', text: 'x = -2 ve x = 2', correct: true },
  { id: 'b', text: 'x = -4 ve x = 4', correct: false },
  { id: 'c', text: 'x = -2 ve x = 4', correct: false },
  { id: 'd', text: 'x = -4 ve x = 2', correct: false },
  { id: 'e', text: 'x = -1 ve x = 1', correct: false },
];

function stripHtml(html) {
  const element = document.createElement('div');
  element.innerHTML = html || '';
  return element.textContent || element.innerText || '';
}

function optionLetter(index) {
  return String.fromCharCode(65 + index);
}

export default function TeacherQuestionStudio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useApp();
  const editorRef = useRef(null);
  const solutionRef = useRef(null);
  const fileInputRef = useRef(null);
  const [activeType, setActiveType] = useState('Çoktan Seçmeli');
  const [mode, setMode] = useState('text');
  const [questionHtml, setQuestionHtml] = useState(
    'Aşağıdaki şekilde <b>f(x) = x² - 4</b> fonksiyonunun grafiği verilmiştir.<br/>Buna göre, f(x) fonksiyonunun sıfırları aşağıdakilerden hangisidir?',
  );
  const [solutionHtml, setSolutionHtml] = useState('x² - 4 = 0 denklemi (x - 2)(x + 2) = 0 olarak çarpanlara ayrılır. Bu nedenle kökler -2 ve 2 olur.');
  const [options, setOptions] = useState(initialOptions);
  const [settings, setSettings] = useState({
    subject: 'Matematik',
    topic: '2. Dereceden Denklemler',
    outcome: 'İkinci dereceden fonksiyonlar',
    difficulty: 'Orta',
    point: '5',
    classLevel: '10. Sınıf',
    examType: 'Deneme',
    estimatedSeconds: '90',
    tags: 'fonksiyonlar, parabol',
    description: '',
    publishStatus: 'Draft',
    addSolution: true,
    addHint: true,
    addVisual: true,
  });
  const [assetPath, setAssetPath] = useState('');
  const [solutionAssetPath, setSolutionAssetPath] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [autosave, setAutosave] = useState('Taslak hazır');

  const correctIndex = useMemo(() => options.findIndex((item) => item.correct), [options]);

  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    setQuestionHtml(editorRef.current?.innerHTML || '');
  };

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setAutosave('Değişiklik var');
  };

  const updateOption = (id, value) => {
    setOptions((items) => items.map((item) => (item.id === id ? { ...item, text: value } : item)));
    setAutosave('Değişiklik var');
  };

  const markCorrect = (id) => {
    setOptions((items) => items.map((item) => ({ ...item, correct: item.id === id })));
    setAutosave('Değişiklik var');
  };

  const addOption = () => {
    setOptions((items) => [...items, { id: `opt-${Date.now()}`, text: '', correct: false }]);
  };

  const removeOption = (id) => {
    setOptions((items) => items.length <= 2 ? items : items.filter((item) => item.id !== id));
  };

  const uploadAsset = async (file, folder) => {
    if (!file) return '';
    const formData = new FormData();
    formData.append('file', file);
    const uploaded = await uploadFile(formData, folder);
    return uploaded?.fileUrl || uploaded?.url || uploaded?.path || '';
  };

  const handleFile = async (file) => {
    try {
      setSaving(true);
      const path = await uploadAsset(file, 'question-studio');
      setAssetPath(path);
      toast({ title: 'Görsel yüklendi', description: 'Soru görseli editöre bağlandı.' });
    } catch (error) {
      toast({ title: 'Görsel yüklenemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    try {
      setSaving(true);
      const payload = {
        activeType,
        questionHtml,
        solutionHtml,
        options,
        settings,
        assetPath,
        solutionAssetPath,
      };
      await saveQuestionStudioDraft({
        title: stripHtml(questionHtml).slice(0, 80) || 'Soru Taslağı',
        mode: 'QuestionBank',
        payloadJson: JSON.stringify(payload),
      });
      setAutosave('Taslak kaydedildi');
      toast({ title: 'Taslak kaydedildi', description: 'Soru stüdyosu taslağı backend üzerinde saklandı.' });
    } catch (error) {
      toast({ title: 'Taslak kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveQuestion = async () => {
    const questionText = stripHtml(questionHtml).trim();
    if (!questionText || !settings.subject || !settings.topic) {
      toast({ title: 'Eksik bilgi', description: 'Soru metni, ders ve konu zorunlu.', variant: 'destructive' });
      return;
    }
    if (activeType.includes('Çoktan') && options.filter((item) => item.text.trim()).length < 2) {
      toast({ title: 'Şık eksik', description: 'Çoktan seçmeli sorularda en az iki şık olmalı.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const created = await createQuestionBankItem({
        subject: settings.subject,
        topic: settings.topic,
        difficulty: settings.difficulty,
        type: activeType,
        questionText,
        teacher: user?.name || 'Öğretmen',
        imagePath: assetPath || null,
        imagePlacement: 'Top',
        options: activeType.includes('Çoktan') ? options.map((item) => item.text.trim()).filter(Boolean) : [],
        correctOptionIndex: activeType.includes('Çoktan') ? Math.max(0, correctIndex) : null,
        classTargets: [settings.classLevel || 'Tüm Sınıflar'],
        solutionAssetPath: solutionAssetPath || null,
        solutionAssetType: solutionAssetPath ? 'canvas-or-file' : null,
        revealCorrectAnswerToStudent: settings.publishStatus === 'Published',
        expectedAnswer: activeType.includes('Çoktan') ? null : stripHtml(solutionHtml).slice(0, 1000),
      });
      toast({ title: 'Soru kaydedildi', description: `${created.subject} / ${created.topic} soru bankasına eklendi.` });
      navigate('/t/question-bank');
    } catch (error) {
      toast({ title: 'Soru kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const generateWithAi = async () => {
    try {
      setAiLoading(true);
      const generated = await generateQuestionStudioAi({
        subject: settings.subject,
        topic: settings.topic,
        difficulty: settings.difficulty,
        type: activeType,
        prompt: aiPrompt,
      });
      setQuestionHtml(generated.questionText || questionHtml);
      setSolutionHtml(generated.solution || solutionHtml);
      setOptions((generated.options || []).map((text, index) => ({
        id: `ai-${index}`,
        text,
        correct: index === (generated.correctOptionIndex ?? 0),
      })));
      updateSetting('estimatedSeconds', String(generated.estimatedSeconds || settings.estimatedSeconds));
      updateSetting('tags', (generated.tags || []).join(', '));
      toast({ title: 'AI önerisi hazır', description: 'Soru, şıklar ve çözüm stüdyoya aktarıldı.' });
    } catch (error) {
      toast({ title: 'AI önerisi alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-2rem)] overflow-hidden rounded-[34px] border border-white/10 bg-[#060b14] text-white shadow-2xl shadow-slate-950/30">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-[252px_1fr_360px]">
        <aside className="border-r border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="font-black">Course Intellect</p>
              <p className="text-xs text-slate-400">Öğretmen Paneli</p>
            </div>
          </div>

          <p className="mt-7 px-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Ana Menü</p>
          <div className="mt-3 space-y-1">
            {STUDIO_NAV.map(([Icon, label]) => (
              <button
                key={label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${label === 'Soru Bankam' ? 'border border-orange-400/40 bg-orange-500/15 text-orange-100 shadow-[0_0_28px_rgba(249,115,22,0.16)]' : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Soru Bankam <span className="mx-2">›</span> <span className="text-white">Soru Oluştur</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Eye className="mr-2 h-4 w-4" /> Önizleme
              </Button>
              <Button variant="outline" disabled={saving} onClick={saveDraft} className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bookmark className="mr-2 h-4 w-4" />}
                Taslak Olarak Kaydet
              </Button>
              <Button disabled={saving} onClick={saveQuestion} className="bg-orange-500 text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Soruyu Kaydet
              </Button>
            </div>
          </div>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-5">
              <h1 className="text-2xl font-black">Yeni Soru Oluştur</h1>
              <p className="mt-1 text-sm text-slate-400">Word benzeri editör, LaTeX, görsel, çözüm, çizim ve AI araçları tek ekranda.</p>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {QUESTION_TYPES.slice(0, 7).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveType(type)}
                  className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold ${activeType === type ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300'}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="font-black">Soru Metni</h2>
                <div className="flex rounded-2xl bg-white/5 p-1 text-xs">
                  <button type="button" onClick={() => setMode('text')} className={`rounded-xl px-3 py-1 ${mode === 'text' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>Metin</button>
                  <button type="button" onClick={() => setMode('latex')} className={`rounded-xl px-3 py-1 ${mode === 'latex' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>LaTeX</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-3 text-slate-300">
                {[
                  ['bold', <b key="b">B</b>],
                  ['italic', <Italic key="i" className="h-4 w-4" />],
                  ['underline', <u key="u">U</u>],
                  ['strikeThrough', <span key="s">S</span>],
                  ['insertUnorderedList', <List key="list" className="h-4 w-4" />],
                  ['insertOrderedList', <ListOrdered key="ordered" className="h-4 w-4" />],
                  ['justifyLeft', <AlignLeft key="left" className="h-4 w-4" />],
                  ['justifyCenter', <AlignCenter key="center" className="h-4 w-4" />],
                  ['justifyRight', <AlignRight key="right" className="h-4 w-4" />],
                ].map(([command, icon]) => (
                  <button key={command} type="button" onClick={() => exec(command)} className="rounded-xl p-2 hover:bg-white/10">{icon}</button>
                ))}
                <span className="mx-2 h-6 w-px bg-white/10" />
                <button type="button" onClick={() => exec('formatBlock', '<h3>')} className="rounded-xl px-3 py-2 text-sm hover:bg-white/10">Heading</button>
                <button type="button" onClick={() => exec('backColor', '#f97316')} className="rounded-xl p-2 hover:bg-white/10"><Highlighter className="h-4 w-4" /></button>
                <button type="button" onClick={() => exec('insertHTML', '<code>kod</code>')} className="rounded-xl p-2 hover:bg-white/10"><Code2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => exec('insertHTML', '<table><tr><td>Hücre</td><td>Hücre</td></tr></table>')} className="rounded-xl p-2 hover:bg-white/10"><Table2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl p-2 hover:bg-white/10"><Image className="h-4 w-4" /></button>
                <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setQuestionHtml(event.currentTarget.innerHTML)}
                onPaste={(event) => {
                  const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'));
                  if (file) {
                    event.preventDefault();
                    handleFile(file);
                  }
                }}
                className="min-h-[260px] px-5 py-4 text-base leading-8 text-slate-100 outline-none"
                dangerouslySetInnerHTML={{ __html: questionHtml }}
              />
              {assetPath ? (
                <div className="mx-5 mb-5 rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                  Görsel eklendi: {assetPath}
                </div>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black">Seçenekler</h2>
                <Button variant="ghost" onClick={addOption} className="text-orange-300 hover:bg-orange-500/10 hover:text-orange-200">
                  <Plus className="mr-2 h-4 w-4" /> Seçenek Ekle
                </Button>
              </div>
              {options.map((option, index) => (
                <div key={option.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${option.correct ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                  <GripVertical className="h-4 w-4 text-slate-500" />
                  <button type="button" onClick={() => markCorrect(option.id)} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${option.correct ? 'bg-emerald-500 text-white' : 'bg-white/8 text-slate-300'}`}>
                    {optionLetter(index)}
                  </button>
                  <Input value={option.text} onChange={(event) => updateOption(option.id, event.target.value)} className="border-white/10 bg-transparent text-white" />
                  <button type="button" onClick={() => removeOption(option.id)} className="rounded-xl p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="font-black">Çözüm ve Çizim Alanı</h2>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </div>
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                <div
                  ref={solutionRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => setSolutionHtml(event.currentTarget.innerHTML)}
                  className="min-h-[300px] rounded-3xl border border-white/10 bg-white/[0.035] p-4 leading-7 outline-none"
                  dangerouslySetInnerHTML={{ __html: solutionHtml }}
                />
                <DrawingCanvas
                  questionAttemptId="question-studio-draft"
                  onSnapshot={(dataUrl) => {
                    setSolutionAssetPath(dataUrl.slice(0, 80));
                    setAutosave('Çizim snapshot hazır');
                  }}
                  onStrokeComplete={() => setAutosave('Stroke data hazır')}
                />
              </div>
            </div>
          </section>
        </main>

        <aside className="border-l border-white/10 bg-slate-950/70 p-5">
          <h2 className="mb-5 text-lg font-black">Soru Ayarları</h2>
          <div className="space-y-4">
            <Field label="Ders">
              <Select value={settings.subject} onValueChange={(value) => updateSetting('subject', value)}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji', 'İngilizce'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Konu"><Input value={settings.topic} onChange={(event) => updateSetting('topic', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Kazanım"><Input value={settings.outcome} onChange={(event) => updateSetting('outcome', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Zorluk Seviyesi">
              <div className="grid grid-cols-3 gap-2">
                {['Kolay', 'Orta', 'Zor'].map((item) => (
                  <button key={item} type="button" onClick={() => updateSetting('difficulty', item)} className={`rounded-2xl border px-3 py-2 text-sm font-bold ${settings.difficulty === item ? 'border-orange-400 bg-orange-500/20 text-orange-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>{item}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puan"><Input value={settings.point} onChange={(event) => updateSetting('point', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
              <Field label="Süre"><Input value={settings.estimatedSeconds} onChange={(event) => updateSetting('estimatedSeconds', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            </div>
            <Field label="Sınıf Seviyesi"><Input value={settings.classLevel} onChange={(event) => updateSetting('classLevel', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Etiketler"><Input value={settings.tags} onChange={(event) => updateSetting('tags', event.target.value)} className="border-white/10 bg-white/5 text-white" /></Field>
            <Field label="Açıklama"><Textarea value={settings.description} onChange={(event) => updateSetting('description', event.target.value)} className="min-h-[88px] border-white/10 bg-white/5 text-white" /></Field>
            {[
              ['addSolution', 'Çözüm Ekle'],
              ['addHint', 'İpucu Ekle'],
              ['addVisual', 'Görsel Ekle'],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-slate-300">{label}</span>
                <Switch checked={!!settings[key]} onCheckedChange={(value) => updateSetting(key, value)} />
              </div>
            ))}

            <div className="rounded-[24px] border border-orange-400/20 bg-orange-500/10 p-4">
              <div className="mb-3 flex items-center gap-2 font-black text-orange-100">
                <Wand2 className="h-5 w-5" /> AI Yardımcısı
              </div>
              <Textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Örn: Parabol kökleriyle ilgili orta seviye soru üret..." className="min-h-[90px] border-white/10 bg-slate-950/60 text-white" />
              <Button onClick={generateWithAi} disabled={aiLoading} className="mt-3 w-full bg-orange-500 text-white hover:bg-orange-600">
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                AI ile Üret / İyileştir
              </Button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
              Autosave: <span className="font-bold text-orange-200">{autosave}</span>
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
