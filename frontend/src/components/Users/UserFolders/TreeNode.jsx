// frontend/src/components/Users/UserFolders/TreeNode.jsx
import React from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Trash2 } from "lucide-react";

/**
 * Representa un nodo de carpeta en el árbol (recursivo).
 *
 * Props:
 * - node: { name, path, count? }
 * - depth: número (indent visual)
 * - openMap: objeto { [path]: bool } con rutas abiertas
 * - childrenMap: objeto { [path]: FolderNode[] } con hijos ya cargados
 * - onToggle(path): abre/cierra y el padre decide si cargar hijos
 * - onOpenPath(path): abre la carpeta en el panel derecho
 * - ensureChildrenLoaded(path): promesa para cargar hijos si no existen
 * - selectedPath: ruta seleccionada actualmente
 * - canDelete: booleano para indicar si el usuario puede eliminar
 * - onDelete: función para eliminar el nodo
 */
export default function TreeNode({
  node,
  depth = 0,
  openMap = {},
  childrenMap = {},
  onToggle,
  onOpenPath,
  ensureChildrenLoaded,
  selectedPath,
  canDelete = false,
  onDelete,
}) {
  const isOpen = !!openMap[node.path];
  const kids = childrenMap[node.path] || [];
  const hasKids = kids.length > 0;

  const handleToggle = async (e) => {
    e.stopPropagation();
    onToggle?.(node.path);
    if (!isOpen) {
      try { await ensureChildrenLoaded?.(node.path); } catch { /* no-op */ }
    }
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    onOpenPath?.(node.path);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      const confirmed = window.confirm(`¿Estás seguro de eliminar ${node.name}? Esta acción no se puede deshacer.`);
      if (confirmed) {
        onDelete(node.path, node.name);
      }
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer ${selectedPath === node.path ? "bg-gray-100" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.path}
        onClick={handleOpen}
      >
        {/* Toggle */}
        <button
          className="p-0.5 rounded hover:bg-gray-200"
          onClick={handleToggle}
          aria-label={isOpen ? "Contraer" : "Expandir"}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Icono carpeta */}
        {isOpen ? <FolderOpen className="w-4 h-4 text-gray-800" /> : <Folder className="w-4 h-4 text-gray-800" />}

        {/* Nombre */}
        <span className="text-sm font-medium truncate">{node.name}</span>

        {/* Contador opcional */}
        {typeof node.count === "number" && (
          <span className="ml-auto text-xs text-gray-500">{node.count}</span>
        )}
        
        {/* Botón de eliminar (solo para usuarios autorizados) */}
        {canDelete && (
          <button
            className="ml-auto p-1 rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400"
            onClick={handleDelete}
            title={`Eliminar ${node.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Hijos */}
      {isOpen && hasKids && (
        <div className="mt-0.5">
          {kids.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              openMap={openMap}
              childrenMap={childrenMap}
              onToggle={onToggle}
              onOpenPath={onOpenPath}
              ensureChildrenLoaded={ensureChildrenLoaded}
              selectedPath={selectedPath}
              canDelete={canDelete}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
