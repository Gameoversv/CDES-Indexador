import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Globe, Link as LinkIcon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/utils/utils";
import { getEventTypeInfo, getSeverityInfo } from "@/components/utils/auditUtils";

function safeStringify(value) {
  try { return typeof value === "string" ? value : JSON.stringify(value); }
  catch { return String(value); }
}

export default function AuditLogMobileCards({ logs = [], formatDate, onSelect }) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return (
      <div className="md:hidden text-center text-muted-foreground text-sm mt-4">
        No hay registros disponibles.
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {logs.map((log, idx) => {
        const eventInfo = getEventTypeInfo?.(log.event_type) || {
          label: log.event_type || "Evento",
          color: "bg-muted-foreground",
          icon: Globe,
        };
        const severityInfo = getSeverityInfo?.(log.severity) || {
          label: log.severity || "INFO",
          color: "bg-muted-foreground",
        };
        const EventIcon = eventInfo.icon || Globe;

        const ts = log.timestamp || log.created_at || log?.details?.timestamp_iso;
        const src = log.source || log?.details?.source;
        const route = log?.details?.route;

        // Detalles truncados (mobile)
        const rawDetails = safeStringify(log.details ?? "");
        const detailsPreview = rawDetails.length > 180 ? rawDetails.slice(0, 180) + "…" : rawDetails;

        return (
          <Card key={log.id || `${ts}-${idx}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                  <EventIcon className="h-4 w-4" />
                  <span className="font-medium">{eventInfo.label}</span>
                </div>
                <Badge variant="outline" className="gap-1">
                  <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                  {severityInfo.label}
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ts ? formatDate(ts) : "Sin fecha"}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.user_id || "Sistema"}
                </div>
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  <span className="truncate">{src || "origen desconocido"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate">{route || "N/D"}</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground break-words">
                {detailsPreview}
              </div>

              {onSelect && (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => onSelect(log)}
                  >
                    <Eye className="h-4 w-4" /> Ver detalle
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
