import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Eye, GraduationCap, ImagePlus,
  Lock, Palette, Plus, Save, Search, Settings, ShieldCheck, Sparkles,
  Trash2, UserCheck, Users,
} from 'lucide-react';
import { FeatureGate } from '../components/FeatureGate';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import {
  createCompleteClass,
  deleteClass,
  fetchCourses,
  fetchPlatformConfigurations,
  fetchStaff,
  fetchStudents,
  updateClassAssignments,
} from '../lib/api/modules';
import { isUserPassive } from '../lib/userStatus';

const steps = [
  ['basic', 'Temel Bilgiler', 'Sınıf detaylarını girin'],
  ['teachers', 'Öğretmen & Dersler', 'Öğretmen ve dersleri belirleyin'],
  ['students', 'Öğrenciler', 'Öğrenci ekleyin veya davet gönderin'],
  ['settings', 'Ayarlar', 'Sınıf ayarlarını yapılandırın'],
];

// Silme dialogunda "taşıma yok" seçeneği: Radix Select boş değer kabul etmediği için sentinel kullanılır.
const DEACTIVATE_OPTION = '__deactivate__';
const EMPTY_SELECT_OPTION = '__empty__';

const colorOptions = ['#2563EB', '#7B61FF', '#22C55E', '#FF8A00', '#EF4444', '#06B6D4'];
const iconOptions = ['users', 'graduation', 'book', 'science', 'globe', 'palette', 'music', 'sport', 'code', 'star', 'target', 'spark'];
const unitOptions = ['İlkokul', 'Ortaokul', 'Lise', 'Dershane'];
const gradeOptions = Array.from({ length: 12 }, (_, index) => `${index + 1}. Sınıf`);
const sectionOptions = ['A Şubesi', 'B Şubesi', 'C Şubesi', 'D Şubesi'];

function ThemedSelect({
  value,
  onValueChange,
  options,
  emptyLabel,
  ariaLabel,
  className = 'h-11',
}) {
  const selectedValue = value === '' && emptyLabel ? EMPTY_SELECT_OPTION : String(value);

  return (
    <Select
      value={selectedValue}
      onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_OPTION ? '' : nextValue)}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={`${className} border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground`}
      >
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel ? <SelectItem value={EMPTY_SELECT_OPTION}>{emptyLabel}</SelectItem> : null}
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}

