import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";
import { libraryAPI, documentsAPI } from "@/services/api";
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

  const fetchData = async () => {
    try {
      const response = await libraryAPI.list();
      setDocuments(response || []);
    } catch (error) {
      console.error("Error al cargar documentos:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch =
          (doc.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (doc.summary || "").toLowerCase().includes(search.toLowerCase()) ||
          (doc.keywords || "").toLowerCase().includes(search.toLowerCase()) ||
          (doc.tipo || "").toLowerCase().includes(search.toLowerCase());

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

        return matchesSearch && matchesFormat && matchesContent && inDateRange;
      })
      .sort((a, b) => {
        const valA = a[sortBy.field]?.toString().toLowerCase() || "";
        const valB = b[sortBy.field]?.toString().toLowerCase() || "";
        if (sortBy.direction === "asc") return valA.localeCompare(valB);
        return valB.localeCompare(valA);
      });
  }, [documents, search, typeFilter, typeContent, dateRange, sortBy]);

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
        <LibraryStatsCards stats={stats} statType={statType} setStatType={setStatType} />

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
          onRefresh={fetchData}
          hideUpload={true}
        />

        {/* Vista principal */}
        {viewMode === "grid" ? (
          <LibraryGridView
            documents={filteredDocs}
            onView={setSelectedDoc}
            onDelete={setShowDeleteDialog}
          />
        ) : (
          <LibraryTable
            files={filteredDocs}
            onPreview={setSelectedDoc}
            onDelete={setShowDeleteDialog}
            onDownload={(file) =>
              documentsAPI.downloadByPath(file.path).then((res) => {
                const url = window.URL.createObjectURL(res.data);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.name;
                a.click();
              })
            }
            sortBy={sortBy}
            setSortBy={setSortBy}
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
