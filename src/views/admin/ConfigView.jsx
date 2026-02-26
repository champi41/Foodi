import React, { useState, useEffect, useRef } from "react";
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

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ── Paleta en dos grupos — cualquier color es elegible sin importar el tema activo ──
const ACENTOS_DARK = [
  { hex: "#ffb347", label: "Ámbar" },
  { hex: "#ff6b6b", label: "Coral" },
  { hex: "#f472b6", label: "Rosa" },
  { hex: "#a78bfa", label: "Lavanda" },
  { hex: "#60a5fa", label: "Azul" },
  { hex: "#34d399", label: "Menta" },
  { hex: "#fb923c", label: "Naranja" },
  { hex: "#e879f9", label: "Violeta" },
];

const ACENTOS_LIGHT = [
  { hex: "#b45309", label: "Miel" },
  { hex: "#dc2626", label: "Rojo" },
  { hex: "#9333ea", label: "Púrpura" },
  { hex: "#1d4ed8", label: "Marino" },
  { hex: "#0891b2", label: "Cian" },
  { hex: "#15803d", label: "Verde" },
  { hex: "#c2410c", label: "Teja" },
  { hex: "#0f172a", label: "Grafito" },
];

// Colores oscuros del grupo light — el check necesita ser blanco sobre ellos
const ACENTOS_LIGHT_HEX = new Set(ACENTOS_LIGHT.map((a) => a.hex));

const CONFIG_INICIAL = {
  nombre: "",
  ubicacion: "",
  whatsapp: "",
  logo: "",
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
  tema: { modo: "dark", acento: "#ffb347" },
};

// Devuelve true si el hex pertenece a la paleta predefinida (para marcar el swatch activo)
const esPaletaPredef = (hex) =>
  ACENTOS_DARK.some((a) => a.hex === hex) ||
  ACENTOS_LIGHT.some((a) => a.hex === hex);

