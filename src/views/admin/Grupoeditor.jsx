// GrupoEditor.jsx — editor de un grupo de electivos (nuevo schema con ingredientes)
import React, { useState } from "react";
import { TooltipAyuda } from "./Tooltipayuda";

// Normaliza opción a nuevo schema (incluido por defecto false)
const normOpcion = (op) => ({
  ingredienteId: op.ingredienteId ?? null,
  nombre: op.nombre ?? "",
  extra: op.extra ?? 0,
  incluido: op.incluido ?? false,
});

export const GrupoEditor = ({ grupo, index, onChange, onRemove, ingredientes = [] }) => {
  const [ayudaActiva, setAyudaActiva] = useState(null);
  const [limiteStr, setLimiteStr] = useState(String(grupo.limite ?? ""));
  const [incluidasStr, setIncluidasStr] = useState(String(grupo.incluidasGratis ?? ""));

  const opciones = (grupo.opciones || []).map(normOpcion);

  const update = (field, value) => {
    const updated = { ...grupo, [field]: value };
    if (field === "tipo" && value === "single") {
      updated.limite = null;
      updated.incluidasGratis = null;
      setLimiteStr("");
      setIncluidasStr("");
    }
    onChange(index, updated);
  };

  const modoLimiteCantidad =
    grupo.tipo === "multiple" &&
    grupo.limite != null &&
    grupo.incluidasGratis == null;
  const modoIncluidasGratis =
    grupo.tipo === "multiple" && grupo.incluidasGratis != null;

  const showIncluidoPorOpcion = () => {
    if (grupo.tipo === "single") return true;
    if (modoLimiteCantidad) return true;
    return false;
  };

  const updateOpcion = (oi, field, value) => {
    const newOpciones = opciones.map((op, i) => {
      if (i !== oi) return op;
      const next = { ...op, [field]: value };
      if (field === "incluido" && value === true) next.extra = 0;
      return next;
    });
    onChange(index, { ...grupo, opciones: newOpciones });
  };

  const removeOpcion = (oi) => {
    if (opciones.length <= 1) return;
    onChange(index, {
      ...grupo,
      opciones: opciones.filter((_, i) => i !== oi),
    });
  };

  const toggleIngrediente = (ing) => {
    const exists = opciones.some((op) => op.ingredienteId === ing.id);
    if (exists) {
      onChange(index, {
        ...grupo,
        opciones: opciones.filter((op) => op.ingredienteId !== ing.id),
      });
    } else {
      onChange(index, {
        ...grupo,
        opciones: [
          ...opciones,
          {
            ingredienteId: ing.id,
            nombre: ing.nombre,
            extra: ing.extra ?? 0,
            incluido: false,
          },
        ],
      });
    }
  };

  const handleLimiteChange = (raw) => {
    setLimiteStr(raw);
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      onChange(index, {
        ...grupo,
        limite: Math.max(1, n),
        incluidasGratis: null,
      });
      setIncluidasStr("");
    }
  };

  const handleIncluidasChange = (raw) => {
    setIncluidasStr(raw);
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      onChange(index, {
        ...grupo,
        incluidasGratis: Math.max(0, n),
        limite: null,
      });
      setLimiteStr("");
    }
  };

  const activarModoLimite = () => {
    setLimiteStr("2");
    setIncluidasStr("");
    onChange(index, { ...grupo, limite: 2, incluidasGratis: null });
  };

  const activarModoIncluidas = () => {
    setIncluidasStr("1");
    setLimiteStr("");
    onChange(index, { ...grupo, incluidasGratis: 1, limite: null });
  };

  const ingredientesByCat = {};
  ingredientes.forEach((ing) => {
    const c = ing.categoria || "Sin categoría";
    if (!ingredientesByCat[c]) ingredientesByCat[c] = [];
    ingredientesByCat[c].push(ing);
  });

  return (
    <div className="grupo-editor">
      {ayudaActiva && (
        <TooltipAyuda tipo={ayudaActiva} onClose={() => setAyudaActiva(null)} />
      )}

      <div className="grupo-header">
        <div className="grupo-header-fields">
          <input
            className="input-grupo-nombre"
            placeholder="Nombre del grupo (ej: Proteína, Salsas)"
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

      {/* Opciones ya elegidas: lista con nombre, extra, incluido (si aplica) */}
      <div
        className={`grupo-opciones ${showIncluidoPorOpcion() ? "grupo-opciones--con-incluido" : ""}`}
      >
        <div className="opciones-header-row">
          <span>Opción</span>
          <span>$ extra</span>
          {showIncluidoPorOpcion() && <span>Incluido</span>}
        </div>
        {opciones.map((op, oi) => (
          <div key={oi} className="opcion-row">
            <input
              placeholder="Nombre"
              value={op.nombre}
              onChange={(e) => updateOpcion(oi, "nombre", e.target.value)}
            />
            {showIncluidoPorOpcion() && op.incluido ? (
              <div className="opcion-precio-wrap opcion-precio-wrap--disabled">
                <span className="opcion-precio-incluido">—</span>
              </div>
            ) : (
              <div className="opcion-precio-wrap">
                <span className="precio-prefix">$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={op.extra > 0 ? op.extra : ""}
                  onChange={(e) =>
                    updateOpcion(oi, "extra", Number(e.target.value) || 0)
                  }
                />
              </div>
            )}
            {showIncluidoPorOpcion() && (
              <label className="opcion-incluido-label">
                <input
                  type="checkbox"
                  checked={op.incluido}
                  onChange={(e) =>
                    updateOpcion(oi, "incluido", e.target.checked)
                  }
                />
                <span>$0</span>
              </label>
            )}
            {opciones.length > 1 && (
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

      {/* Catálogo de ingredientes: checkboxes por categoría */}
      {ingredientes.length > 0 && (
        <div className="grupo-catalogo">
          <span className="grupo-catalogo-title">Agregar desde el catálogo</span>
          <div className="grupo-catalogo-grid">
            {Object.entries(ingredientesByCat).map(([cat, list]) => (
              <div key={cat} className="grupo-catalogo-cat">
                <span className="grupo-catalogo-cat-name">{cat}</span>
                <div className="grupo-catalogo-checkboxes">
                  {list.map((ing) => {
                    const selected = opciones.some(
                      (op) => op.ingredienteId === ing.id,
                    );
                    return (
                      <label
                        key={ing.id}
                        className={`grupo-catalogo-chip ${selected ? "grupo-catalogo-chip--on" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleIngrediente(ing)}
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
        </div>
      )}

      {/* Config solo para tipo múltiple */}
      {grupo.tipo === "multiple" && (
        <div className="grupo-multiple-config">
          <div className="config-row-check">
            <div className="config-row-label-row">
              <label className="config-check-label">
                <input
                  type="radio"
                  name={`multi-mode-${index}`}
                  checked={modoLimiteCantidad}
                  onChange={activarModoLimite}
                />
                <span>Límite de cantidad — cada opción cobra su precio</span>
              </label>
              <button
                type="button"
                className="btn-ayuda"
                onClick={() => setAyudaActiva("maxSeleccion")}
              >
                ?
              </button>
            </div>
            {modoLimiteCantidad && (
              <div className="config-inline-input">
                <span className="config-inline-label">Máximo:</span>
                <input
                  type="number"
                  min="1"
                  value={limiteStr}
                  onChange={(e) => handleLimiteChange(e.target.value)}
                  onBlur={() => {
                    if (limiteStr === "" || limiteStr === "0") {
                      setLimiteStr("2");
                      update("limite", 2);
                    }
                  }}
                />
                <span className="limite-hint">
                  Hasta {grupo.limite} opción
                  {grupo.limite > 1 ? "es" : ""}; marca "Incluido" las que sean $0
                </span>
              </div>
            )}
          </div>

          <div className="config-row-check">
            <div className="config-row-label-row">
              <label className="config-check-label">
                <input
                  type="radio"
                  name={`multi-mode-${index}`}
                  checked={modoIncluidasGratis}
                  onChange={activarModoIncluidas}
                />
                <span>N incluidas gratis — el exceso cobra extra</span>
              </label>
              <button
                type="button"
                className="btn-ayuda"
                onClick={() => setAyudaActiva("limite")}
              >
                ?
              </button>
            </div>
            {modoIncluidasGratis && (
              <div className="config-inline-input">
                <span className="config-inline-label">Incluidas gratis:</span>
                <input
                  type="number"
                  min="0"
                  value={incluidasStr}
                  onChange={(e) => handleIncluidasChange(e.target.value)}
                  onBlur={() => {
                    if (incluidasStr === "") {
                      setIncluidasStr("0");
                      update("incluidasGratis", 0);
                    }
                  }}
                />
                <span className="limite-hint">
                  {grupo.incluidasGratis === 0
                    ? "Todas cobran desde la primera"
                    : `Las primeras ${grupo.incluidasGratis} gratis, el resto cobra extra`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grupo-flags">
        <label className="flag-label">
          <input
            type="checkbox"
            checked={grupo.requerido}
            onChange={(e) => update("requerido", e.target.checked)}
          />
          <span>Obligatorio — el cliente debe elegir antes de agregar al carrito</span>
        </label>
      </div>
    </div>
  );
};
