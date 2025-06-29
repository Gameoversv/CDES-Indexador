import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase";

export function LoginForm({
  className,
  ...props
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      switch (err.code) {
        case "auth/wrong-password":
          setError("Contraseña incorrecta");
          break;
        case "auth/user-not-found":
          setError("El usuario no existe");
          break;
        case "auth/invalid-email":
          setError("Correo electrónico inválido");
          break;
        case "auth/invalid-credential":
          setError("Credenciales inválidas");
          break;
        default:
          setError(err.message);
      }
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6", className)} {...props}>
          <Card>
            <CardHeader>
              <CardTitle>Iniciar sesión</CardTitle>
              <CardDescription>
                Ingresa tu correo electrónico para acceder a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      onChange={(e) => setEmail(e.target.value)}
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      required
                    />
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-center">
                      <Label htmlFor="password">Contraseña</Label>
                      <a
                        href="#"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </a>
                    </div>
                    <Input 
                      id="password" 
                      onChange={(e) => setPassword(e.target.value)} 
                      type="password" 
                      value={password}
                      required 
                    />
                  </div>
                  {error && (
                    <div className="text-red-500 text-sm text-center">
                      {error}
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    <Button type="submit" className="w-full">
                      Iniciar sesión
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-center text-sm">
                  ¿No tienes una cuenta?{" "}
                  <a href="/signup" className="underline underline-offset-4">
                    Crear cuenta
                  </a>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}