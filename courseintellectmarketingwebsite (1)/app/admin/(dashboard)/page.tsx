"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, BookOpen, TrendingUp, MessageSquare, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { apiRequest } from "@/lib/api-client"

interface DashboardStatsResponse {
  totalUsers: number
  activeUsers: number
  totalCourses: number
  activeCourses: number
  totalMessages: number
  unreadMessages: number
  totalRegistrations: number
  pendingRegistrations: number
  totalLoginAttempts: number
  failedLoginAttempts: number
}

interface DashboardActivityResponse {
  id: string
  userId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  ipAddress?: string | null
  timestamp: string
}

const quickLinks = [
  { label: "Anasayfa İçeriği", href: "/admin/icerik/anasayfa" },
  { label: "Fiyatları Düzenle", href: "/admin/icerik/fiyatlar" },
  { label: "Mesajları Görüntüle", href: "/admin/mesajlar" },
  { label: "Kullanıcı Ekle", href: "/admin/kullanicilar" },
]
export default function AdminDashboard() {
  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null)
  const [activities, setActivities] = useState<DashboardActivityResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [statsResponse, activityResponse] = await Promise.all([
          apiRequest<DashboardStatsResponse>("/api/dashboard/stats"),
          apiRequest<DashboardActivityResponse[]>("/api/dashboard/activities", {
            query: { limit: 10 },
          }),
        ])

        setStatsData(statsResponse)
        setActivities(activityResponse)
      } catch (error) {
        setLoadError("Kontrol paneli verileri yüklenemedi.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const formatAction = (action: string) => {
    const normalized = action.replace(/_/g, " ").toLowerCase()
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const stats = [
    {
      title: "Toplam Kullanıcı",
      value: statsData?.totalUsers.toLocaleString() ?? "0",
      change: "",
      trend: "up",
      icon: Users,
    },
    {
      title: "Aktif Kurs",
      value: statsData?.activeCourses.toLocaleString() ?? "0",
      change: "",
      trend: "up",
      icon: BookOpen,
    },
    {
      title: "Giriş Denemeleri",
      value: statsData?.totalLoginAttempts.toLocaleString() ?? "0",
      change: "",
      trend: "up",
      icon: TrendingUp,
    },
    {
      title: "Okunmamış Mesajlar",
      value: statsData?.unreadMessages.toLocaleString() ?? "0",
      change: "",
      trend: "down",
      icon: MessageSquare,
    },
  ]

  const recentActivities = activities.map((activity) => ({
    id: activity.id,
    action: formatAction(activity.action),
    user: activity.entityType || "Sistem",
    time: new Date(activity.timestamp).toLocaleString(),
  }))
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kontrol Paneli</h1>
        <p className="text-muted-foreground">Hoş geldiniz! İşte güncel site durumu.</p>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Kontrol paneli yükleniyor...</p>}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm font-medium ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}
                    >
                      {stat.change}
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle>Son Aktiviteler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle>Hızlı Erişim</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{link.label}</span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
