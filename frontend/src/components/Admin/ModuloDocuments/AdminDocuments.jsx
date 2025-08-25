import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { documentsAPI } from "@/services/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import UploadDocumentDialog from "@/components/Admin/ModuloDocuments/UploadDocumentDialog";
import PreviewFileDialog from "@/components/Admin/ModuloDocuments/PreviewFileDialog";
import ConfirmDeleteDialog from "@/components/Admin/ModuloDocuments/ConfirmDeleteDialog";
import DocumentsTable from "@/components/Admin/ModuloDocuments/DocumentsTable";
import DocumentsGrid from "@/components/Admin/ModuloDocuments/DocumentsGrid";
import DocumentToolbar from "@/components/Admin/ModuloDocuments/DocumentToolbar";
import DocumentStatsCard from "@/components/Admin/ModuloDocuments/DocumentStatsCard";
import Pagination from "@/components/ui/Pagination";

export default function AdminDocuments() {
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
  const [statType, setStatType] = useState("pdf");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchFiles();
  }, []);

  // Resetea página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [typeContent, search, typeFilter, dateRange]);

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
      const res = await documentsAPI.list();
      const data = res?.data || {};
      const items = data.files || data.documents || data.hits || [];
      
      if (items.length > 0) {
        console.log("[AdminDocuments] Primer item:", items[0]);
        console.log("[AdminDocuments] Campo categoria del primer item:", items[0].categoria);
      }
      
      // Normalización SIMPLIFICADA - solo usar categoria
      const normalized = items.map((d) => {
        const rawPath = d.storage_path || d.path || "";
        const nameFromPath = rawPath ? rawPath.split("/").pop() : "";
        
        
        return {
          filename: nameFromPath || d.filename || d.original_filename || d.title || "",
          size: d.size ?? d.file_size_bytes ?? 0,
          updated: d.updated || d.updated_at || d.created_at || d.date || d.upload_timestamp,
          path: rawPath,
          categoria: d.categoria || "",
          public: d.public ?? d.publico ?? false,
        };
      });
      
      
      setFiles(normalized);
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
    return [...files].sort((a, b) => {
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
  }, [files, sortBy, sortOrder]);

  // Filtrado SIMPLIFICADO - solo buscar en categoria
  const filteredFiles = useMemo(() => {
    
    return sortedFiles.filter((f) => {
      const matchesSearch = (f.filename || "")
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
  }, [sortedFiles, search, typeFilter, typeContent, dateRange]);

  // Tipos disponibles SIMPLIFICADO - solo de categoria
  const availableTypes = useMemo(() => {
    const types = new Set();
    
    files.forEach(file => {
      if (file.categoria && file.categoria !== "") {
        types.add(file.categoria);
      }
    });
    
    const sortedTypes = Array.from(types).sort();
    
    return sortedTypes;
  }, [files]);

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
    filteredCount: files.filter((f) =>
      f.filename?.toLowerCase().endsWith(`.${statType}`)
    ).length,
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
    } catch {
      toast.error("Error al descargar el archivo");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.file) return;
    try {
      await documentsAPI.deleteByPath(confirmDelete.file.path);
      toast.success("Archivo eliminado correctamente");
      fetchFiles();
    } catch {
      toast.error("Error al eliminar archivo");
    } finally {
      setConfirmDelete({ open: false, file: null });
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Gestión de Documentos
        </h2>
        <UploadDocumentDialog
          open={uploadModalOpen}
          setOpen={setUploadModalOpen}
          onUploaded={fetchFiles}
        />
      </div>

      <DocumentStatsCard
        stats={stats}
        statType={statType}
        setStatType={setStatType}
      />

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
          availableTypes={availableTypes} // Pasar tipos dinámicos
        />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <p className="text-center text-gray-500 py-10">
          No hay documentos para mostrar.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {viewMode === "list" ? (
            <DocumentsTable
              files={paginatedFiles}
              handleSort={handleSort}
              sortBy={sortBy}
              setPreviewFile={setPreviewFile}
              setConfirmDelete={setConfirmDelete}
              handleDownload={handleDownload}
              formatSize={formatSize}
              formatDate={formatDate}
            />
          ) : (
            <DocumentsGrid
              files={paginatedFiles}
              formatDate={formatDate}
              formatSize={formatSize}
              handleDownload={handleDownload}
              setPreviewFile={setPreviewFile}
              setConfirmDelete={setConfirmDelete}
            />
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredFiles.length}
          />
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
    </AdminLayout>
  );
}
