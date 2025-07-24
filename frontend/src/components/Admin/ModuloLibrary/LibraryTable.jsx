import React from "react";
import {
  Eye,
  Download,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "../../utils/utils";

/**
 * Tabla para mostrar documentos de la biblioteca pública
 */
export default function LibraryTable({
  files = [],
  onView = () => {},
  onDownload = () => {},
  onDelete = () => {},
  onSort = () => {},
  sortKey = "",
  sortOrder = "asc",
}) {
  const handleSort = (key) => {
    const order = key === sortKey && sortOrder === "asc" ? "desc" : "asc";
    onSort(key, order);
  };

  const getFormat = (filename = "") => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "desconocido";
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr className="text-left">
            <th className="p-3 cursor-pointer" onClick={() => handleSort("name")}>
              Nombre
              <ArrowUpDown className="inline h-4 w-4 ml-1" />
            </th>
            <th className="p-3">Tipo</th>
            <th className="p-3">Formato</th>
            <th className="p-3">Apartado</th>
            <th className="p-3 cursor-pointer" onClick={() => handleSort("updated")}>
              Fecha
              <ArrowUpDown className="inline h-4 w-4 ml-1" />
            </th>
            <th className="p-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {files.length > 0 ? (
            files.map((file, i) => (
              <tr
                key={file.path || i}
                className={cn(i % 2 === 0 ? "bg-white" : "bg-gray-50")}
              >
                <td className="p-3 font-medium">{file.filename}</td>

                <td className="p-3">
                  <Badge variant="outline">
                    {file.tipo || "Sin tipo"}
                  </Badge>
                </td>

                <td className="p-3">
                  <Badge variant="secondary">
                    {getFormat(file.name).toUpperCase()}
                  </Badge>
                </td>

                <td className="p-3">
                  <Badge variant="outline">
                    {file.apartado || "Sin apartado"}
                  </Badge>
                </td>

                <td className="p-3 text-muted-foreground">
                  {file.updated ? new Date(file.updated).toLocaleDateString() : "-"}
                </td>

                <td className="p-3 flex justify-end gap-2">
                  <Button size="icon" variant="outline" onClick={() => onView(file)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => onDownload(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => onDelete(file)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="p-4 text-center text-muted-foreground">
                No hay documentos disponibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
