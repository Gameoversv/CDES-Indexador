import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConfirmDeleteDialog({ open, file, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(state) => !state && onCancel()}>
      <DialogContent className="rounded-xl bg-white border border-gray-300">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Confirmar eliminación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar permanentemente el archivo 
            <span className="font-semibold text-gray-900"> "{file?.filename}"</span>?
          </p>
          <p className="text-sm text-red-600">
            Esta acción no se puede deshacer y el archivo se perderá permanentemente.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel} className="border border-gray-300 text-gray-900">
              Cancelar
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">
              Eliminar permanentemente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
