import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function DocumentStatsCard({ stats }) {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total de documentos</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.totalSize}</p>
          <p className="text-sm text-muted-foreground">Espacio total usado</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.pdfs}</p>
          <p className="text-sm text-muted-foreground">Documentos PDF</p>
        </CardContent>
      </Card>
    </div>
  );
}
