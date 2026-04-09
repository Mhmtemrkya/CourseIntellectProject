"use client"

import { useState } from "react"
import { useContent } from "@/context/content-context"
import { ContentSection } from "@/components/admin/content-editor/content-section"
import { TextInput } from "@/components/admin/content-editor/text-input"
import { TextArea } from "@/components/admin/content-editor/text-area"
import { NumberInput } from "@/components/admin/content-editor/number-input"
import { ListEditor } from "@/components/admin/content-editor/list-editor"
import { SaveIndicator } from "@/components/admin/content-editor/save-indicator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Save } from "lucide-react"
import Link from "next/link"

export default function PricingContentPage() {
  const { content, updateContent, saveContent, undoChange, history } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const pricing = content.pricing

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("pricing")
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
            <h1 className="text-2xl font-bold text-foreground">Fiyatlandırma İçerikleri</h1>
            <p className="text-muted-foreground mt-0.5">Paket ve fiyat bilgilerini düzenleyin</p>
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
        {/* Hero */}
        <ContentSection title="Sayfa Başlığı" description="Fiyatlar sayfası üst kısmı">
          <TextInput
            label="Başlık"
            value={pricing.hero.title}
            onChange={(v) =>
              updateContent("pricing", {
                ...pricing,
                hero: { ...pricing.hero, title: v },
              })
            }
          />
          <TextArea
            label="Alt Başlık"
            value={pricing.hero.subtitle}
            onChange={(v) =>
              updateContent("pricing", {
                ...pricing,
                hero: { ...pricing.hero, subtitle: v },
              })
            }
          />
        </ContentSection>

        {/* Toggle Labels */}
        <ContentSection title="Periyot Seçici" description="Aylık/Yıllık toggle etiketleri">
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput
              label="Aylık Etiketi"
              value={pricing.toggleLabels.monthly}
              onChange={(v) =>
                updateContent("pricing", {
                  ...pricing,
                  toggleLabels: { ...pricing.toggleLabels, monthly: v },
                })
              }
            />
            <TextInput
              label="Yıllık Etiketi"
              value={pricing.toggleLabels.yearly}
              onChange={(v) =>
                updateContent("pricing", {
                  ...pricing,
                  toggleLabels: { ...pricing.toggleLabels, yearly: v },
                })
              }
            />
            <TextInput
              label="İndirim Etiketi"
              value={pricing.toggleLabels.discount}
              onChange={(v) =>
                updateContent("pricing", {
                  ...pricing,
                  toggleLabels: { ...pricing.toggleLabels, discount: v },
                })
              }
            />
          </div>
        </ContentSection>

        {/* Plans */}
        <ContentSection title="Fiyat Paketleri" description="Tüm paketler ve özellikleri">
          <ListEditor
            label="Paketler"
            items={pricing.plans}
            onChange={(items) => updateContent("pricing", { ...pricing, plans: items })}
            itemLabel={(item) => `${item.name} - ${item.priceMonthly}TL/ay`}
            createNewItem={() => ({
              id: Date.now().toString(),
              name: "Yeni Paket",
              description: "Paket açıklaması",
              priceMonthly: 0,
              priceYearly: 0,
              features: ["Özellik 1"],
              isPopular: false,
              ctaText: "Başla",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="Paket Adı" value={item.name} onChange={(v) => updateItem({ ...item, name: v })} />
                  <TextInput
                    label="Buton Metni"
                    value={item.ctaText}
                    onChange={(v) => updateItem({ ...item, ctaText: v })}
                  />
                </div>
                <TextArea
                  label="Açıklama"
                  value={item.description}
                  onChange={(v) => updateItem({ ...item, description: v })}
                  rows={2}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <NumberInput
                    label="Aylık Fiyat"
                    value={item.priceMonthly}
                    onChange={(v) => updateItem({ ...item, priceMonthly: v })}
                    suffix="TL"
                  />
                  <NumberInput
                    label="Yıllık Fiyat (aylık)"
                    value={item.priceYearly}
                    onChange={(v) => updateItem({ ...item, priceYearly: v })}
                    suffix="TL"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`popular-${item.id}`}
                    checked={item.isPopular || false}
                    onChange={(e) => updateItem({ ...item, isPopular: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor={`popular-${item.id}`} className="text-sm">
                    Popüler olarak işaretle
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Özellikler</label>
                  {item.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const newFeatures = [...item.features]
                          newFeatures[idx] = e.target.value
                          updateItem({ ...item, features: newFeatures })
                        }}
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newFeatures = item.features.filter((_, i) => i !== idx)
                          updateItem({ ...item, features: newFeatures })
                        }}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateItem({ ...item, features: [...item.features, "Yeni özellik"] })}
                    className="text-sm text-primary hover:underline"
                  >
                    + Özellik ekle
                  </button>
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
