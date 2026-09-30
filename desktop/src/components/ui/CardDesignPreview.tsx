import { useEffect, useState } from 'react';
import { Banknote, CalendarDays, CreditCard, Users, Wallet, TrendingUp, Target, AlertCircle, Receipt, BookOpen, GraduationCap, Bell, ClipboardCheck, Utensils, Building2 } from 'lucide-react';
import { KpiCard } from './kpi-card';
import { Card, CardHeader, CardTitle, CardContent } from './card';
import type { IconComponent } from '@/types/ui';
import type { CardTone } from './card-palette';

type Metric = { label: string; value: string | number; caption: string; icon: IconComponent; tone?: CardTone };
const finance: Metric[] = [
  { label: 'Tahsilat', value: '0 TL', caption: '0 işlem', icon: CreditCard, tone: 'emerald' },
  { label: 'Geciken Tutar', value: '14.750 TL', caption: '2 kayıt · Takip gerekli', icon: AlertCircle, tone: 'rose' },
  { label: 'Gider', value: '0 TL', caption: 'Gider · maaş · fatura', icon: Wallet, tone: 'blue' },
  { label: 'Net Akış', value: '+0 TL', caption: 'Dönem pozitif', icon: TrendingUp, tone: 'brand' },
  { label: 'Tahsilat Oranı', value: '%0', caption: 'Hedef 14.750 TL', icon: Target, tone: 'violet' },
  { label: 'İade', value: '0 TL', caption: 'Dönem içindeki iadeler', icon: Receipt, tone: 'amber' },
  { label: 'Geciken Kayıt', value: 2, caption: 'Vadesi geçmiş ödeme', icon: CalendarDays, tone: 'cyan' },
  { label: 'Bekleyen Peşinat', value: 0, caption: 'Toplam 0 TL', icon: Banknote, tone: 'violet' },
];
const examples: Record<string, Metric[]> = {
  Muhasebe: finance,
  'Kurum Yöneticisi': [
    { label: 'Öğrenciler', value: 428, caption: 'Kurum genelinde', icon: Users },
    { label: 'Şubeler', value: 3, caption: 'Aktif şube', icon: Building2 },
    { label: 'Devam Oranı', value: '%96', caption: 'Bugünkü yoklama', icon: ClipboardCheck },
    { label: 'Tahsilat', value: '48.200 TL', caption: 'Seçili dönemde', icon: CreditCard },
  ],
  'Şube Müdürü': [
    { label: 'Öğrenciler', value: 142, caption: 'Atanmış şube', icon: Users },
    { label: 'Bugünkü Dersler', value: 24, caption: 'Şube programı', icon: BookOpen },
    { label: 'Devamsızlık', value: 2, caption: 'Takip edilecek kayıt', icon: AlertCircle },
  ],
  Öğretmen: [
    { label: 'Bugünkü Dersler', value: 6, caption: 'Atanmış sınıflar', icon: BookOpen },
    { label: 'Bekleyen Ödevler', value: 12, caption: 'Değerlendirme bekliyor', icon: ClipboardCheck, tone: 'violet' },
    { label: 'Yaklaşan Sınavlar', value: 2, caption: 'Bu hafta', icon: GraduationCap },
  ],
  Öğrenci: [
    { label: 'Derslerim', value: 6, caption: 'Bugünkü program', icon: BookOpen },
    { label: 'Ödevlerim', value: 3, caption: 'Teslim bekliyor', icon: ClipboardCheck },
    { label: 'Başarı', value: '%78', caption: 'Kayıtlı sonuçlar', icon: TrendingUp },
  ],
  Veli: [
    { label: 'Devam Oranı', value: '%96', caption: 'Bağlı öğrenci', icon: ClipboardCheck },
    { label: 'Sınav Sonuçları', value: 8, caption: 'Yayınlanan sonuç', icon: GraduationCap },
    { label: 'Bildirimler', value: 3, caption: 'Okunmamış bildirim', icon: Bell },
  ],
  Rehberlik: [
    { label: 'Görüşmeler', value: 6, caption: 'Seçili dönemde', icon: Users },
    { label: 'Randevular', value: 3, caption: 'Bugünkü plan', icon: CalendarDays },
    { label: 'Takip Gereken', value: 2, caption: 'Atanmış öğrenciler', icon: AlertCircle, tone: 'rose' },
  ],
  'İdari Personel': [
    { label: 'Kayıt İşlemleri', value: 12, caption: 'Seçili dönem', icon: Users },
    { label: 'Bekleyen Belgeler', value: 4, caption: 'İşlem bekliyor', icon: ClipboardCheck },
    { label: 'Duyurular', value: 3, caption: 'Yayınlanan duyuru', icon: Bell, tone: 'violet' },
  ],
  Yemekhane: [
    { label: 'Haftalık Menü', value: 5, caption: 'Planlanan gün', icon: Utensils },
    { label: 'Yayınlanan Menü', value: 4, caption: 'Öğrenci ve veliye açık', icon: ClipboardCheck, tone: 'emerald' },
  ],
};

/** Local, development-only review of production card components with demo data. */
export function CardDesignPreview() {
  useEffect(() => { document.getElementById('sa-boot')?.remove(); }, []);
  const [role, setRole] = useState('Muhasebe');
  const [dark, setDark] = useState(true);
  return <div className={dark ? 'dark' : 'light'}>
    <main className="ci-page min-h-screen bg-background p-5 text-foreground sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold tracking-widest text-muted-foreground">SCHOOLASIST · TASARIM ÖNİZLEMESİ</p><h1 className="mt-2 text-2xl font-bold">{role === 'Muhasebe' ? 'Finansal Genel Bakış' : role}</h1></div>
          <div className="flex gap-3"><select aria-label="Rol" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border bg-background px-3 py-2">{Object.keys(examples).map((item) => <option key={item}>{item}</option>)}</select><button className="rounded-xl border px-3 py-2" onClick={() => setDark(!dark)}>{dark ? 'Açık tema' : 'Koyu tema'}</button></div>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {examples[role]?.map((metric, index) => <KpiCard key={`${role}-${metric.label}`} {...metric} containerClassName={index < 2 ? 'lg:col-span-3 min-w-0' : 'lg:col-span-2 min-w-0'} className={index < 2 ? 'min-h-[210px] justify-between' : 'min-h-[174px] justify-between'} />)}
        </div>
        <Card><CardHeader><CardTitle>{role === 'Muhasebe' ? 'Tahsilat Kayıtları' : 'Günlük İşlemler'}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Bu ekran temsili verilerle ortak bileşenleri gösterir. Liste ve form alanları daha sakin renk vurguları kullanır.</p></CardContent></Card>
      </div>
    </main>
  </div>;
}
