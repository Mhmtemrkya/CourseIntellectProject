"use client"

import { useId } from "react"
import type { ShowcaseAsset } from "@/lib/showcase-assets"
import { roles, type RoleId } from "@/lib/site-experience-data"
import { highlightTopic } from "@/lib/product-highlights"

// Product previews are vectors, not enlarged crops of a page mockup. Text and
// device edges stay sharp at any viewport size or display pixel density.
const orange = "#ff7900"
const ink = "#172033"
const muted = "#798396"
type Preview = "guidance" | "meals" | "route" | "platform" | "lessons" | "messages" | "finance" | "students" | "tasks" | "materials" | "homework" | "branches" | "reports"
const menuByRole: Record<RoleId, string[]> = {
  rehberlik: ["Vaka merkezi", "Görüşmeler", "Çalışma planı", "Randevular", "Envanterler", "Raporlar", "Kütüphane"],
  "sube-muduru": ["Şube özeti", "Öğrenciler", "Ekibim", "Program", "Görevler", "Finans", "Raporlar"],
  yemekhane: ["Yemek programı", "Hafta seçimi", "Kahvaltı", "Öğle yemeği", "Besin değerleri", "Alerjenler", "Özet"],
  "servis-soforu": ["Bugünkü rota", "Öğrenci listesi", "Sefer", "Öğrenci durumu", "Konum", "Bildirimler", "Özet"],
  yonetici: ["Ana sayfa", "Şubeler", "Öğrenciler", "Ekibim", "İletişim", "Finans", "Ayarlar"],
  ogretmen: ["Ana sayfa", "Dersler", "Öğrenciler", "Yoklama", "Ödevler", "Raporlar", "Materyaller"],
  veli: ["Genel bakış", "Öğrencilerim", "Dersler", "Devam", "Duyurular", "Mesajlar", "Ödemeler"],
  ogrenci: ["Ana sayfa", "Derslerim", "Ödevlerim", "Programım", "Duyurular", "Sonuçlar", "Profilim"],
  muhasebe: ["Finansal özet", "Tahsilatlar", "Taksitler", "Giderler", "Raporlar", "Öğrenciler", "Ayarlar"],
  personel: ["Günlük akış", "Görevlerim", "Duyurular", "Takvim", "İletişim", "Belgeler", "Profilim"],
}

/** Larger editorial compositions for the discovery cards. Their backgrounds
 * belong to the card so there is no baked-in rectangular image edge. */
