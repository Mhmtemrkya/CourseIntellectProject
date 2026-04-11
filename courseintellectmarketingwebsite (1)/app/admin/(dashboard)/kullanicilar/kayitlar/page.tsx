"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { tr, enUS } from "date-fns/locale"
import {
  Search,
  GraduationCap,
  Users,
  BookOpen,
  Calculator,
  Shield,
  Edit,
  Code2,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/context/language-context"
import type { UserRegistration, UserRole } from "@/types/user"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

type AdminPanelRole = UserRole | "developer"
type AdminPanelRegistration = Omit<UserRegistration, "role"> & { role: AdminPanelRole }

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


interface RegistrationResponse {
  id: string
  userId: string
  email: string
  name: string
  role: string
  isVerified: boolean
  registeredAt: string
  verifiedAt?: string | null
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

export default function RegistrationsPage() {
  const { language } = useLanguage()
  const [registrations, setRegistrations] = useState<AdminPanelRegistration[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const t = {
    title: { tr: "Kayıt Listesi", en: "Registration List" },
    description: { tr: "Sisteme kayıt olan kullanıcıları görüntüleyin", en: "View registered users" },
    search: { tr: "İsim veya e-posta ara...", en: "Search name or email..." },
    allRoles: { tr: "Tüm Roller", en: "All Roles" },
    name: { tr: "Ad Soyad", en: "Full Name" },
    email: { tr: "E-posta", en: "Email" },
    role: { tr: "Rol", en: "Role" },
    status: { tr: "Doğrulama", en: "Verification" },
    date: { tr: "Kayıt Tarihi", en: "Registration Date" },
    refresh: { tr: "Yenile", en: "Refresh" },
    noData: { tr: "Kayıt bulunamadı", en: "No registrations found" },
    total: { tr: "Toplam Kayıt", en: "Total Registrations" },
    verified: { tr: "Doğrulanmış", en: "Verified" },
    pending: { tr: "Beklemede", en: "Pending" },
  }

  const loadData = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const response = await apiRequest<PagedResponse<RegistrationResponse>>("/api/users/registrations", {
        query: { page: 1, pageSize: 200 },
      })

      const mapped = response.items.map((reg) => ({
        id: reg.id,
        userId: reg.userId,
        email: reg.email,
        name: reg.name,
        role: normalizeRole(reg.role),
        registeredAt: reg.registeredAt,
        isVerified: reg.isVerified,
      }))

      setRegistrations(mapped)
    } catch (error) {
      setLoadError("Kayıtlar yüklenemedi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch =
      reg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || reg.role === roleFilter
    return matchesSearch && matchesRole
  })

  const verifiedCount = registrations.filter((r) => r.isVerified).length

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
            <p className="text-3xl font-bold">{registrations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.verified[language]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{verifiedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t.pending[language]}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{registrations.length - verifiedCount}</p>
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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loadError && <div className="text-sm text-destructive mb-3">{loadError}</div>}
          {isLoading && <div className="text-sm text-muted-foreground mb-3">Yükleniyor...</div>}
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t.noData[language]}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name[language]}</TableHead>
                  <TableHead>{t.email[language]}</TableHead>
                  <TableHead>{t.role[language]}</TableHead>
                  <TableHead>{t.status[language]}</TableHead>
                  <TableHead>{t.date[language]}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg, index) => {
                  const RoleIcon = roleIcons[reg.role]
                  return (
                    <motion.tr
                      key={reg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b"
                    >
                      <TableCell className="font-medium">{reg.name}</TableCell>
                      <TableCell>{reg.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("gap-1", roleColors[reg.role])}>
                          <RoleIcon className="w-3 h-3" />
                          {roleLabels[reg.role][language]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.isVerified ? (
                          <Badge className="bg-green-100 text-green-700 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.verified[language]}
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 gap-1">
                            <Clock className="w-3 h-3" />
                            {t.pending[language]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(reg.registeredAt), "PPpp", {
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
