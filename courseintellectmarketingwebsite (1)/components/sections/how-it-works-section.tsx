"use client"

import { motion } from "framer-motion"
import { useSectionContent } from "@/context/content-context"

export function HowItWorksSection() {
  const { howItWorks } = useSectionContent("homepage")

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
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{howItWorks.sectionTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{howItWorks.sectionSubtitle}</p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-1/2" />

            {/* Steps */}
            <div className="space-y-12">
              {howItWorks.steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: index * 0.2 }}
                  className={`relative flex items-center gap-8 ${index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  {/* Step Number */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-2xl font-bold shadow-lg z-10"
                  >
                    {step.step}
                  </motion.div>

                  {/* Content Card */}
                  <div
                    className={`ml-24 md:ml-0 md:w-[calc(50%-4rem)] ${index % 2 === 0 ? "md:text-right md:pr-8" : "md:text-left md:pl-8"}`}
                  >
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </div>

                  {/* Empty space for alignment */}
                  <div className="hidden md:block md:w-[calc(50%-4rem)]" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
