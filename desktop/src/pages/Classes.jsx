import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Info,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  School,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { fetchAttendance, fetchContents, fetchPlatformConfigurations, fetchStaff, fetchStudents, upsertPlatformConfiguration } from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const weekDays = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];

function buildClassModels(students, teachers, attendance, contents) {
  const classNames = [...new Set(students.map((item) => item.className).filter(Boolean))];

  return classNames.map((className, index) => {
    const classStudents = students.filter((student) => student.className === className);
    const classTeachers = teachers.filter((teacher) => (teacher.assignedClasses || []).includes(className));
    const classAttendance = attendance.filter((item) => item.className === className);
    const lessons = [...new Set(classAttendance.map((item) => item.lesson).filter(Boolean))];
    const classContents = contents.filter((item) => {
      const targetClasses = item.targetClasses || [];
      return targetClasses.length === 0 || targetClasses.includes(className);
    });

    return {
      id: className,
      name: className,
      schedule: `${weekDays.join(', ')} • ${lessons.length > 0 ? lessons[0] : 'Genel Program'}`,
      studentCount: classStudents.length,
      teacherCount: classTeachers.length,
      students: classStudents,
      teachers: classTeachers,
      contents: classContents,
      scheduleItems: lessons.slice(0, 6).map((lesson, lessonIndex) => ({
        id: `${className}-${lesson}-${lessonIndex}`,
        day: weekDays[lessonIndex % weekDays.length],
        time: ['08:30-09:15', '09:25-10:10', '10:20-11:05', '11:15-12:00', '13:00-13:45', '13:55-14:40'][lessonIndex % 6],
        subject: lesson,
        teacher: classTeachers[lessonIndex % (classTeachers.length || 1)]?.fullName || 'Öğretmen',
        room: classTeachers[lessonIndex % (classTeachers.length || 1)]?.campus || 'Merkez Kampus',
      })),
      attendanceRate: classStudents.length > 0
        ? Math.round(
          (new Set(
            classAttendance
              .filter((item) => String(item.status || '').toLowerCase().includes('katildi'))
              .map((item) => item.studentName),
          ).size / classStudents.length) * 100,
        )
        : 0,
      homeroomTeacher: classTeachers.find((teacher) => teacher.homeroomClass === className)?.fullName || 'Atanmadı',
      branchSummary: [...new Set(classTeachers.map((teacher) => teacher.departmentOrBranch).filter(Boolean))],
      contentCount: classContents.length,
    };
  });
}

