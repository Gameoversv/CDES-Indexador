import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  Copy,
  FileText,
  FileSpreadsheet,
  FileBarChart,
  File,
} from "lucide-react";

// Import seguro: si el módulo no expone getFileTypeColor, usamos un fallback local
import * as docUtils from "@/lib/documentUtils";
import { documentsAPI } from "@/services/api";
import api from "@/services/api"; // Importar instancia API directa para endpoints personalizados

// -------------------- helpers --------------------
const getExt = (name = "") => name.split(".").pop()?.toUpperCase() || "FILE";
const stripExt = (s = "") => s.replace(/\.[^.]+$/, "");
const pickFirst = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== "") ?? "";

const getFileIcon = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="h-5 w-5 text-red-600" />;
    case "doc":
    case "docx":
      return <FileText className="h-5 w-5 text-blue-600" />;
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    case "ppt":
    case "pptx":
      return <FileBarChart className="h-5 w-5 text-orange-600" />;
    default:
      return <File className="h-5 w-5 text-gray-600" />;
  }
};

// Fallback local si no existe en documentUtils
const localGetFileTypeColor = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "bg-red-100 text-red-700 border border-gray-300";
    case "doc":
    case "docx":
      return "bg-blue-100 text-blue-700 border border-gray-300";
    case "xls":
    case "xlsx":
      return "bg-green-100 text-green-700 border border-gray-300";
    case "ppt":
    case "pptx":
      return "bg-orange-100 text-orange-700 border border-gray-300";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-300";
  }
};
const getFileTypeColor =
  typeof docUtils.getFileTypeColor === "function"
    ? docUtils.getFileTypeColor
    : localGetFileTypeColor;

// -------------------- componente --------------------
export default function PreviewFileDialog({
  file,
  onClose,
  handleDownload,
  formatSize,
  formatDate,
}) {
  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Ruta base conocida
  const rutaBase = useMemo(
    () =>
      pickFirst(
        file?.storage_path,
        file?.path,
        file?.meta?.storage_path,
        file?.details?.storage_path
      ),
    [file]
  );

  // Nombre a mostrar
  const nombreArchivo = useMemo(
    () =>
      pickFirst(
        meta?.filename,
        file?.filename,
        file?.original_filename,
        file?.name,
        "-"
      ),
    [meta, file]
  );

  // Enriquecer metadatos si faltan (título/resumen/categoría)
  useEffect(() => {
    let canceled = false;
    setMeta(null);

    if (!file) return;

    // Extraer ID del archivo si existe
    const fileId = file?.id || file?.file_id || stripExt(file?.filename || "");

    (async () => {
      setLoadingMeta(true);
      try {
        // 1) Intentar obtener información directamente usando el nuevo endpoint info
        if (rutaBase || fileId) {
          try {
            // Primero intentar por path si existe
            if (rutaBase) {
              const resp = await api.get("/documents/info", { 
                params: { storage_path: rutaBase } 
              });
              const payload = resp?.data?.document || null;
              
              if (!canceled && payload && typeof payload === "object") {
                console.log("Documento encontrado por storage_path:", payload);
                setMeta(payload);
                setLoadingMeta(false);
                return;
              }
            }
            
            // Luego intentar por ID si no se encontró por path
            if (fileId) {
              const resp = await api.get("/documents/info", { 
                params: { file_id: fileId } 
              });
              const payload = resp?.data?.document || null;
              
              if (!canceled && payload && typeof payload === "object") {
                console.log("Documento encontrado por file_id:", payload);
                setMeta(payload);
                setLoadingMeta(false);
                return;
              }
            }
          } catch (err) {
            console.error("Error obteniendo metadatos:", err);
            /* seguir con fallback */
          }
        }

        // 2) Búsqueda por nombre (sin extensión) - fallback
        const baseName = stripExt(nombreArchivo || file?.filename || "");
        if (baseName) {
          try {
            const resp = await documentsAPI.search(baseName);
            const hits =
              resp?.data?.hits || resp?.data?.data || resp?.data || [];
            if (Array.isArray(hits) && hits.length) {
              const match =
                hits.find(
                  (h) =>
                    (rutaBase && (h.storage_path === rutaBase || h.path === rutaBase)) ||
                    h.filename === file?.filename
                ) || hits[0];
              if (!canceled && match) {
                console.log("Documento encontrado por búsqueda:", match);
                setMeta(match);
                setLoadingMeta(false);
                return;
              }
            }
          } catch (err) {
            console.error("Error en búsqueda:", err);
            /* ignorar y continuar */
          }
        }
      } finally {
        if (!canceled) setLoadingMeta(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [file, rutaBase, nombreArchivo]);

  if (!file) return null;

  // ------ campos mostrados (meta -> file) ------
  const titulo = pickFirst(
    meta?.title,
    file?.title,
    file?.meta?.title,
    file?.details?.title,
    "Título no encontrado"
  );

  const bytes = pickFirst(
    meta?.file_size_bytes,
    file?.size,
    file?.file_size_bytes,
    0
  );
  const tamano = formatSize?.(bytes) ?? `${bytes} B`;

  const categoria = pickFirst(
    meta?.categoria,
    meta?.tipo,
    meta?.tipo_documento,
    file?.categoria,
    file?.tipo,
    file?.tipo_documento,
    file?.meta?.tipo_documento,
    file?.details?.tipo,
    getExt(nombreArchivo) // fallback
  );

  const formato = getExt(nombreArchivo);

  const resumen = pickFirst(
    meta?.summary,
    file?.summary,
    file?.meta?.summary,
    file?.details?.summary,
    "Resumen no disponible"
  );

  const ruta = pickFirst(meta?.storage_path, rutaBase, "-");

  const updatedISO = pickFirst(
    meta?.updated_at,
    meta?.upload_timestamp,
    meta?.processing_timestamp,
    file?.updated,
    file?.upload_timestamp,
    file?.processing_timestamp
  );
  const updatedAt = updatedISO ? (formatDate?.(updatedISO) ?? updatedISO) : null;

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(ruta);
    } catch {
      /* noop */
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(isOpen) => { if (!isOpen) onClose?.(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon(nombreArchivo)}
            Detalles del documento
            <Badge
              variant="secondary"
              className={`${getFileTypeColor(nombreArchivo)} rounded-full ml-2 px-2`}
            >
              {formato}
            </Badge>
          </DialogTitle>
          {updatedAt && (
            <DialogDescription>
              Última modificación: {updatedAt}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-5">
          {/* Metadatos principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nombre del archivo</label>
              <p className="text-sm text-gray-900 break-all">{nombreArchivo}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Título del documento</label>
              <p className="text-sm text-gray-900 break-words">
                {loadingMeta ? "Cargando…" : titulo}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Tamaño</label>
              <p className="text-sm text-gray-900">{tamano}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Tipo/Categoría</label>
              <p className="text-sm text-gray-900">{categoria}</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Resumen</label>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {loadingMeta ? "Cargando…" : resumen}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Ruta del Archivo</label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-900 break-all flex-1">{ruta}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={copyPath}
                  title="Copiar ruta"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              className="rounded-full px-5"
              onClick={() => handleDownload?.(ruta, nombreArchivo)}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
