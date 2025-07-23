import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import { Toaster } from "sonner";

// 🔐 Autenticación
import Login from "./components/Login/Login";
import Signup from "./components/Login/Signup";

// 👤 Área de usuarios autenticados
import Dashboard from "./components/Users/Dashboard";

// 🛠️ Panel administrativo modularizado
import AdminDashboard from "./components/Admin/Layout/AdminDashboard";
import AdminUsers from "./components/Admin/ModuloUsuarios/AdminUsers";
import AdminDocuments from "./components/Admin/ModuloDocuments/AdminDocuments";
import AdminAudits from "./components/Admin/ModuloAudits/AdminAudit";
import AdminLibrary from "./components/Admin/ModuloLibrary/AdminLibrary"; // ✅ corregido
import News from "./components/Admin/ModuloNews/News";

import "./App.css";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />

        <Routes>
          {/* 🌐 Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* 👤 Área de usuarios autenticados */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          {/* 🛠️ Área administrativa */}
          <Route
            path="/admin"
            element={
              <PrivateRoute requireAdmin>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-users"
            element={
              <PrivateRoute requireAdmin>
                <AdminUsers />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/documents"
            element={
              <PrivateRoute requireAdmin>
                <AdminDocuments />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <PrivateRoute requireAdmin>
                <AdminAudits />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/library"
            element={
              <PrivateRoute requireAdmin>
                <AdminLibrary />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/news"
            element={
              <PrivateRoute requireAdmin>
                <News />
              </PrivateRoute>
            }
          />

          {/* 🔄 Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
