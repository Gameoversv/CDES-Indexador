import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";

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
  Search,
  Upload,
  Shield,
  User,
  LogOut,
  Menu,
  Home
} from "lucide-react";

export function Navbar() {
  const { currentUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navigation = [
  {
    name: "Inicio",
    href: "/dashboard",
    icon: Home,
    show: true
  },
  {
    name: "Buscar",
    href: "/search",
    icon: Search,
    show: true
  },
  {
    name: "Documentos",
    href: "/documents",
    icon: FileText,
    show: true
  },
  {
    name: "Subir",
    href: "/upload",
    icon: Upload,
    show: isAdmin
  },
  {
    name: "Auditoría",
    href: "/audit",
    icon: Shield,
    show: isAdmin
  },
  {
    name: "Administracion",
    href: "/admin",
    icon: UserCog,
    show: isAdmin
  }
];

  const isActive = (path) => location.pathname === path;

  const NavigationItems = ({ mobile = false, onItemClick = () => { } }) => (
    <>
      {navigation
        .filter(item => item.show)
        .map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.name}
              variant={isActive(item.href) ? "default" : "ghost"}
              className={`${mobile ? "w-full justify-start" : ""} gap-2`}
              onClick={() => {
                navigate(item.href);
                onItemClick();
              }}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Button>
          );
        })}
    </>
  );

  const UserDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {currentUser?.email?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser?.email}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? "Admin" : "Usuario"}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          {/* Logo */}
          <div className="mr-4 hidden md:flex">
            <Button
              variant="ghost"
              className="mr-6 text-lg font-semibold"
              onClick={() => navigate("/dashboard")}
            >
              Demo Indexador Gemini
            </Button>
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
                <SheetTitle>Demo Indexador Gemini</SheetTitle>
                <SheetDescription>
                  Sistema de gestión de documentos
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
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="bg-muted/50 aspect-video rounded-xl" />
          <div className="bg-muted/50 aspect-video rounded-xl" />
          <div className="bg-muted/50 aspect-video rounded-xl" />
        </div>
        <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
      </div>
    </div>
  );
}

export default Navbar;