import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Eye } from "lucide-react";
import { cn } from "@/components/utils/utils";
import { getEventTypeInfo, getSeverityInfo } from "@/components/utils/auditUtils";

export default function AuditLogsTable({ logs, formatDate, setSelectedLog }) {
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
            logs.map((log) => {
              const eventInfo = getEventTypeInfo(log.event_type);
              const severityInfo = getSeverityInfo(log.severity);
              const EventIcon = eventInfo.icon;

              return (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDate(log.timestamp)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                      <EventIcon className="h-4 w-4" />
                      <span className="font-medium">{eventInfo.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {log.user_id || "Sistema"}
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
                      {typeof log.details === "string"
                        ? log.details
                        : JSON.stringify(log.details)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
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
