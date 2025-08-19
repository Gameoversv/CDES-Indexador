import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  UploadCloud,
  File,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
} from "lucide-react";

const ACCEPTED_TYPES = {
  "application/pdf": { icon: FileText, label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { icon: FileText, label: "DOCX" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { icon: FileSpreadsheet, label: "XLSX" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { icon: Presentation, label: "PPTX" },
  "image/*": { icon: FileImage, label: "Imagen" }
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function FileUpload({
  file,
  onFileSelect,
  onFileRemove,
  acceptedTypes = ".pdf,.docx,.xlsx,.pptx",
  acceptedMimeTypes = Object.keys(ACCEPTED_TYPES).filter(type => !type.includes("image")),
  maxSize = MAX_FILE_SIZE,
  uploading = false,
  progress = 0,
  placeholder = "Arrastra tu archivo aquí o selecciónalo manualmente",
  className = "",
  showProgress = true,
  variant = "default", // "default", "compact", "minimal"
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // VALIDACIÓN DE ARCHIVO
  const validateFile = (selectedFile) => {
    const errors = [];
    
    if (!selectedFile) {
      errors.push("No se seleccionó ningún archivo");
      return { isValid: false, errors };
    }

    // Verificar tipo de archivo
    const isValidType = acceptedMimeTypes.some(type => {
      if (type.includes("*")) {
        return selectedFile.type.startsWith(type.split("*")[0]);
      }
      return selectedFile.type === type;
    });

    if (!isValidType) {
      errors.push("Tipo de archivo no soportado");
    }
    
    // Verificar tamaño
    if (selectedFile.size > maxSize) {
      errors.push(`Archivo demasiado grande (máximo ${Math.round(maxSize / 1024 / 1024)}MB)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      size: selectedFile.size,
      type: selectedFile.type,
      name: selectedFile.name
    };
  };

  // MANEJAR SELECCIÓN DE ARCHIVO
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    
    const validation = validateFile(selectedFile);
    
    if (validation.isValid) {
      setError("");
      onFileSelect(selectedFile);
      
      // FIX: Actualizar el input file para mostrar el nombre
      if (fileInputRef.current) {
        // Crear un nuevo DataTransfer para actualizar el input
        const dt = new DataTransfer();
        dt.items.add(selectedFile);
        fileInputRef.current.files = dt.files;
      }
    } else {
      setError(validation.errors.join(", "));
      onFileSelect(null);
    }
  };

  // EVENTOS DE DRAG & DROP
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  // OBTENER ÍCONO DEL ARCHIVO
  const getFileIcon = (filename) => {
    if (!filename) return File;
    
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return FileText;
      case 'docx': return FileText;
      case 'xlsx': return FileSpreadsheet;
      case 'pptx': return Presentation;
      default: return File;
    }
  };

  // ✅ FORMATEAR TAMAÑO DE ARCHIVO
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ✅ RENDER SEGÚN VARIANTE
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="flex-grow"
            disabled={uploading}
          />
          {file && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onFileRemove();
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        
        {file && showProgress && uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subiendo...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={cn("space-y-2", className)}>
        <Input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
          disabled={uploading}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ✅ RENDER DEFAULT (CON DRAG & DROP)
  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging ? "border-red-500 bg-red-50" : "border-gray-300",
          file ? "border-green-500 bg-green-50" : "",
          uploading ? "opacity-50 pointer-events-none" : ""
        )}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {!file ? (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <UploadCloud className="h-8 w-8 text-gray-500" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                {placeholder.split(" o ")[0]}
              </p>
              <p className="text-sm text-gray-500">
                {placeholder.split(" o ")[1] || "o selecciónalo manualmente"}
              </p>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {React.createElement(getFileIcon(file.name), {
                className: "h-8 w-8 text-green-600"
              })}
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                  setError("");
                }}
                disabled={uploading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Remover
              </Button>
            </div>
            
            {/* Input oculto para mantener la funcionalidad */}
            <Input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes}
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Progress Bar */}
      {file && showProgress && uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subiendo archivo...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );
}