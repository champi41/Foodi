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
  incluidasGratis: null,
  opciones: [],
});

// Normaliza grupo legacy (sin ingredienteId) al formato nuevo para el editor
const normalizeGrupoForEditor = (g) => {
  const isLegacy =
    g.opciones?.length > 0 && g.opciones[0].ingredienteId === undefined;
  let limite = g.limite ?? null;
  let incluidasGratis = g.incluidasGratis ?? null;
  if (isLegacy) {
    if (g.maxSeleccion != null) {
      limite = g.maxSeleccion;
      incluidasGratis = null;
    } else if (g.limite != null) {
      incluidasGratis = g.limite;
      limite = null;
    }
  }
  const opciones = (g.opciones || []).map((op) => ({
    ingredienteId: op.ingredienteId ?? null,
    nombre: op.nombre ?? "",
    extra: op.extra ?? 0,
    incluido: op.incluido ?? false,
  }));
  return {
    ...g,
    limite,
    incluidasGratis,
    opciones,
  };
};

// Precio mínimo visible "Desde $X": base + suma del extra más bajo de cada grupo requerido (opciones no incluidas)
export const getPrecioDesde = (precioBase, grupos = []) => {
  let extra = 0;
  const req = grupos.filter((g) => g.grupo?.trim() && g.requerido);
  for (const g of req) {
    const opciones = g.opciones || [];
    if (g.tipo === "single") {
      const noIncluidas = opciones.filter((op) => !op.incluido && op.nombre?.trim());
      if (noIncluidas.length) {
        extra += Math.min(...noIncluidas.map((op) => op.extra ?? 0));
      }
    } else if (g.tipo === "multiple") {
      if (g.incluidasGratis != null) {
        // N incluidas: no sumamos al "desde" (las primeras N gratis)
        continue;
      }
      if (g.limite != null) {
        const noIncluidas = opciones.filter((op) => !op.incluido && op.nombre?.trim());
        if (noIncluidas.length) {
          extra += Math.min(...noIncluidas.map((op) => op.extra ?? 0));
        }
      }
    }
  }
  return (precioBase || 0) + extra;
};

