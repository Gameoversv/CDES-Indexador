import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Home,
  Search, Loader2, Plus, Upload, List, Grid3X3, Filter, ChevronDown as CD
} from "lucide-react";

const extOf = (name = "") => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
const fmtSize = (n) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`) : "--");
const SORTS = [
  { id: "recent", label: "Más recientes" },
  { id: "oldest", label: "Más antiguos" },
  { id: "az", label: "A–Z" },
  { id: "za", label: "Z–A" },
  { id: "size", label: "Tamaño" },
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

function FolderRow({ node, depth, isOpen, onToggle, onOpenPath }) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
      onClick={() => onToggle?.(node.path)}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={node.path}
    >
      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      {isOpen ? <FolderOpen className="w-4 h-4 text-gray-800" /> : <Folder className="w-4 h-4 text-gray-800" />}
      <span
        className="text-sm font-medium truncate"
        onClick={(e) => { e.stopPropagation(); onOpenPath?.(node.path); }}
      >
        {node.name}
      </span>
      {typeof node.count === "number" && (
        <span className="ml-auto text-xs text-gray-500">{node.count}</span>
      )}
    </div>
  );
}

export default function FileManagerView({
  breadcrumbs = [{ name: "Raíz", path: "" }],
  sidebarRoot = [],
  sidebarChildren = {},
  openMap = { "": true },
  folders = [],
  files = [],
  loading = false,
  error = null,
  showUpload = true,
  initialView = "list",
  initialSort = "recent",
  // callbacks
  onToggleSidebar,
  onOpenPath,
  onBreadcrumbClick,
  onSearch,
  onSortChange,
  onViewChange,
  onNewFolder,
  onUpload
}) {
  // Estado estrictamente de UI (no de datos)
  const [view, setView] = useState(initialView);
  const [sort, setSort] = useState(initialSort);
  const [query, setQuery] = useState("");

  // Notas:
  // - Si tu backend ya ordena/busca, puedes ignorar el ordenado local y solo emitir los eventos.
  const sortedFiles = useMemo(() => {
    // Orden local (UI) — puedes omitir esto y dejar que el padre pase files ya ordenados
    const arr = [...files];
    const safeDate = (d) => {
      const t = new Date(d || 0).getTime();
      return isNaN(t) ? 0 : t;
    };
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
  }, [files, sort, query]);

  const currentPathText = useMemo(
    () => (breadcrumbs.length > 1 ? breadcrumbs.slice(1).map(c => c.name).join(" / ") : "Raíz"),
    [breadcrumbs]
  );

  return (
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
                  onClick={() => onBreadcrumbClick?.(c.path)}
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  onSearch?.(e.target.value);
                }}
                placeholder="Buscar en esta carpeta…"
                className="pl-9 pr-3 py-2 h-9 rounded-md border border-gray-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            <div className="relative">
              <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-2.5 pointer-events-none" />
              <select
                className="appearance-none pl-9 pr-8 py-2 h-9 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  onSortChange?.(e.target.value);
                }}
              >
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <CD className="w-4 h-4 text-gray-500 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === "list" ? "bg-gray-100 font-medium" : ""}`}
                onClick={() => { setView("list"); onViewChange?.("list"); }}
                title="Lista"
              >
                <List className="w-4 h-4" /> Lista
              </button>
              <button
                className={`px-3 h-9 text-sm flex items-center gap-1 ${view === "grid" ? "bg-gray-100 font-medium" : ""}`}
                onClick={() => { setView("grid"); onViewChange?.("grid"); }}
                title="Cuadrícula"
              >
                <Grid3X3 className="w-4 h-4" /> Cuadrícula
              </button>
            </div>

            <Button onClick={() => onNewFolder?.()} className="h-9 gap-2">
              <Plus className="w-4 h-4" /> Nueva carpeta
            </Button>

            {showUpload && (
              <Button onClick={() => onUpload?.()} className="h-9 gap-2 bg-red-600 hover:bg-red-600/90">
                <Upload className="w-4 h-4" /> Subir archivo
              </Button>
            )}
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
                  onClick={() => onToggleSidebar?.("")}
                >
                  {openMap[""] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Home className="w-4 h-4" />
                  <span className="text-sm font-semibold">Raíz</span>
                </div>

                {openMap[""] && (
                  <div className="pl-0">
                    {sidebarRoot.map(n => (
                      <div key={n.path}>
                        <FolderRow
                          node={n}
                          depth={1}
                          isOpen={!!openMap[n.path]}
                          onToggle={onToggleSidebar}
                          onOpenPath={onOpenPath}
                        />
                        {openMap[n.path] && (sidebarChildren[n.path]?.length ? (
                          sidebarChildren[n.path].map(child => (
                            <FolderRow
                              key={child.path}
                              node={child}
                              depth={2}
                              isOpen={!!openMap[child.path]}
                              onToggle={onToggleSidebar}
                              onOpenPath={onOpenPath}
                            />
                          ))
                        ) : null)}
                      </div>
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
                          className="flex items-center gap-2 p-2 rounded-md border border-gray-200 hover:bg-gray-50 text-left"
                          title={f.path}
                        >
                          <Folder className="w-4 h-4 text-gray-800" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{f.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">
                              {typeof f.count === "number" ? `${f.count} ítems` : "Carpeta"}
                            </div>
                          </div>
                        </button>
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
                      <div className="col-span-2">Actualizado</div>
                    </div>

                    {(sortedFiles?.length ?? 0) === 0 ? (
                      <div className="p-8 text-center text-gray-500">Vacío</div>
                    ) : (
                      sortedFiles.map((file) => (
                        <div key={file.id} className="grid grid-cols-12 items-center px-3 py-2 border-b border-gray-50">
                          <div className="col-span-6 flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-gray-700" />
                            <span className="truncate" title={file.name}>{file.name}</span>
                            <FileBadge name={file.name} />
                          </div>
                          <div className="col-span-2 text-xs text-gray-600">{file.contentType || "--"}</div>
                          <div className="col-span-2 text-xs text-gray-600">{fmtSize(file.size)}</div>
                          <div className="col-span-2 text-xs text-gray-600">
                            {file.updated ? new Date(file.updated).toLocaleString() : "--"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="p-3">
                    {(sortedFiles?.length ?? 0) === 0 ? (
                      <div className="p-8 text-center text-gray-500">Vacío</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {sortedFiles.map((file) => (
                          <div key={file.id} className="border border-gray-200 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-gray-700" />
                              <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
                              <FileBadge name={file.name} />
                            </div>
                            <div className="text-[11px] text-gray-500">
                              <div>{file.contentType || "--"}</div>
                              <div>{fmtSize(file.size)}</div>
                              <div>{file.updated ? new Date(file.updated).toLocaleDateString() : "--"}</div>
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
    </div>
  );
}
