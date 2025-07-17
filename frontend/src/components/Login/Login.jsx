import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebase"; // ✅ correcta



function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // ✅ Autenticación Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();

      // ✅ Llamada al backend para obtener perfil
      const res = await fetch("http://localhost:8000/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Fallo al obtener usuario");

      const data = await res.json();

      // ✅ Guardar en localStorage
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(data));

      console.log("🔐 Usuario autenticado:", data);

      const role = data.role;
      if (role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/user/dashboard");
      }

    } catch (err) {
      console.error("❌ Error al iniciar sesión", err);
      setError("Correo o contraseña inválidos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cabra-black text-white px-4">
      <div className="bg-cabra-dark p-8 rounded-xl shadow-xl w-full max-w-md border border-cabra-purple">
        <h1 className="text-3xl font-bold mb-2 text-cabra-purple text-center tracking-wider">
          La Cabra 990
        </h1>
        <h2 className="text-lg font-semibold mb-6 text-center text-cabra-steel">
          Iniciar sesión
        </h2>

        <div className="mb-4">
          <label className="block text-sm mb-1 text-cabra-steel">Correo</label>
          <input
            type="email"
            className="w-full px-3 py-2 bg-cabra-gray text-white border border-cabra-steel rounded-lg focus:outline-none focus:ring-2 focus:ring-cabra-purple"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1 text-cabra-steel">
            Contraseña
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 bg-cabra-gray text-white border border-cabra-steel rounded-lg focus:outline-none focus:ring-2 focus:ring-cabra-purple"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-cabra-purple hover:bg-cabra-purple-dark py-2 rounded-lg font-semibold tracking-wide transition-colors duration-200"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

export default Login;
