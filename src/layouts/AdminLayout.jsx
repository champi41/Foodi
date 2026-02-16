import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  UtensilsCrossed,
  Settings,
  LogOut,
  Store,
} from "lucide-react";
import { auth } from "../api/firebase";
import { signOut } from "firebase/auth";

const AdminLayout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="admin-container">
      {/* --- SIDEBAR IZQUIERDA --- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Store size={28} />
          <span>AdminPanel</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/admin/pedidos"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <ClipboardList size={20} />
            <span>Pedidos</span>
          </NavLink>

          <NavLink
            to="/admin/platillos"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <UtensilsCrossed size={20} />
            <span>Platillos</span>
          </NavLink>

          <NavLink
            to="/admin/configuracion"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <Settings size={20} />
            <span>Configuración</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* --- CONTENIDO DERECHA --- */}
      <main className="admin-content">
        <header className="content-header">
          {/* Aquí podrías poner el nombre del local dinámicamente más adelante */}
          <h2>Panel de Administración</h2>
        </header>

        <section className="view-container">
          {/* Aquí es donde se renderizan PedidosView, PlatillosView, etc. */}
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default AdminLayout;
