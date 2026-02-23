import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import "./ConfigView.css";

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

// Paleta de acentos predefinidos — probados para legibilidad en fondo oscuro y claro
const ACENTOS = [
  { hex: "#ffb347", label: "Ámbar" },
  { hex: "#ff6b6b", label: "Coral" },
  { hex: "#f472b6", label: "Rosa" },
  { hex: "#a78bfa", label: "Lavanda" },
  { hex: "#60a5fa", label: "Azul" },
  { hex: "#34d399", label: "Menta" },
  { hex: "#4ade80", label: "Verde" },
  { hex: "#fb923c", label: "Naranja" },
  { hex: "#e879f9", label: "Violeta" },
  { hex: "#f8fafc", label: "Blanco" },
];

const CONFIG_INICIAL = {
  nombre: "",
  whatsapp: "",
  tiposEntrega: { retiro: true, delivery: false },
  metodosPago: {
    efectivo: { activo: true, retiro: true, delivery: true },
    transferencia: { activo: true, retiro: true, delivery: true },
    tarjetaPresencial: { activo: false, retiro: true, delivery: false },
  },
  zonasDelivery: [],
  datosBancarios: {
    nombre: "",
    banco: "",
    tipoCuenta: "",
    nroCuenta: "",
    rut: "",
    emailComprobante: "",
  },
  horarios: {
    lunes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    martes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    miercoles: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    jueves: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    viernes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    sabado: {
      abierto: true,
      inicio: "11:00",
      fin: "23:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    domingo: {
      abierto: false,
      inicio: "11:00",
      fin: "21:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
  },
  tema: {
    modo: "dark",
    acento: "#ffb347",
  },
};

export const ConfigView = ({ businessId }) => {
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nuevaZona, setNuevaZona] = useState({ nombre: "", precio: "" });

  const tenantId = businessId || auth.currentUser?.uid;

  useEffect(() => {
    if (tenantId) fetchConfig();
  }, [tenantId]);

  const fetchConfig = async () => {
    try {
      const snap = await getDoc(doc(db, "negocios", tenantId));
      if (snap.exists()) {
        const data = snap.data();
        setConfig((prev) => ({
          ...CONFIG_INICIAL,
          ...data,
          tiposEntrega: {
            ...CONFIG_INICIAL.tiposEntrega,
            ...data.tiposEntrega,
          },
          metodosPago: {
            efectivo: {
              ...CONFIG_INICIAL.metodosPago.efectivo,
              ...data.metodosPago?.efectivo,
            },
            transferencia: {
              ...CONFIG_INICIAL.metodosPago.transferencia,
              ...data.metodosPago?.transferencia,
            },
            tarjetaPresencial: {
              ...CONFIG_INICIAL.metodosPago.tarjetaPresencial,
              ...data.metodosPago?.tarjetaPresencial,
            },
          },
          zonasDelivery: data.zonasDelivery || [],
          datosBancarios: {
            ...CONFIG_INICIAL.datosBancarios,
            ...data.datosBancarios,
          },
          horarios: { ...CONFIG_INICIAL.horarios, ...data.horarios },
          tema: { ...CONFIG_INICIAL.tema, ...data.tema },
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "negocios", tenantId), config, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  const setEntrega = (tipo, valor) =>
    setConfig((p) => ({
      ...p,
      tiposEntrega: { ...p.tiposEntrega, [tipo]: valor },
    }));

  const setPago = (metodo, campo, valor) =>
    setConfig((p) => ({
      ...p,
      metodosPago: {
        ...p.metodosPago,
        [metodo]: { ...p.metodosPago[metodo], [campo]: valor },
      },
    }));

  const setHorario = (dia, campo, valor) =>
    setConfig((p) => ({
      ...p,
      horarios: {
        ...p.horarios,
        [dia]: { ...p.horarios[dia], [campo]: valor },
      },
    }));

  const setBancario = (campo, valor) =>
    setConfig((p) => ({
      ...p,
      datosBancarios: { ...p.datosBancarios, [campo]: valor },
    }));

  const setTema = (campo, valor) =>
    setConfig((p) => ({ ...p, tema: { ...p.tema, [campo]: valor } }));

  const agregarZona = () => {
    if (!nuevaZona.nombre.trim() || nuevaZona.precio === "") return;
    setConfig((p) => ({
      ...p,
      zonasDelivery: [
        ...p.zonasDelivery,
        { nombre: nuevaZona.nombre.trim(), precio: Number(nuevaZona.precio) },
      ],
    }));
    setNuevaZona({ nombre: "", precio: "" });
  };

  const eliminarZona = (idx) =>
    setConfig((p) => ({
      ...p,
      zonasDelivery: p.zonasDelivery.filter((_, i) => i !== idx),
    }));

  if (loading) return <div className="loading">Cargando configuración...</div>;

  const deliveryActivo = config.tiposEntrega.delivery;
  const retiroActivo = config.tiposEntrega.retiro;

  // Preview del tema en tiempo real para la sección de apariencia
  const previewBg = config.tema.modo === "dark" ? "#111110" : "#fafaf8";
  const previewCard = config.tema.modo === "dark" ? "#1e1e1c" : "#ffffff";
  const previewText = config.tema.modo === "dark" ? "#f0ece4" : "#1a1a18";
  const previewMuted = config.tema.modo === "dark" ? "#666" : "#999";
  const previewBorder =
    config.tema.modo === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const acento = config.tema.acento;

  return (
    <div className="config-view">
      <h1>Configuración del Local</h1>

      <form onSubmit={handleSave}>
        {/* ── INFO GENERAL ── */}
        <section className="config-section">
          <h2>Información General</h2>
          <div className="config-row">
            <label>Nombre del local</label>
            <input
              value={config.nombre}
              onChange={(e) =>
                setConfig((p) => ({ ...p, nombre: e.target.value }))
              }
              placeholder="Ej: Sushi Frutillar"
            />
          </div>
          <div className="config-row">
            <label>WhatsApp (con código país)</label>
            <input
              value={config.whatsapp}
              onChange={(e) =>
                setConfig((p) => ({ ...p, whatsapp: e.target.value }))
              }
              placeholder="+56912345678"
            />
          </div>
        </section>

        {/* ── APARIENCIA DEL MENÚ ── */}
        <section className="config-section">
          <h2>Apariencia del Menú</h2>
          <p className="config-hint">
            Elige el estilo visual que verán tus clientes al abrir el menú.
          </p>

          {/* Selector de modo */}
          <div className="config-row">
            <label>Tema</label>
            <div className="tema-toggle">
              <button
                type="button"
                className={`tema-btn ${config.tema.modo === "dark" ? "tema-btn--active" : ""}`}
                onClick={() => setTema("modo", "dark")}
              >
                <span className="tema-btn__preview tema-btn__preview--dark" />
                <span className="tema-btn__label">Oscuro</span>
                {config.tema.modo === "dark" && (
                  <span className="tema-btn__check">✓</span>
                )}
              </button>
              <button
                type="button"
                className={`tema-btn ${config.tema.modo === "light" ? "tema-btn--active" : ""}`}
                onClick={() => setTema("modo", "light")}
              >
                <span className="tema-btn__preview tema-btn__preview--light" />
                <span className="tema-btn__label">Claro</span>
                {config.tema.modo === "light" && (
                  <span className="tema-btn__check">✓</span>
                )}
              </button>
            </div>
          </div>

          {/* Selector de acento */}
          <div className="config-row">
            <label>Color de acento</label>
            <p
              className="config-hint"
              style={{ marginTop: 0, marginBottom: 10 }}
            >
              Se aplica a botones, precios y detalles destacados.
            </p>
            <div className="acento-grid">
              {ACENTOS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  className={`acento-swatch ${config.tema.acento === hex ? "acento-swatch--active" : ""}`}
                  style={{ "--swatch-color": hex }}
                  onClick={() => setTema("acento", hex)}
                  title={label}
                >
                  {config.tema.acento === hex && (
                    <span
                      className="acento-swatch__check"
                      // El check adapta su color según si el acento es claro u oscuro
                      style={{
                        color:
                          hex === "#f8fafc" ||
                          hex === "#4ade80" ||
                          hex === "#34d399"
                            ? "#111"
                            : "#fff",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview en vivo */}
          <div
            className="tema-preview"
            style={{
              background: previewBg,
              border: `1px solid ${previewBorder}`,
            }}
          >
            <p className="tema-preview__label">Vista previa</p>
            <div
              className="tema-preview__card"
              style={{
                background: previewCard,
                border: `1px solid ${previewBorder}`,
              }}
            >
              <div className="tema-preview__card-top">
                <div>
                  <p
                    className="tema-preview__name"
                    style={{ color: previewText }}
                  >
                    {config.nombre || "Tu restaurante"}
                  </p>
                  <p
                    className="tema-preview__sub"
                    style={{ color: previewMuted }}
                  >
                    Categoría
                  </p>
                </div>
                <span className="tema-preview__price" style={{ color: acento }}>
                  $9.990
                </span>
              </div>
              <div
                className="tema-preview__btn"
                style={{ background: acento, color: previewBg }}
              >
                Agregar →
              </div>
            </div>
            <div
              className="tema-preview__pill"
              style={{ background: acento, color: previewBg }}
            >
              Todo
            </div>
          </div>
        </section>

        {/* ── TIPOS DE ENTREGA ── */}
        <section className="config-section">
          <h2>Tipos de Entrega</h2>
          <p className="config-hint">
            Activa los tipos de entrega que ofrece tu local.
          </p>
          <div className="entrega-toggle-group">
            <div
              className={`entrega-card ${retiroActivo ? "active" : ""}`}
              onClick={() => setEntrega("retiro", !retiroActivo)}
            >
              <span className="entrega-icon">🏪</span>
              <span className="entrega-label">Retiro en Local</span>
              <span className={`entrega-badge ${retiroActivo ? "on" : "off"}`}>
                {retiroActivo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div
              className={`entrega-card ${deliveryActivo ? "active" : ""}`}
              onClick={() => setEntrega("delivery", !deliveryActivo)}
            >
              <span className="entrega-icon">🛵</span>
              <span className="entrega-label">Delivery</span>
              <span
                className={`entrega-badge ${deliveryActivo ? "on" : "off"}`}
              >
                {deliveryActivo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </section>

        {/* ── ZONAS DE DELIVERY ── */}
        {deliveryActivo && (
          <section className="config-section">
            <h2>Zonas de Delivery</h2>
            <p className="config-hint">
              Define sectores de tu ciudad con su precio de envío. El cliente
              elegirá su zona al hacer el pedido.
            </p>
            <div className="zonas-list">
              {config.zonasDelivery.length === 0 && (
                <p style={{ fontSize: 13, color: "#999" }}>
                  Sin zonas definidas aún.
                </p>
              )}
              {config.zonasDelivery.map((z, idx) => (
                <div key={idx} className="zona-row">
                  <span className="zona-nombre">{z.nombre}</span>
                  <span className="zona-precio">
                    ${z.precio.toLocaleString("es-CL")}
                  </span>
                  <button
                    type="button"
                    className="btn-delete-zona"
                    onClick={() => eliminarZona(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="zona-add-row">
              <input
                placeholder="Nombre sector (ej: Centro)"
                value={nuevaZona.nombre}
                onChange={(e) =>
                  setNuevaZona((p) => ({ ...p, nombre: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="$ Precio envío"
                value={nuevaZona.precio}
                onChange={(e) =>
                  setNuevaZona((p) => ({ ...p, precio: e.target.value }))
                }
              />
              <button
                type="button"
                className="btn-add-zona"
                onClick={agregarZona}
              >
                + Agregar
              </button>
            </div>
          </section>
        )}

        {/* ── MÉTODOS DE PAGO ── */}
        <section className="config-section">
          <h2>Métodos de Pago</h2>
          <p className="config-hint">
            Activa cada método y elige en qué tipo de entrega se acepta.
          </p>
          {[
            { key: "efectivo", label: "Efectivo", icon: "💵" },
            { key: "transferencia", label: "Transferencia", icon: "🏦" },
            { key: "tarjetaPresencial", label: "Tarjeta", icon: "💳" },
          ].map(({ key, label, icon }) => {
            const metodo = config.metodosPago[key];
            return (
              <div
                key={key}
                className={`pago-card ${metodo.activo ? "active" : ""}`}
              >
                <div className="pago-header">
                  <label className="pago-toggle">
                    <input
                      type="checkbox"
                      checked={metodo.activo}
                      onChange={(e) => setPago(key, "activo", e.target.checked)}
                    />
                    <span>
                      {icon} {label}
                    </span>
                  </label>
                </div>
                {metodo.activo && (
                  <div className="pago-entrega-opts">
                    <span className="pago-entrega-label">Disponible en:</span>
                    {retiroActivo && (
                      <label className="pago-check">
                        <input
                          type="checkbox"
                          checked={metodo.retiro}
                          onChange={(e) =>
                            setPago(key, "retiro", e.target.checked)
                          }
                        />
                        🏪 Retiro
                      </label>
                    )}
                    {deliveryActivo && (
                      <label className="pago-check">
                        <input
                          type="checkbox"
                          checked={metodo.delivery}
                          onChange={(e) =>
                            setPago(key, "delivery", e.target.checked)
                          }
                        />
                        🛵 Delivery
                      </label>
                    )}
                    {!retiroActivo && !deliveryActivo && (
                      <span style={{ fontSize: 12, color: "#999" }}>
                        Activa al menos un tipo de entrega
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── DATOS BANCARIOS ── */}
        {config.metodosPago.transferencia.activo && (
          <section className="config-section">
            <h2>Datos Bancarios</h2>
            <p className="config-hint">
              Se muestran al cliente cuando elige pagar por transferencia.
            </p>
            {[
              {
                campo: "nombre",
                placeholder: "Nombre del titular",
                type: "text",
              },
              {
                campo: "rut",
                placeholder: "RUT (ej: 12.345.678-9)",
                type: "text",
              },
              {
                campo: "banco",
                placeholder: "Banco (ej: BancoEstado)",
                type: "text",
              },
              {
                campo: "tipoCuenta",
                placeholder: "Tipo de cuenta (ej: Cuenta Vista)",
                type: "text",
              },
              {
                campo: "nroCuenta",
                placeholder: "Número de cuenta",
                type: "text",
              },
              {
                campo: "emailComprobante",
                placeholder: "Email para comprobantes",
                type: "email",
              },
            ].map(({ campo, placeholder, type }) => (
              <div className="config-row" key={campo}>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={config.datosBancarios[campo]}
                  onChange={(e) => setBancario(campo, e.target.value)}
                />
              </div>
            ))}
          </section>
        )}

        {/* ── HORARIOS ── */}
        <section className="config-section">
          <h2>Horarios de Atención</h2>
          <div className="horarios-grid">
            {DIAS.map((dia) => {
              const h = config.horarios[dia];
              return (
                <div
                  key={dia}
                  className={`horario-row ${!h.abierto ? "cerrado" : ""}`}
                >
                  <div className="horario-dia">
                    <label className="toggle-dia">
                      <input
                        type="checkbox"
                        checked={h.abierto}
                        onChange={(e) =>
                          setHorario(dia, "abierto", e.target.checked)
                        }
                      />
                      <span>{dia.charAt(0).toUpperCase() + dia.slice(1)}</span>
                    </label>
                  </div>
                  {h.abierto ? (
                    <div className="horario-times">
                      <input
                        type="time"
                        value={h.inicio}
                        onChange={(e) =>
                          setHorario(dia, "inicio", e.target.value)
                        }
                      />
                      <span>→</span>
                      <input
                        type="time"
                        value={h.fin}
                        onChange={(e) => setHorario(dia, "fin", e.target.value)}
                      />
                      <label className="descanso-toggle">
                        <input
                          type="checkbox"
                          checked={h.descanso}
                          onChange={(e) =>
                            setHorario(dia, "descanso", e.target.checked)
                          }
                        />
                        Descanso
                      </label>
                      {h.descanso && (
                        <>
                          <input
                            type="time"
                            value={h.dInicio}
                            onChange={(e) =>
                              setHorario(dia, "dInicio", e.target.value)
                            }
                          />
                          <span>→</span>
                          <input
                            type="time"
                            value={h.dFin}
                            onChange={(e) =>
                              setHorario(dia, "dFin", e.target.value)
                            }
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="cerrado-label">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button type="submit" className="btn-save-config" disabled={saving}>
          {saving
            ? "Guardando..."
            : saved
              ? "✓ Guardado"
              : "Guardar Configuración"}
        </button>
      </form>
    </div>
  );
};
