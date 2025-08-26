import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "@/services/firebase";
import {
  UserCog,
  FileText,
  Users,
  Globe,
  FolderTree,
  Home,
  History, 
  LogOut, 
  ExternalLink, // Ícono para enlace externo
} from "lucide-react";

const navItems = [
  { label: "Panel", icon: Home, to: "/admin" },
  { label: "Documentos", icon: FileText, to: "/admin/documents" },
  { label: "Usuarios", icon: Users, to: "/admin-users" },
  { label: "Biblioteca Pública", icon: Globe, to: "/admin/library" },
  { label: "Auditoría", icon: History, to: "/admin/audit" },
  { label: "Árbol de Carpetas", icon: FolderTree, to: "/admin/folders" },
  { label: "CMS Strapi", icon: ExternalLink, to: "https://hopeful-animal-11e82f343d.strapiapp.com/admin", external: true },
  { label: "Cerrar Sesión", icon: LogOut, to: "/login", action: "logout" }
];


export default function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      // Cerrar sesión en Firebase
      await auth.signOut();
      
      // Limpiar localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Redirigir a la página de login
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          Admin CDES
        </h1>
        <nav className="space-y-2">
          {navItems.map(({ label, icon: Icon, to, external, action }) => {
            if (external) {
              // External link
              return (
                <a
                  key={to}
                  href={to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              );
            } else if (action === "logout") {
              // Logout action
              return (
                <button
                  key={to}
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition w-full text-left text-red-600 hover:text-red-700"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            } else {
              // Internal link
              return (
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
              );
            }
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
