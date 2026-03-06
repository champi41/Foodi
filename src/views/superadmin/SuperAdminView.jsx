import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { db, auth } from "../../api/firebase";
import "./SuperAdminView.css";

// ── Tu UID — solo tú puedes acceder ──────────────────────────────
const SUPER_ADMIN_UID = import.meta.env.VITE_SUPER_ADMIN_UID;

// ── Helpers ──────────────────────────────────────────────────────
const PLANES = ["basico", "estandar", "premium"];

const PLAN_LABEL = {
  basico: { label: "Básico", color: "#94a3b8" },
  estandar: { label: "Estándar", color: "#60a5fa" },
  premium: { label: "Premium", color: "#f59e0b" },
};

const calcEstado = (sus) => {
  if (!sus?.fechaFin) return "sin_plan";
  const ahora = new Date();
  const fin = sus.fechaFin.toDate?.() ?? new Date(sus.fechaFin);
  const gracia =
    sus.fechaGracia?.toDate?.() ?? new Date(sus.fechaGracia ?? fin);
  if (ahora < fin) return "activo";
  if (ahora < gracia) return "gracia";
  return "vencido";
};

const diasRestantes = (sus) => {
  if (!sus?.fechaFin) return null;
  const fin = sus.fechaFin.toDate?.() ?? new Date(sus.fechaFin);
  const diff = Math.ceil((fin - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const fmtFecha = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .trim();

const ESTADO_BADGE = {
  activo: { label: "Activo", cls: "badge--activo" },
  gracia: { label: "Período gracia", cls: "badge--gracia" },
  vencido: { label: "Vencido", cls: "badge--vencido" },
  sin_plan: { label: "Sin plan", cls: "badge--sinplan" },
};

// ── Modal de extensión / cambio de plan ─────────────────────────
const ModalPlan = ({ negocio, onClose, onSaved }) => {
  const sus = negocio.suscripcion ?? {};
  const [plan, setPlan] = useState(sus.plan ?? "estandar");
  const [meses, setMeses] = useState(1);
  const [metodo, setMetodo] = useState("transferencia");
  const [monto, setMonto] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const ahora = new Date();
      // Fecha base: si ya tiene fechaFin en el futuro, extender desde ahí
      const fechaBase = sus.fechaFin
        ? (() => {
            const d = sus.fechaFin.toDate?.() ?? new Date(sus.fechaFin);
            return d > ahora ? d : ahora;
          })()
        : ahora;

      const fechaFin = new Date(fechaBase);
      fechaFin.setDate(fechaFin.getDate() + meses * 30);
      const fechaGracia = new Date(fechaFin);
      fechaGracia.setDate(fechaGracia.getDate() + 5);

      const suscripcion = {
        plan,
        estado: "activo",
        fechaInicio: sus.fechaInicio ?? Timestamp.fromDate(ahora),
        fechaFin: Timestamp.fromDate(fechaFin),
        fechaGracia: Timestamp.fromDate(fechaGracia),
        ultimoPago: monto
          ? {
              fecha: Timestamp.fromDate(ahora),
              monto: Number(monto),
              metodo,
              ref,
            }
          : (sus.ultimoPago ?? null),
      };

      await updateDoc(doc(db, "negocios", negocio.id), { suscripcion });
      onSaved({ ...negocio, suscripcion });
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="sa-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sa-modal">
        <div className="sa-modal__header">
          <div>
            <h3 className="sa-modal__title">Gestionar plan</h3>
            <p className="sa-modal__sub">{negocio.nombre || negocio.id}</p>
          </div>
          <button className="sa-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sa-modal__body">
          {/* Plan */}
          <div className="sa-field">
            <label className="sa-label">Plan</label>
            <div className="sa-plan-pills">
              {PLANES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`sa-plan-pill ${plan === p ? "sa-plan-pill--active" : ""}`}
                  style={
                    plan === p
                      ? {
                          borderColor: PLAN_LABEL[p].color,
                          color: PLAN_LABEL[p].color,
                        }
                      : {}
                  }
                  onClick={() => setPlan(p)}
                >
                  {PLAN_LABEL[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Meses a extender */}
          <div className="sa-field">
            <label className="sa-label">Extender por</label>
            <div className="sa-meses-pills">
              {[1, 2, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`sa-mes-pill ${meses === m ? "sa-mes-pill--active" : ""}`}
                  onClick={() => setMeses(m)}
                >
                  {m === 12 ? "1 año" : `${m} mes${m > 1 ? "es" : ""}`}
                </button>
              ))}
            </div>
            <p className="sa-hint">
              Nueva fecha de vencimiento:{" "}
              <strong>
                {(() => {
                  const ahora = new Date();
                  const base = sus.fechaFin
                    ? (() => {
                        const d =
                          sus.fechaFin.toDate?.() ?? new Date(sus.fechaFin);
                        return d > ahora ? d : ahora;
                      })()
                    : ahora;
                  const nueva = new Date(base);
                  nueva.setDate(nueva.getDate() + meses * 30);
                  return nueva.toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  });
                })()}
              </strong>
            </p>
          </div>

          {/* Pago (opcional) */}
          <div className="sa-field">
            <label className="sa-label">
              Registrar pago <span className="sa-optional">(opcional)</span>
            </label>
            <div className="sa-pago-grid">
              <div className="sa-input-wrap">
                <span className="sa-input-prefix">$</span>
                <input
                  type="number"
                  placeholder="Monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="sa-input"
                />
              </div>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="sa-select"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="otro">Otro</option>
              </select>
              <input
                placeholder="Referencia / comprobante"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className="sa-input sa-input--full"
              />
            </div>
          </div>
        </div>

        <div className="sa-modal__footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="sa-btn sa-btn--primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal de nuevo negocio ───────────────────────────────────────
const ModalNuevoNegocio = ({ onClose, onCreated }) => {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState("estandar");
  const [diasPrueba, setDias] = useState(14);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setError("Nombre, email y contraseña son obligatorios");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // 1. Crear usuario en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2. Calcular fechas
      const ahora = new Date();
      const fechaFin = new Date(ahora);
      fechaFin.setDate(fechaFin.getDate() + diasPrueba);
      const fechaGracia = new Date(fechaFin);
      fechaGracia.setDate(fechaGracia.getDate() + 5);

      const slug = slugify(nombre);

      // 3. Crear documento del negocio
      await setDoc(doc(db, "negocios", uid), {
        nombre,
        whatsapp,
        slug,
        logo: "",
        tema: { modo: "dark", acento: "#ffb347", fuente: "default" },
        tiposEntrega: { retiro: true, delivery: false },
        metodosPago: {
          efectivo: { activo: true, retiro: true, delivery: true },
          transferencia: { activo: true, retiro: true, delivery: true },
          tarjetaPresencial: { activo: false, retiro: true, delivery: false },
        },
        datosBancarios: {
          nombre: "",
          banco: "",
          tipoCuenta: "",
          nroCuenta: "",
          rut: "",
          emailComprobante: "",
        },
        horarios: {},
        suscripcion: {
          plan,
          estado: "activo",
          fechaInicio: Timestamp.fromDate(ahora),
          fechaFin: Timestamp.fromDate(fechaFin),
          fechaGracia: Timestamp.fromDate(fechaGracia),
          ultimoPago: null,
        },
        creadoEn: Timestamp.fromDate(ahora),
      });

      onCreated({ id: uid, nombre, slug, email, suscripcion: { plan } });
      onClose();
    } catch (e) {
      console.error(e);
      setError(
        e.code === "auth/email-already-in-use"
          ? "Ese email ya está registrado"
          : e.message,
      );
    }
    setSaving(false);
  };

  return (
    <div
      className="sa-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sa-modal">
        <div className="sa-modal__header">
          <div>
            <h3 className="sa-modal__title">Nuevo negocio</h3>
            <p className="sa-modal__sub">Crea cuenta y perfil en un paso</p>
          </div>
          <button className="sa-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="sa-modal__body">
          {error && <div className="sa-error">{error}</div>}

          <div className="sa-field">
            <label className="sa-label">Nombre del local *</label>
            <input
              className="sa-input"
              placeholder="Ej: Sushi Frutillar"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            {nombre && (
              <p className="sa-hint">
                Slug: <code>/{slugify(nombre)}</code>
              </p>
            )}
          </div>

          <div className="sa-field-row">
            <div className="sa-field">
              <label className="sa-label">Email *</label>
              <input
                className="sa-input"
                type="email"
                placeholder="dueño@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="sa-field">
              <label className="sa-label">Contraseña *</label>
              <input
                className="sa-input"
                type="password"
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="sa-field">
            <label className="sa-label">WhatsApp</label>
            <input
              className="sa-input"
              placeholder="+56912345678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>

          <div className="sa-field-row">
            <div className="sa-field">
              <label className="sa-label">Plan inicial</label>
              <div className="sa-plan-pills">
                {PLANES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`sa-plan-pill ${plan === p ? "sa-plan-pill--active" : ""}`}
                    style={
                      plan === p
                        ? {
                            borderColor: PLAN_LABEL[p].color,
                            color: PLAN_LABEL[p].color,
                          }
                        : {}
                    }
                    onClick={() => setPlan(p)}
                  >
                    {PLAN_LABEL[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sa-field">
              <label className="sa-label">Días de prueba</label>
              <div className="sa-meses-pills">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`sa-mes-pill ${diasPrueba === d ? "sa-mes-pill--active" : ""}`}
                    onClick={() => setDias(d)}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="sa-modal__footer">
          <button className="sa-btn sa-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="sa-btn sa-btn--primary"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Creando…" : "Crear negocio"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Login propio del superadmin ──────────────────────────────────
const LoginSuperAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Email o contraseña incorrectos");
    }
    setLoading(false);
  };

  return (
    <div className="sa-login-wrap">
      <div className="sa-login-box">
        <div className="sa-login-icon">⚡</div>
        <h1 className="sa-login-title">Super Admin</h1>
        <p className="sa-login-sub">Acceso restringido</p>
        <form onSubmit={handleLogin} className="sa-login-form">
          {error && <div className="sa-error">{error}</div>}
          <input
            className="sa-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            className="sa-input"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="sa-btn sa-btn--primary sa-btn--block"
            type="submit"
            disabled={loading}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── SuperAdminView ───────────────────────────────────────────────
export const SuperAdminView = ({ user }) => {
  const [negocios, setNegocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltro] = useState("todos");
  const [modalPlan, setModalPlan] = useState(null); // negocio seleccionado
  const [modalNuevo, setModalNuevo] = useState(false);

  // ── useEffect ANTES de los returns condicionales (Rules of Hooks) ──
  useEffect(() => {
    if (user && user.uid === SUPER_ADMIN_UID) fetchNegocios();
  }, [user]);

  // Guards — después de todos los hooks
  if (!user) return <LoginSuperAdmin />;

  if (user.uid !== SUPER_ADMIN_UID) {
    return (
      <div className="sa-forbidden">
        <span>⛔</span>
        <p>Acceso denegado</p>
        <button
          className="sa-btn sa-btn--ghost sa-btn--sm"
          onClick={() => signOut(auth)}
          style={{ marginTop: 12 }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  const fetchNegocios = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "negocios"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordenar: vencidos primero, luego por días restantes asc
      data.sort((a, b) => {
        const ea = calcEstado(a.suscripcion);
        const eb = calcEstado(b.suscripcion);
        const order = { vencido: 0, gracia: 1, sin_plan: 2, activo: 3 };
        if (order[ea] !== order[eb]) return order[ea] - order[eb];
        return (
          (diasRestantes(a.suscripcion) ?? 999) -
          (diasRestantes(b.suscripcion) ?? 999)
        );
      });
      setNegocios(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handlePlanSaved = (updated) => {
    setNegocios((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  // Métricas rápidas
  const stats = {
    total: negocios.length,
    activos: negocios.filter((n) => calcEstado(n.suscripcion) === "activo")
      .length,
    gracia: negocios.filter((n) => calcEstado(n.suscripcion) === "gracia")
      .length,
    vencidos: negocios.filter((n) =>
      ["vencido", "sin_plan"].includes(calcEstado(n.suscripcion)),
    ).length,
  };

  const filtered = negocios.filter((n) => {
    const matchSearch =
      !search ||
      (n.nombre ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (n.slug ?? "").toLowerCase().includes(search.toLowerCase());
    const estado = calcEstado(n.suscripcion);
    const matchEstado =
      filtroEstado === "todos" ||
      estado === filtroEstado ||
      (filtroEstado === "vencido" && estado === "sin_plan");
    return matchSearch && matchEstado;
  });

  return (
    <div className="sa-root">
      {/* ── Header ── */}
      <div className="sa-topbar">
        <div className="sa-topbar__left">
          <div>
            <h1 className="sa-topbar__title">MenuDash</h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="sa-btn sa-btn--ghost sa-btn--sm"
            onClick={() => signOut(auth)}
          >
            Salir
          </button>
          <button
            className="sa-btn sa-btn--primary"
            onClick={() => setModalNuevo(true)}
          >
            + Nuevo negocio
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="sa-stats">
        {[
          { label: "Total negocios", value: stats.total, accent: "#e2e8f0" },
          { label: "Activos", value: stats.activos, accent: "#4ade80" },
          { label: "En gracia", value: stats.gracia, accent: "#fb923c" },
          { label: "Vencidos", value: stats.vencidos, accent: "#f87171" },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="sa-stat-card"
            style={{ "--accent": accent }}
          >
            <span className="sa-stat-value">{value}</span>
            <span className="sa-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="sa-toolbar">
        <input
          className="sa-search"
          placeholder="Buscar por nombre o slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sa-filter-pills">
          {[
            { id: "todos", label: "Todos" },
            { id: "activo", label: "Activos" },
            { id: "gracia", label: "En gracia" },
            { id: "vencido", label: "Vencidos" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`sa-filter-pill ${filtroEstado === id ? "sa-filter-pill--active" : ""}`}
              onClick={() => setFiltro(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="sa-btn sa-btn--ghost sa-btn--sm"
          onClick={fetchNegocios}
        >
          ↺ Actualizar
        </button>
      </div>

      {/* ── Tabla ── */}
      {loading ? (
        <div className="sa-loading">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Vence</th>
                <th>Días</th>
                <th>Último pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="sa-table-empty">
                    Sin resultados
                  </td>
                </tr>
              )}
              {filtered.map((n) => {
                const sus = n.suscripcion ?? {};
                const estado = calcEstado(sus);
                const dias = diasRestantes(sus);
                const badge = ESTADO_BADGE[estado] ?? ESTADO_BADGE.sin_plan;
                const planInfo = PLAN_LABEL[sus.plan] ?? {
                  label: "—",
                  color: "#64748b",
                };

                return (
                  <tr
                    key={n.id}
                    className={
                      estado === "vencido"
                        ? "sa-row--vencido"
                        : estado === "gracia"
                          ? "sa-row--gracia"
                          : ""
                    }
                  >
                    <td>
                      <div className="sa-cell-nombre">
                        <span className="sa-nombre">
                          {n.nombre || "Sin nombre"}
                        </span>
                        <span className="sa-slug">
                          /{n.slug ?? n.id.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="sa-plan-tag"
                        style={{
                          color: planInfo.color,
                          borderColor: planInfo.color,
                        }}
                      >
                        {planInfo.label}
                      </span>
                    </td>
                    <td>
                      <span className={`sa-badge ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="sa-fecha">{fmtFecha(sus.fechaFin)}</td>
                    <td>
                      {dias !== null ? (
                        <span
                          className={`sa-dias ${dias <= 0 ? "sa-dias--vencido" : dias <= 5 ? "sa-dias--urgente" : ""}`}
                        >
                          {dias <= 0
                            ? `${Math.abs(dias)}d vencido`
                            : `${dias}d`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="sa-fecha">
                      {sus.ultimoPago ? (
                        <div className="sa-pago-cell">
                          <span>
                            ${sus.ultimoPago.monto?.toLocaleString("es-CL")}
                          </span>
                          <span className="sa-pago-metodo">
                            {sus.ultimoPago.metodo}
                          </span>
                        </div>
                      ) : (
                        <span className="sa-muted">Sin registro</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="sa-btn-accion"
                        onClick={() => setModalPlan(n)}
                      >
                        Gestionar →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modales ── */}
      {modalPlan && (
        <ModalPlan
          negocio={modalPlan}
          onClose={() => setModalPlan(null)}
          onSaved={handlePlanSaved}
        />
      )}
      {modalNuevo && (
        <ModalNuevoNegocio
          onClose={() => setModalNuevo(false)}
          onCreated={(n) => setNegocios((prev) => [n, ...prev])}
        />
      )}
    </div>
  );
};
