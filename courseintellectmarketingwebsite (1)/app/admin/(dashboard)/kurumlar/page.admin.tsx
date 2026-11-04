"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Building2, Check, CheckCircle2, Clock3, ShieldOff, UserRoundPlus, Ban, Search, SlidersHorizontal, X, MoreHorizontal, ChevronLeft, ChevronRight, Mail, Phone, Info, Flag, FileDown, Copy, Eye, EyeOff, ShieldAlert, Trash2, Loader2, Plus, MapPin, Users, Hash, UserRound } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { apiRequest, ApiRequestError } from "@/lib/api-client"
import { downloadBase64File } from "@/lib/download-base64"
import { emptyTenantFilters, filterTenants, registrationDate, statusLabels, tenantCsv, typeLabels, withoutCredentials, type TenantData, type TenantFilters } from "@/lib/admin/institutions"

interface BlocklistEntry { id: string; kind: "domain" | "ip"; value: string; reason?: string | null; createdByName: string; createdAtUtc: string }
interface Credentials { tenantName: string; adminUsername: string; temporaryPassword: string; setupDocumentBase64?: string | null; setupDocumentFileName?: string | null }
type Confirmation = { tenant: TenantData; action: "reject" | "suspend" | "reopen" | "delete" }
const formatDate = (value?: string | null, time = false) => value ? new Date(value).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}) }) : "—"
const initials = (name: string) => name.split(/\s+/).map(n => n[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR")
const wideSubscribe = (notify: () => void) => { const media = window.matchMedia("(min-width: 1440px)"); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify) }
const wideSnapshot = () => window.matchMedia("(min-width: 1440px)").matches
const tabs = [["all", "Tüm kurumlar"], ["pending", "Başvurular"], ["active", "Aktif"], ["suspended", "Erişimi kapalı"], ["rejected", "Reddedilen"]] as const
function StatusBadge({ tenant }: { tenant: TenantData }) { return <span className={`sadmin-status sadmin-status-${tenant.status}`}><i/>{statusLabels[tenant.status]}</span> }
function Verification({ tenant }: { tenant: TenantData }) { return tenant.verificationState === "verified" ? <span className="sadmin-tenant-verification is-verified"><CheckCircle2 size={13}/>Doğrulandı</span> : <span className="sadmin-tenant-verification"><Clock3 size={13}/>{tenant.verificationState === "awaiting" ? "Bekliyor" : "Doğrulanmadı"}</span> }
function Modal({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description: string; children: React.ReactNode; wide?: boolean }) {
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose() }}><Dialog.Portal><Dialog.Overlay className="sadmin-modal-overlay"/><Dialog.Content className={`sadmin-admin-modal${wide ? " sadmin-modal-wide" : ""}`}><div className="sadmin-modal-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close className="sadmin-icon-button" aria-label="Pencereyi kapat"><X size={20}/></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>
}

