import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Lock, RefreshCw, Search, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchExamResults, fetchStaff } from '../../lib/api/modules';

const normalize = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replaceAll('ç', 'c')
  .replaceAll('ğ', 'g')
  .replaceAll('ı', 'i')
  .replaceAll('ö', 'o')
  .replaceAll('ş', 's')
  .replaceAll('ü', 'u');

// Öğrenci sınavlarının SALT GÖRÜNTÜLEME ekranı.
// Sınıf danışmanı yalnızca kendi sınıfını, rehberlik öğretmeni ve kurum
// yöneticisi tüm sınıfları görür. Düzenleme/silme kontrolü yoktur.
export default function TeacherStudentExams() {
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const [fullAccess, setFullAccess] = useState(false);
  const [homeroomClass, setHomeroomClass] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setAccessMessage('');

      const role = normalize(user?.role || '');
      let allowAll = role === 'admin' || role === 'administrative';
      let homeroom = '';

      if (!allowAll) {
        const staff = await fetchStaff('Teacher').catch(() => []);
        const me = (Array.isArray(staff) ? staff : []).find((item) =>
          normalize(item.username) === normalize(user?.username || '')
          || normalize(item.fullName) === normalize(user?.name || ''));
        if (normalize(me?.departmentOrBranch || '').includes('rehber')) {
          allowAll = true;
        }
        homeroom = String(me?.homeroomClass || '').trim();
        if (normalize(homeroom).includes('yok')) homeroom = '';
      }

      if (!allowAll && !homeroom) {
        setAccessMessage('Bu ekran sınıf danışmanları, rehberlik öğretmenleri ve kurum yöneticileri içindir. Sana atanmış bir danışman sınıfı bulunmuyor.');
        setRecords([]);
        return;
      }

      const results = await fetchExamResults(allowAll ? undefined : { className: homeroom });
      setFullAccess(allowAll);
      setHomeroomClass(homeroom);
      setRecords(Array.isArray(results) ? results : []);
      setSelectedClass(allowAll ? 'all' : homeroom);
    } catch (err) {
      setError(err.message || 'Sınav sonuçları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo(
    () => [...new Set(records.map((item) => item.className).filter(Boolean))].sort(),
    [records],
  );

  const visibleRecords = useMemo(() => records.filter((item) => {
    const matchesClass = selectedClass === 'all' || item.className === selectedClass;
    const matchesSearch = !search
      || normalize(item.studentName).includes(normalize(search))
      || normalize(item.examTitle).includes(normalize(search));
    return matchesClass && matchesSearch;
  }), [records, selectedClass, search]);

  const studentCount = useMemo(
    () => new Set(visibleRecords.map((item) => item.studentName)).size,
    [visibleRecords],
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Öğrenci sınavları yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="teacher-student-exams-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
            Öğrenci Sınavları
            <Badge className="border-0 bg-blue-500/15 font-bold text-blue-500 gap-1">
              <Eye className="h-3.5 w-3.5" /> Salt Görüntüleme
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            {fullAccess
              ? 'Tüm öğrencilerin sınav sonuçları — bu ekrandan değişiklik yapılamaz.'
              : `${homeroomClass} sınıfının sınav sonuçları — bu ekrandan değişiklik yapılamaz.`}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Yenile
        </Button>
      </div>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {accessMessage ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 max-w-md mx-auto text-sm text-muted-foreground">{accessMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-blue-500" />
                {studentCount} öğrenci • {visibleRecords.length} sonuç
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 w-56"
                    placeholder="Öğrenci veya sınav ara..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {fullAccess && (
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Sınıf" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Sınıflar</SelectItem>
                      {classes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleRecords.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Bu kapsamda kayıtlı sınav sonucu bulunmuyor.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Sınav</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Ders</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead className="text-right">Puan</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.map((item, index) => (
                    <TableRow key={`${item.studentName}-${item.examTitle}-${index}`}>
                      <TableCell className="font-medium">{item.studentName}</TableCell>
                      <TableCell>{item.className}</TableCell>
                      <TableCell>{item.examTitle}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.dateLabel}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{item.score}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.net}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
