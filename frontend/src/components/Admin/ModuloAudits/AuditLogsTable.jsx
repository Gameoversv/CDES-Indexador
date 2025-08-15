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
        <TableHeader className="bg-gray-100">
          <TableRow>
            <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Fecha</TableHead>
            <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Evento</TableHead>
            <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Usuario</TableHead>
            <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Severidad</TableHead>
            <TableHead className="py-3 border-b border-gray-300 text-gray-900 font-semibold">Detalles</TableHead>
            <TableHead className="text-right py-3 border-b border-gray-300 text-gray-900 font-semibold">Acciones</TableHead>
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

              const pretty = getDetailsPreview(log);
              const fallbackRaw = safeStringify(log.details ?? "");
              const detailsPreview = pretty || (fallbackRaw.length > 200 ? `${fallbackRaw.slice(0, 200)}…` : fallbackRaw);

              const displayUser = getDisplayUser(log);

              return (
                <TableRow key={log.id || `${log.event_type}-${ts}-${idx}`} className="hover:bg-gray-50 border-b border-gray-300">
                  <TableCell className="text-gray-900">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3 w-3 text-gray-700" />
                      {ts ? formatDate(ts) : "Sin fecha"}
                    </div>
                  </TableCell>

                  <TableCell className="text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                      <EventIcon className="h-4 w-4" />
                      <span className="font-medium">{eventInfo.label}</span>
                      <Badge variant="secondary" className="ml-2 px-2 py-0 text-xs border border-gray-300">
                        {sourceInfo.label}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell className="text-gray-900">
                    <div className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3 text-gray-700" />
                      {displayUser}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="gap-1 border border-gray-300">
                      <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                      {severityInfo.label}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-gray-900">
                    <div className="max-w-64 truncate text-sm">
                      {detailsPreview}
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => setSelectedLog(log)}>
                      <Eye className="h-4 w-4 text-gray-900" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                No hay registros disponibles.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
