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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr className="text-left">
            <th className="p-3 cursor-pointer text-gray-900 font-semibold" onClick={() => handleSort("name")}>
              Nombre
              <ArrowUpDown className="inline h-3 w-3 ml-1" />
            </th>
            <th className="p-3 text-gray-900 font-semibold">Tipo</th>
            <th className="p-3 text-gray-900 font-semibold">Formato</th>
            <th className="p-3 text-gray-900 font-semibold">Apartado</th>
            <th className="p-3 cursor-pointer text-gray-900 font-semibold" onClick={() => handleSort("updated")}>
              Fecha
              <ArrowUpDown className="inline h-3 w-3 ml-1" />
            </th>
            <th className="p-3 text-right text-gray-900 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {files.length > 0 ? (
            files.map((file, i) => (
              <tr
                key={file.path || i}
                className="hover:bg-gray-50 border-b border-gray-300"
              >
                <td className="p-3 font-medium text-gray-900">{file.filename}</td>

                <td className="p-3">
                  <Badge variant="outline" className="border border-gray-300">
                    {file.tipo || "Sin tipo"}
                  </Badge>
                </td>

                <td className="p-3">
                  <Badge variant="secondary" className="border border-gray-300">
                    {getFormat(file.name).toUpperCase()}
                  </Badge>
                </td>

                <td className="p-3">
                  <Badge variant="outline" className="border border-gray-300">
                    {file.apartado || "Sin apartado"}
                  </Badge>
                </td>

                <td className="p-3 text-gray-700">
                  {file.updated ? new Date(file.updated).toLocaleDateString() : "-"}
                </td>

                <td className="p-3 flex justify-end gap-2">
                  <Button size="icon" variant="ghost" className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onView(file)}>
                    <Eye className="h-4 w-4 text-gray-900" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onDownload(file)}>
                    <Download className="h-4 w-4 text-gray-900" />
                  </Button>
                  <Button size="icon" variant="ghost" className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onDelete(file)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="p-10 text-center text-gray-500">
                No hay documentos disponibles.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
