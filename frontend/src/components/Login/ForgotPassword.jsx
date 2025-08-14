import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle, Clock } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Enviar solicitud al backend en lugar de Firebase directamente
      const response = await fetch("http://localhost:8000/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          requestedAt: new Date().toISOString(),
          userAgent: navigator.userAgent,
          ipAddress: "unknown" // Se puede obtener del backend
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al procesar la solicitud");
      }

      setSuccess(true);
    } catch (err) {
      console.error("Error al enviar solicitud de recuperación:", err);
      setError(err.message || "Error al enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen">
        {/* Panel izquierdo - Mensaje de éxito */}
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
            </div>

            {/* Mensaje de éxito */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-blue-800">¡Solicitud enviada!</CardTitle>
                <CardDescription className="text-blue-600">
                  Tu solicitud está siendo revisada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center text-sm text-blue-700">
                  <p className="mb-2">
                    Hemos enviado tu solicitud de cambio de contraseña al administrador para:
                  </p>
                  <p className="font-medium bg-blue-100 px-3 py-2 rounded-md">
                    {email}
                  </p>
                </div>
                
                <div className="text-xs text-blue-600 space-y-2">
                  <p>• Un administrador revisará tu solicitud</p>
                  <p>• Recibirás una respuesta por correo electrónico</p>
                  <p>• El proceso puede tomar hasta 24 horas</p>
                  <p>• Contacta al administrador si es urgente</p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    onClick={() => setSuccess(false)}
                    variant="outline"
                    className="w-full text-black"
                  >
                    Enviar otra solicitud
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/login">
                      <ArrowLeft className="mr-2 h-4 w-4 text-black" />
                      Volver al inicio de sesión
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Panel derecho - Imagen y branding */}
        <div className="relative flex w-1/2 flex-col justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{
              backgroundImage: `url('/edificio_cdes.png')`,
              backgroundPosition: 'center',
              backgroundSize: 'cover'
            }}
          />
          
          <div className="relative z-10 px-8 py-12 lg:px-16">
            <div className="mx-auto max-w-md text-center text-black">
              <div className="mb-8">
                <p className="text-xl text-black">Proceso Controlado</p>
                <p className="text-sm text-gray-600 mt-2">
                  Seguridad administrativa
                </p>
              </div>
              <div className="mt-8 text-sm text-black">
                <p>© 2025 CDES. Todos los derechos reservados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Formulario de solicitud */}
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
            <h2 className="text-3xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Solicita al administrador que restablezca tu contraseña
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Tu correo electrónico
              </Label>
              <div className="mt-1 relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="tu-correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-cabra-purple focus:outline-none focus:ring-cabra-purple"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Debe ser el correo registrado en tu cuenta
              </p>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            {/* Información del proceso */}
            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Proceso de recuperación:</h4>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• Tu solicitud será enviada al administrador</li>
                <li>• Un administrador verificará tu identidad</li>
                <li>• Recibirás instrucciones por correo</li>
                <li>• Para casos urgentes, contacta directamente al administrador</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-cabra-purple hover:bg-cabra-purple/90 border-2 border-gray-900 text-black font-medium py-2.5 px-4 rounded-md transition-all duration-200 shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando solicitud...
                  </div>
                ) : (
                  "Enviar solicitud al administrador"
                )}
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4 text-black" />
                  Volver al inicio de sesión
                </Link>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Panel derecho - Imagen y branding */}
      <div className="relative flex w-1/2 flex-col justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url('/edificio_cdes.png')`,
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        />
        
        <div className="relative z-10 px-8 py-12 lg:px-16">
          <div className="mx-auto max-w-md text-center text-black">
            <div className="mb-8">
              <p className="text-xl text-black">Recuperación Controlada</p>
              <p className="text-sm text-gray-600 mt-2">
                Proceso administrativo seguro
              </p>
            </div>
            <div className="mt-8 text-sm text-black">
              <p>© 2025 CDES. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}