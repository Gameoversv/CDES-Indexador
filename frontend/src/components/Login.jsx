import { cn } from "@/lib/utils";
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
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/services/firebase";
import { doc, getDoc } from "firebase/firestore";

export function LoginForm({ className, ...props }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      // Obtener información del usuario desde Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("No se encontró el perfil del usuario.");
      }

      const userData = docSnap.data();

      // Guardar datos útiles en localStorage
      localStorage.setItem("userRole", userData.role);
      localStorage.setItem("userId", user.uid);
      localStorage.setItem("userEmail", user.email);

      // Redirigir según el rol
      switch (userData.role) {
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
      if (err.code) {
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
            setError("Error al iniciar sesión");
        }
      } else {
        setError(err.message || "Error desconocido");
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
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
  );
}
