// ModuloLibrary/UploadDocumentDialog.jsx

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function UploadDocumentDialog({ onUpload }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef(null);
  const [section, setSection] = useState("CDES Inst.");
  const [isPublic, setIsPublic] = useState(true);

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.warning("Debes seleccionar un archivo");
      return;
    }

    const data = {
      file,
      section,
      public: isPublic,
    };

    onUpload(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Subir nuevo documento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir Documento Público</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm">Archivo</label>
            <Input type="file" ref={fileRef} />
          </div>
          <div>
            <label className="text-sm">Sección</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="CDES Inst.">CDES Inst.</option>
              <option value="PES 203P">PES 203P</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <label htmlFor="public" className="text-sm">
              Habilitar para biblioteca pública
            </label>
          </div>
          <div className="flex justify-end pt-2 gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload}>Subir</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
