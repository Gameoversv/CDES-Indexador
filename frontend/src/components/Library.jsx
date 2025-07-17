import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/AdminLayout";
import { BookOpen, Search, File, FileText, FileSpreadsheet, Download } from "lucide-react";

// Simulación de archivos públicos
const mockPublicDocs = [
  {
    id: 1,
    name: "Plan Estratégico 2030",
    filename: "plan-estrategico.pdf",
    type: "pdf",
    section: "PES 203P",
    date: "2025-06-22",
    public: true,
    description: "Documento estratégico para el desarrollo regional hasta el año 2030",
    size: "2.4 MB"
  },
  {
    id: 2,
    name: "Informe Ambiental Anual",
    filename: "informe-ambiental.docx",
    type: "docx",
    section: "CDES Inst.",
    date: "2025-06-18",
    public: true,
    description: "Evaluación del impacto ambiental en la región durante el último año",
    size: "1.2 MB"
  },
  {
    id: 3,
    name: "Presupuesto Anual 2025",
    filename: "presupuesto-2025.xlsx",
    type: "xlsx",
    section: "Finanzas",
    date: "2025-05-30",
    public: true,
    description: "Presupuesto asignado para proyectos del año fiscal 2025",
    size: "3.7 MB"
  },
];

export default function Library() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [search, setSearch] = useState("");
  
  const filtered = mockPublicDocs.filter(
    (doc) =>
      doc.public &&
      (doc.name.toLowerCase().includes(search.toLowerCase()) ||
       doc.filename.toLowerCase().includes(search.toLowerCase()) ||
       doc.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf': return <FileText className="h-5 w-5 text-gray-700" />;
      case 'docx': return <FileText className="h-5 w-5 text-gray-700" />;
      case 'xlsx': return <FileSpreadsheet className="h-5 w-5 text-gray-700" />;
      default: return <File className="h-5 w-5 text-gray-700" />;
    }
  };

  const content = (
    <div className="space-y-6 bg-white text-gray-800">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-gray-800" />
          Biblioteca Pública
        </h2>
        <p className="text-gray-600 mt-1">
          Archivos habilitados para consulta ciudadana
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-500" />
        </div>
        <Input
          placeholder="Buscar documentos públicos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 border-gray-300"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 rounded-lg">
          <File className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-800">No se encontraron documentos</h3>
          <p className="text-gray-600 mt-2">
            {search ? "Intenta con otro término de búsqueda" : "No hay documentos públicos disponibles"}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((doc) => (
            <Card 
              key={doc.id}
              className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-gray-100 p-3 rounded-lg">
                    {getFileIcon(doc.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{doc.filename}</p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700">{doc.description}</p>
                
                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                      {doc.type.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="border-gray-300 text-gray-700">
                      {doc.section}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500">
                    <span>{doc.date}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-600">{doc.size}</span>
                  <a 
                    href="#" 
                    className="text-gray-600 hover:text-gray-900 flex items-center gap-1 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return isAdmin ? <AdminLayout>{content}</AdminLayout> : <div className="p-6 bg-white">{content}</div>;
}