import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Clock,
  FileText,
  Save,
  CheckCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { fetchAttendance, fetchStudents, saveAttendance } from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const statusOptions = [
  { value: 'Katildi', label: 'Var', icon: Check, color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'Katilmadi', label: 'Yok', icon: X, color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
  { value: 'Gec', label: 'Geç', icon: Clock, color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'Izinli', label: 'İzinli', icon: FileText, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
];
const FALLBACK_CLASSES = [];

function normalizeStatus(value = '') {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('katildi')) return 'Katildi';
  if (normalized.includes('gec')) return 'Gec';
  if (normalized.includes('izin')) return 'Izinli';
  return 'Katilmadi';
}

export default function Attendance() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceEntries, setAttendanceEntries] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, attendanceList] = await Promise.all([
        fetchStudents(),
        fetchAttendance().catch(() => []),
      ]);
      setStudents(studentList);
      setAttendanceEntries(attendanceList);
      const firstClass = [...new Set([
        ...studentList.map((item) => item.className).filter(Boolean),
        ...attendanceList.map((item) => item.className).filter(Boolean),
        ...FALLBACK_CLASSES,
      ])][0] || '';
      setSelectedClass((prev) => prev || firstClass);
    } catch (err) {
      setError(err.message || 'Yoklama verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const classes = useMemo(() => [...new Set([
    ...students.map((item) => item.className).filter(Boolean),
    ...attendanceEntries.map((item) => item.className).filter(Boolean),
    ...FALLBACK_CLASSES,
  ])], [students, attendanceEntries]);
  const classStudents = useMemo(() => students.filter((item) => item.className === selectedClass), [students, selectedClass]);
  const lessons = useMemo(() => [...new Set(attendanceEntries.filter((item) => item.className === selectedClass).map((item) => item.lesson).filter(Boolean))], [attendanceEntries, selectedClass]);

  useEffect(() => {
    if (!selectedLesson && lessons.length > 0) {
      setSelectedLesson(lessons[0]);
    }
  }, [lessons, selectedLesson]);

  useEffect(() => {
    const next = {};
    classStudents.forEach((student) => {
      const existing = attendanceEntries
        .filter((item) => item.className === selectedClass && item.lesson === selectedLesson && item.studentName === student.fullName)
        .sort((a, b) => new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime())[0];
      next[student.id] = existing ? normalizeStatus(existing.status) : 'Katildi';
    });
    setAttendance(next);
  }, [classStudents, attendanceEntries, selectedClass, selectedLesson]);

  const setStatus = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const setAllPresent = () => {
    const next = {};
    classStudents.forEach((student) => {
      next[student.id] = 'Katildi';
    });
    setAttendance((prev) => ({ ...prev, ...next }));
    toast({
      title: 'Hepsi var olarak işaretlendi',
      description: `${classStudents.length} öğrenci var olarak güncellendi.`,
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = await saveAttendance({
        className: selectedClass,
        lesson: selectedLesson || 'Genel Ders',
        lessonDate: new Date().toISOString(),
        students: classStudents.map((student) => ({
          name: student.fullName,
          status: attendance[student.id] || 'Katildi',
        })),
      });
      setAttendanceEntries((prev) => {
        const filtered = prev.filter((item) => !(item.className === selectedClass && item.lesson === selectedLesson));
        return [...filtered, ...payload];
      });
      toast({
        title: 'Yoklama kaydedildi',
        description: `${selectedClass} - ${selectedLesson || 'Ders'} kaydı backend’e işlendi.`,
      });
    } catch (err) {
      toast({
        title: 'Yoklama kaydedilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => classStudents.reduce((acc, student) => {
    const key = attendance[student.id] || 'Katildi';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { Katildi: 0, Katilmadi: 0, Gec: 0, Izinli: 0 }), [classStudents, attendance]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="attendance-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Yoklama</h1>
          <p className="text-muted-foreground mt-1">Günlük yoklama kayıtları</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={setAllPresent}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Hepsini Var İşaretle
          </Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Yoklama alınamadı" message={error} onRetry={loadAttendance} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Sınıf</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Ders</label>
              <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                <SelectTrigger><SelectValue placeholder="Ders seçin" /></SelectTrigger>
                <SelectContent>
                  {lessons.map((lesson) => <SelectItem key={lesson} value={lesson}>{lesson}</SelectItem>)}
                  <SelectItem value="Genel Ders">Genel Ders</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusOptions.map((status) => {
          const Icon = status.icon;
          const countKey = status.value;
          return (
            <Card key={status.value}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status.color.split(' ').slice(0, 2).join(' ')}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts[countKey] || 0}</p>
                  <p className="text-xs text-muted-foreground">{status.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selectedClass} Sınıfı Öğrencileri</CardTitle>
          <CardDescription>{classStudents.length} öğrenci</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {classStudents.map((student) => (
              <motion.div
                key={student.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-brand-primary text-white">
                      {student.fullName.split(' ').map((n) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{student.fullName}</p>
                    <p className="text-sm text-muted-foreground">{student.parentEmail || student.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {statusOptions.map((status) => {
                    const Icon = status.icon;
                    const isSelected = attendance[student.id] === status.value;
                    return (
                      <motion.button
                        key={status.value}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setStatus(student.id, status.value)}
                        className={`p-2 rounded-lg border-2 transition-all ${isSelected ? status.color : 'border-transparent bg-muted hover:bg-muted/80'}`}
                        title={status.label}
                      >
                        <Icon className="h-5 w-5" />
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
