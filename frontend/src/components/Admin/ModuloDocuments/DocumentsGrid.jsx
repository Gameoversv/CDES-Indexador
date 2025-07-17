import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Eye, Trash2, Download, FileText, FileSpreadsheet, FileBarChart, File } from "lucide-react";

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

export default function DocumentsGrid({
  files,
  formatDate,
  formatSize,
  handleDownload,
  setPreviewFile,
  setConfirmDelete,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file, index) => (
        <Card
          key={index}
          className="bg-white border border-gray-300 shadow-none rounded-lg overflow-hidden hover:shadow-md transition-all"
        >
          <div className="p-1 bg-gray-100">
            <div className="flex justify-center py-4">
              {getFileIcon(file.filename)}
            </div>
          </div>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div>
                <p className="font-medium truncate text-gray-900" title={file.filename}>
                  {file.filename}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-gray-700">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(file.updated)}</span>
                </div>
                <div className="text-gray-700">{formatSize(file.size)}</div>
              </div>

              <div className="flex justify-between items-center mt-2">
                <Badge variant="secondary" className={getFileTypeColor(file.filename)}>
                  {file.filename?.split(".").pop()?.toUpperCase() || "FILE"}
                </Badge>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    onClick={() => setPreviewFile(file)}
                  >
                    <Eye className="h-4 w-4 text-gray-900" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    onClick={() => setConfirmDelete({ open: true, file })}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file.path, file.filename)}
                    className="rounded-full p-1.5 border border-gray-300 bg-blue-600 text-white hover:bg-blue-700"
                  >
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