export const ProductModal = ({
  product,
  categories,
  ingredientes = [],
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
    isEditing && product.grupos?.length
      ? product.grupos.map(normalizeGrupoForEditor)
      : [],
  );
  const [personalizable, setPersonalizable] = useState(
    isEditing ? product.personalizable || false : false,
  );
  const [ingBase, setIngBase] = useState(
    isEditing && product.ingBase?.length ? product.ingBase : [],
  );
  const [ingInter, setIngInter] = useState(
    isEditing && product.ingInter?.length
      ? product.ingInter.filter((x) => x.nombre?.trim())
      : [],
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

  const toggleIngBase = (nombre) => {
    if (ingBase.includes(nombre)) {
      setIngBase(ingBase.filter((n) => n !== nombre));
    } else {
      setIngBase([...ingBase, nombre]);
    }
  };

  const toggleIngInter = (ing) => {
    const exists = ingInter.some((e) => e.nombre === ing.nombre);
    if (exists) {
      setIngInter(ingInter.filter((e) => e.nombre !== ing.nombre));
    } else {
      setIngInter([...ingInter, { nombre: ing.nombre, precio: ing.extra ?? 0 }]);
    }
  };

  const updateIngInterPrecio = (nombre, precio) => {
    setIngInter(
      ingInter.map((e) =>
        e.nombre === nombre ? { ...e, precio: Number(precio) || 0 } : e,
      ),
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (uploading) return alert("Espera a que termine de subir la imagen");
    if (!form.precio_base || Number(form.precio_base) <= 0)
      return alert("Ingresa un precio base válido");
    if (form.categorias.length === 0)
      return alert("Selecciona al menos una categoría");

    // Validación: múltiple debe tener limite o incluidasGratis
    for (const g of grupos) {
      if (g.grupo.trim() !== "" && g.tipo === "multiple") {
        const tieneLimite = g.limite != null;
        const tieneIncluidas = g.incluidasGratis != null;
        if (!tieneLimite && !tieneIncluidas) {
          return alert(
            `Error en el grupo "${g.grupo}": En "Elige varios" debes elegir "Límite de cantidad" o "N incluidas gratis".`,
          );
        }
      }
    }

    const cleanGrupos = grupos
      .filter((g) => g.grupo.trim() !== "")
      .map((g) => {
        const opciones = g.opciones
          .filter((op) => op.nombre.trim() !== "")
          .map((op) => ({
            ingredienteId: op.ingredienteId ?? null,
            nombre: op.nombre.trim(),
            extra: Number(op.extra) || 0,
            incluido: op.incluido ?? false,
          }));
        return {
          grupo: g.grupo.trim(),
          tipo: g.tipo,
          requerido: g.requerido,
          limite: g.limite ?? null,
          incluidasGratis: g.incluidasGratis ?? null,
          opciones,
        };
      });

    onSave({
      ...form,
      precio_base: Number(form.precio_base),
      grupos: cleanGrupos,
      personalizable,
      ingBase: personalizable ? ingBase.filter((n) => n && n.trim() !== "") : [],
      ingInter: personalizable
        ? ingInter.filter((x) => x.nombre?.trim() !== "")
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
                ingredientes={ingredientes}
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
                    Marca los que el cliente podrá desmarcar al pedir
                  </span>
                  {ingredientes.length === 0 ? (
                    <p className="field-hint">
                      Crea ingredientes en el apartado Ingredientes para listarlos aquí
                    </p>
                  ) : (
                    <div className="personalizable-catalogo">
                      {Object.entries(
                        ingredientes.reduce((acc, ing) => {
                          const c = ing.categoria || "Sin categoría";
                          if (!acc[c]) acc[c] = [];
                          acc[c].push(ing);
                          return acc;
                        }, {}),
                      ).map(([cat, list]) => (
                        <div key={cat} className="personalizable-cat">
                          <span className="personalizable-cat-name">{cat}</span>
                          <div className="personalizable-chips">
                            {list.map((ing) => (
                              <label
                                key={ing.id}
                                className={`grupo-catalogo-chip ${ingBase.includes(ing.nombre) ? "grupo-catalogo-chip--on" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={ingBase.includes(ing.nombre)}
                                  onChange={() => toggleIngBase(ing.nombre)}
                                />
                                <span>{ing.nombre}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="field-group">
                  <label>Ingredientes extras (con costo adicional)</label>
                  <span className="field-hint">
                    Marca los que el cliente puede agregar pagando el extra
                  </span>
                  {ingredientes.length === 0 ? (
                    <p className="field-hint">
                      Crea ingredientes en el apartado Ingredientes
                    </p>
                  ) : (
                    <>
                      <div className="personalizable-catalogo">
                        {Object.entries(
                          ingredientes.reduce((acc, ing) => {
                            const c = ing.categoria || "Sin categoría";
                            if (!acc[c]) acc[c] = [];
                            acc[c].push(ing);
                            return acc;
                          }, {}),
                        ).map(([cat, list]) => (
                          <div key={cat} className="personalizable-cat">
                            <span className="personalizable-cat-name">{cat}</span>
                            <div className="personalizable-chips">
                              {list.map((ing) => {
                                const selected = ingInter.some(
                                  (e) => e.nombre === ing.nombre,
                                );
                                return (
                                  <label
                                    key={ing.id}
                                    className={`grupo-catalogo-chip ${selected ? "grupo-catalogo-chip--on" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleIngInter(ing)}
                                    />
                                    <span>{ing.nombre}</span>
                                    {ing.extra > 0 && (
                                      <span className="grupo-catalogo-extra">
                                        +${ing.extra}
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {ingInter.length > 0 && (
                        <div className="personalizable-extras-list">
                          <span className="personalizable-extras-label">
                            Precio por extra (editable):
                          </span>
                          {ingInter.map((e) => (
                            <div key={e.nombre} className="opcion-row opcion-row--compact">
                              <span className="opcion-nombre-fijo">{e.nombre}</span>
                              <div className="opcion-precio-wrap">
                                <span className="precio-prefix">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={e.precio > 0 ? e.precio : ""}
                                  onChange={(ev) =>
                                    updateIngInterPrecio(
                                      e.nombre,
                                      ev.target.value,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
