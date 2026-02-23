import React, { useState } from "react";
import "./ProductModal.css";

export const ProductModal = ({
  product,
  onClose,
  onAdd,
  editingItem = null,
}) => {
  if (!product) return null;

  const grupos = product.grupos ?? [];

  const [cantidad, setCantidad] = useState(editingItem?.cantidad ?? 1);
  const [nota, setNota] = useState(editingItem?.nota ?? "");

  const [selecciones, setSelecciones] = useState(() => {
    if (editingItem?.selecciones) return editingItem.selecciones;
    const init = {};
    grupos.forEach((g, gi) => {
      init[gi] = g.tipo === "multiple" ? [] : null;
    });
    return init;
  });

  const [costoExcesos, setCostoExcesos] = useState({});
  const [removedBase, setRemovedBase] = useState(
    editingItem?.sinIngredientes ?? [],
  );
  const [extras, setExtras] = useState(editingItem?.extras ?? []);

  // ── Handlers ──

  const handleSingle = (gi, opcion) => {
    setSelecciones({ ...selecciones, [gi]: opcion });
  };

  const handleMultipleCantidad = (gi, opcion, delta, grupo) => {
    const current = [
      ...(Array.isArray(selecciones[gi]) ? selecciones[gi] : []),
    ];
    const totalActual = current.reduce((s, o) => s + o.cantidad, 0);

    // Bloquear si se alcanza maxSeleccion
    if (delta > 0 && grupo.maxSeleccion && totalActual >= grupo.maxSeleccion)
      return;

    const existingIdx = current.findIndex((o) => o.nombre === opcion.nombre);

    if (delta > 0) {
      if (grupo.limite && totalActual >= grupo.limite) {
        setCostoExcesos((prev) => ({
          ...prev,
          [gi]: (prev[gi] || 0) + (opcion.extra || 0),
        }));
      }
      if (existingIdx >= 0) {
        current[existingIdx] = {
          ...current[existingIdx],
          cantidad: current[existingIdx].cantidad + 1,
        };
      } else {
        current.push({ ...opcion, cantidad: 1 });
      }
    } else {
      if (grupo.limite && totalActual > grupo.limite) {
        setCostoExcesos((prev) => ({
          ...prev,
          [gi]: Math.max(0, (prev[gi] || 0) - (opcion.extra || 0)),
        }));
      }
      if (existingIdx >= 0) {
        const nuevaCantidad = current[existingIdx].cantidad - 1;
        if (nuevaCantidad <= 0) current.splice(existingIdx, 1);
        else
          current[existingIdx] = {
            ...current[existingIdx],
            cantidad: nuevaCantidad,
          };
      }
    }
    setSelecciones({ ...selecciones, [gi]: current });
  };

  // ── Precio ──

  const precioGrupos = grupos.reduce((acc, g, gi) => {
    if (g.tipo === "single") return acc + (selecciones[gi]?.extra || 0);
    return acc + (costoExcesos[gi] || 0);
  }, 0);

  const precioExtras = extras.reduce((acc, e) => acc + e.precio, 0);
  const totalUnitario = product.precio_base + precioGrupos + precioExtras;
  const totalFinal = totalUnitario * cantidad;

  // ── Validación ──

  const handleAddToCart = () => {
    for (let gi = 0; gi < grupos.length; gi++) {
      const g = grupos[gi];
      if (g.requerido) {
        const sel = selecciones[gi];
        if (g.tipo === "single" && !sel) {
          alert(`Elige una opción en "${g.grupo}"`);
          return;
        }
        if (
          g.tipo === "multiple" &&
          (!Array.isArray(sel) || sel.length === 0)
        ) {
          alert(`Elige al menos una opción en "${g.grupo}"`);
          return;
        }
      }
    }
    onAdd({
      uid: editingItem?.uid ?? Date.now(),
      productoOriginal: product,
      nombre: product.nombre,
      selecciones,
      sinIngredientes: removedBase,
      extras,
      nota: product.permitirNota ? nota.trim() : "",
      cantidad,
      precioUnitario: totalUnitario,
      precioFinal: totalFinal,
    });
  };

  const toggleExtra = (ing) => {
    extras.some((e) => e.nombre === ing.nombre)
      ? setExtras(extras.filter((e) => e.nombre !== ing.nombre))
      : setExtras([...extras, ing]);
  };

  const toggleBase = (nombre) => {
    removedBase.includes(nombre)
      ? setRemovedBase(removedBase.filter((n) => n !== nombre))
      : setRemovedBase([...removedBase, nombre]);
  };

  return (
    <div
      className="pm-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="pm-sheet">
        {/* Imagen de cabecera si existe */}
        {product.imagen && (
          <div className="pm-img-header">
            <img src={product.imagen} alt={product.nombre} />
            <button className="pm-close-float" onClick={onClose}>
              ✕
            </button>
          </div>
        )}

        {/* Header sin imagen */}
        {!product.imagen && (
          <div className="pm-header">
            <div>
              <h3 className="pm-title">{product.nombre}</h3>
              {product.descripcion && (
                <p className="pm-desc">{product.descripcion}</p>
              )}
            </div>
            <button className="pm-close" onClick={onClose}>
              ✕
            </button>
          </div>
        )}

        {/* Título + desc debajo de imagen */}
        {product.imagen && (
          <div className="pm-title-below">
            <h3 className="pm-title">{product.nombre}</h3>
            {product.descripcion && (
              <p className="pm-desc">{product.descripcion}</p>
            )}
          </div>
        )}

        {/* ── CONTENIDO ── */}
        <div className="pm-content">
          {/* GRUPOS */}
          {grupos.map((g, gi) => {
            const selMultiple = Array.isArray(selecciones[gi])
              ? selecciones[gi]
              : [];
            const totalUnidades = selMultiple.reduce(
              (s, o) => s + o.cantidad,
              0,
            );
            const limiteAlcanzado =
              g.maxSeleccion && totalUnidades >= g.maxSeleccion;
            const excedidoGratis = g.limite && totalUnidades > g.limite;
            const costoExcesoActual = costoExcesos[gi] || 0;

            // Texto descriptivo del grupo
            const grupoInfo = [];
            if (g.tipo === "single") grupoInfo.push("Elige uno");
            if (g.tipo === "multiple") {
              if (g.maxSeleccion)
                grupoInfo.push(`Elige hasta ${g.maxSeleccion}`);
              else grupoInfo.push("Elige varios");
              if (g.limite)
                grupoInfo.push(
                  `${g.limite} incluida${g.limite > 1 ? "s" : ""}`,
                );
            }

            return (
              <div key={gi} className="pm-section">
                <div className="pm-section-header">
                  <div className="pm-section-title-row">
                    <h4 className="pm-section-title">{g.grupo}</h4>
                    {g.requerido && (
                      <span className="pm-required">Obligatorio</span>
                    )}
                  </div>
                  <span className="pm-section-info">
                    {grupoInfo.join(" · ")}
                  </span>
                </div>

                <div className="pm-options">
                  {g.opciones
                    .filter((op) => op.nombre.trim() !== "")
                    .map((op, oi) => {
                      // ── SINGLE ──
                      if (g.tipo === "single") {
                        const isSelected =
                          selecciones[gi]?.nombre === op.nombre;
                        return (
                          <label
                            key={oi}
                            className={`pm-option ${isSelected ? "pm-option--selected" : ""}`}
                          >
                            <div className="pm-option-left">
                              <span
                                className={`pm-radio ${isSelected ? "pm-radio--on" : ""}`}
                              />
                              <span className="pm-option-name">
                                {op.nombre}
                              </span>
                            </div>
                            {op.extra > 0 && (
                              <span className="pm-option-price">
                                +${op.extra.toLocaleString("es-CL")}
                              </span>
                            )}
                            <input
                              type="radio"
                              name={`grupo_${gi}`}
                              style={{ display: "none" }}
                              checked={isSelected}
                              onChange={() => handleSingle(gi, op)}
                            />
                          </label>
                        );
                      }

                      // ── MULTIPLE ──
                      const itemSel = selMultiple.find(
                        (s) => s.nombre === op.nombre,
                      );
                      const cantidadSel = itemSel?.cantidad || 0;
                      const bloqueadoAgregar =
                        limiteAlcanzado && cantidadSel === 0;

                      return (
                        <div
                          key={oi}
                          className={`pm-option pm-option--multi ${cantidadSel > 0 ? "pm-option--selected" : ""} ${bloqueadoAgregar ? "pm-option--disabled" : ""}`}
                        >
                          <div className="pm-option-left">
                            <span className="pm-option-name">{op.nombre}</span>
                            {op.extra > 0 ? (
                              <span className="pm-option-subtext">
                                +${op.extra.toLocaleString("es-CL")} si excede
                              </span>
                            ) : (
                              <span className="pm-option-subtext">
                                Incluida
                              </span>
                            )}
                          </div>
                          <div className="pm-qty">
                            <button
                              type="button"
                              className="pm-qty-btn"
                              onClick={() =>
                                handleMultipleCantidad(gi, op, -1, g)
                              }
                              disabled={cantidadSel === 0}
                            >
                              −
                            </button>
                            <span className="pm-qty-val">{cantidadSel}</span>
                            <button
                              type="button"
                              className={`pm-qty-btn ${bloqueadoAgregar ? "pm-qty-btn--blocked" : ""}`}
                              onClick={() =>
                                handleMultipleCantidad(gi, op, 1, g)
                              }
                              disabled={bloqueadoAgregar}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Indicador de progreso para grupos múltiples con límite */}
                {g.tipo === "multiple" && totalUnidades > 0 && (
                  <div
                    className={`pm-limit-bar ${excedidoGratis ? "pm-limit-bar--over" : ""}`}
                  >
                    {g.maxSeleccion ? (
                      <>
                        <div
                          className="pm-limit-fill"
                          style={{
                            width: `${Math.min(100, (totalUnidades / g.maxSeleccion) * 100)}%`,
                          }}
                        />
                        <span className="pm-limit-text">
                          {totalUnidades}/{g.maxSeleccion}
                          {limiteAlcanzado ? " · Máximo alcanzado" : ""}
                          {excedidoGratis && costoExcesoActual > 0
                            ? ` · Exceso: +$${costoExcesoActual.toLocaleString("es-CL")}`
                            : ""}
                        </span>
                      </>
                    ) : g.limite ? (
                      <span className="pm-limit-text">
                        {totalUnidades}/{g.limite} incluidas
                        {excedidoGratis && costoExcesoActual > 0
                          ? ` · Exceso: +$${costoExcesoActual.toLocaleString("es-CL")}`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {/* QUITAR INGREDIENTES */}
          {product.personalizable && product.ingBase?.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <h4 className="pm-section-title">¿Deseas quitar algo?</h4>
                <span className="pm-section-info">
                  Desmarca lo que no quieras
                </span>
              </div>
              <div className="pm-options">
                {product.ingBase.map((ing, idx) => {
                  const quitado = removedBase.includes(ing);
                  return (
                    <label
                      key={idx}
                      className={`pm-option ${quitado ? "pm-option--removed" : ""}`}
                    >
                      <div className="pm-option-left">
                        <span
                          className={`pm-check ${!quitado ? "pm-check--on" : ""}`}
                        >
                          {!quitado && "✓"}
                        </span>
                        <span
                          className={`pm-option-name ${quitado ? "pm-option-name--strike" : ""}`}
                        >
                          {ing}
                        </span>
                      </div>
                      {quitado && <span className="pm-sin-tag">Sin</span>}
                      <input
                        type="checkbox"
                        style={{ display: "none" }}
                        checked={!quitado}
                        onChange={() => toggleBase(ing)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* EXTRAS */}
          {product.personalizable && product.ingInter?.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <h4 className="pm-section-title">Extras</h4>
                <span className="pm-section-info">Con costo adicional</span>
              </div>
              <div className="pm-options">
                {product.ingInter.map((ing, idx) => {
                  const selected = extras.some((e) => e.nombre === ing.nombre);
                  return (
                    <label
                      key={idx}
                      className={`pm-option ${selected ? "pm-option--selected" : ""}`}
                    >
                      <div className="pm-option-left">
                        <span
                          className={`pm-check ${selected ? "pm-check--on" : ""}`}
                        >
                          {selected && "✓"}
                        </span>
                        <span className="pm-option-name">{ing.nombre}</span>
                      </div>
                      <span className="pm-option-price">
                        +${ing.precio.toLocaleString("es-CL")}
                      </span>
                      <input
                        type="checkbox"
                        style={{ display: "none" }}
                        checked={selected}
                        onChange={() => toggleExtra(ing)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOTA DEL CLIENTE */}
          {product.permitirNota && (
            <div className="pm-section">
              <div className="pm-section-header">
                <h4 className="pm-section-title">Nota para el local</h4>
                <span className="pm-section-info">Opcional</span>
              </div>
              <textarea
                className="pm-nota"
                placeholder="Ej: Sin sal, término medio, alergia a mariscos…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                maxLength={200}
              />
              {nota.length > 0 && (
                <span className="pm-nota-count">{nota.length}/200</span>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="pm-footer">
          <div className="pm-qty-main">
            <button
              className="pm-qty-main-btn"
              onClick={() => setCantidad(Math.max(1, cantidad - 1))}
            >
              −
            </button>
            <span className="pm-qty-main-val">{cantidad}</span>
            <button
              className="pm-qty-main-btn"
              onClick={() => setCantidad(cantidad + 1)}
            >
              +
            </button>
          </div>
          <button className="pm-add-btn" onClick={handleAddToCart}>
            <span>{editingItem ? "Actualizar" : "Agregar"}</span>
            <span className="pm-add-price">
              ${totalFinal.toLocaleString("es-CL")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
