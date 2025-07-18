export function getFileTypeColor(filename) {
  const extension = filename?.split(".").pop().toLowerCase();
  switch (extension) {
    case "pdf":
      return "text-red-600";
    case "doc":
    case "docx":
      return "text-indigo-600";
    case "png":
    case "jpg":
    case "jpeg":
      return "text-blue-600";
    case "xls":
    case "xlsx":
      return "text-green-600";
    case "ppt":
    case "pptx":
      return "text-orange-600";
    default:
      return "text-gray-500";
  }
}
