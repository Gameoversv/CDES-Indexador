import React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ChangePasswordDialog({
  open,
  setOpen,
  selectedUser,
  newPassword,
  setNewPassword,
  onSubmit,
  processing = false,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Cambiar contraseña para {selectedUser?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <label className="text-sm">Nueva contraseña</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={processing}>
              {processing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando...
                </span>
              ) : (
                "Actualizar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
