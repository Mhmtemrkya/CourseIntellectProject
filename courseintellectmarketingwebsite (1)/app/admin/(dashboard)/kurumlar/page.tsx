"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CheckCircle, XCircle, Eye, X, Clock, Copy, KeyRound, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTable, type Column, type Action } from "@/components/admin/data-table"
import { cn } from "@/lib/utils"
import { apiRequest, ApiRequestError } from "@/lib/api-client"

interface TenantData {
  id: string
  name: string
  email: string
  plan: string
  status: "active" | "pending" | "rejected"
  users: number
  branches: number
  monthlyFee: number
  createdAtUtc: string
  contactName?: string
  contactPhone?: string
  adminUsername?: string | null
  temporaryPassword?: string | null
}

interface TenantCredentials {
  tenantName: string
  adminUsername: string
  temporaryPassword: string
}

const statusConfig = {
  active: { label: "Aktif", color: "bg-green-100 text-green-700" },
  pending: { label: "Onay Bekliyor", color: "bg-yellow-100 text-yellow-700" },
  rejected: { label: "Reddedildi", color: "bg-red-100 text-red-700" },
}

const planConfig: Record<string, string> = {
  Starter: "bg-blue-100 text-blue-700",
  Business: "bg-purple-100 text-purple-700",
  Enterprise: "bg-orange-100 text-orange-700",
}

