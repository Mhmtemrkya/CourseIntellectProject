import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, FileSpreadsheet, FileText,
  CheckCircle, Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';
import { downloadBlob } from '../../lib/financeDocuments';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export default function Export() {
  const { toast } = useToast();
  const [exportType, setExportType] = useState('excel');
  const [reportType, setReportType] = useState('general');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    invoices: true,
    collections: true,
    installments: true,
    approvals: true,
    summary: true,
  });
  const [history, setHistory] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAccountingDashboard();
      setDashboard(payload);
    } catch (err) {
      setError(err.message || 'Export verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const toggleField = (field) => {
    setSelectedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const exportRows = useMemo(() => {
    if (!dashboard) return [];
    const rows = [];

    if (selectedFields.summary) {
      rows.push(['Özet', 'Fatura Sayısı', dashboard.invoices.length]);
      rows.push(['Özet', 'Tahsilat Sayısı', dashboard.collections.length]);
      rows.push(['Özet', 'Taksit Sayısı', dashboard.installments.length]);
      rows.push(['Özet', 'Tahsilat Tutarı', dashboard.collections.reduce((sum, item) => sum + parseMoney(item.amount), 0)]);
    }
    if (selectedFields.invoices) {
      dashboard.invoices.forEach((item) => rows.push(['Fatura', item.id, item.title, item.category, item.amount, item.status]));
    }
    if (selectedFields.collections) {
      dashboard.collections.forEach((item) => rows.push(['Tahsilat', item.id, item.name, item.className, item.amount, item.method, item.time]));
    }
    if (selectedFields.installments) {
      dashboard.installments.forEach((item) => rows.push(['Taksit', item.id, item.student, item.amount, item.due, item.status]));
    }
    if (selectedFields.approvals) {
      dashboard.approvals.forEach((item) => rows.push(['Onay', item.id, item.title, item.category, item.status, item.reason]));
    }
    return rows;
  }, [dashboard, selectedFields]);

  const previewRows = useMemo(() => exportRows.slice(0, 12), [exportRows]);

  const previewText = useMemo(() => {
    if (exportType === 'excel') {
      return previewRows.map((row) => row.join(';')).join('\n');
    }
    return previewRows.map((row) => row.join(' | ')).join('\n');
  }, [exportType, previewRows]);

  const handleExport = () => {
    const fileName = `course-intellect-${reportType}-${new Date().toISOString().slice(0, 10)}`;
    if (exportType === 'excel') {
      const csv = exportRows.map((row) => row.join(';')).join('\n');
      downloadBlob(`${fileName}.csv`, csv, 'text/csv;charset=utf-8');
    } else {
      const text = exportRows.map((row) => row.join(' | ')).join('\n');
      downloadBlob(`${fileName}.txt`, text, 'text/plain;charset=utf-8');
    }

    setHistory((prev) => [{
      id: Date.now(),
      name: `${reportType} raporu`,
      type: exportType,
      date: new Date().toISOString(),
      size: `${Math.max(1, Math.round(exportRows.length / 2))} KB`,
      status: 'completed',
    }, ...prev].slice(0, 5));

    toast({
      title: 'Dışa aktarım tamamlandı',
      description: 'Dosya indirildi.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Export verileri yükleniyor...</p>
      </div>
    );
  }

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
        <p className="text-muted-foreground mt-1">Finansal verileri dosya olarak dışa aktarın</p>
      </div>

      {error ? <ErrorBanner title="Export verileri alınamadı" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="space-y-3">
                  <Label>Rapor Türü</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Genel Finansal Rapor</SelectItem>
                      <SelectItem value="collections">Tahsilat Raporu</SelectItem>
                      <SelectItem value="installments">Taksit Planları</SelectItem>
                      <SelectItem value="approvals">Onay Raporu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Dahil Edilecek Alanlar</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['invoices', 'Faturalar'],
                      ['collections', 'Tahsilatlar'],
                      ['installments', 'Taksitler'],
                      ['approvals', 'Onaylar'],
                      ['summary', 'Özet'],
                    ].map(([key, label]) => (
                      <div className="flex items-center gap-2" key={key}>
                        <Checkbox
                          id={key}
                          checked={selectedFields[key]}
                          onCheckedChange={() => toggleField(key)}
                        />
                        <Label htmlFor={key} className="font-normal">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Dosya Formatı</Label>
                  <div className="flex gap-4">
                    <Button
                      variant={exportType === 'excel' ? 'default' : 'outline'}
                      className={exportType === 'excel' ? 'bg-green-600 hover:bg-green-700' : ''}
                      onClick={() => setExportType('excel')}
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      variant={exportType === 'pdf' ? 'default' : 'outline'}
                      className={exportType === 'pdf' ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={() => setExportType('pdf')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Metin Raporu
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

          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <CardTitle>Önizleme</CardTitle>
                <CardDescription>İndirilecek dosyanın ilk satırları</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[340px] overflow-auto bg-slate-950 p-4 text-xs leading-6 text-emerald-100">
                  <pre className="whitespace-pre-wrap font-mono">{previewText || 'Henüz önizleme yok.'}</pre>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>Son Dışa Aktarımlar</CardTitle>
              <CardDescription>Bu oturumda oluşturulan dosyalar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {history.map((item) => (
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
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
