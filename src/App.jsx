import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { db } from "./api/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./api/firebase";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
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
  const [businessId, setBusinessId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [businessLoading, setBusinessLoading] = useState(true);

  const slug = getSubdomain();

  // 1. Escuchar auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Obtener el businessId del subdominio actual
  useEffect(() => {
    if (!slug) return;
    const fetchBusinessId = async () => {
      const q = query(collection(db, "negocios"), where("slug", "==", slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setBusinessId(snapshot.docs[0].id); // UID del dueño
      }
      setBusinessLoading(false);
    };
    fetchBusinessId();
  }, [slug]);
  
  // 3. El usuario logueado ES el dueño de este negocio?
  const isOwner = user && businessId && user.uid === businessId;

  return (
    <Router>
      <Routes>
        <Route index element={<MenuPublico slug={slug} />} />

        <Route
          path="/login"
          element={
            isOwner ? <Navigate replace to="/admin" /> : <Login slug={slug} />
          }
        />

        <Route
          path="/admin"
          element={
            isOwner ? (
              <AdminLayout slug={slug} user={user} businessId={businessId} />
            ) : (
              <Navigate replace to="/login" />
            )
          }
        >
          <Route index element={<Navigate replace to="pedidos" />} />
          <Route
            path="pedidos"
            element={<PedidosView/>}
          />
          <Route
            path="platillos"
            element={<PlatillosView businessId={businessId} />}
          />
          <Route
            path="configuracion"
            element={<ConfigView businessId={businessId} />}
          />
        </Route>

        <Route
          path="*"
          element={<div>404 - No encontrado en este local</div>}
        />
      </Routes>
    </Router>
  );
}

export default App;
