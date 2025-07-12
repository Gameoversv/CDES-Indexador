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
  Calendar,
  HardDrive,
  File,
  FileSpreadsheet,
  FileBarChart,
  Search,
  Loader2
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminDocuments() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("filename");
  const [sortOrder, setSortOrder] = useState("asc");
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    file: null,
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
      } else {
        console.error("Respuesta inesperada:", res.data);
        setFiles([]);
        toast.error("Formato de datos inválido del servidor.");
      }
    } catch (error) {
      console.error("Error al obtener documentos:", error);
      setFiles([]);
        toast.error("Error al cargar los documentos.");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null) return "0 Bytes";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (filename) => {
    if (!filename) return <File className="text-gray-600" size={20} />;
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileText className="text-red-600" size={20} />;
      case 'doc':
      case 'docx': return <FileText className="text-blue-600" size={20} />;
      case 'xls':
      case 'xlsx': return <FileSpreadsheet className="text-green-600" size={20} />;
      case 'ppt':
      case 'pptx': return <FileBarChart className="text-orange-600" size={20} />;
      default: return <File className="text-gray-600" size={20} />;
    }
  };

  const getFileTypeColor = (filename) => {
    if (!filename) return "bg-gray-100 text-gray-700 border border-gray-300";
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return "bg-red-100 text-red-700 border border-gray-300";
      case 'doc':
      case 'docx': return "bg-blue-100 text-blue-700 border border-gray-300";
      case 'xls':
      case 'xlsx': return "bg-green-100 text-green-700 border border-gray-300";
      case 'ppt':
      case 'pptx': return "bg-orange-100 text-orange-700 border border-gray-300";
      default: return "bg-gray-100 text-gray-700 border border-gray-300";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      
      if (sortBy === "updated") {
        valA = new Date(valA || 0);
        valB = new Date(valB || 0);
      } else if (sortBy === "size") {
        valA = a.size || 0;
        valB = b.size || 0;
      } else {
        valA = (valA || "").toString().toLowerCase();
        valB = (valB || "").toString().toLowerCase();
      }
      
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [files, sortBy, sortOrder]);

  const filteredFiles = useMemo(() => {
    return sortedFiles.filter(
      (f) =>
        (f.filename || "").toLowerCase().includes(search.toLowerCase()) &&
        (typeFilter === "all" || (f.filename || "").toLowerCase().endsWith(`.${typeFilter}`))
    );
  }, [sortedFiles, search, typeFilter]);

  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const typeCount = {
      pdf: files.filter(f => (f.filename || "").toLowerCase().endsWith('.pdf')).length,
      docx: files.filter(f => (f.filename || "").toLowerCase().endsWith('.docx')).length,
      xlsx: files.filter(f => (f.filename || "").toLowerCase().endsWith('.xlsx')).length,
      pptx: files.filter(f => (f.filename || "").toLowerCase().endsWith('.pptx')).length,
    };
    
    return {
      totalFiles: files.length,
      totalSize,
      typeCount
    };
  }, [files]);

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
      console.error("Error al descargar:", err);
      toast.error("Error al descargar el archivo");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.file) return;
    
    try {
      await documentsAPI.deleteByPath(confirmDelete.file.path);
      toast.success("Archivo eliminado correctamente");
      fetchFiles();
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast.error("Error al eliminar el archivo");
    } finally {
      setConfirmDelete({ open: false, file: null });
    }
  };

  // Manejar estado de carga inicial
  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto py-6">
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-gray-700" />
            <span className="mt-4 text-lg font-medium text-gray-900">
              Cargando documentos...
            </span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6 bg-white text-gray-900">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 text-gray-900">
              <FileText className="h-6 w-6 md:h-8 md:w-8" />
              <span>Documentos Almacenados</span>
            </h1>
            <p className="text-muted-foreground text-sm text-gray-700">
              Gestiona y accede a todos los documentos del sistema
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Botón Actualizar con color #ef4444 */}
            <Button 
              onClick={fetchFiles}
              className="gap-2 px-3 py-2 rounded-lg text-white disabled:opacity-75"
              disabled={loading}
              style={{ backgroundColor: "#ef4444", borderColor: "#ef4444" }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Actualizar</span>
                </>
              )}
            </Button>
            
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-none border-r border-gray-300 px-3 bg-gray-100 text-gray-900 hover:bg-gray-200"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-none px-3 bg-gray-100 text-gray-900 hover:bg-gray-200"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
            
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Subir documento</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl border border-gray-300 bg-white">
                <DialogHeader>
                  <DialogTitle className="text-gray-900">Subir nuevo documento</DialogTitle>
                  <DialogDescription className="text-gray-700">
                    Complete la información del documento a subir
                  </DialogDescription>
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
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Archivo</label>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.pptx"
                      onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                      required
                      className="border border-gray-300"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">Apartado</label>
                    <Select
                      value={apartado}
                      onValueChange={setApartado}
                      required
                    >
                      <SelectTrigger className="border border-gray-300">
                        <SelectValue placeholder="Selecciona un apartado" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-300">
                        <SelectItem value="CDES Inst." className="text-gray-900">CDES Inst.</SelectItem>
                        <SelectItem value="PES 203P" className="text-gray-900">PES 203P</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="publico"
                      checked={publico}
                      onChange={(e) => setPublico(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="publico" className="text-sm text-gray-900">
                      Habilitar en biblioteca pública
                    </label>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setUploadModalOpen(false)}
                      className="border border-gray-300 text-gray-900 bg-white hover:bg-gray-100"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Subir documento
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border border-gray-300 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full border border-gray-300">
                  <File className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                  <p className="text-xs md:text-sm text-gray-700">Total archivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-300 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full border border-gray-300">
                  <HardDrive className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-bold text-gray-900">{formatSize(stats.totalSize)}</p>
                  <p className="text-xs md:text-sm text-gray-700">Espacio usado</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-300 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full border border-gray-300">
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.typeCount.pdf || 0}</p>
                  <p className="text-xs md:text-sm text-gray-700">Documentos PDF</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border border-gray-300 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 p-2 rounded-full border border-gray-300">
                  <FileSpreadsheet className="h-4 w-4 md:h-5 md:w-5 text-gray-700" />
                </div>
                <div>
                  <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.typeCount.docx || 0}</p>
                  <p className="text-xs md:text-sm text-gray-700">Documentos DOCX</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="bg-white border border-gray-300 shadow-none rounded-lg">
          <CardContent className="p-4 md:p-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-700" />
                <Input
                  placeholder="Buscar por nombre de archivo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 py-2 md:py-3 rounded-lg border border-gray-300 text-gray-900"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-900">Tipo de archivo</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full py-2 md:py-3 rounded-lg border border-gray-300 text-gray-900">
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300">
                      <SelectItem value="all" className="text-gray-900">Todos los tipos</SelectItem>
                      <SelectItem value="pdf" className="text-gray-900">PDF</SelectItem>
                      <SelectItem value="docx" className="text-gray-900">DOCX</SelectItem>
                      <SelectItem value="xlsx" className="text-gray-900">XLSX</SelectItem>
                      <SelectItem value="pptx" className="text-gray-900">PPTX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-900">Ordenar por</label>
                  <Select 
                    value={sortBy} 
                    onValueChange={setSortBy}
                  >
                    <SelectTrigger className="w-full py-2 md:py-3 rounded-lg border border-gray-300 text-gray-900">
                      <SelectValue placeholder="Seleccionar campo" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300">
                      <SelectItem value="filename" className="text-gray-900">Nombre</SelectItem>
                      <SelectItem value="size" className="text-gray-900">Tamaño</SelectItem>
                      <SelectItem value="updated" className="text-gray-900">Fecha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-900">Dirección</label>
                  <Select 
                    value={sortOrder} 
                    onValueChange={setSortOrder}
                  >
                    <SelectTrigger className="w-full py-2 md:py-3 rounded-lg border border-gray-300 text-gray-900">
                      <SelectValue placeholder="Seleccionar orden" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-300">
                      <SelectItem value="asc" className="text-gray-900">Ascendente (A-Z)</SelectItem>
                      <SelectItem value="desc" className="text-gray-900">Descendente (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de archivos */}
        <Card className="bg-white border border-gray-300 shadow-none rounded-lg">
          <CardHeader className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <FileText className="h-5 w-5" />
                  Lista de Archivos
                  <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-900 border border-gray-300">
                    {filteredFiles.length} archivos
                  </Badge>
                </CardTitle>
                {filteredFiles.length !== files.length && (
                  <CardDescription className="mt-1 text-gray-700">
                    Mostrando {filteredFiles.length} de {files.length} archivos
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {filteredFiles.length > 0 ? (
              viewMode === "list" ? (
                // Vista tabla
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-100">
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer py-3 border-b border-gray-300"
                            onClick={() => handleSort("filename")}
                          >
                            <div className="flex items-center gap-1 text-gray-900 font-semibold">
                              Archivo
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer py-3 border-b border-gray-300"
                            onClick={() => handleSort("size")}
                          >
                            <div className="flex items-center gap-1 text-gray-900 font-semibold">
                              Tamaño
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer py-3 border-b border-gray-300"
                            onClick={() => handleSort("updated")}
                          >
                            <div className="flex items-center gap-1 text-gray-900 font-semibold">
                              Última modificación
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </TableHead>
                          <TableHead className="border-b border-gray-300 text-gray-900 font-semibold">Tipo</TableHead>
                          <TableHead className="text-right border-b border-gray-300 text-gray-900 font-semibold">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFiles.map((file, index) => (
                          <TableRow key={index} className="hover:bg-gray-50 border-b border-gray-300">
                            <TableCell className="font-medium text-gray-900">
                              <div className="flex items-center gap-3">
                                {getFileIcon(file.filename)}
                                <div className="font-medium truncate max-w-xs">
                                  {file.filename}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-900">{formatSize(file.size)}</TableCell>
                            <TableCell className="text-gray-900">
                              <div className="flex items-center gap-1 text-sm text-gray-700">
                                <Calendar className="h-3 w-3" />
                                {formatDate(file.updated)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                                {file.filename?.split('.').pop()?.toUpperCase() || "FILE"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                                  onClick={() => setPreviewFile(file)}
                                >
                                  <Eye className="h-4 w-4 text-gray-900" />
                                </Button>
                                <Button
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                                  onClick={() => setConfirmDelete({ open: true, file })}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(file.path, file.filename)}
                                  className="gap-1 px-3 border border-gray-300 bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                // Vista grid
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFiles.map((file, index) => (
                    <Card 
                      key={index} 
                      className="bg-white border border-gray-300 shadow-none rounded-lg overflow-hidden hover:shadow-md transition-all"
                    >
                      <div className="p-1 bg-gray-100">
                        <div className="flex justify-center py-4">
                          {getFileIcon(file.filename)}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium truncate text-gray-900" title={file.filename}>
                              {file.filename}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1 text-gray-700">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(file.updated)}</span>
                            </div>
                            <div className="text-gray-700">
                              {formatSize(file.size)}
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                            <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                              {file.filename?.split('.').pop()?.toUpperCase() || "FILE"}
                            </Badge>
                            
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                                onClick={() => setPreviewFile(file)}
                              >
                                <Eye className="h-4 w-4 text-gray-900" />
                              </Button>
                              <Button
                                variant="ghost" 
                                size="sm" 
                                className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                                onClick={() => setConfirmDelete({ open: true, file })}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(file.path, file.filename)}
                                className="rounded-full p-1.5 border border-gray-300 bg-blue-600 text-white hover:bg-blue-700"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">No se encontraron archivos</p>
                <p className="text-gray-700 text-sm max-w-md mx-auto mt-2">
                  {search || typeFilter !== "all"
                    ? "Intenta ajustar los filtros de búsqueda"
                    : "No hay documentos almacenados en el sistema"
                  }
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2 border border-gray-300 text-gray-900 bg-white hover:bg-gray-100"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Restablecer filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de vista previa */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="rounded-xl bg-white border border-gray-300">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5" />
                Detalle del Documento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-700">Nombre</p>
                  <p className="font-medium text-gray-900">{previewFile?.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">Tamaño</p>
                  <p className="font-medium text-gray-900">{formatSize(previewFile?.size)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">Tipo</p>
                  <Badge variant="secondary" className={getFileTypeColor(previewFile?.filename)}>
                    {previewFile?.filename?.split('.').pop()?.toUpperCase() || "FILE"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-700">Última modificación</p>
                  <p className="font-medium text-gray-900">{formatDate(previewFile?.updated)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-700">Ruta del archivo</p>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all text-gray-900 border border-gray-300">
                  {previewFile?.path}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setPreviewFile(null)}
                className="border border-gray-300 text-gray-900 bg-white hover:bg-gray-100"
              >
                Cerrar
              </Button>
              {/* Botón de descarga con color #ef4444 */}
              <Button
                onClick={() => handleDownload(previewFile?.path, previewFile?.filename)}
                className="text-white"
                style={{ backgroundColor: "#ef4444" }}
              >
                Descargar documento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmación de eliminación */}
        <Dialog 
          open={confirmDelete.open} 
          onOpenChange={(open) => setConfirmDelete({ open, file: open ? confirmDelete.file : null })}
        >
          <DialogContent className="rounded-xl bg-white border border-gray-300">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Confirmar eliminación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de que deseas eliminar permanentemente el archivo 
                <span className="font-semibold text-gray-900"> "{confirmDelete.file?.filename}"</span>?
              </p>
              <p className="text-sm text-red-600">
                Esta acción no se puede deshacer y el archivo se perderá permanentemente.
              </p>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmDelete({ open: false, file: null })}
                  className="border border-gray-300 text-gray-900 bg-white hover:bg-gray-100"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Eliminar permanentemente
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}