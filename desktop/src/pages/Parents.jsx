import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Mail,
  Phone,
  Users,
  CalendarDays,
  MessageSquare,
  Info,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { fetchMeetingRequests, fetchStudents } from '../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function groupParents(students, meetings) {
  const map = new Map();

  students.forEach((student) => {
    const key = `${normalizeText(student.parentName)}|${normalizeText(student.parentEmail)}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: student.parentName,
        email: student.parentEmail,
        phone: student.parentPhone,
        children: [],
        classNames: new Set(),
        meetings: 0,
      });
    }

    const item = map.get(key);
    item.children.push(student);
    if (student.className) item.classNames.add(student.className);
  });

  meetings.forEach((meeting) => {
    const match = Array.from(map.values()).find((parent) => normalizeText(parent.name) === normalizeText(meeting.parentName));
    if (match) {
      match.meetings += 1;
    }
  });

  return Array.from(map.values()).map((parent) => ({
    ...parent,
    classNames: Array.from(parent.classNames),
  }));
}

function ParentDetailDrawer({ parent }) {
  if (!parent) return null;

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Veli Detayı</SheetTitle>
        <SheetDescription>Bağlı öğrenciler ve görüşme özeti</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {parent.name.split(' ').map((part) => part[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{parent.name}</h3>
          <p className="text-sm text-muted-foreground">{parent.children.length} öğrenci velisi</p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">İletişim</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{parent.email || 'E-posta yok'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{parent.phone || 'Telefon yok'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Bağlı Öğrenciler</h4>
        <div className="space-y-2">
          {parent.children.map((student) => (
            <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">{student.fullName}</p>
                <p className="text-sm text-muted-foreground">{student.className} • {student.programType}</p>
              </div>
              <Badge variant="outline">{student.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sınıflar</p>
            <p className="text-xl font-semibold">{parent.classNames.join(', ') || 'Yok'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Görüşme Talebi</p>
            <p className="text-xl font-semibold">{parent.meetings}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Parents() {
  const navigate = useNavigate();
  const { openDrawer } = useApp();
  const { toast } = useToast();
  const [parents, setParents] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadParents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, meetings] = await Promise.all([
        fetchStudents(),
        fetchMeetingRequests().catch(() => []),
      ]);
      setParents(groupParents(students, meetings));
    } catch (err) {
      setError(err.message || 'Veli listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  const filteredParents = useMemo(() => {
    return parents
      .filter((parent) => {
        const target = `${parent.name} ${parent.email} ${parent.phone}`.toLowerCase();
        return target.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const left = a[sortField];
        const right = b[sortField];
        if (sortDirection === 'asc') return left > right ? 1 : -1;
        return left < right ? 1 : -1;
      });
  }, [parents, search, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="parents-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Veliler</h1>
          <p className="text-muted-foreground mt-1">{parents.length} kayıtlı veli</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/parent-registration')}
        >
          <Info className="h-4 w-4 mr-2" />
          Yeni Veli Bilgisi
        </Button>
      </div>

      {error ? <ErrorBanner title="Veli listesi alınamadı" message={error} onRetry={loadParents} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Toplam Veli</p>
                <p className="text-2xl font-bold">{parents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Toplam Görüşme</p>
                <p className="text-2xl font-bold">{parents.reduce((sum, item) => sum + item.meetings, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Bağlı Öğrenci</p>
                <p className="text-2xl font-bold">{parents.reduce((sum, item) => sum + item.children.length, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Veli ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Veli <SortIcon field="name" /></div>
                </TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Öğrenciler</TableHead>
                <TableHead>Görüşmeler</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParents.map((parent) => (
                <TableRow
                  key={parent.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDrawer(<ParentDetailDrawer parent={parent} />)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-brand-primary text-white">
                          {parent.name.split(' ').map((part) => part[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{parent.name}</p>
                        <p className="text-xs text-muted-foreground">{parent.classNames.join(', ') || 'Sınıf yok'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p>{parent.email || 'E-posta yok'}</p>
                      <p className="text-muted-foreground">{parent.phone || 'Telefon yok'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {parent.children.map((child) => (
                        <Badge key={child.id} variant="outline">{child.fullName}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{parent.meetings}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(event) => {
                      event.stopPropagation();
                      openDrawer(<ParentDetailDrawer parent={parent} />);
                    }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
