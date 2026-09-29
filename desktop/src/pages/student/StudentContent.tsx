import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Video, FileText, Play, Pause, Clock, CheckCircle, Download, Eye, Maximize2, Rewind, FastForward,
  Star, Share2, NotebookPen, ThumbsUp, MessageCircle, ListChecks,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import PremiumResourceCard from '../../components/ui/PremiumResourceCard';
import { PremiumPanel, PremiumListRow } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import {
  addContentComment,
  fetchContentEngagement,
  fetchContents,
  fetchExamResults,
  saveContentUserState,
} from '../../lib/api/modules';
import { desktopApiBaseUrl } from '../../lib/auth';
import { setAppFullscreen } from '../../lib/tauri';
import { openHttpUrl } from '../../lib/safeOpen';

const SUBJECT_TONES = ['from-sky-400 to-blue-600', 'from-violet-400 to-fuchsia-600', 'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-600', 'from-rose-400 to-red-600', 'from-cyan-400 to-blue-500'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function normalizeType(value = '') {
  const text = String(value).toLowerCase();
  if (text.includes('video')) return 'video';
  if (text.includes('pdf')) return 'pdf';
  return 'file';
}

function previewGradient(type) {
  if (type === 'video') return 'from-orange-400 to-red-500';
  if (type === 'pdf') return 'from-blue-500 to-cyan-500';
  return 'from-slate-500 to-slate-700';
}

function buildContentFileUrl(contentFile) {
  const fileUrl = typeof contentFile === 'object' ? String(contentFile?.fileUrl || '').trim() : '';
  if (fileUrl) {
    if (/^https?:\/\//i.test(fileUrl)) {
      return fileUrl;
    }
    if (!desktopApiBaseUrl) {
      return fileUrl;
    }
    try {
      return new URL(fileUrl, desktopApiBaseUrl).toString();
    } catch {
      return fileUrl;
    }
  }

  const fileName = typeof contentFile === 'object' ? String(contentFile?.fileName || '').trim() : String(contentFile || '').trim();
  if (!fileName) return null;
  if (!desktopApiBaseUrl) {
    return `/uploads/teacher-content/${encodeURIComponent(fileName)}`;
  }
  try {
    return new URL(`/uploads/teacher-content/${encodeURIComponent(fileName)}`, desktopApiBaseUrl).toString();
  } catch {
    return `/uploads/teacher-content/${encodeURIComponent(fileName)}`;
  }
}

export default function StudentContent() {
  const navigate = useNavigate();
  const [content, setContent] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Tümü');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [playSelectedVideo, setPlaySelectedVideo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const videoContainerRef = useRef(null);
  const videoRef = useRef(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoImmersiveMode, setVideoImmersiveMode] = useState(false);
  const [lessonNotes, setLessonNotes] = useState({});
  const [noteDraft, setNoteDraft] = useState('');
  const [favoriteIds, setFavoriteIds] = useState({});
  const [likedIds, setLikedIds] = useState({});
  const [contentExercises, setContentExercises] = useState([]);
  const [contentComments, setContentComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const lastProgressSaveRef = useRef({ key: '', progress: 0, time: 0 });

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchContents(true);
      setContent(payload);
    } catch (err) {
      setError(err.message || 'İçerikler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    fetchExamResults()
      .then((rows) => setExamResults(Array.isArray(rows) ? rows : []))
      .catch(() => setExamResults([]));
  }, []);

  const openFile = async (contentFile, download = false) => {
    const fileUrl = buildContentFileUrl(contentFile);
    if (!fileUrl) return;
    if (download) {
      const response = await window.fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Dosya indirilemedi (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = (typeof contentFile === 'object' ? contentFile?.fileName || contentFile?.title : contentFile) || 'icerik';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      return;
    }
    openHttpUrl(fileUrl);
  };

  const openVideoFullscreen = async () => {
    setVideoImmersiveMode(true);
    const video = videoRef.current;
    const container = videoContainerRef.current;
    const target = video || container;
    if (!target) return;

    const requestFullscreen =
      target.requestFullscreen
      || target.webkitRequestFullscreen
      || container?.requestFullscreen
      || container?.webkitRequestFullscreen;

    if (requestFullscreen) {
      try {
        await requestFullscreen.call(target === container ? container : target);
        return;
      } catch {
        // fall through to Tauri window fullscreen
      }
    }

    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    await setAppFullscreen(true);
  };

  const closeVideoFullscreen = async () => {
    setVideoImmersiveMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // noop
    }
    await setAppFullscreen(false);
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    setPlaySelectedVideo(!video.paused);
  };

  const seekVideoBy = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const nextTime = Math.max(0, Math.min(duration, (video.currentTime || 0) + seconds));
    video.currentTime = nextTime;
    setVideoCurrentTime(nextTime);
  };

  const updateVideoSpeed = (speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setVideoSpeed(speed);
  };

  const formatDuration = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const subjects = useMemo(() => ['Tümü', ...new Set(content.map((item) => item.subject).filter(Boolean))], [content]);

  const selectedPlaylist = useMemo(() => {
    if (!selectedItem || normalizeType(selectedItem.fileType) !== 'video') {
      return [];
    }

    const related = content
      .filter((item) => normalizeType(item.fileType) === 'video')
      .filter((item) => (
        selectedItem.playlistKey
          ? item.playlistKey === selectedItem.playlistKey
          : item.fileName === selectedItem.fileName
      ))
      .sort((left, right) => {
        const leftOrder = Number(left.playlistOrder || 9999);
        const rightOrder = Number(right.playlistOrder || 9999);
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return String(left.title || '').localeCompare(String(right.title || ''), 'tr');
      });

    return related.length > 0 ? related : [selectedItem];
  }, [content, selectedItem]);

  const currentPlaylistIndex = useMemo(() => {
    if (!selectedItem) return -1;
    return selectedPlaylist.findIndex((item) => item.id === selectedItem.id || item.fileName === selectedItem.fileName);
  }, [selectedItem, selectedPlaylist]);

  const nextPlaylistItem = currentPlaylistIndex >= 0 && currentPlaylistIndex < selectedPlaylist.length - 1
    ? selectedPlaylist[currentPlaylistIndex + 1]
    : null;

  const openPlaylistItem = useCallback((item) => {
    setSelectedItem(item);
    setPlaySelectedVideo(true);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setNoteDraft(lessonNotes[item.id || item.fileName] || '');
  }, [lessonNotes]);

  const shareSelectedContent = useCallback(async () => {
    if (!selectedItem) return;
    const fileUrl = buildContentFileUrl(selectedItem);
    const sharePayload = {
      title: selectedItem.title,
      text: `${selectedItem.title} - ${selectedItem.subject}`,
      url: fileUrl || window.location.href,
    };

    if (navigator.share) {
      await navigator.share(sharePayload).catch(() => {});
      return;
    }

    await navigator.clipboard?.writeText(sharePayload.url).catch(() => {});
  }, [selectedItem]);

  const selectedContentKey = selectedItem ? (selectedItem.id || selectedItem.fileName || selectedItem.title) : '';

  useEffect(() => {
    if (!selectedItem?.id) {
      setContentExercises([]);
      setContentComments([]);
      setCommentDraft('');
      return;
    }

    let mounted = true;
    fetchContentEngagement(selectedItem.id)
      .then((engagement) => {
        if (!mounted || !engagement) return;
        const key = selectedItem.id || selectedItem.fileName || selectedItem.title;
        setContentExercises(Array.isArray(engagement.exercises) ? engagement.exercises : []);
        setContentComments(Array.isArray(engagement.comments) ? engagement.comments : []);
        setLessonNotes((prev) => ({ ...prev, [key]: engagement.note || '' }));
        setFavoriteIds((prev) => ({ ...prev, [key]: Boolean(engagement.favorite) }));
        setLikedIds((prev) => ({ ...prev, [key]: Boolean(engagement.liked) }));
        setNoteDraft(engagement.note || '');
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [selectedItem]);

  const persistSelectedUserState = useCallback((overrides = {}) => {
    if (!selectedItem?.id) return;
    const key = selectedItem.id || selectedItem.fileName || selectedItem.title;
    const progress = Math.max(0, Math.min(100, Number(overrides.progress ?? selectedItem.progress ?? 0)));
    const payload = {
      progress,
      liked: Boolean(overrides.liked ?? likedIds[key]),
      favorite: Boolean(overrides.favorite ?? favoriteIds[key]),
      note: String(overrides.note ?? lessonNotes[key] ?? noteDraft ?? ''),
    };
    saveContentUserState(selectedItem.id, payload).catch(() => {});
  }, [favoriteIds, lessonNotes, likedIds, noteDraft, selectedItem]);

  const filteredContent = useMemo(() => content.filter((item) => {
    const normalizedType = normalizeType(item.fileType);
    const matchesSearch = `${item.title} ${item.subject} ${item.teacher}`.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = selectedSubject === 'Tümü' || item.subject === selectedSubject;
    const matchesTab = activeTab === 'all'
      || (activeTab === 'video' && normalizedType === 'video')
      || (activeTab === 'pdf' && normalizedType === 'pdf')
      || (activeTab === 'inprogress' && Number(item.progress) > 0 && Number(item.progress) < 100)
      || (activeTab === 'completed' && Number(item.progress) >= 100);
    return matchesSearch && matchesSubject && matchesTab;
  }), [activeTab, content, search, selectedSubject]);

  const stats = {
    total: content.length,
    completed: content.filter((item) => Number(item.progress) >= 100).length,
    inProgress: content.filter((item) => Number(item.progress) > 0 && Number(item.progress) < 100).length,
  };

  const overallProgress = content.length
    ? Math.round(content.reduce((sum, item) => sum + (Number(item.progress) || 0), 0) / content.length)
    : 0;
  const subjectCards = Array.from(new Set(content.map((item) => item.subject).filter(Boolean))).map((subject) => {
    const items = content.filter((item) => item.subject === subject);
    const avg = items.length ? Math.round(items.reduce((sum, item) => sum + (Number(item.progress) || 0), 0) / items.length) : 0;
    const done = items.filter((item) => Number(item.progress) >= 100).length;
    return { subject, items, total: items.length, done, avg };
  });
  const inProgressItems = content.filter((item) => Number(item.progress) > 0 && Number(item.progress) < 100).slice(0, 4);

  // Çözülen testlerden konu analizi: en zayıf derslere göre içerik öner.
  const weakSubjects = useMemo(() => {
    const map = new Map();
    examResults.forEach((item) => {
      const subject = (item.subject || '').trim();
      const score = Number(item.score);
      if (!subject || !Number.isFinite(score) || score <= 0) return;
      if (!map.has(subject)) map.set(subject, []);
      map.get(subject).push(score);
    });
    return Array.from(map.entries())
      .map(([subject, scores]) => ({ subject, average: scores.reduce((sum, value) => sum + value, 0) / scores.length }))
      .sort((a, b) => a.average - b.average);
  }, [examResults]);

  const suggestedItems = useMemo(() => {
    const notStarted = content.filter((item) => !(Number(item.progress) >= 100));
    if (weakSubjects.length === 0) {
      return notStarted.filter((item) => !(Number(item.progress) > 0)).slice(0, 5);
    }
    const order = new Map(weakSubjects.map((entry, index) => [entry.subject, index]));
    const ranked = notStarted
      .filter((item) => order.has(item.subject))
      .sort((a, b) => {
        const subjectDiff = (order.get(a.subject) ?? 99) - (order.get(b.subject) ?? 99);
        if (subjectDiff !== 0) return subjectDiff;
        return (Number(a.progress) || 0) - (Number(b.progress) || 0);
      });
    const fallback = notStarted.filter((item) => !order.has(item.subject));
    return [...ranked, ...fallback].slice(0, 5);
  }, [content, weakSubjects]);

  const weakestSubjectLabel = weakSubjects[0]?.subject || '';
  const openItem = (item) => {
    if (!item) return;
    const type = normalizeType(item.fileType);
    setSelectedItem(item);
    setPlaySelectedVideo(type === 'video');
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setVideoSpeed(1);
    setNoteDraft(lessonNotes[item.id || item.fileName] || '');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">İçerikler yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="student-content-page">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white"><Play className="h-5 w-5" /></span>
        <div>
          <h1 className="text-xl font-black tracking-tight">Konu Anlatımı</h1>
          <p className="text-sm text-muted-foreground">Dilediğin dersi seç, konuları keşfet ve öğrenmeye devam et.</p>
        </div>
      </div>

      {error ? <ErrorBanner title="İçerikler yüklenemedi" message={error} onRetry={loadContent} /> : null}

      {/* Hero + İstatistik */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-[#0b2a4a] to-[hsl(var(--ci-card))] p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[hsl(var(--brand-accent)/0.18)] blur-3xl" />
          <div className="relative flex items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-accent)/0.14)]">
              <span className="ci-float grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--brand-accent))] text-white shadow-[0_0_40px_hsl(var(--brand-accent)/0.6)]"><Play className="h-7 w-7" /></span>
            </div>
            <div>
              <h2 className="text-2xl font-black leading-tight">Öğrenmenin<br />en etkili yolu</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">Her konu; detaylı anlatım videoları, örnekler ve ipuçlarıyla seni başarıya bir adım daha yaklaştırır.</p>
              <Button className="mt-4 bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={() => navigate('/s/study-plan')}>Nasıl Çalışmalıyım?</Button>
            </div>
          </div>
        </div>

        <PremiumPanel title="Çalışma İstatistiklerim" description="Genel ilerleme özeti">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Toplam Konu', stats.total],
              ['Tamamlanan', stats.completed],
              ['Devam Eden', stats.inProgress],
              ['Ortalama', `%${overallProgress}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-center">
                <p className="text-2xl font-black tracking-tight">{value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Genel İlerleme</span><span className="font-semibold">%{overallProgress}</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]" style={{ width: `${overallProgress}%` }} /></div>
          </div>
        </PremiumPanel>
      </div>

      {/* Derslerim */}
      {subjectCards.length ? (
        <PremiumPanel title="Derslerim" description="Derslerine göre ilerleme">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subjectCards.map((card, index) => (
              <div key={card.subject} className="ci-rise rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.05)]">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white ${SUBJECT_TONES[index % SUBJECT_TONES.length]}`}><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{card.subject}</p>
                      <p className="text-[11px] text-muted-foreground">{card.total} Konu</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[hsl(var(--brand-accent))]">%{card.avg}</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className={`h-full rounded-full bg-gradient-to-r ${SUBJECT_TONES[index % SUBJECT_TONES.length]}`} style={{ width: `${card.avg}%` }} /></div>
                <p className="mt-1 text-[11px] text-muted-foreground">{card.done} / {card.total} Konu</p>
                <Button size="sm" variant="outline" className="mt-3 w-full text-xs" onClick={() => openItem(card.items.find((item) => Number(item.progress) > 0 && Number(item.progress) < 100) || card.items[0])}>Devam Et →</Button>
              </div>
            ))}
          </div>
        </PremiumPanel>
      ) : null}

      {/* Devam Ettiğim + Önerilen Konular */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PremiumPanel title="Devam Ettiğim Konular" description="Kaldığın yerden devam et" className="lg:col-span-2" contentClassName="space-y-2.5">
          {inProgressItems.length ? inProgressItems.map((item) => {
            const progress = Math.round(Number(item.progress) || 0);
            return (
              <div key={item.id || item.title} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><Play className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subject}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]" style={{ width: `${progress}%` }} /></div>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">%{progress}</span>
                <Button size="sm" className="shrink-0" onClick={() => openItem(item)}>Devam Et</Button>
              </div>
            );
          }) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Devam eden konu yok.</div>}
        </PremiumPanel>

        <PremiumPanel
          title="Önerilen Konular"
          description={weakestSubjectLabel ? `Çözdüğün testlere göre: ${weakestSubjectLabel} önceliklendirildi` : 'Sana özel öneriler'}
          contentClassName="space-y-2.5"
        >
          {suggestedItems.length ? suggestedItems.map((item) => (
            <PremiumListRow
              key={item.id || item.title}
              icon={Star}
              title={item.title}
              subtitle={item.subject}
              meta={<Play className="h-4 w-4 text-[hsl(var(--brand-accent))]" />}
              onClick={() => openItem(item)}
            />
          )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Öneri bulunamadı.</div>}
        </PremiumPanel>
      </div>

      {/* Hızlı işlemler */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Çalışma Planı Oluştur', 'Kişisel planın ile daha verimli', NotebookPen, '/s/study-plan'],
          ['Notlarını Senkronize Et', 'Tüm notların her yerde seninle', ListChecks, '/s/notes'],
          ['Favori Konuların', 'Favori konularına hızlıca ulaş', Star, '/s/favorites'],
        ].map(([title, sub, Icon, href]) => (
          <button key={title} onClick={() => navigate(href)} className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.08)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><Icon className="h-5 w-5" /></span>
            <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setVideoImmersiveMode(false); }}>
        <DialogContent className={normalizeType(selectedItem?.fileType) === 'video'
          ? `${videoImmersiveMode ? 'h-screen w-screen max-w-none rounded-none border-0 p-0' : 'max-h-[94vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto border-foreground/10 bg-[hsl(var(--ci-card))] p-3 text-white sm:w-[calc(100vw-2rem)]'}`
          : 'max-h-[94vh] max-w-4xl overflow-y-auto border-foreground/10 bg-[hsl(var(--ci-card))] text-white'}
        >
          {normalizeType(selectedItem?.fileType) === 'video' ? null : (
            <DialogHeader>
              <DialogTitle>{selectedItem?.title}</DialogTitle>
            </DialogHeader>
          )}
          {selectedItem ? (
            <div className="space-y-4">
              {normalizeType(selectedItem.fileType) === 'video' ? (
                <div className="flex flex-col gap-3 rounded-[28px] border border-foreground/10 bg-foreground/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Derslerim</span>
                      <span>/</span>
                      <span>{selectedItem.subject}</span>
                      <span>/</span>
                      <span>{selectedItem.grade || 'Tüm sınıflar'}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white">{selectedItem.title}</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-foreground/10 bg-foreground/[0.06] text-slate-200">{selectedItem.subject}</Badge>
                      <Badge className="border-foreground/10 bg-foreground/[0.06] text-slate-200">{selectedItem.grade || 'Tüm sınıflar'}</Badge>
                      <Badge className="border-orange-400/25 bg-orange-500/10 text-orange-200">{selectedItem.info || selectedItem.fileType}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-full border-foreground/10 bg-foreground/[0.05] text-slate-100 hover:bg-foreground/[0.09]" onClick={() => openFile(selectedItem, true).catch(() => {})}>
                      <Download className="mr-2 h-4 w-4" />
                      İndir
                    </Button>
                    <Button variant="outline" className="rounded-full border-foreground/10 bg-foreground/[0.05] text-slate-100 hover:bg-foreground/[0.09]" onClick={() => shareSelectedContent()}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Paylaş
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-foreground/10 bg-foreground/[0.05] text-slate-100 hover:bg-foreground/[0.09]"
                      onClick={() => {
                        const nextFavorites = { ...favoriteIds, [selectedContentKey]: !favoriteIds[selectedContentKey] };
                        setFavoriteIds(nextFavorites);
                        persistSelectedUserState({ favorite: nextFavorites[selectedContentKey] });
                      }}
                    >
                      <Star className={`mr-2 h-4 w-4 ${favoriteIds[selectedContentKey] ? 'fill-orange-300 text-orange-300' : 'text-orange-300'}`} />
                      {favoriteIds[selectedContentKey] ? 'Favoride' : 'Favori'}
                    </Button>
                  </div>
                </div>
              ) : null}
              {normalizeType(selectedItem.fileType) === 'video' && buildContentFileUrl(selectedItem) ? (
                <div ref={videoContainerRef} className={`relative overflow-hidden bg-black ${videoImmersiveMode ? 'h-screen w-screen rounded-none' : 'rounded-2xl border'}`}>
                    <video
                      ref={videoRef}
                      autoPlay
                      preload="metadata"
                      className="h-auto max-h-[78vh] w-full bg-black object-contain"
                      src={buildContentFileUrl(selectedItem)}
                      onClick={(event) => {
                        event.preventDefault();
                        toggleVideoPlayback();
                      }}
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        setVideoDuration(video.duration || 0);
                        setVideoCurrentTime(video.currentTime || 0);
                        video.playbackRate = videoSpeed;
                      }}
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;
                        const currentTime = video.currentTime || 0;
                        setVideoCurrentTime(currentTime);
                        const duration = video.duration || 0;
                        if (selectedItem?.id && duration > 0) {
                          const progress = Math.round((currentTime / duration) * 100);
                          const last = lastProgressSaveRef.current;
                          const now = Date.now();
                          if (
                            progress >= 5
                            && progress !== last.progress
                            && (progress - last.progress >= 5 || now - last.time > 15000)
                          ) {
                            lastProgressSaveRef.current = { key: selectedItem.id, progress, time: now };
                            persistSelectedUserState({ progress });
                          }
                        }
                      }}
                      onPlay={() => setPlaySelectedVideo(true)}
                      onPause={() => setPlaySelectedVideo(false)}
                      onEnded={() => {
                        persistSelectedUserState({ progress: 100 });
                        if (nextPlaylistItem) {
                          openPlaylistItem(nextPlaylistItem);
                        }
                      }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                    <div className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      {selectedItem.fileType}
                    </div>
                    <div className="flex items-center gap-2">
                      {videoImmersiveMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="rounded-full border-foreground/20 bg-black/45 text-white hover:bg-black/60"
                          onClick={() => closeVideoFullscreen().catch(() => {})}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-foreground/20 bg-black/45 text-white hover:bg-black/60"
                        onClick={() => openFile(selectedItem, true).catch(() => {})}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-foreground/20 bg-black/45 px-3 text-white hover:bg-black/60"
                        onClick={() => updateVideoSpeed(videoSpeed === 1 ? 1.5 : 1)}
                      >
                        {videoSpeed}x
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full border-foreground/20 bg-black/45 text-white hover:bg-black/60"
                        onClick={() => openVideoFullscreen().catch(() => {})}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <input
                      type="range"
                      min="0"
                      max={videoDuration || 0}
                      step="0.1"
                      value={Math.min(videoCurrentTime, videoDuration || 0)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (videoRef.current) {
                          videoRef.current.currentTime = value;
                        }
                        setVideoCurrentTime(value);
                      }}
                      className="mb-3 w-full accent-red-500"
                    />
                    <div className="flex items-center gap-2 text-white">
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-foreground/10" onClick={toggleVideoPlayback}>
                        {playSelectedVideo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-foreground/10" onClick={() => seekVideoBy(-10)}>
                        <Rewind className="h-5 w-5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="rounded-full text-white hover:bg-foreground/10" onClick={() => seekVideoBy(10)}>
                        <FastForward className="h-5 w-5" />
                      </Button>
                      <div className="ml-2 text-sm font-medium">
                        {formatDuration(videoCurrentTime)} / {formatDuration(videoDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`h-52 rounded-xl bg-gradient-to-br ${previewGradient(normalizeType(selectedItem.fileType))} flex items-center justify-center`}>
                  {normalizeType(selectedItem.fileType) === 'video' ? <Video className="h-14 w-14 text-white" /> : <FileText className="h-14 w-14 text-white" />}
                </div>
              )}
              {normalizeType(selectedItem.fileType) === 'video' ? null : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Ders:</span> {selectedItem.subject}</div>
                    <div><span className="text-muted-foreground">Öğretmen:</span> {selectedItem.teacher}</div>
                    <div><span className="text-muted-foreground">Sınıf:</span> {selectedItem.grade}</div>
                    <div><span className="text-muted-foreground">Dosya:</span> {selectedItem.fileName || selectedItem.fileType}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedItem.description || selectedItem.info || 'İçerik açıklaması bulunmuyor.'}</p>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                {normalizeType(selectedItem.fileType) !== 'video' ? (
                  <Button variant="outline" className="rounded-full" onClick={() => openFile(selectedItem)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Dosyayi Ac
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-full" onClick={() => openFile(selectedItem, true).catch(() => {})}>
                  <Download className="h-4 w-4 mr-2" />
                  Indir
                </Button>
              </div>
              {normalizeType(selectedItem.fileType) === 'video' && buildContentFileUrl(selectedItem) ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4 rounded-[28px] border border-foreground/10 bg-foreground/[0.035] p-4 shadow-2xl">
                    {selectedItem.playlistTitle ? (
                      <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] px-4 py-3 text-sm">
                        <p className="font-semibold text-white">{selectedItem.playlistTitle}</p>
                        <p className="mt-1 text-slate-400">
                          {selectedPlaylist.length} videoluk seri
                        </p>
                      </div>
                    ) : null}
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 border border-foreground/10 bg-[hsl(var(--ci-card))]">
                        <TabsTrigger value="summary" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Konu Özeti</TabsTrigger>
                        <TabsTrigger value="notes" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Ders Notları</TabsTrigger>
                        <TabsTrigger value="practice" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Alıştırmalar</TabsTrigger>
                        <TabsTrigger value="comments" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Yorumlar</TabsTrigger>
                      </TabsList>
                      <TabsContent value="summary" className="mt-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                          <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
                            <h3 className="text-lg font-bold text-white">{selectedItem.title}</h3>
                            <p className="mt-3 leading-7 text-slate-300">
                              {selectedItem.description || selectedItem.info || 'Bu içerik için öğretmen açıklaması henüz eklenmedi.'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5">
                            <h3 className="mb-3 flex items-center gap-2 font-bold text-white">
                              <ListChecks className="h-5 w-5 text-orange-300" />
                              Bu Derste Öğreneceklerin
                            </h3>
                            {['Konu anlatımını takip et', 'Örnekleri ve önemli notları incele', 'Gerekirse materyali indir', 'Notlarını kaydedip derse devam et'].map((item) => (
                              <div key={item} className="mb-3 flex items-start gap-3 text-sm text-slate-300">
                                <CheckCircle className="mt-0.5 h-4 w-4 text-orange-300" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="notes" className="mt-4">
                        <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-4">
                          <Label className="mb-2 block text-slate-300">Bu içerik için notun</Label>
                          <Textarea
                            className="min-h-[130px] border-foreground/10 bg-foreground/[0.05] text-white placeholder:text-slate-500"
                            value={noteDraft}
                            onChange={(event) => setNoteDraft(event.target.value)}
                            placeholder="Önemli gördüğün yerleri buraya yaz..."
                          />
                          <div className="mt-3 flex justify-end">
                            <Button
                              className="bg-orange-500 hover:bg-orange-600"
                              onClick={() => {
                                const key = selectedItem.id || selectedItem.fileName;
                                const nextNotes = { ...lessonNotes, [key]: noteDraft };
                                setLessonNotes(nextNotes);
                                persistSelectedUserState({ note: noteDraft });
                              }}
                            >
                              <NotebookPen className="mr-2 h-4 w-4" />
                              Notu Kaydet
                            </Button>
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="practice" className="mt-4">
                        <div className="space-y-3 rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 text-sm text-slate-300">
                          {contentExercises.length === 0 ? (
                            <p>Bu içerikle ilişkili alıştırma henüz eklenmedi.</p>
                          ) : contentExercises.map((exercise) => (
                            <a
                              key={exercise.id || exercise.title}
                              href={exercise.url || '#'}
                              target={exercise.url ? '_blank' : undefined}
                              rel="noreferrer"
                              className="block rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 transition hover:bg-foreground/[0.08]"
                            >
                              <p className="font-semibold text-white">{exercise.title}</p>
                              {exercise.description ? <p className="mt-1 text-xs text-slate-400">{exercise.description}</p> : null}
                            </a>
                          ))}
                        </div>
                      </TabsContent>
                      <TabsContent value="comments" className="mt-4">
                        <div className="space-y-4 rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 text-sm text-slate-300">
                          <div className="flex items-center gap-2 font-semibold text-white">
                            <MessageCircle className="h-5 w-5 text-orange-300" />
                            Yorumlar
                          </div>
                          <div className="space-y-2">
                            {contentComments.length === 0 ? (
                              <p className="text-slate-400">Henüz yorum yok. İlk yorumu sen yazabilirsin.</p>
                            ) : contentComments.map((comment) => (
                              <div key={comment.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-3">
                                <p className="text-xs text-slate-400">{comment.authorName} • {comment.authorRole}</p>
                                <p className="mt-1 text-slate-200">{comment.message}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              className="border-foreground/10 bg-foreground/[0.05] text-white placeholder:text-slate-500"
                              value={commentDraft}
                              onChange={(event) => setCommentDraft(event.target.value)}
                              placeholder="Yorum yaz..."
                            />
                            <Button
                              className="bg-orange-500 hover:bg-orange-600"
                              onClick={async () => {
                                if (!selectedItem?.id || !commentDraft.trim()) return;
                                const comments = await addContentComment(selectedItem.id, commentDraft.trim()).catch(() => null);
                                if (Array.isArray(comments)) {
                                  setContentComments(comments);
                                  setCommentDraft('');
                                }
                              }}
                            >
                              Gönder
                            </Button>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Button
                        variant="outline"
                        className="rounded-2xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/[0.08]"
                        onClick={() => {
                          const nextLikes = { ...likedIds, [selectedContentKey]: !likedIds[selectedContentKey] };
                          setLikedIds(nextLikes);
                          persistSelectedUserState({ liked: nextLikes[selectedContentKey] });
                        }}
                      >
                        <ThumbsUp className={`mr-2 h-4 w-4 ${likedIds[selectedContentKey] ? 'fill-orange-300 text-orange-300' : 'text-orange-300'}`} />
                        {likedIds[selectedContentKey] ? 'Beğenildi' : 'Beğendim'}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/[0.08]"
                        onClick={() => {
                          const nextFavorites = { ...favoriteIds, [selectedContentKey]: !favoriteIds[selectedContentKey] };
                          setFavoriteIds(nextFavorites);
                          persistSelectedUserState({ favorite: nextFavorites[selectedContentKey] });
                        }}
                      >
                        <Star className={`mr-2 h-4 w-4 ${favoriteIds[selectedContentKey] ? 'fill-orange-300 text-orange-300' : 'text-orange-300'}`} />
                        {favoriteIds[selectedContentKey] ? 'Favoride' : 'Favorilere Ekle'}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl border-foreground/10 bg-foreground/[0.04] text-slate-100 hover:bg-foreground/[0.08]"
                        onClick={() => setNoteDraft(lessonNotes[selectedContentKey] || noteDraft)}
                      >
                        <NotebookPen className="mr-2 h-4 w-4 text-orange-300" />
                        Not Ekle
                      </Button>
                    </div>
                  </div>
                  {selectedPlaylist.length > 0 ? (
                    <div className="rounded-[28px] border border-foreground/10 bg-foreground/[0.035] p-4 shadow-2xl">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">İçerik Listesi</p>
                          <p className="text-xs text-slate-400">{selectedItem.playlistTitle || 'Bu ders serisi'}</p>
                        </div>
                        <Badge className="border-foreground/10 bg-foreground/[0.06] text-slate-200">{selectedPlaylist.length} içerik</Badge>
                      </div>
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-foreground/10">
                        <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-orange-500 to-amber-300" />
                      </div>
                      <div className="space-y-2">
                        {selectedPlaylist.map((item, index) => {
                          const active = item.id === selectedItem.id || item.fileName === selectedItem.fileName;
                          return (
                            <button
                              key={item.id || `${item.fileName}-${index}`}
                              type="button"
                              onClick={() => openPlaylistItem(item)}
                              className={`flex w-full items-start gap-3 rounded-2xl border px-2 py-2 text-left transition ${
                                active ? 'border-orange-400/40 bg-orange-500/10' : 'border-foreground/10 bg-[hsl(var(--ci-card))] hover:bg-foreground/[0.07]'
                              }`}
                            >
                              <div className={`mt-0.5 overflow-hidden rounded-xl ${active ? 'ring-2 ring-brand-primary/30' : ''}`}>
                                <div className={`flex h-14 w-24 items-center justify-center ${active ? 'bg-orange-500 text-white' : 'bg-foreground/[0.06] text-slate-300'}`}>
                                {active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                                <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                                  Bölüm {item.playlistOrder || index + 1} • {item.info || item.subject}
                                </p>
                              </div>
                              <CheckCircle className={`mt-3 h-4 w-4 ${active ? 'text-orange-300' : 'text-slate-600'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
