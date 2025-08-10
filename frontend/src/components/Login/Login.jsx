import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase";
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

      // Consultar perfil en backend
      const res = await fetch("http://localhost:8000/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Fallo al obtener usuario");

      const data = await res.json();

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(data));

      // Redirigir por rol
      const role = data.role;
      switch (role) {
        case "admin":
          navigate("/admin");
          break;
        case "secretaria":
          navigate("/secretaria");
          break;
        case "supervisor":
          navigate("/supervisor");
          break;
        default:
          navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setError("Correo o contraseña inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full bg-cabra-black">
      {/* Imagen de fondo del edificio CDES */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-75"
        style={{
          backgroundImage: `url('/edificio_cdes.png')`,
          backgroundPosition: 'center right',
          backgroundSize: 'cover'
        }}
      />
      
      {/* Overlay para mejor contraste */}
      <div className="absolute inset-0 bg-gradient-to-r from-cabra-black via-cabra-black/90 to-cabra-black/30" />

      {/* Contenedor principal */}
      <div className="relative z-10 flex w-full">
        {/* Panel izquierdo - Formulario de login */}
        <div className="flex w-full lg:w-1/2 xl:w-2/5 items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            {/* Logo y título principal */}
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center mb-4">
                <img 
                  src="/favicon.ico" 
                  alt="CDES Logo" 
                  className="w-12 h-12 md:w-16 md:h-16 mr-3"
                />
                <div className="text-left">
                  <h1 className="text-3xl md:text-4xl font-bold text-cabra-purple">
                    CDES
                  </h1>
                </div>
              </div>
            </div>

            {/* Formulario de login */}
            <div className={cn("flex flex-col gap-6", className)} {...props}>
              <Card className="bg-white border border-cabra-purple/50 backdrop-blur-sm shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-cabra-purple text-2xl tracking-wide text-center">
                    Iniciar sesión
                  </CardTitle>
                  <CardDescription className="text-center text-cabra-steel">
                    Accede a tu cuenta para continuar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-6">
                      <div className="grid gap-3">
                        <Label htmlFor="email" className="text-black">
                          Correo electrónico
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="correo@ejemplo.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-cabra-black/50 border-cabra-steel/30 text-white placeholder:text-cabra-steel/60"
                        />
                      </div>
                      <div className="grid gap-3">
                        <div className="flex items-center">
                          <Label htmlFor="password" className="text-black">
                            Contraseña
                          </Label>
                          <a
                            href="#"
                            className="ml-auto inline-block text-sm text-cabra-purple hover:text-cabra-purple/80 underline-offset-4 hover:underline"
                          >
                            ¿Olvidaste tu contraseña?
                          </a>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="bg-cabra-black/50 border-cabra-steel/30 text-black placeholder:text-cabra-steel/60"
                        />
                      </div>
                      {error && (
                        <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-md border border-red-500/20">
                          {error}
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        <Button 
                          type="submit" 
                          className="w-full bg-cabra-purple hover:bg-cabra-purple/90 border-2 border-gray-900 shadow-inner hover:shadow-lg text-black font-medium py-2.5 transition-all duration-200" 
                          disabled={loading}
                        >
                          {loading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white text-black rounded-full animate-spin" />
                              Entrando...
                            </div>
                          ) : (
                            "Iniciar sesión"
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-cabra-steel text-sm">
              <p>Consejo de Desarrollo Estratégico de Santiago</p>
              <p className="mt-1">© 2025 CDES. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
