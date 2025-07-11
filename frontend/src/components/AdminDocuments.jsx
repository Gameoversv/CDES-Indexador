import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminLayout from "./AdminLayout"; // Asegúrate de tener la ruta correcta

const API_BASE_URL = "http://localhost:8000/documents";

async function fetchDocuments() {
  const res = await fetch(`${API_BASE_URL}/list`);
  if (!res.ok) throw new Error("Error al obtener documentos");
  return res.json();
}

async function fetchStats() {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new Error("Error al obtener estadísticas");
  return res.json();
}

function DocumentStore() {
  const location = useLocation();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAxis, setFilterAxis] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const docsData = await fetchDocuments();
        const statsData = await fetchStats();
        setDocuments(docsData.documents);
        setStats(statsData);
      } catch (err) {
        setError("Error cargando datos. Intente nuevamente.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const refreshData = async () => {
    try {
      setLoading(true);
      setError("");
      const docsData = await fetchDocuments();
      const statsData = await fetchStats();
      setDocuments(docsData.documents);
      setStats(statsData);
    } catch (err) {
      setError("Error actualizando datos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Obtener opciones únicas para los filtros
  const getUniqueOptions = (key) => {
    return Array.from(new Set(
      documents.map(doc => doc[key]).filter(Boolean)
    )).sort();
  };

  const fileTypes = getUniqueOptions("media_type");
  const statuses = getUniqueOptions("status");
  const axes = getUniqueOptions("eje");

  // Función para formatear el tipo de archivo
  const formatFileType = (type) => {
    if (!type) return "";
    return type.split("/")[1]?.toUpperCase() || type;
  };

  // Filtrar y ordenar documentos
  const filteredDocuments = documents
    .filter((doc) => {
      // Filtro de búsqueda
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        (doc.title && doc.title.toLowerCase().includes(q)) ||
        (doc.description && doc.description.toLowerCase().includes(q)) ||
        (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(q)));
      
      // Filtro por tipo
      const matchesType = filterType === "all" 
        ? true 
        : doc.media_type === filterType;
      
      // Filtro por estado
      const matchesStatus = filterStatus === "all" 
        ? true 
        : doc.status === filterStatus;
      
      // Filtro por eje
      const matchesAxis = filterAxis === "all" 
        ? true 
        : doc.eje === filterAxis;
      
      return matchesSearch && matchesType && matchesStatus && matchesAxis;
    })
    .sort((a, b) => {
      // Ordenar por diferentes criterios
      let aValue, bValue;
      
      switch (sortBy) {
        case "name":
          aValue = (a.original_filename || a.title || "").toLowerCase();
          bValue = (b.original_filename || b.title || "").toLowerCase();
          break;
        case "size":
          aValue = a.file_size_bytes || 0;
          bValue = b.file_size_bytes || 0;
          break;
        case "status":
          aValue = a.status || "";
          bValue = b.status || "";
          break;
        case "date":
        default:
          aValue = new Date(a.upload_timestamp || 0);
          bValue = new Date(b.upload_timestamp || 0);
          break;
      }
      
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileStem = (filename) => {
    if (!filename) return "";
    return filename.replace(/\.[^/.]+$/, "");
  };

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'publicado': return 'bg-green-100 text-green-800';
      case 'aprobado': return 'bg-green-100 text-green-800';
      case 'borrador': return 'bg-yellow-100 text-yellow-800';
      case 'revisión': return 'bg-blue-100 text-blue-800';
      case 'archivado': return 'bg-gray-100 text-gray-800';
      case 'pendiente': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterAxis("all");
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const openDetails = (doc) => {
    setSelectedDocument(doc);
    setShowDetails(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-800"></div>
        <span className="ml-4 text-lg">Cargando documentos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasFilters = searchTerm || filterType !== "all" || filterStatus !== "all" || filterAxis !== "all";

  return (
    <AdminLayout>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Documentos Almacenados
            </h1>
            <p className="mt-2 text-gray-600">Gestiona y accede a todos los documentos del sistema</p>
          </div>
          <button 
            onClick={refreshData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { 
              title: "Total archivos", 
              value: stats?.total_documents || 0, 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              )
            },
            { 
              title: "Espacio usado", 
              value: `${stats?.total_size_mb?.toFixed(2) || 0} MB`, 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              )
            },
            { 
              title: "Documentos aprobados", 
              value: documents.filter(d => d.status === "Publicado").length, 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )
            },
            { 
              title: "Documentos de gobernabilidad", 
              value: documents.filter(d => d.eje === "Gobernabilidad").length, 
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )
            }
          ].map((stat, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm flex items-center">
              <div className="bg-gray-200 p-2 rounded-lg mr-3 flex-shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-600">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros y Búsqueda */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-md mb-8 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-800">Filtros y Búsqueda</h2>
          </div>
          
          <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Barra de búsqueda */}
            <div className="md:col-span-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="search"
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                />
              </div>
            </div>
            
            {/* Filtro por Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              >
                <option value="all">Todos</option>
                {fileTypes.map(type => (
                  <option key={type} value={type}>
                    {formatFileType(type)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Filtro por Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              >
                <option value="all">Todos</option>
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Filtro por Eje */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Eje</label>
              <select
                value={filterAxis}
                onChange={(e) => setFilterAxis(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              >
                <option value="all">Todos</option>
                {axes.map(axis => (
                  <option key={axis} value={axis}>
                    {axis}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Botón para limpiar filtros */}
          {hasFilters && (
            <div className="px-4 pb-4 flex justify-end">
              <button 
                onClick={resetFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Documents Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort("name")}
                  >
                    <div className="flex items-center">
                      <span>Documento</span>
                      {sortBy === "name" && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {sortOrder === "asc" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center">
                      <span>Fecha</span>
                      {sortBy === "date" && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {sortOrder === "asc" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th 
                    scope="col" 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort("status")}
                  >
                    <div className="flex items-center">
                      <span>Estado</span>
                      {sortBy === "status" && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {sortOrder === "asc" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mt-2 text-lg font-medium text-gray-900">No se encontraron documentos</h3>
                      <p className="mt-1 text-gray-500 max-w-md mx-auto">
                        {hasFilters
                          ? "Prueba ajustando los filtros de búsqueda o restablece los filtros"
                          : "No hay documentos almacenados en el sistema"}
                      </p>
                      {hasFilters && (
                        <button 
                          onClick={resetFilters}
                          className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Restablecer filtros
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.unique_filename || doc.original_filename} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {doc.original_filename || doc.title || "-"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {doc.eje || "Sin eje"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 max-w-xs truncate">{doc.description || "-"}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {doc.upload_timestamp
                            ? new Date(doc.upload_timestamp).toLocaleDateString("es-DO", { 
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {doc.media_type ? formatFileType(doc.media_type) : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(doc.status)}`}>
                          {doc.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openDetails(doc)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-200"
                            title="Ver detalles"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <a
                            href={`${API_BASE_URL}/download/${getFileStem(doc.unique_filename || doc.original_filename)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-200"
                            title="Descargar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de detalles */}
        {showDetails && selectedDocument && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800">Detalles del documento</h3>
                <button 
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="overflow-y-auto p-6 flex-grow">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Nombre del archivo</h4>
                        <p className="mt-1 text-gray-900 font-medium break-words">
                          {selectedDocument.original_filename || selectedDocument.title || "-"}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Descripción</h4>
                        <p className="mt-1 text-gray-900 break-words">
                          {selectedDocument.description || "Sin descripción"}
                        </p>
                      </div>
                      
                      {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Etiquetas</h4>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {selectedDocument.tags.map((tag, index) => (
                              <span 
                                key={index} 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Tamaño</h4>
                          <p className="mt-1 text-gray-900">
                            {formatSize(selectedDocument.file_size_bytes)}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Fecha de subida</h4>
                          <p className="mt-1 text-gray-900">
                            {selectedDocument.upload_timestamp
                              ? new Date(selectedDocument.upload_timestamp).toLocaleString("es-DO", {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : "-"}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Tipo</h4>
                          <p className="mt-1 text-gray-900">
                            {selectedDocument.media_type ? formatFileType(selectedDocument.media_type) : "-"}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-500">Eje estratégico</h4>
                          <p className="mt-1 text-gray-900">
                            {selectedDocument.eje || "-"}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-500">Estado</h4>
                        <span className={`mt-1 px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedDocument.status)}`}>
                          {selectedDocument.status || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                <a
                  href={`${API_BASE_URL}/download/${getFileStem(selectedDocument.unique_filename || selectedDocument.original_filename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar documento
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default DocumentStore;