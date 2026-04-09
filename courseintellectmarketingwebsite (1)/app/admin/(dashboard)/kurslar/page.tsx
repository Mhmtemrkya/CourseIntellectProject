"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { BookOpen, Plus, Eye, Edit, Trash2, X, Check, Users, Clock, BarChart3, PlayCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTable, type Column, type Action } from "@/components/admin/data-table"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

interface CourseData {
  id: string
  title: string
  instructor: string
  category: string
  students: number
  lessons: number
  duration: string
  status: "active" | "draft" | "archived"
  rating: number
  createdAt: string
}

interface CourseResponse {
  id: string
  name: string
  description?: string | null
  category?: string | null
  price?: number | null
  duration?: string | null
  level?: string | null
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
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

const statusLabels: Record<CourseData["status"], { label: string; color: string }> = {
  active: { label: "Yayında", color: "bg-green-100 text-green-700" },
  draft: { label: "Taslak", color: "bg-yellow-100 text-yellow-700" },
  archived: { label: "Arşivde", color: "bg-gray-100 text-gray-700" },
}

const categories = ["Matematik", "Fizik", "Kimya", "Biyoloji", "Türkçe", "İngilizce", "Tarih", "Coğrafya"]

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseData | null>(null)
  const [viewingCourse, setViewingCourse] = useState<CourseData | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    instructor: "",
    category: "Matematik",
    lessons: 0,
    duration: "",
    status: "draft" as CourseData["status"],
  })

  const mapCourse = (item: CourseResponse): CourseData => ({
    id: item.id,
    title: item.name,
    instructor: item.level || "-",
    category: item.category || "-",
    students: 0,
    lessons: 0,
    duration: item.duration || "-",
    status: item.isActive ? "active" : "archived",
    rating: 0,
    createdAt: new Date(item.createdAt).toLocaleDateString(),
  })

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await apiRequest<PagedResponse<CourseResponse>>("/api/courses", {
          query: { page: 1, pageSize: 200 },
        })
        setCourses(response.items.map(mapCourse))
      } catch (error) {
        setLoadError("Kurslar yüklenemedi.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadCourses()
  }, [])

  const columns: Column<CourseData>[] = [
    {
      key: "title",
      label: "Kurs Adı",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="font-medium">{row.title}</p>
            <p className="text-xs text-muted-foreground">{row.instructor}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Kategori",
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">{value as string}</span>
      ),
    },
    {
      key: "students",
      label: "Öğrenci",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span>{value as number}</span>
        </div>
      ),
    },
    {
      key: "lessons",
      label: "Ders",
      sortable: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <PlayCircle className="w-4 h-4 text-muted-foreground" />
          <span>{row.lessons} ders</span>
        </div>
      ),
    },
    {
      key: "duration",
      label: "Süre",
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>{row.duration}</span>
        </div>
      ),
    },
    {
      key: "rating",
      label: "Puan",
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">★</span>
          <span>{(value as number) > 0 ? (value as number).toFixed(1) : "-"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      render: (value) => {
        const status = statusLabels[value as CourseData["status"]]
        return <span className={cn("px-2 py-1 rounded-full text-xs font-medium", status.color)}>{status.label}</span>
      },
    },
  ]

  const actions: Action<CourseData>[] = [
    {
      label: "Görüntüle",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setViewingCourse(row),
    },
    {
      label: "Düzenle",
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => {
        setEditingCourse(row)
        setFormData({
          title: row.title,
          instructor: row.instructor,
          category: row.category,
          lessons: row.lessons,
          duration: row.duration,
          status: row.status,
        })
        setIsModalOpen(true)
      },
    },
    {
      label: "Sil",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (row) => {
        if (!confirm("Bu kurs silinsin mi?")) {
          return
        }
        void (async () => {
          try {
            await apiRequest(`/api/courses/${row.id}`, {
              method: "DELETE",
            })
            setCourses((prev) => prev.filter((c) => c.id !== row.id))
          } catch (error) {
            setLoadError("Kurs silinemedi.")
          }
        })()
      },
      variant: "destructive",
    },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      name: formData.title,
      category: formData.category,
      duration: formData.duration,
      level: formData.instructor,
      isActive: formData.status === "active",
    }

    try {
      if (editingCourse) {
        const updated = await apiRequest<CourseResponse>(`/api/courses/${editingCourse.id}`, {
          method: "PUT",
          body: payload,
        })
        setCourses((prev) => prev.map((c) => (c.id === editingCourse.id ? mapCourse(updated) : c)))
      } else {
        const created = await apiRequest<CourseResponse>("/api/courses", {
          method: "POST",
          body: payload,
        })
        setCourses((prev) => [mapCourse(created), ...prev])
      }

      handleCloseModal()
    } catch (error) {
      setLoadError("Kurs kaydedilemedi.")
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCourse(null)
    setFormData({ title: "", instructor: "", category: "Matematik", lessons: 0, duration: "", status: "draft" })
  }

  const stats = [
    { label: "Toplam Kurs", value: courses.length, icon: BookOpen, color: "text-primary" },
    {
      label: "Yayında",
      value: courses.filter((c) => c.status === "active").length,
      icon: PlayCircle,
      color: "text-green-500",
    },
    {
      label: "Toplam Öğrenci",
      value: courses.reduce((sum, c) => sum + c.students, 0),
      icon: Users,
      color: "text-accent",
    },
    {
      label: "Toplam Ders",
      value: courses.reduce((sum, c) => sum + c.lessons, 0),
      icon: BarChart3,
      color: "text-blue-500",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kurslar</h1>
          <p className="text-muted-foreground">Tüm kursları görüntüleyin ve yönetin</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Kurs
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl bg-muted flex items-center justify-center", stat.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-6">
          {loadError && <p className="text-sm text-destructive mb-3">{loadError}</p>}
          {isLoading && <p className="text-sm text-muted-foreground mb-3">Kurslar yükleniyor...</p>}
          <DataTable
            data={courses}
            columns={columns}
            actions={actions}
            searchPlaceholder="Kurs ara..."
            searchKeys={["title", "instructor", "category"]}
            pageSize={10}
            emptyMessage="Kurs bulunamadı"
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
                <h2 className="text-lg font-semibold">{editingCourse ? "Kurs Düzenle" : "Yeni Kurs"}</h2>
                <button onClick={handleCloseModal} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Kurs Adı</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructor">Eğitmen</Label>
                  <Input
                    id="instructor"
                    value={formData.instructor}
                    onChange={(e) => setFormData((prev) => ({ ...prev, instructor: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Durum</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, status: e.target.value as CourseData["status"] }))
                      }
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="draft">Taslak</option>
                      <option value="active">Yayında</option>
                      <option value="archived">Arşivde</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lessons">Ders Sayısı</Label>
                    <Input
                      id="lessons"
                      type="number"
                      min={0}
                      value={formData.lessons}
                      onChange={(e) => setFormData((prev) => ({ ...prev, lessons: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Toplam Süre</Label>
                    <Input
                      id="duration"
                      placeholder="Örn: 24 saat"
                      value={formData.duration}
                      onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseModal} className="flex-1 bg-transparent">
                    İptal
                  </Button>
                  <Button type="submit" className="flex-1 gap-2">
                    <Check className="w-4 h-4" />
                    {editingCourse ? "Güncelle" : "Ekle"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewingCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingCourse(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-xl shadow-xl w-full max-w-lg"
            >
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-semibold">Kurs Detayı</h2>
                <button onClick={() => setViewingCourse(null)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-accent/20 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{viewingCourse.title}</h3>
                    <p className="text-muted-foreground">{viewingCourse.instructor}</p>
                    <span
                      className={cn(
                        "inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium",
                        statusLabels[viewingCourse.status].color,
                      )}
                    >
                      {statusLabels[viewingCourse.status].label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <Users className="w-6 h-6 mx-auto text-accent mb-2" />
                    <p className="text-2xl font-bold">{viewingCourse.students}</p>
                    <p className="text-xs text-muted-foreground">Öğrenci</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <PlayCircle className="w-6 h-6 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">{viewingCourse.lessons}</p>
                    <p className="text-xs text-muted-foreground">Ders</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <Clock className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{viewingCourse.duration}</p>
                    <p className="text-xs text-muted-foreground">Toplam Süre</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <span className="text-2xl text-yellow-500">★</span>
                    <p className="text-2xl font-bold">
                      {viewingCourse.rating > 0 ? viewingCourse.rating.toFixed(1) : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">Puan</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
                  <span>Kategori: {viewingCourse.category}</span>
                  <span>Oluşturulma: {viewingCourse.createdAt}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
