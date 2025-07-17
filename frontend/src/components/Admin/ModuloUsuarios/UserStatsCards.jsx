import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function UserStatsCards({ stats }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Usuarios totales</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.active}</p>
          <p className="text-sm text-muted-foreground">Usuarios activos</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.admins}</p>
          <p className="text-sm text-muted-foreground">Administradores</p>
        </CardContent>
      </Card>
    </div>
  );
}
