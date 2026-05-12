"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Eye, Edit, Trash2, X, Check, Shield, GraduationCap, User, UserCog, Code2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable, type Column, type Action } from "@/components/admin/data-table"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

interface UserData {
  id: string
  name: string
  email: string
  phone?: string
  role: "developer" | "admin" | "editor" | "teacher" | "student" | "parent" | "accountant"
  status: "active" | "inactive" | "pending"
  createdAt: string
  lastLogin: string
}

interface UserListItemResponse {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
  lastLoginAt?: string | null
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

const roleLabels: Record<UserData["role"], { label: string; icon: React.ReactNode; color: string }> = {
  developer: { label: "Geliştirici", icon: <Code2 className="w-3 h-3" />, color: "bg-slate-900 text-white" },
  admin: { label: "Yönetici", icon: <Shield className="w-3 h-3" />, color: "bg-red-100 text-red-700" },
  editor: { label: "Editör", icon: <Edit className="w-3 h-3" />, color: "bg-yellow-100 text-yellow-700" },
  teacher: { label: "Öğretmen", icon: <UserCog className="w-3 h-3" />, color: "bg-blue-100 text-blue-700" },
  student: { label: "Öğrenci", icon: <GraduationCap className="w-3 h-3" />, color: "bg-green-100 text-green-700" },
  parent: { label: "Veli", icon: <User className="w-3 h-3" />, color: "bg-purple-100 text-purple-700" },
  accountant: { label: "Muhasebe", icon: <User className="w-3 h-3" />, color: "bg-orange-100 text-orange-700" },
}

function normalizeUserRole(role: string): UserData["role"] {
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

const statusLabels: Record<UserData["status"], { label: string; color: string }> = {
  active: { label: "Aktif", color: "bg-green-100 text-green-700" },
  inactive: { label: "Pasif", color: "bg-gray-100 text-gray-700" },
  pending: { label: "Beklemede", color: "bg-yellow-100 text-yellow-700" },
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [viewingUser, setViewingUser] = useState<UserData | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "student" as UserData["role"],
    status: "active" as UserData["status"],
    password: "",
  })

