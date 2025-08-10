import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Globe, Link as LinkIcon, Network, Copy, Fingerprint } from "lucide-react";
import { cn } from "@/components/utils/utils";
import { getEventTypeInfo, getSeverityInfo, getSourceInfo } from "@/components/utils/auditUtils";

function safeStringify(value) {
  try {
    if (value == null) return "{}";
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    try { return String(value); } catch { return ""; }
  }
}

function pickDisplayUser(log) {
  return (
    log.user_display ||
    log?.details?.display_name ||
    log?.details?.user_email ||
    log.user_id ||
    "Sistema"
  );
}

export default function AuditLogDetailDialog({ log, open, onClose, formatDate }) {
  if (!log) return null;

  const eventInfo = getEventTypeInfo?.(log.event_type) || {
    label: log.event_type || "Evento",
    color: "bg-muted-foreground",
    icon: Globe,
  };
  const severityInfo = getSeverityInfo?.(log.severity) || {
    label: log.severity || "INFO",
    color: "bg-muted-foreground",
  };
  const sourceInfo = getSourceInfo?.(log.source || log.details?.source) || {
    label: log.source || log.details?.source || "desconocido",
    color: "bg-muted-foreground",
  };
  const EventIcon = eventInfo.icon || Globe;

  // timestamp robusto
  const ts = log.timestamp || log.created_at || log?.details?.timestamp_iso;

  const detailsPretty = safeStringify(log.details);
  const displayUser = pickDisplayUser(log);

  const route = log?.details?.route;
  const ip = log?.details?.client_ip;
  const ua = log?.details?.user_agent;
  const rawUserId = log.user_id;

  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(txt); } catch (_) {}
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.(); }}>
      {/* modal responsivo y contenido acotado al viewport */}
      <DialogContent className="w-[min(92vw,900px)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EventIcon className="h-5 w-5" />
            Detalles del Evento
            <Badge variant="outline" className="ml-2">{log.event_type}</Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{eventInfo.label}</span>
            <span>— {ts ? formatDate(ts) : "Sin fecha"}</span>
            <Badge variant="secondary" className="ml-2">{sourceInfo.label}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Usuario</label>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {displayUser}
              </p>
              {rawUserId && (
                <div className="mt-1 flex items-center gap-2">
                  <code className="text-xs text-muted-foreground break-all">{rawUserId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => copyText(rawUserId)}
                    title="Copiar user_id"
                  >
                    <Fingerprint className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Severidad</label>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                <span className="text-sm">{severityInfo.label}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Origen</label>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Globe className="h-3 w-3" />
                <Badge variant="secondary">{sourceInfo.label}</Badge>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Ruta</label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground break-all">{route || "N/D"}</p>
                {route && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyText(route)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">IP cliente</label>
              <div className="flex items-center gap-2">
                <Network className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{ip || "N/D"}</p>
                {ip && (
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyText(ip)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="text-sm font-medium">User-Agent</label>
              <p className="text-xs text-muted-foreground break-words">{ua || "N/D"}</p>
            </div>
          </div>

          {/* Detalles JSON */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Detalles (JSON)</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyText(detailsPretty)}
                className="gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar JSON
              </Button>
            </div>

            {/* Contenedor con scroll y wrapping */}
            <div className="mt-1 bg-muted rounded-md border overflow-auto max-h-[55vh] max-w-full">
              <pre className="m-0 w-full min-w-0 p-3 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                {detailsPretty}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
