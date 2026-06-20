import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, AlertCircle, CheckCircle, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAttendance, fetchStudents } from '../../lib/api/modules';

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ParentAttendance() {
  const { user } = useApp();
  const [children, setChildren] = useState([]);
  const [selectedChildKey, setSelectedChildKey] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const students = await fetchStudents();
      const linkedChildren = students.filter((item) => normalize(item.parentName) === normalize(user?.name) || normalize(item.parentEmail).includes(normalize(user?.username)));
      setChildren(linkedChildren);
      const currentKey = linkedChildren[0]?.username || linkedChildren[0]?.fullName || '';
      setSelectedChildKey(currentKey);
      if (linkedChildren[0]) {
        const payload = await fetchAttendance({ studentName: linkedChildren[0].fullName });
        setAttendance(payload);
      }
    } catch (err) {
      setError(err.message || 'Devamsızlık verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleChildChange = async (value) => {
    setSelectedChildKey(value);
    const selected = children.find((child) => (child.username || child.fullName) === value);
    if (!selected) return;
    const payload = await fetchAttendance({ studentName: selected.fullName });
    setAttendance(payload);
  };

  const summary = useMemo(() => {
    const present = attendance.filter((item) => normalize(item.status) === 'katildi').length;
    const absent = attendance.filter((item) => normalize(item.status) === 'devamsiz').length;
    const excuse = attendance.filter((item) => normalize(item.status) === 'izinli').length;
    const rate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;
    return { present, absent, excuse, rate };
  }, [attendance]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Devamsızlık verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parent-attendance-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Devamsızlık Takibi</h1>
          <p className="text-muted-foreground mt-1">Çocuğunuzun ders bazlı yoklama kayıtları</p>
        </div>
        {children.length > 0 ? (
          <Select value={selectedChildKey} onValueChange={handleChildChange}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Çocuk seçin" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.username || child.fullName} value={child.username || child.fullName}>
                  {child.fullName} ({child.className})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {error ? <ErrorBanner title="Devamsızlık verileri alınamadı" message={error} onRetry={loadAttendance} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          [summary.rate, 'Devam Oranı', CheckCircle, 'text-green-600', '%'],
          [summary.present, 'Katılım', ClipboardCheck, 'text-brand-primary', ''],
          [summary.absent, 'Devamsız', AlertCircle, 'text-red-600', ''],
          [summary.excuse, 'İzinli', Clock, 'text-yellow-600', ''],
        ].map(([value, label, Icon, color, suffix]) => (
          <motion.div variants={itemVariants} key={label}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}{suffix}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Ders Bazlı Kayıtlar</CardTitle>
            <CardDescription>Tarih ve ders seviyesinde devamsızlık görünümü</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Genel devam oranı</span>
                <span className="font-bold">{summary.rate}%</span>
              </div>
              <Progress value={summary.rate} className="h-3" />
            </div>
            {attendance.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{entry.lesson}</p>
                  <p className="text-sm text-muted-foreground">{entry.lessonDate} • {entry.className}</p>
                </div>
                <Badge className={
                  normalize(entry.status) === 'katildi'
                    ? 'bg-green-100 text-green-700'
                    : normalize(entry.status) === 'izinli'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }>
                  {entry.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
