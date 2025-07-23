// ModuloLibrary/LibraryToolbar.jsx
import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LayoutList, RefreshCw } from "lucide-react";

export default function LibraryToolbar({
  viewMode,
  setViewMode,
  search,
  setSearch,
  onRefresh,
  onUpload,
  hideUpload = false,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Input
        placeholder="Buscar documentos públicos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-72"
      />

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("grid")}
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("list")}
        >
          <LayoutList className="w-4 h-4" />
        </Button>

        {!hideUpload && onUpload && (
          <Button onClick={onUpload}>Subir documento</Button>
        )}
      </div>
    </div>
  );
}
