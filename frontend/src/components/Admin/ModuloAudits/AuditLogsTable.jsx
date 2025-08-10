import React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User as UserIcon, Eye, Globe } from "lucide-react";
import { cn } from "@/components/utils/utils";
import {
  getEventTypeInfo,
  getSeverityInfo,
  getDisplayUser,
  getDetailsPreview,
  getSourceInfo,
} from "@/components/utils/auditUtils";

function safeStringify(value) {
  try { return typeof value === "string" ? value : JSON.stringify(value); }
  catch { return String(value); }
}

export default function AuditLogsTable({ logs = [], formatDate, setSelectedLog }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Severidad</TableHead>
            <TableHead>Detalles</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.isArray(logs) && logs.length > 0 ? (
            logs.map((log, idx) => {
              const ts =
                log.timestamp ||
                log.created_at ||
                log?.details?.timestamp_iso;

              const eventInfo = getEventTypeInfo(log.event_type);
              const severityInfo = getSeverityInfo(log.severity);
              const sourceInfo = getSourceInfo(log.source);
              const EventIcon = eventInfo.icon || Globe;

              // Detalles (preferimos resumen amigable y caemos a JSON corto si viene vacío)
              const pretty = getDetailsPreview(log);
              const fallbackRaw = safeStringify(log.details ?? "");
              const detailsPreview = pretty || (fallbackRaw.length > 200 ? `${fallbackRaw.slice(0, 200)}…` : fallbackRaw);

              // Usuario visible
              const displayUser = getDisplayUser(log);

              return (
                <TableRow key={log.id || `${log.event_type}-${ts}-${idx}`}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {ts ? formatDate(ts) : "Sin fecha"}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                      <EventIcon className="h-4 w-4" />
                      <span className="font-medium">{eventInfo.label}</span>
                      <Badge variant="secondary" className="ml-2 px-2 py-0 text-xs">
                        {sourceInfo.label}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                      {displayUser}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                      {severityInfo.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="max-w-64 truncate text-sm text-muted-foreground">
                      {detailsPreview}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay registros disponibles.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
