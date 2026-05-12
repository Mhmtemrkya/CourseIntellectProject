"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { tr, enUS } from "date-fns/locale"
import {
  Search,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Users,
  BookOpen,
  Calculator,
  Shield,
  Edit,
  Code2,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/context/language-context"
import type { LoginAttempt, UserRole } from "@/types/user"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

type AdminPanelRole = UserRole | "developer"
type AdminPanelLoginAttempt = Omit<LoginAttempt, "role"> & { role: AdminPanelRole }

const roleIcons: Record<AdminPanelRole, typeof GraduationCap> = {
  developer: Code2,
  student: GraduationCap,
  parent: Users,
  teacher: BookOpen,
  accountant: Calculator,
  admin: Shield,
  editor: Edit,
}

const roleColors: Record<AdminPanelRole, string> = {
  developer: "bg-slate-900 text-white",
  student: "bg-blue-100 text-blue-700",
  parent: "bg-green-100 text-green-700",
  teacher: "bg-purple-100 text-purple-700",
  accountant: "bg-orange-100 text-orange-700",
  admin: "bg-red-100 text-red-700",
  editor: "bg-yellow-100 text-yellow-700",
}

const roleLabels: Record<AdminPanelRole, { tr: string; en: string }> = {
  developer: { tr: "Geliştirici", en: "Developer" },
  student: { tr: "Öğrenci", en: "Student" },
  parent: { tr: "Veli", en: "Parent" },
  teacher: { tr: "Öğretmen", en: "Teacher" },
  accountant: { tr: "Muhasebeci", en: "Accountant" },
  admin: { tr: "Admin", en: "Admin" },
  editor: { tr: "Editör", en: "Editor" },
}

function normalizeRole(role: string): AdminPanelRole {
  switch (role.toLowerCase()) {
    case "developer":
      return "developer"
    case "admin":
      return "admin"
    case "editor":
      return "editor"
    case "teacher":
      return "teacher"
    case "student":
      return "student"
    case "parent":
      return "parent"
    case "accounting":
    case "accountant":
      return "accountant"
    default:
      return "student"
  }
}

interface LoginAttemptResponse {
  id: string
  userId?: string | null
  email: string
  role: string
  success: boolean
  ipAddress?: string | null
  userAgent?: string | null
  deviceId?: string | null
  timestamp: string
}

interface LoginAttemptStatsResponse {
  total: number
  successCount: number
  failedCount: number
  successRate: number
}

interface PagedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export default function LoginAttemptsPage() {
  const { language } = useLanguage()
  const [loginAttempts, setLoginAttempts] = useState<AdminPanelLoginAttempt[]>([])
  const [stats, setStats] = useState<LoginAttemptStatsResponse>({
    total: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const t = {
    title: { tr: "Giriş Kayıtları", en: "Login Records" },
    description: { tr: "Kullanıcı girişi denemelerini görüntüleyin", en: "View user login attempts" },
    search: { tr: "E-posta ara...", en: "Search email..." },
    allRoles: { tr: "Tüm Roller", en: "All Roles" },
    allStatus: { tr: "Tüm Durumlar", en: "All Statuses" },
    successful: { tr: "Başarılı", en: "Successful" },
    failed: { tr: "Başarısız", en: "Failed" },
    email: { tr: "E-posta", en: "Email" },
    role: { tr: "Rol", en: "Role" },
    status: { tr: "Durum", en: "Status" },
    date: { tr: "Tarih", en: "Date" },
    refresh: { tr: "Yenile", en: "Refresh" },
    noData: { tr: "Giriş kaydı bulunamadı", en: "No login records found" },
    total: { tr: "Toplam", en: "Total" },
    successRate: { tr: "Başarı Oranı", en: "Success Rate" },
  }

  const loadData = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [listResponse, statsResponse] = await Promise.all([
        apiRequest<PagedResponse<LoginAttemptResponse>>("/api/loginattempts", {
          query: { page: 1, pageSize: 200 },
        }),
        apiRequest<LoginAttemptStatsResponse>("/api/loginattempts/stats"),
      ])

      const mapped = listResponse.items.map((attempt) => ({
        id: attempt.id,
        userId: attempt.userId || "",
        email: attempt.email,
        role: normalizeRole(attempt.role),
        timestamp: attempt.timestamp,
        success: attempt.success,
        ipAddress: attempt.ipAddress || undefined,
        userAgent: attempt.userAgent || undefined,
      }))

      setLoginAttempts(mapped)
      setStats(statsResponse)
    } catch (error) {
      setLoadError("Giriş denemeleri yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredAttempts = loginAttempts.filter((attempt) => {
    const matchesSearch = attempt.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || attempt.role === roleFilter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "success" && attempt.success) ||
      (statusFilter === "failed" && !attempt.success)
    return matchesSearch && matchesRole && matchesStatus
  })

  const successCount = stats.successCount
  const successRate = stats.successRate

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.title[language]}</h1>
          <p className="text-muted-foreground">{t.description[language]}</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t.refresh[language]}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.total[language]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.successful[language]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.successRate[language]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{successRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          {loadError && <div className="text-sm text-destructive mb-3">{loadError}</div>}
          {isLoading && <div className="text-sm text-muted-foreground mb-3">Yükleniyor...</div>}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.search[language]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t.allRoles[language]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allRoles[language]}</SelectItem>
                {Object.entries(roleLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t.allStatus[language]} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatus[language]}</SelectItem>
                <SelectItem value="success">{t.successful[language]}</SelectItem>
                <SelectItem value="failed">{t.failed[language]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loadError && <div className="text-sm text-destructive mb-3">{loadError}</div>}
          {isLoading && <div className="text-sm text-muted-foreground mb-3">Yükleniyor...</div>}
          {filteredAttempts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t.noData[language]}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.email[language]}</TableHead>
                  <TableHead>{t.role[language]}</TableHead>
                  <TableHead>{t.status[language]}</TableHead>
                  <TableHead>{t.date[language]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.map((attempt, index) => {
                  const RoleIcon = roleIcons[attempt.role]
                  return (
                    <motion.tr
                      key={attempt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b"
                    >
                      <TableCell className="font-medium">{attempt.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("gap-1", roleColors[attempt.role])}>
                          <RoleIcon className="w-3 h-3" />
                          {roleLabels[attempt.role][language]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {attempt.success ? (
                          <Badge className="bg-green-100 text-green-700 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.successful[language]}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 gap-1">
                            <XCircle className="w-3 h-3" />
                            {t.failed[language]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(attempt.timestamp), "PPpp", {
                          locale: language === "tr" ? tr : enUS,
                        })}
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
