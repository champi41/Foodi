import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./api/firebase";
import { getSubdomain } from "./utils/getSubdomain"; // Importamos la utilidad

// Vistas
import { MenuPublico } from "./views/public/MenuPublico";
import { Login } from "./views/auth/Login";
import AdminLayout from "./layouts/AdminLayout";
import { PedidosView } from "./views/admin/PedidosView";
import { PlatillosView } from "./views/admin/PlatillosView";
import { ConfigView } from "./views/admin/ConfigView";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Detectamos el slug de la URL una sola vez al cargar
  const slug = getSubdomain();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">Cargando...</div>;

  // SI NO HAY SUBDOMINIO (ej: entraste a lvh.me directamente)
  // Aquí podrías mostrar una landing page general.
  if (!slug) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h1>Bienvenido a Mi Plataforma</h1>
        <p>
          Por favor, accede desde el subdominio de tu local (ej:
          negocio1.lvh.me:5173)
        </p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 1. RUTA DEL CLIENTE (Ahora es la raíz del subdominio) */}
        {/* Si entras a pizzeria.lvh.me:5173/ verás esto */}
        <Route index element={<MenuPublico slug={slug} />} />

        {/* 2. AUTENTICACIÓN */}
        {/* pizzeria.lvh.me:5173/login */}
        <Route
          path="/login"
          element={
            !user ? <Login slug={slug} /> : <Navigate replace to="/admin" />
          }
        />

        {/* 3. RUTAS DE ADMINISTRACIÓN */}
        {/* pizzeria.lvh.me:5173/admin */}
        <Route
          path="/admin"
          element={
            user ? (
              <AdminLayout slug={slug} user={user} />
            ) : (
              <Navigate replace to="/login" />
            )
          }
        >
          <Route index element={<Navigate replace to="pedidos" />} />
          <Route path="pedidos" element={<PedidosView />} />
          <Route path="platillos" element={<PlatillosView />} />
          <Route path="configuracion" element={<ConfigView />} />
        </Route>

        {/* 4. 404 */}
        <Route
          path="*"
          element={
            <div>404 - No encontrado en este local</div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
