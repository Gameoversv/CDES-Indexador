import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

import { LoginForm } from "./components/Login";
import { SignUpForm } from "./components/Signup";
import Dashboard from "./components/Dashboard";
import UploadDocument from "./components/UploadDocument";
import SearchDocuments from "./components/SearchDocuments";
import DocumentsList from "./components/DocumentsList";
import AdminUsers from "./components/AdminUsers";
import AdminDashboard from "./components/AdminDashboard";
import AdminDocuments from "./components/AdminDocuments";
import Library from "./components/Library";
import Audit from "./components/Audit";
import News from "./components/News"; // ✅ Nueva importación
import { Toaster } from "sonner";

import "./App.css";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        {/* ✅ Toaster global para notificaciones */}
        <Toaster position="top-right" richColors closeButton />

        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignUpForm />} />
          <Route path="/library" element={<Library />} />

          {/* Panel principal (usuarios autenticados) */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          {/* Funciones administrativas (solo admins) */}
          <Route
            path="/upload"
            element={
              <PrivateRoute requireAdmin>
                <UploadDocument />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <PrivateRoute requireAdmin>
                <Audit />
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
            path="/admin"
            element={
              <PrivateRoute requireAdmin>
                <AdminDashboard />
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
            path="/admin/library"
            element={
              <PrivateRoute requireAdmin>
                <Library />
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

          {/* Funciones generales (usuarios autenticados) */}
          <Route
            path="/search"
            element={
              <PrivateRoute>
                <SearchDocuments />
              </PrivateRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <DocumentsList />
              </PrivateRoute>
            }
          />

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