  const mapUser = (item: UserListItemResponse): UserData => {
    const role = normalizeUserRole(item.role)
    const status = item.isEmailVerified ? (item.isActive ? "active" : "inactive") : "pending"
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      role,
      status,
      createdAt: new Date(item.createdAt).toLocaleDateString(),
      lastLogin: item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleDateString() : "-",
    }
  }

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await apiRequest<PagedResponse<UserListItemResponse>>("/api/users", {
          query: { page: 1, pageSize: 200 },
        })
        setUsers(response.items.map(mapUser))
      } catch (error) {
        setLoadError("Kullanıcılar yüklenemedi.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadUsers()
  }, [])

  const columns: Column<UserData>[] = [
    {
      key: "name",
      label: "Ad Soyad",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
            {row.name.charAt(0)}
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    { key: "email", label: "E-posta", sortable: true },
    { key: "phone", label: "Telefon", sortable: false },
    {
      key: "role",
      label: "Rol",
      sortable: true,
      render: (value) => {
        const role = roleLabels[value as UserData["role"]] ?? roleLabels.student
        return (
          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", role.color)}>
            {role.icon}
            {role.label}
          </span>
        )
      },
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      render: (value) => {
        const status = statusLabels[value as UserData["status"]] ?? statusLabels.pending
        return <span className={cn("px-2 py-1 rounded-full text-xs font-medium", status.color)}>{status.label}</span>
      },
    },
    { key: "createdAt", label: "Kayıt Tarihi", sortable: true },
    { key: "lastLogin", label: "Son Giriş", sortable: true },
  ]

  const actions: Action<UserData>[] = [
    {
      label: "Görüntüle",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setViewingUser(row),
    },
    {
      label: "Düzenle",
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => {
        setEditingUser(row)
        setFormData({
          name: row.name,
          email: row.email,
          role: row.role,
          status: row.status,
          password: "",
        })
        setIsModalOpen(true)
      },
    },
    {
      label: "Sil",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (row) => {
        if (!confirm("Bu kullanıcı silinsin mi?")) {
          return
        }
        void (async () => {
          try {
            await apiRequest(`/api/users/${row.id}`, {
              method: "DELETE",
            })
            setUsers((prev) => prev.filter((u) => u.id !== row.id))
          } catch (error) {
            setLoadError("Kullanıcı silinemedi.")
          }
        })()
      },
      variant: "destructive",
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const isActive = formData.status === "active"
    const isEmailVerified = formData.status !== "pending"

    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          isActive,
          isEmailVerified,
        }
        if (formData.password) {
          payload.password = formData.password
        }

        const updated = await apiRequest<UserListItemResponse>(`/api/users/${editingUser.id}`, {
          method: "PUT",
          body: payload,
        })

        const mapped = mapUser(updated)
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? mapped : u)))
      } else {
        const created = await apiRequest<UserListItemResponse>("/api/users", {
          method: "POST",
          body: {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            isActive,
            isEmailVerified,
          },
        })

        setUsers((prev) => [mapUser(created), ...prev])
      }

      handleCloseModal()
    } catch (error) {
      setLoadError("Kullanıcı kaydedilemedi.")
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
    setFormData({ name: "", email: "", role: "student", status: "active", password: "" })
  }

  const stats = [
    { label: "Toplam", value: users.length, color: "bg-primary" },
    { label: "Aktif", value: users.filter((u) => u.status === "active").length, color: "bg-green-500" },
    { label: "Öğretmen", value: users.filter((u) => u.role === "teacher").length, color: "bg-blue-500" },
    { label: "Öğrenci", value: users.filter((u) => u.role === "student").length, color: "bg-accent" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kullanıcılar</h1>
          <p className="text-muted-foreground">Sistemdeki tüm kullanıcıları yönetin</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Kullanıcı
        </Button>
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
          {isLoading && <p className="text-sm text-muted-foreground mb-3">Kullanıcılar yükleniyor...</p>}
          <DataTable
            data={users}
            columns={columns}
            actions={actions}
            searchPlaceholder="Kullanıcı ara..."
            searchKeys={["name", "email"]}
            pageSize={10}
            emptyMessage="Kullanıcı bulunamadı"
          />
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-xl shadow-xl w-full max-w-md"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">{editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı"}</h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={editingUser ? "Mevcut şifreyi korumak için boş bırakın" : ""}
                    required={!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserData["role"] }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="admin">Yönetici</option>
                    <option value="editor">Editör</option>
                    <option value="teacher">Öğretmen</option>
                    <option value="student">Öğrenci</option>
<option value="parent">Veli</option>
<option value="accountant">Muhasebe</option>
</select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Durum</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as UserData["status"] }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                    <option value="pending">Beklemede</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseModal} className="flex-1 bg-transparent">
                    İptal
                  </Button>
                  <Button type="submit" className="flex-1 gap-2">
                    <Check className="w-4 h-4" />
                    {editingUser ? "Güncelle" : "Ekle"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-xl shadow-xl w-full max-w-md"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">Kullanıcı Detayı</h2>
                <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-2xl">
                    {viewingUser.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{viewingUser.name}</h3>
                    <p className="text-muted-foreground">{viewingUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Rol</p>
                    <p className="font-medium">{(roleLabels[viewingUser.role] ?? roleLabels.student).label}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Durum</p>
                    <p className="font-medium">{(statusLabels[viewingUser.status] ?? statusLabels.pending).label}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="font-medium">{viewingUser.phone || "-"}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Kayıt Tarihi</p>
                    <p className="font-medium">{viewingUser.createdAt}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Son Giriş</p>
                    <p className="font-medium">{viewingUser.lastLogin}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
