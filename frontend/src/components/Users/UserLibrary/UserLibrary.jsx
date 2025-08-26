import React, { useState, useEffect, useMemo } from "react";
import { libraryAPI, documentsAPI } from "@/services/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Re-using components from Admin library with minor modifications
import LibraryToolbar from "../../Admin/ModuloLibrary/LibraryToolbar";
import LibraryStatsCards from "../../Admin/ModuloLibrary/LibraryStatsCards";
import LibraryTable from "../../Admin/ModuloLibrary/LibraryTable";
import LibraryGridView from "../../Admin/ModuloLibrary/LibraryGridView";
import PreviewFileDialog from "../../Admin/ModuloDocuments/PreviewFileDialog";
import ConfirmDeleteDialog from "../../Admin/ModuloLibrary/ConfirmDeleteDialog";

import Pagination from "@/components/ui/Pagination";

// Función helper para formatear bytes
const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function UserLibrary() {
  const [documents, setDocuments] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeContent, setTypeContent] = useState("all");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortBy, setSortBy] = useState({ field: "updated", direction: "desc" });
  const [statType, setStatType] = useState("pdf");
  const [loading, setLoading] = useState(true);
  const [processingVisibility, setProcessingVisibility] = useState(false);
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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-600">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Gestión de Biblioteca Pública
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Administra los documentos visibles en la biblioteca pública
            </p>
          </div>
        </div>
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
        onRefresh={() => fetchData(search)}
        clearAllFilters={clearAllFilters}
      />

      {/* Vista principal */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">
            No hay documentos para mostrar.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <LibraryGridView
          documents={paginatedDocs}
          onView={setSelectedDoc}
          onDelete={(file) => {
            setSelectedDoc(file);
            setShowDeleteDialog(true);
          }}
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
            onDelete={(file) => {
              setSelectedDoc(file);
              setShowDeleteDialog(true);
            }}
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

      {/* Confirmación de cambio de visibilidad */}
      {showDeleteDialog && selectedDoc && (
        <ConfirmDeleteDialog
          open={showDeleteDialog}
          setOpen={setShowDeleteDialog}
          doc={selectedDoc}
          processing={processingVisibility}
          onConfirm={async () => {
            try {
              setProcessingVisibility(true);
              // Asegurarse de que usamos la ruta correcta y codificarla adecuadamente
              const docPath = selectedDoc.path || selectedDoc.storage_path || "";
              console.log("Cambiando visibilidad de documento:", docPath);
              await libraryAPI.togglePublic(docPath);
              if (selectedDoc.public) {
                toast.success("Documento cambiado a privado correctamente");
              } else {
                toast.success("Documento cambiado a público correctamente");
              }
              await fetchData();
            } catch (error) {
              console.error("Error al cambiar visibilidad:", error);
              toast.error("Error al cambiar la visibilidad del documento");
            } finally {
              setProcessingVisibility(false);
              setShowDeleteDialog(false);
            }
          }}
        />
      )}
      
      {/* Overlay de carga mientras se procesa el cambio de visibilidad */}
      {processingVisibility && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p>Procesando cambio de visibilidad...</p>
          </div>
        </div>
      )}
    </div>
  );
}
