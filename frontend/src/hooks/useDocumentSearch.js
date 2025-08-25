import { useState, useEffect, useCallback } from 'react';
import { documentsAPI } from '@/services/api';
import { toast } from 'sonner';

export const useDocumentSearch = (debounceMs = 500) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Función de búsqueda con debounce
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await documentsAPI.searchDocuments(query.trim());
      const data = response?.data || {};
      const hits = data.hits || data.files || data.documents || [];
      
      // Normalizar resultados para que tengan la estructura esperada
      const normalizedResults = hits.map((doc) => {
        const rawPath = doc.storage_path || doc.path || "";
        const nameFromPath = rawPath ? rawPath.split("/").pop() : "";
        
        return {
          filename: nameFromPath || doc.filename || doc.original_filename || doc.title || "",
          size: doc.size ?? doc.file_size_bytes ?? 0,
          updated: doc.updated || doc.updated_at || doc.created_at || doc.date || doc.upload_timestamp,
          path: rawPath,
          tipo: doc.tipo || doc.tipo_documento || "",
          categoria: doc.categoria || doc.apartado || "",
          public: doc.public ?? doc.publico ?? false,
          // Metadatos de búsqueda
          title: doc.title || "",
          summary: doc.summary || "",
          keywords: doc.keywords || "",
          // Metadatos adicionales
          puesto_trabajo: doc.puesto_trabajo || "",
          user_role: doc.user_role || ""
        };
      });

      setSearchResults(normalizedResults);
    } catch (error) {
      console.error('Error en búsqueda de documentos:', error);
      setSearchError(error.message || 'Error al buscar documentos');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Efecto para debounce de la búsqueda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch, debounceMs]);

  // Función para establecer la query de búsqueda
  const setSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // Función para limpiar la búsqueda
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    setSearch,
    clearSearch,
    hasSearchQuery: searchQuery.trim() !== ''
  };
};
