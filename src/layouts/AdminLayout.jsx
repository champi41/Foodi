import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  BarChart2,
  ClipboardList,
  UtensilsCrossed,
  ChefHat,
  Settings,
  Palette,
  LogOut,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
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

const SOUND_URL = "/sounds/noti.mp3";

const getHoyInicio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

// ── Helpers de horario ─────────────────────────────────────────
const checkHorario = (horarios) => {
  if (!horarios) return true;
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

const getEstadoReal = (isOpenManual, horarios) => {
  const dentroHorario = checkHorario(horarios);
  const operativo = isOpenManual && dentroHorario;
  return { operativo, dentroHorario };
};

// ── Helper suscripción ─────────────────────────────────────────
const calcAvisoSuscripcion = (suscripcion) => {
  if (!suscripcion?.fechaFin) return null;

  const ahora = new Date();
  const fechaFin =
    suscripcion.fechaFin.toDate?.() ?? new Date(suscripcion.fechaFin);
  const fechaGracia = suscripcion.fechaGracia?.toDate?.() ?? null;

  if (fechaGracia && ahora > fechaGracia) {
    return {
      tipo: "vencido",
      mensaje: "Tu plan ha vencido. El menú estará inaccesible pronto.",
    };
  }

  if (ahora > fechaFin) {
    const diasGracia = fechaGracia
      ? Math.ceil((fechaGracia - ahora) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      tipo: "gracia",
      mensaje: `Período de gracia: ${diasGracia} día${diasGracia !== 1 ? "s" : ""} para renovar antes de que el servicio se suspenda.`,
    };
  }

  const diasRestantes = Math.ceil((fechaFin - ahora) / (1000 * 60 * 60 * 24));
  if (diasRestantes <= 5) {
    return {
      tipo: "urgente",
      mensaje: `Tu plan vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}. Renueva para no interrumpir el servicio.`,
    };
  }
  if (diasRestantes <= 10) {
    return {
      tipo: "aviso",
      mensaje: `Tu plan vence en ${diasRestantes} días.`,
    };
  }

  return null;
};

// ── Componente ────────────────────────────────────────────────
const AdminLayout = ({ slug, user, businessId }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [negocioNombre, setNegocioNombre] = useState(slug);
  const [negocioLogo, setNegocioLogo] = useState("");
  const [negocio, setNegocio] = useState(null);
  const [isOpenManual, setIsOpenManual] = useState(false);
  const [horarios, setHorarios] = useState(null);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [datosBancarios, setDatosBancarios] = useState(null);
  const [pedidosHoy, setPedidosHoy] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState(0);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [tickMinuto, setTickMinuto] = useState(0);
  const [suscripcion, setSuscripcion] = useState(null);
  const [bannerSusDismissed, setBannerSusDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const audioRef = useRef(
    typeof Audio !== "undefined" ? new Audio(SOUND_URL) : null,
  );
  const isFirstLoad = useRef(true);
  const alertTimeout = useRef(null);

  // Tick cada minuto para re-evaluar horario
  useEffect(() => {
    const iv = setInterval(() => setTickMinuto((t) => t + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  // Cargar datos del negocio (público + privado para admin)
  useEffect(() => {
    if (!businessId) return;
    const fetchNegocio = async () => {
      const [snapPublico, snapPrivado] = await Promise.all([
        getDoc(doc(db, "negocios", businessId)),
        getDoc(doc(db, "negocios", businessId, "privado", "config")),
      ]);
      if (snapPublico.exists()) {
        const data = snapPublico.data();
        const privado = snapPrivado?.exists() ? snapPrivado.data() : {};
        const negocioCompleto = {
          id: snapPublico.id,
          ...data,
          ...privado,
          datosBancarios: privado.datosBancarios ?? data.datosBancarios ?? null,
          deliveryConfig: data.deliveryConfig
            ? {
                ...data.deliveryConfig,
                coordenadasLocal:
                  privado.coordenadasLocal ?? data.deliveryConfig.coordenadasLocal,
              }
            : null,
        };
        setNegocio(negocioCompleto);
        const nombre = data.nombre || slug;
        const logo = data.logo || "";
        setNegocioNombre(nombre);
        setNegocioLogo(logo);
        setIsOpenManual(data.isOpen ?? false);
        setHorarios(data.horarios || null);
        setDatosBancarios(negocioCompleto.datosBancarios || null);
        setSuscripcion(data.suscripcion || null);

        document.title = `${nombre} · Admin`;
        if (logo) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = logo;
        }
      }
    };
    fetchNegocio();
  }, [businessId]);

  // onSnapshot pedidos de hoy
  // FIX: solo alerta si el pedido nuevo es "pendiente" Y fue creado hace menos
  // de 30 segundos — evita que suene al cargar con pedidos finalizados del historial
  useEffect(() => {
    if (!businessId) return;

    const q = query(
      collection(db, `negocios/${businessId}/pedidos`),
      where("fecha", ">=", getHoyInicio()),
      orderBy("fecha", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let hasNewPendingOrder = false;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !isFirstLoad.current) {
          const data = change.doc.data();

          // Condición 1: debe ser pendiente
          const esPendiente = data.estado === "pendiente";

          // Condición 2: debe haber sido creado hace menos de 30 segundos
          // (filtra reconexiones, re-mounts y pedidos del historial)
          const fechaPedido = data.fecha?.toDate?.() ?? null;
          const esReciente = fechaPedido
            ? Date.now() - fechaPedido.getTime() < 30_000
            : false;

          if (esPendiente && esReciente) hasNewPendingOrder = true;
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

      if (hasNewPendingOrder) {
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

  // Evitar scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileMenuOpen]);

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

  const { operativo, dentroHorario } = getEstadoReal(isOpenManual, horarios);

  const estadoTexto = () => {
    if (operativo) return "Abierto";
    if (!isOpenManual) return "Cerrado manualmente";
    if (!dentroHorario) return "Fuera de horario";
    return "Cerrado";
  };

  const estadoHint = () => {
    if (isOpenManual && !dentroHorario)
      return "Abierto en config, pero fuera del horario programado";
    if (!isOpenManual && dentroHorario && horarios)
      return "Dentro del horario, pero cerrado manualmente";
    return null;
  };

  const avisoSuscripcion = calcAvisoSuscripcion(suscripcion);

  const WA_NUMERO = import.meta.env.VITE_ADMIN_WHATSAPP ?? "56900000000";
  const waRenovarLink = `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(
    `Hola, soy ${negocioNombre}. Quiero renovar mi plan.`,
  )}`;

  return (
    <div className="admin-shell">
      {/* Sidebar: solo visible en desktop */}
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
            to={`/${slug}/admin/ingredientes`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <ChefHat size={18} />
            <span>Ingredientes</span>
          </NavLink>

          <NavLink
            to={`/${slug}/admin/apariencia`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <Palette size={18} />
            <span>Apariencia</span>
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

          <NavLink
            to={`/${slug}/admin/informes`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <BarChart2 size={18} />
            <span>Informes</span>
          </NavLink>

          <NavLink
            to={`/${slug}/admin/plan`}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <CreditCard size={18} />
            <span>Mi Plan</span>
            {avisoSuscripcion && (
              <span
                className={`nav-dot-alerta nav-dot--${avisoSuscripcion.tipo}`}
              />
            )}
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

      {/* ── MÓVIL: barra superior ── */}
      <header className="admin-topbar-mobile">
        <button
          type="button"
          className="admin-topbar-menu-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>
        <div className="admin-topbar-brand">
          {negocioLogo ? (
            <img
              src={negocioLogo}
              alt=""
              className="admin-topbar-logo"
            />
          ) : (
            <span className="admin-topbar-emoji">🍽️</span>
          )}
          <span className="admin-topbar-name">{negocioNombre}</span>
        </div>
        <div className={`admin-topbar-status ${operativo ? "status-open" : "status-closed"}`}>
          <span className="status-dot" />
          <span className="admin-topbar-status-text">{estadoTexto()}</span>
        </div>
      </header>

      {/* ── MÓVIL: drawer (menú lateral) ── */}
      <div
        role="presentation"
        className={`admin-drawer-backdrop ${mobileMenuOpen ? "admin-drawer-backdrop-visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside className={`admin-drawer ${mobileMenuOpen ? "admin-drawer-open" : ""}`}>
        <div className="admin-drawer-header">
          <span className="admin-drawer-title">Menú</span>
          <button
            type="button"
            className="admin-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>
        <div className="admin-drawer-status">
          <div className={`status-indicator ${operativo ? "status-open" : "status-closed"}`}>
            <span className="status-dot" />
            <span className="status-text">{estadoTexto()}</span>
          </div>
          {estadoHint() && <p className="status-hint">{estadoHint()}</p>}
          <button
            className={`btn-toggle-open ${isOpenManual ? "btn-cerrar" : "btn-abrir"}`}
            onClick={handleToggleOpen}
            disabled={togglingOpen}
          >
            {togglingOpen ? "..." : isOpenManual ? "Cerrar manual" : "Abrir manual"}
          </button>
          {horarios && (
            <div className={`horario-pill ${dentroHorario ? "horario-pill--dentro" : "horario-pill--fuera"}`}>
              🕐 {dentroHorario ? "Dentro de horario" : "Fuera de horario"}
            </div>
          )}
        </div>
        <div className="admin-drawer-footer">
          <button
            type="button"
            className="btn-sonido"
            onClick={handleActivarSonido}
            title="Activar audio"
          >
            🔊 Sonido
          </button>
          <div className="sidebar-user">
            <span className="user-email">{user?.email}</span>
          </div>
          <button type="button" className="btn-logout" onClick={() => { setMobileMenuOpen(false); handleLogout(); }}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── MÓVIL: navegación inferior ── */}
      <nav className="admin-bottomnav">
        <NavLink
          to={`/${slug}/admin/pedidos`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <ClipboardList size={20} />
          <span>Pedidos</span>
          {pedidosPendientes > 0 && (
            <span className={`admin-bottomnav-badge ${newOrderAlert ? "nav-badge-pulse" : ""}`}>
              {pedidosPendientes}
            </span>
          )}
        </NavLink>
        <NavLink
          to={`/${slug}/admin/platillos`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <UtensilsCrossed size={20} />
          <span>Platillos</span>
        </NavLink>
        <NavLink
          to={`/${slug}/admin/ingredientes`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <ChefHat size={20} />
          <span>Ingred.</span>
        </NavLink>
        <NavLink
          to={`/${slug}/admin/apariencia`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <Palette size={20} />
          <span>Apariencia</span>
        </NavLink>
        <NavLink
          to={`/${slug}/admin/configuracion`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <Settings size={20} />
          <span>Config</span>
        </NavLink>
        <NavLink
          to={`/${slug}/admin/informes`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <BarChart2 size={20} />
          <span>Informes</span>
        </NavLink>
        <NavLink
          to={`/${slug}/admin/plan`}
          className={({ isActive }) =>
            `admin-bottomnav-item ${isActive ? "admin-bottomnav-item-active" : ""}`
          }
          onClick={() => setMobileMenuOpen(false)}
        >
          <CreditCard size={20} />
          <span>Plan</span>
          {avisoSuscripcion && (
            <span className={`nav-dot-alerta nav-dot--${avisoSuscripcion.tipo}`} />
          )}
        </NavLink>
      </nav>

      <main className="admin-main">
        {/* ── Banner aviso suscripción ── */}
        {avisoSuscripcion && !bannerSusDismissed && (
          <div
            className={`suscripcion-banner suscripcion-banner--${avisoSuscripcion.tipo}`}
          >
            <span className="suscripcion-banner__icon">
              {avisoSuscripcion.tipo === "vencido"
                ? "🔴"
                : avisoSuscripcion.tipo === "gracia"
                  ? "🟠"
                  : "🟡"}
            </span>
            <span className="suscripcion-banner__msg">
              {avisoSuscripcion.mensaje}
            </span>
            <a
              href={waRenovarLink}
              target="_blank"
              rel="noreferrer"
              className="suscripcion-banner__btn"
            >
              Renovar →
            </a>
            {/* No mostrar cierre en vencido/gracia — es crítico */}
            {(avisoSuscripcion.tipo === "aviso" ||
              avisoSuscripcion.tipo === "urgente") && (
              <button
                className="suscripcion-banner__close"
                onClick={() => setBannerSusDismissed(true)}
                title="Cerrar"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* ── Banner nuevo pedido ── */}
        {newOrderAlert && (
          <div
            className="new-order-banner"
            onClick={() => navigate(`/${slug}/admin/pedidos`)}
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
              negocio,
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
