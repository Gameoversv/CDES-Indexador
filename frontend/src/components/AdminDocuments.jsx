import React, { useEffect, useState, useMemo } from "react";
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
  List,
  User,
  BookOpen,
  CheckCircle,
  FileSpreadsheet,
  FileBarChart,
  FileCode,
  FilePlus,
  Edit,
  Users,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";

// Estado de los documentos (escala de grises)
const DOC_STATUS = {
  draft: { label: "Borrador", color: "bg-gray-200 text-gray-800" },
  review: { label: "En revisión", color: "bg-gray-300 text-gray-800" },
  approved: { label: "Aprobado", color: "bg-gray-400 text-gray-800" },
  published: { label: "Publicado", color: "bg-gray-500 text-white" },
  archived: { label: "Archivado", color: "bg-gray-600 text-white" },
  formulation: { label: "Formulación", color: "bg-gray-300 text-gray-800" },
  implementation: { label: "Implementación", color: "bg-gray-400 text-gray-800" }
};

// Ejes estratégicos (escala de grises)
const STRATEGIC_AXES = {
  governance: { label: "Gobernabilidad", icon: <BookOpen size={16} />, color: "bg-gray-100 text-gray-800" },
  economy: { label: "Economía", icon: <FileSpreadsheet size={16} />, color: "bg-gray-200 text-gray-800" },
  environment: { label: "Medio Ambiente", icon: <FileBarChart size={16} />, color: "bg-gray-300 text-gray-800" },
  social: { label: "Desarrollo Social", icon: <FileCode size={16} />, color: "bg-gray-400 text-gray-800" },
  territorial: { label: "Ordenamiento Territorial", icon: <FileBarChart size={16} />, color: "bg-gray-500 text-white" }
};

