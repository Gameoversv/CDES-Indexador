import React, { useEffect, useState } from "react";
import {
  BarChart2,
  File,
  Clock,
  CheckCircle,
  History,
  Settings,
  Upload,
  Search,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { documentsAPI } from "../services/api";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout"; // <-- Importa el layout

export default function DashboardPage() {
  const [metrics, setMetrics] = useState([
    { title: "Documentos", value: 0, description: "registrados", icon: File },
    { title: "Pendientes", value: 0, description: "por revisar", icon: Clock },
    { title: "Aprobados", value: 0, description: "listos para uso", icon: CheckCircle },
  ]);
  const [recentActivities, setRecentActivities] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await documentsAPI.list();
        const docs = data.documents || [];

        const totalDocs = docs.length;
        const pendientes = docs.filter((doc) => doc.status === "pendiente").length;
        const aprobados = docs.filter((doc) => doc.status === "aprobado").length;

        setMetrics([
          { title: "Documentos", value: totalDocs, description: "registrados", icon: File },
          { title: "Pendientes", value: pendientes, description: "por revisar", icon: Clock },
          { title: "Aprobados", value: aprobados, description: "listos para uso", icon: CheckCircle },
        ]);

        const sortedDocs = docs
          .filter((doc) => doc.date)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        const activities = sortedDocs.map((doc) => ({
          user: doc.last_modified_by || "Desconocido",
          action:
            doc.status === "aprobado"
              ? "aprobó el documento"
              : doc.status === "pendiente"
              ? "subió el documento"
              : "actualizó el documento",
          document: doc.title || doc.filename || "Documento sin título",
          date: new Date(doc.date).toLocaleString("es-ES"),
          icon: doc.status === "aprobado" ? CheckCircle : Settings,
        }));

        setRecentActivities(activities);
      } catch (error) {
        console.error("Error al cargar datos del dashboard:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <AdminLayout>
      <main className="p-4 md:p-6 bg-white text-black max-w-7xl mx-auto w-full">
        {/* Título */}
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-black/10 w-10 h-10 rounded-full flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-black" />
          </div>
          <h2 className="text-xl font-bold">Dashboard</h2>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-lg border border-black p-4 shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-black/10 w-10 h-10 rounded flex items-center justify-center">
                    <Icon className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-sm text-black">{metric.title}</h3>
                    <p className="text-lg font-semibold text-black">{metric.value}</p>
                    <p className="text-xs text-black">{metric.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            onClick={() => navigate("/upload")}
            className="w-full justify-start gap-3"
            variant="outline"
          >
            <Upload className="h-5 w-5" /> Subir documento
          </Button>
          <Button
            onClick={() => navigate("/search")}
            className="w-full justify-start gap-3"
            variant="outline"
          >
            <Search className="h-5 w-5" /> Buscar documento
          </Button>
          <Button
            onClick={() => navigate("/documents")}
            className="w-full justify-start gap-3"
            variant="outline"
          >
            <FileText className="h-5 w-5" /> Ver documentos
          </Button>
        </div>

        {/* Últimos movimientos */}
        <div className="bg-white rounded-lg border border-black p-4 shadow">
          <div className="flex items-center gap-2 mb-4">
            <History className="text-black h-5 w-5" />
            <h3 className="text-lg font-semibold text-black">Últimos movimientos</h3>
          </div>
          <div className="space-y-3">
            {recentActivities.length === 0 && (
              <p className="text-black text-center">No hay movimientos recientes</p>
            )}
            {recentActivities.map((activity, idx) => {
              const Icon = activity.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2 border-b border-black/10 last:border-0"
                >
                  <div className="bg-black/10 w-9 h-9 rounded flex items-center justify-center flex-shrink-0">
                    <Icon className="text-black h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-black">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-sm italic text-black">"{activity.document}"</p>
                    <p className="text-xs text-black/60">{activity.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </AdminLayout>
  );
}
