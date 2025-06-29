/**
 * Componente de Subida de Documentos - Carga de Archivos al Sistema
 * 
 * Este componente proporciona una interfaz completa para la subida de documentos
 * al sistema. Incluye validación de archivos, procesamiento con IA, y gestión
 * de metadatos automática usando Google Gemini.
 */

import React, { useState, useCallback } from "react";
import { documentsAPI } from "../services/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  CloudUpload,
  FileCheck,
  Info,
  Sparkles
} from "lucide-react";

export default function UploadDocument() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // success, error, info
  const [fileValidation, setFileValidation] = useState(null);

  const ACCEPTED_TYPES = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const validateFile = (file) => {
    if (!file) return null;

    const errors = [];
    
    // Check file type
    if (!ACCEPTED_TYPES[file.type]) {
      errors.push("Tipo de archivo no soportado");
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`Archivo demasiado grande (máximo ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      size: file.size,
      type: file.type,
      name: file.name
    };
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    
    const validation = validateFile(selectedFile);
    setFileValidation(validation);
    
    if (validation.isValid) {
      setFile(selectedFile);
      setMessage("");
      setMessageType("");
    } else {
      setFile(null);
      setMessage(validation.errors.join(", "));
      setMessageType("error");
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !fileValidation?.isValid) return;

    setUploading(true);
    setUploadProgress(0);
    setMessage("Iniciando subida...");
    setMessageType("info");

    try {
      // Simulate progress (you can implement real progress tracking)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      const { data } = await documentsAPI.upload(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setMessage(`Documento subido correctamente: ${data.filename || data.file_name}`);
      setMessageType("success");
      setFile(null);
      setFileValidation(null);
    } catch (err) {
      setMessage(err.response?.data?.detail || err.message);
      setMessageType("error");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFileValidation(null);
    setMessage("");
    setMessageType("");
    setUploadProgress(0);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'docx': return '📝';
      case 'xlsx': return '📊';
      case 'pptx': return '📈';
      default: return '📁';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CloudUpload className="h-8 w-8" />
          Subir Documento
        </h1>
        <p className="text-muted-foreground">
          Sube documentos para procesamiento automático con IA y indexación inteligente
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Seleccionar Archivo
          </CardTitle>
          <CardDescription>
            Arrastra y suelta un archivo o haz clic para seleccionar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Drop Zone */}
            <div
              className={cn(
                "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                file ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {!file ? (
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium">
                      Arrastra tu archivo aquí
                    </p>
                    <p className="text-muted-foreground">
                      o haz clic para seleccionar desde tu dispositivo
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.xlsx"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">{getFileIcon(file.name)}</span>
                    <FileCheck className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeFile}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Remover archivo
                  </Button>
                </div>
              )}
            </div>

            {/* File Validation */}
            {fileValidation && !fileValidation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {fileValidation.errors.join(", ")}
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subiendo archivo...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!file || !fileValidation?.isValid || uploading}
              className="w-full gap-2"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Subir y Procesar con IA
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Message Alert */}
      {message && (
        <Alert variant={messageType === "error" ? "destructive" : "default"}>
          {messageType === "success" && <CheckCircle className="h-4 w-4" />}
          {messageType === "error" && <AlertCircle className="h-4 w-4" />}
          {messageType === "info" && <Info className="h-4 w-4" />}
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Information Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formatos Soportados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  📄 PDF
                </span>
                <Badge variant="secondary">Documentos</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  📝 DOCX
                </span>
                <Badge variant="secondary">Word</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  📊 XLSX
                </span>
                <Badge variant="secondary">Excel</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  📈 PPTX
                </span>
                <Badge variant="secondary">PowerPoint</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Procesamiento IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Extracción automática de texto
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Generación de resumen inteligente
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Identificación de palabras clave
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                Indexación para búsqueda semántica
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Limits Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Límites y Restricciones</p>
              <p className="text-sm text-muted-foreground">
                Tamaño máximo: <strong>50MB</strong> • 
                Solo archivos de oficina • 
                Procesamiento automático con Google Gemini IA
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}