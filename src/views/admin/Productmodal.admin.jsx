// ProductModal.jsx (admin) — modal de creación/edición de platillos
import React, { useState } from "react";
import { GrupoEditor } from "./Grupoeditor";

// ── Retrocompatibilidad: producto antiguo puede tener categoria_id (string) ──
export const getCategoriasArray = (p) => {
  if (Array.isArray(p.categorias) && p.categorias.length) return p.categorias;
  if (p.categoria_id) return [p.categoria_id];
  return [];
};

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  precio_base: "",
  categorias: [],
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

export const ProductModal = ({
  product,
  categories,
  onSave,
  onClose,
  uploading,
  onImageUpload,
}) => {
  const isEditing = !!product;
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

    // ── NUEVA VALIDACIÓN PARA GRUPOS MÚLTIPLES ──
    for (const g of grupos) {
      // Solo revisamos los grupos que el usuario realmente llenó
      if (g.grupo.trim() !== "" && g.tipo === "multiple") {
        const tieneMaximo =
          g.maxSeleccion !== null && g.maxSeleccion !== undefined;
        const tieneLimite = g.limite !== null && g.limite !== undefined;

        // Si no tiene ninguna de las dos opciones, detenemos el guardado
        if (!tieneMaximo && !tieneLimite) {
          return alert(
            `Error en el grupo "${g.grupo}": Al elegir "Elige varios", debes seleccionar "Limitar cuántas puede elegir" o "Primeras N incluidas".`,
          );
        }
      }
    }

    // ── SI PASA LA VALIDACIÓN, LIMPIAMOS Y GUARDAMOS ──
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

          {/* ── 3: Grupos de electivos ── */}
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
