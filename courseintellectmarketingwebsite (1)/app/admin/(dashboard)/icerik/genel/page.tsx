"use client"

import { useState } from "react"
import { useContent } from "@/context/content-context"
import { ContentSection } from "@/components/admin/content-editor/content-section"
import { TextInput } from "@/components/admin/content-editor/text-input"
import { TextArea } from "@/components/admin/content-editor/text-area"
import { ListEditor } from "@/components/admin/content-editor/list-editor"
import { SaveIndicator } from "@/components/admin/content-editor/save-indicator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Save, Download, Upload } from "lucide-react"
import Link from "next/link"

export default function GeneralContentPage() {
  const { content, updateContent, saveContent, undoChange, history, exportContent, importContent } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const navbar = content.navbar
  const footer = content.footer
  const general = content.general

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("general")
      setSaveStatus("saved")
      setLastSaved(new Date())
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    }
  }

  const handleExport = () => {
    const data = exportContent()
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `courseintellect-content-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          if (importContent(text)) {
            alert("İçerik başarıyla içe aktarıldı!")
          } else {
            alert("İçe aktarma hatası!")
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/icerik" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Genel Ayarlar</h1>
            <p className="text-muted-foreground mt-0.5">Navbar, footer ve site geneli içerikler</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Dışa Aktar
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-2" />
            İçe Aktar
          </Button>
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
        {/* Site General */}
        <ContentSection title="Site Bilgileri" description="SEO ve genel site ayarları">
          <TextInput
            label="Site Adı"
            value={general.siteName}
            onChange={(v) => updateContent("general", { ...general, siteName: v })}
          />
          <TextArea
            label="Site Açıklaması"
            value={general.siteDescription}
            onChange={(v) => updateContent("general", { ...general, siteDescription: v })}
            helperText="Arama motorları için meta açıklama"
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">Anahtar Kelimeler</label>
            <div className="flex flex-wrap gap-2">
              {general.siteKeywords.map((keyword, idx) => (
                <div key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-full text-sm">
                  <span>{keyword}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newKeywords = general.siteKeywords.filter((_, i) => i !== idx)
                      updateContent("general", { ...general, siteKeywords: newKeywords })
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const keyword = prompt("Yeni anahtar kelime:")
                  if (keyword) {
                    updateContent("general", {
                      ...general,
                      siteKeywords: [...general.siteKeywords, keyword],
                    })
                  }
                }}
                className="px-3 py-1.5 border border-dashed border-border rounded-full text-sm hover:bg-muted"
              >
                + Ekle
              </button>
            </div>
          </div>
        </ContentSection>

        {/* Navbar */}
        <ContentSection title="Navigasyon Çubuğu" description="Üst menü ayarları">
          <TextInput
            label="Logo Metni"
            value={navbar.logoText}
            onChange={(v) => updateContent("navbar", { ...navbar, logoText: v })}
          />
          <ListEditor
            label="Menü Linkleri"
            items={navbar.links}
            onChange={(items) => updateContent("navbar", { ...navbar, links: items })}
            itemLabel={(item) => item.label}
            createNewItem={() => ({ id: Date.now().toString(), label: "Yeni Link", href: "/" })}
            renderItem={(item, _, updateItem) => (
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Etiket" value={item.label} onChange={(v) => updateItem({ ...item, label: v })} />
                <TextInput label="Link" value={item.href} onChange={(v) => updateItem({ ...item, href: v })} />
              </div>
            )}
          />
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="text-sm font-medium">CTA Butonu</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Metin"
                value={navbar.ctaButton.text}
                onChange={(v) => updateContent("navbar", { ...navbar, ctaButton: { ...navbar.ctaButton, text: v } })}
              />
              <TextInput
                label="Link"
                value={navbar.ctaButton.href}
                onChange={(v) => updateContent("navbar", { ...navbar, ctaButton: { ...navbar.ctaButton, href: v } })}
              />
            </div>
          </div>
        </ContentSection>

        {/* Footer */}
        <ContentSection title="Alt Bilgi (Footer)" description="Footer bölümü ayarları">
          <TextArea
            label="Açıklama Metni"
            value={footer.description}
            onChange={(v) => updateContent("footer", { ...footer, description: v })}
            rows={3}
          />
          <TextInput
            label="Telif Hakkı Metni"
            value={footer.copyright}
            onChange={(v) => updateContent("footer", { ...footer, copyright: v })}
          />

          <ListEditor
            label="Link Bölümleri"
            items={footer.sections}
            onChange={(items) => updateContent("footer", { ...footer, sections: items })}
            itemLabel={(item) => item.title}
            createNewItem={() => ({ id: Date.now().toString(), title: "Yeni Bölüm", links: [] })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <TextInput
                  label="Bölüm Başlığı"
                  value={item.title}
                  onChange={(v) => updateItem({ ...item, title: v })}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Linkler</label>
                  {item.links.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const newLinks = [...item.links]
                          newLinks[idx] = { ...link, label: e.target.value }
                          updateItem({ ...item, links: newLinks })
                        }}
                        placeholder="Etiket"
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm"
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => {
                          const newLinks = [...item.links]
                          newLinks[idx] = { ...link, href: e.target.value }
                          updateItem({ ...item, links: newLinks })
                        }}
                        placeholder="Link"
                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = item.links.filter((_, i) => i !== idx)
                          updateItem({ ...item, links: newLinks })
                        }}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateItem({
                        ...item,
                        links: [...item.links, { id: Date.now().toString(), label: "Yeni link", href: "/" }],
                      })
                    }
                    className="text-sm text-primary hover:underline"
                  >
                    + Link ekle
                  </button>
                </div>
              </div>
            )}
          />

          <ListEditor
            label="Sosyal Medya Linkleri"
            items={footer.socialLinks}
            onChange={(items) => updateContent("footer", { ...footer, socialLinks: items })}
            itemLabel={(item) => item.platform}
            createNewItem={() => ({ id: Date.now().toString(), platform: "Twitter", url: "https://", icon: "Twitter" })}
            renderItem={(item, _, updateItem) => (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Platform</label>
                  <select
                    value={item.platform}
                    onChange={(e) => updateItem({ ...item, platform: e.target.value, icon: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-transparent"
                  >
                    <option value="Twitter">Twitter</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Linkedin">LinkedIn</option>
                    <option value="Youtube">YouTube</option>
                  </select>
                </div>
                <TextInput label="URL" value={item.url} onChange={(v) => updateItem({ ...item, url: v })} />
              </div>
            )}
          />

          <ListEditor
            label="Yasal Linkler"
            items={footer.legalLinks}
            onChange={(items) => updateContent("footer", { ...footer, legalLinks: items })}
            itemLabel={(item) => item.label}
            createNewItem={() => ({ id: Date.now().toString(), label: "Yeni Link", href: "/" })}
            renderItem={(item, _, updateItem) => (
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Etiket" value={item.label} onChange={(v) => updateItem({ ...item, label: v })} />
                <TextInput label="Link" value={item.href} onChange={(v) => updateItem({ ...item, href: v })} />
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
