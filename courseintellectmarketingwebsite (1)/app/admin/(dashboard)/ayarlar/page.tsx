"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Settings, User, Lock, Bell, Palette, Globe, Save, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api-client"

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

interface SettingResponse {
  key: string
  value?: string | null
  type?: string | null
  category?: string | null
}

const sections: SettingsSection[] = [
  { id: "profile", title: "Profil", description: "Hesap bilgilerinizi düzenleyin", icon: <User className="w-5 h-5" /> },
  { id: "security", title: "Güvenlik", description: "Şifre ve oturum ayarları", icon: <Lock className="w-5 h-5" /> },
  {
    id: "notifications",
    title: "Bildirimler",
    description: "Bildirim tercihlerinizi yönetin",
    icon: <Bell className="w-5 h-5" />,
  },
  {
    id: "appearance",
    title: "Görünüm",
    description: "Tema ve görünüm ayarları",
    icon: <Palette className="w-5 h-5" />,
  },
  { id: "site", title: "Site Ayarları", description: "Genel site yapılandırması", icon: <Globe className="w-5 h-5" /> },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile")
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Profile state
  const [profile, setProfile] = useState({
    name: "Admin Kullanıcı",
    email: "admin@courseintellect.com",
    phone: "+90 555 123 4567",
    bio: "CourseIntellect sistem yöneticisi",
  })

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactor: false,
    sessionTimeout: "30",
  })

  // Notification state
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newUserAlert: true,
    newMessageAlert: true,
    weeklyReport: true,
    marketingEmails: false,
  })

  // Appearance state
  const [appearance, setAppearance] = useState({
    theme: "light",
    sidebarCollapsed: false,
    compactMode: false,
    animationsEnabled: true,
  })

  // Site state
  const [site, setSite] = useState({
    siteName: "CourseIntellect",
    siteDescription: "Eğitimde yeni nesil deneyim",
    maintenanceMode: false,
    registrationEnabled: true,
    maxUploadSize: "10",
  })

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await apiRequest<SettingResponse[]>("/api/appsettings")
        const settingMap = new Map(settings.map((item) => [item.key, item.value ?? ""]))
        const getValue = (key: string, fallback: string) => settingMap.get(key) || fallback
        const getBoolean = (key: string, fallback: boolean) => {
          if (!settingMap.has(key)) return fallback
          const raw = settingMap.get(key) ?? ""
          return raw === "true" || raw === "1"
        }

        setProfile((prev) => ({
          ...prev,
          name: getValue("profile.name", prev.name),
          email: getValue("profile.email", prev.email),
          phone: getValue("profile.phone", prev.phone),
          bio: getValue("profile.bio", prev.bio),
        }))

        setSecurity((prev) => ({
          ...prev,
          twoFactor: getBoolean("security.twofactor", prev.twoFactor),
          sessionTimeout: getValue("security.sessiontimeout", prev.sessionTimeout),
        }))

        setNotifications((prev) => ({
          ...prev,
          emailNotifications: getBoolean("notifications.emailnotifications", prev.emailNotifications),
          pushNotifications: getBoolean("notifications.pushnotifications", prev.pushNotifications),
          newUserAlert: getBoolean("notifications.newuseralert", prev.newUserAlert),
          newMessageAlert: getBoolean("notifications.newmessagealert", prev.newMessageAlert),
          weeklyReport: getBoolean("notifications.weeklyreport", prev.weeklyReport),
          marketingEmails: getBoolean("notifications.marketingemails", prev.marketingEmails),
        }))

        setAppearance((prev) => ({
          ...prev,
          theme: getValue("appearance.theme", prev.theme),
          sidebarCollapsed: getBoolean("appearance.sidebarcollapsed", prev.sidebarCollapsed),
          compactMode: getBoolean("appearance.compactmode", prev.compactMode),
          animationsEnabled: getBoolean("appearance.animationsenabled", prev.animationsEnabled),
        }))

        setSite((prev) => ({
          ...prev,
          siteName: getValue("site.sitename", prev.siteName),
          siteDescription: getValue("site.sitedescription", prev.siteDescription),
          maintenanceMode: getBoolean("site.maintenancemode", prev.maintenanceMode),
          registrationEnabled: getBoolean("site.registrationenabled", prev.registrationEnabled),
          maxUploadSize: getValue("site.maxuploadsize", prev.maxUploadSize),
        }))
      } catch (error) {
        console.error("Settings load failed:", error)
      }
    }

    void loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = [
        { key: "profile.name", value: profile.name, type: "string", category: "profile" },
        { key: "profile.email", value: profile.email, type: "string", category: "profile" },
        { key: "profile.phone", value: profile.phone, type: "string", category: "profile" },
        { key: "profile.bio", value: profile.bio, type: "string", category: "profile" },
        { key: "security.twoFactor", value: String(security.twoFactor), type: "boolean", category: "security" },
        { key: "security.sessionTimeout", value: security.sessionTimeout, type: "number", category: "security" },
        {
          key: "notifications.emailNotifications",
          value: String(notifications.emailNotifications),
          type: "boolean",
          category: "notifications",
        },
        {
          key: "notifications.pushNotifications",
          value: String(notifications.pushNotifications),
          type: "boolean",
          category: "notifications",
        },
        { key: "notifications.newUserAlert", value: String(notifications.newUserAlert), type: "boolean", category: "notifications" },
        {
          key: "notifications.newMessageAlert",
          value: String(notifications.newMessageAlert),
          type: "boolean",
          category: "notifications",
        },
        { key: "notifications.weeklyReport", value: String(notifications.weeklyReport), type: "boolean", category: "notifications" },
        {
          key: "notifications.marketingEmails",
          value: String(notifications.marketingEmails),
          type: "boolean",
          category: "notifications",
        },
        { key: "appearance.theme", value: appearance.theme, type: "string", category: "appearance" },
        {
          key: "appearance.sidebarCollapsed",
          value: String(appearance.sidebarCollapsed),
          type: "boolean",
          category: "appearance",
        },
        { key: "appearance.compactMode", value: String(appearance.compactMode), type: "boolean", category: "appearance" },
        {
          key: "appearance.animationsEnabled",
          value: String(appearance.animationsEnabled),
          type: "boolean",
          category: "appearance",
        },
        { key: "site.siteName", value: site.siteName, type: "string", category: "site" },
        { key: "site.siteDescription", value: site.siteDescription, type: "string", category: "site" },
        { key: "site.maintenanceMode", value: String(site.maintenanceMode), type: "boolean", category: "site" },
        { key: "site.registrationEnabled", value: String(site.registrationEnabled), type: "boolean", category: "site" },
        { key: "site.maxUploadSize", value: site.maxUploadSize, type: "number", category: "site" },
      ]

      await apiRequest<SettingResponse[]>("/api/appsettings", {
        method: "PUT",
        body: payload,
      })
    } catch (error) {
      console.error("Settings save failed:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent text-2xl font-bold">
                {profile.name.charAt(0)}
              </div>
              <div>
                <Button variant="outline" size="sm">
                  Fotoğraf Değiştir
                </Button>
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG veya GIF. Maksimum 2MB.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Ad Soyad</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Hakkında</Label>
              <textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              />
            </div>
          </div>
        )

      case "security":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Şifre Değiştir</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mevcut Şifre</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? "text" : "password"}
                      value={security.currentPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Yeni Şifre</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={security.newPassword}
                      onChange={(e) => setSecurity((prev) => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={security.confirmPassword}
                    onChange={(e) => setSecurity((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-medium">Güvenlik Ayarları</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">İki Faktörlü Doğrulama</p>
                  <p className="text-xs text-muted-foreground">Ekstra güvenlik katmanı ekleyin</p>
                </div>
                <Switch
                  checked={security.twoFactor}
                  onCheckedChange={(checked) => setSecurity((prev) => ({ ...prev, twoFactor: checked }))}
                />
              </div>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="sessionTimeout">Oturum Zaman Aşımı (dakika)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min={5}
                  max={120}
                  value={security.sessionTimeout}
                  onChange={(e) => setSecurity((prev) => ({ ...prev, sessionTimeout: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Genel Bildirimler</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">E-posta Bildirimleri</p>
                    <p className="text-xs text-muted-foreground">Önemli güncellemeler için e-posta alın</p>
                  </div>
                  <Switch
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, emailNotifications: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Push Bildirimleri</p>
                    <p className="text-xs text-muted-foreground">Tarayıcı bildirimleri alın</p>
                  </div>
                  <Switch
                    checked={notifications.pushNotifications}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, pushNotifications: checked }))}
                  />
                </div>
              </div>
            </div>
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-medium">Aktivite Bildirimleri</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Yeni Kullanıcı Kaydı</p>
                    <p className="text-xs text-muted-foreground">Yeni kullanıcı kaydolduğunda bildir</p>
                  </div>
                  <Switch
                    checked={notifications.newUserAlert}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, newUserAlert: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Yeni Mesaj</p>
                    <p className="text-xs text-muted-foreground">İletişim formu mesajlarını bildir</p>
                  </div>
                  <Switch
                    checked={notifications.newMessageAlert}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, newMessageAlert: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Haftalık Rapor</p>
                    <p className="text-xs text-muted-foreground">Her hafta özet rapor gönder</p>
                  </div>
                  <Switch
                    checked={notifications.weeklyReport}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, weeklyReport: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Pazarlama E-postaları</p>
                    <p className="text-xs text-muted-foreground">Kampanya ve duyurular</p>
                  </div>
                  <Switch
                    checked={notifications.marketingEmails}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, marketingEmails: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "appearance":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Tema</h3>
              <div className="grid grid-cols-3 gap-4 max-w-md">
                {["light", "dark", "system"].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setAppearance((prev) => ({ ...prev, theme }))}
                    className={cn(
                      "p-4 rounded-lg border-2 text-center transition-colors",
                      appearance.theme === theme
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50",
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full mx-auto mb-2",
                        theme === "light"
                          ? "bg-white border"
                          : theme === "dark"
                            ? "bg-gray-900"
                            : "bg-gradient-to-r from-white to-gray-900",
                      )}
                    />
                    <span className="text-sm font-medium capitalize">
                      {theme === "light" ? "Açık" : theme === "dark" ? "Koyu" : "Sistem"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-medium">Arayüz Ayarları</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Varsayılan Kapalı Sidebar</p>
                    <p className="text-xs text-muted-foreground">Sidebar varsayılan olarak daraltılmış başlasın</p>
                  </div>
                  <Switch
                    checked={appearance.sidebarCollapsed}
                    onCheckedChange={(checked) => setAppearance((prev) => ({ ...prev, sidebarCollapsed: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Kompakt Mod</p>
                    <p className="text-xs text-muted-foreground">Daha az boşluk kullan</p>
                  </div>
                  <Switch
                    checked={appearance.compactMode}
                    onCheckedChange={(checked) => setAppearance((prev) => ({ ...prev, compactMode: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Animasyonlar</p>
                    <p className="text-xs text-muted-foreground">Geçiş animasyonlarını etkinleştir</p>
                  </div>
                  <Switch
                    checked={appearance.animationsEnabled}
                    onCheckedChange={(checked) => setAppearance((prev) => ({ ...prev, animationsEnabled: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "site":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium">Genel Bilgiler</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Adı</Label>
                  <Input
                    id="siteName"
                    value={site.siteName}
                    onChange={(e) => setSite((prev) => ({ ...prev, siteName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUpload">Maksimum Yükleme Boyutu (MB)</Label>
                  <Input
                    id="maxUpload"
                    type="number"
                    min={1}
                    max={100}
                    value={site.maxUploadSize}
                    onChange={(e) => setSite((prev) => ({ ...prev, maxUploadSize: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteDescription">Site Açıklaması</Label>
                <textarea
                  id="siteDescription"
                  value={site.siteDescription}
                  onChange={(e) => setSite((prev) => ({ ...prev, siteDescription: e.target.value }))}
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                />
              </div>
            </div>
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-medium">Site Durumu</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Bakım Modu</p>
                    <p className="text-xs text-muted-foreground">Siteyi geçici olarak kapatın</p>
                  </div>
                  <Switch
                    checked={site.maintenanceMode}
                    onCheckedChange={(checked) => setSite((prev) => ({ ...prev, maintenanceMode: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Kullanıcı Kaydı</p>
                    <p className="text-xs text-muted-foreground">Yeni kullanıcı kayıtlarına izin ver</p>
                  </div>
                  <Switch
                    checked={site.registrationEnabled}
                    onCheckedChange={(checked) => setSite((prev) => ({ ...prev, registrationEnabled: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
          <p className="text-muted-foreground">Hesap ve sistem ayarlarınızı yönetin</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Settings className="w-4 h-4" />
              </motion.div>
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Kaydet
            </>
          )}
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    activeSection === section.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {section.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="text-xs truncate opacity-70">{section.description}</p>
                  </div>
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content Area */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{sections.find((s) => s.id === activeSection)?.title}</CardTitle>
            <CardDescription>{sections.find((s) => s.id === activeSection)?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderSection()}
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
