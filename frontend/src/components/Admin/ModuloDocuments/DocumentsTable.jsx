import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Trash2,
  Download,
  ArrowUpDown,
  Calendar,
  FileText,
  FileSpreadsheet,
  FileBarChart,
  File,
} from "lucide-react";

const getFileIcon = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="text-red-600" size={20} />;
    case "doc":
    case "docx":
      return <FileText className="text-blue-600" size={20} />;
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="text-green-600" size={20} />;
    case "ppt":
    case "pptx":
      return <FileBarChart className="text-orange-600" size={20} />;
    default:
      return <File className="text-gray-600" size={20} />;
  }
};

const getFileTypeColor = (filename) => {
  const ext = filename?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "bg-red-100 text-red-700 border border-gray-300";
    case "doc":
    case "docx":
      return "bg-blue-100 text-blue-700 border border-gray-300";
    case "xls":
    case "xlsx":
      return "bg-green-100 text-green-700 border border-gray-300";
    case "ppt":
    case "pptx":
      return "bg-orange-100 text-orange-700 border border-gray-300";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-300";
  }
};

export default function DocumentsTable({
  files,
  handleSort,
  setPreviewFile,
  setConfirmDelete,
  handleDownload,
  formatSize,
  formatDate,
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-gray-100">
          <TableRow>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("filename")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Archivo
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("size")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Tamaño
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer py-3 border-b border-gray-300"
              onClick={() => handleSort("updated")}
            >
              <div className="flex items-center gap-1 text-gray-900 font-semibold">
                Última modificación
                <ArrowUpDown className="h-3 w-3" />
              </div>
            </TableHead>
            <TableHead className="border-b border-gray-300 text-gray-900 font-semibold">
              Tipo
            </TableHead>
            <TableHead className="border-b border-gray-300 text-gray-900 font-semibold">
              Formato
            </TableHead>
            <TableHead className="text-right border-b border-gray-300 text-gray-900 font-semibold">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file, index) => (
            <TableRow
              key={index}
              className="hover:bg-gray-50 border-b border-gray-300"
            >
              <TableCell className="font-medium text-gray-900">
                <div className="flex items-center gap-3">
                  {getFileIcon(file.filename)}
                  <div className="font-medium truncate max-w-xs">
                    {file.filename}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-gray-900">
                {formatSize(file.size)}
              </TableCell>
              <TableCell className="text-gray-900">
                <div className="flex items-center gap-1 text-sm text-gray-700">
                  <Calendar className="h-3 w-3" />
                  {formatDate(file.updated)}
                </div>
              </TableCell>
              <TableCell className="text-gray-900">
                {file.tipo || "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={getFileTypeColor(file.filename)}
                >
                  {file.filename?.split(".").pop()?.toUpperCase() || "FILE"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    onClick={() => setPreviewFile(file)}
                  >
                    <Eye className="h-4 w-4 text-gray-900" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full p-2 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                    onClick={() => setConfirmDelete({ open: true, file })}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file.path, file.filename)}
                    className="gap-1 px-3 border border-gray-300 bg-red-600 text-white hover:bg-red-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
