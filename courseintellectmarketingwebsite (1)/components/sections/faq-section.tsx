"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useSectionContent } from "@/context/content-context"
import { useLanguage } from "@/context/language-context"

export function FAQSection() {
  const { faq } = useSectionContent("homepage")
  const { language } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <section id="sss" className="bg-white py-24 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="lg:col-span-5"
        >
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#d26d00]">
            <span className="h-px w-8 bg-[#F7941D]" />
            {language === "tr" ? "Bilgi merkezi" : "Knowledge center"}
          </div>
          <h2 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.05] text-[#061a27] md:text-6xl">{faq.sectionTitle}</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#5c6b74]">{faq.sectionSubtitle}</p>
          <Link href="/iletisim" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#15294B] hover:text-[#d26d00]">
            {language === "tr" ? "Ekibimizle iletişime geçin" : "Contact our team"}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="lg:col-span-7"
        >
          {mounted ? (
            <Accordion type="single" collapsible defaultValue={faq.items[0]?.id}>
              {faq.items.map((item, index) => (
                <AccordionItem key={item.id} value={item.id} className="border-b border-[#dfe5e9] py-1 first:border-t">
                  <AccordionTrigger className="gap-5 py-6 text-left text-base font-semibold text-[#061a27] hover:no-underline hover:text-[#d26d00] md:text-lg">
                    <span className="flex items-center gap-4">
                      <span className="font-mono text-[10px] font-normal text-[#9aa6ad]">{String(index + 1).padStart(2, "0")}</span>
                      {item.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pl-10 pr-8 pb-6 text-sm leading-7 text-[#5c6b74] md:text-base">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div aria-hidden>
              {faq.items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 border-b border-[#dfe5e9] py-6 first:border-t">
                  <span className="font-mono text-[10px] text-[#9aa6ad]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-base font-semibold text-[#061a27] md:text-lg">{item.question}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
