import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "./api/firebase";

// Vistas
import { MenuPublico } from "./views/public/MenuPublico";
import { Login } from "./views/auth/Login";
import AdminLayout from "./layouts/AdminLayout";
import { PedidosView } from "./views/admin/PedidosView";
import { PlatillosView } from "./views/admin/PlatillosView";
import { ConfigView } from "./views/admin/ConfigView";
import { PersonalizacionView } from "./views/admin/Personalizacionview";

// ── Wrapper que provee slug + businessId a las rutas anidadas ──
// Se monta dentro del contexto del Router, por lo que useParams funciona.
const NegocioRoutes = ({ user }) => {
  const { slug } = useParams();

  const [businessId, setBusinessId] = useState(null);
  const [businessLoading, setBusinessLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setBusinessLoading(false);
      return;
    }
    const fetch = async () => {
      const q = query(collection(db, "negocios"), where("slug", "==", slug));
      const snap = await getDocs(q);
      if (!snap.empty) setBusinessId(snap.docs[0].id);
      setBusinessLoading(false);
    };
    fetch();
  }, [slug]);

  if (businessLoading) return null; // o un spinner

  if (!businessId) return <div>404 — Local no encontrado</div>;

  const isOwner = user && businessId && user.uid === businessId;

  return (
    <Routes>
      {/* Menú público */}
      <Route index element={<MenuPublico slug={slug} />} />

      {/* Login */}
      <Route
        path="login"
        element={
          isOwner ? (
            <Navigate replace to={`/${slug}/admin`} />
          ) : (
            <Login slug={slug} />
          )
        }
      />

      {/* Admin */}
      <Route
        path="admin"
        element={
          isOwner ? (
            <AdminLayout slug={slug} user={user} businessId={businessId} />
          ) : (
            <Navigate replace to={`/${slug}/login`} />
          )
        }
      >
        <Route index element={<Navigate replace to="pedidos" />} />
        <Route path="pedidos" element={<PedidosView />} />
        <Route
          path="platillos"
          element={<PlatillosView businessId={businessId} />}
        />
        <Route
          path="apariencia"
          element={<PersonalizacionView businessId={businessId} />}
        />
        <Route
          path="configuracion"
          element={<ConfigView businessId={businessId} />}
        />
      </Route>

      {/* Cualquier otra subruta del slug */}
      <Route path="*" element={<div>404 — Página no encontrada</div>} />
    </Routes>
  );
};

// ── App principal ──────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) return null; // espera a saber si hay sesión antes de renderizar

  return (
    <Router>
      <Routes>
        {/* Raíz — podría ser una landing page o redirigir */}
        <Route index element={<div>Bienvenido a Vito</div>} />

        {/* Todas las rutas de un negocio viven bajo /:slug */}
        <Route path=":slug/*" element={<NegocioRoutes user={user} />} />

        {/* 404 global */}
        <Route path="*" element={<div>404 — Página no encontrada</div>} />
      </Routes>
    </Router>
  );
}

export default App;
