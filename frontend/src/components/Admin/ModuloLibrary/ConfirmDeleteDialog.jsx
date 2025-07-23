// ModuloLibrary/ConfirmDeleteDialog.jsx

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function ConfirmDeleteDialog({
  open,
  setOpen,
  onConfirm,
  fileName,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Confirmar eliminación
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 text-sm text-muted-foreground">
          ¿Estás seguro de que deseas eliminar <strong>{fileName}</strong> de la biblioteca pública?
          Esta acción no se puede deshacer.
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
