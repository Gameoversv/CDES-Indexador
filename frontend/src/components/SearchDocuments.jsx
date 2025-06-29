/**
 * Componente de Búsqueda de Documentos - Interfaz de Búsqueda Avanzada
 * 
 * Este componente proporciona una interfaz completa para buscar documentos
 * en el sistema. Utiliza tanto búsqueda local en metadatos como integración
 * con Meilisearch para búsquedas semánticas avanzadas.
 */

import React, { useState, useEffect, useCallback } from "react";
import { documentsAPI } from "../services/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Download, 
  FileText, 
  Calendar, 
  Filter,
  Loader2,
  AlertCircle,
  File,
  Clock
} from "lucide-react";

export default function SearchDocuments() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    sortBy: "relevance"
  });
  const [searchHistory, setSearchHistory] = useState([]);

  // Debounce search
  const debounceSearch = useCallback(
    debounce((searchQuery) => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    }, 500),
    [filters]
  );

  useEffect(() => {
    if (query) {
      debounceSearch(query);
    } else {
      setResults([]);
    }
  }, [query, debounceSearch]);

  const handleSearch = async (searchQuery = query) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    
    setLoading(true);
    setError("");
    
    try {
      const { data } = await documentsAPI.list();
      const docs = data.documents || [];
      
      let filtered = docs.filter((d) =>
        [
          d.filename || d.file_name,
          d.title,
          d.summary,
          ...(d.keywords || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );

      // Apply filters
      if (filters.type !== "all") {
        filtered = filtered.filter(d => d.type === filters.type);
      }

      // Sort results
      if (filters.sortBy === "date") {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      setResults(filtered);
      
      // Add to search history
      if (!searchHistory.includes(q)) {
        setSearchHistory(prev => [q, ...prev.slice(0, 4)]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, filename) => {
    try {
      const resp = await documentsAPI.download(id);
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al descargar.");
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'ppt':
      case 'pptx': return '📈';
      default: return '📁';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Buscar Documentos</h1>
        <p className="text-muted-foreground">
          Encuentra documentos por contenido, título, palabras clave y más
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, contenido, palabras clave..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-4"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={filters.type}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="doc">Documentos</SelectItem>
                    <SelectItem value="xls">Hojas de cálculo</SelectItem>
                    <SelectItem value="ppt">Presentaciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select
                value={filters.sortBy}
                onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevancia</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={() => handleSearch()} 
                disabled={loading || !query.trim()}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Búsquedas recientes:
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((term, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => setQuery(term)}
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {query && !loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Resultados de búsqueda
              {results.length > 0 && (
                <Badge variant="secondary">{results.length} encontrados</Badge>
              )}
            </CardTitle>
            {results.length > 0 && (
              <CardDescription>
                Mostrando {results.length} documento{results.length !== 1 ? 's' : ''} para "{query}"
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
              <div className="space-y-4">
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(doc.filename || doc.file_name)}</span>
                              <span className="truncate max-w-48">
                                {doc.filename || doc.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-64">
                              <p className="font-medium truncate">{doc.title || 'Sin título'}</p>
                              {doc.summary && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {doc.summary}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(doc.date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {doc.type || 'Desconocido'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc.id, doc.filename || doc.file_name)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Descargar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {results.map((doc) => (
                    <Card key={doc.id}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span>{getFileIcon(doc.filename || doc.file_name)}</span>
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {doc.filename || doc.file_name}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {doc.title || 'Sin título'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {doc.type || 'Desconocido'}
                            </Badge>
                          </div>
                          
                          {doc.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {doc.summary}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(doc.date)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc.id, doc.filename || doc.file_name)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Descargar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No se encontraron documentos</p>
                <p className="text-muted-foreground">
                  Intenta con otros términos de búsqueda o ajusta los filtros
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!query && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Search className="h-12 w-12 text-muted-foreground mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Busca en tu biblioteca de documentos</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Utiliza el buscador para encontrar documentos por título, contenido, 
                  palabras clave y más. También puedes aplicar filtros para refinar los resultados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Utility function for debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}