export function HighlightArtwork({ asset }: { asset: ShowcaseAsset }) {
  const id = `highlight-${useId().replace(/:/g, "")}`
  const topic = highlightTopic(asset)
  const kind = previewByAsset[asset] || "lessons"
  return <svg className="sa-highlight-art" viewBox="0 0 1000 600" width={1000} height={600} aria-hidden="true" fontFamily="Inter Variable, Arial, sans-serif">
    <defs>
      <linearGradient id={`${id}-edge`}><stop stopColor="#dce0e7" /><stop offset=".12" stopColor="#666c76" /><stop offset=".5" stopColor="#101217" /><stop offset="1" stopColor="#9198a5" /></linearGradient>
      <linearGradient id={`${id}-metal`} x2="0" y2="1"><stop stopColor="#dce0e7" /><stop offset=".5" stopColor="#7b8493" /><stop offset="1" stopColor="#303742" /></linearGradient>
      <linearGradient id={`${id}-area`} x2="0" y2="1"><stop stopColor="#ff881e" stopOpacity={.55} /><stop offset="1" stopColor="#ff881e" stopOpacity={0} /></linearGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#000" floodOpacity={.18} /></filter>
    </defs>
    {topic === "communication" ? <>
      <g className="sa-art-primary" transform="translate(540 22) rotate(9 130 260)" filter={`url(#${id}-shadow)`}><Phone id={id} scale={1.26} role="veli" /></g>
      <g className="sa-art-secondary" transform="translate(114 202) rotate(-5 230 80)" filter={`url(#${id}-shadow)`}><rect width={456} height={158} rx={26} fill="#fff" /><Logo x={28} y={26} size={40} /><Text x={84} y={48} size={18} weight={750}>SchoolAsist</Text><Text x={361} y={47} size={13} fill={muted}>şimdi</Text><Text x={28} y={96} size={25} weight={750}>Demo 1 derse katıldı.</Text><Text x={28} y={127} size={16} fill={muted}>Matematik · Bugün, 09:00</Text></g>
      <g className="sa-art-tertiary" transform="translate(195 404)"><rect width={329} height={64} rx={32} fill="#d1eaff" stroke="#fff" strokeOpacity={.6} /><circle cx={34} cy={32} r={16} fill="#2085c8" /><Glyph x={26} y={24} kind="check" color="#fff" /><Text x={62} y={39} size={18} fill="#224c70" weight={650}>Bilgi, her zaman yanında.</Text></g>
    </> : topic === "finance" ? <>
      <g className="sa-art-primary" transform="translate(90 84)"><Text x={0} y={0} size={18} fill="#856951">DEMO · FİNANSAL ÖZET</Text><Text x={-5} y={99} size={92} weight={750} fill="#382c25">₺35.600</Text><Text x={0} y={137} size={21} fill="#856951">Dönem bakiyesi</Text>
        {[0,1,2,3].map(i=><path key={i} d={`M0 ${188 + i * 60}H815`} stroke="#a48c75" strokeOpacity={.14} />)}
        <path d="M0 344C130 347 146 240 277 270S437 354 526 229 675 263 815 168V404H0Z" fill={`url(#${id}-area)`} /><path className="scene-chart" d="M0 344C130 347 146 240 277 270S437 354 526 229 675 263 815 168" fill="none" stroke="#ee781e" strokeWidth={5} strokeLinecap="round" /><circle cx={815} cy={168} r={9} fill="#fff" stroke="#ee781e" strokeWidth={4} />
      </g>
      <g className="sa-art-secondary" transform="translate(495 88) rotate(5 185 55)" filter={`url(#${id}-shadow)`}><rect width={355} height={117} rx={22} fill="#fff" /><circle cx={42} cy={45} r={21} fill="#e2f5ec" /><Glyph x={34} y={37} kind="check" color="#188662" /><Text x={78} y={41} size={17} weight={650}>Tahsilat kaydedildi</Text><Text x={78} y={71} size={28} weight={750}>₺10.400</Text><Text x={78} y={97} size={14} fill={muted}>Demo 1 · Taksit ödemesi</Text></g>
    </> : topic === "progress" ? <>
      <g className="sa-art-primary" transform="translate(114 70)"><circle cx={160} cy={182} r={137} fill="none" stroke="#d6e3dc" strokeWidth={22} /><circle className="scene-ring" cx={160} cy={182} r={137} fill="none" stroke="#219d78" strokeWidth={22} strokeDasharray="671 861" strokeLinecap="round" transform="rotate(-90 160 182)" /><Text x={73} y={200} size={78} weight={750} fill="#18392e">%78</Text><Text x={88} y={237} size={20} fill="#5f7d70">Demo 1 · Gelişim</Text></g>
      <g className="sa-art-secondary" transform="translate(493 63) rotate(5 230 180)" filter={`url(#${id}-shadow)`}><ContentPanel kind="students" width={430} /></g>
      <g className="sa-art-tertiary" transform="translate(413 370) rotate(-5 200 55)" filter={`url(#${id}-shadow)`}><rect width={401} height={96} rx={20} fill="#fff" /><Glyph x={27} y={37} kind="book" color="#1e946e" /><Text x={62} y={40} size={20} weight={700}>Bir sonraki adım</Text><Text x={62} y={69} size={16} fill={muted}>Denklemler · Çalışma planı</Text></g>
    </> : topic === "operations" ? <>
      <g className="sa-art-primary" transform="translate(142 84) rotate(-4 350 140)" filter={`url(#${id}-shadow)`}><ContentPanel kind={kind} width={710} /></g>
      <g className="sa-art-secondary" transform="translate(535 372) rotate(4 160 40)" filter={`url(#${id}-shadow)`}><rect width={328} height={82} rx={22} fill="#fff" /><circle cx={42} cy={41} r={22} fill="#e9e5f8" /><Glyph x={34} y={33} kind="check" color="#7564a7" /><Text x={78} y={36} size={18} weight={700}>Günlük akış düzenli.</Text><Text x={78} y={60} size={14} fill={muted}>Demo 1 · Kurum çalışma alanı</Text></g>
    </> : <>
      <g className="sa-art-primary" transform="translate(105 45) rotate(-5 390 220)" filter={`url(#${id}-shadow)`}><rect width={790} height={433} rx={25} fill={`url(#${id}-edge)`} /><rect x={6} y={6} width={778} height={421} rx={21} fill="#171a21" /><svg x={20} y={20} width={750} height={393} viewBox="0 0 750 393"><rect width={750} height={393} rx={14} fill="#f6f8fb" /><Logo x={26} y={24} size={31} /><Text x={71} y={47} size={21} weight={750}>SchoolAsist</Text><Text x={26} y={100} size={33} weight={750}>{kind === "homework" ? "Çalışmaların bir arada." : kind === "materials" ? "Dersin devamı burada." : "Bugünün ders akışı."}</Text><Text x={26} y={128} size={16} fill={muted}>Demo 1 · Eğitim çalışma alanı</Text><g transform="translate(27 154) scale(1.05 .84)"><ContentPanel kind={kind} width={665} /></g></svg></g>
      <g className="sa-art-secondary" transform="translate(574 351) rotate(5 175 50)" filter={`url(#${id}-shadow)`}><rect width={338} height={104} rx={22} fill="#fff" /><circle cx={45} cy={50} r={25} fill="#e2f5ec" /><Glyph x={37} y={42} kind="check" color="#17996e" /><Text x={86} y={44} size={20} weight={750}>24 / 28 öğrenci</Text><Text x={86} y={74} size={16} fill={muted}>Yoklama · Demo sınıf</Text></g>
    </>}
  </svg>
}
const previewByAsset: Partial<Record<ShowcaseAsset, Preview>> = {
  "home-lessons": "lessons", "home-messages": "messages", "platform-lessons": "lessons", "platform-student": "students", "platform-finance": "finance",
  "yonetici-branches": "branches", "yonetici-reports": "reports", "ogretmen-materials": "materials", "ogretmen-homework": "homework",
  "veli-lessons": "lessons", "veli-messages": "messages", "ogrenci-homework": "homework", "ogrenci-schedule": "lessons",
  "muhasebe-payment": "finance", "muhasebe-plan": "finance", "personel-tasks": "tasks", "personel-announcements": "messages",
  "roles-teacher": "lessons", "roles-parent": "messages", "roles-admin": "reports",
}