export default function Classes() {
  const { toast } = useToast();
  const EMPTY_HOME_ROOM_TEACHER = '__none__';
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', capacity: '24', homeroomTeacher: '', assignedTeachers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClasses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, teacherList, attendance, contents, savedConfigs] = await Promise.all([
        fetchStudents(),
        fetchStaff('Teacher').catch(() => []),
        fetchAttendance().catch(() => []),
        fetchContents(false).catch(() => []),
        fetchPlatformConfigurations('class-management').catch(() => []),
      ]);
      const derivedModels = buildClassModels(students, teacherList, attendance, contents);
      const savedModels = (savedConfigs || []).flatMap((item) => {
        try {
          const parsed = JSON.parse(item.payloadJson || '{}');
          return [{
            id: parsed.name,
            name: parsed.name,
            schedule: 'Özel sınıf planı',
            studentCount: parsed.capacity || 0,
            teacherCount: (parsed.assignedTeachers || []).length,
            students: [],
            teachers: teacherList.filter((teacher) => (parsed.assignedTeachers || []).includes(teacher.fullName)),
            contents: [],
            scheduleItems: [],
            attendanceRate: 0,
            homeroomTeacher: parsed.homeroomTeacher || 'Atanmadı',
            branchSummary: [],
            contentCount: 0,
            capacity: parsed.capacity || 0,
          }];
        } catch {
          return [];
        }
      });
      const models = [...derivedModels, ...savedModels.filter((saved) => !derivedModels.some((item) => item.name === saved.name))];
      setClasses(models);
      setTeachers(teacherList);
      setSelectedClass((prev) => prev || models[0] || null);
    } catch (err) {
      setError(err.message || 'Sınıf verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const classStats = useMemo(() => ({
    totalClasses: classes.length,
    totalStudents: classes.reduce((sum, item) => sum + item.studentCount, 0),
    totalTeachers: classes.reduce((sum, item) => sum + item.teacherCount, 0),
  }), [classes]);

  const teacherOptions = useMemo(() => {
    const unique = [...new Set(teachers.map((teacher) => teacher.fullName).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b, 'tr'));
  }, [teachers]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="classes-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Sınıflar & Gruplar</h1>
          <p className="text-muted-foreground mt-1">{classStats.totalClasses} aktif sınıf</p>
        </div>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Info className="h-4 w-4 mr-2" />
          Yeni Sınıf Oluştur
        </Button>
      </div>

      {error ? <ErrorBanner title="Sınıflar alınamadı" message={error} onRetry={loadClasses} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sınıf</p><p className="text-2xl font-bold">{classStats.totalClasses}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Öğrenci</p><p className="text-2xl font-bold">{classStats.totalStudents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Öğretmen</p><p className="text-2xl font-bold">{classStats.totalTeachers}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <motion.div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sınıflar</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[560px]">
                <div className="p-4 space-y-2">
                  {classes.map((cls) => (
                    <motion.div
                      key={cls.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedClass(cls)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedClass?.id === cls.id ? 'bg-brand-primary text-white' : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${selectedClass?.id === cls.id ? 'bg-white/20' : 'bg-background'}`}>
                          <School className={`h-5 w-5 ${selectedClass?.id === cls.id ? 'text-white' : 'text-brand-primary'}`} />
                        </div>
                        <div>
                          <p className="font-semibold">{cls.name}</p>
                          <p className={`text-xs ${selectedClass?.id === cls.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {cls.studentCount} öğrenci
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="lg:col-span-3">
          {selectedClass ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedClass.name} Sınıfı</CardTitle>
                    <p className="text-muted-foreground mt-1">{selectedClass.schedule}</p>
                    <p className="text-sm text-muted-foreground mt-1">Sınıf Öğretmeni: {selectedClass.homeroomTeacher}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-primary">{selectedClass.studentCount}</p>
                      <p className="text-xs text-muted-foreground">Öğrenci</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-brand-accent">{selectedClass.teacherCount}</p>
                      <p className="text-xs text-muted-foreground">Öğretmen</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6">
                <Tabs defaultValue="students">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="students" className="flex items-center gap-2"><Users className="h-4 w-4" />Öğrenciler</TabsTrigger>
                    <TabsTrigger value="teachers" className="flex items-center gap-2"><GraduationCap className="h-4 w-4" />Öğretmenler</TabsTrigger>
                    <TabsTrigger value="schedule" className="flex items-center gap-2"><Calendar className="h-4 w-4" />Program</TabsTrigger>
                    <TabsTrigger value="content" className="flex items-center gap-2"><BookOpen className="h-4 w-4" />İçerikler</TabsTrigger>
                  </TabsList>

                  <TabsContent value="students">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedClass.students.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-brand-primary text-white">
                              {student.fullName.split(' ').map((part) => part[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-xs text-muted-foreground">{student.parentName}</p>
                          </div>
                          <Badge variant="outline">{student.programType}</Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="teachers">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedClass.teachers.map((teacher) => (
                        <div key={teacher.id} className="p-4 rounded-lg bg-muted/50">
                          <p className="font-medium">{teacher.fullName}</p>
                          <p className="text-sm text-muted-foreground">{teacher.departmentOrBranch}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {selectedClass.branchSummary.map((branch) => (
                              <Badge key={`${teacher.id}-${branch}`} variant="outline">{branch}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="schedule">
                    <div className="space-y-3">
                      {selectedClass.scheduleItems.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                          <div className="text-center min-w-[70px]">
                            <p className="text-sm font-bold text-brand-primary">{lesson.time.split('-')[0]}</p>
                            <p className="text-xs text-muted-foreground">{lesson.day}</p>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{lesson.subject}</p>
                            <p className="text-sm text-muted-foreground">{lesson.teacher} • {lesson.room}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="content">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedClass.contents.map((content) => (
                        <Card key={content.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-brand-accent/10">
                                <BookOpen className="h-5 w-5 text-brand-accent" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{content.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{content.teacher} • {content.subject}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">{content.fileType?.toUpperCase() || 'İÇERİK'}</Badge>
                                  <span className="text-xs text-muted-foreground">{content.publishStatus}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : null}
        </motion.div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Sınıf Oluştur</DialogTitle>
            <DialogDescription>Sınıf adı, kontenjan ve öğretmen atamasını backend üzerinde kaydedin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sınıf adı</Label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kontenjan</Label>
              <Input type="number" value={form.capacity} onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Sınıf öğretmeni</Label>
              <Select
                value={form.homeroomTeacher || EMPTY_HOME_ROOM_TEACHER}
                onValueChange={(value) => setForm((prev) => ({ ...prev, homeroomTeacher: value === EMPTY_HOME_ROOM_TEACHER ? '' : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Sınıf öğretmeni seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_HOME_ROOM_TEACHER}>Henüz atama yapma</SelectItem>
                  {teacherOptions.map((teacherName) => (
                    <SelectItem key={teacherName} value={teacherName}>{teacherName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atanacak öğretmenler</Label>
              <div className="rounded-xl border p-3">
                <div className="flex flex-wrap gap-2">
                  {teacherOptions.map((teacherName) => {
                    const active = form.assignedTeachers.includes(teacherName);
                    return (
                      <Button
                        key={teacherName}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          assignedTeachers: active
                            ? prev.assignedTeachers.filter((item) => item !== teacherName)
                            : [...prev.assignedTeachers, teacherName],
                        }))}
                      >
                        {teacherName}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={async () => {
              try {
                await upsertPlatformConfiguration({
                  configurationType: 'class-management',
                  scopeKey: form.name,
                  displayName: `CLASS_MANAGEMENT::${form.name}`,
                  payloadJson: JSON.stringify({
                    name: form.name,
                    capacity: Number(form.capacity || 0),
                    homeroomTeacher: form.homeroomTeacher,
                    assignedTeachers: form.assignedTeachers,
                  }),
                });
                setCreateOpen(false);
                setForm({ name: '', capacity: '24', homeroomTeacher: '', assignedTeachers: [] });
                loadClasses();
                toast({ title: 'Sınıf oluşturuldu', description: 'Yeni sınıf backend üzerinde kaydedildi.' });
              } catch (err) {
                toast({ title: 'Sınıf oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
              }
            }}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
