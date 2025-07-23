import React, { useState, useEffect } from "react";
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
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sortBy, setSortBy] = useState({ field: "name", direction: "asc" });

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

  const filteredDocs = [...documents]
    .filter((doc) => doc.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortBy.field]?.toString().toLowerCase() || "";
      const valB = b[sortBy.field]?.toString().toLowerCase() || "";
      if (sortBy.direction === "asc") return valA.localeCompare(valB);
      return valB.localeCompare(valA);
    });

  const stats = {
    total: documents.length,
    totalSizeMB:
      documents.reduce((acc, doc) => acc + (doc.size || 0), 0) / (1024 * 1024),
    uniqueTypes: new Set(documents.map((doc) => doc.type)).size,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <LibraryStatsCards stats={stats} />

        <LibraryToolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          search={search}
          setSearch={setSearch}
          onRefresh={fetchData}
          hideUpload={true} // 👉🏻 esto indica que no se mostrará botón de subida
        />

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

        {selectedDoc && (
          <PreviewFileDialog
            file={selectedDoc}
            onClose={() => setSelectedDoc(null)}
          />
        )}

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
