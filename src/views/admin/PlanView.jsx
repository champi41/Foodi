import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import "./PlanView.css";

const PLAN_INFO = {
  basico: {
    nombre: "Básico",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.08)",
    emoji: "🌱",
  },
  estandar: {
    nombre: "Estándar",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
    emoji: "⚡",
  },
};

const fmtFecha = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const calcDias = (ts) => {
  if (!ts) return null;
  const fin = ts.toDate?.() ?? new Date(ts);
  return Math.ceil((fin - new Date()) / (1000 * 60 * 60 * 24));
};

const BarraDias = ({ dias, total = 30 }) => {
  const pct = Math.max(0, Math.min(100, (dias / total) * 100));
  const color =
    dias <= 0
      ? "#f87171"
      : dias <= 5
        ? "#fb923c"
        : dias <= 10
          ? "#fbbf24"
          : "#4ade80";
  return (
    <div className="pv-barra-wrap">
      <div className="pv-barra-track">
        <div
          className="pv-barra-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="pv-barra-label" style={{ color }}>
        {dias <= 0 ? "Vencido" : `${dias} días restantes`}
      </span>
    </div>
  );
};

export const PlanView = ({ businessId }) => {
  const tenantId = businessId || auth.currentUser?.uid;
  const [sus, setSus] = useState(null);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);

  // Tu número de WhatsApp para renovaciones
  const WA_NUMERO = import.meta.env.VITE_ADMIN_WHATSAPP ?? "56900000000";

  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, "negocios", tenantId));
        if (snap.exists()) {
          const d = snap.data();
          setSus(d.suscripcion ?? null);
          setNombre(d.nombre ?? "");
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetch();
  }, [tenantId]);

  if (loading) return <div className="pv-loading">Cargando…</div>;

  const plan = sus?.plan ?? "basico";
  const info = PLAN_INFO[plan] ?? PLAN_INFO.basico;
  const dias = calcDias(sus?.fechaFin);
  const diasGracia = calcDias(sus?.fechaGracia);

  const ahora = new Date();
  const fechaFin = sus?.fechaFin?.toDate?.() ?? null;
  const fechaGracia = sus?.fechaGracia?.toDate?.() ?? null;

  const estado = (() => {
    if (!fechaFin) return "sin_plan";
    if (ahora < fechaFin) return "activo";
    if (fechaGracia && ahora < fechaGracia) return "gracia";
    return "vencido";
  })();

  const waMsg = encodeURIComponent(
    `Hola! Soy ${nombre}. Quiero renovar mi plan ${info.nombre}. ¿Cómo procedo?`,
  );
  const waLink = `https://wa.me/${WA_NUMERO}?text=${waMsg}`;

  const upgradeMsg = encodeURIComponent(
    `Hola! Soy ${nombre}. Me gustaría mejorar mi plan actual (${info.nombre}). ¿Qué opciones tienen?`,
  );
  const upgradeLink = `https://wa.me/${WA_NUMERO}?text=${upgradeMsg}`;

  return (
    <div className="pv-view">
      <div className="pv-header">
        <h1>Mi Plan</h1>
        <p className="pv-header__sub">Información de tu suscripción activa</p>
      </div>

      {/* ── Tarjeta principal del plan ── */}
      <div
        className="pv-card pv-card--plan"
        style={{ "--plan-color": info.color, "--plan-bg": info.bg }}
      >
        <div className="pv-plan-top">
          <div className="pv-plan-emoji">{info.emoji}</div>
          <div>
            <p className="pv-plan-label">Plan actual</p>
            <h2 className="pv-plan-nombre" style={{ color: info.color }}>
              {info.nombre}
            </h2>
          </div>
          <div className={`pv-estado-badge pv-estado--${estado}`}>
            {estado === "activo" && "✓ Activo"}
            {estado === "gracia" && "⚠ Período de gracia"}
            {estado === "vencido" && "✕ Vencido"}
            {estado === "sin_plan" && "Sin plan"}
          </div>
        </div>

        {/* Barra de tiempo restante */}
        {fechaFin && estado === "activo" && (
          <BarraDias dias={dias} total={30} />
        )}

        {/* Fechas */}
        <div className="pv-fechas">
          <div className="pv-fecha-item">
            <span className="pv-fecha-label">Inicio</span>
            <span className="pv-fecha-val">{fmtFecha(sus?.fechaInicio)}</span>
          </div>
          <div className="pv-fecha-sep">→</div>
          <div className="pv-fecha-item">
            <span className="pv-fecha-label">Vencimiento</span>
            <span className="pv-fecha-val">{fmtFecha(sus?.fechaFin)}</span>
          </div>
        </div>

        {/* Alerta de gracia */}
        {estado === "gracia" && (
          <div className="pv-alerta pv-alerta--gracia">
            <span>🟠</span>
            <p>
              Tu plan venció el {fmtFecha(sus?.fechaFin)}. Tienes hasta el{" "}
              <strong>{fmtFecha(sus?.fechaGracia)}</strong> ({diasGracia} días)
              antes de que el servicio se suspenda.
            </p>
          </div>
        )}

        {estado === "vencido" && (
          <div className="pv-alerta pv-alerta--vencido">
            <span>🔴</span>
            <p>Tu plan ha vencido. Renueva para seguir recibiendo pedidos.</p>
          </div>
        )}
      </div>

      {/* ── Último pago ── */}
      {sus?.ultimoPago && (
        <div className="pv-card">
          <h3 className="pv-card__title">Último pago registrado</h3>
          <div className="pv-pago-grid">
            <div className="pv-pago-item">
              <span className="pv-pago-label">Monto</span>
              <span className="pv-pago-val">
                ${sus.ultimoPago.monto?.toLocaleString("es-CL")}
              </span>
            </div>
            <div className="pv-pago-item">
              <span className="pv-pago-label">Método</span>
              <span
                className="pv-pago-val"
                style={{ textTransform: "capitalize" }}
              >
                {sus.ultimoPago.metodo}
              </span>
            </div>
            <div className="pv-pago-item">
              <span className="pv-pago-label">Fecha</span>
              <span className="pv-pago-val">
                {fmtFecha(sus.ultimoPago.fecha)}
              </span>
            </div>
            {sus.ultimoPago.ref && (
              <div className="pv-pago-item">
                <span className="pv-pago-label">Referencia</span>
                <span className="pv-pago-val pv-pago-ref">
                  {sus.ultimoPago.ref}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="pv-acciones">
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="pv-btn pv-btn--renovar"
        >
          <span>💬</span>
          Renovar plan por WhatsApp
        </a>
        {plan !== "premium" && (
          <a
            href={upgradeLink}
            target="_blank"
            rel="noreferrer"
            className="pv-btn pv-btn--upgrade"
          >
            <span>🚀</span>
            Mejorar mi plan
          </a>
        )}
      </div>

      {/* ── Info de planes ── */}
      <div className="pv-card pv-card--planes">
        <h3 className="pv-card__title">Planes disponibles</h3>
        <div className="pv-planes-grid">
          {Object.entries(PLAN_INFO).map(([key, p]) => (
            <div
              key={key}
              className={`pv-plan-card ${plan === key ? "pv-plan-card--actual" : ""}`}
              style={{ "--c": p.color }}
            >
              <span className="pv-plan-card__emoji">{p.emoji}</span>
              <span className="pv-plan-card__nombre">{p.nombre}</span>
              {plan === key && (
                <span className="pv-plan-card__badge">Tu plan</span>
              )}
            </div>
          ))}
        </div>
        <p className="pv-planes-hint">
          Para conocer los precios y características de cada plan, contáctanos
          por WhatsApp.
        </p>
      </div>
    </div>
  );
};
