import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Plus, Settings, Clock, Mail, MessageSquare, AlertTriangle,
  Edit, Trash2, Save,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { fetchOverdueRules, saveOverdueRules } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const defaultRules = [
  {
    id: 1,
    name: 'Ilk Hatirlatma',
    daysAfterDue: 3,
    channel: 'sms',
    template: 'Sayin {parentName}, {studentName} icin {amount} TL tutarinda odemeniz gecmistir. Lutfen en kisa surede odemenizi yapiniz.',
    enabled: true,
  },
  {
    id: 2,
    name: 'Ikinci Hatirlatma',
    daysAfterDue: 7,
    channel: 'email',
    template: 'Sayin {parentName}, {amount} TL tutarindaki odemeniz 7 gundur gecmis durumdadir.',
    enabled: true,
  },
  {
    id: 3,
    name: 'Son Uyari',
    daysAfterDue: 15,
    channel: 'both',
    template: 'Sayin {parentName}, {amount} TL tutarindaki odemeniz 15 gundur gecmistir. Acil odeme yapmaniz gerekmektedir.',
    enabled: false,
  },
];

export default function OverdueRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState({
    name: '',
    daysAfterDue: 3,
    channel: 'sms',
    template: '',
    enabled: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchOverdueRules();
        if (cancelled) return;
        setRules(Array.isArray(remote) && remote.length > 0 ? remote : defaultRules);
      } catch {
        if (!cancelled) setRules(defaultRules);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistRules = async (updated) => {
    setRules(updated);
    try {
      await saveOverdueRules(updated);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Kurallar kaydedilemedi.';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.template) {
      toast({ title: 'Ad ve sablon zorunludur.', variant: 'destructive' });
      return;
    }
    if (editingRule) {
      const updated = rules.map((r) => r.id === editingRule.id ? { ...r, ...form } : r);
      await persistRules(updated);
      toast({ title: 'Kural guncellendi.' });
    } else {
      const newRule = { ...form, id: Date.now() };
      await persistRules([...rules, newRule]);
      toast({ title: 'Yeni kural eklendi.' });
    }
    setOpen(false);
    setEditingRule(null);
    setForm({ name: '', daysAfterDue: 3, channel: 'sms', template: '', enabled: true });
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setForm({ name: rule.name, daysAfterDue: rule.daysAfterDue, channel: rule.channel, template: rule.template, enabled: rule.enabled });
    setOpen(true);
  };

  const handleDelete = async (id) => {
    await persistRules(rules.filter((r) => r.id !== id));
    toast({ title: 'Kural silindi.' });
  };

  const handleToggle = async (id) => {
    const updated = rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r);
    await persistRules(updated);
  };

  const channelLabel = (ch) => {
    if (ch === 'sms') return { label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> };
    if (ch === 'email') return { label: 'E-posta', icon: <Mail className="h-4 w-4" /> };
    return { label: 'SMS + E-posta', icon: <Bell className="h-4 w-4" /> };
  };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Gecikme Kurallari</h1>
            <p className="text-sm text-muted-foreground">Otomatik hatirlatma ve uyari kurallari</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingRule(null); setForm({ name: '', daysAfterDue: 3, channel: 'sms', template: '', enabled: true }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Yeni Kural</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Kurali Duzenle' : 'Yeni Kural Ekle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kural Adi *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ornegin: Ilk Hatirlatma" />
              </div>
              <div>
                <Label>Vade Sonrasi Gun</Label>
                <Input type="number" min={1} value={form.daysAfterDue} onChange={(e) => setForm((p) => ({ ...p, daysAfterDue: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Bildirim Kanali</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((p) => ({ ...p, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">E-posta</SelectItem>
                    <SelectItem value="both">SMS + E-posta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mesaj Sablonu *</Label>
                <Textarea
                  rows={3}
                  value={form.template}
                  onChange={(e) => setForm((p) => ({ ...p, template: e.target.value }))}
                  placeholder="Degiskenler: {parentName}, {studentName}, {amount}, {dueDate}"
                />
                <p className="text-xs text-muted-foreground mt-1">Kullanilabilir degiskenler: {'{parentName}'}, {'{studentName}'}, {'{amount}'}, {'{dueDate}'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))} />
                <Label>Kural Aktif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Iptal</Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" /> Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Settings className="h-12 w-12 mb-3 opacity-40" />
              <p>Henuz kural tanimlanmamis.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div className="space-y-3" variants={containerVariants}>
          {rules.sort((a, b) => a.daysAfterDue - b.daysAfterDue).map((rule) => {
            const ch = channelLabel(rule.channel);
            return (
              <motion.div key={rule.id} variants={itemVariants}>
                <Card className={`transition-opacity ${!rule.enabled ? 'opacity-50' : ''}`}>
                  <CardContent className="flex items-start gap-4 py-4">
                    <div className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Clock className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant="outline">{rule.daysAfterDue} gun sonra</Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {ch.icon} {ch.label}
                        </Badge>
                        {!rule.enabled && <Badge variant="destructive">Pasif</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{rule.template}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule.id)} />
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
