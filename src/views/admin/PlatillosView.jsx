import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import "./PlatillosView.css";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ─────────────────────────────────────────────
// Helpers de retrocompatibilidad
// Un producto antiguo puede tener categoria_id (string) en vez de categorias (array)
// ─────────────────────────────────────────────
const getCategoriasArray = (p) => {
  if (Array.isArray(p.categorias) && p.categorias.length) return p.categorias;
  if (p.categoria_id) return [p.categoria_id];
  return [];
};

// ─────────────────────────────────────────────
// Tooltip de ayuda inline
// ─────────────────────────────────────────────
const AYUDA = {
  maxSeleccion: {
    titulo: "Límite de cantidad",
    desc: "El cliente puede elegir varias opciones, pero hasta un máximo que tú defines. Cada opción cobra su propio precio extra desde la primera selección.",
    ejemplos: [
      "Roll de sushi: elige hasta 2 proteínas (Salmón +$1.500, Pollo +$1.000). Si elige ambas, se cobran los dos extras.",
      "Combo bebida: elige hasta 1 bebida de las disponibles.",
      "Pizza: elige hasta 3 ingredientes, cada uno con su precio.",
    ],
  },
  limite: {
    titulo: "Incluidas sin costo",
    desc: "El cliente puede elegir varias opciones y las primeras N van incluidas en el precio base. Si elige más de N, el exceso cobra el precio extra de cada opción.",
    ejemplos: [
      "Empanada: 2 ingredientes incluidos. Si quiere un 3ro, se cobra el extra del ingrediente elegido.",
      "Burrito: 3 salsas incluidas, cada salsa adicional cobra +$300.",
      "Helado: 2 toppings gratis, los siguientes cobran +$500 c/u.",
    ],
  },
  sinRestriccion: {
    titulo: "Sin restricciones",
    desc: "El cliente puede agregar cuantas opciones quiera sin límite. Útil cuando todas las opciones son gratuitas o cuando no hay restricción de cantidad.",
    ejemplos: [
      "Condimentos: ketchup, mostaza, mayo — todos gratis, sin límite.",
      "Punto de cocción: a elección libre del cliente.",
    ],
  },
};