export default function KurumlarPage() {
  const [tenants, setTenants] = useState<TenantData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<TenantFilters>({ ...emptyTenantFilters })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [advanced, setAdvanced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [reason, setReason] = useState("")
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([])
  const [blockError, setBlockError] = useState<string | null>(null)
  const [blockLoading, setBlockLoading] = useState(false)
  const [blockKind, setBlockKind] = useState<"domain" | "ip">("domain")
  const [blockValue, setBlockValue] = useState("")
  const [blockReason, setBlockReason] = useState("")
  const [blockBusy, setBlockBusy] = useState(false)
  const wide = useSyncExternalStore(wideSubscribe, wideSnapshot, () => false)
  const initialSelectionMade = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const selected = tenants.find(t => t.id === selectedId) ?? null
  const filtered = filterTenants(tenants, filters)
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const types = [...new Set(tenants.map(t => t.institutionType).filter((value): value is string => Boolean(value)))].sort()
  const cities = [...new Set(tenants.map(t => t.city).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "tr-TR"))
  const setFilter = <K extends keyof TenantFilters>(key: K, value: TenantFilters[K]) => { setFilters(old => ({ ...old, [key]: value })); setPage(1) }
  const clearFilters = () => { setFilters({ ...emptyTenantFilters }); setPage(1) }
  const loadTenants = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = (await apiRequest<TenantData[]>("/api/platformops/tenants")).map(withoutCredentials)
      setTenants(data)
      // Open the first reviewable application on desktop; mobile starts with the list.
      if (!initialSelectionMade.current) {
        initialSelectionMade.current = true
        if (wideSnapshot()) setSelectedId((data.find(t => t.status === "pending" && t.verificationState === "verified") || data.find(t => t.status === "pending") || data[0])?.id || null)
      }
    }
    catch { setError("Kurumlar yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadTenants() }, [loadTenants])
  const loadBlocks = useCallback(async () => {
    setBlockLoading(true); setBlockError(null)
    try { setBlocklist(await apiRequest<BlocklistEntry[]>("/api/platformops/registration-blocklist")) }
    catch { setBlockError("Kayıt engelleri yüklenemedi.") }
    finally { setBlockLoading(false) }
  }, [])
  useEffect(() => { if (blockOpen) void loadBlocks() }, [blockOpen, loadBlocks])
  const openDetails = (tenant: TenantData) => { lastFocus.current = document.activeElement as HTMLElement; setSelectedId(tenant.id); setError(null) }
  const closeDetails = () => { setSelectedId(null); lastFocus.current?.focus() }
  const showCredentials = (tenant: TenantData) => {
    if (tenant.adminUsername && tenant.temporaryPassword) {
      setPasswordVisible(false); setCopied(false)
      setCredentials({ tenantName: tenant.name, adminUsername: tenant.adminUsername, temporaryPassword: tenant.temporaryPassword, setupDocumentBase64: tenant.setupDocumentBase64, setupDocumentFileName: tenant.setupDocumentFileName })
      downloadBase64File(tenant.setupDocumentBase64, tenant.setupDocumentFileName)
    }
  }
  const approve = async (tenant: TenantData) => {
    if (busy || tenant.status !== "pending" || tenant.verificationState !== "verified") return
    setBusy(true); setError(null); setNotice(null)
    try {
      const updated = await apiRequest<TenantData>(`/api/platformops/tenants/${tenant.id}/approve`, { method: "PUT" })
      setTenants(old => old.map(t => t.id === tenant.id ? withoutCredentials({ ...t, ...updated, registrationCreatedAtUtc: updated.registrationCreatedAtUtc || t.registrationCreatedAtUtc || t.createdAtUtc, verifiedAtUtc: updated.verifiedAtUtc || t.verifiedAtUtc }) : t))
      setSelectedId(updated.id); setSelectedRows(old => new Set([...old].filter(id => id !== tenant.id)))
      setNotice(updated.approvalEmailSentAtUtc ? "Kurum onaylandı. Onay e-postası gönderildi." : "Kurum onaylandı. Onay e-postası gönderim sırasına alındı.")
      showCredentials(updated)
    } catch (err) { setError(err instanceof Error ? err.message : "Kurum onaylanamadı.") }
    finally { setBusy(false) }
  }
  const setupDocument = async (tenant: TenantData) => {
    setBusy(true); setError(null)
    try { const result = await apiRequest<TenantData>(`/api/platformops/tenants/${tenant.id}/setup-document`, { method: "POST" }); showCredentials(result) }
    catch (err) { setError(err instanceof ApiRequestError && err.code === "ALREADY_ACTIVATED" ? err.message : "Kurulum belgesi üretilemedi.") }
    finally { setBusy(false) }
  }
  const flag = async (tenant: TenantData) => {
    setBusy(true); setError(null)
    try {
      const updated = await apiRequest<TenantData>(`/api/platformops/tenants/${tenant.id}/suspicious`, { method: "PUT", query: { value: !tenant.isSuspicious } })
      setTenants(old => old.map(t => t.id === tenant.id ? withoutCredentials({ ...t, ...updated }) : t))
    } catch (err) { setError(err instanceof Error ? err.message : "İşaret güncellenemedi.") }
    finally { setBusy(false) }
  }
  const confirmAction = (tenant: TenantData, action: Confirmation["action"]) => { setReason(""); setError(null); setConfirmation({ tenant, action }) }
  const executeAction = async () => {
    if (!confirmation || busy) return
    const { tenant, action } = confirmation
    setBusy(true); setError(null); setNotice(null)
    try {
      if (action === "delete") {
        await apiRequest(`/api/platformops/tenants/${tenant.id}`, { method: "DELETE" })
        setTenants(old => old.filter(t => t.id !== tenant.id)); setSelectedId(null)
        setSelectedRows(old => new Set([...old].filter(id => id !== tenant.id)))
      } else if (action === "reject") {
        const updated = await apiRequest<TenantData>(`/api/platformops/tenants/${tenant.id}/reject`, { method: "PUT", query: { reason: reason.trim() || undefined } })
        setTenants(old => old.map(t => t.id === tenant.id ? withoutCredentials({ ...t, ...updated }) : t))
      } else {
        await apiRequest(`/api/platformops/tenants/${tenant.id}/access`, { method: "PUT", body: { enabled: action === "reopen" } })
        setTenants(old => old.map(t => t.id === tenant.id ? { ...t, status: action === "reopen" ? "active" : "suspended" } : t))
      }
      setConfirmation(null); setNotice(action === "delete" ? "Kurum silindi." : action === "reject" ? "Başvuru reddedildi." : action === "suspend" ? "Kurumun ve bağlı kullanıcılarının erişimi kapatıldı." : "Kurumun erişimi açıldı.")
    } catch (err) { setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.") }
    finally { setBusy(false) }
  }
  const exportCsv = () => {
    const exportRows = selectedRows.size ? filtered.filter(t => selectedRows.has(t.id)) : filtered
    if (!exportRows.length) return
    const url = URL.createObjectURL(new Blob([tenantCsv(exportRows)], { type: "text/csv;charset=utf-8;" }))
    const link = document.createElement("a"); link.href = url; link.download = `schoolasist-kurumlar-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const chips: { label: string; clear: () => void }[] = []
  if (filters.search) chips.push({ label: `Arama: ${filters.search}`, clear: () => setFilter("search", "") })
  if (filters.status !== "all") chips.push({ label: statusLabels[filters.status as keyof typeof statusLabels], clear: () => setFilter("status", "all") })
  if (filters.type !== "all") chips.push({ label: typeLabels[filters.type] || filters.type, clear: () => setFilter("type", "all") })
  if (filters.city !== "all") chips.push({ label: filters.city, clear: () => setFilter("city", "all") })
  if (filters.date !== "all") chips.push({ label: filters.date === "custom" ? `${filters.from || "Başlangıç"} – ${filters.to || "Bugün"}` : `Son ${filters.date} gün`, clear: () => { setFilters(old => ({ ...old, date: "all", from: "", to: "" })); setPage(1) } })
  if (filters.verification !== "all") chips.push({ label: filters.verification === "verified" ? "E-posta: Doğrulandı" : filters.verification === "awaiting" ? "E-posta: Bekliyor" : "E-posta: Doğrulanmadı", clear: () => setFilter("verification", "all") })
  if (filters.suspicious) chips.push({ label: "Şüpheli başvurular", clear: () => setFilter("suspicious", false) })
  const details = selected && <>
    <div className="sadmin-detail-heading"><h2>{selected.status === "pending" || selected.status === "rejected" ? "Başvuru ayrıntıları" : "Kurum ayrıntıları"}</h2><button className="sadmin-icon-button" aria-label="Ayrıntıları kapat" onClick={closeDetails}><X size={19}/></button></div>
    <div className="sadmin-detail-identity"><span className="sadmin-tenant-avatar large">{initials(selected.name)}</span><div><h3>{selected.name}</h3><StatusBadge tenant={selected}/></div></div>
    <section className="sadmin-detail-section"><h4>Kurum bilgileri</h4><div className="sadmin-institution-info">
      <p><Building2 size={18}/><span>{typeLabels[selected.institutionType || ""] || "Belirtilmemiş"}</span></p>
      <p><MapPin size={18}/><span>{[selected.city, selected.district].filter(Boolean).join(" / ") || "İl belirtilmemiş"}</span></p>
      {selected.estimatedStudents != null && <p><Users size={18}/><span>Tahmini öğrenci: {selected.estimatedStudents.toLocaleString("tr-TR")}</span></p>}
      {selected.customerNumber && <p><Hash size={18}/><span>{selected.customerNumber}</span></p>}
      {(selected.status === "active" || selected.status === "suspended") && <p><Users size={18}/><span>{selected.users} kullanıcı · {selected.branches} şube</span></p>}
      {selected.addressLine && <details key={selected.id}><summary>Adres bilgisi</summary><p>{selected.addressLine}</p></details>}
    </div></section>
    <section className="sadmin-detail-section sadmin-contact-section"><h4>Yetkili kişi</h4><p className="sadmin-contact-line"><UserRound size={18}/><span>{selected.contactName || "Belirtilmemiş"}</span></p><p className="sadmin-contact-line"><Mail size={18}/><span>{selected.email}</span></p><div className="sadmin-contact-verification"><Verification tenant={selected}/></div>{(selected.contactPhone || selected.contactTitle) && <details key={selected.id} className="sadmin-contact-more"><summary><span className="sr-only">İletişim bilgileri</span><MoreHorizontal size={16}/></summary>{selected.contactTitle && <p>{selected.contactTitle}</p>}{selected.contactPhone && <p><Phone size={14}/>{selected.contactPhone}</p>}</details>}</section>
    <section className="sadmin-detail-section"><h4>Başvuru süreci</h4><ol className="sadmin-timeline"><li className="is-complete"><span>Başvuru alındı</span><time>{formatDate(registrationDate(selected), true)}</time></li>{selected.verifiedAtUtc && <li className="is-complete"><span>E-posta doğrulandı</span><time>{formatDate(selected.verifiedAtUtc, true)}</time></li>}{selected.approvedAtUtc && <li className="is-complete"><span>Kurum onaylandı</span><time>{formatDate(selected.approvedAtUtc, true)}</time></li>}{selected.rejectedAtUtc && <li><span>Başvuru reddedildi</span><time>{formatDate(selected.rejectedAtUtc, true)}</time></li>}{selected.status === "pending" && <li><span>Yönetici onayı bekleniyor</span></li>}{selected.status === "suspended" && <li><span>Kurum erişimi kapalı</span></li>}</ol>{selected.rejectionReason && <p className="sadmin-detail-muted">Gerekçe: {selected.rejectionReason}</p>}</section>
    <div className="sadmin-detail-bottom">{selected.isSuspicious && <p className="sadmin-alert"><Flag size={16}/>Şüpheli başvuru{selected.suspiciousReason ? `: ${selected.suspiciousReason}` : ""}</p>}
      {selected.status === "pending" ? <><p className="sadmin-detail-info"><Info size={16}/><span>{selected.verificationState === "verified" ? "Onaydan sonra kurumun giriş bilgileri e-postayla iletilir." : "Başvuruyu onaylamak için yetkilinin e-posta adresini doğrulaması gerekir."}</span></p><div className="sadmin-detail-primary-actions"><button className="sadmin-button sadmin-button-primary" disabled={busy || selected.verificationState !== "verified"} onClick={() => void approve(selected)}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>}Onayla</button><button className="sadmin-button sadmin-button-danger-outline" disabled={busy} onClick={() => confirmAction(selected, "reject")}><X size={16}/>Reddet</button></div></> : <>{selected.status === "active" && <><p className="sadmin-detail-info"><Info size={16}/><span>{selected.approvalEmailSentAtUtc ? `Onay e-postası ${formatDate(selected.approvalEmailSentAtUtc, true)} tarihinde gönderildi.` : "Onay e-postasının gönderim durumu henüz doğrulanmadı."}</span></p><button className="sadmin-button sadmin-button-danger-outline sadmin-full" disabled={busy} onClick={() => confirmAction(selected, "suspend")}><ShieldOff size={16}/>Kurum erişimini kapat</button></>}{selected.status === "suspended" && <button className="sadmin-button sadmin-button-primary sadmin-full" disabled={busy} onClick={() => confirmAction(selected, "reopen")}><Check size={16}/>Kurum erişimini aç</button>}</>}
      <DropdownMenu><DropdownMenuTrigger asChild><button className="sadmin-detail-other" aria-label="Diğer işlemler" disabled={busy}>Diğer işlemler<MoreHorizontal size={18}/></button></DropdownMenuTrigger><DropdownMenuContent className="sadmin-admin-menu" align="end">{selected.status === "pending" && <DropdownMenuItem onClick={() => void flag(selected)}><Flag size={16}/>{selected.isSuspicious ? "Şüpheli işaretini kaldır" : "Şüpheli olarak işaretle"}</DropdownMenuItem>}{selected.status === "active" && <DropdownMenuItem onClick={() => void setupDocument(selected)}><FileDown size={16}/>Kurulum belgesi oluştur</DropdownMenuItem>}<DropdownMenuSeparator/><DropdownMenuItem className="text-red-600" onClick={() => confirmAction(selected, "delete")}><Trash2 size={16}/>Kurumu kalıcı sil</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
  </>
  return <div className={`sadmin-institutions-layout${selected && wide ? " has-details" : ""}`}>
    <div className="sadmin-institutions-content">
      <div className="sadmin-page-heading"><div><h1>Kurum yönetimi</h1><p>Başvuruları inceleyin, kurumları ve erişim izinlerini yönetin.</p></div><div className="sadmin-page-actions"><button className="sadmin-button" disabled={loading || busy || (selectedRows.size > 0 ? !filtered.some(t => selectedRows.has(t.id)) : !filtered.length)} onClick={exportCsv}><FileDown size={16}/>Dışa aktar{selectedRows.size ? ` (${filtered.filter(t => selectedRows.has(t.id)).length})` : ""}</button><button className="sadmin-button sadmin-button-primary" disabled={loading || busy} onClick={() => { setFilter("status", "pending"); const pending = tenants.find(t => t.status === "pending"); if (pending) openDetails(pending); else searchRef.current?.focus() }}><UserRoundPlus size={17}/>Başvuruları incele</button></div></div>
      <div className="sadmin-stats-grid">{[
        { label: "Toplam kurum", status: "all", icon: Building2, tone: "blue", hint: "Kurum ve başvurular" },
        { label: "Aktif kurum", status: "active", icon: Users, tone: "green", hint: "Erişime açık kurumlar" },
        { label: "Onay bekleyen", status: "pending", icon: Clock3, tone: "amber", hint: "İncelenecek başvurular" },
        { label: "Erişimi kapalı", status: "suspended", icon: Ban, tone: "rose", hint: "Kullanıcı erişimi kapalı" },
      ].map(stat => <button key={stat.status} className={`sadmin-stat-tile sadmin-stat-${stat.tone}`} disabled={loading} onClick={() => setFilter("status", stat.status)}><span className="sadmin-stat-label">{stat.label}</span><stat.icon className="sadmin-stat-icon" size={21}/><strong>{loading || (error && !tenants.length) ? "—" : (stat.status === "all" ? tenants.length : tenants.filter(t => t.status === stat.status).length).toLocaleString("tr-TR")}</strong><span className="sadmin-stat-hint">{stat.hint}</span><div className="sadmin-stat-bars" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => { const now = new Date(); now.setHours(0, 0, 0, 0); now.setDate(now.getDate() - 6 + index); const count = tenants.filter(t => (stat.status === "all" || t.status === stat.status) && new Date(registrationDate(t)).toDateString() === now.toDateString()).length; return <i key={index} style={{ height: `${Math.min(35, 3 + count * 7)}px` }}/> })}</div></button>)}</div>
      <div className="sadmin-table-prelude"><span>Reddedilen: <strong>{loading ? "—" : tenants.filter(t => t.status === "rejected").length}</strong></span><button disabled={busy} onClick={() => setBlockOpen(true)}><ShieldAlert size={14}/>Kayıt engelleri</button></div>
      {error && <div className="sadmin-alert" role="alert"><ShieldAlert size={17}/><span>{error}</span>{!busy && <button onClick={() => void loadTenants()}>Yeniden dene</button>}</div>}
      {notice && <div className="sadmin-notice" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="sadmin-icon-button" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}><X size={15}/></button></div>}
      <section className="sadmin-table-card" aria-label="Kurum listesi">
        <div className="sadmin-filter-tabs" role="group" aria-label="Kurum durumu">{tabs.map(([status, label]) => <button key={status} aria-pressed={filters.status === status} onClick={() => setFilter("status", status)} className={filters.status === status ? "is-active" : ""}>{label}{status === "pending" && <span>{tenants.filter(t => t.status === "pending").length}</span>}</button>)}</div>
        <div className="sadmin-filter-controls"><label className="sadmin-search-field"><Search size={16}/><input ref={searchRef} placeholder="Kurum, e-posta veya müşteri no…" aria-label="Kurum, e-posta veya müşteri numarası ara" value={filters.search} onChange={e => setFilter("search", e.target.value)}/></label><select aria-label="Durum filtresi" value={filters.status} onChange={e => setFilter("status", e.target.value)}><option value="all">Durum</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Kurum türü filtresi" value={filters.type} onChange={e => setFilter("type", e.target.value)}><option value="all">Kurum türü</option>{types.map(value => <option key={value} value={value}>{typeLabels[value] || value}</option>)}</select><select aria-label="İl filtresi" value={filters.city} onChange={e => setFilter("city", e.target.value)}><option value="all">İl</option>{cities.map(city => <option key={city}>{city}</option>)}</select><select aria-label="Tarih aralığı filtresi" value={filters.date} onChange={e => setFilter("date", e.target.value)}><option value="all">Tarih aralığı</option><option value="7">Son 7 gün</option><option value="30">Son 30 gün</option><option value="90">Son 90 gün</option><option value="custom">Özel aralık</option></select><button className={`sadmin-advanced-toggle${advanced ? " is-active" : ""}`} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={15}/>Gelişmiş filtreler</button></div>
        {(advanced || filters.date === "custom") && <div className="sadmin-advanced-filters">{advanced && <><label>E-posta doğrulaması<select value={filters.verification} onChange={e => setFilter("verification", e.target.value)}><option value="all">Tümü</option><option value="verified">Doğrulandı</option><option value="awaiting">Doğrulama bekleniyor</option><option value="unproven">Doğrulanmadı</option></select></label><label className="sadmin-check-label"><Checkbox checked={filters.suspicious} onCheckedChange={value => setFilter("suspicious", value === true)}/>Yalnız şüpheli başvurular</label></>}{filters.date === "custom" && <><label>Başlangıç<input type="date" value={filters.from} max={filters.to || undefined} onChange={e => setFilter("from", e.target.value)}/></label><label>Bitiş<input type="date" min={filters.from || undefined} value={filters.to} onChange={e => setFilter("to", e.target.value)}/></label></>}</div>}
        <div className="sadmin-filter-summary"><div className="sadmin-filter-chips">{chips.length ? <>{chips.map(chip => <button key={chip.label} onClick={chip.clear}>{chip.label}<X size={12}/><span className="sr-only">filtresini kaldır</span></button>)}<button className="sadmin-clear-filters" onClick={clearFilters}>Filtreleri temizle</button></> : <span className="sadmin-summary-count">{loading ? "Kurumlar yükleniyor…" : `${filtered.length} kayıt gösteriliyor`}</span>}{selectedRows.size > 0 && <button onClick={() => setSelectedRows(new Set())}>{selectedRows.size} seçili<X size={12}/><span className="sr-only">Seçimi temizle</span></button>}</div><select aria-label="Kurumları sırala" value={filters.sort} onChange={e => setFilter("sort", e.target.value)}><option value="newest">En yeni</option><option value="oldest">En eski</option><option value="name">Kurum adı A–Z</option></select></div>
        <div className="sadmin-table-scroll"><table className="sadmin-institutions-table"><caption className="sr-only">Kurumlar ve kurum başvuruları</caption><thead><tr><th className="sadmin-checkbox-cell"><Checkbox aria-label="Bu sayfadaki kurumları seç" checked={rows.length > 0 && rows.every(t => selectedRows.has(t.id)) ? true : rows.some(t => selectedRows.has(t.id)) ? "indeterminate" : false} disabled={!rows.length || loading} onCheckedChange={value => setSelectedRows(old => { const next = new Set(old); rows.forEach(t => { if (value === true) next.add(t.id); else next.delete(t.id) }); return next })}/></th><th>Kurum</th><th>Müşteri no</th><th>Tür / İl</th><th>Durum</th><th>E-posta</th><th>Başvuru tarihi</th><th><span className="sr-only">İşlemler</span></th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="sadmin-empty-state"><Loader2 className="animate-spin" size={22}/><p>Kurumlar yükleniyor…</p></td></tr> : rows.length ? rows.map(tenant => <tr key={tenant.id} className={selectedId === tenant.id ? "is-selected" : ""}><td className="sadmin-checkbox-cell"><Checkbox aria-label={`${tenant.name} kurumunu seç`} checked={selectedRows.has(tenant.id)} onCheckedChange={value => { setSelectedRows(old => { const next = new Set(old); if (value === true) next.add(tenant.id); else next.delete(tenant.id); return next }); if (value === true) openDetails(tenant) }}/></td><td><button className="sadmin-tenant-name" onClick={() => openDetails(tenant)} aria-label={`${tenant.name} ayrıntıları`}><span className={`sadmin-tenant-avatar tone-${tenant.status}`}>{initials(tenant.name)}</span><span><strong>{tenant.name}{tenant.isSuspicious && <Flag size={12}/>}</strong><small>{tenant.email}</small></span></button></td><td className="sadmin-customer-number">{tenant.customerNumber || "—"}</td><td><span className="sadmin-cell-primary">{typeLabels[tenant.institutionType || ""] || "Belirtilmemiş"}</span><small>{tenant.city || "—"}</small></td><td><StatusBadge tenant={tenant}/></td><td><Verification tenant={tenant}/></td><td className="sadmin-date-cell">{formatDate(registrationDate(tenant))}</td><td><DropdownMenu><DropdownMenuTrigger asChild><button className="sadmin-icon-button" aria-label={`${tenant.name} işlemleri`} disabled={busy}><MoreHorizontal size={19}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="sadmin-admin-menu"><DropdownMenuItem onClick={() => openDetails(tenant)}><Eye size={16}/>Ayrıntıları görüntüle</DropdownMenuItem>{tenant.status === "pending" && <><DropdownMenuItem disabled={tenant.verificationState !== "verified"} onClick={() => void approve(tenant)}><Check size={16}/>Başvuruyu onayla</DropdownMenuItem><DropdownMenuItem onClick={() => confirmAction(tenant, "reject")}><X size={16}/>Başvuruyu reddet</DropdownMenuItem><DropdownMenuItem onClick={() => void flag(tenant)}><Flag size={16}/>{tenant.isSuspicious ? "Şüpheli işaretini kaldır" : "Şüpheli olarak işaretle"}</DropdownMenuItem></>}{tenant.status === "active" && <><DropdownMenuItem onClick={() => confirmAction(tenant, "suspend")}><ShieldOff size={16}/>Erişimi kapat</DropdownMenuItem><DropdownMenuItem onClick={() => void setupDocument(tenant)}><FileDown size={16}/>Kurulum belgesi</DropdownMenuItem></>}{tenant.status === "suspended" && <DropdownMenuItem onClick={() => confirmAction(tenant, "reopen")}><Check size={16}/>Erişimi aç</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></td></tr>) : <tr><td colSpan={8} className="sadmin-empty-state"><Building2 size={27}/><h3>{error ? "Kurum listesi alınamadı" : tenants.length ? "Eşleşen kurum bulunamadı" : "Henüz kurum başvurusu yok"}</h3><p>{tenants.length ? "Arama veya filtreleri değiştirerek tekrar deneyin." : "Yeni kurum başvuruları burada listelenir."}</p>{chips.length > 0 && <button className="sadmin-button" onClick={clearFilters}>Filtreleri temizle</button>}</td></tr>}</tbody></table></div>
        <footer className="sadmin-table-footer"><span>{filtered.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}` : "0"} / {filtered.length} kayıt</span><label className="sadmin-page-size">Sayfada<select aria-label="Sayfa başına kayıt" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}><option>5</option><option>10</option><option>25</option></select></label><nav aria-label="Kurum listesi sayfaları"><button disabled={currentPage === 1 || loading} aria-label="Önceki sayfa" onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15}/><span>Önceki</span></button>{Array.from({ length: pages }, (_, index) => index + 1).filter(n => n === 1 || n === pages || Math.abs(n - currentPage) <= 1).map((n, i, visible) => <span className="sadmin-page-number" key={n}>{i > 0 && n - visible[i - 1] > 1 && <span>…</span>}<button aria-label={`Sayfa ${n}`} aria-current={currentPage === n ? "page" : undefined} onClick={() => setPage(n)}>{n}</button></span>)}<button disabled={currentPage === pages || loading} aria-label="Sonraki sayfa" onClick={() => setPage(currentPage + 1)}><span>Sonraki</span><ChevronRight size={15}/></button></nav></footer>
      </section>
    </div>
    {selected && wide && <aside className="sadmin-detail-panel" aria-label={`${selected.name} ayrıntıları`}>{details}</aside>}
    <Dialog.Root open={Boolean(selected) && !wide} onOpenChange={value => { if (!value) closeDetails() }}><Dialog.Portal><Dialog.Overlay className="sadmin-modal-overlay"/><Dialog.Content className="sadmin-detail-panel sadmin-detail-sheet" onCloseAutoFocus={e => { e.preventDefault(); lastFocus.current?.focus() }}><Dialog.Title className="sr-only">{selected?.name} ayrıntıları</Dialog.Title><Dialog.Description className="sr-only">Kurum bilgileri, başvuru geçmişi ve yönetim işlemleri</Dialog.Description>{details}</Dialog.Content></Dialog.Portal></Dialog.Root>
    <Modal open={Boolean(confirmation)} onClose={() => { if (!busy) setConfirmation(null) }} title={confirmation?.action === "delete" ? "Kurumu kalıcı sil" : confirmation?.action === "reject" ? "Başvuruyu reddet" : confirmation?.action === "suspend" ? "Kurum erişimini kapat" : "Kurum erişimini aç"} description={confirmation?.tenant.name || ""}><div className="sadmin-modal-body"><p>{confirmation?.action === "delete" ? "Kurum ve kuruma bağlı veriler kalıcı olarak silinir. Bu işlem geri alınamaz." : confirmation?.action === "suspend" ? "Bu kuruma bağlı tüm kullanıcıların girişi engellenir ve mevcut oturumları kapatılır." : confirmation?.action === "reopen" ? "Kurumun ve bağlı kullanıcılarının girişine yeniden izin verilir." : "Bu başvuru reddedilecek; kurum hesabı oluşturulmayacak."}</p>{confirmation?.action === "reject" && <label className="sadmin-form-label">Red gerekçesi (isteğe bağlı)<textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="Başvuruya ilişkin gerekçe…"/></label>}{error && <p className="sadmin-alert" role="alert">{error}</p>}<div className="sadmin-modal-actions"><button className="sadmin-button" disabled={busy} onClick={() => setConfirmation(null)}>Vazgeç</button><button className={`sadmin-button ${confirmation?.action === "reopen" ? "sadmin-button-primary" : "sadmin-button-danger"}`} disabled={busy} onClick={() => void executeAction()}>{busy && <Loader2 className="animate-spin" size={16}/>}İşlemi onayla</button></div></div></Modal>
    <Modal open={Boolean(credentials)} onClose={() => setCredentials(null)} title="Kurum giriş bilgileri" description={credentials?.tenantName || ""}><div className="sadmin-modal-body"><p>Geçici parola ilk girişte değiştirilmelidir. Bu bilgileri yalnız kurumun yetkili kişisiyle paylaşın.</p><label className="sadmin-form-label">Kullanıcı adı<input readOnly value={credentials?.adminUsername || ""}/></label><label className="sadmin-form-label">Geçici parola<div className="sadmin-password-field"><input readOnly type={passwordVisible ? "text" : "password"} value={credentials?.temporaryPassword || ""}/><button className="sadmin-icon-button" aria-label={passwordVisible ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <p className="sadmin-alert" role="alert">{error}</p>}<div className="sadmin-modal-actions">{credentials?.setupDocumentBase64 && <button className="sadmin-button" onClick={() => downloadBase64File(credentials.setupDocumentBase64, credentials.setupDocumentFileName)}><FileDown size={16}/>Belgeyi indir</button>}<button className="sadmin-button sadmin-button-primary" onClick={async () => { if (!credentials) return; try { await navigator.clipboard.writeText(`Kurum: ${credentials.tenantName}\nKullanıcı adı: ${credentials.adminUsername}\nGeçici şifre: ${credentials.temporaryPassword}`); setCopied(true) } catch { setError("Giriş bilgileri kopyalanamadı.") } }}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Kopyalandı" : "Bilgileri kopyala"}</button></div></div></Modal>
    <Modal open={blockOpen} onClose={() => { if (!blockBusy) setBlockOpen(false) }} title="Kayıt engelleri" description="Engellenen e-posta alan adlarından veya IP adreslerinden yeni başvuru alınmaz." wide><div className="sadmin-modal-body">{blockError && <div className="sadmin-alert" role="alert">{blockError}<button onClick={() => void loadBlocks()}>Yeniden dene</button></div>}<form className="sadmin-block-form" onSubmit={async e => { e.preventDefault(); if (!blockValue.trim() || blockBusy) return; setBlockBusy(true); setBlockError(null); try { await apiRequest("/api/platformops/registration-blocklist", { method: "POST", body: { kind: blockKind, value: blockValue.trim(), reason: blockReason.trim() || null } }); setBlockValue(""); setBlockReason(""); await loadBlocks() } catch (err) { setBlockError(err instanceof Error ? err.message : "Kayıt engeli eklenemedi.") } finally { setBlockBusy(false) } }}><label className="sadmin-form-label">Engel türü<select value={blockKind} onChange={e => setBlockKind(e.target.value as "domain" | "ip")}><option value="domain">E-posta alan adı</option><option value="ip">IP adresi</option></select></label><label className="sadmin-form-label">Değer<input required value={blockValue} onChange={e => setBlockValue(e.target.value)} placeholder={blockKind === "domain" ? "ornek.com" : "203.0.113.7"}/></label><label className="sadmin-form-label">Gerekçe<input maxLength={500} value={blockReason} onChange={e => setBlockReason(e.target.value)}/></label><button className="sadmin-button sadmin-button-primary" disabled={blockBusy}><Plus size={16}/>Engel ekle</button></form><div className="sadmin-blocklist">{blockLoading ? <p>Engeller yükleniyor…</p> : blocklist.length ? blocklist.map(entry => <div key={entry.id}><div><strong>{entry.value}</strong><small>{entry.kind === "domain" ? "Alan adı" : "IP"} · {entry.reason || "Gerekçe belirtilmemiş"}</small><small>{entry.createdByName} · {formatDate(entry.createdAtUtc)}</small></div><button className="sadmin-icon-button" aria-label={`${entry.value} engelini kaldır`} disabled={blockBusy} onClick={async () => { setBlockBusy(true); setBlockError(null); try { await apiRequest(`/api/platformops/registration-blocklist/${entry.id}`, { method: "DELETE" }); setBlocklist(old => old.filter(item => item.id !== entry.id)) } catch (err) { setBlockError(err instanceof Error ? err.message : "Engel kaldırılamadı.") } finally { setBlockBusy(false) } }}><Trash2 size={16}/></button></div>) : <p>Henüz kayıt engeli yok.</p>}</div></div></Modal>
  </div>
}