export const ConfigView = ({ businessId }) => {
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nuevaZona, setNuevaZona] = useState({ nombre: "", precio: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  // El color del picker se inicializa con el acento actual si es personalizado
  const [pickerColor, setPickerColor] = useState("#ffb347");

  const logoInputRef = useRef(null);
  const tenantId = businessId || auth.currentUser?.uid;

  useEffect(() => {
    if (tenantId) fetchConfig();
  }, [tenantId]);

  const fetchConfig = async () => {
    try {
      const snap = await getDoc(doc(db, "negocios", tenantId));
      if (snap.exists()) {
        const data = snap.data();
        const merged = {
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
          logo: data.logo || "",
        };
        setConfig(merged);
        // Si el acento guardado es personalizado, precargar el picker con ese valor
        if (merged.tema?.acento && !esPaletaPredef(merged.tema.acento)) {
          setPickerColor(merged.tema.acento);
        }
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

  // ── Upload logo a Cloudinary ──
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");

    if (!file.type.startsWith("image/")) {
      setLogoError("El archivo debe ser una imagen.");
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "logos");

      const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData },
      );
      const data = await resp.json();

      if (data.secure_url) {
        setConfig((p) => ({ ...p, logo: data.secure_url }));
      } else {
        setLogoError("No se pudo subir la imagen. Intenta de nuevo.");
      }
    } catch (err) {
      console.error(err);
      setLogoError("Error al subir la imagen.");
    }
    setUploadingLogo(false);
    // Resetear input para permitir subir la misma imagen de nuevo
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleQuitarLogo = () => {
    setConfig((p) => ({ ...p, logo: "" }));
    setLogoError("");
  };

  // ── Helpers de config ──
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

  // Preview del tema
  const previewBg = config.tema.modo === "dark" ? "#111110" : "#fafaf8";
  const previewCard = config.tema.modo === "dark" ? "#1e1e1c" : "#ffffff";
  const previewText = config.tema.modo === "dark" ? "#f0ece4" : "#1a1a18";
  const previewMuted = config.tema.modo === "dark" ? "#666" : "#999";
  const previewBorder =
    config.tema.modo === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const acento = config.tema.acento;

  // El color activo es personalizado cuando no está en ninguna paleta predefinida
  const esColorPersonalizado = !esPaletaPredef(acento);

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
              type="text"
            />
          </div>
          <div className="config-row">
            <label>Direccion</label>
            <input
              value={config.ubicacion}
              onChange={(e) =>
                setConfig((p) => ({ ...p, ubicacion: e.target.value }))
              }
              type="text"
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
              type="tel"
            />
          </div>
        </section>

        {/* ── LOGO ── */}
        <section className="config-section">
          <h2>Logo del Local</h2>
          <p className="config-hint">
            Se muestra en el encabezado del menú público y en el panel de
            administración. Formatos recomendados: PNG o SVG con fondo
            transparente.
          </p>

          {/* Zona de upload */}
          <div className="logo-upload-zone">
            {config.logo ? (
              /* Preview cuando ya hay logo */
              <div className="logo-preview">
                <div className="logo-preview__img-wrap">
                  <img
                    src={config.logo}
                    alt="Logo actual"
                    className="logo-preview__img"
                  />
                </div>
                <div className="logo-preview__actions">
                  <button
                    type="button"
                    className="logo-btn logo-btn--change"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? "Subiendo…" : "Cambiar logo"}
                  </button>
                  <button
                    type="button"
                    className="logo-btn logo-btn--remove"
                    onClick={handleQuitarLogo}
                    disabled={uploadingLogo}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ) : (
              /* Estado vacío */
              <button
                type="button"
                className={`logo-drop ${uploadingLogo ? "logo-drop--loading" : ""}`}
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <>
                    <span className="logo-drop__spinner" />
                    <span>Subiendo imagen…</span>
                  </>
                ) : (
                  <>
                    <span className="logo-drop__icon">🖼</span>
                    <span className="logo-drop__text">Subir logo</span>
                    <span className="logo-drop__hint">PNG, JPG o SVG</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoChange}
            />
          </div>

          {logoError && <p className="logo-error">{logoError}</p>}
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

          {/* Paleta de acentos en dos grupos */}
          <div className="config-row">
            <label>Color de acento</label>
            <p
              className="config-hint"
              style={{ marginTop: 0, marginBottom: 14 }}
            >
              Se aplica a botones, precios y detalles destacados. Puedes usar
              cualquier color sin importar el tema elegido.
            </p>

            {/* Grupo oscuro */}
            <div className="acento-grupo">
              <span className="acento-grupo__label">
                🌙 Ideales para tema oscuro
              </span>
              <div className="acento-grid">
                {ACENTOS_DARK.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    className={`acento-swatch ${acento === hex ? "acento-swatch--active" : ""}`}
                    style={{ "--swatch-color": hex }}
                    onClick={() => setTema("acento", hex)}
                    title={label}
                  >
                    {acento === hex && (
                      <span
                        className="acento-swatch__check"
                        style={{ color: "#111" }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Grupo claro */}
            <div className="acento-grupo">
              <span className="acento-grupo__label">
                ☀️ Ideales para tema claro
              </span>
              <div className="acento-grid">
                {ACENTOS_LIGHT.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    className={`acento-swatch ${acento === hex ? "acento-swatch--active" : ""}`}
                    style={{ "--swatch-color": hex }}
                    onClick={() => setTema("acento", hex)}
                    title={label}
                  >
                    {acento === hex && (
                      <span
                        className="acento-swatch__check"
                        style={{ color: "#fff" }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Color personalizado */}
            <div
              className={`acento-custom ${esColorPersonalizado ? "acento-custom--active" : ""}`}
            >
              <div className="acento-custom__header">
                <span className="acento-custom__title">
                  🎨 Color personalizado
                </span>
                {esColorPersonalizado && (
                  <span className="acento-custom__badge">Activo</span>
                )}
              </div>
              <div className="acento-custom__warning">
                ⚠️ Una mala elección de color puede dificultar la lectura del
                menú. Asegúrate de que el color tenga suficiente contraste sobre
                el fondo del tema elegido.
              </div>
              <div className="acento-custom__row">
                {/* Muestra el color elegido como swatch visual */}
                <div
                  className="acento-custom__current"
                  style={{ background: pickerColor }}
                  title="Color actual del picker"
                />
                <input
                  type="color"
                  className="acento-custom__picker"
                  value={pickerColor}
                  onChange={(e) => {
                    setPickerColor(e.target.value);
                    setTema("acento", e.target.value);
                  }}
                />
                <span className="acento-custom__hex">
                  {pickerColor.toUpperCase()}
                </span>
                <button
                  type="button"
                  className="acento-custom__apply"
                  onClick={() => setTema("acento", pickerColor)}
                >
                  Usar este color
                </button>
              </div>
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
            {/* Mini header con logo si existe */}
            {config.logo && (
              <div
                className="tema-preview__header"
                style={{ borderBottom: `1px solid ${previewBorder}` }}
              >
                <img
                  src={config.logo}
                  alt="Logo"
                  className="tema-preview__logo"
                />
                <span
                  className="tema-preview__biz-name"
                  style={{ color: previewText }}
                >
                  {config.nombre || "Tu restaurante"}
                </span>
              </div>
            )}
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
                    {config.logo
                      ? "Nombre del producto"
                      : config.nombre || "Tu restaurante"}
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
