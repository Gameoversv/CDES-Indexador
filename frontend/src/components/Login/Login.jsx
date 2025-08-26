import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase";
import { authAPI } from "@/services/api";
import { cn } from "@/components/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login({ className, ...props }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      localStorage.setItem("token", token); // compat legado

      // Perfil consolidado (usa /auth/me que ya audita USERS_ME_QUERIED)
      try {
        const me = await authAPI.getCurrentUser();
        if (me?.data) {
          localStorage.setItem("user", JSON.stringify(me.data));
        }
      } catch (_) {
        // fallback silencioso
      }

      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      const role = userData.role;
      
      // Verificar si es administrador (Dirección Ejecutiva)
      if (role === "DireccionEjecutiva" || role === "Dirección Ejecutiva" || role === "admin") {
        navigate("/admin");
      } else {
        // Para otros roles, usar el switch existente o ir al dashboard
        switch (role) {
          case "secretaria":
            navigate("/secretaria");
            break;
          case "supervisor":
            navigate("/supervisor");
            break;
          default:
            navigate("/dashboard");
        }
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setError("Correo o contraseña inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Formulario de login */}
      <div className="flex w-1/2 flex-col justify-center bg-white px-8 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo y título */}
          <div className="mb-8">
            <div className="flex items-center mb-6">
              <img 
                src="/favicon.ico" 
                alt="CDES Logo" 
                className="w-10 h-10 mr-3"
              />
              <span className="text-2xl font-bold text-cabra-purple">CDES</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="mt-2 text-sm text-gray-600">
              Accede a tu cuenta para continuar
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </Label>
              <div className="mt-1">
                <Input
                  id="email"
                  type="email"
                  placeholder="example@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-cabra-purple focus:outline-none focus:ring-cabra-purple"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Contraseña
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-cabra-purple hover:text-cabra-purple/80 underline-offset-4 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="mt-1">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-cabra-purple focus:outline-none focus:ring-cabra-purple"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-cabra-purple hover:bg-cabra-purple/90 border-2 border-gray-900 text-black font-medium py-2.5 px-4 rounded-md transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : (
                  "Iniciar sesión"
                )}
              </Button>
            </div>
          </form>

        </div>
      </div>

      {/* Panel derecho - Imagen y branding */}
      <div className="relative flex w-1/2 flex-col justify-center overflow-hidden ">
        {/* Imagen de fondo */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url('/edificio_cdes.png')`,
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        />
        
        {/* Contenido */}
        <div className="relative z-10 px-8 py-12 lg:px-16">
          <div className="mx-auto max-w-md text-center text-black">
            {/* Logo grande */}
            <div className="mb-8">
              <p className="text-xl text-black">Indexador de Documentos</p>
            </div>

            {/* Footer del panel */}
            <div className="mt-8 text-sm text-black">
              <p>© 2025 CDES. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>

        {/* Decoración geométrica */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full transform translate-x-16 -translate-y-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full transform -translate-x-12 translate-y-12"></div>
      </div>
    </div>
  );
}
