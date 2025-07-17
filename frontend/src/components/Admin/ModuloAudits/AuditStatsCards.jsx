import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, XCircle, AlertCircle } from "lucide-react";

export default function AuditStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
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
              <p className="text-2xl font-bold">{stats.bySeverity.WARNING || 0}</p>
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
              <p className="text-2xl font-bold">{stats.bySeverity.ERROR || 0}</p>
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
              <p className="text-2xl font-bold">{stats.bySeverity.CRITICAL || 0}</p>
              <p className="text-sm text-muted-foreground">Críticos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
