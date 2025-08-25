import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, Eye, Trash2, Download, FileText, FileSpreadsheet,
  FileBarChart, File, ChevronDown
} from "lucide-react";
import { getFileDisplayName } from "@/lib/documentUtils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

/* ----------------------- Helpers de presentación ----------------------- */
const getExt = (filename = "") =>
  filename.split(".").pop()?.toLowerCase() || "";

const getFileIcon = (filename) => {
  switch (getExt(filename)) {
    case "pdf":  return <FileText className="text-red-600" size={32} />;
    case "doc":
    case "docx": return <FileText className="text-blue-600" size={32} />;
    case "xls":
    case "xlsx": return <FileSpreadsheet className="text-green-600" size={32} />;
    case "ppt":
    case "pptx": return <FileBarChart className="text-orange-600" size={32} />;
    default:     return <File className="text-gray-600" size={32} />;
  }
};

const getFileTypeColor = (filename) => {
  switch (getExt(filename)) {
    case "pdf":            return "bg-red-100 text-red-700 border border-gray-300";
    case "doc":
    case "docx":           return "bg-blue-100 text-blue-700 border border-gray-300";
    case "xls":
    case "xlsx":           return "bg-green-100 text-green-700 border border-gray-300";
    case "ppt":
    case "pptx":           return "bg-orange-100 text-orange-700 border border-gray-300";
    default:               return "bg-gray-100 text-gray-700 border border-gray-300";
  }
};
/* ---------------------------------------------------------------------- */

export default function DocumentsGrid({
  files,
  formatDate,
  formatSize,
  handleDownload,
  setPreviewFile,
  setConfirmDelete,
  isDirectorEjecutivo = false,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file, index) => {
        const key = file.id || file.path || file.filename || index;

        return (
          <Card
            key={key}
            className="bg-white border border-gray-300 shadow-none rounded-lg overflow-hidden hover:shadow-md transition-all"
          >
            {/* Header con icono y badge de versiones */}
            <div className="p-1 bg-gray-100 relative">
              <div className="flex justify-center py-4">
                {getFileIcon(file.filename)}
              </div>
              {file.isVersioned && (
                <Badge className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white">
                  {file.versionCount}
                </Badge>
              )}
            </div>

            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Nombre */}
                <div>
                  <p
                    className="font-medium truncate text-gray-900"
                    title={file.isVersioned ? getFileDisplayName(file) : file.filename}
                  >
                    {file.isVersioned ? getFileDisplayName(file) : file.filename}
                  </p>
                  {file.isVersioned && (
                    <p className="text-xs text-blue-600">
                      {file.versionCount} versiones disponibles
                    </p>
                  )}
                </div>

                {/* Fecha y tamaño */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-gray-700">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(file.updated)}</span>
                  </div>
                  <div className="text-right text-gray-700">{formatSize(file.size)}</div>
                </div>

                {/* Tipo/acciones */}
                <div className="flex justify-between items-center mt-2">
                  <Badge
                    variant="secondary"
                    className={`${getFileTypeColor(file.filename)} rounded-full px-2`}
                  >
                    {getExt(file.filename).toUpperCase() || "FILE"}
                  </Badge>

                  <div className="flex gap-1">
                    {/* Ver / Detalles */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                      onClick={() => setPreviewFile(file)}
                      title="Ver detalles"
                      aria-label="ver-detalles"
                    >
                      <Eye className="h-4 w-4 text-gray-900" />
                    </Button>

                    {/* Versiones (si aplica) o Eliminar directa */}
                    {file.isVersioned ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                            title="Ver versiones"
                            aria-label="ver-versiones"
                          >
                            <ChevronDown className="h-4 w-4 text-gray-900" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-64">
                          {/* Original */}
                          {file.originalFile &&
                            file.filename !== file.originalFile.filename && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <div className="flex flex-col w-full">
                                  <div className="flex justify-between w-full">
                                    <span className="truncate flex-1">
                                      {file.originalFile.filename}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs ml-2 bg-green-100 text-green-800 border-green-200"
                                    >
                                      Original
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>{formatDate(file.originalFile.updated)}</span>
                                    <span>{formatSize(file.originalFile.size)}</span>
                                  </div>
                                  <div className="flex gap-1 mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-full p-1 h-7 w-7 bg-gray-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewFile(file.originalFile);
                                      }}
                                      title="Ver detalles"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    {isDirectorEjecutivo && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-full p-1 h-7 w-7 bg-gray-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDelete({ open: true, file: file.originalFile });
                                        }}
                                        title="Eliminar"
                                      >
                                        <Trash2 className="h-3 w-3 text-red-500" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-full p-1 h-7 w-7 bg-red-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(file.originalFile.path, file.originalFile.filename);
                                      }}
                                      title="Descargar"
                                    >
                                      <Download className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              </DropdownMenuItem>
                            )}

                          {/* Versiones */}
                          {file.versions.map((version, vIdx) => (
                            <DropdownMenuItem
                              key={`${key}-v-${vIdx}`}
                              className="cursor-pointer"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <div className="flex flex-col w-full">
                                <div className="flex justify-between w-full">
                                  <span className="truncate flex-1">{version.filename}</span>
                                  {vIdx === 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs ml-2 bg-green-100 text-green-800 border-green-200"
                                    >
                                      Última
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>{formatDate(version.updated)}</span>
                                  <span>{formatSize(version.size)}</span>
                                </div>
                                <div className="flex gap-1 mt-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full p-1 h-7 w-7 bg-gray-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewFile(version);
                                    }}
                                    title="Ver detalles"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  {isDirectorEjecutivo && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="rounded-full p-1 h-7 w-7 bg-gray-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete({ open: true, file: version });
                                      }}
                                      title="Eliminar"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full p-1 h-7 w-7 bg-red-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(version.path, version.filename);
                                    }}
                                    title="Descargar"
                                  >
                                    <Download className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      isDirectorEjecutivo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                          onClick={() => setConfirmDelete({ open: true, file })}
                          title="Eliminar"
                          aria-label="eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )
                    )}

                    {/* Descargar */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.path, file.filename)}
                      className="rounded-full p-1.5 border border-gray-300 bg-red-600 text-white hover:bg-red-700"
                      title="Descargar"
                      aria-label="descargar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
