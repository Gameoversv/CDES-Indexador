import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
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
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentSearch } from "@/hooks/useDocumentSearch";

import UploadDocumentDialog from "@/components/Admin/ModuloDocuments/UploadDocumentDialog";
import PreviewFileDialog from "@/components/Admin/ModuloDocuments/PreviewFileDialog";
import ConfirmDeleteDialog from "@/components/Admin/ModuloDocuments/ConfirmDeleteDialog";
import DocumentsTable from "@/components/Admin/ModuloDocuments/DocumentsTable";
import DocumentsGrid from "@/components/Admin/ModuloDocuments/DocumentsGrid";
import DocumentToolbar from "@/components/Admin/ModuloDocuments/DocumentToolbar";

export default function AdminDocuments() {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeContent, setTypeContent] = useState("all");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [sortBy, setSortBy] = useState("updated"); // ✅ Cambiar de "filename" a "updated"
  const [sortOrder, setSortOrder] = useState("desc"); // ✅ Cambiar de "asc" a "desc"
  const [previewFile, setPreviewFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    file: null,
  });
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDepartment, setUserDepartment] = useState("Administración");
  const [isDirectorEjecutivo, setIsDirectorEjecutivo] = useState(false);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Hook de búsqueda
  const {
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    setSearch: setSearchQuery,
    clearSearch,
    hasSearchQuery
  } = useDocumentSearch();

  useEffect(() => {
    fetchFiles();
    getUserDepartment();
  }, []);

  // Sincronizar el estado de búsqueda local con el hook de búsqueda
  useEffect(() => {
    setSearchQuery(search);
  }, [search, setSearchQuery]);

  const { userRole } = useAuth();

  const getUserDepartment = async () => {
    try {
      // Verificamos si el usuario es Director Ejecutivo
      if (userRole === "DireccionEjecutiva") {
        setIsDirectorEjecutivo(true);
      }

      // For admin, we'll always use "Administración" but we'll try to get the actual admin name
      const response = await authAPI.getCurrentUser();
      if (response.data) {
        if (response.data.admin) {
          setUserDepartment("Administración");
        }
        // Verificar si el rol en los datos del usuario es Director Ejecutivo
        if (response.data.role === "DireccionEjecutiva" || response.data.role === "Dirección Ejecutiva") {
          setIsDirectorEjecutivo(true);
        }
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
        if (parsedUser.admin) {
          setUserDepartment("Administración");
        }
        // Verificar si el rol en localStorage es Director Ejecutivo
        if (parsedUser.role === "DireccionEjecutiva" || parsedUser.role === "Dirección Ejecutiva") {
          setIsDirectorEjecutivo(true);
        }
      }
    } catch (error) {
      console.error("Error obteniendo departamento:", error);
    }
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
          filename: nameFromPath || d.filename || d.original_filename || d.title || "",
          size: d.size ?? d.file_size_bytes ?? 0,
          updated: d.updated || d.updated_at || d.created_at || d.date || d.upload_timestamp,
          path: rawPath,
          tipo: d.tipo || d.tipo_documento || "",
          categoria: d.categoria || d.apartado || "",
          public: d.public ?? d.publico ?? false,
        };
      });
      // Agrupar documentos versionados (original + _vN) para mostrar como una sola entrada con lista de versiones
      try {
        const grouped = groupVersionedDocuments(normalized);
        setFiles(grouped);
      } catch (err) {
        console.warn('[AdminDocuments] Error agrupando versiones, usando lista plana:', err);
        setFiles(normalized);
      }
    } catch (error) {
      console.error("❌ [AdminDocuments] Error:", error);
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
    clearSearch(); // Limpiar también la búsqueda de Meilisearch
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
  };

  const sortedFiles = useMemo(() => {
    // Usar los resultados de búsqueda si hay una búsqueda activa, sino usar los archivos cargados
    const sourceFiles = hasSearchQuery ? searchResults : files;
    
    return [...sourceFiles].sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      
      if (sortBy === "updated") {
        // Manejo mejorado de fechas - Invalid Date al final
        const dateA = new Date(valA || 0);
        const dateB = new Date(valB || 0);
        
        // Verificar si las fechas son válidas
        const isValidA = !isNaN(dateA.getTime());
        const isValidB = !isNaN(dateB.getTime());
        
        // Si ambas son inválidas, mantener orden original
        if (!isValidA && !isValidB) return 0;
        
        // Si solo A es inválida, B va primero
        if (!isValidA) return sortOrder === "desc" ? 1 : -1;
        
        // Si solo B es inválida, A va primero  
        if (!isValidB) return sortOrder === "desc" ? -1 : 1;
        
        // Ambas son válidas, comparar normalmente
        valA = dateA;
        valB = dateB;
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
  }, [files, searchResults, hasSearchQuery, sortBy, sortOrder]);

  // Filtrado SIMPLIFICADO - solo buscar en categoria
  const filteredFiles = useMemo(() => {
    return sortedFiles.filter((f) => {
      // Si hay búsqueda activa, no aplicar filtro de búsqueda local adicional
      // ya que los resultados vienen de Meilisearch/Firestore
      const matchesSearch = hasSearchQuery ? true : (f.filename || "")
        .toLowerCase()
        .includes(search.toLowerCase());
        
      const matchesTypeFilter =
        typeFilter === "all" ||
        (f.filename || "").toLowerCase().endsWith(`.${typeFilter}`);
        
      // SOLO buscar en categoria
      const matchesContentType = typeContent === "all" || f.categoria === typeContent;
      
      const updatedAt = new Date(f.updated);
      const inDateRange =
        (!dateRange.from || updatedAt >= new Date(dateRange.from)) &&
        (!dateRange.to || updatedAt <= new Date(dateRange.to));

      // Debug solo cuando hay filtro activo
      if (typeContent !== "all") {
        console.log(`🔍 [AdminDocuments] ${f.filename}: categoria="${f.categoria}", buscando="${typeContent}", match=${matchesContentType}`);
      }

      return matchesSearch && matchesTypeFilter && matchesContentType && inDateRange;
    });
  }, [sortedFiles, search, hasSearchQuery, typeFilter, typeContent, dateRange]);

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
    // Indicador de búsqueda activa
    isSearchActive: hasSearchQuery,
    searchQuery: searchQuery
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
    if (!confirmDelete.file) return;
    
    // Verificar que el usuario tenga permisos para eliminar (Director Ejecutivo)
    if (!isDirectorEjecutivo) {
      toast.error("No tienes permisos para eliminar documentos");
      setConfirmDelete({ open: false, file: null });
      return;
    }
    
    // Establecer estado de procesamiento
    setDeleteProcessing(true);
    
    try {
      await documentsAPI.deleteByPath(confirmDelete.file.path);
      toast.success("Archivo eliminado correctamente");
      await fetchFiles();
    } catch {
      toast.error("Error al eliminar archivo");
    } finally {
      setDeleteProcessing(false);
      setConfirmDelete({ open: false, file: null });
    }
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header con información del departamento */}
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-600">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Panel de Administración: <span className="text-blue-600">{userDepartment}</span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.isSearchActive ? (
                  <>Búsqueda: "{stats.searchQuery}" - {filteredFiles.length} resultado{filteredFiles.length !== 1 ? 's' : ''} encontrado{filteredFiles.length !== 1 ? 's' : ''}</>
                ) : (
                  <>{filteredFiles.length} documento{filteredFiles.length !== 1 ? 's' : ''} disponible{filteredFiles.length !== 1 ? 's' : ''}</>
                )}
              </p>
            </div>
            <UploadDocumentDialog
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

        {loading || isSearching ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-muted-foreground">
              {isSearching ? "Buscando..." : "Cargando..."}
            </span>
          </div>
        ) : currentFiles.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">
              {filteredFiles.length === 0 
                ? (stats.isSearchActive 
                    ? `No se encontraron documentos que coincidan con "${stats.searchQuery}"`
                    : "No hay documentos que coincidan con los filtros aplicados.")
                : "No hay documentos en esta página."}
            </p>
            {searchError && (
              <p className="text-red-500 text-sm mt-2">
                Error en la búsqueda: {searchError}
              </p>
            )}
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
          onClose={() => setConfirmDelete({ open: false, file: null })}
          onConfirm={handleDelete}
          filename={confirmDelete.file?.filename} // Verificar que esta prop tenga valor
          file={confirmDelete.file} // respaldo si filename no funciona
          processing={deleteProcessing}
        />
      </div>
    </AdminLayout>
  );
}
