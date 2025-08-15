import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle, Clock, AlertTriangle, ShieldX, Zap, XCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState(""); // ← Nuevo estado para tipo de error

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setErrorType("");
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
      console.log("Respuesta completa del servidor:", data); // ← Para debugging

      // VERIFICAR ÉXITO EXPLÍCITAMENTE
      if (response.ok && data.success === true) {
        setSuccess(true);
      } else {
        // MANEJAR ERRORES ESPECÍFICOS
        const errorMessage = data.message || data.detail || "Error al procesar la solicitud";
        const errorType = data.error_type || "UNKNOWN_ERROR";
        
        console.log("Error detectado:", { errorMessage, errorType }); // ← Para debugging
        
        setError(errorMessage);
        setErrorType(errorType);
        setSuccess(false); // ← Asegurar que no muestre éxito
      }
    } catch (err) {
      console.error("Error al enviar solicitud de recuperación:", err);
      setError("Error de conexión. Verifica tu internet e inténtalo de nuevo.");
      setErrorType("CONNECTION_ERROR");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN PARA OBTENER CONFIGURACIÓN DE ERROR
  const getErrorConfig = (type) => {
    switch (type) {
      case "RATE_LIMIT_EXCEEDED":
        return {
          icon: <Clock className="h-8 w-8 text-yellow-600" />,
          color: "border-yellow-200 bg-yellow-50",
          titleColor: "text-yellow-800",
          textColor: "text-yellow-700",
          title: "Demasiadas Solicitudes",
          subtitle: "Has alcanzado el límite de solicitudes",
          advice: "Espera 1 hora antes de intentar nuevamente",
          details: [
            "• Límite: 5 solicitudes por hora",
            "• Tu próximo intento será disponible en 1 hora",
            "• Para casos urgentes, contacta por teléfono",
            "• Horario de oficina: Lunes a Viernes, 8:00 AM - 5:00 PM"
          ]
        };
      case "USER_NOT_FOUND":
        return {
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          color: "border-red-200 bg-red-50",
          titleColor: "text-red-800",
          textColor: "text-red-700",
          title: "Usuario No Registrado",
          subtitle: "Este email no está registrado en el sistema",
          advice: "Contacta al administrador para crear tu cuenta",
          details: [
            "• El email no existe en la base de datos del sistema",
            "• Verifica que hayas escrito correctamente tu email",
            "• Si eres un usuario nuevo, solicita que te creen una cuenta",
            "• Contacta al administrador: admin@cdes.gob.do"
          ]
        };
      case "UNAUTHORIZED_DOMAIN":
        return {
          icon: <ShieldX className="h-8 w-8 text-red-600" />,
          color: "border-red-200 bg-red-50",
          titleColor: "text-red-800",
          textColor: "text-red-700",
          title: "Dominio No Autorizado",
          subtitle: "Tu email no está en la lista de dominios permitidos",
          advice: "Usa un email de dominio autorizado",
          details: [
            "• Dominios permitidos: @cdes.gob.do, @gmail.com",
            "• Verifica que tu email esté bien escrito",
            "• Contacta al administrador si tu dominio debería estar permitido",
            "• Puedes solicitar acceso por otros medios"
          ]
        };
      case "EMAIL_SERVICE_ERROR":
        return {
          icon: <Zap className="h-8 w-8 text-orange-600" />,
          color: "border-orange-200 bg-orange-50",
          titleColor: "text-orange-800",
          textColor: "text-orange-700",
          title: "Servicio Temporalmente No Disponible",
          subtitle: "El sistema de email está experimentando problemas",
          advice: "Contacta directamente al administrador",
          details: [
            "• El servicio de email está en mantenimiento",
            "• Puedes contactar por teléfono directamente",
            "• Email directo: admin@cdes.gob.do",
            "• Intenta nuevamente en unos minutos"
          ]
        };
      default:
        return {
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          color: "border-red-200 bg-red-50",
          titleColor: "text-red-800",
          textColor: "text-red-700",
          title: "Error en la Solicitud",
          subtitle: "Ha ocurrido un problema procesando tu solicitud",
          advice: "Contacta al soporte técnico",
          details: [
            "• Error inesperado en el sistema",
            "• Contacta al administrador",
            "• Email: admin@cdes.gob.do",
            "• Teléfono: +1-809-XXX-XXXX"
          ]
        };
    }
  };

  // PANTALLA DE ERROR (en lugar de éxito cuando hay error)
  if (error && !success) {
    const errorConfig = getErrorConfig(errorType);
    
    return (
      <div className="flex min-h-screen">
        {/* Panel izquierdo - Mensaje de error */}
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

            {/* Mensaje de error específico */}
            <Card className={`${errorConfig.color} border-2`}>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/50">
                  {errorConfig.icon}
                </div>
                <CardTitle className={errorConfig.titleColor}>
                  {errorConfig.title}
                </CardTitle>
                <CardDescription className={errorConfig.textColor}>
                  {errorConfig.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center text-sm">
                  <p className={`mb-2 ${errorConfig.textColor}`}>
                    Error para el email:
                  </p>
                  <p className="font-medium bg-white/70 px-3 py-2 rounded-md border">
                    {email}
                  </p>
                </div>
                
                {/* Mensaje de error del servidor */}
                <div className="bg-white/70 border border-gray-300 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-800 mb-1">Detalle del error:</p>
                  <p className="text-sm text-gray-700">{error}</p>
                </div>

                {/* Consejos específicos */}
                <div className="bg-white/70 border border-gray-300 rounded-lg p-3">
                  <p className="font-medium text-gray-800 mb-2">{errorConfig.advice}</p>
                  <div className="text-sm text-gray-700 space-y-1">
                    {errorConfig.details.map((detail, index) => (
                      <p key={index}>{detail}</p>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setError("");
                      setErrorType("");
                      setEmail("");
                    }}
                    className="w-full bg-cabra-purple hover:bg-cabra-purple/90"
                  >
                    Intentar Nuevamente
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
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
                <p className="text-xl text-black">Soporte Disponible</p>
                <p className="text-sm text-gray-600 mt-2">
                  Múltiples formas de contacto
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

  // PANTALLA DE ÉXITO (solo se muestra cuando success es true)
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
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-green-800">¡Solicitud Enviada!</CardTitle>
                <CardDescription className="text-green-600">
                  Tu solicitud está siendo procesada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center text-sm text-green-700">
                  <p className="mb-2">
                    Hemos enviado tu solicitud de cambio de contraseña al administrador para:
                  </p>
                  <p className="font-medium bg-green-100 px-3 py-2 rounded-md">
                    {email}
                  </p>
                </div>
                
                <div className="text-xs text-green-600 space-y-2">
                  <p>• Un administrador revisará tu solicitud</p>
                  <p>• Recibirás una respuesta por correo electrónico</p>
                  <p>• El proceso puede tomar hasta 24 horas</p>
                  <p>• Contacta al administrador si es urgente</p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setSuccess(false);
                      setEmail("");
                      setError("");
                      setErrorType("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Enviar otra solicitud
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
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

  // FORMULARIO PRINCIPAL (estado inicial)
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

              <Button asChild variant="outline" className="w-full bg-cabra-purple hover:bg-cabra-purple/90 border-2 border-gray-900 text-black font-medium py-2.5 px-4 rounded-md transition-all duration-200 shadow-md hover:shadow-lg">
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
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