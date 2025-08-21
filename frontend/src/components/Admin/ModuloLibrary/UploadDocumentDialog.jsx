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
import { documentsAPI } from "@/services/documentsAPI";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { puestosTrabajo } from "@/constants/jobPositions";
import { pesEstrategias } from "@/constants/pesEstrategias";

// Configuraciones centralizadas
const documentTypes = [
  "actas", "mapas", "logos", "graficos", "plan", "video", "foto", "listado",
  "carta", "informe", "convenios", "contrato", "discursos", "convocatorias",
  "Invitacion", "cuestionario", "TDER", "cronograma", "diagnostico",
  "presentaciones", "minutas/ayuda_memoria", "nota_prensa/comunicaciones",
  "ficha_tecnica", "estudio", "memorias institucionales", "declaracion ciudadana"
].sort((a, b) => a.localeCompare(b));

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
  const [file, setFile] = useState(null);
  const [apartado, setApartado] = useState("");
  const [estrategia, setEstrategia] = useState("");
  const [puestoTrabajo, setPuestoTrabajo] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [publico, setPublico] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [strategyProjects, setStrategyProjects] = useState([]);

  useEffect(() => {
    if (userRole) {
      setTipoDocumento("");
    }
  }, [userRole]);

  useEffect(() => {
    if (apartado === "PES 2030" && estrategia) {
      documentsAPI.getProjectsByStrategy(estrategia)
        .then(response => {
          console.log("Response from API:", response);
          // Extraer los nombres únicos de carpetas/proyectos
          const projects = new Set();
          const files = response.data?.files || [];
          files.forEach(file => {
            const pathParts = file.path.split('/');
            // Estructura: PES_2030/{estrategia}/{proyecto}/...
            if (pathParts.length >= 3 && pathParts[0] === 'PES_2030' && pathParts[1] === estrategia) {
              const projectName = pathParts[2];
              if (projectName && !projectName.match(/^\d{4}$/)) { // No es un año
                projects.add(projectName);
              }
            }
          });
          setStrategyProjects(Array.from(projects).sort());
        })
        .catch(error => {
          console.error("Error fetching projects by strategy:", error);
          setStrategyProjects([]);
        });
    } else {
      setStrategyProjects([]);
      setProyecto("");
    }
  }, [apartado, estrategia]);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
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
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleUploadRequest = (e) => {
    e.preventDefault();
    if (!file || !apartado || !tipoDocumento) {
      toast.warning(
        "Debes seleccionar un archivo, una iniciativa y un tipo de documento."
      );
      return;
    }
    if (apartado === "PES 2030" && !estrategia) {
      toast.warning("Debes seleccionar una estrategia para PES 2030.");
      return;
    }
    if (apartado === "CDES inst." && !puestoTrabajo) {
      toast.warning("Debes seleccionar un puesto de trabajo para CDES inst.");
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

      const formData = new FormData();
      formData.append("file", file);
      formData.append("apartado", apartado);
      if (apartado === "PES 2030") {
        formData.append("estrategia", estrategia);
        if (proyecto) {
          formData.append("proyecto", proyecto);
        }
      } else if (apartado === "CDES inst.") {
        formData.append("puesto_trabajo", puestoTrabajo);
      }
      formData.append("categoria", tipoDocumento);
      formData.append("puesto", userRole);
      formData.append("publico", publico);
      if (publico && coverImage) {
        formData.append("cover_image", coverImage);
      }

      await documentsAPI.upload(formData, {
        onUploadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded * 100) / event.total);
            setProgress({ [file.name]: percent });
          }
        },
      });

      toast.success("Archivo subido correctamente.");
      setOpen(false);
      setFile(null);
      setApartado("");
      setEstrategia("");
      setPuestoTrabajo("");
      setProyecto("");
      setTipoDocumento("");
      setPublico(false);
      setCoverImage(null);
      onUploaded?.();
    } catch (error) {
      console.error("Error al subir archivo:", error);
      toast.error("Error al subir el archivo.");
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
            Subir Documento
          </DialogTitle>
          <DialogDescription>
            Sube un documento para indexación.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={handleUploadRequest}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Iniciativa</label>
              <Select
                value={apartado}
                onValueChange={(value) => {
                  setApartado(value);
                  setEstrategia("");
                  setPuestoTrabajo("");
                  setProyecto("");
                  setTipoDocumento("");
                }}
              >
                <SelectTrigger className="border border-gray-300">
                  <SelectValue placeholder="Selecciona una iniciativa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CDES inst.">CDES inst.</SelectItem>
                  <SelectItem value="PES 2030">PES 2030</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {apartado === "CDES inst." && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Puesto de Trabajo</label>
                <Select value={puestoTrabajo} onValueChange={setPuestoTrabajo}>
                  <SelectTrigger className="border border-gray-300">
                    <SelectValue placeholder="Selecciona un puesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {puestosTrabajo.map(puesto => (
                      <SelectItem key={puesto} value={puesto}>{puesto}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {apartado === "PES 2030" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Estrategia</label>
                <Select value={estrategia} onValueChange={(value) => {
                  setEstrategia(value);
                  setProyecto("");
                }}>
                  <SelectTrigger className="border border-gray-300">
                    <SelectValue placeholder="Selecciona una estrategia" />
                  </SelectTrigger>
                  <SelectContent>
                    {pesEstrategias.map(est => (
                      <SelectItem key={est} value={est}>{est}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {apartado === "PES 2030" && estrategia && strategyProjects.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Proyecto</label>
                <Select value={proyecto} onValueChange={setProyecto}>
                  <SelectTrigger className="border border-gray-300">
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategyProjects.map(proj => (
                      <SelectItem key={proj} value={proj}>{proj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

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
              Arrastra tu archivo aquí
            </p>
            <p className="text-xs text-gray-500">
              o selecciónalo manualmente
            </p>
            <Input
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="mt-3"
            />
          </div>

          {file && (
            <div className="space-y-2">
              <div
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
                    onClick={handleRemoveFile}
                    className="text-red-500 hover:text-red-700"
                    disabled={uploading}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Tipo de documento
            </label>
            <Select
              value={tipoDocumento}
              onValueChange={setTipoDocumento}
              disabled={!apartado}
            >
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona el tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatDocumentType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              {uploading ? "Subiendo..." : "Subir documento"}
            </Button>
          </div>
        </form>

        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar subida</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres subir este documento?
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
