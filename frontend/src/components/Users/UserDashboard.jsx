import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FileText,
  FolderTree,
  User,
  LogOut,
  Menu,
  Home,
  Building2,
  Shield,
  Settings
} from "lucide-react";

// Importar componentes de documentos y carpetas
import UserDocuments from "./UserDocuments/UserDocuments.jsx";
import UserFolders from "./UserFolders/UserFolders.jsx";

export default function UserDashboard() {
  const { currentUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("documents");
  const [userRole, setUserRole] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [isExecAdmin, setIsExecAdmin] = useState(false);

  useEffect(() => {
    // Obtener información del usuario desde localStorage o Firebase
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      const roleVal = parsedUser.role || "Usuario";
      setUserRole(roleVal);
      setUserDisplayName(parsedUser.display_name || parsedUser.email);
      if (typeof roleVal === 'string' && roleVal.toLowerCase() === 'direccion ejecutiva') {
        setIsExecAdmin(true);
      }
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAdminAccess = () => {
    navigate("/admin");
  };

  // Mapeo de roles a nombres de departamento
  const getRoleName = (role) => {
    const roleNames = {
      admin: "Administrador",
      asistenciaGeneral: "Asistencia General",
      CoordinadorPlanificacion: "Coordinador de Planificación",
      UnidadAdministrativa: "Unidad Administrativa",
      UnidadComunicacion: "Unidad de Comunicación",
      UnidadPlanificacion: "Unidad de Planificación",
      UnidadProyectos: "Unidad de Gestión de Proyectos",
    };
    return roleNames[role] || role || "Sin departamento asignado";
  };

  const navigation = [
    {
      name: "Documentos",
      id: "documents",
      icon: FileText,
      description: "Gestiona tus documentos del departamento"
    },
    {
      name: "Árbol de Carpetas",
      id: "folders",
      icon: FolderTree,
      description: "Organiza tus archivos en carpetas"
    }
  ];

  const NavigationItems = ({ mobile = false, onItemClick = () => {} }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={activeSection === item.id ? "default" : "ghost"}
            className={`${mobile ? "w-full justify-start" : ""} gap-2`}
            onClick={() => {
              setActiveSection(item.id);
              onItemClick();
            }}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Button>
        );
      })}
      
      {/* Botón de Administración - Solo visible para admins */}
      { (isAdmin || isExecAdmin) && (
        <Button
          variant="ghost"
          className={`${mobile ? "w-full justify-start" : ""} gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50`}
          onClick={() => {
            handleAdminAccess();
            onItemClick();
          }}
        >
          <Shield className="h-4 w-4" />
          Panel de Administración
        </Button>
      )}
    </>
  );

  const UserDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {currentUser?.email?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">
              {userDisplayName || currentUser?.email}
            </p>
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {getRoleName(userRole)}
              </span>
            </div>
            { (isAdmin || isExecAdmin) && (
              <Badge variant="default" className="w-fit">
                <Shield className="h-3 w-3 mr-1" />
                Administrador
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        { (isAdmin || isExecAdmin) && (
          <>
            <DropdownMenuItem onClick={handleAdminAccess} className="text-orange-600">
              <Settings className="mr-2 h-4 w-4" />
              <span>Panel de Administración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="container flex h-16 max-w-screen-2xl items-center px-4">
          {/* Logo, Usuario y Departamento */}
          <div className="mr-4 flex items-center space-x-3">
            <div className="hidden md:flex items-center">
              <Building2 className="h-7 w-7 text-blue-600 mr-3" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Portal CDES</h1>
                <p className="text-xs text-muted-foreground font-medium flex gap-2 items-center">
                  <span className="font-semibold text-gray-700">{userDisplayName || currentUser?.email?.split('@')[0] || 'Usuario'}</span>
                  <span className="opacity-60">•</span>
                  <span>{getRoleName(userRole)}</span>
                </p>
              </div>
            </div>
            {/* Badge para Admin */}
            { (isAdmin || isExecAdmin) && (
              <Badge variant="outline" className="hidden md:flex border-orange-200 bg-orange-50 text-orange-700">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>

          {/* Mobile menu */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
              <SheetHeader>
                <SheetTitle>Portal CDES</SheetTitle>
                <SheetDescription>
                  {getRoleName(userRole)}
                  { (isAdmin || isExecAdmin) && (
                    <Badge variant="outline" className="ml-2 border-orange-200 bg-orange-50 text-orange-700">
                      Admin
                    </Badge>
                  )}
                </SheetDescription>
              </SheetHeader>
              <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
                <div className="flex flex-col space-y-2">
                  <NavigationItems
                    mobile
                    onItemClick={() => setIsSheetOpen(false)}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop navigation */}
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="hidden md:flex md:space-x-2">
              <NavigationItems />
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-2">
              <UserDropdown />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container max-w-screen-2xl py-6 px-4">
        {/* Section Header */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            {navigation.find(n => n.id === activeSection)?.icon && 
              React.createElement(navigation.find(n => n.id === activeSection).icon, { className: "h-6 w-6 text-blue-600" })}
            {navigation.find(n => n.id === activeSection)?.name}
          </h2>
          <p className="text-muted-foreground mt-1">
            {navigation.find(n => n.id === activeSection)?.description}
          </p>
        </div>

        {/* Dynamic Content */}
        <div className="transition-all duration-200">
          {activeSection === "documents" && <UserDocuments />}
          {activeSection === "folders" && <UserFolders />}
        </div>
      </main>
    </div>
  );
}