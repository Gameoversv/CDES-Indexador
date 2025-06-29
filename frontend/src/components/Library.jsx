import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/AdminLayout";
import { BookOpen } from "lucide-react";

// Simulación de archivos públicos
const mockPublicDocs = [
  {
    name: "plan-estrategico.pdf",
    type: "pdf",
    section: "PES 203P",
    date: "2025-06-22",
    public: true,
  },
  {
    name: "informe-ambiental.docx",
    type: "docx",
    section: "CDES Inst.",
    date: "2025-06-18",
    public: true,
  },
];

export default function Library() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const [search, setSearch] = useState("");
  const filtered = mockPublicDocs.filter(
    (doc) =>
      doc.public &&
      doc.name.toLowerCase().includes(search.toLowerCase())
  );

  const content = (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <BookOpen className="h-6 w-6" />
        Biblioteca Pública
      </h2>
      <p className="text-muted-foreground">
        Archivos habilitados para consulta ciudadana
      </p>

      <Input
        placeholder="Buscar documentos públicos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">{doc.name}</h3>
              <p className="text-sm text-muted-foreground">{doc.date}</p>
              <div className="flex gap-2">
                <Badge variant="secondary">{doc.type.toUpperCase()}</Badge>
                <Badge variant="outline">{doc.section}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return isAdmin ? <AdminLayout>{content}</AdminLayout> : <div className="p-6">{content}</div>;
}
