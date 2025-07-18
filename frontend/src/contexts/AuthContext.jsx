import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { auditAPI, setAuthToken } from "../services/api";

const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000;
const TOKEN_WARNING_THRESHOLD = 5 * 60 * 1000;

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [tokenExpiring, setTokenExpiring] = useState(false);

  const refreshTokenAndClaims = async (user, forceRefresh = false) => {
    try {
      if (!user) throw new Error("Usuario no proporcionado");

      const token = await user.getIdToken(forceRefresh);
      const tokenResult = await user.getIdTokenResult();
      const customClaims = tokenResult.claims;

      setIdToken(token);
      setIsAdmin(Boolean(customClaims?.admin));
      localStorage.setItem("idToken", token);
      localStorage.setItem("userClaims", JSON.stringify(customClaims));
      setAuthToken(token); // ✅ Este es el punto clave para las peticiones con token

      const expirationTime = tokenResult.expirationTime;
      const timeUntilExpiration = new Date(expirationTime).getTime() - Date.now();
      setTokenExpiring(timeUntilExpiration <= TOKEN_WARNING_THRESHOLD);

      return token;
    } catch (error) {
      console.error("Error al renovar token:", error);
      setAuthError("Error al renovar credenciales");
      throw error;
    }
  };

  const getIdToken = async (forceRefresh = false) => {
    try {
      if (!currentUser) return null;
      const token = await currentUser.getIdToken(forceRefresh);
      setIdToken(token);
      localStorage.setItem("idToken", token);
      setAuthToken(token); // ✅ Actualiza token en Axios
      return token;
    } catch (error) {
      console.error("Error al obtener token ID:", error);
      setAuthError("Error al obtener credenciales");
      return null;
    }
  };

  const getFreshToken = useCallback(() => getIdToken(true), [currentUser]);

  const logAuditEvent = async (eventType, details = {}, severity = "INFO") => {
    try {
      await auditAPI.logEvent(eventType, {
        ...details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ipAddress: "client-side",
      }, severity);
    } catch (error) {
      console.warn(`Error al registrar evento: ${eventType}`, error);
    }
  };

  const signup = async (email, password, additionalInfo = {}) => {
    try {
      setLoading(true);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      if (additionalInfo.displayName) {
        await updateProfile(user, { displayName: additionalInfo.displayName });
      }

      await refreshTokenAndClaims(user, true);
      await logAuditEvent("AUTHENTICATION", {
        action: "SIGNUP",
        email: user.email,
        userId: user.uid,
        success: true,
      });

      return user;
    } catch (error) {
      await logAuditEvent("AUTHENTICATION", {
        action: "SIGNUP_FAILED",
        email,
        error: error.code,
        success: false,
      }, "WARNING");
      setAuthError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      await refreshTokenAndClaims(user, true);
      await logAuditEvent("AUTHENTICATION", {
        action: "LOGIN",
        email: user.email,
        userId: user.uid,
        success: true,
      });

      return user;
    } catch (error) {
      await logAuditEvent("AUTHENTICATION", {
        action: "LOGIN_FAILED",
        email,
        error: error.code,
        success: false,
      }, "WARNING");
      setAuthError(getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      if (currentUser) {
        await logAuditEvent("AUTHENTICATION", {
          action: "LOGOUT",
          email: currentUser.email,
          userId: currentUser.uid,
          success: true,
        });
      }
      await signOut(auth);
      setCurrentUser(null);
      setIdToken(null);
      setIsAdmin(false);
      setUserProfile(null);
      setAuthError(null);
      setTokenExpiring(false);
      setAuthToken(null); // ✅ Limpia el token del cliente Axios
      localStorage.clear();
    } catch (error) {
      await logAuditEvent("AUTHENTICATION", {
        action: "LOGOUT_FAILED",
        error: error.code,
        success: false,
      }, "ERROR");
      setAuthError("Error al cerrar sesión");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      if (!currentUser) throw new Error("No hay usuario autenticado");
      await updateProfile(currentUser, profileData);
      setUserProfile((prev) => ({ ...prev, ...profileData }));
      localStorage.setItem("userProfile", JSON.stringify({ ...userProfile, ...profileData }));
      await logAuditEvent("USER_PROFILE", {
        action: "PROFILE_UPDATED",
        userId: currentUser.uid,
        updatedFields: Object.keys(profileData),
      });
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      setAuthError("Error al actualizar perfil");
      throw error;
    }
  };

  const getErrorMessage = (error) => {
    const errorMessages = {
      "auth/user-not-found": "Usuario no encontrado",
      "auth/wrong-password": "Contraseña incorrecta",
      "auth/email-already-in-use": "El email ya está en uso",
      "auth/weak-password": "Contraseña débil",
      "auth/invalid-email": "Email inválido",
      "auth/user-disabled": "Cuenta deshabilitada",
      "auth/too-many-requests": "Demasiados intentos. Intenta luego",
      "auth/network-request-failed": "Error de red",
    };
    return errorMessages[error.code] || error.message || "Error desconocido";
  };

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await refreshTokenAndClaims(user);
        const savedProfile = localStorage.getItem("userProfile");
        if (savedProfile) {
          try {
            setUserProfile(JSON.parse(savedProfile));
          } catch {}
        }
      } else {
        setIdToken(null);
        setIsAdmin(false);
        setUserProfile(null);
        setAuthError(null);
        setTokenExpiring(false);
        localStorage.clear();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      getIdToken(true);
    }, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!idToken || !currentUser) return;
    const interval = setInterval(async () => {
      const tokenResult = await currentUser.getIdTokenResult();
      const exp = new Date(tokenResult.expirationTime).getTime() - Date.now();
      setTokenExpiring(exp <= TOKEN_WARNING_THRESHOLD);
    }, 60000);
    return () => clearInterval(interval);
  }, [idToken, currentUser]);

  const contextValue = useMemo(
    () => ({
      currentUser,
      idToken,
      isAdmin,
      loading,
      userProfile,
      authError,
      tokenExpiring,
      signup,
      login,
      logout,
      updateUserProfile,
      getFreshToken,
      getIdToken: () => getIdToken(false),
      refreshToken: () => getIdToken(true),
      clearAuthError,
      isAuthenticated: !!currentUser,
      hasValidToken: !!idToken,
      userRole: isAdmin ? "admin" : "user",
    }),
    [
      currentUser,
      idToken,
      isAdmin,
      loading,
      userProfile,
      authError,
      tokenExpiring,
      getFreshToken,
    ]
  );

  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner">
          <div className="spinner">⏳</div>
          <p>Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
