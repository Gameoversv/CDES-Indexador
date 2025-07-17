import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User } from "lucide-react";
import { cn } from "@/components/utils/utils";
import { getEventTypeInfo, getSeverityInfo } from "@/components/utils/auditUtils";


export default function AuditLogDetailDialog({ log, open, onClose, formatDate }) {
  if (!log) return null;

  const eventInfo = getEventTypeInfo(log.event_type);
  const severityInfo = getSeverityInfo(log.severity);
  const EventIcon = eventInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EventIcon className="h-5 w-5" />
            Detalles del Evento
          </DialogTitle>
          <DialogDescription>
            {eventInfo.label} — {formatDate(log.timestamp)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Usuario</label>
              <p className="text-sm text-muted-foreground">
                {log.user_id || "Sistema"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Severidad</label>
              <div className="flex items-center gap-1">
                <div
                  className={cn("w-2 h-2 rounded-full", severityInfo.color)}
                />
                <span className="text-sm">{severityInfo.label}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Detalles</label>
            <pre className="mt-1 p-3 bg-muted rounded-md text-sm overflow-auto">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
