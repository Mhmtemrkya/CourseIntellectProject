import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Percent, Gift, Users, Search, Plus, Edit, Trash2,
  Calendar, CheckCircle, AlertCircle, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockDiscounts = [
  { id: 1, name: 'Kardeş İndirimi', type: 'percentage', value: 10, students: 45, totalAmount: 54000, status: 'active' },
  { id: 2, name: 'Erken Kayıt', type: 'percentage', value: 15, students: 28, totalAmount: 50400, status: 'active' },
  { id: 3, name: 'Personel Çocuğu', type: 'percentage', value: 25, students: 12, totalAmount: 36000, status: 'active' },
  { id: 4, name: 'Kampanya 2024', type: 'fixed', value: 2000, students: 35, totalAmount: 70000, status: 'expired' },
];

const mockScholarships = [
  { id: 1, name: 'Akademik Başarı Bursu', type: 'full', coverage: 100, students: 8, criteria: 'Ort. 90+', status: 'active' },
  { id: 2, name: 'Yarı Burs', type: 'partial', coverage: 50, students: 22, criteria: 'Ort. 85+', status: 'active' },
  { id: 3, name: 'Spor Bursu', type: 'partial', coverage: 30, students: 15, criteria: 'İl Derecesi', status: 'active' },
  { id: 4, name: 'Sanat Bursu', type: 'partial', coverage: 25, students: 10, criteria: 'Yetenek', status: 'active' },
];

const mockStudentsWithDiscounts = [
  { id: 1, name: 'Ali Yılmaz', class: '10-A', discount: 'Kardeş İndirimi', discountAmount: 4800, scholarship: null },
  { id: 2, name: 'Zeynep Kaya', class: '10-A', discount: null, scholarship: 'Akademik Başarı Bursu', scholarshipCoverage: 100 },
  { id: 3, name: 'Can Arslan', class: '11-A', discount: 'Erken Kayıt', discountAmount: 7200, scholarship: 'Yarı Burs' },
  { id: 4, name: 'Elif Şahin', class: '11-B', discount: 'Personel Çocuğu', discountAmount: 12000, scholarship: null },
];

export default function DiscountsScholarships() {
  const [activeTab, setActiveTab] = useState('discounts');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const stats = {
    totalDiscounts: mockDiscounts.filter(d => d.status === 'active').length,
    totalScholarships: mockScholarships.filter(s => s.status === 'active').length,
    studentsWithDiscount: mockDiscounts.reduce((a, d) => a + d.students, 0),
    totalDiscountAmount: mockDiscounts.reduce((a, d) => a + d.totalAmount, 0),
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="finance-discounts-page"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">İndirim & Burs</h1>
          <p className="text-muted-foreground mt-1">İndirim ve burs yönetimi</p>
        </div>
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Tanım
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-primary/10">
                <Percent className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDiscounts}</p>
                <p className="text-sm text-muted-foreground">Aktif İndirim</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-brand-accent/10">
                <Gift className="h-6 w-6 text-brand-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalScholarships}</p>
                <p className="text-sm text-muted-foreground">Aktif Burs</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.studentsWithDiscount}</p>
                <p className="text-sm text-muted-foreground">Yararlanan Öğrenci</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₺{(stats.totalDiscountAmount / 1000).toFixed(0)}K</p>
                <p className="text-sm text-muted-foreground">Toplam İndirim</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="discounts" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="discounts">
            <Percent className="h-4 w-4 mr-2" /> İndirimler
          </TabsTrigger>
          <TabsTrigger value="scholarships">
            <Gift className="h-4 w-4 mr-2" /> Burslar
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="h-4 w-4 mr-2" /> Öğrenci Listesi
          </TabsTrigger>
        </TabsList>

        {/* Discounts Tab */}
        <TabsContent value="discounts" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İndirim Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Değer</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Toplam</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDiscounts.map((discount) => (
                    <TableRow key={discount.id}>
                      <TableCell className="font-medium">{discount.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {discount.type === 'percentage' ? 'Yüzde' : 'Sabit'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {discount.type === 'percentage' ? `%${discount.value}` : `₺${discount.value}`}
                      </TableCell>
                      <TableCell>{discount.students}</TableCell>
                      <TableCell>₺{discount.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={discount.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {discount.status === 'active' ? 'Aktif' : 'Süresi Doldu'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scholarships Tab */}
        <TabsContent value="scholarships" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Burs Adı</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Karşılama</TableHead>
                    <TableHead>Kriter</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockScholarships.map((scholarship) => (
                    <TableRow key={scholarship.id}>
                      <TableCell className="font-medium">{scholarship.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {scholarship.type === 'full' ? 'Tam Burs' : 'Kısmi Burs'}
                        </Badge>
                      </TableCell>
                      <TableCell>%{scholarship.coverage}</TableCell>
                      <TableCell>{scholarship.criteria}</TableCell>
                      <TableCell>{scholarship.students}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit className="h-4 w-4 mr-2" /> Düzenle</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Öğrenci ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>İndirim</TableHead>
                    <TableHead>İndirim Tutarı</TableHead>
                    <TableHead>Burs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockStudentsWithDiscounts.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.class}</TableCell>
                      <TableCell>
                        {student.discount ? (
                          <Badge variant="outline">{student.discount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.discountAmount ? (
                          <span className="text-green-600">₺{student.discountAmount.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.scholarship ? (
                          <Badge className="bg-brand-accent/10 text-brand-accent">{student.scholarship}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni İndirim/Burs Tanımla</DialogTitle>
            <DialogDescription>İndirim veya burs türü oluşturun</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tür</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">İndirim</SelectItem>
                  <SelectItem value="scholarship">Burs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ad</Label>
              <Input placeholder="İndirim/Burs adı" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Değer Türü</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Yüzde (%)</SelectItem>
                    <SelectItem value="fixed">Sabit Tutar (₺)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Değer</Label>
                <Input type="number" placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90">Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
