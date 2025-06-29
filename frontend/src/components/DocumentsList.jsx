/**
 * Componente de Lista de Documentos - Visualización Completa de Archivos
 * 
 * Este componente proporciona una vista completa de todos los documentos
 * almacenados en Firebase Storage. Incluye funcionalidades de visualización,
 * filtrado, ordenamiento y descarga de archivos.
 */

import React, { useEffect, useState, useMemo } from "react";
import { documentsAPI } from "../services/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Search, 
  Download, 
  Calendar, 
  Filter,
  Loader2,
  AlertCircle,
  HardDrive,
  File,
  RefreshCw,
  ArrowUpDown,
  Eye,
  Archive,
  FolderOpen,
  Grid3X3,
  List
} from "lucide-react";

export default function DocumentsList() {
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table or grid
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [files, searchTerm, sortBy, sortOrder, filterType]);

  const loadFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await documentsAPI.listStorage();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cargar archivos.");
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...files];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(file => {
        const ext = file.filename.split('.').pop()?.toLowerCase();
        return ext === filterType;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case "size":
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case "date":
          aValue = new Date(a.updated);
          bValue = new Date(b.updated);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredFiles(filtered);
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
      setError(err.response?.data?.detail || "Error al descargar.");
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'ppt':
      case 'pptx': return '📈';
      default: return '📁';
    }
  };

  const getFileTypeColor = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'bg-red-100 text-red-700';
      case 'doc':
      case 'docx': return 'bg-blue-100 text-blue-700';
      case 'xls':
      case 'xlsx': return 'bg-green-100 text-green-700';
      case 'ppt':
      case 'pptx': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);
    const typeCount = {};
    files.forEach(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'other';
      typeCount[ext] = (typeCount[ext] || 0) + 1;
    });

    return {
      totalFiles: files.length,
      totalSize,
      typeCount
    };
  }, [files]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando documentos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="h-8 w-8" />
            Documentos Almacenados
          </h1>
          <p className="text-muted-foreground">
            Gestiona y accede a todos los documentos del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadFiles} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-l-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.totalFiles}</p>
                <p className="text-sm text-muted-foreground">Total archivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
                <p className="text-sm text-muted-foreground">Espacio usado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <div>
                <p className="text-2xl font-bold">{stats.typeCount.pdf || 0}</p>
                <p className="text-sm text-muted-foreground">PDFs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">📝</span>
              <div>
                <p className="text-2xl font-bold">{(stats.typeCount.doc || 0) + (stats.typeCount.docx || 0)}</p>
                <p className="text-sm text-muted-foreground">Documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar archivos por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo de archivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="docx">DOCX</SelectItem>
                    <SelectItem value="xlsx">XLSX</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                  <SelectItem value="size-desc">Tamaño (Mayor)</SelectItem>
                  <SelectItem value="size-asc">Tamaño (Menor)</SelectItem>
                  <SelectItem value="date-desc">Fecha (Reciente)</SelectItem>
                  <SelectItem value="date-asc">Fecha (Antigua)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lista de Archivos
            <Badge variant="secondary">{filteredFiles.length} archivos</Badge>
          </CardTitle>
          <CardDescription>
            {filteredFiles.length !== files.length && 
              `Mostrando ${filteredFiles.length} de ${files.length} archivos`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFiles.length > 0 ? (
            viewMode === "table" ? (
              // Table View
              <div className="space-y-4">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Archivo
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("size")}
                        >
                          <div className="flex items-center gap-1">
                            Tamaño
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("date")}
                        >
                          <div className="flex items-center gap-1">
                            Última modificación
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFiles.map((file) => (
                        <TableRow key={file.path}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getFileIcon(file.filename)}</span>
                              <span className="truncate max-w-64">{file.filename}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatFileSize(file.size)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(file.updated)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                              {file.filename.split('.').pop()?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(file)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <span className="text-lg">{getFileIcon(file.filename)}</span>
                                      Detalles del Archivo
                                    </DialogTitle>
                                    <DialogDescription>
                                      Información detallada de {file.filename}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Nombre</label>
                                        <p className="text-sm text-muted-foreground">{file.filename}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Tamaño</label>
                                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Última modificación</label>
                                        <p className="text-sm text-muted-foreground">{formatDate(file.updated)}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Ruta</label>
                                        <p className="text-sm text-muted-foreground font-mono break-all">{file.path}</p>
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(file.path, file.filename)}
                                className="gap-1"
                              >
                                <Download className="h-4 w-4" />
                                Descargar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredFiles.map((file) => (
                    <Card key={file.path}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg">{getFileIcon(file.filename)}</span>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{file.filename}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                              {file.filename.split('.').pop()?.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(file.updated)}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(file.path, file.filename)}
                            className="w-full gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              // Grid View
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredFiles.map((file) => (
                  <Card key={file.path} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="text-center">
                          <div className="text-4xl mb-2">{getFileIcon(file.filename)}</div>
                          <p className="font-medium text-sm truncate" title={file.filename}>
                            {file.filename}
                          </p>
                        </div>
                        
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>{formatFileSize(file.size)}</p>
                          <p>{formatDate(file.updated)}</p>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(file.path, file.filename)}
                          className="w-full gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Descargar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-8">
              <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No se encontraron archivos</p>
              <p className="text-muted-foreground">
                {searchTerm || filterType !== "all" 
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "No hay documentos almacenados en el sistema"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}