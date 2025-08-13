import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
  Image as ImageIcon,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { documentsAPI } from "@/services/api";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const documentTypesByRole = {
  admin: [
    "presentaciones", "carta", "informe", "convenios", "contrato", 
    "minutas/ayuda_memoria", "actas", "mapas", "logos", "graficos", 
    "nota_prensa/comunicaciones", "plan", "ficha_tecnica", "estudio", 
    "video", "foto", "discursos", "memorias institucionales", 
    "convocatorias", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  CoordinadorPlanificacion: [
    "presentaciones", "carta", "informe", "convenios", "contrato", 
    "minutas/ayuda_memoria", "actas", "mapas", "logos", "graficos", 
    "nota_prensa/comunicaciones", "plan", "ficha_tecnica", "estudio", 
    "video", "foto", "discursos", "memorias institucionales", 
    "convocatorias", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  UnidadProyectos: [
    "presentaciones", "informe", "minutas/ayuda_memoria", "actas", "mapas", 
    "logos", "graficos", "plan", "ficha_tecnica", "estudio", "video", "foto", 
    "memorias institucionales", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  UnidadPlanificacion: [
    "presentaciones", "informe", "minutas/ayuda_memoria", "actas", "mapas", 
    "logos", "graficos", "plan", "ficha_tecnica", "estudio", "video", "foto", 
    "memorias institucionales", "Invitacion", "cuestionario/ instrumento de recolección de datos", 
    "TDER", "cronograma", "diagnostico", "listado", "declaracion ciudadana"
  ],
  asistenciaGeneral: [
    "agendas", "carta", "minutas/ayuda_memoria", "logos", "convocatorias"
  ],
  UnidadAdministrativa: [
    "convenio", "contrato", "plan"
  ],
  UnidadComunicacion: [
    "nota_prensa/comunicaciones", "video", "foto", "convocatorias", 
    "Invitacion", "cronograma"
  ]
};


const formatDocumentType = (type) => {
  if (!type) return "";
  return type
    .replace(/_/g, " ")
    .split(/([ /])/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

export default function UploadDocumentDialog({ open, setOpen, onUploaded }) {
  const { userRole } = useAuth();
  const [files, setFiles] = useState([]);
  const [apartado, setApartado] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [publico, setPublico] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (userRole) {
      setTipoDocumento(""); // Resetear al cambiar de rol
    }
  }, [userRole]);

  const handleFilesSelect = (newFiles) => {
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const handleCoverImageSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
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

  const handleUploadRequest = (e) => {
    e.preventDefault();
    if (!files.length || !apartado || !tipoDocumento) {
      toast.warning(
        "Debes seleccionar al menos un archivo, una iniciativa y un tipo de documento."
      );
      return;
    }
    if (publico && !coverImage) {
      toast.warning(
        "Debes seleccionar una imagen de portada para un documento público."
      );
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmUpload = async () => {
    setShowConfirmDialog(false);
    try {
      setUploading(true);

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("apartado", apartado);
        formData.append("categoria", tipoDocumento);
        formData.append("puesto", userRole); // Enviar el rol del usuario
        formData.append("publico", publico);
        if (publico && coverImage) {
          formData.append("cover_image", coverImage);
        }

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
      setTipoDocumento("");
      setPublico(false);
      setCoverImage(null);
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
            Subir Documentos
          </DialogTitle>
          <DialogDescription>
            Sube uno o varios documentos para indexación.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={handleUploadRequest}>
          {/* Apartado */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Iniciativa</label>
            <Select value={apartado} onValueChange={setApartado}>
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona una iniciativa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CDES inst.">CDES inst.</SelectItem>
                <SelectItem value="PES 2030">PES 2030</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              o selecciónalos manually
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

          {/* Tipo de documento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Tipo de documento
            </label>
            <Select
              value={tipoDocumento}
              onValueChange={setTipoDocumento}
              disabled={!userRole}
            >
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona el tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {userRole &&
                  documentTypesByRole[userRole]?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatDocumentType(type)}
                    </SelectItem>
                  ))}
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

          {/* Agregar imagen de portada */}
          {publico && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Imagen de Portada
              </label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageSelect}
                  className="flex-grow"
                />
                {coverImage && (
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-gray-600" />
                    <span className="text-sm truncate max-w-xs">
                      {coverImage.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCoverImage(null)}
                      className="text-red-500 hover:text-red-700"
                      disabled={uploading}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Sube una imagen para la portada del documento en la biblioteca
                pública.
              </p>
            </div>
          )}

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
            <Button type="submit" variant="destructive" disabled={uploading}>
              {uploading ? "Subiendo..." : "Subir documentos"}
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar subida</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres subir {files.length} documento(s)?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmUpload}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
