"use client"
import { motion } from "framer-motion"
import {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Award,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useSectionContent } from "@/context/content-context"

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Bell,
  BarChart3,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Award,
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function FeaturesSection() {
  const { features } = useSectionContent("homepage")

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{features.sectionTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{features.sectionSubtitle}</p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.items.map((feature) => {
            const Icon = iconMap[feature.icon] || BookOpen
            return (
              <motion.div key={feature.id} variants={itemVariants}>
                <Card className="h-full border-border hover:border-accent/50 transition-colors group cursor-pointer">
                  <CardContent className="p-6">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors"
                    >
                      <Icon className="w-6 h-6 text-accent" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
