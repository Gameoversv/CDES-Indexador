import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getFileTypeColor } from "@/components/utils/fileUtils"; // ✅ nuevo import

export default function PreviewFileDialog({ file, onClose, handleDownload, formatSize, formatDate }) {
  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="rounded-xl bg-white border border-gray-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <FileText className="h-5 w-5" />
            Detalle del Documento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-700">Nombre</p>
              <p className="font-medium text-gray-900">{file?.filename}</p>
            </div>
            <div>
              <p className="text-sm text-gray-700">Tamaño</p>
              <p className="font-medium text-gray-900">{formatSize(file?.size)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-700">Tipo</p>
              <Badge variant="secondary" className={getFileTypeColor(file?.filename)}>
                {file?.filename?.split('.').pop()?.toUpperCase() || "FILE"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-700">Última modificación</p>
              <p className="font-medium text-gray-900">{formatDate(file?.updated)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-700">Ruta del archivo</p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all text-gray-900 border border-gray-300">
              {file?.path}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="border border-gray-300 text-gray-900">Cerrar</Button>
            <Button onClick={() => handleDownload(file?.path, file?.filename)} className="text-white" style={{ backgroundColor: "#ef4444" }}>
              Descargar documento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