export default function KurumlarPage() {
  const [tenants, setTenants] = useState<TenantData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewingTenant, setViewingTenant] = useState<TenantData | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<TenantCredentials | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    const loadTenants = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const data = await apiRequest<TenantData[]>("/api/platformops/tenants")
        setTenants(data)
      } catch {
        setLoadError("Kurumlar yüklenemedi.")
      } finally {
        setIsLoading(false)
      }
    }
    void loadTenants()
  }, [])

  const handleApprove = async (tenant: TenantData) => {
    if (tenant.status !== "pending") return
    setActionLoading(tenant.id)
    setLoadError(null)
    try {
      const approved = await apiRequest<TenantData>(`/api/platformops/tenants/${tenant.id}/approve`, { method: "PUT" })
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, ...approved } : t)))
      setViewingTenant((current) => (current?.id === tenant.id ? { ...current, ...approved } : current))
      if (approved.adminUsername && approved.temporaryPassword) {
        setCopySuccess(false)
        setCreatedCredentials({
          tenantName: approved.name || tenant.name,
          adminUsername: approved.adminUsername,
          temporaryPassword: approved.temporaryPassword,
        })
      } else {
        setLoadError("Kurum onaylandı ancak giriş bilgileri API yanıtında dönmedi.")
      }
    } catch {
      setLoadError("Onay işlemi başarısız.")
    } finally {
      setActionLoading(null)
    }
  }

  const copyCredentials = async () => {
    if (!createdCredentials) return

    const credentialsText = [
      `Kurum: ${createdCredentials.tenantName}`,
      `Kullanıcı adı: ${createdCredentials.adminUsername}`,
      `Geçici şifre: ${createdCredentials.temporaryPassword}`,
    ].join("\n")

    try {
      await navigator.clipboard.writeText(credentialsText)
      setCopySuccess(true)
      window.setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      setLoadError("Giriş bilgileri kopyalanamadı. Lütfen ekrandan manuel alın.")
    }
  }

  const handleReject = async (tenant: TenantData) => {
    if (tenant.status !== "pending") return
    if (!confirm(`"${tenant.name}" kurumu reddedilsin mi?`)) return
    setActionLoading(tenant.id)
    try {
      await apiRequest(`/api/platformops/tenants/${tenant.id}/reject`, { method: "PUT" })
      setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, status: "rejected" } : t)))
    } catch {
      setLoadError("Red işlemi başarısız.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (tenant: TenantData) => {
    const confirmed = confirm(
      `"${tenant.name}" kurumu kalıcı olarak silinsin mi?\n\nBu işlem kurumu ve kuruma bağlı verileri veri tabanından siler. Geri alınamaz.`,
    )
    if (!confirmed) return

    setActionLoading(`delete:${tenant.id}`)
    setLoadError(null)
    try {
      await apiRequest(`/api/platformops/tenants/${tenant.id}`, { method: "DELETE" })
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id))
      setViewingTenant(null)
      setCreatedCredentials((current) => (current?.tenantName === tenant.name ? null : current))
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 404) {
        setLoadError("Kurum silinemedi: Canlı backend silme endpoint'ini henüz almamış olabilir. Backend deploy edilmeli.")
      } else if (err instanceof ApiRequestError && err.status === 401) {
        setLoadError("Kurum silinemedi: Admin oturumunuz düşmüş. Tekrar giriş yapın.")
      } else if (err instanceof ApiRequestError && err.status === 403) {
        setLoadError("Kurum silinemedi: Bu işlem için yetkiniz yok.")
      } else {
        setLoadError(err instanceof Error ? `Kurum silinemedi: ${err.message}` : "Kurum silinemedi.")
      }
    } finally {
      setActionLoading(null)
    }
  }

  const columns: Column<TenantData>[] = [
    {
      key: "name",
      label: "Kurum Adı",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      sortable: true,
      render: (value) => (
        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", planConfig[value as string] ?? "bg-gray-100 text-gray-700")}>
          {value as string}
        </span>
      ),
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      render: (value) => {
        const cfg = statusConfig[value as TenantData["status"]]
        return <span className={cn("px-2 py-1 rounded-full text-xs font-medium", cfg.color)}>{cfg.label}</span>
      },
    },
    { key: "users", label: "Kullanıcı", sortable: true },
    { key: "branches", label: "Şube", sortable: true },
    {
      key: "monthlyFee",
      label: "Aylık Tutar",
      sortable: true,
      render: (value) => <span className="font-medium">₺{Number(value || 0).toLocaleString("tr-TR")}</span>,
    },
    {
      key: "createdAtUtc",
      label: "Kayıt Tarihi",
      sortable: true,
      render: (value) => value ? new Date(String(value)).toLocaleDateString("tr-TR") : "-",
    },
  ]

  const actions: Action<TenantData>[] = [
    {
      label: "Görüntüle",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setViewingTenant(row),
    },
    {
      label: "Onayla",
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: (row) => void handleApprove(row),
      hidden: (row) => row.status !== "pending",
    },
    {
      label: "Reddet",
      icon: <XCircle className="w-4 h-4" />,
      onClick: (row) => void handleReject(row),
      variant: "destructive",
      hidden: (row) => row.status !== "pending",
    },
  ]

  const pendingCount = tenants.filter((t) => t.status === "pending").length
  const activeCount = tenants.filter((t) => t.status === "active").length
  const rejectedCount = tenants.filter((t) => t.status === "rejected").length

  const stats = [
    { label: "Toplam", value: tenants.length, color: "bg-primary" },
    { label: "Aktif", value: activeCount, color: "bg-green-500" },
    { label: "Onay Bekliyor", value: pendingCount, color: "bg-yellow-500" },
    { label: "Reddedildi", value: rejectedCount, color: "bg-red-500" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kurumlar</h1>
          <p className="text-muted-foreground">Platforma kayıtlı tüm kurumları yönetin</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
            <Clock className="w-4 h-4" />
            <span>{pendingCount} başvuru onay bekliyor</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("w-3 h-12 rounded-full", stat.color)} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-6">
          {loadError && <p className="text-sm text-destructive mb-3">{loadError}</p>}
          {isLoading && <p className="text-sm text-muted-foreground mb-3">Kurumlar yükleniyor...</p>}
          <DataTable
            data={tenants}
            columns={columns}
            actions={actions}
            searchPlaceholder="Kurum ara..."
            searchKeys={["name", "email", "plan"]}
            pageSize={10}
            emptyMessage="Kurum bulunamadı"
          />
        </CardContent>
      </Card>

      {/* View Modal */}
      {viewingTenant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingTenant(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl shadow-xl w-full max-w-md"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Kurum Detayı</h2>
              <button onClick={() => setViewingTenant(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Kurum Adı</p>
                  <p className="font-medium">{viewingTenant.name}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">E-posta</p>
                  <p className="font-medium text-sm">{viewingTenant.email}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{viewingTenant.plan}</p>
                </div>
                {viewingTenant.adminUsername && (
                  <div className="col-span-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Kurum Admin Kullanıcı Adı</p>
                    <p className="font-medium text-sm">{viewingTenant.adminUsername}</p>
                  </div>
                )}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Durum</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusConfig[viewingTenant.status].color)}>
                    {statusConfig[viewingTenant.status].label}
                  </span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Aylık Tutar</p>
                  <p className="font-medium">₺{Number(viewingTenant.monthlyFee || 0).toLocaleString("tr-TR")}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Kullanıcı</p>
                  <p className="font-medium">{viewingTenant.users}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Şube</p>
                  <p className="font-medium">{viewingTenant.branches}</p>
                </div>
              </div>
              {viewingTenant.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                    disabled={actionLoading === viewingTenant.id}
                    onClick={() => { void handleApprove(viewingTenant); setViewingTenant(null) }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Onayla
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2"
                    disabled={actionLoading === viewingTenant.id}
                    onClick={() => { void handleReject(viewingTenant); setViewingTenant(null) }}
                  >
                    <XCircle className="w-4 h-4" />
                    Reddet
                  </Button>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-3">
                  Kalıcı silme işlemi kurumu ve kuruma bağlı kayıtları veri tabanından kaldırır.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-600 hover:bg-red-50 gap-2"
                  disabled={actionLoading === `delete:${viewingTenant.id}`}
                  onClick={() => void handleDelete(viewingTenant)}
                >
                  <Trash2 className="w-4 h-4" />
                  {actionLoading === `delete:${viewingTenant.id}` ? "Siliniyor..." : "Kurumu Kalıcı Sil"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {createdCredentials && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setCreatedCredentials(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl shadow-xl w-full max-w-lg"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <KeyRound className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Kurum admini oluşturuldu</h2>
                  <p className="text-sm text-muted-foreground">{createdCredentials.tenantName}</p>
                </div>
              </div>
              <button onClick={() => setCreatedCredentials(null)} className="p-2 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Kullanıcı adı</p>
                  <p className="font-semibold break-all">{createdCredentials.adminUsername}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Geçici şifre</p>
                  <p className="font-semibold tracking-wide break-all">{createdCredentials.temporaryPassword}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Bu şifre sadece onay anında gösterilir. Kuruma iletin; ilk girişte yeni şifre belirlemesi istenecek.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button className="flex-1 gap-2" onClick={() => void copyCredentials()}>
                  <Copy className="w-4 h-4" />
                  {copySuccess ? "Kopyalandı" : "Bilgileri Kopyala"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setCreatedCredentials(null)}>
                  Tamam
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
