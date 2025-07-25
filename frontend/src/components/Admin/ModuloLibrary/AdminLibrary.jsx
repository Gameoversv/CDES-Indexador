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

  // Obtener documentos usando Meilisearch con búsqueda en tiempo real
  const fetchData = async (q = "") => {
    setLoading(true);
    try {
      let data;
      if (q) {
        const res = await libraryAPI.search(q);
        data = Array.isArray(res.data?.hits) ? res.data.hits : [];
      } else {
        data = await libraryAPI.list();
      }
      setDocuments(data || []);
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
  };

  // Filtrado solo por formato, tipo y rango de fechas; la búsqueda por texto ya se hace en backend
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesFormat =
          typeFilter === "all" ||
          (doc.name || "").toLowerCase().endsWith(`.${typeFilter}`);

        const matchesContent =
          typeContent === "all" ||
          (doc.tipo || "").toLowerCase() === typeContent;

        const updatedAt = new Date(doc.updated);
        const inDateRange =
          (!dateRange.from || updatedAt >= new Date(dateRange.from)) &&
          (!dateRange.to || updatedAt <= new Date(dateRange.to));

        return matchesFormat && matchesContent && inDateRange;
      })
      .sort((a, b) => {
        const valA = a[sortBy.field]?.toString().toLowerCase() || "";
        const valB = b[sortBy.field]?.toString().toLowerCase() || "";
        if (sortBy.direction === "asc") return valA.localeCompare(valB);
        return valB.localeCompare(valA);
      });
  }, [documents, typeFilter, typeContent, dateRange, sortBy]);

  const stats = {
    total: documents.length,
    totalSizeMB:
      documents.reduce((acc, doc) => acc + (doc.size || 0), 0) / (1024 * 1024),
    pdf: documents.filter((d) => d.name?.endsWith(".pdf")).length,
    docx: documents.filter((d) => d.name?.endsWith(".docx")).length,
    xlsx: documents.filter((d) => d.name?.endsWith(".xlsx")).length,
    pptx: documents.filter((d) => d.name?.endsWith(".pptx")).length,
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
            documents={filteredDocs}
            onView={setSelectedDoc}
            onDelete={setShowDeleteDialog}
            onDownload={(file) =>
              documentsAPI.downloadByPath(file.storage_path).then((res) => {
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
          <LibraryTable
            files={filteredDocs}
            onView={setSelectedDoc}
            onDelete={setShowDeleteDialog}
            onDownload={(file) =>
              documentsAPI.downloadByPath(file.storage_path).then((res) => {
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
