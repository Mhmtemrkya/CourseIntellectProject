"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useSectionContent } from "@/context/content-context"
import { cn } from "@/lib/utils"

export default function PricingPage() {
  const pricingContent = useSectionContent("pricing")
  const [isYearly, setIsYearly] = useState(false)

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
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{pricingContent.hero.title}</h1>
            <p className="text-lg text-muted-foreground mb-10">{pricingContent.hero.subtitle}</p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  !isYearly ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {pricingContent.toggleLabels.monthly}
              </span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} className="data-[state=checked]:bg-accent" />
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  isYearly ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {pricingContent.toggleLabels.yearly}
              </span>
              {isYearly && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium"
                >
                  <Sparkles className="w-3 h-3" />
                  {pricingContent.toggleLabels.discount}
                </motion.span>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingContent.plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn("relative", plan.isPopular && "md:-mt-4 md:mb-4")}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium z-10">
                    En Popüler
                  </div>
                )}
                <Card
                  className={cn(
                    "h-full transition-all",
                    plan.isPopular
                      ? "border-accent shadow-lg shadow-accent/10"
                      : "border-border hover:border-accent/50",
                  )}
                >
                  <CardHeader className="text-center pb-4">
                    <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Price */}
                    <div className="text-center py-4">
                      {plan.priceMonthly === 0 ? (
                        <div className="text-4xl font-bold text-foreground">
                          {plan.name === "Kurumsal" ? "Özel Fiyat" : "Ücretsiz"}
                        </div>
                      ) : (
                        <>
                          <div className="text-4xl font-bold text-foreground">
                            ₺{isYearly ? plan.priceYearly : plan.priceMonthly}
                            <span className="text-lg font-normal text-muted-foreground">/ay</span>
                          </div>
                          {isYearly && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Yıllık faturalandırma ile ₺{(plan.priceMonthly - plan.priceYearly) * 12} tasarruf
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link href={plan.name === "Kurumsal" ? "/iletisim" : "/indir"} className="block">
                      <Button
                        className={cn(
                          "w-full",
                          plan.isPopular
                            ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground",
                        )}
                      >
                        {plan.ctaText}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Link */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Sorularınız mı var?</h2>
          <p className="text-muted-foreground mb-6">Fiyatlandırma hakkında merak ettiklerinizi yanıtlıyoruz.</p>
          <Link href="/#sss">
            <Button variant="outline" className="bg-transparent">
              SSS&apos;yi İncele
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
