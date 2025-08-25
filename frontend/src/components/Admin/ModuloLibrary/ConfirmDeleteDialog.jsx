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
import { Eye, EyeOff } from "lucide-react";

export default function ConfirmDeleteDialog({
  open,
  setOpen,
  onConfirm,
  doc,
  fileName,
}) {
  const name = doc?.name || fileName || doc?.filename || "documento";
  const isPublic = !!doc?.public;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPublic ? (
              <EyeOff className="w-5 h-5 text-red-500" />
            ) : (
              <Eye className="w-5 h-5 text-green-600" />
            )}
            Confirmar cambio de visibilidad
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 text-sm text-muted-foreground">
          {isPublic ? (
            <>¿Estás seguro de que deseas cambiar la visibilidad de <strong>{name}</strong> de público a privado? Este documento ya no estará disponible en la biblioteca pública.</>
          ) : (
            <>¿Estás seguro de que deseas cambiar la visibilidad de <strong>{name}</strong> de privado a público? Este documento pasará a estar disponible en la biblioteca pública.</>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {isPublic ? "Cambiar a privado" : "Cambiar a público"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
