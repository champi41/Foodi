import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, UtensilsCrossed, Settings, LogOut } from "lucide-react";
import { auth, db } from "../api/firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  where,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import "./AdminLayout.css";

const SOUND_URL =
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const getHoyInicio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const AdminLayout = ({ slug, user, businessId }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [negocioNombre, setNegocioNombre] = useState(slug);
  const [isOpen, setIsOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [datosBancarios, setDatosBancarios] = useState(null);
  const [pedidosHoy, setPedidosHoy] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const audioRef = useRef(
    typeof Audio !== "undefined" ? new Audio(SOUND_URL) : null,
  );
  const isFirstLoad = useRef(true);
  const alertTimeout = useRef(null);

  // getDoc del negocio — una sola vez al montar
  // Trae nombre, isOpen y datosBancarios en una sola lectura
  useEffect(() => {
    if (!businessId) return;
    const fetchNegocio = async () => {
      const snap = await getDoc(doc(db, "negocios", businessId));
      if (snap.exists()) {
        const data = snap.data();
        setNegocioNombre(data.nombre || slug);
        setIsOpen(data.isOpen ?? false);
        setDatosBancarios(data.datosBancarios || null);
      }
    };
    fetchNegocio();
  }, [businessId]);

  // onSnapshot solo pedidos de hoy
  useEffect(() => {
    if (!businessId) return;

    const q = query(
      collection(db, `negocios/${businessId}/pedidos`),
      where("fecha", ">=", getHoyInicio()),
      orderBy("fecha", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let hasNewOrder = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !isFirstLoad.current) {
          hasNewOrder = true;
        }
      });

      const pedidosDeHoy = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setPedidosHoy(pedidosDeHoy);

      const pendientes = pedidosDeHoy.filter(
        (p) => p.estado === "pendiente",
      ).length;
      setPedidosPendientes(pendientes);

      if (hasNewOrder) {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        setNewOrderAlert(true);
        document.title = `🔴 ¡Nuevo pedido! — ${negocioNombre}`;
        if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

        clearTimeout(alertTimeout.current);
        alertTimeout.current = setTimeout(() => {
          setNewOrderAlert(false);
          document.title = `${negocioNombre} · Admin`;
        }, 8000);
      }

      isFirstLoad.current = false;
    });

    return () => {
      unsubscribe();
      clearTimeout(alertTimeout.current);
    };
  }, [businessId, negocioNombre]);

  useEffect(() => {
    if (location.pathname.includes("pedidos")) {
      setNewOrderAlert(false);
      document.title = `${negocioNombre} · Admin`;
    }
  }, [location.pathname, negocioNombre]);

  const handleToggleOpen = async () => {
    setTogglingOpen(true);
    try {
      await updateDoc(doc(db, "negocios", businessId), { isOpen: !isOpen });
      setIsOpen(!isOpen);
    } catch (e) {
      console.error("Error toggling isOpen:", e);
    }
    setTogglingOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleActivarSonido = () => {
    if (audioRef.current) {
      audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🍽️</div>
          <div className="brand-text">
            <span className="brand-name">{negocioNombre}</span>
            <span className="brand-sub">Panel Admin</span>
          </div>
        </div>

        <div className="sidebar-status">
          <div
            className={`status-indicator ${isOpen ? "status-open" : "status-closed"}`}
          >
            <span className="status-dot" />
            <span className="status-text">
              {isOpen ? "Abierto" : "Cerrado"}
            </span>
          </div>
          <button
            className={`btn-toggle-open ${isOpen ? "btn-cerrar" : "btn-abrir"}`}
            onClick={handleToggleOpen}
            disabled={togglingOpen}
          >
            {togglingOpen ? "..." : isOpen ? "Cerrar local" : "Abrir local"}
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/admin/pedidos"
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <ClipboardList size={18} />
            <span>Pedidos</span>
            {pedidosPendientes > 0 && (
              <span
                className={`nav-badge ${newOrderAlert ? "nav-badge-pulse" : ""}`}
              >
                {pedidosPendientes}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/admin/platillos"
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <UtensilsCrossed size={18} />
            <span>Platillos</span>
          </NavLink>

          <NavLink
            to="/admin/configuracion"
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <Settings size={18} />
            <span>Configuración</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn-sonido"
            onClick={handleActivarSonido}
            title="Activar audio"
          >
            🔊
          </button>
          <div className="sidebar-user">
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {newOrderAlert && (
          <div
            className="new-order-banner"
            onClick={() => navigate("/admin/pedidos")}
          >
            <span className="banner-dot" />
            <span>
              ¡Nuevo pedido recibido! — <strong>Ver pedidos</strong>
            </span>
            <button
              className="banner-close"
              onClick={(e) => {
                e.stopPropagation();
                setNewOrderAlert(false);
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="admin-content">
          <Outlet
            context={{
              businessId,
              pedidosHoy,
              pedidosPendientes,
              datosBancarios,
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
