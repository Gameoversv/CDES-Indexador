import React from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

const mockNews = [
  {
    title: "Firma del acuerdo CDES - Ayuntamiento 2025",
    date: "2025-06-25",
    summary: "Se formalizó el acuerdo de colaboración estratégica para impulsar proyectos del Plan Estratégico Santiago 2030.",
  },
  {
    title: "Lanzamiento de la Biblioteca Pública Digital",
    date: "2025-06-20",
    summary: "Los ciudadanos ya pueden acceder libremente a los documentos habilitados por el CDES desde el nuevo portal público.",
  },
  {
    title: "Nueva alianza con universidades locales",
    date: "2025-06-15",
    summary: "El CDES firmó acuerdos con instituciones académicas para investigaciones sobre sostenibilidad urbana.",
  },
];

export default function News() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="h-6 w-6" />
          Noticias Institucionales
        </h2>
        <p className="text-muted-foreground">
          Comunicados, acuerdos y novedades recientes del Consejo Estratégico
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockNews.map((news, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold">{news.title}</h3>
                <p className="text-muted-foreground text-xs">{news.date}</p>
                <p className="text-sm text-muted-foreground">{news.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
