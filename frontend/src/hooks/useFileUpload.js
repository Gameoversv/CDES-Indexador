import { useState } from "react";
import { toast } from "sonner";
import { documentsAPI } from "@/services/api";

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const uploadFile = async (file, metadata = {}, onSuccess, onError) => {
    if (!file) {
      toast.error("No se ha seleccionado ningún archivo");
      return false;
    }

    setUploading(true);
    setProgress(0);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Agregar imagen de portada si existe en metadata
      if (metadata.cover_image) {
        formData.append("cover_image", metadata.cover_image);
        // Remover del metadata para evitar duplicación
        const { cover_image, ...otherMetadata } = metadata;
        metadata = otherMetadata;
      }
      
      // Agregar metadatos al FormData
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          formData.append(key, value);
        }
      });

      const response = await documentsAPI.upload(formData, {
        onUploadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded * 100) / event.total);
            setProgress(percent);
          }
        },
      });

      setProgress(100);
      toast.success(`Documento subido correctamente: ${file.name}`);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
      
      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || "Error al subir el archivo";
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      return false;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError("");
  };

  return {
    uploading,
    progress,
    error,
    uploadFile,
    reset,
  };
}