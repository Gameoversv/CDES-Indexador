import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  UserCog,
  FileText,
  Users,
  Globe,
  Newspaper,
  FolderTree,
  Home,
  History, 
  Reply, // ✅ Nuevo ícono
} from "lucide-react";

const navItems = [
  { label: "Panel", icon: Home, to: "/admin" },
  { label: "Documentos", icon: FileText, to: "/admin/documents" },
  { label: "Usuarios", icon: Users, to: "/admin-users" },
  { label: "Biblioteca Pública", icon: Globe, to: "/admin/library" },
  { label: "Auditoría", icon: History, to: "/admin/audit" },
  { label: "Noticias", icon: Newspaper, to: "/admin/news" },
  { label: "Árbol de Carpetas", icon: FolderTree, to: "/admin/folders" },
  { label: "Volver al Dashboard", icon: Reply, to: "/dashboard" } // ✅ nuevo ítem
];


export default function AdminLayout({ children }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Admin CDES
        </h1>
        <nav className="space-y-2">
          {navItems.map(({ label, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition ${
                location.pathname === to ? "bg-muted" : ""
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
