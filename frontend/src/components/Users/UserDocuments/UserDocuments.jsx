import React, { useEffect, useState, useMemo } from "react";
import { documentsAPI, authAPI } from "@/services/api";
import { toast } from "sonner";
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  FileText,
  Calendar,
  HardDrive
} from "lucide-react";
import { groupVersionedDocuments } from "@/lib/documentUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Reutilizar componentes existentes del admin
import PreviewFileDialog from "@/components/Admin/ModuloDocuments/PreviewFileDialog";
import ConfirmDeleteDialog from "@/components/Admin/ModuloDocuments/ConfirmDeleteDialog";
import DocumentsTable from "@/components/Admin/ModuloDocuments/DocumentsTable";
import DocumentsGrid from "@/components/Admin/ModuloDocuments/DocumentsGrid";
import DocumentToolbar from "@/components/Admin/ModuloDocuments/DocumentToolbar";

// Modal de subida mejorado
import UploadModal from "./UploadModal";

const ITEMS_PER_PAGE = 20;

export default function UserDocuments() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeContent, setTypeContent] = useState("all");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [sortBy, setSortBy] = useState("updated");
  const [sortOrder, setSortOrder] = useState("desc");
  const [previewFile, setPreviewFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    file: null,
  });
  const [viewMode, setViewMode] = useState("list");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDepartment, setUserDepartment] = useState("");
  const [isDirectorEjecutivo, setIsDirectorEjecutivo] = useState(false);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    fetchFiles();
    getUserDepartment();
  }, []);

  

  const getUserDepartment = async () => {
    try {
      // Intentar obtener datos del usuario desde la API
      const response = await authAPI.getCurrentUser();
      if (response.data && response.data.role) {
        const departmentName = getDepartmentDisplayName(response.data.role);
        setUserDepartment(departmentName);
        // Verificar si es Dirección Ejecutiva
        const isDirector = response.data.role === "Dirección Ejecutiva" || 
                         response.data.role === "DireccionEjecutiva";
        setIsDirectorEjecutivo(isDirector);
        return;
      }
    } catch (error) {
      console.warn("Error obteniendo datos del usuario desde API:", error);
    }
    
    // Fallback: usar localStorage
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        const departmentName = getDepartmentDisplayName(parsedUser.role);
        setUserDepartment(departmentName);
        // Verificar si es Dirección Ejecutiva
        const isDirector = parsedUser.role === "Dirección Ejecutiva" || 
                         parsedUser.role === "DireccionEjecutiva";
        setIsDirectorEjecutivo(isDirector);
      }
    } catch (error) {
      console.error("Error obteniendo departamento:", error);
    }
  };

  const getDepartmentDisplayName = (role) => {
    const roleNames = {
      //admin: "Administración",
      "Dirección Ejecutiva": "Dirección Ejecutiva",
      "Coordinador Administrativa": "Coordinador Administrativa",
      "Coordinación Proyectos y Planificación": "Coordinación Proyectos y Planificación", 
      "Coordinación de Comunicaciones": "Coordinación de Comunicaciones",
      "Asistencia General": "Asistencia General",
      // También mantener compatibilidad con los nombres antiguos
      DireccionEjecutiva: "Dirección Ejecutiva",
      CoordinadorAdministrativa: "Coordinador Administrativa",
      CoordinacionProyectosPlanificacion: "Coordinación Proyectos y Planificación",
      CoordinacionComunicaciones: "Coordinación de Comunicaciones",
      AsistenciaGeneral: "Asistencia General"
    };
    return roleNames[role] || role || "Departamento";
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Prefer new documents endpoint (Meilisearch with Firestore fallback)
      const res = await documentsAPI.list();
      const data = res?.data || {};
      const items = data.files || data.documents || data.hits || [];
      // Normalize minimal fields expected by the table
      const normalized = items.map((d) => {
        const rawPath = d.storage_path || d.path || "";
        const nameFromPath = rawPath ? rawPath.split("/").pop() : "";
        return {
          // Prefer filename from storage path to keep version suffix (_vN)
          filename: nameFromPath || d.filename || d.original_filename || d.title || "",
          size: d.size ?? d.file_size_bytes ?? 0,
          updated: d.updated || d.updated_at || d.created_at || d.date || d.upload_timestamp,
          path: rawPath,
          tipo: d.tipo || d.tipo_documento || "",
          categoria: d.categoria || d.apartado || "",
          public: d.public ?? d.publico ?? false,
        };
      });
      setFiles(normalized);
    } catch (error) {
      console.error(error);
      setFiles([]);
      toast.error("Error al obtener los archivos.");
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setTypeContent("all");
    setDateRange({ from: null, to: null });
    setCurrentPage(1);
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const sortedFiles = useMemo(() => {
    // First sort the files
    const sorted = [...files].sort((a, b) => {
      let valA = a[sortBy],
        valB = b[sortBy];
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
    
    // Then group versioned files
    return groupVersionedDocuments(sorted);
  }, [files, sortBy, sortOrder]);

  const filteredFiles = useMemo(() => {
    return sortedFiles.filter((f) => {
      const matchesSearch = (f.filename || "")
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesTypeFilter =
        typeFilter === "all" ||
        (f.filename || "").toLowerCase().endsWith(`.${typeFilter}`);
      const matchesContentType =
        typeContent === "all" || (f.tipo || "").toLowerCase() === typeContent;
      const updatedAt = new Date(f.updated);
      const inDateRange =
        (!dateRange.from || updatedAt >= new Date(dateRange.from)) &&
        (!dateRange.to || updatedAt <= new Date(dateRange.to));

      return (
        matchesSearch && matchesTypeFilter && matchesContentType && inDateRange
      );
    });
  }, [sortedFiles, search, typeFilter, typeContent, dateRange]);

  // Cálculos de paginación
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFiles = filteredFiles.slice(startIndex, endIndex);

  // Funciones de navegación de paginación
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPrevPage = () => setCurrentPage(Math.max(1, currentPage - 1));
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1));

  // Generar array de números de página para mostrar
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const stats = {
    total: files.length,
    totalSize: formatSize(files.reduce((acc, f) => acc + (f.size || 0), 0)),
    filteredCount: filteredFiles.length,
    currentShowing: currentFiles.length,
  };

  const handleDownload = async (path, filename) => {
    try {
      const response = await documentsAPI.downloadByPath(path);
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo descargado correctamente");
    } catch {
      toast.error("Error al descargar el archivo");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.file || !isDirectorEjecutivo) {
      if (!isDirectorEjecutivo) {
        toast.error("Solo Dirección Ejecutiva puede eliminar archivos");
      }
      setConfirmDelete({ open: false, file: null });
      return;
    }
    
    try {
      setLoading(true);
      const path = confirmDelete.file.path;
      
      // 1. Eliminar el archivo del bucket de Firebase Storage
      await documentsAPI.deleteByPath(path);
      
      // 2 y 3. La API deleteByPath se encarga de eliminar también de Meilisearch y Firestore
      toast.success("Documento eliminado correctamente");
      
      // Actualizar la lista de archivos
      await fetchFiles();
      
      setConfirmDelete({ open: false, file: null });
    } catch (error) {
      console.error("Error al eliminar el documento:", error);
      toast.error("Error al eliminar el documento");
    } finally {
      setLoading(false);
    }
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header con información del departamento */}
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-600">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Documentos del Departamento: <span className="text-blue-600">{userDepartment}</span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredFiles.length} documento{filteredFiles.length !== 1 ? 's' : ''} disponible{filteredFiles.length !== 1 ? 's' : ''}
              </p>
            </div>
            <UploadModal
              open={uploadModalOpen}
              setOpen={setUploadModalOpen}
              onUploaded={fetchFiles}
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Documentos</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Espacio Usado</p>
                  <p className="text-2xl font-bold">{stats.totalSize}</p>
                </div>
                <HardDrive className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mostrando</p>
                  <p className="text-2xl font-bold">
                    {stats.currentShowing} de {stats.filteredCount}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        <DocumentToolbar
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          typeContent={typeContent}
          setTypeContent={setTypeContent}
          dateRange={dateRange}
          setDateRange={setDateRange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onRefresh={fetchFiles}
          clearAllFilters={clearAllFilters}
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : currentFiles.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {filteredFiles.length === 0 
                ? "No hay documentos que coincidan con los filtros aplicados."
                : "No hay documentos en esta página."}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <DocumentsTable
            files={currentFiles}
            handleSort={handleSort}
            sortBy={sortBy}
            setPreviewFile={setPreviewFile}
            setConfirmDelete={setConfirmDelete}
            handleDownload={handleDownload}
            formatSize={formatSize}
            formatDate={formatDate}
            isDirectorEjecutivo={isDirectorEjecutivo}
          />
        ) : (
          <DocumentsGrid
            files={currentFiles}
            formatDate={formatDate}
            formatSize={formatSize}
            handleDownload={handleDownload}
            setPreviewFile={setPreviewFile}
            setConfirmDelete={setConfirmDelete}
            isDirectorEjecutivo={isDirectorEjecutivo}
          />
        )}

        {/* Controles de Paginación */}
        {filteredFiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Información de paginación */}
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredFiles.length)} de {filteredFiles.length} documentos
              </div>

              {/* Controles de navegación */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  title="Primera página"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  title="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Números de página */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pageNum, idx) => (
                    pageNum === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="min-w-[36px]"
                      >
                        {pageNum}
                      </Button>
                    )
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  title="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  title="Última página"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Selector de items por página */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar:</span>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <PreviewFileDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          handleDownload={handleDownload}
          formatSize={formatSize}
          formatDate={formatDate}
        />

        <ConfirmDeleteDialog
          open={confirmDelete.open}
          file={confirmDelete.file}
          onCancel={() => setConfirmDelete({ open: false, file: null })}
          onConfirm={handleDelete}
        />
      </div>
    </>
  );
}