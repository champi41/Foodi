import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
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

// ── Helpers de horario (misma lógica que MenuPublico) ─────────
const checkHorario = (horarios) => {
  if (!horarios) return true; // sin horario configurado → siempre dentro de horario
  const ahora = new Date();
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  const h = horarios[dias[ahora.getDay()]];
  if (!h?.abierto) return false;
  const toMin = (t) => {
    if (!t) return 0;
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };
  const now = ahora.getHours() * 60 + ahora.getMinutes();
  if (now < toMin(h.inicio) || now > toMin(h.fin)) return false;
  if (h.descanso && now >= toMin(h.dInicio) && now <= toMin(h.dFin))
    return false;
  return true;
};

// Estado real = isOpen manual AND dentro del horario
const getEstadoReal = (isOpenManual, horarios) => {
  const dentroHorario = checkHorario(horarios);
  const operativo = isOpenManual && dentroHorario;
  return { operativo, dentroHorario };
};

// ── Componente ────────────────────────────────────────────────
const AdminLayout = ({ slug, user, businessId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams(); // slug del negocio para construir rutas

  const [negocioNombre, setNegocioNombre] = useState(slug);
  const [negocioLogo, setNegocioLogo] = useState("");
  const [isOpenManual, setIsOpenManual] = useState(false);
  const [horarios, setHorarios] = useState(null);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [datosBancarios, setDatosBancarios] = useState(null);
  const [pedidosHoy, setPedidosHoy] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [tickMinuto, setTickMinuto] = useState(0);

  const audioRef = useRef(
    typeof Audio !== "undefined" ? new Audio(SOUND_URL) : null,
  );
  const isFirstLoad = useRef(true);
  const alertTimeout = useRef(null);

  // Tick cada minuto para re-evaluar si el horario cambió
  useEffect(() => {
    const iv = setInterval(() => setTickMinuto((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Cargar negocio — nombre, logo, isOpen manual, horarios, datosBancarios
  useEffect(() => {
    if (!businessId) return;
    const fetchNegocio = async () => {
      const snap = await getDoc(doc(db, "negocios", businessId));
      if (snap.exists()) {
        const data = snap.data();
        setNegocioNombre(data.nombre || slug);
        setNegocioLogo(data.logo || "");
        setIsOpenManual(data.isOpen ?? false);
        setHorarios(data.horarios || null);
        setDatosBancarios(data.datosBancarios || null);
      }
    };
    fetchNegocio();
  }, [businessId]);

  // onSnapshot pedidos de hoy
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
        if (change.type === "added" && !isFirstLoad.current) hasNewOrder = true;
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
    if (location.pathname.includes("/pedidos")) {
      setNewOrderAlert(false);
      document.title = `${negocioNombre} · Admin`;
    }
  }, [location.pathname, negocioNombre]);

  // Toggle manual — solo escribe isOpen en Firestore
  // El estado real (operativo) se calcula combinando isOpen + horario localmente
  const handleToggleOpen = async () => {
    setTogglingOpen(true);
    const nuevoValor = !isOpenManual;
    try {
      await updateDoc(doc(db, "negocios", businessId), { isOpen: nuevoValor });
      setIsOpenManual(nuevoValor);
    } catch (e) {
      console.error("Error toggling isOpen:", e);
    }
    setTogglingOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate(`/${slug}/login`);
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

  // Estado combinado — se recalcula en cada render y en cada tickMinuto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { operativo, dentroHorario } = getEstadoReal(isOpenManual, horarios);

  const estadoTexto = () => {
    if (operativo) return "Abierto";
    if (!isOpenManual) return "Cerrado manualmente";
    if (!dentroHorario) return "Fuera de horario";
    return "Cerrado";
  };

  // Aviso cuando hay conflicto visible entre el toggle y el horario
  const estadoHint = () => {
    if (isOpenManual && !dentroHorario)
      return "Abierto en config, pero fuera del horario programado";
    if (!isOpenManual && dentroHorario && horarios)
      return "Dentro del horario, pero cerrado manualmente";
    return null;
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {/* ── BRAND ── */}
        <div className="sidebar-brand">
          {negocioLogo ? (
            <div className="brand-logo-wrap">
              <img
                src={negocioLogo}
                alt={negocioNombre}
                className="brand-logo"
              />
            </div>
          ) : (
            <div className="brand-icon">🍽️</div>
          )}
          <div className="brand-text">
            <span className="brand-name">{negocioNombre}</span>
            <span className="brand-sub">Panel Admin</span>
          </div>
        </div>

        {/* ── STATUS ── */}
        <div className="sidebar-status">
          <div
            className={`status-indicator ${operativo ? "status-open" : "status-closed"}`}
          >
            <span className="status-dot" />
            <span className="status-text">{estadoTexto()}</span>
          </div>

          {estadoHint() && <p className="status-hint">{estadoHint()}</p>}

          <button
            className={`btn-toggle-open ${isOpenManual ? "btn-cerrar" : "btn-abrir"}`}
            onClick={handleToggleOpen}
            disabled={togglingOpen}
          >
            {togglingOpen
              ? "..."
              : isOpenManual
                ? "Cerrar manual"
                : "Abrir manual"}
          </button>

          {horarios && (
            <div
              className={`horario-pill ${dentroHorario ? "horario-pill--dentro" : "horario-pill--fuera"}`}
            >
              🕐 {dentroHorario ? "Dentro de horario" : "Fuera de horario"}
            </div>
          )}
        </div>

        {/* ── NAV ── */}
        <nav className="sidebar-nav">
          <NavLink
            to={`/${slug}/admin/pedidos`}
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
            to={`/${slug}/admin/platillos`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <UtensilsCrossed size={18} />
            <span>Platillos</span>
          </NavLink>

          <NavLink
            to={`/${slug}/admin/configuracion`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <Settings size={18} />
            <span>Configuración</span>
          </NavLink>
        </nav>

        {/* ── FOOTER ── */}
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
