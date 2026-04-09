"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, MailOpen, Trash2, X, Reply, Star, StarOff, Archive, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

interface MessageData {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: "unread" | "read" | "replied" | "archived"
  isStarred: boolean
  createdAt: string
}

interface MessageListItemResponse {
  id: string
  name: string
  email: string
  subject: string
  status: string
  isStarred: boolean
  createdAt: string
  readAt?: string | null
  repliedAt?: string | null
}

interface MessageDetailResponse extends MessageListItemResponse {
  message: string
  ipAddress?: string | null
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

const statusConfig = {
  unread: { label: "Okunmamış", color: "bg-blue-100 text-blue-700", icon: Mail },
  read: { label: "Okundu", color: "bg-gray-100 text-gray-700", icon: MailOpen },
  replied: { label: "Yanıtlandı", color: "bg-green-100 text-green-700", icon: Reply },
  archived: { label: "Arşivde", color: "bg-yellow-100 text-yellow-700", icon: Archive },
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [selectedMessage, setSelectedMessage] = useState<MessageData | null>(null)
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "archived">("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const mapMessage = (item: MessageListItemResponse): MessageData => ({
    id: item.id,
    name: item.name,
    email: item.email,
    subject: item.subject,
    message: "",
    status: item.status.toLowerCase() as MessageData["status"],
    isStarred: item.isStarred,
    createdAt: new Date(item.createdAt).toLocaleString(),
  })

  const mapMessageDetail = (item: MessageDetailResponse): MessageData => ({
    id: item.id,
    name: item.name,
    email: item.email,
    subject: item.subject,
    message: item.message,
    status: item.status.toLowerCase() as MessageData["status"],
    isStarred: item.isStarred,
    createdAt: new Date(item.createdAt).toLocaleString(),
  })

  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await apiRequest<PagedResponse<MessageListItemResponse>>("/api/contactmessages", {
          query: { page: 1, pageSize: 100 },
        })
        setMessages(response.items.map(mapMessage))
      } catch (error) {
        setLoadError("Mesajlar yüklenemedi.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadMessages()
  }, [])

  const filteredMessages = messages.filter((msg) => {
    if (filter === "unread" && msg.status !== "unread") return false
    if (filter === "starred" && !msg.isStarred) return false
    if (filter === "archived" && msg.status !== "archived") return false
    if (filter === "all" && msg.status === "archived") return false
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        msg.name.toLowerCase().includes(searchLower) ||
        msg.email.toLowerCase().includes(searchLower) ||
        msg.subject.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const handleOpenMessage = async (msg: MessageData) => {
    try {
      let detail = await apiRequest<MessageDetailResponse>(`/api/contactmessages/${msg.id}`)
      if (detail.status?.toLowerCase() === "unread") {
        detail = await apiRequest<MessageDetailResponse>(`/api/contactmessages/${msg.id}/read`, {
          method: "PUT",
        })
      }

      const mapped = mapMessageDetail(detail)
      setSelectedMessage(mapped)
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...mapped } : m)))
    } catch (error) {
      setLoadError("Mesaj yüklenemedi.")
    }
  }

  const handleToggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const current = messages.find((msg) => msg.id === id)
    if (!current) return

    try {
      const updated = await apiRequest<MessageDetailResponse>(`/api/contactmessages/${id}/star`, {
        method: "PUT",
        body: {
          isStarred: !current.isStarred,
        },
      })
      const mapped = mapMessageDetail(updated)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...mapped } : m)))
      if (selectedMessage?.id === id) {
        setSelectedMessage(mapped)
      }
    } catch (error) {
      setLoadError("Mesaj güncellenemedi.")
    }
  }

  const handleMarkAsReplied = async (id: string) => {
    try {
      const updated = await apiRequest<MessageDetailResponse>(`/api/contactmessages/${id}/reply`, {
        method: "PUT",
      })
      const mapped = mapMessageDetail(updated)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...mapped } : m)))
      setSelectedMessage(null)
    } catch (error) {
      setLoadError("Mesaj güncellenemedi.")
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const updated = await apiRequest<MessageDetailResponse>(`/api/contactmessages/${id}/archive`, {
        method: "PUT",
      })
      const mapped = mapMessageDetail(updated)
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...mapped } : m)))
      setSelectedMessage(null)
    } catch (error) {
      setLoadError("Mesaj güncellenemedi.")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu mesaj silinsin mi?")) {
      return
    }

    try {
      await apiRequest(`/api/contactmessages/${id}`, {
        method: "DELETE",
      })
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setSelectedMessage((prev) => (prev?.id === id ? null : prev))
    } catch (error) {
      setLoadError("Mesaj silinemedi.")
    }
  }

  const stats = [
    { label: "Toplam", value: messages.filter((m) => m.status !== "archived").length, color: "bg-primary" },
    { label: "Okunmamış", value: messages.filter((m) => m.status === "unread").length, color: "bg-blue-500" },
    { label: "Yıldızlı", value: messages.filter((m) => m.isStarred).length, color: "bg-yellow-500" },
    { label: "Arşivde", value: messages.filter((m) => m.status === "archived").length, color: "bg-gray-500" },
  ]

  const filterButtons = [
    { key: "all", label: "Tümü" },
    { key: "unread", label: "Okunmamış" },
    { key: "starred", label: "Yıldızlı" },
    { key: "archived", label: "Arşiv" },
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mesajlar</h1>
        <p className="text-muted-foreground">İletişim formundan gelen mesajları yönetin</p>
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

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={filter === btn.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(btn.key)}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      <div className="flex-1 max-w-sm">
        <Input placeholder="Mesaj ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
    </div>

    {loadError && <p className="text-sm text-destructive">{loadError}</p>}
    {isLoading && <p className="text-sm text-muted-foreground">Mesajlar yükleniyor...</p>}

      {/* Messages List */}
      <Card>
        <CardContent className="p-0 divide-y">
          <AnimatePresence mode="popLayout">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((msg, index) => {
                const StatusIcon = statusConfig[msg.status].icon
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleOpenMessage(msg)}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      msg.status === "unread" && "bg-blue-50/50",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={(e) => handleToggleStar(msg.id, e)}
                        className="mt-1 text-muted-foreground hover:text-yellow-500 transition-colors"
                      >
                        {msg.isStarred ? (
                          <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                        ) : (
                          <StarOff className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("font-medium", msg.status === "unread" && "font-semibold")}>
                            {msg.name}
                          </span>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs", statusConfig[msg.status].color)}>
                            {statusConfig[msg.status].label}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-sm truncate",
                            msg.status === "unread" ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-1">{msg.message || "-"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {msg.createdAt}
                      </div>
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Mesaj bulunamadı</p>
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Message Detail Modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold">
                    {selectedMessage.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold">{selectedMessage.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedMessage.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-muted rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn("px-2 py-1 rounded-full text-xs", statusConfig[selectedMessage.status].color)}>
                    {statusConfig[selectedMessage.status].label}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedMessage.createdAt}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-4">{selectedMessage.subject}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArchive(selectedMessage.id)}
                    className="gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    Arşivle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedMessage.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Sil
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`)
                    }
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    E-posta Gönder
                  </Button>
                  <Button size="sm" onClick={() => handleMarkAsReplied(selectedMessage.id)} className="gap-2">
                    <Reply className="w-4 h-4" />
                    Yanıtlandı Olarak İşaretle
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