function Text({ x, y, children, size = 12, fill = ink, weight = 500 }: { x: number; y: number; children: React.ReactNode; size?: number; fill?: string; weight?: number }) {
  return <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight}>{children}</text>
}
function Panel({ x, y, w, h, fill = "#fff", radius = 12 }: { x: number; y: number; w: number; h: number; fill?: string; radius?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={radius} fill={fill} stroke="#e6eaf0" />
}
function Logo({ x, y, size = 24 }: { x: number; y: number; size?: number }) {
  return <image href="/images/logo.png" x={x} y={y} width={size} height={size} />
}
function Glyph({ x, y, kind = "grid", color = muted }: { x: number; y: number; kind?: string; color?: string }) {
  const paths: Record<string, string> = {
    grid: "M1 1h5v5H1z M10 1h5v5h-5z M1 10h5v5H1z M10 10h5v5h-5z",
    book: "M8 3C5 0 1 1 1 1v12s4-1 7 2c3-3 7-2 7-2V1s-4-1-7 2v12",
    message: "M2 2h12v9H7l-5 4V2z",
    check: "M3 8l4 4 7-9",
    user: "M11 4a3 3 0 1 1-6 0a3 3 0 1 1 6 0 M1 15v-2c0-5 14-5 14 0v2",
    calendar: "M1 4h14v11H1z M4 1v5 M12 1v5 M1 8h14",
  }
  return <path d={paths[kind] || paths.grid} transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
}

function LessonRows({ x = 0, y = 0, width = 280, compact = false }: { x?: number; y?: number; width?: number; compact?: boolean }) {
  const height = compact ? 44 : 58
  return <g transform={`translate(${x} ${y})`}>{[["09:00", "Matematik", "Denklemler ve eşitsizlikler"], ["10:00", "Türkçe", "Paragrafta anlam"], ["11:00", "Fen Bilimleri", "Canlılar ve yaşam"]].map(([time, name, topic], i) => <g key={name} transform={`translate(0 ${i * (height + 8)})`}>
    <rect width={width} height={height} rx={9} fill={i === 0 ? "#fff0e2" : "#f7f8fb"} />
    <rect width={3} height={height - 16} x={0} y={8} rx={2} fill={i === 0 ? orange : "#dfe4eb"} />
    <Text x={13} y={23} size={12} fill={i === 0 ? "#b85a00" : muted}>{time}</Text><Text x={66} y={23} size={13} weight={700}>{name}</Text>
    {!compact && <Text x={66} y={42} size={10} fill={muted}>{topic}</Text>}
    {i === 0 && width > 310 && <><rect x={width - 99} y={18} width={84} height={23} rx={11} fill={orange} /><Text x={width - 89} y={34} size={10} fill="#fff">Devam ediyor</Text></>}
  </g>)}</g>
}

function ContentPanel({ kind, width = 480 }: { kind: Preview; width?: number }) {
  const titles: Record<Preview, string> = { guidance: "Görüşme ve öğrenci takibi", meals: "Haftalık yemek programı", route: "Öğrenci alım listesi", platform: "Kurum başvuruları", lessons: "Bugünün dersleri", messages: "İletişim akışı", finance: "Finansal görünüm", students: "Öğrenci gelişimi", tasks: "Günlük görevler", materials: "Ders materyalleri", homework: "Ödev takibi", branches: "Şube ve ekip yönetimi", reports: "Kurum raporları" }
  return <g><Panel x={0} y={0} w={width} h={270} radius={16} /><Text x={24} y={36} size={19} weight={750}>{titles[kind]}</Text><Text x={24} y={57} size={11} fill={muted}>SchoolAsist · Temsili demo verileri</Text>
    {["guidance", "meals", "route", "platform"].includes(kind) ? <>{(kind === "guidance" ? [["Demo 1 · Görüşme", "09:00 · Takip planlandı"], ["Demo 2 · Çalışma planı", "11:00 · Haftalık program"], ["Demo 3 · Envanter", "14:00 · Yanıtlar hazır"]] : kind === "meals" ? [["Pazartesi · Kahvaltı", "Yumurta, peynir, ekmek · 420 kcal"], ["Pazartesi · Öğle yemeği", "Çorba, ana yemek, salata · 680 kcal"], ["Alerjen bilgisi", "Süt ürünleri, gluten"]] : kind === "route" ? [["Demo 1 · Durak 1", "08:10 · Servise bindi"], ["Demo 2 · Durak 2", "08:20 · Alım bekleniyor"], ["Demo 3 · Durak 3", "08:30 · Alım bekleniyor"]] : [["Demo 1 · Kurum başvurusu", "E-posta doğrulandı · İnceleme bekliyor"], ["Demo 2 · Kurum", "Aktif · Erişim açık"], ["Demo 3 · Destek", "Yeni talep · İnceleme bekliyor"]]).map(([name, detail], i) => <g key={name} transform={`translate(22 ${77 + i * 60})`}><rect width={width - 44} height={52} rx={9} fill={i === 0 ? "#fff4e9" : "#f7f8fb"} /><Glyph x={12} y={17} kind="calendar" color={orange} /><Text x={40} y={22} size={12} weight={700}>{name}</Text><Text x={40} y={40} size={10} fill={muted}>{detail}</Text></g>)}</> : kind === "lessons" ? <LessonRows x={22} y={76} width={width - 44} /> : kind === "finance" || kind === "reports" ? <>
      {[['Tahsilat', '₺48.200', '#139b6b'], ['Gider', '₺12.600', '#e56759'], ['Bakiye', '₺35.600', '#287ceb']].map(([label, value, color], i) => <g key={label} transform={`translate(${24 + i * (width - 48) / 3} 78)`}><Text x={0} y={0} size={11} fill={muted}>{label}</Text><Text x={0} y={27} size={20} fill={color} weight={750}>{value}</Text></g>)}
      <path d={`M24 225C${width * .18} 233 ${width * .24} 175 ${width * .38} 191S${width * .64} 223 ${width * .74} 161S${width * .86} 157 ${width - 24} 139L${width - 24} 244H24Z`} fill="#fff0e2" />
      <path className="scene-chart" d={`M24 225C${width * .18} 233 ${width * .24} 175 ${width * .38} 191S${width * .64} 223 ${width * .74} 161S${width * .86} 157 ${width - 24} 139`} fill="none" stroke={orange} strokeWidth={3} strokeLinecap="round" />
      {[1,2,3,4,5,6].map(i => <Text key={i} x={24 + (i - 1) * (width - 70) / 5} y={260} size={10} fill={muted}>{i}. hafta</Text>)}
    </> : kind === "messages" ? <>{["Yeni ders bildirimi", "Ödev değerlendirmesi", "Kurum duyurusu"].map((name, i) => <g key={name} transform={`translate(22 ${77 + i * 60})`}><rect width={width - 44} height={52} rx={9} fill={i === 0 ? "#fff4e9" : "#f7f8fb"} /><Logo x={12} y={12} size={28} /><Text x={52} y={22} size={12} weight={700}>{name}</Text><Text x={52} y={40} size={10} fill={muted}>Demo {i + 1} · Bilgilendirme size ulaştı.</Text><circle cx={width - 65} cy={24} r={3} fill={orange} /></g>)}</> : kind === "students" ? <>{["Demo 1", "Demo 2", "Demo 3"].map((name, i) => <g key={name} transform={`translate(24 ${79 + i * 60})`}><circle cx={20} cy={22} r={20} fill={["#e2edff", "#ffeede", "#e3f7ef"][i]} /><Text x={9} y={27} fill={["#3c71c1", "#bf6412", "#199c70"][i]} weight={700}>D{i + 1}</Text><Text x={54} y={18} size={13} weight={700}>{name}</Text><Text x={54} y={36} size={10} fill={muted}>Ders katılımı ve gelişim</Text><rect x={width - 162} y={13} width={90} height={7} rx={4} fill="#edf0f4" /><rect className="scene-bar" x={width - 162} y={13} width={78 - i * 12} height={7} rx={4} fill="#29b98b" /><Text x={width - 57} y={22} fill="#198e67" size={12}>%{92 - i * 5}</Text></g>)}</> : <>{(kind === "branches" ? ["Demo 1 · Merkez şube", "Demo 2 · İkinci şube", "Demo 3 · Eğitim ekibi"] : kind === "materials" ? ["Matematik konu anlatımı", "Denklem çözme alıştırmaları", "Haftalık çalışma dosyası"] : kind === "homework" ? ["Denklemler · 12 soru", "Paragraf çalışması", "Fen Bilimleri etkinliği"] : ["Sınıf hazırlığını tamamla", "Günlük kayıtları kontrol et", "Ekip toplantısına katıl"]).map((name, i) => <g key={name} transform={`translate(24 ${78 + i * 61})`}><rect width={width - 48} height={52} rx={9} fill="#f6f8fb" /><circle cx={22} cy={26} r={13} fill={i === 0 ? "#e0f7ed" : "#fff0df"} /><Glyph x={14} y={18} kind={i === 0 ? "check" : "book"} color={i === 0 ? "#15a273" : orange} /><Text x={48} y={24} size={12} weight={650}>{name}</Text><Text x={48} y={40} size={10} fill={muted}>{i === 0 ? "Tamamlandı" : "Devam ediyor"} · Demo {i + 1}</Text></g>)}</>}
  </g>
}

function Dashboard({ role = "ogretmen" }: { role?: RoleId }) {
  const selected = roles.find(r => r.id === role)!
  const kind: Preview = role === "rehberlik" ? "guidance" : role === "yemekhane" ? "meals" : role === "servis-soforu" ? "route" : role === "sube-muduru" ? "reports" : role === "muhasebe" ? "finance" : role === "personel" ? "tasks" : role === "veli" ? "students" : role === "ogrenci" ? "homework" : role === "yonetici" ? "reports" : "lessons"
  const metrics = role === "rehberlik" ? [["Görüşme", "8", "#fff0e2"], ["Takipteki öğrenci", "24", "#e3f8f0"], ["Randevu", "3", "#e8f0ff"]] : role === "yemekhane" ? [["Planlanan öğün", "14", "#fff0e2"], ["Eksik menü", "0", "#e3f8f0"], ["Alerjen türü", "3", "#e8f0ff"]] : role === "servis-soforu" ? [["Bugünkü rota", "2", "#fff0e2"], ["Öğrenci", "18", "#e3f8f0"], ["Binen", "12", "#e8f0ff"]] : role === "muhasebe" ? [["Tahsilat", "₺48.200", "#e3f8f0"], ["Gider", "₺12.600", "#fff0e2"], ["Bakiye", "₺35.600", "#e8f0ff"]] : role === "personel" ? [["Bugünkü görev", "8", "#fff0e2"], ["Tamamlanan", "5", "#e3f8f0"], ["Yeni duyuru", "3", "#e8f0ff"]] : [["Bugünkü ders", "8", "#fff0e2"], ["Katılım oranı", "%92", "#e3f8f0"], ["Yeni bildirim", "3", "#e8f0ff"]]
  return <svg viewBox="0 0 720 412" x={0} y={0} width={720} height={412} overflow="hidden">
    <rect width={720} height={412} fill="#f6f8fb" /><rect width={720} height={49} fill="#fff" /><path d="M0 49h720" stroke="#e6eaf0" />
    <Logo x={16} y={12} /><Text x={49} y={29} size={14} weight={750}>SchoolAsist</Text><rect x={349} y={14} width={185} height={25} rx={7} fill="#f5f7fa" /><Text x={362} y={31} size={10} fill={muted}>Öğrenci, ders veya kayıt ara…</Text><circle cx={627} cy={25} r={13} fill="#fff0df" /><Text x={619} y={29} fill={orange} size={10} weight={750}>D1</Text><Text x={649} y={22} size={11} weight={700}>Demo 1</Text><Text x={649} y={36} size={9} fill={muted}>{selected.name}</Text>
    <rect y={49} width={143} height={363} fill="#fff" />
    {menuByRole[role].map((name, i) => <g key={name} transform={`translate(12 ${66 + i * 40})`}>{i === 0 && <rect width={118} height={33} rx={7} fill="#fff0e2" />}<Glyph x={10} y={9} kind={["grid", "book", "user", "check", "message", "calendar", "grid"][i]} color={i === 0 ? orange : muted} /><Text x={36} y={22} size={11} fill={i === 0 ? "#b85a00" : "#5f6c80"}>{name}</Text></g>)}
    <Text x={166} y={83} size={22} weight={750}>{selected.screen}</Text><Text x={166} y={104} size={11} fill={muted}>Bugün · Kurumunuzun akışı bir arada.</Text>
    {metrics.map(([label, value, color], i) => <g key={label} transform={`translate(${166 + i * 177} 123)`}><Panel x={0} y={0} w={163} h={76} fill={color} /><Text x={14} y={24} size={11} fill={muted}>{label}</Text><Text x={14} y={57} size={27} weight={750}>{value}</Text></g>)}
    <g transform="translate(166 215) scale(.71)"><ContentPanel kind={kind} width={480} /></g>
    <Panel x={523} y={215} w={171} h={192} /><Text x={540} y={241} size={13} weight={700}>Günlük özet</Text>
    <circle cx={609} cy={304} r={41} fill="none" stroke="#e9eef3" strokeWidth={8} /><circle className="scene-ring" cx={609} cy={304} r={41} fill="none" stroke="#25b886" strokeWidth={8} strokeDasharray="237 258" transform="rotate(-90 609 304)" strokeLinecap="round" />
    <Text x={583} y={312} size={24} weight={750}>%92</Text><Text x={570} y={373} size={11} fill={muted}>{role === "muhasebe" ? "Tahsilat oranı" : role === "personel" ? "Görev tamamlanma" : "Genel katılım oranı"}</Text>
  </svg>
}

function Laptop({ id, x = 0, y = 0, scale = 1, role = "ogretmen", desktop = false }: { id: string; x?: number; y?: number; scale?: number; role?: RoleId; desktop?: boolean }) {
  return <g className="scene-device" transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x={11} y={0} width={748} height={445} rx={20} fill={`url(#${id}-edge)`} stroke="#a4a7ac" strokeWidth={1.5} /><rect x={15} y={3} width={740} height={439} rx={18} fill="#101113" />
    <circle cx={384} cy={9} r={2.2} fill="#474d58" /><g transform="translate(25 18)"><Dashboard role={role} /></g><path d="M34 5h638" stroke="#fff" strokeOpacity={.25} />
    {desktop ? <><path d="M341 444h88l11 54H327Z" fill={`url(#${id}-metal)`} /><rect x={293} y={496} width={182} height={8} rx={4} fill={`url(#${id}-metal)`} /></> : <><path d="M11 443h748l74 22v8c0 7-26 15-51 15H-12c-24 0-52-8-52-15v-8Z" fill={`url(#${id}-metal)`} stroke="#7b7e83" strokeWidth={1} /><path d="M-64 465h897" stroke="#f8fafc" strokeOpacity={.65} /><path d="M323 446h124l16 9H306Z" fill="#494d54" /><path d="M-37 476h88 M688 476h100" stroke="#22262b" strokeWidth={3} strokeLinecap="round" /></>}
  </g>
}

function Phone({ id, x = 0, y = 0, scale = 1, role = "ogretmen", notification = false }: { id: string; x?: number; y?: number; scale?: number; role?: RoleId; notification?: boolean }) {
  const special = role === "rehberlik" ? "guidance" : role === "yemekhane" ? "meals" : role === "servis-soforu" ? "route" : null
  const heading = role === "rehberlik" ? "Görüşmeler" : role === "yemekhane" ? "Yemek menüsü" : role === "servis-soforu" ? "Bugünkü rota" : role === "sube-muduru" || role === "yonetici" ? "Kurum özeti" : role === "veli" ? "Öğrencim" : role === "personel" ? "Görevlerim" : role === "muhasebe" ? "Tahsilatlar" : "Derslerim"
  return <g className="scene-phone" transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x={-4} y={77} width={4} height={39} rx={2} fill="#686c72" /><rect x={210} y={82} width={4} height={53} rx={2} fill="#83878f" />
    <rect width={213} height={430} rx={33} fill={`url(#${id}-edge)`} stroke="#8c9098" strokeWidth={1.5} /><rect x={4} y={4} width={205} height={422} rx={30} fill="#0b0c0f" /><rect x={10} y={10} width={193} height={410} rx={26} fill={notification ? "#12151c" : "#f8fafc"} />
    <rect x={76} y={16} width={62} height={18} rx={10} fill="#07080b" /><Text x={24} y={31} size={10} weight={700} fill={notification ? "#fff" : ink}>9:41</Text><path d="M169 22v7m4-10v10m4-13v13" stroke={notification ? "#fff" : ink} strokeWidth={2} />
    {notification ? <><Text x={35} y={119} size={48} weight={300} fill="#fff">9:41</Text><Text x={62} y={144} size={12} fill="#abb4c5">12 Mart Salı</Text><rect x={19} y={185} width={175} height={105} rx={13} fill="#ffffffed" /><Logo x={31} y={200} /><Text x={63} y={210} size={10} weight={700}>SchoolAsist</Text><Text x={32} y={240} size={12} weight={700}>Yeni ders bildirimi</Text><Text x={32} y={259} size={10} fill={muted}>Demo 1 derse katıldı.</Text><Text x={32} y={277} size={9} fill={muted}>Matematik · 09:00</Text></> : <>
      <Logo x={24} y={55} size={22} /><Text x={53} y={70} size={12} weight={750}>SchoolAsist</Text><Text x={24} y={106} size={22} weight={750}>{heading}</Text>
      <rect x={24} y={121} width={164} height={49} rx={10} fill="#fff0e2" /><circle cx={46} cy={145} r={15} fill="#ff7900" /><Text x={38} y={149} size={10} fill="#fff" weight={700}>D1</Text><Text x={69} y={141} size={11} weight={700}>Demo 1</Text><Text x={69} y={157} size={9} fill={muted}>{special ? "Günlük çalışma alanı" : role === "muhasebe" ? "Güncel ödeme durumu" : role === "personel" ? "Bugünün görev listesi" : "Bugünün ders programı"}</Text>
      {special ? <g transform="translate(16 183) scale(.55)"><ContentPanel kind={special} width={330} /></g> : role === "muhasebe" || role === "personel" ? <>{(role === "muhasebe" ? ["Demo 1 · Ödendi", "Demo 2 · Bekliyor", "Demo 3 · Ödendi"] : ["Sınıf hazırlığı", "Kayıt kontrolü", "Ekip toplantısı"]).map((label, i) => <g key={label} transform={`translate(24 ${185 + i * 57})`}><rect width={164} height={47} rx={8} fill={i === 0 ? "#e3f8f0" : "#f0f3f7"} /><Text x={12} y={22} size={11} weight={650}>{label}</Text><Text x={12} y={38} size={10} fill={muted}>{role === "muhasebe" ? "₺10.400 · Taksit ödemesi" : "Günlük görev · Demo 1"}</Text></g>)}</> : <g transform="translate(24 186) scale(.57)"><LessonRows width={288} /></g>}
      <path d="M10 375h193" stroke="#e1e7ef" />{["grid", "book", "message", "user"].map((kind, i) => <Glyph key={kind} x={29 + i * 47} y={389} kind={kind} color={i === 0 ? orange : muted} />)}
    </>}
    <rect x={76} y={412} width={62} height={4} rx={2} fill={notification ? "#fff" : ink} />
  </g>
}

export function ProductScene({ asset, alt, className = "", role: selectedRole, transparent = false, device }: { asset: ShowcaseAsset; alt: string; className?: string; role?: RoleId; transparent?: boolean; device?: "phone" }) {
  const uid = useId().replace(/:/g, "")
  const id = `product-${uid}`
  const inferred = roles.find(r => asset.startsWith(r.id))?.id || (asset === "roles-admin" ? "yonetici" : asset === "roles-parent" ? "veli" : "ogretmen")
  const role = selectedRole || inferred
  const kind = previewByAsset[asset]
  const light = ["home-ecosystem", "platform-flow", "yonetici-access", "personel-access", "veli-students"].includes(asset) || asset.endsWith("-option")
  const phoneOnly = device === "phone" || asset === "veli-phone"
  const notification = asset === "veli-notification"
  const card = !!kind || asset === "apps-desktop" || asset === "apps-mobile"
  const height = phoneOnly ? 660 : notification ? 340 : card ? 330 : asset === "veli-students" ? 500 : light ? 360 : asset === "registration-brand" ? 240 : asset === "ogrenci-device" ? 540 : 500
  const width = phoneOnly ? 490 : notification ? 534 : card ? 600 : 1024
  return <svg className={`ref-scene vector-scene ${className}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={!alt || undefined} data-scene={asset} fontFamily="Inter Variable, Arial, sans-serif">
    <defs>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="#e5e8ed" /><stop offset=".04" stopColor="#515661" /><stop offset=".48" stopColor="#0a0b0d" /><stop offset=".96" stopColor="#626772" /><stop offset="1" stopColor="#f0f2f6" /></linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b8bdc6" /><stop offset=".25" stopColor="#eceef2" /><stop offset=".55" stopColor="#626873" /><stop offset="1" stopColor="#22262e" /></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor="#ff8b21" stopOpacity={.42} /><stop offset=".5" stopColor="#bc570a" stopOpacity={.15} /><stop offset="1" stopColor="#000" stopOpacity={0} /></radialGradient>
      <linearGradient id={`${id}-floor`}><stop stopColor="#ff7900" stopOpacity={0} /><stop offset=".5" stopColor="#ffb655" /><stop offset="1" stopColor="#ff7900" stopOpacity={0} /></linearGradient>
    </defs>
    {!light && <>{!transparent && <rect width={width} height={height} fill="#000" />}<ellipse cx={width * .5} cy={height * .83} rx={width * .55} ry={height * .58} fill={`url(#${id}-glow)`} /><ellipse cx={width * .5} cy={height - 27} rx={width * .37} ry={12} fill="#ff8d18" opacity={.13} /><path d={`M0 ${height - 49}H${width}`} stroke={`url(#${id}-floor)`} strokeWidth={1.5} /></>}
    {asset === "registration-brand" ? <><Logo x={427} y={25} size={170} /><Text x={412} y={228} size={27} weight={750} fill="#fff">SchoolAsist</Text></> : asset === "support-symbol" ? <><rect x={190} y={82} width={380} height={235} rx={57} fill="#ff7900" /><path d="M233 307v61l71-54" fill="#ff7900" /><Text x={334} y={256} size={155} weight={750} fill="#fff">?</Text><circle cx={614} cy={199} r={77} fill="#262b33" stroke="#666b74" /><Text x={585} y={223} size={71} fill="#fff" weight={700}>!</Text></> : phoneOnly ? <Phone id={id} x={90} y={36} scale={1.33} role={role} /> : notification ? <g transform="translate(35 68)"><rect width={465} height={165} rx={25} fill="#ffffff" /><Logo x={24} y={27} size={44} /><Text x={87} y={48} size={17} weight={750}>SchoolAsist</Text><Text x={371} y={46} size={13} fill={muted}>şimdi</Text><Text x={24} y={99} size={24} weight={750}>Demo 1 derse katıldı.</Text><Text x={24} y={132} size={16} fill={muted}>Matematik · Bugün, 09:00</Text></g> : card ? <>
      {kind === "messages" || asset === "apps-mobile" ? <g transform="translate(196 34) rotate(-7 106 210)"><Phone id={id} scale={.87} role={role} notification={kind === "messages"} /></g> : <g transform="translate(34 36) rotate(-3 265 135)"><ContentPanel kind={kind || "lessons"} width={532} /></g>}
    </> : asset === "platform-flow" || asset.endsWith("-access") ? <>{["ogretmen", "veli", "yonetici"].map((value, i) => <g key={value} transform={`translate(${42 + i * 326} 24)`}><rect width={288} height={302} rx={18} fill="#f6f8fb" stroke="#e1e7ef" /><Text x={22} y={38} size={20} weight={750}>{roles.find(r => r.id === value)?.name}</Text><Text x={22} y={64} size={12} fill={muted}>{["Dersi ve yoklamayı kaydeder.", "Anlık bilgilendirme alır.", "Kurumun akışını takip eder."][i]}</Text><g transform="translate(16 86) scale(.53)"><ContentPanel kind={(["lessons", "messages", "reports"] as Preview[])[i]} /></g><circle cx={145} cy={269} r={16} fill="#fff0e2" /><Glyph x={137} y={261} kind="check" color={orange} /></g>)}</> : asset === "veli-students" ? <g transform="translate(115 25) scale(1.65)"><ContentPanel kind="students" /></g> : asset.endsWith("-option") ? <>
      {asset === "apps-mobile-option" ? <Phone id={id} x={425} y={0} scale={.78} /> : <Laptop id={id} x={276} y={5} scale={.62} desktop={asset === "apps-desktop-option"} />}
    </> : light ? <><Laptop id={id} x={273} y={20} scale={.61} role={role} desktop /><g transform="translate(52 100) rotate(-4)"><Laptop id={id} scale={.4} role={role} /></g><Phone id={id} x={762} y={98} scale={.57} role={role} /></> : asset === "ogrenci-device-tail" || asset === "home-floor" || asset === "registration-floor" ? null : <>
      <Laptop id={id} x={asset === "ogrenci-device" ? 58 : 165} y={asset === "ogrenci-device" ? 85 : 26} scale={asset === "ogrenci-device" ? 1.12 : .87} role={role} desktop={asset === "yonetici-device"} />
      {asset !== "ogretmen-device" && asset !== "support-laptop" && <Phone id={id} x={asset === "ogrenci-device" ? 747 : 736} y={asset === "ogrenci-device" ? 184 : 93} scale={.88} role={role} />}
    </>}
  </svg>
}
