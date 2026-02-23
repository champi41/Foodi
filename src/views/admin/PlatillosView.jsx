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

const CLOUD_NAME = "djghs9u2k";
const UPLOAD_PRESET = "menu_preset";

// ─────────────────────────────────────────────
// GrupoEditor
// ─────────────────────────────────────────────
const GrupoEditor = ({ grupo, index, onChange, onRemove }) => {
  const update = (field, value) => {
    const updated = { ...grupo, [field]: value };
    if (field === "tipo" && value === "single") {
      updated.limite = null;
      updated.maxSeleccion = null;
    }
    onChange(index, updated);
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

  return (
    <div className="grupo-editor">
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

      {/* Lista de opciones */}
      <div className="grupo-opciones">
        <div className="opciones-header-row">
          <span>Opción</span>
          <span>
            {grupo.tipo === "multiple"
              ? "$ cobro si excede gratis (0 = siempre gratis)"
              : "$ cobro adicional (0 = incluido)"}
          </span>
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
          {/* ── LÍMITE MÁXIMO DE SELECCIÓN ── */}
          <div className="config-row-check">
            <label className="config-check-label">
              <input
                type="checkbox"
                checked={tieneMaximo}
                onChange={(e) =>
                  update("maxSeleccion", e.target.checked ? 2 : null)
                }
              />
              <span>Limitar cuántas puede elegir el cliente</span>
            </label>
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
                    ? `El cliente puede elegir hasta ${grupo.maxSeleccion} opción${grupo.maxSeleccion > 1 ? "es" : ""}`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* ── INCLUIDAS SIN COSTO ── */}
          <div className="config-row-check">
            <label className="config-check-label">
              <input
                type="checkbox"
                checked={tieneLimiteGratis}
                onChange={(e) =>
                  update(
                    "limite",
                    e.target.checked ? (grupo.maxSeleccion ?? 1) : null,
                  )
                }
              />
              <span>Algunas opciones van incluidas sin costo extra</span>
            </label>
            {tieneLimiteGratis && (
              <div className="config-inline-input">
                <span className="config-inline-label">Gratis hasta:</span>
                <input
                  type="number"
                  min="0"
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
                    ? `Las primeras ${grupo.limite} son gratis, desde la ${grupo.limite + 1}ª se cobra el precio individual`
                    : ""}
                </span>
              </div>
            )}
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
// CatModal
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
  categoria_id: "",
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

  const [form, setForm] = useState(
    isEditing
      ? {
          nombre: product.nombre || "",
          descripcion: product.descripcion || "",
          precio_base: product.precio_base || "",
          categoria_id: product.categoria_id || "",
          es_promocion: product.es_promocion || false,
          activo: product.activo ?? true,
          imagen: product.imagen || "",
          permitirNota: product.permitirNota || false,
        }
      : { ...EMPTY_FORM, categoria_id: categories[0]?.id || "" },
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
          {/* ── SECCIÓN 1: Info básica ── */}
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

            <div className="field-row">
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

              <div className="field-group">
                <label>Categoría *</label>
                <select
                  value={form.categoria_id}
                  onChange={(e) => set("categoria_id", e.target.value)}
                  required
                >
                  <option value="">Selecciona...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
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

          {/* ── SECCIÓN 2: Imagen ── */}
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

          {/* ── SECCIÓN 3: Grupos de opciones ── */}
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
                  Sin grupos de opciones todavía. Si este platillo tiene
                  variantes o acompañantes, agrégalos aquí. Ej: "Proteína"
                  (elige varios, máx. 2) o "Tamaño" (elige uno)
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

          {/* ── SECCIÓN 4: Personalización ── */}
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
  const filteredProducts = products.filter(
    (p) => filterCat === "all" || p.categoria_id === filterCat,
  );
  const catName = (id) =>
    categories.find((c) => c.id === id)?.nombre || "Sin categoría";

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
          const count = products.filter((p) => p.categoria_id === c.id).length;
          return (
            <button
              key={c.id}
              className={
                filterCat === c.id ? "filter-btn active" : "filter-btn"
              }
              onClick={() => setFilterCat(c.id)}
            >
              {c.nombre} ({count})
            </button>
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
                <p className="pv-card-cat">{catName(p.categoria_id)}</p>

                {/* Tags de grupos con info de límite */}
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

                {/* Badges de features */}
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