export default function DocumentsList() {
  // Datos estáticos simulando archivos en el almacenamiento
  const STATIC_FILES = [
    {
      id: "doc-001",
      filename: "Plan_Vision_2030.pdf",
      size: 1048576,
      updated: "2025-06-25T15:24:00Z",
      created: "2025-06-20T09:15:00Z",
      path: "/docs/Plan_Vision_2030.pdf",
      title: "Plan Visión 2030",
      type: "Plan Estratégico",
      description: "Documento base de planificación a largo plazo para el desarrollo urbano. Contiene estrategias, objetivos y metas para la transformación de la ciudad hacia un modelo sostenible e inclusivo.",
      axis: "governance",
      status: "formulation",
      responsible: "Oficina Técnica",
      createdBy: "W. Vargas",
      files: [
        { name: "plan2030_v2.pdf", type: "pdf" },
        { name: "Anexos_metodologicos.docx", type: "docx" },
        { name: "Presentacion_vision2030.pptx", type: "pptx" }
      ],
      history: [
        { date: "2025-06-10", user: "N. Díaz", action: "Edición", detail: "Modificó la descripción del documento" },
        { date: "2025-06-08", user: "C. Hernández", action: "Adición", detail: "Subió nueva versión del documento principal" },
        { date: "2025-06-05", user: "W. Vargas", action: "Creación", detail: "Creó el documento inicial" }
      ],
      tags: ["desarrollo", "urbano", "planificación"]
    },
    {
      id: "doc-002",
      filename: "Presupuesto_2025.xlsx",
      size: 512000,
      updated: "2025-06-20T10:00:00Z",
      created: "2025-05-15T14:30:00Z",
      path: "/docs/Presupuesto_2025.xlsx",
      title: "Presupuesto Anual 2025",
      type: "Documento Financiero",
      description: "Presupuesto anual para proyectos estratégicos",
      axis: "economy",
      status: "published",
      responsible: "Departamento de Finanzas",
      createdBy: "Carlos Mendoza",
      files: [
        { name: "Presupuesto_2025.xlsx", type: "xlsx" },
        { name: "Anexos_justificacion.docx", type: "docx" }
      ],
      history: [
        { date: "2025-06-18", user: "M. Rodriguez", action: "Revisión", detail: "Revisó cifras del cuarto trimestre" },
        { date: "2025-06-10", user: "C. Mendoza", action: "Actualización", detail: "Actualizó proyecciones de ingresos" },
        { date: "2025-05-15", user: "C. Mendoza", action: "Creación", detail: "Creó documento inicial" }
      ],
      tags: ["finanzas", "presupuesto"]
    },
    {
      id: "doc-003",
      filename: "Acta_Reunion.docx",
      size: 204800,
      updated: "2025-06-22T08:30:00Z",
      created: "2025-06-22T08:00:00Z",
      path: "/docs/Acta_Reunion.docx",
      title: "Acta de Reunión del Comité",
      type: "Acta",
      description: "Acta de reunión del comité directivo con los puntos tratados y acuerdos alcanzados",
      axis: "governance",
      status: "draft",
      responsible: "Secretaría General",
      createdBy: "Ana López",
      files: [
        { name: "Acta_Reunion.docx", type: "docx" }
      ],
      history: [
        { date: "2025-06-22", user: "A. López", action: "Creación", detail: "Creó el documento inicial" }
      ],
      tags: ["reunión", "comité"]
    },
  ];

  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAxis, setFilterAxis] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    // Simular carga con retraso
    setLoading(true);
    setError("");
    setTimeout(() => {
      setFiles(STATIC_FILES);
      setLoading(false);
    }, 700);
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [files, searchTerm, sortBy, sortOrder, filterType, filterStatus, filterAxis]);

  const applyFiltersAndSort = () => {
    let filtered = [...files];

    // Buscar por nombre
    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (file.title && file.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        file.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtrar por tipo
    if (filterType !== "all") {
      filtered = filtered.filter(file => {
        const ext = file.filename.split('.').pop()?.toLowerCase();
        return ext === filterType;
      });
    }

    // Filtrar por estado
    if (filterStatus !== "all") {
      filtered = filtered.filter(file => file.status === filterStatus);
    }

    // Filtrar por eje
    if (filterAxis !== "all") {
      filtered = filtered.filter(file => file.axis === filterAxis);
    }

    // Ordenar
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
        case "responsible":
          aValue = a.responsible.toLowerCase();
          bValue = b.responsible.toLowerCase();
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

  // Simula descarga sin hacer nada real
  const handleDownload = (path, filename) => {
    alert(`Simulación descarga: ${filename}\nRuta: ${path}`);
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
      case 'pdf': return <FileText className="text-gray-800" size={20} />;
      case 'doc':
      case 'docx': return <FileText className="text-gray-800" size={20} />;
      case 'xls':
      case 'xlsx': return <FileSpreadsheet className="text-gray-800" size={20} />;
      case 'ppt':
      case 'pptx': return <FileBarChart className="text-gray-800" size={20} />;
      default: return <File className="text-gray-800" size={20} />;
    }
  };

  const getFileTypeColor = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return "bg-gray-100 text-gray-800";
      case 'doc':
      case 'docx': return "bg-gray-100 text-gray-800";
      case 'xls':
      case 'xlsx': return "bg-gray-100 text-gray-800";
      case 'ppt':
      case 'pptx': return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
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

  const formatSimpleDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, file) => acc + (file.size || 0), 0);
    const typeCount = {};
    const statusCount = {};
    const axisCount = {};
    
    files.forEach(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'other';
      typeCount[ext] = (typeCount[ext] || 0) + 1;
      
      statusCount[file.status] = (statusCount[file.status] || 0) + 1;
      axisCount[file.axis] = (axisCount[file.axis] || 0) + 1;
    });

    return {
      totalFiles: files.length,
      totalSize,
      typeCount,
      statusCount,
      axisCount
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
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-gray-800" />
          <span className="mt-4 text-lg font-medium text-gray-800">
            Cargando documentos...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive" className="border border-gray-300 bg-gray-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-gray-800" />
            <AlertDescription className="text-gray-800">{error}</AlertDescription>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-gray-800">
            <Archive className="h-8 w-8 text-gray-800" />
            <span>Documentos Almacenados</span>
          </h1>
          <p className="text-gray-600">
            Gestiona y accede a todos los documentos del sistema
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                setFiles(STATIC_FILES);
                setLoading(false);
              }, 700);
            }} 
            className="gap-2 px-4 py-2 rounded-lg shadow-sm bg-gray-800 text-white hover:bg-gray-700 border-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-none border-r border-gray-200 px-3 bg-gray-800 text-white hover:bg-gray-700"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-none px-3 bg-gray-800 text-white hover:bg-gray-700"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-gray-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 p-2 rounded-full">
                <FolderOpen className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.totalFiles}</p>
                <p className="text-sm text-gray-600">Total archivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 p-2 rounded-full">
                <HardDrive className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{formatFileSize(stats.totalSize)}</p>
                <p className="text-sm text-gray-600">Espacio usado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 p-2 rounded-full">
                <CheckCircle className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.statusCount.approved || 0}</p>
                <p className="text-sm text-gray-600">Documentos aprobados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-gray-200 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-gray-200 p-2 rounded-full">
                <BookOpen className="h-5 w-5 text-gray-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.axisCount.governance || 0}</p>
                <p className="text-sm text-gray-600">Documentos de gobernabilidad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="border border-gray-200 shadow-md rounded-xl">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar por nombre, descripción o etiquetas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-5 rounded-lg border border-gray-200"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Tipo de archivo</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full py-5 rounded-lg border border-gray-200">
                    <SelectValue placeholder="Todos los tipos" />
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

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full py-5 rounded-lg border border-gray-200">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="review">En revisión</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                    <SelectItem value="formulation">Formulación</SelectItem>
                    <SelectItem value="implementation">Implementación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Eje estratégico</label>
                <Select value={filterAxis} onValueChange={setFilterAxis}>
                  <SelectTrigger className="w-full py-5 rounded-lg border border-gray-200">
                    <SelectValue placeholder="Todos los ejes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los ejes</SelectItem>
                    <SelectItem value="governance">Gobernabilidad</SelectItem>
                    <SelectItem value="economy">Economía</SelectItem>
                    <SelectItem value="environment">Medio Ambiente</SelectItem>
                    <SelectItem value="social">Desarrollo Social</SelectItem>
                    <SelectItem value="territorial">Ordenamiento Territorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="border border-gray-200 shadow-md rounded-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <FileText className="h-5 w-5 text-gray-800" />
                Lista de Archivos
                <Badge variant="secondary" className="ml-2 bg-gray-800 text-white">
                  {filteredFiles.length} archivos
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1 text-gray-600">
                {filteredFiles.length !== files.length && 
                  `Mostrando ${filteredFiles.length} de ${files.length} archivos`
                }
              </CardDescription>
            </div>
            <Select 
              value={`${sortBy}-${sortOrder}`} 
              onValueChange={(value) => {
                const [field, order] = value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
            >
              <SelectTrigger className="w-48 py-5 rounded-lg border border-gray-200">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                <SelectItem value="size-desc">Tamaño (Mayor)</SelectItem>
                <SelectItem value="size-asc">Tamaño (Menor)</SelectItem>
                <SelectItem value="date-desc">Fecha (Reciente)</SelectItem>
                <SelectItem value="date-asc">Fecha (Antigua)</SelectItem>
                <SelectItem value="responsible-asc">Responsable (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredFiles.length > 0 ? (
            viewMode === "table" ? (
              // Vista tabla
              <div className="space-y-4">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader className="bg-gray-100">
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-200 py-4 text-gray-800 font-semibold"
                          onClick={() => toggleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Archivo
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-200 py-4 text-gray-800 font-semibold"
                          onClick={() => toggleSort("size")}
                        >
                          <div className="flex items-center gap-1">
                            Tamaño
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-gray-200 py-4 text-gray-800 font-semibold"
                          onClick={() => toggleSort("date")}
                        >
                          <div className="flex items-center gap-1">
                            Última modificación
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-gray-800 font-semibold">Tipo</TableHead>
                        <TableHead className="text-gray-800 font-semibold">Eje</TableHead>
                        <TableHead className="text-gray-800 font-semibold">Estado</TableHead>
                        <TableHead className="text-right text-gray-800 font-semibold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFiles.map((file) => (
                        <TableRow key={file.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {getFileIcon(file.filename)}
                              <div>
                                <div className="font-medium text-gray-800">{file.filename}</div>
                                {file.title && <div className="text-xs text-gray-500 mt-1">{file.title}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-700">{formatFileSize(file.size)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="h-3 w-3" />
                              {formatDate(file.updated)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                              {file.filename.split('.').pop()?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-gray-700">
                              {STRATEGIC_AXES[file.axis].icon}
                              <span>{STRATEGIC_AXES[file.axis].label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={DOC_STATUS[file.status].color}>
                              {DOC_STATUS[file.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 text-gray-800"
                                    onClick={() => setSelectedFile(file)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                              </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(file.path, file.filename)}
                                className="gap-1 rounded-full px-3 bg-gray-800 text-white hover:bg-gray-700 border-gray-800"
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

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                  {filteredFiles.map((file) => (
                    <Card key={file.id} className="border border-gray-200 shadow-sm rounded-lg">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              {getFileIcon(file.filename)}
                              <div className="min-w-0">
                                <p className="font-medium truncate text-gray-800">{file.filename}</p>
                                {file.title && <p className="text-xs text-gray-500 truncate mt-1">{file.title}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                                {file.filename.split('.').pop()?.toUpperCase()}
                              </Badge>
                              <Badge variant="secondary" className={DOC_STATUS[file.status].color}>
                                {DOC_STATUS[file.status].label}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(file.updated)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              {STRATEGIC_AXES[file.axis].icon}
                              <span>{STRATEGIC_AXES[file.axis].label}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-1 gap-1 bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
                                  onClick={() => setSelectedFile(file)}
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver detalles
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(file.path, file.filename)}
                              className="flex-1 gap-1 bg-gray-800 text-white border-gray-800 hover:bg-gray-700"
                            >
                              <Download className="h-4 w-4" />
                              Descargar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              // Vista grid
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredFiles.map((file) => (
                  <Card 
                    key={file.id} 
                    className="border border-gray-200 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-all"
                  >
                    <div className="p-1 bg-gray-100">
                      <div className="flex justify-center py-4">
                        {getFileIcon(file.filename)}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium truncate text-gray-800" title={file.filename}>
                            {file.filename}
                          </p>
                          {file.title && <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {file.title}
                          </p>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(file.updated)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            {STRATEGIC_AXES[file.axis].icon}
                            <span>{STRATEGIC_AXES[file.axis].label}</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-2">
                          <Badge variant="secondary" className={DOC_STATUS[file.status].color}>
                            {DOC_STATUS[file.status].label}
                          </Badge>
                          
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800"
                                  onClick={() => setSelectedFile(file)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(file.path, file.filename)}
                              className="rounded-full p-1.5 bg-gray-800 text-white hover:bg-gray-700 border-gray-800"
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
            <div className="text-center py-12">
              <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-800">No se encontraron archivos</p>
              <p className="text-gray-600 max-w-md mx-auto mt-2">
                {searchTerm || filterType !== "all" || filterStatus !== "all" || filterAxis !== "all"
                  ? "Intenta ajustar los filtros de búsqueda o restablecer los filtros"
                  : "No hay documentos almacenados en el sistema"
                }
              </p>
              <Button 
                variant="outline" 
                className="mt-4 gap-2 bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("all");
                  setFilterStatus("all");
                  setFilterAxis("all");
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Restablecer filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para detalles del archivo */}
      {selectedFile && (
        <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
          <DialogContent className="sm:max-w-3xl rounded-xl p-0 max-h-[90vh] flex flex-col">
            <DialogHeader className="bg-gray-100 p-6 rounded-t-xl">
              <DialogTitle className="flex items-center gap-3 text-gray-800">
                <FileText className="h-6 w-6 text-gray-800" />
                <span>Detalle del Documento</span>
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Información completa del documento seleccionado
              </DialogDescription>
            </DialogHeader>
            
            <div className="overflow-y-auto p-6 space-y-6 flex-grow">
              {/* Información Básica */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <FilePlus className="h-5 w-5 text-gray-800" />
                    <h3 className="font-semibold text-gray-800">Información Básica</h3>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Título</p>
                    <p className="font-medium text-gray-800">{selectedFile.title || selectedFile.filename}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipo</p>
                    <p className="font-medium text-gray-800">{selectedFile.type || "Documento"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Eje</p>
                    <div className="flex items-center gap-1 text-gray-800">
                      {STRATEGIC_AXES[selectedFile.axis].icon}
                      <span className="font-medium">{STRATEGIC_AXES[selectedFile.axis].label}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estatus</p>
                    <Badge variant="secondary" className={`${DOC_STATUS[selectedFile.status].color} font-medium`}>
                      {DOC_STATUS[selectedFile.status].label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              {/* Responsable */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-800" />
                    <h3 className="font-semibold text-gray-800">Responsable</h3>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Unidad</p>
                    <p className="font-medium text-gray-800">{selectedFile.responsible}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Creado por</p>
                    <p className="font-medium text-gray-800">{selectedFile.createdBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de creación</p>
                    <p className="font-medium text-gray-800">{formatSimpleDate(selectedFile.created)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Última modificación</p>
                    <p className="font-medium text-gray-800">{formatSimpleDate(selectedFile.updated)}</p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Descripción */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-800" />
                    <h3 className="font-semibold text-gray-800">Descripción</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{selectedFile.description}</p>
                </CardContent>
              </Card>
              
              {/* Archivos */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <File className="h-5 w-5 text-gray-800" />
                    <h3 className="font-semibold text-gray-800">Archivos</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFile.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {file.type === "pdf" && <FileText className="h-5 w-5 text-gray-800" />}
                        {file.type === "docx" && <FileText className="h-5 w-5 text-gray-800" />}
                        {file.type === "xlsx" && <FileSpreadsheet className="h-5 w-5 text-gray-800" />}
                        {file.type === "pptx" && <FileBarChart className="h-5 w-5 text-gray-800" />}
                        <span className="font-medium text-gray-800">{file.name}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(`/docs/${file.name}`, file.name)}
                        className="gap-1 bg-gray-800 text-white hover:bg-gray-700 border-gray-800"
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
              
              {/* Historial de Cambios */}
              <Card className="border border-gray-200">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-800" />
                      <h3 className="font-semibold text-gray-800">Historial de Cambios</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                      className="text-gray-500"
                    >
                      {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                {showHistory && (
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-100">
                          <TableRow>
                            <TableHead className="text-gray-800 font-semibold">Fecha</TableHead>
                            <TableHead className="text-gray-800 font-semibold">Usuario</TableHead>
                            <TableHead className="text-gray-800 font-semibold">Acción</TableHead>
                            <TableHead className="text-gray-800 font-semibold">Detalle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedFile.history.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-gray-700">{item.date}</TableCell>
                              <TableCell className="text-gray-700">{item.user}</TableCell>
                              <TableCell className="text-gray-700">{item.action}</TableCell>
                              <TableCell className="text-gray-700">{item.detail}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <Button 
                variant="outline" 
                onClick={() => setSelectedFile(null)}
                className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
              >
                Cerrar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload(selectedFile.path, selectedFile.filename)}
                className="gap-1 bg-gray-800 text-white hover:bg-gray-700 border-gray-800"
              >
                <Download className="h-4 w-4" />
                Descargar documento principal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}