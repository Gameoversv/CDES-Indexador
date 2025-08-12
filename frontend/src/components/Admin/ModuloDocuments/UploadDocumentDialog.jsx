import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UploadCloud,
  File,
  X,
  Sparkles,
  FileText,
  FileType,
  FileSpreadsheet,
  Presentation as FilePresentation,
  CheckCircle2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { documentsAPI } from "@/services/api";
import { Progress } from "@/components/ui/progress";

export default function UploadDocumentDialog({ open, setOpen, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [apartado, setApartado] = useState("");
  const [publico, setPublico] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [isDragging, setIsDragging] = useState(false);

  const handleFilesSelect = (newFiles) => {
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      handleFilesSelect(e.dataTransfer.files);
    }
  }, []);

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length || !apartado) {
      toast.warning("Debes seleccionar al menos un archivo y un apartado.");
      return;
    }

    try {
      setUploading(true);

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("apartado", apartado);
        formData.append("publico", publico);

        await documentsAPI.upload(formData, {
          onUploadProgress: (event) => {
            if (event.total) {
              const percent = Math.round((event.loaded * 100) / event.total);
              setProgress((prev) => ({ ...prev, [file.name]: percent }));
            }
          },
        });
      }

      toast.success("Archivos subidos correctamente.");
      setOpen(false);
      setFiles([]);
      setApartado("");
      setPublico(false);
      onUploaded?.();
    } catch (error) {
      console.error("Error al subir archivo:", error);
      toast.error("Error al subir uno o más archivos.");
    } finally {
      setUploading(false);
      setProgress({});
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2 px-3 py-2 rounded-lg">
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Subir documento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-xl max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            📂 Subir Documentos
          </DialogTitle>
          <DialogDescription>
            Sube uno o varios documentos para procesamiento automático con IA e indexación inteligente.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
          {/* Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
              isDragging ? "border-red-500 bg-red-50" : "border-gray-300"
            }`}
          >
            <UploadCloud className="mx-auto h-10 w-10 text-gray-500" />
            <p className="mt-2 text-gray-700 font-medium">
              Arrastra tus archivos aquí
            </p>
            <p className="text-xs text-gray-500">
              o selecciónalos manualmente
            </p>
            <Input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx"
              onChange={(e) => handleFilesSelect(e.target.files)}
              className="mt-3"
            />
          </div>

          {/* Lista de archivos */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border rounded-lg p-2"
                >
                  <div className="flex items-center gap-2">
                    <File className="h-5 w-5 text-gray-600" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploading && progress[file.name] !== undefined && (
                      <Progress value={progress[file.name]} className="w-24" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-red-500 hover:text-red-700"
                      disabled={uploading}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Apartado */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Apartado</label>
            <Select value={apartado} onValueChange={setApartado}>
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona un apartado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CDES Inst.">CDES Inst.</SelectItem>
                <SelectItem value="PES 203P">PES 2030</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Público */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="publico"
              checked={publico}
              onChange={(e) => setPublico(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="publico" className="text-sm">
              Habilitar en biblioteca pública
            </label>
          </div>

          {/* Tarjetas de formatos y IA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <FileType className="h-4 w-4 text-red-500" /> Formatos Soportados
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-red-500" /> PDF
                </li>
                <li className="flex items-center gap-2">
                  <FileType className="h-4 w-4 text-blue-500" /> DOCX
                </li>
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" /> XLSX
                </li>
                <li className="flex items-center gap-2">
                  <FilePresentation className="h-4 w-4 text-orange-500" /> PPTX
                </li>
              </ul>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" /> Procesamiento IA
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Extracción de texto
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Resumen inteligente
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Palabras clave
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Indexación semántica
                </li>
              </ul>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={uploading}
            >
              {uploading ? "Subiendo..." : "Subir documentos"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
