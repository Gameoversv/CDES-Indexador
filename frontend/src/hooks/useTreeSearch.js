// frontend/src/hooks/useTreeSearch.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { documentsAPI } from '@/services/api';

/**
 * Hook personalizado para búsqueda en el árbol de carpetas usando Meilisearch
 * Busca en el campo storage_path de los documentos indexados
 */
export const useTreeSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Para debounce
  const debounceTimer = useRef(null);
  const DEBOUNCE_DELAY = 300; // ms

  /**
   * Realiza la búsqueda usando el endpoint search-by-path
   */
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await documentsAPI.searchByPath(query.trim(), 50, 0); // Aumentamos el límite para mejor cobertura
      const results = response.data || {};
      const hits = results.hits || [];
      
      // Transformar los resultados para que sean compatibles con la estructura de archivos
      const transformedResults = hits.map(hit => ({
        name: hit.filename || hit.original_filename || 'Documento sin nombre',
        path: hit.storage_path || hit.path || '',
        contentType: hit.media_type || hit.file_extension || '',
        size: hit.file_size_bytes || 0,
        updated: hit.created_at || hit.date || hit.upload_timestamp,
        id: hit.id || hit.file_id,
        title: hit.title || '',
        summary: hit.summary || '',
        isSearchResult: true, // Marcador para distinguir resultados de búsqueda
        // Datos adicionales para mostrar contexto
        highlightedPath: hit._formatted?.storage_path || hit.storage_path || hit.path || '',
        apartado: hit.apartado || '',
        puesto_trabajo: hit.puesto_trabajo || '',
      }));
      
      setSearchResults(transformedResults);
      setHasSearched(true);
      
      console.log(`Búsqueda en árbol: "${query}" - ${transformedResults.length} resultados encontrados`);
      
    } catch (error) {
      console.error('Error en búsqueda del árbol:', error);
      setSearchError('Error al buscar documentos. Intenta nuevamente.');
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Maneja el cambio en el input de búsqueda con debounce
   */
  const handleSearchChange = useCallback((query) => {
    setSearchQuery(query);
    
    // Limpiar el timer anterior
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Si la query está vacía, limpiar inmediatamente
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }
    
    // Configurar nuevo timer
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, DEBOUNCE_DELAY);
  }, [performSearch]);

  /**
   * Limpia la búsqueda
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearchError(null);
    setIsSearching(false);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }, []);

  /**
   * Ejecuta una búsqueda inmediata sin debounce
   */
  const searchImmediate = useCallback((query) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    performSearch(query);
  }, [performSearch]);

  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    // Estado
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    hasSearched,
    
    // Funciones
    handleSearchChange,
    clearSearch,
    searchImmediate,
    
    // Helpers
    hasResults: searchResults.length > 0,
    isEmpty: hasSearched && searchResults.length === 0,
  };
};

export default useTreeSearch;
