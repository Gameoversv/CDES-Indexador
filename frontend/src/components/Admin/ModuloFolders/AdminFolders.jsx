import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../Layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { documentsAPI } from '../../../services/api';
import TreeNode from '../../Users/UserFolders/TreeNode';
import {
  Folder, FileText, ChevronRight, ChevronDown, Home,
  Search, Loader2, Plus, Upload as UploadIcon, List, Grid3X3, Filter, ChevronDown as CD, RefreshCw, Download,
} from 'lucide-react';

// Utils (alineadas a UserFolders)
const extOf = (name = '') => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');
const fmtSize = (n) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : '--');
const safeDate = (d) => { const t = new Date(d || 0).getTime(); return isNaN(t) ? 0 : t; };
const SORTS = [
  { id: 'recent', label: 'Más recientes' },
  { id: 'oldest', label: 'Más antiguos' },
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
  { id: 'size', label: 'Tamaño' },
];

function FileBadge({ name }) {
  const ext = extOf(name);
  if (!ext) return null;
  return (
    <span className="ml-2 text-[10px] uppercase rounded-full border px-1.5 py-0.5 border-gray-300 text-gray-600">
      {ext}
    </span>
  );
}

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

const AdminFolders = () => {
  // Árbol y contenido
  const [treeData, setTreeData] = useState([]);
  const [openMap, setOpenMap] = useState({ '': true });
  const [sidebarRoot, setSidebarRoot] = useState([]);
  const [sidebarChildren, setSidebarChildren] = useState({});
  const [selectedPath, setSelectedPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Raíz', path: '' }]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list');
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');

  // Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileObj, setUploadFileObj] = useState(null);

  const currentPathText = useMemo(
    () => (breadcrumbs.length > 1 ? breadcrumbs.slice(1).map((c) => c.name).join(' / ') : 'Raíz'),
    [breadcrumbs]
  );

  const sortedFilteredFiles = useMemo(() => {
    const arr = [...files];
    switch (sort) {
      case 'oldest': arr.sort((a, b) => safeDate(a.updated) - safeDate(b.updated)); break;
      case 'az': arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'za': arr.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'size': arr.sort((a, b) => (a.size || 0) - (b.size || 0)); break;
      default: arr.sort((a, b) => safeDate(b.updated) - safeDate(a.updated));
    }
    if (!query) return arr;
    const qq = query.toLowerCase();
    return arr.filter((f) => f.name.toLowerCase().includes(qq));
  }, [files, sort, query]);

  const buildBreadcrumbs = useCallback((path) => {
    if (!path) return [{ name: 'Raíz', path: '' }];
    const parts = path.split('/').filter(Boolean);
    const acc = [{ name: 'Raíz', path: '' }];
    let cur = '';
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      acc.push({ name: p, path: cur });
    }
    return acc;
  }, []);

  // Buscar un nodo por path en el árbol completo
  const findNodeByPath = useCallback((nodes, path) => {
    if (!path) return null;
    const target = path.endsWith('/') ? path.slice(0, -1) : path;
    let res = null;
    const dfs = (list) => {
      for (const n of list) {
        const np = n.path.endsWith('/') ? n.path.slice(0, -1) : n.path;
        if (np === target) { res = n; return true; }
        if (n.children && dfs(n.children)) return true;
      }
      return false;
    };
    dfs(nodes);
    return res;
  }, []);

  const materializeSidebarFromTree = useCallback((tree) => {
    const roots = tree.filter((n) => n.type === 'folder');
    setSidebarRoot(roots.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })));
    setSidebarChildren((prev) => ({
      ...prev,
      '': roots.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })),
    }));
  }, []);

  const loadFolderContent = useCallback(async (path, existing = null) => {
    try {
      const data = existing || treeData;
      const node = path ? findNodeByPath(data, path) : null;
      if (!path) {
        const rf = data.filter((n) => n.type === 'folder');
        const rfiles = data.filter((n) => n.type === 'file');
        setFolders(rf.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })));
        setFiles(rfiles.map((f) => ({ name: f.name, path: f.path, contentType: f.contentType || '', size: f.size || 0, updated: f.updated })));
        setBreadcrumbs(buildBreadcrumbs(path));
        return;
      }
      if (node && node.children) {
        const childFolders = node.children.filter((n) => n.type === 'folder');
        const childFiles = node.children.filter((n) => n.type === 'file');
        setFolders(childFolders.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })));
        setFiles(childFiles.map((f) => ({ name: f.name, path: f.path, contentType: f.contentType || '', size: f.size || 0, updated: f.updated })));
      } else {
        setFolders([]);
        setFiles([]);
      }
      setBreadcrumbs(buildBreadcrumbs(path));
    } catch (e) {
      console.error('Error cargando carpeta:', e);
      setError('No se pudo cargar el contenido de la carpeta.');
    }
  }, [treeData, findNodeByPath, buildBreadcrumbs]);

  const fetchTreeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsAPI.getStorageTree();
      const data = res.data || [];
      setTreeData(data);
      materializeSidebarFromTree(data);

      if (!selectedPath) {
        // raíz
        const rf = data.filter((n) => n.type === 'folder');
        const rfiles = data.filter((n) => n.type === 'file');
        setFolders(rf.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })));
        setFiles(rfiles.map((f) => ({ name: f.name, path: f.path, contentType: f.contentType || '', size: f.size || 0, updated: f.updated })));
      } else {
        await loadFolderContent(selectedPath, data);
      }
    } catch (e) {
      console.error('Error al cargar árbol:', e);
      setError('Error al cargar la estructura de carpetas. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [materializeSidebarFromTree, selectedPath, loadFolderContent]);

  const ensureChildrenLoaded = useCallback(async (path) => {
    if (sidebarChildren[path]) return;
    try {
      const node = findNodeByPath(treeData, path);
      if (node && node.children) {
        const childFolders = node.children.filter((n) => n.type === 'folder');
        setSidebarChildren((prev) => ({
          ...prev,
          [path]: childFolders.map((f) => ({ name: f.name, path: f.path, count: f.children?.length || 0 })),
        }));
      } else {
        setSidebarChildren((prev) => ({ ...prev, [path]: [] }));
      }
    } catch (e) {
      setSidebarChildren((prev) => ({ ...prev, [path]: [] }));
    }
  }, [treeData, sidebarChildren, findNodeByPath]);

  // Acciones UI
  const onToggleSidebar = async (path) => {
    setOpenMap((prev) => ({ ...prev, [path]: !prev[path] }));
    if (!openMap[path]) {
      try { await ensureChildrenLoaded(path); } catch {}
    }
  };

  const onOpenPath = async (path) => {
    setSelectedPath(path);
    setError(null);
    setLoading(true);
    try { await loadFolderContent(path); } catch {} finally { setLoading(false); }
  };

  const onBreadcrumbClick = (path) => onOpenPath(path);

  const refreshAll = async () => {
    await fetchTreeData();
  };

  // Backend actions
  const handleCreateFolder = async () => {
    const name = (newFolderName || '').trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await documentsAPI.createFolder({ nombre: name, ruta_padre: selectedPath });
      setShowCreateFolder(false);
      setNewFolderName('');
      await fetchTreeData();
    } catch (e) {
      setError('No se pudo crear la carpeta (verifica permisos y nombre).');
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
      fd.append('file', uploadFileObj);
      fd.append('path', selectedPath);
      await documentsAPI.uploadByPath(fd);
      setShowUpload(false);
      setUploadFileObj(null);
      await fetchTreeData();
    } catch (e) {
      setError('No se pudo subir el archivo (verifica permisos, tipo y tamaño).');
    } finally {
      setUploading(false);
    }
  };

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

  useEffect(() => { (async () => { await fetchTreeData(); })(); }, []);

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
                  className={`text-sm ${i === breadcrumbs.length - 1 ? 'font-semibold' : 'text-gray-600 hover:underline'}`}
                  onClick={() => onBreadcrumbClick(c.path)}
                >
                  {c.name}
                </button>
              </div>
            ))}
          </div>

          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en esta carpeta…"
                className="pl-9 pr-3 py-2 h-9 rounded-md border border-gray-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            <div className="relative">
              <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
              <select
                className="appearance-none pl-9 pr-8 py-2 h-9 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <CD className="w-4 h-4 text-gray-500 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === 'list' ? 'bg-gray-100 font-medium' : ''}`}
                onClick={() => setView('list')}
                title="Lista"
              >
                <List className="w-4 h-4" /> Lista
              </button>
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === 'grid' ? 'bg-gray-100 font-medium' : ''}`}
                onClick={() => setView('grid')}
                title="Cuadrícula"
              >
                <Grid3X3 className="w-4 h-4" /> Cuadrícula
              </button>
            </div>

            <Button onClick={() => setShowCreateFolder(true)} className="h-9 gap-2">
              <Plus className="w-4 h-4" /> Crear Carpeta
            </Button>

            <Button onClick={() => setShowUpload(true)} className="h-9 gap-2 bg-red-600 hover:bg-red-600/90">
              <UploadIcon className="w-4 h-4" /> Agregar Documento
            </Button>

            <Button onClick={refreshAll} variant="outline" className="h-9 gap-2">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </Button>
          </div>
        </div>

        {/* Layout: árbol de carpetas + contenido */}
        <div className="grid grid-cols-12 gap-4 mt-0">
          {/* Sidebar (árbol) */}
          <aside className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200">
            <div className="p-3 border-b border-gray-100 text-xs font-semibold text-gray-600">CARPETAS</div>
            <div className="h-[540px] overflow-auto">
              {/* Raíz */}
              <div className="mb-1">
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                  onClick={() => onToggleSidebar?.('')}
                >
                  {openMap[''] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Home className="w-4 h-4" />
                  <span
                    className={`text-sm font-semibold ${selectedPath === '' ? 'underline' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onOpenPath(''); }}
                  >
                    Raíz
                  </span>
                </div>

                {openMap[''] && (
                  <div className="pl-0">
                    {sidebarRoot.map((n) => (
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
              Carpeta actual: <span className="font-semibold">{currentPathText}</span>
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center text-gray-600 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-600">{error}</div>
            ) : (
              <>
                {/* Carpetas en la ruta actual */}
                {folders?.length > 0 && (
                  <div className="p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {folders.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => onOpenPath?.(f.path)}
                          className={`flex items-center gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50 text-left ${selectedPath === f.path ? 'bg-gray-50' : ''}`}
                          title={f.path}
                        >
                          <Folder className="w-4 h-4 text-gray-800" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{f.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">
                              {typeof f.count === 'number' ? `${f.count} ítems` : 'Carpeta'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos */}
                {view === 'list' ? (
                  <div className="p-3">
                    <div className="grid grid-cols-12 px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                      <div className="col-span-6">Nombre</div>
                      <div className="col-span-2">Tipo</div>
                      <div className="col-span-2">Tamaño</div>
                      <div className="col-span-2">Actualizado</div>
                    </div>

                    {(sortedFilteredFiles?.length ?? 0) === 0 ? (
                      <div className="p-8 text-center text-gray-500">Vacío</div>
                    ) : (
                      sortedFilteredFiles.map((file) => (
                        <div key={file.path} className="grid grid-cols-12 items-center px-3 py-2 border-b border-gray-50">
                          <div className="col-span-6 flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-gray-700" />
                            <span className="truncate" title={file.name}>{file.name}</span>
                            <FileBadge name={file.name} />
                          </div>
                          <div className="col-span-2 text-xs text-gray-600">{file.contentType || '--'}</div>
                          <div className="col-span-2 text-xs text-gray-600">{fmtSize(file.size)}</div>
                          <div className="col-span-2 text-xs text-gray-600 flex items-center justify-between">
                            <span>{file.updated ? new Date(file.updated).toLocaleString() : '--'}</span>
                            <button
                              onClick={() => handleDownload(file.path, file.name)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Descargar archivo"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="p-3">
                    {(sortedFilteredFiles?.length ?? 0) === 0 ? (
                      <div className="p-8 text-center text-gray-500">Vacío</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {sortedFilteredFiles.map((file) => (
                          <div key={file.path} className="border border-gray-200 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-700" />
                              <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
                              <FileBadge name={file.name} />
                            </div>
                            <div className="text-[11px] text-gray-500">
                              <div>{file.contentType || '--'}</div>
                              <div>{fmtSize(file.size)}</div>
                              <div className="flex items-center justify-between">
                                <span>{file.updated ? new Date(file.updated).toLocaleDateString() : '--'}</span>
                                <button
                                  onClick={() => handleDownload(file.path, file.name)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Descargar archivo"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
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
                {creating ? 'Creando...' : 'Crear'}
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            <label className="text-sm text-gray-600">La carpeta se creará dentro de: <b>{selectedPath || 'Raíz'}</b></label>
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
                {uploading ? 'Subiendo...' : 'Subir'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Destino: <b>{selectedPath || 'Raíz'}</b></p>
            <div className="flex items-center gap-2">
              <UploadIcon className="h-5 w-5 text-gray-500" />
              <input
                type="file"
                onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">Formatos comunes: PDF, DOCX, XLSX, PPTX.</p>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default AdminFolders;
