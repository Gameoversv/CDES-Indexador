import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, XCircle, AlertCircle } from "lucide-react";

/**
 * Calcula estadísticas directamente de los logs filtrados que se muestran en AuditLogsTable
 * @param {Array} logs - Array de logs filtrados
 * @param {Object} stats - Stats del backend (fallback si no hay logs)
 */
export default function AuditStatsCards({ logs = [], stats = { total: 0, bySeverity: {} } }) {
  const nf = new Intl.NumberFormat("es-DO");
  
  // Si hay logs filtrados, calcular estadísticas de ellos
  if (logs && logs.length > 0) {
    const calculatedStats = logs.reduce((acc, log) => {
      const severity = log.severity || log.level || "INFO";
      acc.total += 1;
      acc.bySeverity[severity] = (acc.bySeverity[severity] || 0) + 1;
      return acc;
    }, { 
      total: 0, 
      bySeverity: {} 
    });
    
    const get = (severity) => calculatedStats.bySeverity[severity] || 0;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{nf.format(calculatedStats.total)}</p>
                <p className="text-sm text-muted-foreground">Total eventos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{nf.format(get("WARNING"))}</p>
                <p className="text-sm text-muted-foreground">Advertencias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{nf.format(get("ERROR"))}</p>
                <p className="text-sm text-muted-foreground">Errores</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{nf.format(get("CRITICAL"))}</p>
                <p className="text-sm text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
