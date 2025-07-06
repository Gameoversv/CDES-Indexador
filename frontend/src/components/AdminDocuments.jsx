import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Upload,
  RefreshCw,
  LayoutList,
  LayoutGrid,
  Eye,
  Download,
  ArrowUpDown,
  Trash2,
} from "lucide-react";

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
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [previewFile, setPreviewFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, fileIndex: null });

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const countByType = (ext) => files.filter(f => f.type === ext).length;

  const formatSize = (bytes) =>
    bytes > 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : (bytes / 1e3).toFixed(1) + " KB";

  const toggleVisibility = (index) => {
    setFiles(prev =>
      prev.map((file, i) =>
        i === index ? { ...file, public: !file.public } : file
      )
    );
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === "updated") {
      valA = new Date(valA);
      valB = new Date(valB);
    }
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const filteredFiles = sortedFiles.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Documentos Almacenados
            </h2>
            <p className="text-muted-foreground text-sm">
              Gestiona y accede a todos los documentos del sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button variant="secondary" className="bg-red-500 text-white hover:bg-red-600">
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <LayoutGrid className="h-4 w-4" />
            </Button>
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
        </div>

        {/* Estadísticas */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><h4 className="text-sm">Total archivos</h4><p className="text-2xl font-bold">{files.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">Espacio usado</h4><p className="text-2xl font-bold">{formatSize(totalSize)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">PDFs</h4><p className="text-2xl font-bold">{countByType("pdf")}</p></CardContent></Card>
          <Card><CardContent className="p-4"><h4 className="text-sm">DOCX</h4><p className="text-2xl font-bold">{countByType("docx")}</p></CardContent></Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Buscar archivos por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="md:flex-1"
              />
              <select className="border rounded px-3 py-2 text-sm">
                <option value="">Todos los tipos</option>
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="xlsx">XLSX</option>
              </select>
              <select
                className="border rounded px-3 py-2 text-sm"
                onChange={(e) => handleSort(e.target.value)}
              >
                <option value="name">Nombre</option>
                <option value="updated">Fecha</option>
                <option value="size">Tamaño</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Lista en tabla */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Lista de Archivos
                <span className="text-muted-foreground text-xs">({filteredFiles.length} archivos)</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="cursor-pointer" onClick={() => handleSort("name")}>
                      Archivo <ArrowUpDown className="inline h-3 w-3" />
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort("size")}>
                      Tamaño <ArrowUpDown className="inline h-3 w-3" />
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort("updated")}>
                      Última modificación <ArrowUpDown className="inline h-3 w-3" />
                    </th>
                    <th>Tipo</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((f, i) => (
                    <tr key={i} className="bg-muted/50 rounded-md">
                      <td className="py-2 pr-4">{f.name}</td>
                      <td className="py-2 pr-4">{formatSize(f.size)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{f.updated}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{f.type.toUpperCase()}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right space-x-2">
                        <Button size="icon" variant="ghost" onClick={() => setPreviewFile(f)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete({ open: true, fileIndex: i })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        <Button size="sm" variant="outline">Descargar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal vista previa */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vista previa</DialogTitle>
            </DialogHeader>
            <div className="text-sm space-y-2">
              <p><strong>Archivo:</strong> {previewFile?.name}</p>
              <p><strong>Tipo:</strong> {previewFile?.type.toUpperCase()}</p>
              <p><strong>Última modificación:</strong> {previewFile?.updated}</p>
              <p className="text-muted-foreground">Simulación de vista previa del documento.</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmación */}
        <Dialog open={confirmDelete.open} onOpenChange={() => setConfirmDelete({ open: false, fileIndex: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar documento?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el archivo <strong>{files[confirmDelete.fileIndex]?.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmDelete({ open: false, fileIndex: null })}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => {
                setFiles(prev => prev.filter((_, i) => i !== confirmDelete.fileIndex));
                setConfirmDelete({ open: false, fileIndex: null });
              }}>
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
