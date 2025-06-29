import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, Activity, Shield } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";

export default function AdminDashboard() {
  const { currentUser } = useAuth();

  // Simulaciones visuales
  const recentDocs = [
    { name: "plan-estrategico.pdf", date: "2025-06-27" },
    { name: "informe-financiero.xlsx", date: "2025-06-26" },
  ];

  const recentAudits = [
    { action: "Subida de documento", date: "2025-06-27", user: "admin@cdes.do" },
    { action: "Acceso al sistema", date: "2025-06-26", user: "admin@cdes.do" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Bienvenido/a, {currentUser?.email}</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><FileText className="text-muted-foreground" /><div><p className="text-2xl font-bold">152</p><p className="text-sm text-muted-foreground">Documentos</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="text-muted-foreground" /><div><p className="text-2xl font-bold">14</p><p className="text-sm text-muted-foreground">Usuarios</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Shield className="text-muted-foreground" /><div><p className="text-2xl font-bold">9</p><p className="text-sm text-muted-foreground">Eventos críticos</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Activity className="text-muted-foreground" /><div><p className="text-2xl font-bold">27</p><p className="text-sm text-muted-foreground">Acciones recientes</p></div></CardContent></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg mb-2">Últimos Documentos</h3>
              <ul className="text-sm space-y-1">
                {recentDocs.map((doc, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{doc.name}</span>
                    <span className="text-muted-foreground">{doc.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg mb-2">Auditoría Reciente</h3>
              <ul className="text-sm space-y-1">
                {recentAudits.map((log, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{log.action}</span>
                    <span className="text-muted-foreground">{log.date}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
