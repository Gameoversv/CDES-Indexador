import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Upload } from "lucide-react";

const mockFiles = [
  { name: "informe1.pdf", size: 120000, type: "pdf", updated: "2025-06-27", public: true },
  { name: "plan2025.docx", size: 87000, type: "docx", updated: "2025-06-26", public: false },
  { name: "datos.xlsx", size: 132000, type: "xlsx", updated: "2025-06-25", public: true },
];

export default function AdminDocuments() {
  const [files, setFiles] = useState(mockFiles);
  const [search, setSearch] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [apartado, setApartado] = useState("");
  const [publico, setPublico] = useState(false);

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const countByType = (ext) => files.filter(f => f.type === ext).length;

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes) =>
    bytes > 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : (bytes / 1e3).toFixed(1) + " KB";

  const toggleVisibility = (index) => {
    setFiles(prev =>
      prev.map((file, i) =>
        i === index ? { ...file, public: !file.public } : file
      )
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Gestión de Documentos
          </h2>
          <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Subir documento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Subir nuevo documento</DialogTitle>
              </DialogHeader>
              <form className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Apartado</label>
                  <select
                    value={apartado}
                    onChange={(e) => setApartado(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="CDES Inst.">CDES Inst.</option>
                    <option value="PES 203P">PES 203P</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="publico"
                    checked={publico}
                    onChange={(e) => setPublico(e.target.checked)}
                  />
                  <label htmlFor="publico" className="text-sm">Habilitar en biblioteca pública</label>
                </div>
                <div>
                  <label className="text-sm font-medium">Archivo</label>
                  <Input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files[0])}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setUploadModalOpen(false)}>Cancelar</Button>
                  <Button disabled>Subir</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estadísticas */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><h4 className="text-sm">Total archivos</h4><p className="text-2xl font-bold">{files.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">Espacio usado</h4><p className="text-2xl font-bold">{formatSize(totalSize)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">PDFs</h4><p className="text-2xl font-bold">{countByType("pdf")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">DOCX</h4><p className="text-2xl font-bold">{countByType("docx")}</p></CardContent></Card>
        </div>

        {/* Filtro y lista */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <Input
              placeholder="Buscar archivos por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="space-y-2 text-sm">
              {filteredFiles.map((f, i) => (
                <li key={i} className="flex justify-between items-center border-b pb-2">
                  <span>{f.name}</span>
                  <div className="flex gap-3 items-center">
                    <Badge variant="secondary">{f.type.toUpperCase()}</Badge>
                    <span className="text-muted-foreground">{formatSize(f.size)}</span>
                    <span className="text-muted-foreground text-xs">{f.updated}</span>
                    <Badge
                      variant={f.public ? "success" : "destructive"}
                      className="cursor-pointer"
                      onClick={() => toggleVisibility(i)}
                    >
                      {f.public ? "Público" : "Privado"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
