import React from 'react';
import { useDocumentSearch } from '@/hooks/useDocumentSearch';

// Componente de prueba para verificar que el hook funciona
export default function SearchTest() {
  const {
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    setSearch,
    clearSearch,
    hasSearchQuery
  } = useDocumentSearch();

  return (
    <div className="p-4">
      <h2>Test de Búsqueda de Documentos</h2>
      
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en nombre, título, resumen o palabras clave..."
          className="w-full p-2 border rounded"
        />
      </div>

      <div className="mb-4">
        <p>Estado de búsqueda: {isSearching ? 'Buscando...' : 'Inactivo'}</p>
        <p>Tiene query: {hasSearchQuery ? 'Sí' : 'No'}</p>
        <p>Resultados: {searchResults.length}</p>
        {searchError && <p className="text-red-500">Error: {searchError}</p>}
      </div>

      <button 
        onClick={clearSearch}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Limpiar búsqueda
      </button>

      <div className="mt-4">
        <h3>Resultados:</h3>
        <ul>
          {searchResults.map((doc, index) => (
            <li key={index} className="border-b py-2">
              <strong>{doc.filename}</strong>
              {doc.title && <p>Título: {doc.title}</p>}
              {doc.summary && <p>Resumen: {doc.summary}</p>}
              {doc.categoria && <p>Categoría: {doc.categoria}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
