import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import { FUENTES } from "../public/MenuPublico";
import "./Personalizacionview.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

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

const esPaletaPredef = (hex) =>
  ACENTOS_DARK.some((a) => a.hex === hex) ||
  ACENTOS_LIGHT.some((a) => a.hex === hex);

export const PersonalizacionView = ({ businessId }) => {
  const tenantId = businessId || auth.currentUser?.uid;

  const [nombre, setNombre] = useState("");
  const [logo, setLogo] = useState("");
  const [tema, setTemaState] = useState({
    modo: "dark",
    acento: "#ffb347",
    fuente: "default",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [pickerColor, setPickerColor] = useState("#ffb347");

  const logoInputRef = useRef(null);

  // Precarga todas las fuentes para el preview del selector
  useEffect(() => {
    FUENTES.forEach((f) => {
      const linkId = `cfg-gfont-${f.id}`;
      if (!document.getElementById(linkId)) {
        const link = document.createElement("link");
        link.id = linkId;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
        document.head.appendChild(link);
      }
    });
  }, []);

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    try {
      const snap = await getDoc(doc(db, "negocios", tenantId));
      if (snap.exists()) {
        const d = snap.data();
        const t = {
          modo: "dark",
          acento: "#ffb347",
          fuente: "default",
          ...d.tema,
        };
        setTemaState(t);
        setLogo(d.logo || "");
        setNombre(d.nombre || "");
        if (t.acento && !esPaletaPredef(t.acento)) setPickerColor(t.acento);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const setTema = (campo, valor) =>
    setTemaState((p) => ({ ...p, [campo]: valor }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Solo persiste los campos visuales — no toca horarios ni métodos de pago
      await setDoc(
        doc(db, "negocios", tenantId),
        { tema, logo },
        { merge: true },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

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
      if (data.secure_url) setLogo(data.secure_url);
      else setLogoError("No se pudo subir la imagen. Intenta de nuevo.");
    } catch (err) {
      console.error(err);
      setLogoError("Error al subir la imagen.");
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleQuitarLogo = () => {
    setLogo("");
    setLogoError("");
  };

  if (loading) return <div className="loading">Cargando...</div>;

  // ── Valores para el preview en vivo ──
  const previewBg = tema.modo === "dark" ? "#111110" : "#fafaf8";
  const previewCard = tema.modo === "dark" ? "#1e1e1c" : "#ffffff";
  const previewText = tema.modo === "dark" ? "#f0ece4" : "#1a1a18";
  const previewMuted = tema.modo === "dark" ? "#666" : "#999";
  const previewBorder =
    tema.modo === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const acento = tema.acento;
  const esColorPersonalizado = !esPaletaPredef(acento);
  const fuenteActiva =
    FUENTES.find((f) => f.id === (tema.fuente || "default")) ?? FUENTES[0];
  const fontDisplay = `'${fuenteActiva.display}', Georgia, serif`;
  const fontBody = `'${fuenteActiva.body}', sans-serif`;

  return (
    <div className="pv-view">
      <h1>Apariencia del Menú</h1>

      {/* ── LOGO ── */}
      <section className="config-section">
        <h2>Logo del Local</h2>
        <p className="config-hint">
          Se muestra en el encabezado del menú público y en el panel de
          administración. Formatos recomendados: PNG o SVG con fondo
          transparente.
        </p>
        <div className="logo-upload-zone">
          {logo ? (
            <div className="logo-preview">
              <div className="logo-preview__img-wrap">
                <img
                  src={logo}
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

      {/* ── APARIENCIA ── */}
      <section className="config-section">
        <h2>Apariencia del Menú</h2>
        <p className="config-hint">
          Elige el estilo visual que verán tus clientes al abrir el menú.
        </p>

        {/* Modo dark/light */}
        <div className="config-row">
          <label>Tema</label>
          <div className="tema-toggle">
            {[
              { id: "dark", label: "Oscuro" },
              { id: "light", label: "Claro" },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`tema-btn ${tema.modo === id ? "tema-btn--active" : ""}`}
                onClick={() => setTema("modo", id)}
              >
                <span
                  className={`tema-btn__preview tema-btn__preview--${id}`}
                />
                <span className="tema-btn__label">{label}</span>
                {tema.modo === id && <span className="tema-btn__check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Color de acento */}
        <div className="config-row">
          <label>Color de acento</label>
          <p className="config-hint" style={{ marginTop: 0, marginBottom: 14 }}>
            Se aplica a botones, precios y detalles destacados. Puedes usar
            cualquier color sin importar el tema elegido.
          </p>

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
              <div
                className="acento-custom__current"
                style={{ background: pickerColor }}
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

        {/* Tipografía */}
        <div className="config-row">
          <label>Tipografía del menú</label>
          <p className="config-hint" style={{ marginTop: 0, marginBottom: 14 }}>
            Define la personalidad visual del texto en tu menú público.
          </p>
          <div className="fuente-grid">
            {FUENTES.map((f) => {
              const activa = (tema?.fuente || "default") === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`fuente-card ${activa ? "fuente-card--active" : ""}`}
                  onClick={() => setTema("fuente", f.id)}
                >
                  <span
                    className="fuente-card__preview"
                    style={{ fontFamily: `'${f.display}', serif` }}
                  >
                    Aa
                  </span>
                  <span className="fuente-card__nombre">{f.nombre}</span>
                  <span className="fuente-card__desc">{f.desc}</span>
                  {activa && <span className="fuente-card__check">✓</span>}
                </button>
              );
            })}
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
          <p className="tema-preview__label">
            Vista previa · {fuenteActiva.nombre}
          </p>
          {logo && (
            <div
              className="tema-preview__header"
              style={{ borderBottom: `1px solid ${previewBorder}` }}
            >
              <img src={logo} alt="Logo" className="tema-preview__logo" />
              <span
                className="tema-preview__biz-name"
                style={{ color: previewText, fontFamily: fontDisplay }}
              >
                {nombre || "Tu restaurante"}
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
                  style={{ color: previewText, fontFamily: fontDisplay }}
                >
                  {logo ? "Nombre del producto" : nombre || "Tu restaurante"}
                </p>
                <p
                  className="tema-preview__sub"
                  style={{ color: previewMuted, fontFamily: fontBody }}
                >
                  Categoría
                </p>
              </div>
              <span
                className="tema-preview__price"
                style={{ color: acento, fontFamily: fontDisplay }}
              >
                $9.990
              </span>
            </div>
            <div
              className="tema-preview__btn"
              style={{
                background: acento,
                color: previewBg,
                fontFamily: fontBody,
              }}
            >
              Agregar →
            </div>
          </div>
          <div
            className="tema-preview__pill"
            style={{
              background: acento,
              color: previewBg,
              fontFamily: fontBody,
            }}
          >
            Todo
          </div>
        </div>
      </section>

      <button
        className="btn-save-config"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar Apariencia"}
      </button>
    </div>
  );
};
