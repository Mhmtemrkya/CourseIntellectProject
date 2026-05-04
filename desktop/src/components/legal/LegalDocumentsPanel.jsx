import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { legalDocuments } from "@/legal/legalContent";

export function LegalDocumentsPanel({ compact = false }) {
  const [openIndex, setOpenIndex] = useState(compact ? null : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          KVKK ve Yasal Metinler
        </CardTitle>
        <CardDescription>
          Aydınlatma metni, açık rıza, kullanım koşulları ve gizlilik politikası.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {legalDocuments.map((document, index) => {
          const Icon = document.icon;
          const isOpen = openIndex === index;
          return (
            <div key={document.title} className="rounded-lg border bg-muted/20">
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <Icon className="mt-0.5 h-5 w-5 text-brand-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{document.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{document.summary}</span>
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {isOpen ? (
                <div className="space-y-4 border-t px-4 py-4 text-sm">
                  {document.sections.map((section) => (
                    <section key={section.title}>
                      <h4 className="font-semibold">{section.title}</h4>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                        {section.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        {compact ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => setOpenIndex(0)}>
            Metinleri görüntüle
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
