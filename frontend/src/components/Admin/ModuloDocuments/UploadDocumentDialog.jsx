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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { documentsAPI } from "@/services/api";

export default function UploadDocumentDialog({ open, setOpen, onUploaded }) {
  const [newFile, setNewFile] = useState(null);
  const [apartado, setApartado] = useState("");
  const [publico, setPublico] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newFile || !apartado) {
      toast.warning("Debes seleccionar un archivo y un apartado.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", newFile);
      formData.append("apartado", apartado);
      formData.append("publico", publico);
      await documentsAPI.upload(formData);
      toast.success("Archivo subido correctamente.");
      setOpen(false);
      setNewFile(null);
      setApartado("");
      setPublico(false);
      onUploaded();
    } catch (error) {
      console.error("Error al subir archivo:", error);
      toast.error("Error al subir el archivo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
        className="gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-red-600 text-white hover:bg-red-700">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Subir documento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-xl border border-gray-300 bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Subir nuevo documento</DialogTitle>
          <DialogDescription className="text-gray-700">
            Complete la información del documento a subir
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">Archivo</label>
            <Input type="file" accept=".pdf,.docx,.xlsx,.pptx" onChange={(e) => setNewFile(e.target.files?.[0] || null)} required />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">Apartado</label>
            <Select value={apartado} onValueChange={setApartado}>
              <SelectTrigger className="border border-gray-300">
                <SelectValue placeholder="Selecciona un apartado" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-300">
                <SelectItem value="CDES Inst." className="text-gray-900">CDES Inst.</SelectItem>
                <SelectItem value="PES 203P" className="text-gray-900">PES 203P</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="publico" checked={publico} onChange={(e) => setPublico(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <label htmlFor="publico" className="text-sm text-gray-900">Habilitar en biblioteca pública</label>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} className="border border-gray-300 text-gray-900">Cancelar</Button>
            <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">Subir documento</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
