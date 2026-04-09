"use client"

import { useState } from "react"
import { useContent } from "@/context/content-context"
import { ContentSection } from "@/components/admin/content-editor/content-section"
import { TextInput } from "@/components/admin/content-editor/text-input"
import { TextArea } from "@/components/admin/content-editor/text-area"
import { SaveIndicator } from "@/components/admin/content-editor/save-indicator"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Save } from "lucide-react"
import Link from "next/link"

export default function ContactContentPage() {
  const { content, updateContent, saveContent, undoChange, history } = useContent()
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [lastSaved, setLastSaved] = useState<Date | undefined>()

  const contact = content.contact

  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await saveContent("contact")
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
            <h1 className="text-2xl font-bold text-foreground">İletişim Sayfası</h1>
            <p className="text-muted-foreground mt-0.5">İletişim bilgileri ve form ayarları</p>
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
            value={contact.hero.title}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                hero: { ...contact.hero, title: v },
              })
            }
          />
          <TextArea
            label="Alt Başlık"
            value={contact.hero.subtitle}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                hero: { ...contact.hero, subtitle: v },
              })
            }
          />
        </ContentSection>

        {/* Contact Info */}
        <ContentSection title="İletişim Bilgileri" description="Şirket iletişim detayları">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="E-posta"
              value={contact.info.email}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  info: { ...contact.info, email: v },
                })
              }
            />
            <TextInput
              label="Telefon"
              value={contact.info.phone}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  info: { ...contact.info, phone: v },
                })
              }
            />
          </div>
          <TextArea
            label="Adres"
            value={contact.info.address}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                info: { ...contact.info, address: v },
              })
            }
          />
          <TextInput
            label="Çalışma Saatleri"
            value={contact.info.workingHours}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                info: { ...contact.info, workingHours: v },
              })
            }
          />
        </ContentSection>

        {/* Form Labels */}
        <ContentSection title="Form Etiketleri" description="İletişim formu metin ayarları">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Ad Soyad Etiketi"
              value={contact.form.nameLabel}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  form: { ...contact.form, nameLabel: v },
                })
              }
            />
            <TextInput
              label="E-posta Etiketi"
              value={contact.form.emailLabel}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  form: { ...contact.form, emailLabel: v },
                })
              }
            />
            <TextInput
              label="Konu Etiketi"
              value={contact.form.subjectLabel}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  form: { ...contact.form, subjectLabel: v },
                })
              }
            />
            <TextInput
              label="Mesaj Etiketi"
              value={contact.form.messageLabel}
              onChange={(v) =>
                updateContent("contact", {
                  ...contact,
                  form: { ...contact.form, messageLabel: v },
                })
              }
            />
          </div>
          <TextInput
            label="Gönder Butonu Metni"
            value={contact.form.submitButton}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                form: { ...contact.form, submitButton: v },
              })
            }
          />
          <TextArea
            label="Başarı Mesajı"
            value={contact.form.successMessage}
            onChange={(v) =>
              updateContent("contact", {
                ...contact,
                form: { ...contact.form, successMessage: v },
              })
            }
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
