import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Check, ChevronRight, GraduationCap, ImagePlus,
  Lock, Palette, Plus, Save, Search, Settings, ShieldCheck, Sparkles,
  Trash2, UserCheck, Users,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import {
  createCompleteClass,
  fetchCourses,
  fetchPlatformConfigurations,
  fetchStaff,
  fetchStudents,
} from '../lib/api/modules';

const steps = [
  ['basic', 'Temel Bilgiler', 'Sınıf detaylarını girin'],
  ['teachers', 'Öğretmen & Dersler', 'Öğretmen ve dersleri belirleyin'],
  ['students', 'Öğrenciler', 'Öğrenci ekleyin veya davet gönderin'],
  ['settings', 'Ayarlar', 'Sınıf ayarlarını yapılandırın'],
];

const colorOptions = ['#2563EB', '#7B61FF', '#22C55E', '#FF8A00', '#EF4444', '#06B6D4'];
const iconOptions = ['users', 'graduation', 'book', 'science', 'globe', 'palette', 'music', 'sport', 'code', 'star', 'target', 'spark'];
const unitOptions = ['İlkokul', 'Ortaokul', 'Lise', 'Dershane'];
const gradeOptions = Array.from({ length: 12 }, (_, index) => `${index + 1}. Sınıf`);
const sectionOptions = ['A Şubesi', 'B Şubesi', 'C Şubesi', 'D Şubesi'];

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
    <div className="rounded-2xl border border-white/10 bg-[#0D1B2A]/80 p-4 shadow-sm dark:bg-[#0D1B2A]/80">
      <div className="grid gap-3 lg:grid-cols-4">
        {steps.map(([key, title, desc], index) => {
          const active = step === index;
          const done = step > index;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                done ? 'border-teal-400 bg-teal-500 text-white'
                  : active ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_22px_rgba(37,99,235,0.45)]'
                    : 'border-white/10 bg-white/5 text-slate-400'
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
    <div className="rounded-2xl border border-white/10 bg-[#0D1B2A]/80 p-5 text-white shadow-sm">
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
          ['Okul', form.school],
          ['Seviye', form.grade],
          ['Şube', form.section],
          ['Dönem', form.academicYear],
          ['Danışman', advisor?.fullName || 'Atanmadı'],
          ['Öğrenci Sayısı', selectedStudents.length],
          ['Ders Sayısı', assignments.length],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-b-0">
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
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classConfigs, setClassConfigs] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [teacherBranchFilter, setTeacherBranchFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [form, setForm] = useState({
    name: '',
    code: '',
    school: '',
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

      const firstSchool = [...new Set((studentRows || []).map((item) => item.currentSchool).filter(Boolean))][0] || '';
      const firstCourses = (courseRows || []).slice(0, 4).map((course) => ({
        courseName: course.name || course.title || course.subject || 'Ders',
        teacherId: null,
        weeklyHours: 4,
        isRequired: true,
      }));
      setForm((prev) => ({ ...prev, school: prev.school || firstSchool }));
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

  const schools = useMemo(() => [...new Set(students.map((item) => item.currentSchool).filter(Boolean))], [students]);
  const branches = useMemo(() => [...new Set(teachers.map((item) => item.departmentOrBranch).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [teachers]);
  const selectedTeachers = useMemo(() => teachers.filter((item) => selectedTeacherIds.includes(item.id)), [selectedTeacherIds, teachers]);
  const selectedStudents = useMemo(() => students.filter((item) => selectedStudentIds.includes(item.id)), [selectedStudentIds, students]);

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

  const existingSummary = useMemo(() => classConfigs.map((item) => ({
    name: item.name,
    code: item.code,
    studentCount: item.studentIds?.length || students.filter((student) => student.className === item.name).length,
    teacherCount: item.teachers?.length || 0,
    courseCount: item.courses?.length || 0,
    color: item.themeColor || '#2563EB',
  })), [classConfigs, students]);

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
    if (step === 0 && (!form.name.trim() || !form.code.trim() || !form.school.trim())) {
      toast({ title: 'Temel bilgiler eksik', description: 'Sınıf adı, kodu ve okul alanları zorunlu.', variant: 'destructive' });
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
        school: form.school,
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
          <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => setStep(0)}>İptal</Button>
          <Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={submit} disabled={saving}>
            <Check className="mr-2 h-4 w-4" /> {saving ? 'Oluşturuluyor...' : 'Sınıfı Oluştur'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Sınıf verisi alınamadı" message={error} onRetry={load} /> : null}
      <StepRail step={step} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="rounded-2xl border border-white/10 bg-[#0D1B2A]/80 p-5 shadow-sm">
          {step === 0 ? (
            <section className="space-y-6">
              <div><h2 className="text-xl font-black">Temel Bilgiler</h2><p className="text-sm text-slate-400">Sınıfınızın temel bilgilerini girerek başlayın.</p></div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Sınıf Adı" required><Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="border-white/10 bg-[#071120] text-white" placeholder="7-A" /></Field>
                <Field label="Sınıf Kodu" required><Input value={form.code} onChange={(event) => updateForm('code', event.target.value)} className="border-white/10 bg-[#071120] text-white" /></Field>
                <Field label="Okul" required>
                  <select value={form.school} onChange={(event) => updateForm('school', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white">
                    <option value="">Okul seçin</option>
                    {schools.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Kurum Birimi" required>
                  <select value={form.institutionUnit} onChange={(event) => updateForm('institutionUnit', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white">
                    {unitOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Sınıf Seviyesi" required>
                  <select value={form.grade} onChange={(event) => updateForm('grade', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white">
                    {gradeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Şube / Sınıf" required>
                  <select value={form.section} onChange={(event) => updateForm('section', event.target.value)} className="h-11 w-full rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white">
                    {sectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="Eğitim Dönemi" required><Input value={form.academicYear} onChange={(event) => updateForm('academicYear', event.target.value)} className="border-white/10 bg-[#071120] text-white" /></Field>
                <Field label="Sınıf Danışmanı">
                  <select value={form.advisorTeacherId} onChange={(event) => { updateForm('advisorTeacherId', event.target.value); if (event.target.value && !selectedTeacherIds.includes(event.target.value)) setSelectedTeacherIds((prev) => [...prev, event.target.value]); }} className="h-11 w-full rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white">
                    <option value="">Danışman seçin</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} • {teacher.departmentOrBranch}</option>)}
                  </select>
                </Field>
                <Field label="Açıklama" className="md:col-span-2">
                  <Textarea value={form.description} maxLength={250} onChange={(event) => updateForm('description', event.target.value)} className="min-h-[110px] border-white/10 bg-[#071120] text-white" placeholder="Sınıf açıklaması..." />
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
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} placeholder="Öğretmen ara..." className="border-white/10 bg-[#071120] pl-9 text-white" /></div>
                    <select value={teacherBranchFilter} onChange={(event) => setTeacherBranchFilter(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white"><option value="all">Tümü</option>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/10">
                    {filteredTeachers.map((teacher) => {
                      const selected = selectedTeacherIds.includes(teacher.id);
                      return (
                        <button key={teacher.id} type="button" onClick={() => toggleTeacher(teacher)} className={`flex w-full items-center gap-3 border-b border-white/5 p-3 text-left last:border-b-0 ${selected ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-blue-400 bg-blue-500' : 'border-white/20'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-xs font-black">{initials(teacher.fullName)}</span>
                          <span><b>{teacher.fullName}</b><small className="block text-slate-400">{teacher.departmentOrBranch}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
                  <div className="mb-3 flex justify-between"><b>Seçilen Öğretmenler ({selectedTeachers.length})</b><button className="text-xs text-slate-400" onClick={() => setSelectedTeacherIds([])}>Temizle</button></div>
                  <div className="space-y-2">{selectedTeachers.map((teacher) => <SelectedPill key={teacher.id} label={teacher.fullName} sub={teacher.departmentOrBranch} onRemove={() => toggleTeacher(teacher)} />)}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-black">Derse Atanacak Öğretmenler</h3><Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={addCourse}><Plus className="mr-2 h-4 w-4" /> Ders Ekle</Button></div>
                <div className="space-y-3">
                  {assignments.map((assignment, index) => (
                    <div key={`${assignment.courseName}-${index}`} className="grid gap-2 rounded-xl border border-white/10 p-3 lg:grid-cols-[1fr_1fr_110px_110px_44px]">
                      <Input value={assignment.courseName} onChange={(event) => updateAssignment(index, 'courseName', event.target.value)} placeholder="Ders" className="border-white/10 bg-[#071120] text-white" />
                      <select value={assignment.teacherId || ''} onChange={(event) => updateAssignment(index, 'teacherId', event.target.value || null)} className="h-10 rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white"><option value="">Öğretmen seç</option>{selectedTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}</select>
                      <Input type="number" value={assignment.weeklyHours} onChange={(event) => updateAssignment(index, 'weeklyHours', event.target.value)} className="border-white/10 bg-[#071120] text-white" />
                      <select value={assignment.isRequired ? 'required' : 'optional'} onChange={(event) => updateAssignment(index, 'isRequired', event.target.value === 'required')} className="h-10 rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white"><option value="required">Zorunlu</option><option value="optional">Seçmeli</option></select>
                      <Button variant="outline" size="icon" className="border-white/10 bg-white/5 text-red-300 hover:bg-red-500/10" onClick={() => setAssignments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
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
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Öğrenci ara..." className="border-white/10 bg-[#071120] pl-9 text-white" /></div>
                    <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#071120] px-3 text-sm text-white"><option value="all">Filtrele</option><option value="active">Aktif</option><option value="waiting">Sınıf Bekleyen</option></select>
                  </div>
                  <div className="max-h-[430px] overflow-y-auto rounded-xl border border-white/10">
                    {filteredStudents.map((student) => {
                      const selected = selectedStudentIds.includes(student.id);
                      return (
                        <button key={student.id} type="button" onClick={() => toggleStudent(student)} className={`grid w-full grid-cols-[28px_60px_1fr] items-center gap-3 border-b border-white/5 p-3 text-left last:border-b-0 ${selected ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-blue-400 bg-blue-500' : 'border-white/20'}`}>{selected ? <Check className="h-3 w-3" /> : null}</span>
                          <span className="text-sm text-slate-400">{student.schoolNumber || '-'}</span>
                          <span><b>{student.fullName}</b><small className="block text-slate-400">{student.className || 'Sınıf bekliyor'}</small></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 p-4">
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
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{iconOptions.map((icon) => <button key={icon} type="button" onClick={() => updateForm('icon', icon)} className={`flex h-12 items-center justify-center rounded-xl border ${form.icon === icon ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5'}`}><ClassIcon name={icon} color={form.themeColor} /></button>)}</div>
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
                  <button key={key} type="button" onClick={() => setModules((prev) => ({ ...prev, [key]: !prev[key] }))} className={`flex items-center justify-between rounded-xl border p-4 ${modules[key] ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                    <span>{label}</span><span className={`h-5 w-9 rounded-full ${modules[key] ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white" disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}><ArrowLeft className="mr-2 h-4 w-4" /> Geri</Button>
            {step < steps.length - 1 ? (
              <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={nextStep}>İleri: {steps[step + 1][1]} <ChevronRight className="ml-2 h-4 w-4" /></Button>
            ) : (
              <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={submit} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Sınıfı Oluştur'}</Button>
            )}
          </div>
        </main>

        <aside className="space-y-5">
          <Preview form={form} selectedTeachers={selectedTeachers} selectedStudents={selectedStudents} assignments={assignments} />
          <div className="rounded-2xl border border-white/10 bg-[#0D1B2A]/80 p-5 text-white">
            <h3 className="font-black">Sınıf Oluşturma Süreci</h3>
            <div className="mt-4 space-y-2">{steps.map(([key, title, desc], index) => <div key={key} className={`flex items-center gap-3 rounded-xl border p-3 ${step >= index ? 'border-blue-400/40 bg-blue-500/10' : 'border-white/10 bg-white/5'}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full ${step > index ? 'bg-teal-500' : step === index ? 'bg-blue-600' : 'bg-slate-700'}`}>{step > index ? <Check className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</div><div><b className="text-sm">{title}</b><p className="text-xs text-slate-400">{desc}</p></div></div>)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0D1B2A]/80 p-5 text-white">
            <h3 className="font-black">Kayıtlı Sınıflar</h3>
            <div className="mt-4 space-y-2">{existingSummary.length === 0 ? <p className="text-sm text-slate-400">Henüz kayıtlı sınıf yönetim kaydı yok.</p> : existingSummary.slice(0, 6).map((item) => <div key={item.code || item.name} className="rounded-xl border border-white/10 p-3"><div className="flex items-center justify-between"><b>{item.name}</b><span className="h-3 w-3 rounded-full" style={{ background: item.color }} /></div><p className="mt-1 text-xs text-slate-400">{item.studentCount} öğrenci • {item.teacherCount} öğretmen • {item.courseCount} ders</p></div>)}</div>
          </div>
        </aside>
      </div>
    </motion.div>
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">{initials(label)}</span>
        <span className="min-w-0"><b className="block truncate text-sm">{label}</b><small className="truncate text-slate-400">{sub}</small></span>
      </div>
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-white">×</button>
    </div>
  );
}
