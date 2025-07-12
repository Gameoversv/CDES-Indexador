import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { documentsAPI } from "@/services/api";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner"; // asegúrate de tener `sonner` instalado

export default function AdminDocuments() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("filename");
  const [sortOrder, setSortOrder] = useState("asc");
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    fileIndex: null,
  });
  const [viewMode, setViewMode] = useState("list");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [apartado, setApartado] = useState("");
  const [publico, setPublico] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await documentsAPI.listStorage();
      if (Array.isArray(res.data?.files)) {
        setFiles(res.data.files);
        toast.success("Documentos actualizados correctamente.");
      } else {
        console.error("Respuesta inesperada:", res.data);
        setFiles([]);
        toast.error("Respuesta inesperada del servidor.");
      }
    } catch (error) {
      console.error("Error al obtener documentos:", error);
      setFiles([]);
      toast.error("Error al cargar los documentos.");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) =>
    bytes > 1e6
      ? (bytes / 1e6).toFixed(1) + " MB"
      : (bytes / 1e3).toFixed(1) + " KB";

  const totalSize = useMemo(
    () => files.reduce((acc, f) => acc + (f.size || 0), 0),
    [files]
  );

  const countByType = (ext) =>
    files.filter((f) => f.filename?.toLowerCase().endsWith(`.${ext}`)).length;

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const handleDownload = async (path, filename) => {
    try {
      const resp = await documentsAPI.downloadByPath(path);
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        "Error al descargar:",
        err.response?.data?.detail || err.message
      );
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (sortBy === "updated") {
      valA = new Date(valA);
      valB = new Date(valB);
    } else {
      valA = valA?.toString().toLowerCase();
      valB = valB?.toString().toLowerCase();
    }
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const filteredFiles = sortedFiles.filter(
    (f) =>
      f.filename?.toLowerCase().includes(search.toLowerCase()) &&
      (typeFilter === "" || f.filename?.toLowerCase().endsWith(typeFilter))
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchFiles}
              className="gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </>
              )}
            </Button>

            <div className="flex rounded-md overflow-hidden border">
              <Button
                onClick={() => setViewMode("list")}
                className={`rounded-none px-3 ${
                  viewMode === "list"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white text-black hover:bg-muted"
                }`}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setViewMode("grid")}
                className={`rounded-none px-3 ${
                  viewMode === "grid"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white text-black hover:bg-muted"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-500 text-white hover:bg-red-600 gap-2">
                  <Upload className="h-4 w-4" />
                  Subir documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Subir nuevo documento</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newFile || !apartado) {
                      toast.warning(
                        "Debes seleccionar un archivo y un apartado."
                      );
                      return;
                    }
                    try {
                      const formData = new FormData();
                      formData.append("file", newFile);
                      formData.append("apartado", apartado);
                      formData.append("publico", publico);

                      await documentsAPI.upload(formData);

                      toast.success("Archivo subido correctamente.");
                      setUploadModalOpen(false);
                      setNewFile(null);
                      setApartado("");
                      setPublico(false);
                      fetchFiles();
                    } catch (error) {
                      console.error("Error al subir archivo:", error);
                      toast.error("Error al subir el archivo.");
                    }
                  }}
                >
                  <Input
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                    required
                  />
                  <select
                    className="border rounded px-3 py-2 w-full"
                    value={apartado}
                    onChange={(e) => setApartado(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un apartado</option>
                    <option value="CDES Inst.">CDES Inst.</option>
                    <option value="PES 203P">PES 203P</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={publico}
                      onChange={(e) => setPublico(e.target.checked)}
                    />
                    Habilitar en biblioteca pública
                  </label>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      Subir
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm">Total archivos</h4>
              <p className="text-2xl font-bold">{files.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm">Espacio usado</h4>
              <p className="text-2xl font-bold">{formatSize(totalSize)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm">PDFs</h4>
              <p className="text-2xl font-bold">{countByType("pdf")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm">DOCX</h4>
              <p className="text-2xl font-bold">{countByType("docx")}</p>
            </CardContent>
          </Card>
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
              <select
                className="border rounded px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                <option value=".pdf">PDF</option>
                <option value=".docx">DOCX</option>
                <option value=".xlsx">XLSX</option>
              </select>
              <select
                className="border rounded px-3 py-2 text-sm"
                onChange={(e) => handleSort(e.target.value)}
              >
                <option value="filename">Nombre</option>
                <option value="updated">Fecha</option>
                <option value="size">Tamaño</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Vista */}
        {viewMode === "list" ? (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Lista de Archivos
                <span className="text-muted-foreground text-xs">
                  ({filteredFiles.length} archivos)
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th
                        className="cursor-pointer"
                        onClick={() => handleSort("filename")}
                      >
                        Archivo <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th
                        className="cursor-pointer"
                        onClick={() => handleSort("size")}
                      >
                        Tamaño <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th
                        className="cursor-pointer"
                        onClick={() => handleSort("updated")}
                      >
                        Última modificación{" "}
                        <ArrowUpDown className="inline h-3 w-3" />
                      </th>
                      <th>Tipo</th>
                      <th className="text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((f, i) => (
                      <tr key={i} className="bg-muted/50 rounded-md">
                        <td className="py-2 pr-4">{f.filename}</td>
                        <td className="py-2 pr-4">{formatSize(f.size)}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(f.updated).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">
                            {f.filename?.split(".").pop()?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right space-x-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewFile(f)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setConfirmDelete({ open: true, fileIndex: i })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(f.path, f.filename)}
                            className="gap-1"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredFiles.map((f, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium">{f.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(f.size)}
                  </p>
                  <p className="text-xs">
                    {new Date(f.updated).toLocaleDateString()}
                  </p>
                  <div className="flex justify-between">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPreviewFile(f)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setConfirmDelete({ open: true, fileIndex: i })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleDownload(f.path, f.filename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Modales */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vista previa</DialogTitle>
            </DialogHeader>
            <div className="text-sm space-y-2">
              <p>
                <strong>Archivo:</strong> {previewFile?.filename}
              </p>
              <p>
                <strong>Tipo:</strong>{" "}
                {previewFile?.filename?.split(".").pop()?.toUpperCase()}
              </p>
              <p>
                <strong>Tamaño:</strong> {formatSize(previewFile?.size)}
              </p>
              <p>
                <strong>Última modificación:</strong>{" "}
                {new Date(previewFile?.updated).toLocaleDateString()}
              </p>
              <p>
                <strong>Ruta:</strong> {previewFile?.path}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
