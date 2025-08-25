import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { libraryAPI, documentsAPI } from "@/services/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import LibraryToolbar from "./LibraryToolbar";
import LibraryStatsCards from "./LibraryStatsCards";
import LibraryTable from "./LibraryTable";
import LibraryGridView from "./LibraryGridView";
import PreviewFileDialog from "../ModuloDocuments/PreviewFileDialog";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

import Pagination from "@/components/ui/Pagination";

// Función helper para formatear bytes (añadir al inicio del archivo)
const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function AdminLibrary() {
  const [documents, setDocuments] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeContent, setTypeContent] = useState("all");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortBy, setSortBy] = useState({ field: "name", direction: "asc" });
  const [statType, setStatType] = useState("pdf");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Obtener documentos usando Meilisearch con búsqueda en tiempo real
  const fetchData = async (q = "") => {
    setLoading(true);
    try {
      let data;
      if (q) {
        const res = await libraryAPI.search(q);
        data = Array.isArray(res?.data?.hits) ? res.data.hits : [];
      } else {
        data = await libraryAPI.list();
      }
      // Normalizar campos desde Meilisearch para que la UI use claves consistentes
      const normalized = (Array.isArray(data) ? data : []).map((d) => {
        const filename = d.filename || d.name || "";
        const ext = (d.file_extension || (filename.includes(".") ? `.${filename.split(".").pop()}` : "")).toLowerCase();
        return {
          ...d,
          // Normalizados
          name: filename, // mantener compatibilidad con componentes
          filename,
          categoria: d.categoria || d.tipo || "",
          tipo: d.categoria || d.tipo || "", // compat con UI actual
          file_extension: ext, // incluir el punto (como viene en Meili)
          updated: d.upload_timestamp || d.updated || d.processing_timestamp || null,
        };
      });
      setDocuments(normalized);
    } catch (error) {
      console.error("Error al cargar documentos:", error);
      toast.error(q ? "Error al buscar documentos." : "Error al cargar biblioteca.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Llamada inicial y en cambios de búsqueda (con debounce)
  useEffect(() => {
    const timer = setTimeout(() => fetchData(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setTypeContent("all");
    setDateRange({ from: null, to: null });
    setCurrentPage(1);
  };

  // Filtrado solo por formato, tipo y rango de fechas; la búsqueda por texto ya se hace en backend
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // formato desde metadato file_extension (".pdf"), comparar sin punto
        const matchesFormat =
          typeFilter === "all" ||
          (doc.file_extension || "").replace(".", "").toLowerCase() === typeFilter;

        // tipo desde categoria
        const matchesContent =
          typeContent === "all" ||
          (doc.categoria || doc.tipo || "").toLowerCase() === typeContent;

        // fecha desde upload_timestamp (normalizada a 'updated')
        const updatedAt = doc.updated ? new Date(doc.updated) : null;
        const inDateRange =
          !updatedAt || (
            (!dateRange.from || updatedAt >= new Date(dateRange.from)) &&
            (!dateRange.to || updatedAt <= new Date(dateRange.to))
          );

        return matchesFormat && matchesContent && inDateRange;
      })
      .sort((a, b) => {
        const aVal = a[sortBy.field];
        const bVal = b[sortBy.field];
        // sort genérico con fechas si el campo es 'updated'
        let valA = aVal;
        let valB = bVal;
        if (sortBy.field === "updated") {
          valA = a.updated ? new Date(a.updated).getTime() : 0;
          valB = b.updated ? new Date(b.updated).getTime() : 0;
        } else {
          valA = (valA ?? "").toString().toLowerCase();
          valB = (valB ?? "").toString().toLowerCase();
        }
        if (sortBy.direction === "asc") return valA > valB ? 1 : valA < valB ? -1 : 0;
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      });
  }, [documents, typeFilter, typeContent, dateRange, sortBy]);

  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: documents.length,
    totalSize: formatSize(documents.reduce((acc, doc) => acc + (doc.file_size_bytes || doc.size || 0), 0)),
    pdf: documents.filter((d) => (d.file_extension || "").toLowerCase() === ".pdf").length,
    docx: documents.filter((d) => (d.file_extension || "").toLowerCase() === ".docx").length,
    xlsx: documents.filter((d) => (d.file_extension || "").toLowerCase() === ".xlsx").length,
    pptx: documents.filter((d) => (d.file_extension || "").toLowerCase() === ".pptx").length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Gestión de Biblioteca Pública
          </h2>
        </div>

        {/* Estadísticas */}
        <LibraryStatsCards
          stats={stats}
          statType={statType}
          setStatType={setStatType}
        />

        {/* Filtros */}
        <LibraryToolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          typeContent={typeContent}
          setTypeContent={setTypeContent}
          dateRange={dateRange}
          setDateRange={setDateRange}
          // onRefresh vuelve a cargar con la búsqueda actual
          onRefresh={() => fetchData(search)}
          clearAllFilters={clearAllFilters}
        />

        {/* Vista principal */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <p className="text-center text-gray-500">
            No hay documentos para mostrar.
          </p>
        ) : viewMode === "grid" ? (
          <LibraryGridView
            documents={paginatedDocs}
            onView={setSelectedDoc}
            onDelete={setShowDeleteDialog}
            onDownload={(file) =>
              documentsAPI.downloadByPath(file.storage_path || file.path).then((res) => {
                const url = window.URL.createObjectURL(res.data);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.name || file.filename || "documento";
                a.click();
              }).catch(error => {
                console.error("Error al descargar:", error);
                toast.error("Error al descargar el documento");
              })
            }
          />
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <LibraryTable
              files={paginatedDocs}
              onView={setSelectedDoc}
              onDelete={setShowDeleteDialog}
              onDownload={(file) =>
                documentsAPI.downloadByPath(file.storage_path || file.path).then((res) => {
                  const url = window.URL.createObjectURL(res.data);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file.name || file.filename || "documento";
                  a.click();
                }).catch(error => {
                  console.error("Error al descargar:", error);
                  toast.error("Error al descargar el documento");
                })
              }
              sortKey={sortBy.field}
              sortOrder={sortBy.direction}
              onSort={(field, direction) =>
                setSortBy({ field, direction })
              }
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredDocs.length}
            />
          </div>
        )}

        {/* Vista previa */}
        {selectedDoc && (
          <PreviewFileDialog
            file={selectedDoc}
            onClose={() => setSelectedDoc(null)}
          />
        )}

        {/* Confirmación de eliminación */}
        {showDeleteDialog && selectedDoc && (
          <ConfirmDeleteDialog
            open={showDeleteDialog}
            setOpen={setShowDeleteDialog}
            fileName={selectedDoc.name}
            onConfirm={async () => {
              await libraryAPI.deleteByPath(selectedDoc.path);
              fetchData();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
