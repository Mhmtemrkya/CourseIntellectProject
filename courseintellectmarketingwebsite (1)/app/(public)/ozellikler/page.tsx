"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Award,
  Shield,
  Zap,
  Globe,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useSectionContent } from "@/context/content-context"
import type { FeatureItem } from "@/types/content"

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Award,
  Shield,
  Zap,
  Globe,
  Lock,
}

// Genişletilmiş özellik listesi
const allFeatures: FeatureItem[] = [
  {
    id: "1",
    icon: "BookOpen",
    title: "Akıllı Ders Takibi",
    description:
      "Derslerinizi planlayın, takip edin ve öğrenci ilerlemesini anlık izleyin. Yapay zeka destekli önerilerle eğitim kalitesini artırın.",
    category: "teacher",
  },
  {
    id: "2",
    icon: "Bell",
    title: "Anlık Bildirimler",
    description: "Ödev, sınav ve duyurulardan anında haberdar olun. Push bildirimleri ile hiçbir şeyi kaçırmayın.",
    category: "all",
  },
  {
    id: "3",
    icon: "BarChart3",
    title: "Detaylı Raporlar",
    description:
      "Performans analizleri ve özelleştirilebilir raporlar oluşturun. Grafik ve tablolarla verileri görselleştirin.",
    category: "admin",
  },
  {
    id: "4",
    icon: "Users",
    title: "Veli Portalı",
    description:
      "Veliler çocuklarının eğitim sürecini yakından takip edebilir. Öğretmenlerle doğrudan iletişim kurabilirler.",
    category: "parent",
  },
  {
    id: "5",
    icon: "Calendar",
    title: "Takvim Yönetimi",
    description: "Sınav, ödev ve etkinlik takvimini kolayca yönetin. Otomatik hatırlatmalar ile organize kalın.",
    category: "all",
  },
  {
    id: "6",
    icon: "MessageSquare",
    title: "Anlık Mesajlaşma",
    description: "Öğretmen, öğrenci ve veliler arasında güvenli iletişim. Grup sohbetleri ve dosya paylaşımı.",
    category: "all",
  },
  {
    id: "7",
    icon: "FileText",
    title: "Ödev Yönetimi",
    description: "Ödevleri oluşturun, dağıtın ve değerlendirin. Online teslim ve otomatik değerlendirme özellikleri.",
    category: "teacher",
  },
  {
    id: "8",
    icon: "Award",
    title: "Başarı Rozetleri",
    description: "Öğrencileri motive eden gamification özellikleri. Rozetler, puanlar ve liderlik tabloları.",
    category: "student",
  },
  {
    id: "9",
    icon: "Shield",
    title: "Güvenli Altyapı",
    description: "256-bit SSL şifreleme ve KVKK uyumlu altyapı. Verileriniz her zaman güvende.",
    category: "admin",
  },
  {
    id: "10",
    icon: "Zap",
    title: "Hızlı Performans",
    description: "Optimize edilmiş altyapı ile anlık yanıt süreleri. Her cihazda akıcı deneyim.",
    category: "all",
  },
  {
    id: "11",
    icon: "Globe",
    title: "Çoklu Dil Desteği",
    description: "Türkçe, İngilizce ve daha fazla dil seçeneği. Uluslararası okullar için ideal.",
    category: "admin",
  },
  {
    id: "12",
    icon: "Lock",
    title: "Rol Bazlı Erişim",
    description: "Öğretmen, öğrenci, veli ve yönetici için özelleştirilmiş erişim hakları.",
    category: "admin",
  },
]

export default function FeaturesPage() {
  const featuresContent = useSectionContent("features")
  const initialCategory =
    featuresContent.categories.some((category) => category.id === "all")
      ? "all"
      : (featuresContent.categories[0]?.id ?? "all")
  const [activeCategory, setActiveCategory] = useState(initialCategory)

  useEffect(() => {
    if (!featuresContent.categories.some((category) => category.id === activeCategory)) {
      setActiveCategory(initialCategory)
    }
  }, [activeCategory, featuresContent.categories, initialCategory])

  const sourceFeatures = featuresContent.items.length > 0 ? featuresContent.items : allFeatures

  const filteredFeatures =
    activeCategory === "all" ? sourceFeatures : sourceFeatures.filter((feature) => feature.category === activeCategory)

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{featuresContent.hero.title}</h1>
            <p className="text-lg text-muted-foreground">{featuresContent.hero.subtitle}</p>
          </motion.div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 border-b border-border sticky top-16 bg-background/95 backdrop-blur-sm z-30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {featuresContent.categories.map((category) => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className={
                  activeCategory === category.id
                    ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                    : "bg-transparent"
                }
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredFeatures.map((feature, index) => {
                const Icon = iconMap[feature.icon] || BookOpen
                return (
                  <motion.div
                    key={feature.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="h-full border-border hover:border-accent/50 transition-all group hover:shadow-lg">
                      <CardContent className="p-6">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors"
                        >
                          <Icon className="w-7 h-7 text-accent" />
                        </motion.div>
                        <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-accent transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
