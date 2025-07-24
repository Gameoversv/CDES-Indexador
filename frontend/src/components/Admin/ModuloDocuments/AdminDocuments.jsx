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
  const [statType, setStatType] = useState("pdf"); // ✅ Nuevo

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
        setFiles([]);
        toast.error("Formato de datos inválido.");
      }
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

  const stats = {
    total: files.length,
    totalSize: formatSize(files.reduce((acc, f) => acc + (f.size || 0), 0)),
    filteredCount: files.filter((f) =>
      f.filename?.toLowerCase().endsWith(`.${statType}`)
    ).length, // ✅
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
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <p className="text-center text-gray-500">
          No hay documentos para mostrar.
        </p>
      ) : viewMode === "list" ? (
        <DocumentsTable
          files={filteredFiles}
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
          files={filteredFiles}
          formatDate={formatDate}
          formatSize={formatSize}
          handleDownload={handleDownload}
          setPreviewFile={setPreviewFile}
          setConfirmDelete={setConfirmDelete}
        />
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
