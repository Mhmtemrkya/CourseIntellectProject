"use client"

import { useState } from "react"
import { useContent } from "@/context/content-context"
import { ContentSection } from "@/components/admin/content-editor/content-section"
import { TextInput } from "@/components/admin/content-editor/text-input"
import { TextArea } from "@/components/admin/content-editor/text-area"
import { NumberInput } from "@/components/admin/content-editor/number-input"
import { IconPicker } from "@/components/admin/content-editor/icon-picker"
import { ListEditor } from "@/components/admin/content-editor/list-editor"
import { SaveIndicator } from "@/components/admin/content-editor/save-indicator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Save } from "lucide-react"
import Link from "next/link"

export default function HomepageContentPage() {
  const { content, updateContent, saveContent, undoChange, history } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const homepage = content.homepage

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("homepage")
      setSaveStatus("saved")
      setLastSaved(new Date())
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    }
  }

  const updateHero = (field: string, value: unknown) => {
    updateContent("homepage", {
      ...homepage,
      hero: { ...homepage.hero, [field]: value },
    })
  }

  const updateStats = (stats: typeof homepage.stats) => {
    updateContent("homepage", { ...homepage, stats })
  }

  const updateFeatures = (items: typeof homepage.features.items) => {
    updateContent("homepage", {
      ...homepage,
      features: { ...homepage.features, items },
    })
  }

  const updateHowItWorks = (steps: typeof homepage.howItWorks.steps) => {
    updateContent("homepage", {
      ...homepage,
      howItWorks: { ...homepage.howItWorks, steps },
    })
  }

  const updateTestimonials = (items: typeof homepage.testimonials.items) => {
    updateContent("homepage", {
      ...homepage,
      testimonials: { ...homepage.testimonials, items },
    })
  }

  const updateFAQ = (items: typeof homepage.faq.items) => {
    updateContent("homepage", {
      ...homepage,
      faq: { ...homepage.faq, items },
    })
  }

  const updateFinalCTA = (field: string, value: unknown) => {
    updateContent("homepage", {
      ...homepage,
      finalCTA: { ...homepage.finalCTA, [field]: value },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/icerik" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Anasayfa İçerikleri</h1>
            <p className="text-muted-foreground mt-0.5">Anasayfadaki tüm metinleri düzenleyin</p>
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
        <ContentSection title="Hero Bölümü" description="Ana başlık ve butonlar">
          <TextInput
            label="Badge Metni"
            value={homepage.hero.badge || ""}
            onChange={(v) => updateHero("badge", v)}
            maxLength={50}
            helperText="Hero üstündeki küçük etiket"
          />
          <TextInput
            label="Başlık"
            value={homepage.hero.title}
            onChange={(v) => updateHero("title", v)}
            maxLength={100}
            required
          />
          <TextArea
            label="Alt Başlık"
            value={homepage.hero.subtitle}
            onChange={(v) => updateHero("subtitle", v)}
            maxLength={300}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium">Birincil Buton</h4>
              <TextInput
                label="Metin"
                value={homepage.hero.primaryCTA.text}
                onChange={(v) => updateHero("primaryCTA", { ...homepage.hero.primaryCTA, text: v })}
              />
              <TextInput
                label="Link"
                value={homepage.hero.primaryCTA.href}
                onChange={(v) => updateHero("primaryCTA", { ...homepage.hero.primaryCTA, href: v })}
              />
            </div>
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium">İkincil Buton</h4>
              <TextInput
                label="Metin"
                value={homepage.hero.secondaryCTA.text}
                onChange={(v) => updateHero("secondaryCTA", { ...homepage.hero.secondaryCTA, text: v })}
              />
              <TextInput
                label="Link"
                value={homepage.hero.secondaryCTA.href}
                onChange={(v) => updateHero("secondaryCTA", { ...homepage.hero.secondaryCTA, href: v })}
              />
            </div>
          </div>
        </ContentSection>

        {/* Stats Section */}
        <ContentSection title="İstatistikler" description="Güven oluşturan sayılar">
          <ListEditor
            label="İstatistik Kartları"
            items={homepage.stats}
            onChange={updateStats}
            itemLabel={(item) => `${item.value}${item.suffix || ""} - ${item.label}`}
            createNewItem={() => ({ id: Date.now().toString(), value: 0, label: "Yeni İstatistik", suffix: "+" })}
            renderItem={(item, _, updateItem) => (
              <div className="grid gap-4 md:grid-cols-3">
                <NumberInput label="Değer" value={item.value} onChange={(v) => updateItem({ ...item, value: v })} />
                <TextInput label="Etiket" value={item.label} onChange={(v) => updateItem({ ...item, label: v })} />
                <TextInput
                  label="Sonek"
                  value={item.suffix || ""}
                  onChange={(v) => updateItem({ ...item, suffix: v })}
                  placeholder="örn: +, K, %"
                />
              </div>
            )}
          />
        </ContentSection>

        {/* Features Section */}
        <ContentSection title="Özellikler" description="Özellik kartları">
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <TextInput
              label="Bölüm Başlığı"
              value={homepage.features.sectionTitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  features: { ...homepage.features, sectionTitle: v },
                })
              }
            />
            <TextInput
              label="Bölüm Alt Başlığı"
              value={homepage.features.sectionSubtitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  features: { ...homepage.features, sectionSubtitle: v },
                })
              }
            />
          </div>
          <ListEditor
            label="Özellik Kartları"
            items={homepage.features.items}
            onChange={updateFeatures}
            itemLabel={(item) => item.title}
            createNewItem={() => ({
              id: Date.now().toString(),
              icon: "Star",
              title: "Yeni Özellik",
              description: "Özellik açıklaması",
              category: "all",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <IconPicker label="İkon" value={item.icon} onChange={(v) => updateItem({ ...item, icon: v })} />
                <TextInput
                  label="Başlık"
                  value={item.title}
                  onChange={(v) => updateItem({ ...item, title: v })}
                  required
                />
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
                    <option value="all">Tümü</option>
                    <option value="teacher">Öğretmen</option>
                    <option value="student">Öğrenci</option>
                    <option value="parent">Veli</option>
                    <option value="admin">Yönetim</option>
                  </select>
                </div>
              </div>
            )}
          />
        </ContentSection>

        {/* How It Works Section */}
        <ContentSection title="Nasıl Çalışır" description="Adım adım süreç">
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <TextInput
              label="Bölüm Başlığı"
              value={homepage.howItWorks.sectionTitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  howItWorks: { ...homepage.howItWorks, sectionTitle: v },
                })
              }
            />
            <TextInput
              label="Bölüm Alt Başlığı"
              value={homepage.howItWorks.sectionSubtitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  howItWorks: { ...homepage.howItWorks, sectionSubtitle: v },
                })
              }
            />
          </div>
          <ListEditor
            label="Adımlar"
            items={homepage.howItWorks.steps}
            onChange={(items) => updateHowItWorks(items.map((item, i) => ({ ...item, step: i + 1 })))}
            itemLabel={(item) => `${item.step}. ${item.title}`}
            createNewItem={() => ({
              id: Date.now().toString(),
              step: homepage.howItWorks.steps.length + 1,
              title: "Yeni Adım",
              description: "Adım açıklaması",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <TextInput
                  label="Başlık"
                  value={item.title}
                  onChange={(v) => updateItem({ ...item, title: v })}
                  required
                />
                <TextArea
                  label="Açıklama"
                  value={item.description}
                  onChange={(v) => updateItem({ ...item, description: v })}
                  rows={2}
                />
              </div>
            )}
          />
        </ContentSection>

        {/* Testimonials Section */}
        <ContentSection title="Kullanıcı Yorumları" description="Referans yorumları">
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <TextInput
              label="Bölüm Başlığı"
              value={homepage.testimonials.sectionTitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  testimonials: { ...homepage.testimonials, sectionTitle: v },
                })
              }
            />
            <TextInput
              label="Bölüm Alt Başlığı"
              value={homepage.testimonials.sectionSubtitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  testimonials: { ...homepage.testimonials, sectionSubtitle: v },
                })
              }
            />
          </div>
          <ListEditor
            label="Yorumlar"
            items={homepage.testimonials.items}
            onChange={updateTestimonials}
            itemLabel={(item) => item.name}
            createNewItem={() => ({
              id: Date.now().toString(),
              name: "Ad Soyad",
              role: "Unvan",
              company: "",
              quote: "Yorum metni",
              avatar: "",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="İsim"
                    value={item.name}
                    onChange={(v) => updateItem({ ...item, name: v })}
                    required
                  />
                  <TextInput label="Unvan / Rol" value={item.role} onChange={(v) => updateItem({ ...item, role: v })} />
                </div>
                <TextInput
                  label="Şirket/Kurum"
                  value={item.company || ""}
                  onChange={(v) => updateItem({ ...item, company: v })}
                />
                <TextArea
                  label="Yorum"
                  value={item.quote}
                  onChange={(v) => updateItem({ ...item, quote: v })}
                  rows={3}
                  required
                />
                <TextInput
                  label="Avatar URL"
                  value={item.avatar || ""}
                  onChange={(v) => updateItem({ ...item, avatar: v })}
                  placeholder="https://..."
                />
              </div>
            )}
          />
        </ContentSection>

        {/* FAQ Section */}
        <ContentSection title="Sıkça Sorulan Sorular" description="SSS bölümü">
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <TextInput
              label="Bölüm Başlığı"
              value={homepage.faq.sectionTitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  faq: { ...homepage.faq, sectionTitle: v },
                })
              }
            />
            <TextInput
              label="Bölüm Alt Başlığı"
              value={homepage.faq.sectionSubtitle}
              onChange={(v) =>
                updateContent("homepage", {
                  ...homepage,
                  faq: { ...homepage.faq, sectionSubtitle: v },
                })
              }
            />
          </div>
          <ListEditor
            label="Sorular"
            items={homepage.faq.items}
            onChange={updateFAQ}
            itemLabel={(item) => item.question}
            createNewItem={() => ({
              id: Date.now().toString(),
              question: "Yeni soru?",
              answer: "Cevap metni",
            })}
            renderItem={(item, _, updateItem) => (
              <div className="space-y-4">
                <TextInput
                  label="Soru"
                  value={item.question}
                  onChange={(v) => updateItem({ ...item, question: v })}
                  required
                />
                <TextArea
                  label="Cevap"
                  value={item.answer}
                  onChange={(v) => updateItem({ ...item, answer: v })}
                  rows={4}
                  required
                />
              </div>
            )}
          />
        </ContentSection>

        {/* Final CTA Section */}
        <ContentSection title="CTA Bölümü" description="Sayfa sonu aksiyon çağrısı">
          <TextInput
            label="Başlık"
            value={homepage.finalCTA.title}
            onChange={(v) => updateFinalCTA("title", v)}
            required
          />
          <TextArea
            label="Alt Başlık"
            value={homepage.finalCTA.subtitle}
            onChange={(v) => updateFinalCTA("subtitle", v)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium">Birincil Buton</h4>
              <TextInput
                label="Metin"
                value={homepage.finalCTA.primaryCTA.text}
                onChange={(v) => updateFinalCTA("primaryCTA", { ...homepage.finalCTA.primaryCTA, text: v })}
              />
              <TextInput
                label="Link"
                value={homepage.finalCTA.primaryCTA.href}
                onChange={(v) => updateFinalCTA("primaryCTA", { ...homepage.finalCTA.primaryCTA, href: v })}
              />
            </div>
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium">İkincil Buton</h4>
              <TextInput
                label="Metin"
                value={homepage.finalCTA.secondaryCTA.text}
                onChange={(v) => updateFinalCTA("secondaryCTA", { ...homepage.finalCTA.secondaryCTA, text: v })}
              />
              <TextInput
                label="Link"
                value={homepage.finalCTA.secondaryCTA.href}
                onChange={(v) => updateFinalCTA("secondaryCTA", { ...homepage.finalCTA.secondaryCTA, href: v })}
              />
            </div>
          </div>
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
