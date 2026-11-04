"use client"

import { useState } from "react"
import { useContent } from "@/context/content-context"
import { ContentSection } from "@/components/admin/content-editor/content-section"
import { TextInput } from "@/components/admin/content-editor/text-input"
import { TextArea } from "@/components/admin/content-editor/text-area"
import { IconPicker } from "@/components/admin/content-editor/icon-picker"
import { ListEditor } from "@/components/admin/content-editor/list-editor"
import { SaveIndicator } from "@/components/admin/content-editor/save-indicator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Save } from "lucide-react"
import Link from "next/link"

export default function FeaturesContentPage() {
  const { content, updateContent, saveContent, undoChange, history } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const features = content.features

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("features")
      setSaveStatus("saved")
      setLastSaved(new Date())
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/icerik" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Özellikler Sayfası</h1>
            <p className="text-muted-foreground mt-0.5">Özellikler sayfasındaki içerikler</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
          <Button variant="outline" size="sm" onClick={undoChange} disabled={history.length === 0}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Geri Al
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Hero Section */}
        <ContentSection title="Sayfa Başlığı" description="Özellikler sayfası üst kısmı">
          <TextInput
            label="Başlık"
            value={features.hero.title}
            onChange={(v) =>
              updateContent("features", {
                ...features,
                hero: { ...features.hero, title: v },
              })
            }
            required
          />
          <TextArea
            label="Alt Başlık"
            value={features.hero.subtitle}
            onChange={(v) =>
              updateContent("features", {
                ...features,
                hero: { ...features.hero, subtitle: v },
              })
            }
          />
        </ContentSection>

        {/* Categories */}
        <ContentSection title="Kategoriler" description="Özellik filtreleme kategorileri">
          <ListEditor
            label="Kategoriler"
            items={features.categories}
            onChange={(items) => updateContent("features", { ...features, categories: items })}
            itemLabel={(item) => item.name}
            createNewItem={() => ({ id: Date.now().toString(), name: "Yeni Kategori" })}
            renderItem={(item, _, updateItem) => (
              <TextInput label="Kategori Adı" value={item.name} onChange={(v) => updateItem({ ...item, name: v })} />
            )}
          />
        </ContentSection>

        {/* Features Items */}
        <ContentSection title="Özellik Kartları" description="Tüm özellikler listesi">
          <ListEditor
            label="Özellikler"
            items={features.items}
            onChange={(items) => updateContent("features", { ...features, items })}
            itemLabel={(item) => item.title}
            createNewItem={() => ({
              id: Date.now().toString(),
              icon: "Star",
              title: "Yeni Özellik",
              description: "Açıklama",
              category: "all",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <IconPicker label="İkon" value={item.icon} onChange={(v) => updateItem({ ...item, icon: v })} />
                <TextInput label="Başlık" value={item.title} onChange={(v) => updateItem({ ...item, title: v })} />
                <TextArea
                  label="Açıklama"
                  value={item.description}
                  onChange={(v) => updateItem({ ...item, description: v })}
                  rows={2}
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Kategori</label>
                  <select
                    value={item.category || "all"}
                    onChange={(e) => updateItem({ ...item, category: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {features.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          />
        </ContentSection>
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-4 flex justify-end">
        <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-4">
          <SaveIndicator status={saveStatus} lastSaved={lastSaved} />
          <Button onClick={handleSave} disabled={saveStatus === "saving"}>
            <Save className="w-4 h-4 mr-2" />
            Değişiklikleri Kaydet
          </Button>
        </div>
      </div>
    </div>
  )
}