const TooltipAyuda = ({ tipo, onClose }) => {
  const info = AYUDA[tipo];
  if (!info) return null;
  return (
    <div
      className="tooltip-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="tooltip-box">
        <div className="tooltip-header">
          <h4 className="tooltip-title">{info.titulo}</h4>
          <button className="tooltip-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="tooltip-desc">{info.desc}</p>
        <div className="tooltip-ejemplos">
          <span className="tooltip-ejemplos-label">Ejemplos de uso</span>
          <ul>
            {info.ejemplos.map((ej, i) => (
              <li key={i}>{ej}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// GrupoEditor
// ─────────────────────────────────────────────
const GrupoEditor = ({ grupo, index, onChange, onRemove }) => {
  const [ayudaActiva, setAyudaActiva] = useState(null);

  const update = (field, value) => {
    const updated = { ...grupo, [field]: value };
    if (field === "tipo" && value === "single") {
      updated.limite = null;
      updated.maxSeleccion = null;
    }
    onChange(index, updated);
  };

  const handleMaxSeleccionToggle = () => {
    onChange(index, { ...grupo, maxSeleccion: 2, limite: null });
  };

  const handleLimiteToggle = () => {
    onChange(index, { ...grupo, limite: 2, maxSeleccion: null });
  };

  const handleSinRestriccion = () => {
    onChange(index, { ...grupo, maxSeleccion: null, limite: null });
  };

  const updateOpcion = (oi, field, value) => {
    const newOpciones = grupo.opciones.map((op, i) =>
      i === oi ? { ...op, [field]: value } : op,
    );
    if (
      field === "nombre" &&
      oi === grupo.opciones.length - 1 &&
      value !== ""
    ) {
      newOpciones.push({ nombre: "", extra: 0 });
    }
    onChange(index, { ...grupo, opciones: newOpciones });
  };

  const removeOpcion = (oi) => {
    if (grupo.opciones.length <= 1) return;
    onChange(index, {
      ...grupo,
      opciones: grupo.opciones.filter((_, i) => i !== oi),
    });
  };

  const tieneMaximo =
    grupo.maxSeleccion !== null && grupo.maxSeleccion !== undefined;
  const tieneLimiteGratis = grupo.limite !== null && grupo.limite !== undefined;

  // Texto de la columna de precio cambia según el modo activo
  const getPrecioHeader = () => {
    if (grupo.tipo === "single") return "$ extra (0 = incluido)";
    if (tieneMaximo) return "$ extra por opción (0 = gratis)";
    if (tieneLimiteGratis) return "$ si excede el límite (0 = siempre gratis)";
    return "$ extra (0 = gratis)";
  };

  return (
    <div className="grupo-editor">
      {ayudaActiva && (
        <TooltipAyuda tipo={ayudaActiva} onClose={() => setAyudaActiva(null)} />
      )}

      {/* Cabecera */}
      <div className="grupo-header">
        <div className="grupo-header-fields">
          <input
            className="input-grupo-nombre"
            placeholder="Nombre del grupo (ej: Proteína, Salsas, Bebida)"
            value={grupo.grupo}
            onChange={(e) => update("grupo", e.target.value)}
          />
          <select
            value={grupo.tipo}
            onChange={(e) => update("tipo", e.target.value)}
          >
            <option value="single">Elige uno solo</option>
            <option value="multiple">Elige varios</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-remove-grupo"
          onClick={() => onRemove(index)}
        >
          ✕
        </button>
      </div>

      {/* Opciones */}
      <div className="grupo-opciones">
        <div className="opciones-header-row">
          <span>Opción</span>
          <span>{getPrecioHeader()}</span>
        </div>
        {grupo.opciones.map((op, oi) => (
          <div key={oi} className="opcion-row">
            <input
              placeholder={`Ej: ${oi === 0 ? "Salmón" : oi === 1 ? "Atún" : "Camarón"}`}
              value={op.nombre}
              onChange={(e) => updateOpcion(oi, "nombre", e.target.value)}
            />
            <div className="opcion-precio-wrap">
              <span className="precio-prefix">$</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={op.extra > 0 ? op.extra : ""}
                onChange={(e) =>
                  updateOpcion(oi, "extra", Number(e.target.value))
                }
              />
            </div>
            {grupo.opciones.length > 1 && op.nombre !== "" && (
              <button
                type="button"
                className="btn-remove-opcion"
                onClick={() => removeOpcion(oi)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Config para grupos múltiples */}
      {grupo.tipo === "multiple" && (
        <div className="grupo-multiple-config">
          {/* Opción 1: Límite de cantidad (maxSeleccion) */}
          <div className="config-row-check">
            <div className="config-row-label-row">
              <label className="config-check-label">
                <input
                  type="radio"
                  name={`multi-mode-${index}`}
                  checked={tieneMaximo}
                  onChange={handleMaxSeleccionToggle}
                />
                <span>
                  Limitar cuántas puede elegir — cada una cobra su precio
                </span>
              </label>
              <button
                type="button"
                className="btn-ayuda"
                onClick={() => setAyudaActiva("maxSeleccion")}
              >
                ?
              </button>
            </div>
            {tieneMaximo && (
              <div className="config-inline-input">
                <span className="config-inline-label">Máximo:</span>
                <input
                  type="number"
                  min="1"
                  value={grupo.maxSeleccion ?? ""}
                  onChange={(e) =>
                    update(
                      "maxSeleccion",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
                <span className="limite-hint">
                  {grupo.maxSeleccion
                    ? `Hasta ${grupo.maxSeleccion} opción${grupo.maxSeleccion > 1 ? "es" : ""}, cada una cobra su extra`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* Opción 2: Incluidas gratis (limite) */}
          <div className="config-row-check">
            <div className="config-row-label-row">
              <label className="config-check-label">
                <input
                  type="radio"
                  name={`multi-mode-${index}`}
                  checked={tieneLimiteGratis}
                  onChange={handleLimiteToggle}
                />
                <span>Primeras N incluidas — el exceso cobra extra</span>
              </label>
              <button
                type="button"
                className="btn-ayuda"
                onClick={() => setAyudaActiva("limite")}
              >
                ?
              </button>
            </div>
            {tieneLimiteGratis && (
              <div className="config-inline-input">
                <span className="config-inline-label">Gratis hasta:</span>
                <input
                  type="number"
                  min="1"
                  value={grupo.limite ?? ""}
                  onChange={(e) =>
                    update(
                      "limite",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
                <span className="limite-hint">
                  {grupo.limite
                    ? `Las primeras ${grupo.limite} son gratis, desde la ${grupo.limite + 1}ª se cobra el extra de la opción`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* Opción 3: Sin restricciones */}
          <div className="config-row-check">
            <div className="config-row-label-row">
              <label className="config-check-label">
                <input
                  type="radio"
                  name={`multi-mode-${index}`}
                  checked={!tieneMaximo && !tieneLimiteGratis}
                  onChange={handleSinRestriccion}
                />
                <span>Sin restricciones — el cliente elige cuántas quiera</span>
              </label>
              <button
                type="button"
                className="btn-ayuda"
                onClick={() => setAyudaActiva("sinRestriccion")}
              >
                ?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Obligatorio */}
      <div className="grupo-flags">
        <label className="flag-label">
          <input
            type="checkbox"
            checked={grupo.requerido}
            onChange={(e) => update("requerido", e.target.checked)}
          />
          <span>
            Obligatorio — el cliente debe elegir antes de agregar al carrito
          </span>
        </label>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────
// CatModal — crear categoría
// ─────────────────────────────────────────────
const CatModal = ({ onSave, onClose }) => {
  const [nombre, setNombre] = useState("");
  return (
    <div className="modal-overlay">
      <div className="modal-box modal-box-sm">
        <h3>Nueva Categoría</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(nombre);
          }}
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Entradas, Sushis, Bebidas"
            required
            autoFocus
          />
          <div className="modal-btns">
            <button type="submit" className="btn-primary">
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ProductModal
// ─────────────────────────────────────────────
const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  precio_base: "",
  categorias: [], // array en vez de categoria_id
  es_promocion: false,
  activo: true,
  imagen: "",
  permitirNota: false,
};

const EMPTY_GRUPO = () => ({
  grupo: "",
  tipo: "single",
  requerido: true,
  limite: null,
  maxSeleccion: null,
  opciones: [{ nombre: "", extra: 0 }],
});

const ProductModal = ({
  product,
  categories,
  onSave,
  onClose,
  uploading,
  onImageUpload,
}) => {
  const isEditing = !!product;

  // Normalizar categorías del producto a editar (retrocompatibilidad)
  const initialCategorias = isEditing ? getCategoriasArray(product) : [];

  const [form, setForm] = useState(
    isEditing
      ? {
          nombre: product.nombre || "",
          descripcion: product.descripcion || "",
          precio_base: product.precio_base || "",
          categorias: initialCategorias,
          es_promocion: product.es_promocion || false,
          activo: product.activo ?? true,
          imagen: product.imagen || "",
          permitirNota: product.permitirNota || false,
        }
      : { ...EMPTY_FORM },
  );

  const [grupos, setGrupos] = useState(
    isEditing && product.grupos?.length ? product.grupos : [],
  );
  const [personalizable, setPersonalizable] = useState(
    isEditing ? product.personalizable || false : false,
  );
  const [ingBase, setIngBase] = useState(
    isEditing && product.ingBase?.length ? [...product.ingBase, ""] : [""],
  );
  const [ingInter, setIngInter] = useState(
    isEditing && product.ingInter?.length
      ? [...product.ingInter, { nombre: "", precio: 0 }]
      : [{ nombre: "", precio: 0 }],
  );

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const toggleCategoria = (id) => {
    const current = form.categorias;
    set(
      "categorias",
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  };

  const handleGrupoChange = (i, updated) =>
    setGrupos(grupos.map((g, gi) => (gi === i ? updated : g)));
  const handleGrupoRemove = (i) =>
    setGrupos(grupos.filter((_, gi) => gi !== i));

  const handleDynamicBase = (i, val) => {
    const list = [...ingBase];
    list[i] = val;
    if (i === ingBase.length - 1 && val !== "") list.push("");
    setIngBase(list);
  };

  const handleDynamicInter = (i, field, val) => {
    const list = [...ingInter];
    list[i] = { ...list[i], [field]: val };
    if (i === ingInter.length - 1 && list[i].nombre !== "")
      list.push({ nombre: "", precio: 0 });
    setIngInter(list);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (uploading) return alert("Espera a que termine de subir la imagen");
    if (!form.precio_base || Number(form.precio_base) <= 0)
      return alert("Ingresa un precio base válido");
    if (form.categorias.length === 0)
      return alert("Selecciona al menos una categoría");

    const cleanGrupos = grupos
      .filter((g) => g.grupo.trim() !== "")
      .map((g) => ({
        ...g,
        opciones: g.opciones.filter((op) => op.nombre.trim() !== ""),
      }));

    onSave({
      ...form,
      precio_base: Number(form.precio_base),
      grupos: cleanGrupos,
      personalizable,
      ingBase: personalizable ? ingBase.filter((x) => x.trim() !== "") : [],
      ingInter: personalizable
        ? ingInter.filter((x) => x.nombre.trim() !== "")
        : [],
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3>
            {isEditing ? `Editando: ${product.nombre}` : "Nuevo Platillo"}
          </h3>
          <button className="btn-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* ── 1: Info básica ── */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="section-num">1</span> Información básica
            </div>

            <div className="field-group">
              <label>Nombre del platillo *</label>
              <input
                placeholder="Ej: Hamburguesa Clásica, Roll California"
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label>Descripción (opcional)</label>
              <textarea
                placeholder="Ingredientes principales, modo de preparación, etc."
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                rows={2}
              />
            </div>

            <div className="field-group">
              <label>Precio base *</label>
              <div className="precio-input-wrap">
                <span className="precio-prefix">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.precio_base}
                  onChange={(e) => set("precio_base", e.target.value)}
                  required
                />
              </div>
              <span className="field-hint">
                Precio antes de electivos con costo extra
              </span>
            </div>

            {/* Selector múltiple de categorías */}
            <div className="field-group">
              <label>
                Categorías *{" "}
                <span className="field-hint">(puedes elegir varias)</span>
              </label>
              {categories.length === 0 ? (
                <p className="field-hint">
                  Crea una categoría primero usando el botón "+ Categoría"
                </p>
              ) : (
                <div className="cat-checkbox-grid">
                  {categories.map((c) => {
                    const selected = form.categorias.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`cat-check-pill ${selected ? "cat-check-pill--active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          style={{ display: "none" }}
                          checked={selected}
                          onChange={() => toggleCategoria(c.id)}
                        />
                        {selected && <span className="cat-check-mark">✓</span>}
                        {c.nombre}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="checkboxes-row">
              <label className="check-pill">
                <input
                  type="checkbox"
                  checked={form.es_promocion}
                  onChange={(e) => set("es_promocion", e.target.checked)}
                />
                ⭐ Mostrar en Promociones
              </label>
              <label className="check-pill">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => set("activo", e.target.checked)}
                />
                ✅ Visible en el menú
              </label>
              <label className="check-pill">
                <input
                  type="checkbox"
                  checked={form.permitirNota}
                  onChange={(e) => set("permitirNota", e.target.checked)}
                />
                📝 Permitir nota del cliente
              </label>
            </div>
          </div>

          {/* ── 2: Imagen ── */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="section-num">2</span> Foto del platillo
            </div>
            {uploading ? (
              <div className="upload-loader">Subiendo imagen...</div>
            ) : form.imagen ? (
              <div className="image-preview-row">
                <img src={form.imagen} alt="Preview" />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => set("imagen", "")}
                >
                  Cambiar foto
                </button>
              </div>
            ) : (
              <label className="upload-zone">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) =>
                    onImageUpload(e, (url) => set("imagen", url))
                  }
                />
                <span className="upload-icon">📷</span>
                <span>Haz clic para subir una foto (opcional)</span>
                <span className="field-hint">JPG, PNG o WebP recomendado</span>
              </label>
            )}
          </div>

          {/* ── 3: Grupos ── */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="section-num">3</span> Opciones y electivos
              <span className="section-hint">
                Tipo de carne, tamaño, bebida, salsas, etc.
              </span>
            </div>
            {grupos.length === 0 && (
              <div className="empty-grupos">
                <p>
                  Sin grupos todavía. Agrégalos si el platillo tiene variantes.
                  Ej: "Proteína" o "Tamaño"
                </p>
              </div>
            )}
            {grupos.map((g, gi) => (
              <GrupoEditor
                key={gi}
                grupo={g}
                index={gi}
                onChange={handleGrupoChange}
                onRemove={handleGrupoRemove}
              />
            ))}
            <button
              type="button"
              className="btn-add-grupo"
              onClick={() => setGrupos([...grupos, EMPTY_GRUPO()])}
            >
              + Agregar grupo de opciones (opcional)
            </button>
          </div>

          {/* ── 4: Personalización ── */}
          <div className="form-section">
            <div className="form-section-title">
              <span className="section-num">4</span> Personalización
              <span className="section-hint">
                Quitar ingredientes y agregar extras
              </span>
            </div>
            <label className="check-pill">
              <input
                type="checkbox"
                checked={personalizable}
                onChange={(e) => setPersonalizable(e.target.checked)}
              />
              Permitir quitar ingredientes y pedir extras con costo
            </label>
            {personalizable && (
              <div className="personalizable-fields">
                <div className="field-group">
                  <label>Ingredientes que se pueden quitar</label>
                  <span className="field-hint">
                    Ej: lechuga, tomate, cebolla
                  </span>
                  {ingBase.map((b, i) => (
                    <input
                      key={i}
                      value={b}
                      onChange={(e) => handleDynamicBase(i, e.target.value)}
                      placeholder="Ej: Cebolla"
                    />
                  ))}
                </div>
                <div className="field-group">
                  <label>Ingredientes extras (con costo adicional)</label>
                  <span className="field-hint">
                    Ej: tocino +$1000, queso extra +$800
                  </span>
                  {ingInter.map((n, i) => (
                    <div key={i} className="opcion-row">
                      <input
                        placeholder="Ej: Tocino"
                        value={n.nombre}
                        onChange={(e) =>
                          handleDynamicInter(i, "nombre", e.target.value)
                        }
                      />
                      <div className="opcion-precio-wrap">
                        <span className="precio-prefix">$</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={n.precio > 0 ? n.precio : ""}
                          onChange={(e) =>
                            handleDynamicInter(
                              i,
                              "precio",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-btns modal-btns-sticky">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {isEditing ? "Guardar Cambios" : "Crear Platillo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// PlatillosView — componente principal
// ─────────────────────────────────────────────
export const PlatillosView = ({ businessId }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);

  const tenantId = businessId || auth.currentUser?.uid;

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cS = await getDocs(
        query(
          collection(db, `negocios/${tenantId}/categorias`),
          orderBy("nombre"),
        ),
      );
      setCategories(cS.docs.map((d) => ({ id: d.id, ...d.data() })));
      const pS = await getDocs(
        collection(db, `negocios/${tenantId}/productos`),
      );
      setProducts(pS.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e, onSuccess) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    try {
      const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: data },
      );
      const res = await resp.json();
      onSuccess(res.secure_url);
    } catch (err) {
      console.error("Error Cloudinary:", err);
      alert("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProduct = async (data) => {
    try {
      if (editingProduct) {
        await updateDoc(
          doc(db, `negocios/${tenantId}/productos`, editingProduct.id),
          data,
        );
      } else {
        await addDoc(collection(db, `negocios/${tenantId}/productos`), data);
      }
      fetchData();
      setShowProductModal(false);
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCat = async (nombre) => {
    try {
      const dR = await addDoc(
        collection(db, `negocios/${tenantId}/categorias`),
        { nombre },
      );
      setCategories([...categories, { id: dR.id, nombre }]);
      setShowCatModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCat = async (cat) => {
    // Contar platillos que usan esta categoría
    const usandola = products.filter((p) =>
      getCategoriasArray(p).includes(cat.id),
    ).length;
    const msg =
      usandola > 0
        ? `¿Eliminar la categoría "${cat.nombre}"? ${usandola} platillo${usandola > 1 ? "s usan" : " usa"} esta categoría y quedarán sin ella.`
        : `¿Eliminar la categoría "${cat.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteDoc(doc(db, `negocios/${tenantId}/categorias`, cat.id));
      setCategories(categories.filter((c) => c.id !== cat.id));
      if (filterCat === cat.id) setFilterCat("all");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (product) => {
    const newStatus = !product.activo;
    await updateDoc(doc(db, `negocios/${tenantId}/productos`, product.id), {
      activo: newStatus,
    });
    setProducts(
      products.map((p) =>
        p.id === product.id ? { ...p, activo: newStatus } : p,
      ),
    );
  };

  const handleDelete = async (productId) => {
    if (
      !window.confirm(
        "¿Eliminar este platillo? Esta acción no se puede deshacer.",
      )
    )
      return;
    await deleteDoc(doc(db, `negocios/${tenantId}/productos`, productId));
    fetchData();
  };

  const openProductModal = (p = null) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  // Filtro con retrocompatibilidad
  const filteredProducts = products.filter(
    (p) => filterCat === "all" || getCategoriasArray(p).includes(filterCat),
  );

  // Nombre de categorías para mostrar en cards (puede ser varias)
  const catNames = (p) => {
    const ids = getCategoriasArray(p);
    if (ids.length === 0) return "Sin categoría";
    return ids
      .map((id) => categories.find((c) => c.id === id)?.nombre)
      .filter(Boolean)
      .join(", ");
  };

  if (loading) return <div className="pv-loading">Cargando platillos...</div>;

  return (
    <div className="platillos-view">
      <div className="pv-header">
        <div>
          <h1 className="pv-title">Platillos</h1>
          <p className="pv-subtitle">
            {products.length} platillos · {categories.length} categorías
          </p>
        </div>
        <button className="btn-primary" onClick={() => openProductModal()}>
          + Nuevo Platillo
        </button>
      </div>

      {/* Filter bar — categorías con botón de eliminar */}
      <div className="pv-filter-bar">
        <button
          className="filter-btn filter-btn-cat"
          onClick={() => setShowCatModal(true)}
        >
          + Categoría
        </button>
        <button
          className={filterCat === "all" ? "filter-btn active" : "filter-btn"}
          onClick={() => setFilterCat("all")}
        >
          Todos ({products.length})
        </button>
        {categories.map((c) => {
          const count = products.filter((p) =>
            getCategoriasArray(p).includes(c.id),
          ).length;
          return (
            <div
              key={c.id}
              className={`filter-btn-wrap ${filterCat === c.id ? "active" : ""}`}
            >
              <button
                className={
                  filterCat === c.id ? "filter-btn active" : "filter-btn"
                }
                onClick={() => setFilterCat(c.id)}
              >
                {c.nombre} ({count})
              </button>
              <button
                className="filter-btn-delete"
                title={`Eliminar categoría "${c.nombre}"`}
                onClick={() => handleDeleteCat(c)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="pv-empty">
          <span>🍽️</span>
          <p>No hay platillos en esta categoría</p>
          <button className="btn-primary" onClick={() => openProductModal()}>
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="pv-grid">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className={`pv-card ${!p.activo ? "pv-card-inactive" : ""}`}
            >
              <div className="pv-card-img">
                {p.imagen ? (
                  <img src={p.imagen} alt={p.nombre} />
                ) : (
                  <div className="pv-no-img">📷</div>
                )}
                {!p.activo && <div className="pv-inactive-badge">Inactivo</div>}
                {p.es_promocion && (
                  <div className="pv-promo-badge">⭐ Promo</div>
                )}
              </div>
              <div className="pv-card-body">
                <div className="pv-card-top">
                  <h4 className="pv-card-nombre">{p.nombre}</h4>
                  <span className="pv-card-precio">
                    ${p.precio_base?.toLocaleString("es-CL")}
                  </span>
                </div>
                <p className="pv-card-cat">{catNames(p)}</p>

                {p.grupos?.length > 0 && (
                  <div className="pv-card-tags">
                    {p.grupos.map((g, i) => (
                      <span key={i} className="pv-tag">
                        {g.grupo}
                        {g.tipo === "multiple"
                          ? g.maxSeleccion
                            ? ` · máx. ${g.maxSeleccion}`
                            : " · varios"
                          : " · uno"}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pv-card-features">
                  {p.personalizable && (
                    <span className="pv-feature-badge">✂️ Personalizable</span>
                  )}
                  {p.permitirNota && (
                    <span className="pv-feature-badge">📝 Nota</span>
                  )}
                </div>

                <div className="pv-card-actions">
                  <button
                    className="btn-card-edit"
                    onClick={() => openProductModal(p)}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className={`btn-card-toggle ${p.activo ? "btn-card-desactivar" : "btn-card-activar"}`}
                    onClick={() => toggleStatus(p)}
                  >
                    {p.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="btn-card-delete"
                    onClick={() => handleDelete(p.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCatModal && (
        <CatModal
          onSave={handleAddCat}
          onClose={() => setShowCatModal(false)}
        />
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          uploading={uploading}
          onImageUpload={handleImageUpload}
        />
      )}
    </div>
  );
};
