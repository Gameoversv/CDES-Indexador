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
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { documentsAPI } from "../services/api";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";

export default function DashboardPage() {
  const [totalDocs, setTotalDocs] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [approvedDocs, setApprovedDocs] = useState(0);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Obtener todos los documentos
        const documentsResponse = await documentsAPI.listStorage();
        const documents = documentsResponse.data?.files || [];
        
        // 2. Calcular métricas
        setTotalDocs(documents.length);
        setPendingDocs(documents.filter(doc => doc.status === "review" || doc.status === "draft").length);
        setApprovedDocs(documents.filter(doc => doc.status === "approved" || doc.status === "published").length);
        
        // 3. Preparar actividades recientes
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

  // Métricas para mostrar
  const metrics = [
    { title: "Documentos", value: totalDocs, description: "registrados", icon: File },
    { title: "Pendientes", value: pendingDocs, description: "por revisar", icon: Clock },
    { title: "Aprobados", value: approvedDocs, description: "listos para uso", icon: CheckCircle },
  ];

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
            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {metrics.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <div key={idx} className="bg-white rounded-lg border border-black p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-200 w-10 h-10 rounded-full flex items-center justify-center">
                        <Icon className="h-5 w-5 text-black" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-700">{metric.title}</h3>
                        <p className="text-2xl font-bold text-black">{metric.value}</p>
                        <p className="text-xs text-gray-600">{metric.description}</p>
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
                className="w-full justify-start gap-3 py-4 border border-black"
              >
                <Upload className="h-5 w-5" /> Subir documento
              </Button>
              <Button 
                onClick={() => navigate("/search")} 
                className="w-full justify-start gap-3 py-4 border border-black"
              >
                <Search className="h-5 w-5" /> Buscar documento
              </Button>
              <Button 
                onClick={() => navigate("/documents")} 
                className="w-full justify-start gap-3 py-4 border border-black"
              >
                <FileText className="h-5 w-5" /> Ver documentos
              </Button>
            </div>

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