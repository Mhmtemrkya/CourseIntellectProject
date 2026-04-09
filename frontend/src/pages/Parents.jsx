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
  Users,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockParents, mockStudents } from '../lib/mockData';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
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

function ParentDetailDrawer({ parent }) {
  if (!parent) return null;
  
  const linkedStudents = mockStudents.filter(s => parent.students.includes(s.id));

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Veli Detayı</SheetTitle>
        <SheetDescription>Veli bilgileri ve bağlı öğrenciler</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-xl">
        <Avatar className="h-16 w-16">
          <AvatarImage src={parent.avatar} alt={parent.name} />
          <AvatarFallback className="bg-brand-primary text-white text-lg">
            {parent.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{parent.name}</h3>
          <p className="text-sm text-muted-foreground">{linkedStudents.length} öğrenci velisi</p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">İletişim Bilgileri</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{parent.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{parent.phone}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium">Bağlı Öğrenciler</h4>
        <div className="space-y-2">
          {linkedStudents.map((student) => (
            <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-8 w-8">
                <AvatarImage src={student.avatar} alt={student.name} />
                <AvatarFallback className="bg-brand-accent text-white text-xs">
                  {student.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{student.name}</p>
                <p className="text-xs text-muted-foreground">{student.class}</p>
              </div>
              <Badge variant="outline">{student.attendance}%</Badge>
            </div>
          ))}
        </div>
      </div>

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

function AddParentDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Veli Ekle</DialogTitle>
          <DialogDescription>Veli bilgilerini girin</DialogDescription>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button className="bg-brand-primary hover:bg-brand-primary/90">Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Parents() {
  const { openDrawer } = useApp();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredParents = useMemo(() => {
    return mockParents
      .filter((parent) => {
        const matchesSearch = parent.name.toLowerCase().includes(search.toLowerCase()) ||
          parent.email.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
  }, [search, sortField, sortDirection]);

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
      data-testid="parents-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Veliler</h1>
          <p className="text-muted-foreground mt-1">{mockParents.length} kayıtlı veli</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
          data-testid="add-parent-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Veli
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Veli ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-input"
            />
          </div>
        </CardContent>
      </Card>

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
                    Veli
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Bağlı Öğrenciler</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParents.map((parent) => {
                const linkedStudents = mockStudents.filter(s => parent.students.includes(s.id));
                return (
                  <motion.tr
                    key={parent.id}
                    variants={itemVariants}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(<ParentDetailDrawer parent={parent} />)}
                    data-testid={`parent-row-${parent.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={parent.avatar} alt={parent.name} />
                          <AvatarFallback className="bg-brand-primary text-white">
                            {parent.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{parent.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span>{parent.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{parent.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {linkedStudents.map((student) => (
                          <Badge key={student.id} variant="outline" className="text-xs">
                            {student.name}
                          </Badge>
                        ))}
                      </div>
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
                );
              })}
            </TableBody>
          </Table>
          
          {filteredParents.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Veli bulunamadı</h3>
              <p className="text-muted-foreground">Farklı arama yapın veya yeni veli ekleyin.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddParentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </motion.div>
  );
}
