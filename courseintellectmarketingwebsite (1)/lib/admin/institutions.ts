export type TenantStatus = "active" | "pending" | "rejected" | "suspended"
export interface TenantData {
  id: string; name: string; email: string; status: TenantStatus; customerNumber?: string | null
  users: number; branches: number; createdAtUtc: string; institutionType?: string
  city?: string | null; district?: string | null; addressLine?: string | null; estimatedStudents?: number | null
  contactName?: string; contactTitle?: string | null; contactPhone?: string
  approvedAtUtc?: string | null; approvalEmailSentAtUtc?: string | null; verifiedAtUtc?: string | null
  rejectedAtUtc?: string | null; rejectionReason?: string | null; registrationCreatedAtUtc?: string | null
  adminUsername?: string | null; temporaryPassword?: string | null; setupDocumentBase64?: string | null; setupDocumentFileName?: string | null
  isSuspicious?: boolean; suspiciousReason?: string | null; verificationState?: "verified" | "awaiting" | "unproven"
}
export interface TenantFilters { search: string; status: string; type: string; city: string; date: string; from: string; to: string; verification: string; suspicious: boolean; sort: string }
export const emptyTenantFilters: TenantFilters = { search: "", status: "all", type: "all", city: "all", date: "all", from: "", to: "", verification: "all", suspicious: false, sort: "newest" }
export const statusLabels: Record<TenantStatus, string> = { active: "Aktif", pending: "Onay bekliyor", suspended: "Erişim kapalı", rejected: "Reddedildi" }
export const typeLabels: Record<string, string> = { PrivateSchool: "Özel okul", CourseCenter: "Kurs merkezi", DrivingSchool: "Sürücü kursu", StudyCenter: "Etüt merkezi", Other: "Diğer" }
export const registrationDate = (tenant: TenantData) => tenant.registrationCreatedAtUtc || tenant.createdAtUtc
export function filterTenants(tenants: TenantData[], filters: TenantFilters, now = new Date()) {
  const fold = (value: string) => value.toLocaleLowerCase("tr-TR").replaceAll("ı", "i")
  const search = fold(filters.search.trim())
  let from: number | null = null, to: number | null = null
  if (["7", "30", "90"].includes(filters.date)) {
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - Number(filters.date) + 1); from = start.getTime()
    const end = new Date(now); end.setHours(23, 59, 59, 999); to = end.getTime()
  } else if (filters.date === "custom") {
    if (filters.from) from = new Date(`${filters.from}T00:00:00`).getTime()
    if (filters.to) to = new Date(`${filters.to}T23:59:59.999`).getTime()
  }
  return tenants.filter(t => {
    const time = new Date(registrationDate(t)).getTime()
    return (!search || [t.name, t.email, t.customerNumber, t.contactName].some(value => value && fold(value).includes(search)))
      && (filters.status === "all" || t.status === filters.status)
      && (filters.type === "all" || t.institutionType === filters.type)
      && (filters.city === "all" || t.city === filters.city)
      && (filters.verification === "all" || (t.verificationState || "unproven") === filters.verification)
      && (!filters.suspicious || t.isSuspicious)
      && (from === null || time >= from) && (to === null || time <= to)
  }).sort((a, b) => filters.sort === "name" ? a.name.localeCompare(b.name, "tr-TR") : (new Date(registrationDate(a)).getTime() - new Date(registrationDate(b)).getTime()) * (filters.sort === "oldest" ? 1 : -1))
}
export function tenantCsv(tenants: TenantData[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "")
    // Prefix formula-like cells before quoting; untrusted names/email must stay text in Excel.
    return `"${(/^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`
  }
  const rows = [["Kurum", "E-posta", "Müşteri numarası", "Kurum türü", "İl", "Durum", "E-posta doğrulama", "Başvuru tarihi"], ...tenants.map(t => [t.name, t.email, t.customerNumber, typeLabels[t.institutionType || ""] || t.institutionType, t.city, statusLabels[t.status], t.verificationState === "verified" ? "Doğrulandı" : "Doğrulanmadı", registrationDate(t)])]
  return "\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n")
}
export function withoutCredentials(tenant: TenantData): TenantData {
  const { adminUsername: _username, temporaryPassword: _password, setupDocumentBase64: _document, setupDocumentFileName: _filename, ...safe } = tenant
  void _username; void _password; void _document; void _filename
  return safe
}
