import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, FileSpreadsheet, FileText, Calendar,
  Filter, CheckCircle, Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const exportHistory = [
  { id: 1, name: 'Ocak 2025 Tahsilat Raporu', type: 'excel', date: '2025-01-05', size: '245 KB', status: 'completed' },
  { id: 2, name: 'Öğrenci Cari Hesapları', type: 'excel', date: '2025-01-03', size: '1.2 MB', status: 'completed' },
  { id: 3, name: 'Geciken Ödemeler Listesi', type: 'pdf', date: '2025-01-02', size: '89 KB', status: 'completed' },
  { id: 4, name: 'Taksit Planları Özeti', type: 'excel', date: '2024-12-28', size: '456 KB', status: 'completed' },
];

export default function Export() {
  const { toast } = useToast();
  const [exportType, setExportType] = useState('excel');
  const [dateRange, setDateRange] = useState('this-month');
  const [selectedFields, setSelectedFields] = useState({
    studentInfo: true,
    payments: true,
    installments: true,
    discounts: true,
    summary: true,
  });

  const handleExport = () => {
    toast({
      title: 'Dışa aktarım başladı',
      description: 'Dosyanız hazırlandığında indirilecek.',
    });
  };

  const toggleField = (field) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="finance-export-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Dışa Aktar</h1>
        <p className="text-muted-foreground mt-1">Finansal verileri Excel/PDF olarak dışa aktarın</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Dışa Aktarım Ayarları
                </CardTitle>
                <CardDescription>Rapor içeriğini özelleştirin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Report Type */}
                <div className="space-y-3">
                  <Label>Rapor Türü</Label>
                  <Select defaultValue="general">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Genel Finansal Rapor</SelectItem>
                      <SelectItem value="collections">Tahsilat Raporu</SelectItem>
                      <SelectItem value="installments">Taksit Planları</SelectItem>
                      <SelectItem value="late-payments">Geciken Ödemeler</SelectItem>
                      <SelectItem value="student-accounts">Öğrenci Cari Hesapları</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-3">
                  <Label>Tarih Aralığı</Label>
                  <div className="flex gap-4">
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Bugün</SelectItem>
                        <SelectItem value="this-week">Bu Hafta</SelectItem>
                        <SelectItem value="this-month">Bu Ay</SelectItem>
                        <SelectItem value="last-month">Geçen Ay</SelectItem>
                        <SelectItem value="this-year">Bu Yıl</SelectItem>
                        <SelectItem value="custom">Özel Aralık</SelectItem>
                      </SelectContent>
                    </Select>
                    {dateRange === 'custom' && (
                      <>
                        <Input type="date" />
                        <Input type="date" />
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Fields Selection */}
                <div className="space-y-3">
                  <Label>Dahil Edilecek Alanlar</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="studentInfo" 
                        checked={selectedFields.studentInfo}
                        onCheckedChange={() => toggleField('studentInfo')}
                      />
                      <Label htmlFor="studentInfo" className="font-normal">Öğrenci Bilgileri</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="payments" 
                        checked={selectedFields.payments}
                        onCheckedChange={() => toggleField('payments')}
                      />
                      <Label htmlFor="payments" className="font-normal">Ödeme Geçmişi</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="installments" 
                        checked={selectedFields.installments}
                        onCheckedChange={() => toggleField('installments')}
                      />
                      <Label htmlFor="installments" className="font-normal">Taksit Detayları</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="discounts" 
                        checked={selectedFields.discounts}
                        onCheckedChange={() => toggleField('discounts')}
                      />
                      <Label htmlFor="discounts" className="font-normal">İndirim/Burs</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="summary" 
                        checked={selectedFields.summary}
                        onCheckedChange={() => toggleField('summary')}
                      />
                      <Label htmlFor="summary" className="font-normal">Özet İstatistikler</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Format Selection */}
                <div className="space-y-3">
                  <Label>Dosya Formatı</Label>
                  <div className="flex gap-4">
                    <Button
                      variant={exportType === 'excel' ? 'default' : 'outline'}
                      className={exportType === 'excel' ? 'bg-green-600 hover:bg-green-700' : ''}
                      onClick={() => setExportType('excel')}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel (.xlsx)
                    </Button>
                    <Button
                      variant={exportType === 'pdf' ? 'default' : 'outline'}
                      className={exportType === 'pdf' ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={() => setExportType('pdf')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>

                <Button 
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Dışa Aktar
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Export History */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Son Dışa Aktarımlar</CardTitle>
              <CardDescription>Önceki raporlarınız</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {exportHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    {item.type === 'excel' ? (
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    ) : (
                      <FileText className="h-8 w-8 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString('tr-TR')} • {item.size}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Export */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Hızlı Dışa Aktar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                Günlük Tahsilat Raporu
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                Geciken Ödemeler
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2 text-red-600" />
                Aylık Özet (PDF)
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
