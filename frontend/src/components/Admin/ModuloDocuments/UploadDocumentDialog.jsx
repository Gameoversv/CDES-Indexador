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
  Image as ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import FileUpload from "@/components/ui/FileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { documentTypesByRole, formatDocumentType } from "@/constants/documentTypes";
import { puestosTrabajo } from "@/constants/jobPositions";
import { pesEstrategias } from "@/constants/pesEstrategias";
import { documentsAPI } from "@/services/documentsAPI";

const allDocumentTypes = [
  ...new Set(Object.values(documentTypesByRole).flat()),
].sort();

export default function UploadDocumentDialog({ open, setOpen, onUploaded }) {
  const { userRole } = useAuth();
  const { uploading, progress, uploadFile, reset } = useFileUpload();
  
  // ESTADOS DEL FORMULARIO
  const [file, setFile] = useState(null);
  const [apartado, setApartado] = useState("");
  const [estrategia, setEstrategia] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [puestoTrabajo, setPuestoTrabajo] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [publico, setPublico] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [strategyProjects, setStrategyProjects] = useState([]);

  // Los administradores tienen acceso a todos los tipos de documentos
  const availableDocumentTypes = allDocumentTypes;

  useEffect(() => {
    console.log("🔍 useEffect triggered:", { apartado, estrategia });
    
    if (apartado === "PES 2030" && estrategia) {
      console.log("� Making API call for strategy:", estrategia);
      
      documentsAPI.getProjectsByStrategy(estrategia)
        .then(response => {
          console.log("✅ API Response received:", response);
          console.log("✅ Response data structure:", JSON.stringify(response.data, null, 2));
          
          const projects = new Set();
          const files = response.data?.files || [];
          console.log("📁 Files array:", files);
          console.log("📁 Files count:", files.length);
          
          files.forEach((file, index) => {
            console.log(`📄 Processing file ${index}:`, file.path);
            
            const pathParts = file.path.split('/');
            console.log(`🔗 Path parts:`, pathParts);
            
            // Para archivos: PES_2030/Economía/carta/2025/08/archivo.pdf
            // Queremos extraer "carta" (índice 2)
            if (pathParts.length >= 3 && pathParts[0] === 'PES_2030' && pathParts[1] === estrategia) {
              const projectName = pathParts[2];
              console.log(`🎯 Found project from file path: "${projectName}"`);
              
              if (projectName && !projectName.match(/^\d{4}$/)) {
                console.log(`✅ Adding project: "${projectName}"`);
                projects.add(projectName);
              } else {
                console.log(`❌ Rejected project (year pattern): "${projectName}"`);
              }
            } else {
              console.log(`❌ Path doesn't match pattern:`, {
                length: pathParts.length,
                part0: pathParts[0],
                part1: pathParts[1],
                expectedPart1: estrategia
              });
            }
          });
          
          const projectsList = Array.from(projects).sort();
          console.log("🏁 Final projects list:", projectsList);
          setStrategyProjects(projectsList);
        })
        .catch(error => {
          console.error("❌ API Error:", error);
          console.error("❌ Error response:", error.response?.data);
          console.error("❌ Error status:", error.response?.status);
          setStrategyProjects([]);
        });
    } else {
      console.log("🔄 Resetting projects (no valid apartado/estrategia)");
      setStrategyProjects([]);
      setProyecto("");
    }
  }, [apartado, estrategia]);

  // MANEJAR SELECCIÓN DE IMAGEN DE PORTADA
  const handleCoverImageSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  // ✅ VALIDAR FORMULARIO
  const validateForm = () => {
    if (!file || !apartado || !tipoDocumento) {
      toast.warning("Debes seleccionar un archivo, una iniciativa y un tipo de documento.");
      return false;
    }
    
    if (apartado === "PES 2030" && !estrategia) {
      toast.warning("Debes seleccionar una estrategia para PES 2030.");
      return false;
    }
    if (apartado === "CDES inst." && !puestoTrabajo) {
      toast.warning("Debes seleccionar un puesto de trabajo para CDES inst.");
      return false;
    }
    
    if (publico && !coverImage) {
      toast.warning("Debes seleccionar una imagen de portada para un documento público.");
      return false;
    }
    
    return true;
  };

  // ✅ MANEJAR SOLICITUD DE SUBIDA
  const handleUploadRequest = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmDialog(true);
    }
  };

  // ✅ CONFIRMAR Y SUBIR
  const handleConfirmUpload = async () => {
    setShowConfirmDialog(false);
    
    const metadata = {
      apartado,
      categoria: tipoDocumento,
      user_role: userRole || "admin",
      is_public: publico,
    };
    
    if (apartado === "PES 2030") {
      metadata.estrategia = estrategia;
      if (proyecto) {
        metadata.proyecto = proyecto;
      }
    }
    if (apartado === "CDES inst.") {
      metadata.puesto_trabajo = puestoTrabajo;
    }
    
    if (publico && coverImage) {
      metadata.cover_image = coverImage;
    }

    const success = await uploadFile(
      file, 
      metadata,
      (data) => {
        // Success callback
        handleCloseDialog();
        onUploaded?.();
      },
      (error) => {
        // Error callback
        console.error("Error al subir archivo:", error);
      }
    );
  };

  // ✅ CERRAR DIÁLOGO Y LIMPIAR
  const handleCloseDialog = () => {
    setOpen(false);
    setFile(null);
    setApartado("");
    setEstrategia("");
    setTipoDocumento("");
    setPuestoTrabajo("");
    setProyecto("");
    setPublico(false);
    setCoverImage(null);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2 px-3 py-2 rounded-lg">
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Subir Documento</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="rounded-xl max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Subir Documento (Admin)
          </DialogTitle>
          <DialogDescription>
            Sube un documento para indexación con privilegios de administrador.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 mt-4" onSubmit={handleUploadRequest}>
          {/* Apartado y Estrategia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Iniciativa</label>
              <Select
                value={apartado}
                onValueChange={(value) => {
                  setApartado(value);
                  setEstrategia("");
                  setTipoDocumento("");
                  setPuestoTrabajo("");
                  setProyecto("");
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
                    {puestosTrabajo.map((puesto) => (
                      <SelectItem key={puesto} value={puesto}>
                        {puesto}
                      </SelectItem>
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
                    {pesEstrategias.map((est) => (
                      <SelectItem key={est} value={est}>
                        {est}
                      </SelectItem>
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

          {/* ✅ COMPONENTE DE SUBIDA MODULAR */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Archivo</label>
            <FileUpload
              file={file}
              onFileSelect={setFile}
              onFileRemove={() => setFile(null)}
              uploading={uploading}
              progress={progress}
              placeholder="Arrastra tu archivo aquí o selecciónalo manualmente"
              acceptedTypes=".pdf,.docx,.xlsx,.pptx,.mp4,.jpg,.jpeg,.png,.avi"
            />
          </div>

          {/* Tipo de documento */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Tipo de documento</label>
            <Select
              value={tipoDocumento}
              onValueChange={setTipoDocumento}
              disabled={!apartado}
            >
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona el tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {availableDocumentTypes.map((type) => (
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

          {/* Imagen de portada */}
          {publico && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Imagen de Portada</label>
              <FileUpload
                file={coverImage}
                onFileSelect={setCoverImage}
                onFileRemove={() => setCoverImage(null)}
                variant="compact"
                acceptedTypes="image/*"
                acceptedMimeTypes={["image/*"]}
                placeholder="Selecciona una imagen de portada"
                showProgress={false}
              />
              <p className="text-xs text-gray-500">
                Sube una imagen para la portada del documento en la biblioteca pública.
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={uploading}>
              {uploading ? `Subiendo... ${Math.round(progress)}%` : "Subir documento"}
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar subida</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres subir este documento?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                disabled={uploading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </span>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
