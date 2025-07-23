import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Layers, UploadCloud } from "lucide-react";

export default function LibraryStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Total de documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-bold">
          {stats.total || 0}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Tipos únicos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-bold">
          {stats.uniqueTypes || 0}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            Espacio usado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-bold">
          {(stats.totalSizeMB || 0).toFixed(1)} MB
        </CardContent>
      </Card>
    </div>
  );
}
