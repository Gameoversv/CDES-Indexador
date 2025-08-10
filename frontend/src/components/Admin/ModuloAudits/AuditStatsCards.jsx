import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, XCircle, AlertCircle } from "lucide-react";

/**
 * Espera un objeto:
 * stats = { total: number, bySeverity: { INFO?: number, WARNING?: number, ERROR?: number, CRITICAL?: number, DEBUG?: number } }
 */
export default function AuditStatsCards({ stats = { total: 0, bySeverity: {} } }) {
  const nf = new Intl.NumberFormat("es-DO");
  const bySeverity = stats?.bySeverity || {};
  const get = (k) => (typeof bySeverity[k] === "number" ? bySeverity[k] : 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{nf.format(stats?.total || 0)}</p>
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
