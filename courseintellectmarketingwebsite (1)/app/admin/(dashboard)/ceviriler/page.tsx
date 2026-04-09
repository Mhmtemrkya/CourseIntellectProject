"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Save, RotateCcw, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useLanguage, defaultTranslations, type Language } from "@/context/language-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface TranslationItem {
  key: string
  tr: string
  en: string
  customTr?: string
  customEn?: string
}

const categories = [
  { id: "navbar", label: "Navigasyon" },
  { id: "hero", label: "Hero Bölümü" },
  { id: "stats", label: "İstatistikler" },
  { id: "features", label: "Özellikler" },
  { id: "platforms", label: "Platformlar" },
  { id: "howItWorks", label: "Nasıl Çalışır" },
  { id: "testimonials", label: "Referanslar" },
  { id: "faq", label: "SSS" },
  { id: "cta", label: "CTA" },
  { id: "footer", label: "Footer" },
  { id: "common", label: "Genel" },
]

export default function TranslationsPage() {
  const { language, customTranslations, saveCustomTranslations } = useLanguage()
  const { toast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState("navbar")
  const [searchQuery, setSearchQuery] = useState("")
  const [editedTranslations, setEditedTranslations] = useState<Record<string, { tr: string; en: string }>>({})
  const [isDirty, setIsDirty] = useState(false)

  // Build translation items from defaults and custom
  const getTranslationItems = (category: string): TranslationItem[] => {
    const defaultTr = (defaultTranslations.tr as Record<string, Record<string, string>>)[category] || {}
    const defaultEn = (defaultTranslations.en as Record<string, Record<string, string>>)[category] || {}
    const customTr = (customTranslations.tr as Record<string, Record<string, string>>)[category] || {}
    const customEn = (customTranslations.en as Record<string, Record<string, string>>)[category] || {}

    return Object.keys(defaultTr).map((key) => ({
      key: `${category}.${key}`,
      tr: defaultTr[key],
      en: defaultEn[key],
      customTr: customTr[key],
      customEn: customEn[key],
    }))
  }

  const handleTranslationChange = (fullKey: string, lang: Language, value: string) => {
    setEditedTranslations((prev) => ({
      ...prev,
      [fullKey]: {
        ...prev[fullKey],
        tr: lang === "tr" ? value : prev[fullKey]?.tr || "",
        en: lang === "en" ? value : prev[fullKey]?.en || "",
      },
    }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    const updates = Object.entries(editedTranslations).flatMap(([fullKey, values]) => [
      ...(values.tr ? [{ key: fullKey, language: "tr" as const, value: values.tr }] : []),
      ...(values.en ? [{ key: fullKey, language: "en" as const, value: values.en }] : []),
    ])

    try {
      await saveCustomTranslations(updates)
      setEditedTranslations({})
      setIsDirty(false)
      toast({
        title: "Kaydedildi",
        description: "Çeviriler başarıyla kaydedildi.",
      })
    } catch (error) {
      toast({
        title: "Hata",
        description: "Çeviriler kaydedilemedi.",
        variant: "destructive",
      })
    }
  }

  const handleReset = () => {
    setEditedTranslations({})
    setIsDirty(false)
    toast({
      title: "Sıfırlandı",
      description: "Değişiklikler geri alındı.",
    })
  }

  const items = getTranslationItems(selectedCategory)
  const filteredItems = items.filter(
    (item) =>
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.en.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çeviri Yönetimi</h1>
          <p className="text-muted-foreground">Site içeriklerinin Türkçe ve İngilizce çevirilerini düzenleyin</p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Sıfırla
            </Button>
          )}
          <Button onClick={handleSave} disabled={!isDirty}>
            <Save className="w-4 h-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Çeviri ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Translation Items */}
      <div className="grid gap-4">
        {filteredItems.map((item, index) => {
          const edited = editedTranslations[item.key]
          const currentTr = edited?.tr || item.customTr || item.tr
          const currentEn = edited?.en || item.customEn || item.en
          const hasTrCustom = item.customTr || edited?.tr
          const hasEnCustom = item.customEn || edited?.en

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono text-muted-foreground">{item.key}</CardTitle>
                    <div className="flex gap-1">
                      {hasTrCustom && (
                        <Badge variant="outline" className="text-xs">
                          TR Özel
                        </Badge>
                      )}
                      {hasEnCustom && (
                        <Badge variant="outline" className="text-xs">
                          EN Özel
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Turkish */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-6 h-4 rounded bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-700">
                          TR
                        </span>
                        Türkçe
                      </Label>
                      {item.tr.length > 100 ? (
                        <Textarea
                          value={currentTr}
                          onChange={(e) => handleTranslationChange(item.key, "tr", e.target.value)}
                          rows={3}
                          className={cn(hasTrCustom && "border-accent")}
                        />
                      ) : (
                        <Input
                          value={currentTr}
                          onChange={(e) => handleTranslationChange(item.key, "tr", e.target.value)}
                          className={cn(hasTrCustom && "border-accent")}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">Varsayılan: {item.tr}</p>
                    </div>

                    {/* English */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <span className="w-6 h-4 rounded bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-700">
                          EN
                        </span>
                        İngilizce
                      </Label>
                      {item.en.length > 100 ? (
                        <Textarea
                          value={currentEn}
                          onChange={(e) => handleTranslationChange(item.key, "en", e.target.value)}
                          rows={3}
                          className={cn(hasEnCustom && "border-accent")}
                        />
                      ) : (
                        <Input
                          value={currentEn}
                          onChange={(e) => handleTranslationChange(item.key, "en", e.target.value)}
                          className={cn(hasEnCustom && "border-accent")}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">Varsayılan: {item.en}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Bu kategoride çeviri bulunamadı.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
