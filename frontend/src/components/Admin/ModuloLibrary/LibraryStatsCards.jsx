import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function LibraryStatsCards({ stats, statType, setStatType }) {
  return (
    <div className="grid md:grid-cols-3 gap-4 mb-6">
      {/* Total de documentos */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total de documentos</p>
        </CardContent>
      </Card>

      {/* Espacio total */}
      <Card>
        <CardContent className="p-6">
          <p className="text-2xl font-bold">
            {(stats.totalSizeMB || 0).toFixed(1)} MB
          </p>
          <p className="text-sm text-muted-foreground">Espacio total usado</p>
        </CardContent>
      </Card>

      {/* Documentos por formato */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {stats[statType] || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Documentos por formato
              </p>
            </div>
            <Select value={statType} onValueChange={setStatType}>
              <SelectTrigger className="w-[120px] ml-2">
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">Word</SelectItem>
                <SelectItem value="xlsx">Excel</SelectItem>
                <SelectItem value="pptx">PowerPoint</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
