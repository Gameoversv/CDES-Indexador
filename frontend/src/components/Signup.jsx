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
import { auth } from "@/services/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export function SignUpForm({
  className,
  ...props
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      switch (err.code) {
        case "auth/email-already-in-use":
          setError("El correo ya está registrado");
          break;
        case "auth/weak-password":
          setError("La contraseña es demasiado débil");
          break;
        case "auth/invalid-email":
          setError("Correo electrónico inválido");
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
              <CardTitle>Crear tu cuenta</CardTitle>
              <CardDescription>
                Ingresa tu información para crear tu cuenta
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
                    <Label htmlFor="password">Contraseña</Label>
                    <Input 
                      id="password" 
                      onChange={(e) => setPassword(e.target.value)} 
                      type="password" 
                      value={password}
                      placeholder="Mínimo 6 caracteres"
                      required 
                    />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input 
                      id="confirmPassword" 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      type="password" 
                      value={confirmPassword}
                      placeholder="Confirma tu contraseña"
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
                      Crear cuenta
                    </Button>
                  </div>
                </div>
                <div className="mt-4 text-center text-sm">
                  ¿Ya tienes una cuenta?{" "}
                  <a href="/login" className="underline underline-offset-4">
                    Iniciar sesión
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