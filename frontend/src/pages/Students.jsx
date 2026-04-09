import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  Mail,
  Phone,
  GraduationCap,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockStudents, mockClasses } from '../lib/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { SheetHeader, SheetTitle, SheetDescription } from '../components/ui/sheet';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function StudentDetailDrawer({ student }) {
  if (!student) return null;

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Öğrenci Detayı</SheetTitle>
        <SheetDescription>Öğrenci bilgileri ve istatistikleri</SheetDescription>
      </SheetHeader>

      {/* Profile Header */}
      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarImage src={student.avatar} alt={student.name} />
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {student.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{student.name}</h3>
          <p className="text-sm text-muted-foreground">{student.class} Sınıfı</p>
          <Badge className={student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
            {student.status === 'active' ? 'Aktif' : 'Pasif'}
          </Badge>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <h4 className="font-medium">İletişim Bilgileri</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{student.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{student.phone}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <h4 className="font-medium">İstatistikler</h4>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-brand-primary">{student.attendance}%</p>
              <p className="text-xs text-muted-foreground">Devam Oranı</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-brand-accent">{student.lastExamScore}</p>
              <p className="text-xs text-muted-foreground">Son Sınav</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Attendance Progress */}
      <div className="space-y-3">
        <h4 className="font-medium">Devam Durumu</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Katılım</span>
            <span>{student.attendance}%</span>
          </div>
          <Progress value={student.attendance} className="h-2" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button className="flex-1 bg-brand-primary hover:bg-brand-primary/90">
          <Edit className="h-4 w-4 mr-2" />
          Düzenle
        </Button>
        <Button variant="outline" className="flex-1">
          <Mail className="h-4 w-4 mr-2" />
          Mesaj Gönder
        </Button>
      </div>
    </div>
  );
}

function AddStudentDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Öğrenci Ekle</DialogTitle>
          <DialogDescription>Öğrenci bilgilerini girin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Ad</Label>
              <Input id="firstName" placeholder="Ad" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Soyad</Label>
              <Input id="lastName" placeholder="Soyad" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" placeholder="ornek@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" placeholder="0532 111 22 33" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class">Sınıf</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Sınıf seçin" />
              </SelectTrigger>
              <SelectContent>
                {mockClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Students() {
  const { openDrawer } = useApp();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    return mockStudents
      .filter((student) => {
        const matchesSearch = student.name.toLowerCase().includes(search.toLowerCase()) ||
          student.email.toLowerCase().includes(search.toLowerCase());
        const matchesClass = classFilter === 'all' || student.class === classFilter;
        const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
      })
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
  }, [search, classFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="students-page"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Öğrenciler</h1>
          <p className="text-muted-foreground mt-1">{mockStudents.length} kayıtlı öğrenci</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
          data-testid="add-student-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Öğrenci
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öğrenci ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Sınıf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {mockClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.name}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Öğrenci
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('attendance')}
                >
                  <div className="flex items-center gap-2">
                    Devam
                    <SortIcon field="attendance" />
                  </div>
                </TableHead>
                <TableHead>Son Sınav</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <motion.tr
                  key={student.id}
                  variants={itemVariants}
                  className="group cursor-pointer hover:bg-muted/50"
                  onClick={() => openDrawer(<StudentDetailDrawer student={student} />)}
                  data-testid={`student-row-${student.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={student.avatar} alt={student.name} />
                        <AvatarFallback className="bg-brand-primary text-white">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{student.class}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={student.attendance} className="w-16 h-2" />
                      <span className="text-sm">{student.attendance}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${student.lastExamScore >= 80 ? 'text-green-600' : student.lastExamScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {student.lastExamScore || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={student.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                      {student.status === 'active' ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" /> Görüntüle
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" /> Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
          
          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Öğrenci bulunamadı</h3>
              <p className="text-muted-foreground">Farklı filtreler deneyin veya yeni öğrenci ekleyin.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddStudentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
