import React, { useEffect, useState } from "react";
import {
  BarChart2,
  File,
  Clock,
  CheckCircle,
  History,
  Settings,
  Loader2
} from "lucide-react";
import { documentsAPI } from "../../../services/api";
import AdminLayout from "@/components/Admin/Layout/AdminLayout";

export default function DashboardPage() {
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Obtener todos los documentos
        const documentsResponse = await documentsAPI.listStorage();
        const documents = documentsResponse.data?.files || [];
        
        // 2. Preparar actividades recientes
        const activities = documents
          .sort((a, b) => new Date(b.updated) - new Date(a.updated)) // Ordenar por fecha más reciente
          .slice(0, 5) // Tomar solo los 5 más recientes
          .map(doc => {
            let action, icon;
            
            switch (doc.status) {
              case "approved":
              case "published":
                action = "aprobó el documento";
                icon = CheckCircle;
                break;
              case "review":
                action = "envió para revisión";
                icon = Clock;
                break;
              case "draft":
                action = "creó borrador";
                icon = File;
                break;
              default:
                action = "actualizó el documento";
                icon = Settings;
            }
            
            return {
              id: doc.id,
              user: doc.createdBy || "Administrador",
              action,
              document: doc.title || doc.filename,
              date: new Date(doc.updated).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              }),
              icon
            };
          });
        
        setRecentActivities(activities);
      } catch (err) {
        console.error("Error al cargar datos del dashboard:", err);
        setError("Error cargando datos. Intenta de nuevo más tarde.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <AdminLayout>
      <main className="p-4 md:p-6 bg-white text-black max-w-7xl mx-auto w-full">
        {/* Título */}
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-black" />
          </div>
          <h2 className="text-xl font-bold">Dashboard</h2>
        </div>

        {/* Estado de carga */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-black" />
            <p className="mt-4 text-lg font-medium text-black">Cargando dashboard...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Contenido principal */}
        {!loading && !error && (
          <>
            {/* Últimos movimientos */}
            <div className="bg-white rounded-lg border border-black p-4">
              <div className="flex items-center gap-2 mb-4">
                <History className="text-black h-5 w-5" />
                <h3 className="text-lg font-semibold text-black">Últimos movimientos</h3>
              </div>
              
              <div className="space-y-3">
                {recentActivities.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">No hay movimientos recientes</p>
                ) : (
                  recentActivities.map((activity) => {
                    const Icon = activity.icon;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="bg-gray-200 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon className="text-black h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm text-black">
                            <span className="font-medium">{activity.user}</span> {activity.action}
                          </p>
                          <p className="text-sm font-medium text-black">"{activity.document}"</p>
                          <p className="text-xs text-gray-600">{activity.date}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </AdminLayout>
  );
}