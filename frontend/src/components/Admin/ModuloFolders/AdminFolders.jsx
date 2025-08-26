import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../Layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { documentsAPI } from '@/services/api';
import TreeNode from '../../Users/UserFolders/TreeNode';
import { useTreeSearch } from '@/hooks/useTreeSearch';
import {
  Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Home,
  Search, Loader2, Plus, Upload, List, Grid3X3, Filter, ChevronDown as CD, RefreshCw,
  Download, Trash2, AlertTriangle, ArrowLeft, X
} from 'lucide-react';

// ===================== Utilidades básicas =====================
const extOf = (name = "") => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
const fmtSize = (n) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : "--");
const safeDate = (d) => {
  const t = new Date(d || 0).getTime();
  return isNaN(t) ? 0 : t;
};
const SORTS = [
  { id: "recent", label: "Más recientes" },
  { id: "oldest", label: "Más antiguos" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
  { id: "size", label: "Tamaño" },
];

// ===================== Badges de archivo =====================
function FileBadge({ name }) {
  const ext = extOf(name);
  if (!ext) return null;
  return (
    <span className="ml-2 text-[10px] uppercase rounded-full border px-1.5 py-0.5 border-gray-300 text-gray-600">
      {ext}
    </span>
  );
}

// ===================== Modales minimalistas (sin dependencias) =====================
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold">{title}</h3>
          </div>
          <div className="px-4 py-4">{children}</div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmationModal({ open, onClose, onConfirm, itemName, isFolder, processing = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40" onClick={!processing ? onClose : undefined} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold">Confirmar eliminación</h3>
          </div>
          <div className="px-4 py-4">
            <p className="text-gray-700">
              ¿Está seguro de que desea eliminar {isFolder ? "la carpeta" : "el documento"} <span className="font-semibold">{itemName}</span>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={processing}>Cancelar</Button>
            <Button 
              onClick={onConfirm} 
              className="bg-red-600 hover:bg-red-700"
              disabled={processing}
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando...
                </span>
              ) : (
                "Eliminar"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Componente principal =====================
const AdminFolders = () => {
  // Como es admin, puede crear/eliminar carpetas
  const canCreateOrUpload = true;
  const canDelete = true;
  
  // Hook de búsqueda en árbol
  const {
    searchQuery: treeSearchQuery,
    searchResults: treeSearchResults,
    isSearching: isTreeSearching,
    searchError: treeSearchError,
    hasSearched: hasTreeSearched,
    handleSearchChange: handleTreeSearchChange,
    clearSearch: clearTreeSearch,
    hasResults: hasTreeSearchResults,
    isEmpty: isTreeSearchEmpty,
  } = useTreeSearch();
  
  // Estado de árbol (sidebar)
  const [openMap, setOpenMap] = useState({ "": true }); // qué rutas están abiertas
  const [sidebarRoot, setSidebarRoot] = useState([]); // carpetas de raíz visibles para el usuario
  const [sidebarChildren, setSidebarChildren] = useState({}); // { path: FolderNode[] }

  // Estado de contenido (panel derecho)
  const [selectedPath, setSelectedPath] = useState(""); // carpeta seleccionada
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: "Raíz", path: "" }]);
  const [folders, setFolders] = useState([]); // subcarpetas de selectedPath
  const [files, setFiles] = useState([]); // archivos de selectedPath

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [view, setView] = useState("list"); // list|grid
  const [sort, setSort] = useState("recent");
  const [query, setQuery] = useState("");

  // Modales
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileObj, setUploadFileObj] = useState(null);
  
  // Modal de confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState({ path: '', name: '', isFolder: false });
  const [deleteProcessing, setDeleteProcessing] = useState(false);

  // ===================== Helpers de datos =====================
  const currentPathText = useMemo(
    () => (breadcrumbs.length > 1 ? breadcrumbs.slice(1).map(c => c.name).join(" / ") : "Raíz"),
    [breadcrumbs]
  );

  const sortedFilteredFiles = useMemo(() => {
    // Si hay resultados de búsqueda en el árbol, usarlos en lugar de los archivos locales
    const sourceFiles = hasTreeSearchResults ? treeSearchResults : files;
    const arr = [...sourceFiles];
    
    switch (sort) {
      case "oldest": arr.sort((a, b) => safeDate(a.updated) - safeDate(b.updated)); break;
      case "az": arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "za": arr.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "size": arr.sort((a, b) => (a.size || 0) - (b.size || 0)); break;
      default: arr.sort((a, b) => safeDate(b.updated) - safeDate(a.updated));
    }
    
    if (!query) return arr;
    const qq = query.toLowerCase();
    return arr.filter(f => f.name.toLowerCase().includes(qq));
  }, [files, treeSearchResults, hasTreeSearchResults, sort, query]);

  const buildBreadcrumbs = useCallback((path) => {
    if (!path) return [{ name: "Raíz", path: "" }];
    const parts = path.split("/").filter(Boolean);
    const acc = [{ name: "Raíz", path: "" }];
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      acc.push({ name: p, path: cur });
    }
    return acc;
  }, []);

  // ===================== Cargas desde backend =====================
  const fetchTreeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await documentsAPI.getStorageTree();
      const treeData = response.data || [];
      
      // Procesar datos del árbol para nuestra estructura de sidebar
      const rootFolders = treeData.filter(node => node.type === 'folder');
      
      setSidebarRoot(rootFolders.map(f => ({
        name: f.name,
        path: f.path,
        count: f.children?.length || 0,
      })));
      
      // Actualizar el mapa de hijos para la raíz
      setSidebarChildren(prev => ({ 
        ...prev, 
        "": rootFolders.map(f => ({
          name: f.name,
          path: f.path,
          count: f.children?.length || 0,
        }))
      }));
      
      // Actualizar contenido de la carpeta seleccionada
      if (selectedPath) {
        await loadFolderContent(selectedPath, treeData);
      } else {
        // Si estamos en la raíz, mostrar las carpetas de nivel superior
        setFolders(rootFolders.map(f => ({
          name: f.name,
          path: f.path,
          count: f.children?.length || 0,
        })));
        
        // Mostrar archivos en la raíz, si hay alguno
        const rootFiles = treeData.filter(node => node.type === 'file');
        setFiles(rootFiles.map(f => ({
          name: f.name,
          path: f.path,
          contentType: f.contentType || '',
          size: f.size || 0,
          updated: f.updated,
        })));
      }
    } catch (err) {
      console.error('Error al obtener árbol de carpetas:', err);
      setError('Error al cargar la estructura de carpetas. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [selectedPath]);

  // Función para encontrar un nodo específico en el árbol
  const findNodeByPath = useCallback((treeData, path) => {
    if (!path) return null;
    
    // Si el path termina con '/', quitarlo para comparación
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    // Buscar en el árbol
    let result = null;
    const searchNode = (nodes) => {
      for (const node of nodes) {
        const nodePath = node.path.endsWith('/') ? node.path.slice(0, -1) : node.path;
        if (nodePath === normalizedPath) {
          result = node;
          return true;
        }
        if (node.children && node.children.length > 0) {
          if (searchNode(node.children)) return true;
        }
      }
      return false;
    };
    
    searchNode(treeData);
    
    // Si no encontramos el nodo y el árbol está disponible,
    // podríamos tener un problema con carpetas muy anidadas
    if (!result && treeData && treeData.length > 0 && normalizedPath.includes('/')) {
      console.log('No se encontró el nodo para la ruta profunda:', normalizedPath);
    }
    
    return result;
  }, []);

  const loadFolderContent = useCallback(async (path, existingTreeData = null) => {
    if (!path && existingTreeData) {
      // Si es la raíz y ya tenemos datos, usarlos directamente
      const rootFolders = existingTreeData.filter(node => node.type === 'folder');
      const rootFiles = existingTreeData.filter(node => node.type === 'file');
      
      setFolders(rootFolders.map(f => ({
        name: f.name,
        path: f.path,
        count: f.children?.length || 0,
      })));
      
      setFiles(rootFiles.map(f => ({
        name: f.name,
        path: f.path,
        contentType: f.contentType || '',
        size: f.size || 0,
        updated: f.updated,
      })));
      
      setBreadcrumbs(buildBreadcrumbs(path));
      return;
    }
    
    try {
      let folderNode;
      let treeData;
      
      if (existingTreeData) {
        treeData = existingTreeData;
        folderNode = findNodeByPath(treeData, path);
      } else {
        // Si no tenemos datos existentes, obtener el árbol
        const response = await documentsAPI.getStorageTree();
        treeData = response.data || [];
        folderNode = findNodeByPath(treeData, path);
      }
      
      // Si encontramos el nodo en el árbol y tiene hijos, usamos esos datos
      if (folderNode && folderNode.children) {
        // Separar carpetas y archivos
        const childFolders = folderNode.children.filter(node => node.type === 'folder');
        const childFiles = folderNode.children.filter(node => node.type === 'file');
        
        setFolders(childFolders.map(f => ({
          name: f.name,
          path: f.path,
          count: f.children?.length || 0,
        })));
        
        setFiles(childFiles.map(f => ({
          name: f.name,
          path: f.path,
          contentType: f.contentType || '',
          size: f.size || 0,
          updated: f.updated,
        })));
      } else {
        // MEJORA: Si no encontramos la carpeta en el árbol, intentamos hacer una petición
        // directa al backend para este path específico
        console.log('Carpeta no encontrada en el árbol actual, solicitando datos específicos para:', path);
        
        try {
          // Vamos a solicitar un árbol completo y filtrar por el prefijo de path
          const response = await documentsAPI.getStorageTree();
          const fullTreeData = response.data || [];
          
          // Buscar en el árbol completo por cualquier elemento que comience con este path
          const childFiles = [];
          const childFolders = [];
          
          // Función para encontrar elementos que empiecen con path
          const collectChildrenByPrefix = (nodes, targetPrefix) => {
            const normalizedPrefix = targetPrefix.endsWith('/') ? targetPrefix : targetPrefix + '/';
            
            const flattenTree = (nodes, results = []) => {
              for (const node of nodes) {
                results.push(node);
                if (node.children && node.children.length > 0) {
                  flattenTree(node.children, results);
                }
              }
              return results;
            };
            
            // Obtener todos los nodos en un array plano
            const allNodes = flattenTree(nodes);
            
            // Filtrar por aquellos que son hijos directos del path buscado
            return allNodes.filter(node => {
              const nodePath = node.path || '';
              // Si es un hijo directo, estará dentro del prefijo y no tendrá otros '/' después del prefijo
              if (nodePath.startsWith(normalizedPrefix)) {
                const relativePath = nodePath.substring(normalizedPrefix.length);
                // No debe tener '/' adicionales (o solo al final si es carpeta)
                return !relativePath.includes('/') || (relativePath.endsWith('/') && relativePath.indexOf('/') === relativePath.length - 1);
              }
              return false;
            });
          };
          
          const directChildren = collectChildrenByPrefix(fullTreeData, path);
          
          for (const node of directChildren) {
            if (node.type === 'folder') {
              childFolders.push({
                name: node.name,
                path: node.path,
                count: node.children?.length || 0,
              });
            } else if (node.type === 'file') {
              childFiles.push({
                name: node.name,
                path: node.path,
                contentType: node.contentType || '',
                size: node.size || 0,
                updated: node.updated,
              });
            }
          }
          
          setFolders(childFolders);
          setFiles(childFiles);
          
          console.log(`Encontrados ${childFolders.length} carpetas y ${childFiles.length} archivos para: ${path}`);
          
        } catch (innerError) {
          console.error('Error obteniendo datos específicos para la carpeta:', innerError);
          // Si falla, dejamos vacío (comportamiento original)
          setFolders([]);
          setFiles([]);
        }
      }
      
      setBreadcrumbs(buildBreadcrumbs(path));
    } catch (e) {
      console.error("Error cargando contenido de carpeta:", e);
      setError("No se pudo cargar el contenido de la carpeta.");
    }
  }, [buildBreadcrumbs, findNodeByPath]);

  const ensureChildrenLoaded = useCallback(async (path) => {
    // Si aún no tenemos hijos de esta ruta para el árbol, los cargamos.
    if (sidebarChildren[path]) return;
    
    try {
      // Obtenemos el árbol completo
      const response = await documentsAPI.getStorageTree();
      const treeData = response.data || [];
      
      // Buscamos el nodo correspondiente al path
      const folderNode = findNodeByPath(treeData, path);
      
      if (folderNode && folderNode.children) {
        // Filtrar solo las carpetas para el sidebar
        const childFolders = folderNode.children.filter(node => node.type === 'folder');
        
        setSidebarChildren(prev => ({ 
          ...prev, 
          [path]: childFolders.map(f => ({
            name: f.name,
            path: f.path,
            count: f.children?.length || 0,
          }))
        }));
      } else {
        // MEJORA: Si no encontramos el nodo, buscamos elementos que sean hijos directos de este path
        console.log('Buscando hijos directos para carpeta no encontrada en árbol:', path);
        
        const normalizedPath = path.endsWith('/') ? path : path + '/';
        
        // Función para encontrar carpetas que son hijos directos del path buscado
        const findDirectChildFolders = (nodes, parentPath) => {
          const result = [];
          
          const flattenTree = (nodes, results = []) => {
            for (const node of nodes) {
              results.push(node);
              if (node.children && node.children.length > 0) {
                flattenTree(node.children, results);
              }
            }
            return results;
          };
          
          // Obtener todos los nodos en un array plano
          const allNodes = flattenTree(nodes);
          
          // Filtrar por aquellos que son carpetas y son hijos directos del path buscado
          return allNodes.filter(node => {
            const nodePath = node.path || '';
            if (node.type === 'folder' && nodePath.startsWith(parentPath)) {
              const relativePath = nodePath.substring(parentPath.length);
              // No debe tener '/' adicionales (o solo al final)
              return !relativePath.includes('/') || (relativePath.endsWith('/') && relativePath.indexOf('/') === relativePath.length - 1);
            }
            return false;
          });
        };
        
        const directChildFolders = findDirectChildFolders(treeData, normalizedPath);
        
        if (directChildFolders.length > 0) {
          console.log(`Encontrados ${directChildFolders.length} hijos directos para: ${path}`);
          setSidebarChildren(prev => ({ 
            ...prev, 
            [path]: directChildFolders.map(f => ({
              name: f.name,
              path: f.path,
              count: f.children?.length || 0,
            }))
          }));
        } else {
          // Si no hay hijos, establecer array vacío
          setSidebarChildren(prev => ({ ...prev, [path]: [] }));
        }
      }
    } catch (e) {
      console.error("Error cargando hijos de carpeta:", e);
      setSidebarChildren(prev => ({ ...prev, [path]: [] }));
    }
  }, [sidebarChildren, findNodeByPath]);

  // ===================== Acciones de UI / Árbol =====================
  const onToggleSidebar = async (path) => {
    setOpenMap(prev => ({ ...prev, [path]: !prev[path] }));
    if (!openMap[path]) {
      // Se está abriendo, cargar hijos si no están
      try { await ensureChildrenLoaded(path); } catch (e) { /* no-op */ }
    }
  };

  const onOpenPath = async (path) => {
    setSelectedPath(path);
    setError(null);
    setLoading(true);
    try {
      // Si la ruta es raíz, cargar directamente el contenido de raíz (sin depender de selectedPath)
      if (!path) {
        setOpenMap(prev => ({ ...prev, "": true }));
        setBreadcrumbs(buildBreadcrumbs(""));

        try {
          const response = await documentsAPI.getStorageTree();
          const treeData = response.data || [];

          // Procesar sidebar raíz
          const rootFolders = treeData.filter(node => node.type === 'folder');
          setSidebarRoot(rootFolders.map(f => ({
            name: f.name,
            path: f.path,
            count: f.children?.length || 0,
          })));
          setSidebarChildren(prev => ({
            ...prev,
            "": rootFolders.map(f => ({
              name: f.name,
              path: f.path,
              count: f.children?.length || 0,
            }))
          }));

          // Contenido de raíz
          setFolders(rootFolders.map(f => ({
            name: f.name,
            path: f.path,
            count: f.children?.length || 0,
          })));
          const rootFiles = treeData.filter(node => node.type === 'file');
          setFiles(rootFiles.map(f => ({
            name: f.name,
            path: f.path,
            contentType: f.contentType || '',
            size: f.size || 0,
            updated: f.updated,
          })));
        } catch (e) {
          console.error('Error al cargar raíz:', e);
          setError('No se pudo cargar el contenido de la raíz.');
        }
        return;
      }

      // Asegurarse de que todos los nodos padres están abiertos en el árbol
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';
      
      // Abrir todos los nodos padres en la navegación
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        setOpenMap(prev => ({ ...prev, [currentPath]: true }));
        
        // Asegurar que los hijos están cargados para cada nivel
        try { 
          await ensureChildrenLoaded(currentPath); 
        } catch (e) { 
          console.warn(`No se pudieron cargar los hijos para: ${currentPath}`, e); 
        }
      }
      
      // Cargar el contenido de la carpeta destino después de asegurar
      // que la estructura del árbol esté cargada
      await loadFolderContent(path);
      
    } catch (e) {
      console.error("Error al navegar a la carpeta:", e);
      setError("No se pudo cargar el contenido de la carpeta.");
    } finally {
      setLoading(false);
    }
  };

  const onBreadcrumbClick = (path) => onOpenPath(path);

  const goToPreviousFolder = () => {
    if (!selectedPath || selectedPath === "") return; // Already at root
    
    // Get parent path by removing the last segment
    const pathParts = selectedPath.split('/').filter(Boolean);
    if (pathParts.length === 0) return; // At root
    
    // Remove the last path segment
    pathParts.pop();
    const parentPath = pathParts.join('/');
    onOpenPath(parentPath);
  };

  const refreshAll = async () => {
    setError(null);
    setLoading(true);
    try {
      await fetchTreeData();
    } catch (e) {
      setError("No se pudo actualizar la vista.");
    } finally {
      setLoading(false);
    }
  };

  // ===================== Acciones backend: crear carpeta / subir =====================
  const handleCreateFolder = async () => {
    const name = (newFolderName || "").trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await documentsAPI.createFolder({ 
        nombre: name, 
        ruta_padre: selectedPath 
      });
      
      // Refrescar árbol y contenido actual
      setShowCreateFolder(false);
      setNewFolderName("");
      await fetchTreeData();
    } catch (e) {
      setError("No se pudo crear la carpeta (verifica permisos y nombre).");
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFileObj) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFileObj);
      fd.append("path", selectedPath);
      
      await documentsAPI.uploadByPath(fd);
      
      setShowUpload(false);
      setUploadFileObj(null);
      await fetchTreeData();
    } catch (e) {
      setError("No se pudo subir el archivo (verifica permisos, tipo y tamaño).");
    } finally {
      setUploading(false);
    }
  };

  // Función para descargar archivos
  const handleDownload = useCallback(async (path, name) => {
    try {
      const res = await documentsAPI.downloadByPath(path);
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name || path.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Descarga fallida', e);
      setError('No fue posible descargar el archivo.');
    }
  }, []);
  
  // Mostrar modal de confirmación para eliminar
  const confirmDelete = useCallback((path, name, isFolder = path.endsWith('/')) => {
    if (!canDelete) return;
    setItemToDelete({ path, name, isFolder });
    setShowDeleteConfirm(true);
  }, [canDelete]);
  
  // Función para eliminar carpetas/archivos
  const handleDelete = useCallback(async () => {
    if (!canDelete || !itemToDelete.path) return;
    
    try {
      setLoading(true);
      setDeleteProcessing(true);
      setShowDeleteConfirm(false);
      
      await documentsAPI.deleteStorageItem(itemToDelete.path);
      
      // Refrescar datos después de eliminar
      await fetchTreeData();
      
      // Si estábamos en la carpeta eliminada, ir a su padre
      if (selectedPath === itemToDelete.path || selectedPath.startsWith(itemToDelete.path)) {
        const parentPath = itemToDelete.path.split('/').slice(0, -2).join('/');
        await onOpenPath(parentPath);
      }
      
    } catch (e) {
      console.error('Error al eliminar', e);
      setError(`No fue posible eliminar ${itemToDelete.isFolder ? 'la carpeta' : 'el archivo'}`);
    } finally {
      setLoading(false);
      setDeleteProcessing(false);
      // Limpiar el item que se intentó eliminar
      setItemToDelete({ path: '', name: '', isFolder: false });
    }
  }, [canDelete, fetchTreeData, selectedPath, itemToDelete]);
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchTreeData();
      } catch (e) {
        setError("No se pudo inicializar el árbol de carpetas.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================== Render =====================
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto w-full text-black">
        {/* Barra superior */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          {/* Breadcrumb */}
          <div className="flex items-center flex-wrap gap-2">
            {breadcrumbs.map((c, i) => (
              <div key={`${c.path}-${i}`} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                <button
                  className={`text-sm ${i === breadcrumbs.length - 1 ? "font-semibold" : "text-gray-600 hover:underline"}`}
                  onClick={() => onBreadcrumbClick(c.path)}
                >
                  {c.name}
                </button>
              </div>
            ))}
          </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Búsqueda global en el árbol */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              value={treeSearchQuery}
              onChange={(e) => handleTreeSearchChange(e.target.value)}
              placeholder="Buscar documentos en todo el árbol..."
              className="pl-9 pr-10 py-2 h-9 rounded-md border border-gray-300 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {treeSearchQuery && (
              <button
                onClick={clearTreeSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isTreeSearching && (
              <div className="absolute right-10 top-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Búsqueda local en carpeta actual */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en esta carpeta…"
              className="pl-9 pr-3 py-2 h-9 rounded-md border border-gray-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>            <div className="relative">
              <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
              <select
                className="appearance-none pl-9 pr-8 py-2 h-9 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <CD className="w-4 h-4 text-gray-500 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === "list" ? "bg-gray-100 font-medium" : ""}`}
                onClick={() => setView("list")}
                title="Lista"
              >
                <List className="w-4 h-4" /> Lista
              </button>
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === "grid" ? "bg-gray-100 font-medium" : ""}`}
                onClick={() => setView("grid")}
                title="Cuadrícula"
              >
                <Grid3X3 className="w-4 h-4" /> Cuadrícula
              </button>
            </div>

            {canCreateOrUpload && (
              <>
                <Button onClick={() => setShowCreateFolder(true)} className="h-9 gap-2">
                  <Plus className="w-4 h-4" /> Crear Carpeta
                </Button>

                <Button onClick={() => setShowUpload(true)} className="h-9 gap-2 bg-red-600 hover:bg-red-600/90">
                  <Upload className="w-4 h-4" /> Agregar Documento
                </Button>
              </>
            )}

            <Button onClick={refreshAll} variant="outline" className="h-9 gap-2">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </Button>
          </div>
        </div>

        {/* Layout: árbol de carpetas + contenido */}
        <div className="grid grid-cols-12 gap-4 mt-0">
          {/* Sidebar (árbol) */}
          <aside className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">CARPETAS</span>
              {selectedPath && selectedPath !== "" && (
                <button
                  onClick={goToPreviousFolder}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  title="Volver a la carpeta anterior"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
              )}
            </div>
            <div className="h-[540px] overflow-auto">
              {/* Raíz */}
              <div className="mb-1">
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                  onClick={() => onToggleSidebar?.("")}
                >
                  {openMap[""] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Home className="w-4 h-4" />
                  <span
                    className={`text-sm font-semibold ${selectedPath === "" ? "underline" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onOpenPath(""); }}
                  >
                    Raíz
                  </span>
                </div>

                {openMap[""] && (
                  <div className="pl-0">
                    {sidebarRoot.map(n => (
                      <TreeNode
                        key={n.path}
                        node={n}
                        depth={1}
                        openMap={openMap}
                        childrenMap={sidebarChildren}
                        onToggle={onToggleSidebar}
                        onOpenPath={onOpenPath}
                        ensureChildrenLoaded={ensureChildrenLoaded}
                        selectedPath={selectedPath}
                        canDelete={canDelete}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Contenido principal */}
          <section className="col-span-12 md:col-span-9 bg-white rounded-lg border border-gray-200">
            <div className="p-3 border-b border-gray-100 text-sm">
              {hasTreeSearchResults ? (
                <span>
                  Resultados de búsqueda: <span className="font-semibold">"{treeSearchQuery}"</span>
                  <span className="text-gray-500 ml-2">({treeSearchResults.length} documentos encontrados)</span>
                </span>
              ) : (
                <span>
                  Carpeta actual: <span className="font-semibold">{currentPathText}</span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center text-gray-600 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">{error}</div>
            ) : treeSearchError ? (
              <div className="p-8 text-center text-red-600">{treeSearchError}</div>
            ) : (
              <>
                {/* Mostrar mensaje si no hay resultados de búsqueda */}
                {hasTreeSearched && isTreeSearchEmpty && (
                  <div className="p-8 text-center text-gray-500">
                    No se encontraron documentos para "{treeSearchQuery}"
                  </div>
                )}

                {/* Carpetas en la ruta actual (solo mostrar si no hay búsqueda activa) */}
                {!hasTreeSearchResults && folders?.length > 0 && (
                  <div className="p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {folders.map((f) => (
                        <div
                          key={f.path}
                          className={`flex items-center gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50 ${selectedPath === f.path ? "bg-gray-50" : ""}`}
                          title={f.path}
                        >
                          <button
                            className="flex-1 flex items-center gap-2 text-left"
                            onClick={() => onOpenPath?.(f.path)}
                          >
                            <Folder className="w-4 h-4 text-gray-800" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{f.name}</div>
                              <div className="text-[11px] text-gray-500 truncate">
                                {typeof f.count === "number" ? `${f.count} ítems` : "Carpeta"}
                              </div>
                            </div>
                          </button>
                          
                          {canDelete && (
                            <button 
                              onClick={() => confirmDelete(f.path, f.name, true)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Eliminar carpeta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos */}
                {view === "list" ? (
                  <div className="p-3">
                    <div className="grid grid-cols-12 px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                      <div className="col-span-6">Nombre</div>
                      <div className="col-span-2">Tipo</div>
                      <div className="col-span-2">Tamaño</div>
                      <div className="col-span-2">
                        {hasTreeSearchResults ? "Ubicación" : "Actualizado"}
                      </div>
                    </div>

                    {(sortedFilteredFiles?.length ?? 0) === 0 ? (
                      !hasTreeSearched || !isTreeSearchEmpty ? (
                        <div className="p-8 text-center text-gray-500">Vacío</div>
                      ) : null
                    ) : (
                      sortedFilteredFiles.map((file) => (
                        <div key={file.id || file.name} className="grid grid-cols-12 items-center px-3 py-2 border-b border-gray-50">
                          <div className="col-span-6 flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-gray-700" />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block" title={file.name}>{file.name}</span>
                              {file.title && file.title !== file.name && (
                                <span className="text-xs text-gray-500 truncate block" title={file.title}>
                                  {file.title}
                                </span>
                              )}
                            </div>
                            <FileBadge name={file.name} />
                          </div>
                          <div className="col-span-2 text-xs text-gray-600">{file.contentType || "--"}</div>
                          <div className="col-span-2 text-xs text-gray-600">{fmtSize(file.size)}</div>
                          <div className="col-span-2 text-xs text-gray-600 flex items-center justify-between">
                            {hasTreeSearchResults ? (
                              <span className="truncate" title={file.path}>
                                {file.path || file.highlightedPath || "--"}
                              </span>
                            ) : (
                              <span>{file.updated ? new Date(file.updated).toLocaleString() : "--"}</span>
                            )}
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => handleDownload(file.path, file.name)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Descargar archivo"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {canDelete && (
                                <button 
                                  onClick={() => confirmDelete(file.path, file.name, false)}
                                  className="text-gray-400 hover:text-red-500"
                                  title="Eliminar archivo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="p-3">
                    {(sortedFilteredFiles?.length ?? 0) === 0 ? (
                      !hasTreeSearched || !isTreeSearchEmpty ? (
                        <div className="p-8 text-center text-gray-500">Vacío</div>
                      ) : null
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {sortedFilteredFiles.map((file) => (
                          <div key={file.id || file.name} className="border border-gray-200 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-700" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium truncate block" title={file.name}>{file.name}</span>
                                {file.title && file.title !== file.name && (
                                  <span className="text-xs text-gray-500 truncate block" title={file.title}>
                                    {file.title}
                                  </span>
                                )}
                              </div>
                              <FileBadge name={file.name} />
                            </div>
                            <div className="text-[11px] text-gray-500">
                              <div>{file.contentType || "--"}</div>
                              <div>{fmtSize(file.size)}</div>
                              {hasTreeSearchResults ? (
                                <div className="truncate" title={file.path}>
                                  📁 {file.path || file.highlightedPath || "--"}
                                </div>
                              ) : (
                                <div>{file.updated ? new Date(file.updated).toLocaleDateString() : "--"}</div>
                              )}
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center space-x-1">
                                  <button 
                                    onClick={() => handleDownload(file.path, file.name)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Descargar archivo"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  {canDelete && (
                                    <button 
                                      onClick={() => confirmDelete(file.path, file.name, false)}
                                      className="text-gray-400 hover:text-red-500"
                                      title="Eliminar archivo"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Modal: Crear Carpeta */}
        <Modal
          open={showCreateFolder}
          onClose={() => !creating && setShowCreateFolder(false)}
          title="Nueva Carpeta"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreateFolder(false)} disabled={creating}>Cancelar</Button>
              <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creating}>
                {creating ? "Creando..." : "Crear"}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <label className="text-sm text-gray-600">La carpeta se creará dentro de: <b>{selectedPath || "Raíz"}</b></label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              maxLength={120}
            />
            <p className="text-xs text-gray-500">Evita caracteres no permitidos: / \ ? * : &lt; &gt; |</p>
          </div>
        </Modal>

        {/* Modal: Agregar Documento */}
        <Modal
          open={showUpload}
          onClose={() => !uploading && setShowUpload(false)}
          title="Subir Documento"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowUpload(false)} disabled={uploading}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!uploadFileObj || uploading}>
                {uploading ? "Subiendo..." : "Subir"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Destino: <b>{selectedPath || "Raíz"}</b></p>
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-gray-500" />
              <input
                type="file"
                onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">Formatos comunes: PDF, DOCX, XLSX, PPTX (según valide tu backend).</p>
          </div>
        </Modal>
        
        {/* Modal de confirmación de eliminación */}
              <DeleteConfirmationModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        itemName={itemToDelete.name}
        isFolder={itemToDelete.isFolder}
        processing={deleteProcessing}
      />
      </div>
    </AdminLayout>
  );
};

export default AdminFolders;
