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

export default function DownloadContentPage() {
  const { content, updateContent, saveContent, undoChange, history } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const download = content.download

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("download")
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
            <h1 className="text-2xl font-bold text-foreground">İndir Sayfası</h1>
            <p className="text-muted-foreground mt-0.5">Platform ve sürüm bilgileri</p>
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
        <ContentSection title="Sayfa Başlığı">
          <TextInput
            label="Başlık"
            value={download.hero.title}
            onChange={(v) =>
              updateContent("download", {
                ...download,
                hero: { ...download.hero, title: v },
              })
            }
          />
          <TextArea
            label="Alt Başlık"
            value={download.hero.subtitle}
            onChange={(v) =>
              updateContent("download", {
                ...download,
                hero: { ...download.hero, subtitle: v },
              })
            }
          />
        </ContentSection>

        {/* Platforms */}
        <ContentSection title="Platformlar" description="İndirme seçenekleri">
          <ListEditor
            label="Platform Kartları"
            items={download.platforms}
            onChange={(items) => updateContent("download", { ...download, platforms: items })}
            itemLabel={(item) => item.name}
            createNewItem={() => ({
              id: Date.now().toString(),
              name: "Yeni Platform",
              description: "Açıklama",
              icon: "Monitor",
              downloadUrl: "#",
              version: "1.0.0",
              requirements: [],
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="Platform Adı"
                    value={item.name}
                    onChange={(v) => updateItem({ ...item, name: v })}
                  />
                  <TextInput label="Sürüm" value={item.version} onChange={(v) => updateItem({ ...item, version: v })} />
                </div>
                <IconPicker label="İkon" value={item.icon} onChange={(v) => updateItem({ ...item, icon: v })} />
                <TextArea
                  label="Açıklama"
                  value={item.description}
                  onChange={(v) => updateItem({ ...item, description: v })}
                />
                <TextInput
                  label="İndirme Linki"
                  value={item.downloadUrl}
                  onChange={(v) => updateItem({ ...item, downloadUrl: v })}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sistem Gereksinimleri</label>
                  {item.requirements.map((req, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={req}
                        onChange={(e) => {
                          const newReqs = [...item.requirements]
                          newReqs[idx] = e.target.value
                          updateItem({ ...item, requirements: newReqs })
                        }}
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newReqs = item.requirements.filter((_, i) => i !== idx)
                          updateItem({ ...item, requirements: newReqs })
                        }}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateItem({ ...item, requirements: [...item.requirements, "Yeni gereksinim"] })}
                    className="text-sm text-primary hover:underline"
                  >
                    + Gereksinim ekle
                  </button>
                </div>
              </div>
            )}
          />
        </ContentSection>

        {/* Version Notes */}
        <ContentSection title="Sürüm Notları" description="Güncelleme geçmişi">
          <TextInput
            label="Bölüm Başlığı"
            value={download.versionNotes.title}
            onChange={(v) =>
              updateContent("download", {
                ...download,
                versionNotes: { ...download.versionNotes, title: v },
              })
            }
          />
          <ListEditor
            label="Sürüm Geçmişi"
            items={download.versionNotes.notes}
            onChange={(items) =>
              updateContent("download", {
                ...download,
                versionNotes: { ...download.versionNotes, notes: items },
              })
            }
            itemLabel={(item) => `v${item.version} - ${item.date}`}
            createNewItem={() => ({
              version: "1.0.0",
              date: new Date().toLocaleDateString("tr-TR"),
              changes: ["Yeni özellik"],
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput label="Sürüm" value={item.version} onChange={(v) => updateItem({ ...item, version: v })} />
                  <TextInput label="Tarih" value={item.date} onChange={(v) => updateItem({ ...item, date: v })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Değişiklikler</label>
                  {item.changes.map((change, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={change}
                        onChange={(e) => {
                          const newChanges = [...item.changes]
                          newChanges[idx] = e.target.value
                          updateItem({ ...item, changes: newChanges })
                        }}
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newChanges = item.changes.filter((_, i) => i !== idx)
                          updateItem({ ...item, changes: newChanges })
                        }}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateItem({ ...item, changes: [...item.changes, "Yeni değişiklik"] })}
                    className="text-sm text-primary hover:underline"
                  >
                    + Değişiklik ekle
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
