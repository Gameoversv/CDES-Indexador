import React from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { History } from "lucide-react";

const mockAuditLogs = [
  {
    user: "Juan Pérez",
    action: "Subió el documento plan2025.docx",
    date: "2025-06-27 14:32",
    type: "subida",
  },
  {
    user: "Ana García",
    action: "Cambiado rol de Carlos Díaz a lector",
    date: "2025-06-26 09:17",
    type: "modificación",
  },
  {
    user: "Carlos Díaz",
    action: "Eliminó el documento datos.xlsx",
    date: "2025-06-25 17:01",
    type: "eliminación",
  },
];

const typeColors = {
  subida: "success",
  modificación: "secondary",
  eliminación: "destructive",
};

export default function Audit() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" />
          Auditoría del Sistema
        </h2>
        <p className="text-muted-foreground">
          Registro de acciones realizadas por los usuarios administradores
        </p>

        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAuditLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>
                      <Badge variant={typeColors[log.type] || "outline"}>
                        {log.type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
