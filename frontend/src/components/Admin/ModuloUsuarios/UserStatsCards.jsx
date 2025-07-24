import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

export default function UserStatsCards({ stats }) {
  const [selectedRole, setSelectedRole] = useState("admin");

  const roleMap = {
    admin: "Administradores",
    secretaria: "Secretarias",
    supervisor: "Supervisores",
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Total usuarios */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Usuarios totales</p>
        </CardContent>
      </Card>

      {/* Activos */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.active}</p>
          <p className="text-sm text-muted-foreground">Usuarios activos</p>
        </CardContent>
      </Card>

      {/* Por rol con dropdown */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-1">
            <p className="text-2xl font-bold">{stats[selectedRole]}</p>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[120px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="secretaria">Secretarias</SelectItem>
                <SelectItem value="supervisor">Supervisores</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">Usuarios por rol</p>
        </CardContent>
      </Card>
    </div>
  );
}
