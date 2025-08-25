// src/components/Admin/ModuloDocuments/DocumentsTable.jsx
import React, { Fragment, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Trash2, Download, ArrowUpDown, Calendar,
  FileText, FileSpreadsheet, FileBarChart, File,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { getFileDisplayName } from "@/lib/documentUtils";

const getExt = (filename = "") => filename.split(".").pop()?.toLowerCase();

/** Icono por extensión */
const getFileIcon = (filename) => {
  const ext = getExt(filename);
  switch (ext) {
    case "pdf":  return <FileText className="text-red-600" size={20} />;
    case "doc":
    case "docx": return <FileText className="text-blue-600" size={20} />;
    case "xls":
    case "xlsx": return <FileSpreadsheet className="text-green-600" size={20} />;
    case "ppt":
    case "pptx": return <FileBarChart className="text-orange-600" size={20} />;
    default:     return <File className="text-gray-600" size={20} />;
  }
};

/** Badge por extensión (solo para columna Formato) */
const getFileTypeColor = (filename) => {
  const ext = getExt(filename);
  switch (ext) {
    case "pdf":  return "bg-red-100 text-red-700 border border-gray-300";
    case "doc":
    case "docx": return "bg-blue-100 text-blue-700 border border-gray-300";
    case "xls":
    case "xlsx": return "bg-green-100 text-green-700 border border-gray-300";
    case "ppt":
    case "pptx": return "bg-orange-100 text-orange-700 border border-gray-300";
    default:      return "bg-gray-100 text-gray-700 border border-gray-300";
  }
};

/** Derivar categoría mostrada en la columna “Tipo”
 *  Prioridad NUEVA:
 *   1) file.categoria (Firestore)
 *   2) Derivar por ruta (storage_path / path) → segmento antes del año
 *   3) file.tipo / file.tipo_documento (si llega así)
 *   4) Fallback por extensión
 */
const deriveCategoria = (file) => {
  if (!file) return "Documento";

  // 1) Firestore
  if (file.categoria) return String(file.categoria);

  // 2) Intento por ruta (mejorado)
  const rawPath = file.storage_path || file.path || "";
  if (rawPath) {
    const parts = decodeURIComponent(String(rawPath))
      .split(/[\\/]/)
      .filter(Boolean);

    // heurística: buscamos el segmento inmediatamente ANTERIOR al año (YYYY)
    let cat = "";
    const yearIdx = parts.findIndex((p) => /^\d{4}$/.test(p));
    if (yearIdx > 0) {
      cat = parts[yearIdx - 1]; // p.ej., CDES_inst / Dirección Ejecutiva / actas / 2025 / 08 / file.pdf  -> "actas"
    } else {
      // si no hay año, probamos la posición típica 2 o penúltima carpeta
      cat = parts[2] || parts[parts.length - 2] || "";
    }
    if (cat) return cat;
  }

  // 3) Valor que envía el listado (suele ser "PDF", "Documento", etc.)
  if (file.tipo) return String(file.tipo);
  if (file.tipo_documento) return String(file.tipo_documento);

  // 4) Fallback por extensión
  const ext = getExt(file.filename || "");
  const map = {
    doc: "Word", docx: "Word",
    xls: "Excel", xlsx: "Excel",
    ppt: "PowerPoint", pptx: "PowerPoint",
    pdf: "PDF",
  };
  return map[ext] || "Documento";
};

export default function DocumentsTable({
  files,
  handleSort,
  setPreviewFile,
  setConfirmDelete,
  handleDownload,
  formatSize,
  formatDate,
  isDirectorEjecutivo = false,
}) {
  const [expandedFiles, setExpandedFiles] = useState({});

  const toggleFileExpansion = (fileId) => {
    setExpandedFiles((prev) => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-gray-100">
          <TableRow>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("filename")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Archivo
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("size")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Tamaño
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("updated")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Fecha de subida
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>

            {/* ✅ Columna Tipo: ahora prioriza la categoría real */}
            <TableHead className="border-b border-gray-300 text-gray-900 font-semibold">
              Tipo
            </TableHead>

            <TableHead className="border-b border-gray-300 text-gray-900 font-semibold">
              Formato
            </TableHead>
            <TableHead className="text-right border-b border-gray-300 text-gray-900 font-semibold">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {files.map((file, index) => (
            <Fragment key={`row-${file.filename}-${index}`}>
              <TableRow className="hover:bg-gray-50 border-b border-gray-300">
                <TableCell className="font-medium text-gray-900">
                  <div className="flex items-center gap-3">
                    {file.isVersioned && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); toggleFileExpansion(file.filename); }}
                      >
                        {expandedFiles[file.filename] ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                    {getFileIcon(file.filename)}
                    <div className="font-medium truncate max-w-xs">
                      {file.isVersioned ? getFileDisplayName(file) : file.filename}
                      {file.isVersioned && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          {file.versionCount} versiones
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-gray-900">
                  {formatSize(file.size)}
                </TableCell>

                <TableCell className="text-gray-900">
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <Calendar className="h-3 w-3" />
                    {formatDate(file.updated)}
                  </div>
                </TableCell>

                {/* ✅ Ahora mostrará “actas”, “Banco”, “convocatorias”, etc. */}
                <TableCell className="text-gray-900">
                  {deriveCategoria(file)}
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                    {(getExt(file.filename) || "file").toUpperCase()}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                      onClick={() => setPreviewFile(file)}
                    >
                      <Eye className="h-4 w-4 text-gray-900" />
                    </Button>
                    {isDirectorEjecutivo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                        onClick={() => setConfirmDelete({ open: true, file })}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.path, file.filename)}
                      className="gap-1 px-3 border border-gray-300 bg-red-600 text-white hover:bg-red-700"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              {/* ▼ Versiones (sin cambios) */}
              {file.isVersioned && expandedFiles[file.filename] && (
                <>
                  {file.originalFile && file.filename !== file.originalFile.filename && (
                    <TableRow className="hover:bg-blue-50 border-b border-gray-300 bg-blue-50/30">
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-3 pl-10">
                          {getFileIcon(file.originalFile.filename)}
                          <div className="font-medium truncate max-w-xs">
                            {file.originalFile.filename}
                            <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                              Original
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatSize(file.originalFile.size)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Calendar className="h-3 w-3" />
                          {formatDate(file.originalFile.updated)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {deriveCategoria(file.originalFile)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getFileTypeColor(file.originalFile.filename)}>
                          {(getExt(file.originalFile.filename) || "file").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                            onClick={() => setPreviewFile(file.originalFile)}
                          >
                            <Eye className="h-4 w-4 text-gray-900" />
                          </Button>
                          {isDirectorEjecutivo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                              onClick={() => setConfirmDelete({ open: true, file: file.originalFile })}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(file.originalFile.path, file.originalFile.filename)}
                            className="gap-1 px-3 border border-gray-300 bg-red-600 text-white hover:bg-red-700"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {file.versions.map((version, vIdx) => (
                    <TableRow key={`${file.filename}-v-${vIdx}`} className="hover:bg-blue-50 border-b border-gray-300 bg-blue-50/30">
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-3 pl-10">
                          {getFileIcon(version.filename)}
                          <div className="font-medium truncate max-w-xs">
                            {version.filename}
                            {vIdx === 0 && (
                              <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                Última versión
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatSize(version.size)}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Calendar className="h-3 w-3" />
                          {formatDate(version.updated)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {deriveCategoria(version)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getFileTypeColor(version.filename)}>
                          {(getExt(version.filename) || "file").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                            onClick={() => setPreviewFile(version)}
                          >
                            <Eye className="h-4 w-4 text-gray-900" />
                          </Button>
                          {isDirectorEjecutivo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                              onClick={() => setConfirmDelete({ open: true, file: version })}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(version.path, version.filename)}
                            className="gap-1 px-3 border border-gray-300 bg-red-600 text-white hover:bg-red-700"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