function normalize(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function initials(value = '') {
  return value.split(' ').filter(Boolean).slice(0, 2).map((item) => item[0]).join('').toUpperCase() || 'CI';
}

function decodeClassConfig(item) {
  try {
    return JSON.parse(item.payloadJson || '{}');
  } catch {
    return null;
  }
}

function generateCode(name, academicYear) {
  const clean = normalize(name).replaceAll(' ', '').replaceAll('-', '').toUpperCase();
  const year = String(academicYear || new Date().getFullYear()).match(/\d{4}/)?.[0] || new Date().getFullYear();
  return clean ? `${clean}-${year}-001` : `${year}-001`;
}

function StepRail({ step }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-4 shadow-sm dark:bg-[hsl(var(--ci-card)/0.8)]">
      <div className="grid gap-3 lg:grid-cols-4">
        {steps.map(([key, title, desc], index) => {
          const active = step === index;
          const done = step > index;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                done ? 'border-teal-400 bg-teal-500 text-white'
                  : active ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_22px_rgba(37,99,235,0.45)]'
                    : 'border-foreground/10 bg-foreground/5 text-slate-400'
              }`}
              >
                {done ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{title}</p>
                <p className="truncate text-xs text-slate-400">{desc}</p>
              </div>
              {index < steps.length - 1 ? <div className="hidden h-px flex-1 bg-blue-400/30 xl:block" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassIcon({ name, color = '#2563EB' }) {
  const icons = {
    users: Users,
    graduation: GraduationCap,
    book: BookOpen,
    science: Sparkles,
    globe: ShieldCheck,
    palette: Palette,
    music: Sparkles,
    sport: UserCheck,
    code: Settings,
    star: Sparkles,
    target: ShieldCheck,
    spark: Sparkles,
  };
  const Icon = icons[name] || Users;
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full border" style={{ borderColor: `${color}55`, background: `${color}18` }}>
      <Icon className="h-9 w-9" style={{ color }} />
    </div>
  );
}

function Preview({ form, selectedTeachers, selectedStudents, assignments }) {
  const advisor = selectedTeachers.find((item) => item.id === form.advisorTeacherId);
  return (
    <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-5 text-foreground shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-black">Sınıf Önizlemesi</h3>
        <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-300">Taslak</span>
      </div>
      <div className="flex flex-col items-center py-5">
        <ClassIcon name={form.icon} color={form.themeColor} />
        <h2 className="mt-4 text-3xl font-black">{form.name || 'Yeni Sınıf'}</h2>
      </div>
      <div className="space-y-3 text-sm">
        {[
          ['Seviye', form.grade],
          ['Şube', form.section],
          ['Dönem', form.academicYear],
          ['Danışman', advisor?.fullName || 'Atanmadı'],
          ['Öğrenci Sayısı', selectedStudents.length],
          ['Ders Sayısı', assignments.length],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-foreground/5 pb-2 last:border-b-0">
            <span className="text-slate-400">{label}</span>
            <b className="text-right">{value || '-'}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Classes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classConfigs, setClassConfigs] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [managementStudentQuery, setManagementStudentQuery] = useState('');
  const [teacherBranchFilter, setTeacherBranchFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [managementClassName, setManagementClassName] = useState('');
  const [managementStudentIds, setManagementStudentIds] = useState([]);
  const [managementAdvisorId, setManagementAdvisorId] = useState('');
  const [managementSaving, setManagementSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetName, setDeleteTargetName] = useState('');
  const [deleteTransferTo, setDeleteTransferTo] = useState(DEACTIVATE_OPTION);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    institutionUnit: 'Ortaokul',
    grade: '7. Sınıf',
    section: 'A Şubesi',
    academicYear: '2025-2026 / 1. Dönem',
    advisorTeacherId: '',
    description: '',
    themeColor: '#2563EB',
    icon: 'users',
  });
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [modules, setModules] = useState({
    attendance: true,
    grades: true,
    liveLessons: true,
    homework: true,
    study: true,
    messaging: true,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentRows, teacherRows, courseRows, configs] = await Promise.all([
        fetchStudents(),
        fetchStaff('Teacher').catch(() => []),
        fetchCourses().catch(() => []),
        fetchPlatformConfigurations('class-management').catch(() => []),
      ]);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
      setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
      setCourses(Array.isArray(courseRows) ? courseRows : []);
      setClassConfigs((configs || []).map(decodeClassConfig).filter(Boolean));

      const firstCourses = (courseRows || []).slice(0, 4).map((course) => ({
        courseName: course.name || course.title || course.subject || 'Ders',
        teacherId: null,
        weeklyHours: 4,
        isRequired: true,
      }));
      setAssignments((prev) => (prev.length > 0 ? prev : firstCourses));
    } catch (err) {
      setError(err.message || 'Sınıf verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!form.code) {
      setForm((prev) => ({ ...prev, code: generateCode(prev.name, prev.academicYear) }));
    }
  }, [form.code, form.name, form.academicYear]);

  const branches = useMemo(() => [...new Set(teachers.map((item) => item.departmentOrBranch).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [teachers]);
  const selectedTeachers = useMemo(() => teachers.filter((item) => selectedTeacherIds.includes(item.id)), [selectedTeacherIds, teachers]);
  const selectedStudents = useMemo(() => students.filter((item) => selectedStudentIds.includes(item.id)), [selectedStudentIds, students]);
  const classNames = useMemo(() => {
    const names = new Set();
    classConfigs.forEach((item) => {
      if (item?.name) names.add(item.name);
    });
    students.forEach((student) => {
      if (student.className && !normalize(student.className).includes('bekleyen')) names.add(student.className);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [classConfigs, students]);

  const filteredTeachers = useMemo(() => teachers.filter((teacher) => {
    const matchesSearch = !teacherQuery || `${teacher.fullName} ${teacher.departmentOrBranch}`.toLowerCase().includes(teacherQuery.toLowerCase());
    const matchesBranch = teacherBranchFilter === 'all' || teacher.departmentOrBranch === teacherBranchFilter;
    return matchesSearch && matchesBranch;
  }), [teacherBranchFilter, teacherQuery, teachers]);

  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesSearch = !studentQuery || `${student.fullName} ${student.schoolNumber}`.toLowerCase().includes(studentQuery.toLowerCase());
    const isWaiting = !student.className || normalize(student.className).includes('bekleyen');
    const matchesFilter = studentFilter === 'all'
      || (studentFilter === 'waiting' && isWaiting)
      || (studentFilter === 'active' && !isWaiting);
    return matchesSearch && matchesFilter;
  }), [studentFilter, studentQuery, students]);

  const existingSummary = useMemo(() => classConfigs.map((item) => {
    const advisor = teachers.find((teacher) => teacher.id === item.advisorTeacherId);
    return {
      name: item.name,
      code: item.code,
      studentCount: students.filter((student) => student.className === item.name && !isUserPassive(student.status)).length,
      teacherCount: item.teachers?.length || 0,
      courseCount: item.courses?.length || 0,
      color: item.themeColor || '#2563EB',
      institutionUnit: item.institutionUnit || '',
      grade: item.grade || '',
      section: item.section || '',
      academicYear: item.academicYear || '',
      advisorName: advisor?.fullName || '',
      description: item.description || '',
      courses: Array.isArray(item.courses) ? item.courses : [],
    };
  }), [classConfigs, students, teachers]);

  const deleteClassName = deleteTargetName || managementClassName;

  const deleteStudentCount = useMemo(
    () => students.filter((student) => normalize(student.className) === normalize(deleteClassName)).length,
    [students, deleteClassName],
  );

  // Öğrencilerin taşınabileceği sınıflar: silinen sınıf hariç, kayıtlı ve öğrencide görünen tüm sınıflar.
  const deleteTransferOptions = useMemo(() => {
    const names = [
      ...existingSummary.map((item) => item.name),
      ...students.map((student) => student.className),
    ];
    const unique = new Map();
    for (const name of names) {
      const clean = String(name || '').trim();
      if (!clean || normalize(clean) === normalize(deleteClassName)) continue;
      if (!unique.has(normalize(clean))) unique.set(normalize(clean), clean);
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [existingSummary, students, deleteClassName]);

  const selectedManagementClassStudents = useMemo(
    () => students.filter((student) => normalize(student.className) === normalize(managementClassName)),
    [managementClassName, students],
  );

  const filteredManagementStudents = useMemo(() => {
    const query = managementStudentQuery.trim().toLowerCase();
    return students.filter((student) => {
      if (!query) return true;
      return `${student.fullName} ${student.schoolNumber} ${student.className}`.toLowerCase().includes(query);
    });
  }, [managementStudentQuery, students]);

  const managementAdvisor = useMemo(
    () => teachers.find((teacher) => teacher.id === managementAdvisorId),
    [managementAdvisorId, teachers],
  );

  useEffect(() => {
    if (classNames.length === 0) {
      setManagementClassName('');
      return;
    }
    if (!managementClassName || !classNames.some((item) => normalize(item) === normalize(managementClassName))) {
      setManagementClassName(classNames[0]);
    }
  }, [classNames, managementClassName]);

  useEffect(() => {
    if (!managementClassName) {
      setManagementStudentIds([]);
      setManagementAdvisorId('');
      return;
    }
    setManagementStudentIds(students
      .filter((student) => normalize(student.className) === normalize(managementClassName))
      .map((student) => student.id));
    const advisor = teachers.find((teacher) => normalize(teacher.homeroomClass) === normalize(managementClassName));
    setManagementAdvisorId(advisor?.id || '');
  }, [managementClassName, students, teachers]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'name' ? { code: generateCode(value, prev.academicYear) } : {}),
    }));
  };

  const toggleTeacher = (teacher) => {
    setSelectedTeacherIds((prev) => (
      prev.includes(teacher.id) ? prev.filter((id) => id !== teacher.id) : [...prev, teacher.id]
    ));
  };

  const toggleStudent = (student) => {
    setSelectedStudentIds((prev) => (
      prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
    ));
  };

  const toggleManagementStudent = (student) => {
    setManagementStudentIds((prev) => (
      prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id]
    ));
  };

  const saveClassAssignments = async () => {
    if (!managementClassName) {
      toast({ title: 'Sınıf seçin', description: 'Öğrenci veya danışman atamak için önce sınıf seçmelisiniz.', variant: 'destructive' });
      return;
    }
    try {
      setManagementSaving(true);
      const result = await updateClassAssignments(managementClassName, {
        studentIds: managementStudentIds,
        advisorTeacherId: managementAdvisorId || null,
      });
      toast({
        title: 'Sınıf atamaları güncellendi',
        description: `${result.name || managementClassName} için ${result.studentCount ?? managementStudentIds.length} öğrenci kaydedildi.`,
      });
      await load();
    } catch (err) {
      toast({ title: 'Atamalar kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setManagementSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    const className = deleteTargetName || managementClassName;
    if (!className) return;
    const transferTo = deleteTransferTo === DEACTIVATE_OPTION ? '' : deleteTransferTo;
    try {
      setDeleting(true);
      const result = await deleteClass(className, transferTo);
      toast({
        title: 'Sınıf silindi',
        description: transferTo
          ? `${result.transferredStudentCount || 0} öğrenci ${result.transferredTo || transferTo} sınıfına taşındı.`
          : `${result.deactivatedStudentCount || 0} öğrenci pasife alındı; aktifleştirirken yeni sınıf seçilecek.`,
      });
      setDeleteDialogOpen(false);
      setDeleteTargetName('');
      setManagementClassName('');
      await load();
    } catch (err) {
      toast({ title: 'Sınıf silinemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (className) => {
    setDeleteTargetName(className);
    setDeleteTransferTo(DEACTIVATE_OPTION);
    setDeleteDialogOpen(true);
  };

  const addCourse = () => {
    const unused = courses.find((course) => !assignments.some((item) => item.courseName === (course.name || course.title || course.subject)));
    setAssignments((prev) => [...prev, {
      courseName: unused?.name || unused?.title || unused?.subject || '',
      teacherId: selectedTeacherIds[0] || null,
      weeklyHours: 2,
      isRequired: true,
    }]);
  };

  const updateAssignment = (index, key, value) => {
    setAssignments((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const validateStep = () => {
    if (step === 0 && (!form.name.trim() || !form.code.trim())) {
      toast({ title: 'Temel bilgiler eksik', description: 'Sınıf adı ve kodu alanları zorunlu.', variant: 'destructive' });
      return false;
    }
    if (step === 1 && assignments.some((item) => !item.courseName || !item.teacherId)) {
      toast({ title: 'Ders ataması eksik', description: 'Her ders için öğretmen seçin.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(steps.length - 1, prev + 1));
  };

  const submit = async () => {
    if (!validateStep()) return;
    try {
      setSaving(true);
      const result = await createCompleteClass({
        name: form.name,
        code: form.code,
        institutionUnit: form.institutionUnit,
        grade: form.grade,
        section: form.section,
        academicYear: form.academicYear,
        advisorTeacherId: form.advisorTeacherId || null,
        description: form.description,
        themeColor: form.themeColor,
        icon: form.icon,
        teachers: selectedTeacherIds.map((id) => ({ teacherId: id, role: id === form.advisorTeacherId ? 'Danışman' : 'Ders Öğretmeni' })),
        courses: assignments.map((item) => ({ ...item, teacherId: item.teacherId || null, weeklyHours: Number(item.weeklyHours || 0) })),
        studentIds: selectedStudentIds,
        modules,
      });
      toast({ title: 'Sınıf oluşturuldu', description: `${result.name} sınıfı canlı veritabanına kaydedildi.` });
      setStep(0);
      setForm((prev) => ({ ...prev, name: '', code: generateCode('', prev.academicYear), description: '' }));
      setSelectedTeacherIds([]);
      setSelectedStudentIds([]);
      await load();
    } catch (err) {
      toast({ title: 'Sınıf oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen space-y-5 text-white" data-testid="classes-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Sınıf Oluşturma</h1>
          <p className="text-sm text-slate-300">Yeni bir sınıf oluşturarak öğrencilerinizi organize edin ve eğitiminizi planlayın.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-foreground/15 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => setStep(0)}>İptal</Button>
          <Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={submit} disabled={saving}>
            <Check className="mr-2 h-4 w-4" /> {saving ? 'Oluşturuluyor...' : 'Sınıfı Oluştur'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınıf verisi alınamadı" message={error} onRetry={load} /> : null}
      <StepRail step={step} />

      <section className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Mevcut Sınıf Atamaları</h2>
            <p className="text-sm text-slate-400">Sınıf seçip öğrencileri ve sınıf danışmanını sonradan güncelleyin.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FeatureGate module="classes" action="delete">
              <Button variant="outline" className="rounded-xl border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200" onClick={() => openDeleteDialog(managementClassName)} disabled={!managementClassName}>
                <Trash2 className="mr-2 h-4 w-4" /> Sınıfı Sil
              </Button>
            </FeatureGate>
            <FeatureGate module="classes" action="edit">
              <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveClassAssignments} disabled={managementSaving || !managementClassName}>
                <Save className="mr-2 h-4 w-4" /> {managementSaving ? 'Kaydediliyor...' : 'Atamaları Kaydet'}
              </Button>
            </FeatureGate>
          </div>
        </div>

        {classNames.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-foreground/15 p-5 text-center text-sm text-slate-400">Atama yapılabilecek kayıtlı sınıf bulunmuyor.</p>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-xl border border-foreground/10 bg-foreground/5 p-4">
              <Field label="Sınıf">
                <ThemedSelect value={managementClassName} onValueChange={setManagementClassName} options={classNames} ariaLabel="Sınıf" />
              </Field>
              <Field label="Sınıf Danışmanı">
                <ThemedSelect
                  value={managementAdvisorId}
                  onValueChange={setManagementAdvisorId}
                  emptyLabel="Danışman yok"
                  ariaLabel="Sınıf danışmanı"
                  options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.fullName} • ${teacher.departmentOrBranch || 'Branş yok'}` }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Detail label="Öğrenci" value={`${managementStudentIds.length}`} />
                <Detail label="Mevcut" value={`${selectedManagementClassStudents.length}`} />
              </div>
              <div className="rounded-xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-3">
                <p className="text-xs uppercase text-slate-400">Danışman</p>
                <p className="mt-1 font-semibold">{managementAdvisor?.fullName || 'Atanmadı'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input value={managementStudentQuery} onChange={(event) => setManagementStudentQuery(event.target.value)} placeholder="Atanacak öğrenci ara..." className="border-foreground/10 bg-[hsl(var(--ci-card))] pl-9 text-foreground" />
              </div>
              <div className="max-h-[330px] overflow-y-auto rounded-xl border border-foreground/10">
                {filteredManagementStudents.map((student) => {
                  const selected = managementStudentIds.includes(student.id);
                  const inAnotherClass = student.className && normalize(student.className) !== normalize(managementClassName) && !normalize(student.className).includes('bekleyen');
                  return (
                    <button key={student.id} type="button" onClick={() => toggleManagementStudent(student)} className={`grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-foreground/5 p-3 text-left last:border-b-0 ${selected ? 'bg-blue-500/15' : 'hover:bg-foreground/5'}`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-blue-400 bg-blue-500' : 'border-foreground/20'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                      <span className="min-w-0">
                        <b className="block truncate">{student.fullName}</b>
                        <small className="block truncate text-slate-400">{student.schoolNumber || '-'} • {student.className || 'Sınıf bekliyor'}</small>
                      </span>
                      {inAnotherClass ? <Badge variant="outline" className="text-xs">Taşınır</Badge> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-5 shadow-sm">
          {step === 0 ? (
            <section className="space-y-6">
              <div><h2 className="text-xl font-black">Temel Bilgiler</h2><p className="text-sm text-slate-400">Sınıfınızın temel bilgilerini girerek başlayın.</p></div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Sınıf Adı" required><Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" placeholder="7-A" /></Field>
                <Field label="Sınıf Kodu" required><Input value={form.code} onChange={(event) => updateForm('code', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" /></Field>
                <Field label="Kurum Birimi" required>
                  <ThemedSelect value={form.institutionUnit} onValueChange={(value) => updateForm('institutionUnit', value)} options={unitOptions} ariaLabel="Kurum birimi" />
                </Field>
                <Field label="Sınıf Seviyesi" required>
                  <ThemedSelect value={form.grade} onValueChange={(value) => updateForm('grade', value)} options={gradeOptions} ariaLabel="Sınıf seviyesi" />
                </Field>
                <Field label="Şube / Sınıf" required>
                  <ThemedSelect value={form.section} onValueChange={(value) => updateForm('section', value)} options={sectionOptions} ariaLabel="Şube veya sınıf" />
                </Field>
                <Field label="Eğitim Dönemi" required><Input value={form.academicYear} onChange={(event) => updateForm('academicYear', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" /></Field>
                <Field label="Sınıf Danışmanı">
                  <ThemedSelect
                    value={form.advisorTeacherId}
                    emptyLabel="Danışman seçin"
                    ariaLabel="Sınıf danışmanı seçin"
                    options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.fullName} • ${teacher.departmentOrBranch || 'Branş yok'}` }))}
                    onValueChange={(value) => {
                      updateForm('advisorTeacherId', value);
                      if (value && !selectedTeacherIds.includes(value)) setSelectedTeacherIds((prev) => [...prev, value]);
                    }}
                  />
                </Field>
                <Field label="Açıklama" className="md:col-span-2">
                  <Textarea value={form.description} maxLength={250} onChange={(event) => updateForm('description', event.target.value)} className="min-h-[110px] border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" placeholder="Sınıf açıklaması..." />
                  <p className="mt-1 text-right text-xs text-slate-500">{form.description.length} / 250</p>
                </Field>
                <div className="rounded-2xl border border-dashed border-blue-400/40 p-8 text-center md:col-span-1">
                  <ImagePlus className="mx-auto h-8 w-8 text-blue-300" />
                  <p className="mt-3 text-sm text-slate-300">Sınıf görseli yükleme alanı</p>
                  <p className="text-xs text-slate-500">Storage entegrasyonu olan upload modülü ile genişletilebilir.</p>
                </div>
                <Field label="Renk Teması">
                  <div className="flex flex-wrap gap-4 pt-3">
                    {colorOptions.map((color) => (
                      <button key={color} type="button" onClick={() => updateForm('themeColor', color)} className={`h-9 w-9 rounded-full border-2 ${form.themeColor === color ? 'border-white ring-2 ring-blue-500' : 'border-transparent'}`} style={{ background: color }} />
                    ))}
                  </div>
                </Field>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-6">
              <div><h2 className="text-xl font-black">Sınıf Öğretmenleri</h2><p className="text-sm text-slate-400">Bu sınıfın sorumlusu olacak öğretmenleri seçin.</p></div>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} placeholder="Öğretmen ara..." className="border-foreground/10 bg-[hsl(var(--ci-card))] pl-9 text-foreground" /></div>
                    <ThemedSelect value={teacherBranchFilter} onValueChange={setTeacherBranchFilter} className="h-10" ariaLabel="Öğretmen branşı" options={[{ value: 'all', label: 'Tümü' }, ...branches.map((item) => ({ value: item, label: item }))]} />
                  </div>
                  <div className="max-h-[360px] overflow-y-auto rounded-xl border border-foreground/10">
                    {filteredTeachers.map((teacher) => {
                      const selected = selectedTeacherIds.includes(teacher.id);
                      return (
                        <button key={teacher.id} type="button" onClick={() => toggleTeacher(teacher)} className={`flex w-full items-center gap-3 border-b border-foreground/5 p-3 text-left last:border-b-0 ${selected ? 'bg-blue-500/15' : 'hover:bg-foreground/5'}`}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-blue-400 bg-blue-500' : 'border-foreground/20'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xs font-black">{initials(teacher.fullName)}</span>
                          <span><b>{teacher.fullName}</b><small className="block text-slate-400">{teacher.departmentOrBranch}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 p-4">
                  <div className="mb-3 flex justify-between"><b>Seçilen Öğretmenler ({selectedTeachers.length})</b><button className="text-xs text-slate-400" onClick={() => setSelectedTeacherIds([])}>Temizle</button></div>
                  <div className="space-y-2">{selectedTeachers.map((teacher) => <SelectedPill key={teacher.id} label={teacher.fullName} sub={teacher.departmentOrBranch} onRemove={() => toggleTeacher(teacher)} />)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-foreground/10 p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-black">Derse Atanacak Öğretmenler</h3><Button variant="outline" size="sm" className="border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10" onClick={addCourse}><Plus className="mr-2 h-4 w-4" /> Ders Ekle</Button></div>
                <div className="space-y-3">
                  {assignments.map((assignment, index) => (
                    <div key={`${assignment.courseName}-${index}`} className="grid gap-2 rounded-xl border border-foreground/10 p-3 lg:grid-cols-[1fr_1fr_110px_110px_44px]">
                      <Input value={assignment.courseName} onChange={(event) => updateAssignment(index, 'courseName', event.target.value)} placeholder="Ders" className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
                      <ThemedSelect value={assignment.teacherId || ''} onValueChange={(value) => updateAssignment(index, 'teacherId', value || null)} emptyLabel="Öğretmen seç" className="h-10" ariaLabel={`${assignment.courseName || 'Ders'} öğretmeni`} options={selectedTeachers.map((teacher) => ({ value: teacher.id, label: teacher.fullName }))} />
                      <Input type="number" value={assignment.weeklyHours} onChange={(event) => updateAssignment(index, 'weeklyHours', event.target.value)} className="border-foreground/10 bg-[hsl(var(--ci-card))] text-foreground" />
                      <ThemedSelect value={assignment.isRequired ? 'required' : 'optional'} onValueChange={(value) => updateAssignment(index, 'isRequired', value === 'required')} className="h-10" ariaLabel={`${assignment.courseName || 'Ders'} türü`} options={[{ value: 'required', label: 'Zorunlu' }, { value: 'optional', label: 'Seçmeli' }]} />
                      <Button variant="outline" size="icon" className="border-foreground/10 bg-foreground/5 text-red-300 hover:bg-red-500/10" onClick={() => setAssignments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-6">
              <div><h2 className="text-xl font-black">Öğrenciler</h2><p className="text-sm text-slate-400">Sınıfa eklenecek öğrencileri seçin.</p></div>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_160px]">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Öğrenci ara..." className="border-foreground/10 bg-[hsl(var(--ci-card))] pl-9 text-foreground" /></div>
                    <ThemedSelect value={studentFilter} onValueChange={setStudentFilter} className="h-10" ariaLabel="Öğrenci filtresi" options={[{ value: 'all', label: 'Filtrele' }, { value: 'active', label: 'Aktif' }, { value: 'waiting', label: 'Sınıf Bekleyen' }]} />
                  </div>
                  <div className="max-h-[430px] overflow-y-auto rounded-xl border border-foreground/10">
                    {filteredStudents.map((student) => {
                      const selected = selectedStudentIds.includes(student.id);
                      return (
                        <button key={student.id} type="button" onClick={() => toggleStudent(student)} className={`grid w-full grid-cols-[28px_60px_1fr] items-center gap-3 border-b border-foreground/5 p-3 text-left last:border-b-0 ${selected ? 'bg-blue-500/15' : 'hover:bg-foreground/5'}`}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-blue-400 bg-blue-500' : 'border-foreground/20'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                          <span className="text-sm text-slate-400">{student.schoolNumber || '-'}</span>
                          <span><b>{student.fullName}</b><small className="block text-slate-400">{student.className || 'Sınıf bekliyor'}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 p-4">
                  <div className="mb-3 flex justify-between"><b>Seçilen Öğrenciler ({selectedStudents.length})</b><button className="text-xs text-slate-400" onClick={() => setSelectedStudentIds([])}>Tümünü Temizle</button></div>
                  <div className="max-h-[410px] space-y-2 overflow-y-auto">{selectedStudents.map((student) => <SelectedPill key={student.id} label={student.fullName} sub={student.schoolNumber || student.className} onRemove={() => toggleStudent(student)} />)}</div>
                </div>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-6">
              <div><h2 className="text-xl font-black">Sınıf Ayarları</h2><p className="text-sm text-slate-400">Sınıf için ek ayarları yapılandırın.</p></div>
              <Field label="Sınıf Rengi">
                <div className="flex flex-wrap gap-4 pt-2">{colorOptions.map((color) => <button key={color} type="button" onClick={() => updateForm('themeColor', color)} className={`h-10 w-10 rounded-full border-2 ${form.themeColor === color ? 'border-white ring-2 ring-blue-500' : 'border-transparent'}`} style={{ background: color }} />)}</div>
              </Field>
              <Field label="Sınıf Simgesi">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{iconOptions.map((icon) => <button key={icon} type="button" onClick={() => updateForm('icon', icon)} className={`flex h-12 items-center justify-center rounded-xl border ${form.icon === icon ? 'border-blue-400 bg-blue-500/20' : 'border-foreground/10 bg-foreground/5'}`}><ClassIcon name={icon} color={form.themeColor} /></button>)}</div>
              </Field>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries({
                  attendance: 'Devamsızlık Takibi',
                  grades: 'Not Sistemi',
                  liveLessons: 'Canlı Dersler',
                  homework: 'Ödev Sistemi',
                  study: 'Etüt Sistemi',
                  messaging: 'Mesajlaşma',
                }).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setModules((prev) => ({ ...prev, [key]: !prev[key] }))} className={`flex items-center justify-between rounded-xl border p-4 ${modules[key] ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-foreground/10 bg-foreground/5 text-slate-300'}`}>
                    <span>{label}</span><span className={`h-5 w-9 rounded-full ${modules[key] ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" className="rounded-xl border-foreground/10 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}><ArrowLeft className="mr-2 h-4 w-4" /> Geri</Button>
            {step < steps.length - 1 ? (
              <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={nextStep}>İleri: {steps[step + 1][1]} <ChevronRight className="ml-2 h-4 w-4" /></Button>
            ) : (
              <FeatureGate module="classes" action="create"><Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={submit} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Sınıfı Oluştur'}</Button></FeatureGate>
            )}
          </div>
        </main>

        <aside className="space-y-5">
          <Preview form={form} selectedTeachers={selectedTeachers} selectedStudents={selectedStudents} assignments={assignments} />
          <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-5 text-foreground">
            <h3 className="font-black">Sınıf Oluşturma Süreci</h3>
            <div className="mt-4 space-y-2">{steps.map(([key, title, desc], index) => <div key={key} className={`flex items-center gap-3 rounded-xl border p-3 ${step >= index ? 'border-blue-400/40 bg-blue-500/10' : 'border-foreground/10 bg-foreground/5'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full ${step > index ? 'bg-teal-500' : step === index ? 'bg-blue-600' : 'bg-slate-700'}`}>{step > index ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</div><div><b className="text-sm">{title}</b><p className="text-xs text-slate-400">{desc}</p></div></div>)}</div>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card)/0.8)] p-5 text-foreground">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Kayıtlı Sınıflar</h3>
              <Button variant="outline" size="sm" className="border-foreground/15 bg-foreground/5 text-white hover:bg-foreground/10 hover:text-white" onClick={() => setViewOpen(true)} disabled={existingSummary.length === 0}>
                <Eye className="mr-1.5 h-4 w-4" /> Gör ({existingSummary.length})
              </Button>
            </div>
            <div className="mt-4 space-y-2">{existingSummary.length === 0 ? <p className="text-sm text-slate-400">Henüz kayıtlı sınıf yönetim kaydı yok.</p> : existingSummary.slice(0, 6).map((item) => <div key={item.code || item.name} className="rounded-xl border border-foreground/10 p-3"><div className="flex items-center justify-between gap-2"><b>{item.name}</b><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} /><FeatureGate module="classes" action="delete"><Button type="button" variant="ghost" size="icon" title={`${item.name} sınıfını sil`} className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => openDeleteDialog(item.name)}><Trash2 className="h-4 w-4" /></Button></FeatureGate></div></div><p className="mt-1 text-xs text-slate-400">{item.studentCount} öğrenci • {item.teacherCount} öğretmen • {item.courseCount} ders</p></div>)}</div>
          </div>
        </aside>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kayıtlı Sınıflar ({existingSummary.length})</DialogTitle>
            <DialogDescription>Tüm kayıtlı sınıflar ve tüm detayları.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {existingSummary.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Henüz kayıtlı sınıf bulunmuyor.</p>
            ) : existingSummary.map((item) => (
              <div key={item.code || item.name} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-full" style={{ background: item.color }} />
                    <div>
                      <p className="text-base font-bold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.code || 'Kod yok'} • {item.academicYear || 'Dönem yok'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.institutionUnit || 'Birim yok'}</Badge>
                    <FeatureGate module="classes" action="delete">
                      <Button type="button" variant="outline" size="icon" title={`${item.name} sınıfını sil`} className="h-9 w-9 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => openDeleteDialog(item.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </FeatureGate>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Detail label="Seviye" value={item.grade || '-'} />
                  <Detail label="Şube" value={item.section || '-'} />
                  <Detail label="Danışman" value={item.advisorName || 'Atanmadı'} />
                  <Detail label="Öğrenci" value={`${item.studentCount}`} />
                  <Detail label="Öğretmen" value={`${item.teacherCount}`} />
                  <Detail label="Ders" value={`${item.courseCount}`} />
                </div>
                {item.courses.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.courses.map((course, index) => (
                      <Badge key={`${course.courseName || course}-${index}`} variant="outline" className="text-xs">
                        {course.courseName || course.name || 'Ders'}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {item.description ? <p className="mt-3 text-sm text-muted-foreground">{item.description}</p> : null}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) { setDeleteDialogOpen(open); if (!open) setDeleteTargetName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTargetName || managementClassName || 'Sınıf'} silinsin mi?</DialogTitle>
            <DialogDescription>
              Sınıf kaydı ve güncel ders programı kaldırılır. Öğrenci hesapları, yoklama ve sınav geçmişi silinmez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Sınıftaki {deleteStudentCount} öğrenci ne olsun?
            </p>
            <Select value={deleteTransferTo} onValueChange={setDeleteTransferTo} disabled={deleting}>
              <SelectTrigger>
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEACTIVATE_OPTION}>Sınıfa taşıma — öğrencileri pasife al</SelectItem>
                {deleteTransferOptions.map((item) => (
                  <SelectItem key={item} value={item}>{item} sınıfına taşı</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {deleteTransferTo === DEACTIVATE_OPTION
                ? 'Öğrenciler sınıfsız kalır ve pasife alınır; giriş yapamazlar. Aktifleştirirken yeni sınıf seçmeniz istenir.'
                : `Öğrenciler ${deleteTransferTo} sınıfına aktarılır ve aktif kalır.`}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Vazgeç</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={handleDeleteClass} disabled={deleting}>
              <Trash2 className="mr-2 h-4 w-4" /> {deleting ? 'Siliniyor...' : 'Sınıfı Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm text-slate-300">{label} {required ? <b className="text-red-400">*</b> : null}</span>
      {children}
    </label>
  );
}

function SelectedPill({ label, sub, onRemove }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/5 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">{initials(label)}</span>
        <span className="min-w-0"><b className="block truncate text-sm">{label}</b><small className="truncate text-slate-400">{sub}</small></span>
      </div>
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-white">×</button>
    </div>
  );
}
