import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Download, FileText, FileSpreadsheet, FileBarChart, File } from "lucide-react";

export default function LibraryGridView({
  documents = [],
  onView = () => {},
  onDownload = () => {},
  onDelete = () => {},
}) {
  // Función para ícono según extensión
  const getFileIcon = (filename) => {
    const ext = filename?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return <FileText className="text-red-600" size={32} />;
      case "doc":
      case "docx": return <FileText className="text-blue-600" size={32} />;
      case "xls":
      case "xlsx": return <FileSpreadsheet className="text-green-600" size={32} />;
      case "ppt":
      case "pptx": return <FileBarChart className="text-orange-600" size={32} />;
      default: return <File className="text-gray-600" size={32} />;
    }
  };

  // Color de badge según extensión
  const getFileTypeColor = (filename) => {
    const ext = filename?.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf": return "bg-red-100 text-red-700 border border-gray-300";
      case "doc":
      case "docx": return "bg-blue-100 text-blue-700 border border-gray-300";
      case "xls":
      case "xlsx": return "bg-green-100 text-green-700 border border-gray-300";
      case "ppt":
      case "pptx": return "bg-orange-100 text-orange-700 border border-gray-300";
      default: return "bg-gray-100 text-gray-700 border border-gray-300";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((file, idx) => (
        <Card
          key={file.path || idx}
          className="bg-white border border-gray-300 shadow-none rounded-lg overflow-hidden hover:shadow-md transition-all"
        >
          <div className="p-1 bg-gray-100">
            <div className="flex justify-center py-4">
              {getFileIcon(file.name || file.filename)}
            </div>
          </div>
          <CardContent className="p-4">
            <div className="space-y-3">
              <p className="font-medium truncate text-gray-900" title={file.name || file.filename}>
                {file.name || file.filename}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <span>{file.updated ? new Date(file.updated).toLocaleDateString() : "-"}</span>
                <span>{/* Puedes agregar tamaño si está disponible: file.size */}</span>
              </div>

              <div className="flex justify-between items-center mt-2">
                <Badge variant="secondary" className={getFileTypeColor(file.name || file.filename)}>
                  {(file.name || file.filename).split(".").pop()?.toUpperCase() || "FILE"}
                </Badge>

                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onView(file)}>
                    <Eye className="h-4 w-4 text-gray-900" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={() => onDelete(file)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDownload(file)} className="rounded-full p-1.5 border border-gray-300 bg-red-600 text-white hover:bg-red-700">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
