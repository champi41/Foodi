// GrupoEditor.jsx — editor de un grupo de electivos
// Fixes aplicados:
//   1. Eliminado modo "sin restricciones" — se logra con limite=0
//   2. Input numérico no desaparece al borrar: se guarda como string local
//      y solo se convierte a número al confirmar (onBlur / onChange final)
import React, { useState } from "react";
import { TooltipAyuda } from "./TooltipAyuda";

export const GrupoEditor = ({ grupo, index, onChange, onRemove }) => {
  const [ayudaActiva, setAyudaActiva] = useState(null);

  // ── Valores locales como string para que el input no desaparezca al borrar ──
  const [maxStr, setMaxStr] = useState(String(grupo.maxSeleccion ?? ""));
  const [limStr, setLimStr] = useState(String(grupo.limite ?? ""));

  const update = (field, value) => {
    const updated = { ...grupo, [field]: value };
    if (field === "tipo" && value === "single") {
      updated.limite = null;
      updated.maxSeleccion = null;
    }
    onChange(index, updated);
  };

  // ── Modo múltiple: solo dos opciones ──
  const handleMaxSeleccionToggle = () => {
    setMaxStr("2");
    setLimStr("");
    onChange(index, { ...grupo, maxSeleccion: 2, limite: null });
  };

  const handleLimiteToggle = () => {
    setLimStr("2");
    setMaxStr("");
    onChange(index, { ...grupo, limite: 2, maxSeleccion: null });
  };

  // Actualiza maxSeleccion desde el string local
  const handleMaxChange = (raw) => {
    setMaxStr(raw);

    // Si el usuario borra todo, solo actualizamos el estado local (string)
    // para no enviar 'null' y evitar que desaparezca el input.
    if (raw === "") return;

    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      update("maxSeleccion", Math.max(1, n));
    }
  };

  // Actualiza limite desde el string local
  const handleLimChange = (raw) => {
    setLimStr(raw);

    // Evitamos enviar 'null' al estado principal si el campo queda vacío
    if (raw === "") return;

    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      update("limite", Math.max(0, n));
    }
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

  // Encabezado de la columna de precio según el modo
  const getPrecioHeader = () => {
    if (grupo.tipo === "single") return "$ extra (0 = incluido)";
    if (tieneMaximo) return "$ extra por opción";
    if (tieneLimiteGratis) return "$ si excede el límite incluido";
    return "$ extra";
  };

  return (
    <div className="grupo-editor">
      {ayudaActiva && (
        <TooltipAyuda tipo={ayudaActiva} onClose={() => setAyudaActiva(null)} />
      )}

      {/* Cabecera: nombre + tipo */}
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
          {/* En modo limite=0, todas cobran, así que mostramos precio.
              En modo sin-restricciones no existente ya. */}
          <span>{getPrecioHeader()}</span>
        </div>
        {grupo.opciones.map((op, oi) => (
          <div key={oi} className="opcion-row">
            <input
              placeholder={`Ej: ${["Salmón", "Atún", "Camarón"][oi] ?? "Opción"}`}
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

      {/* Config solo para tipo múltiple — DOS opciones, no tres */}
      {grupo.tipo === "multiple" && (
        <div className="grupo-multiple-config">
          {/* Opción A: Límite de cantidad */}
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
                  value={maxStr}
                  onChange={(e) => handleMaxChange(e.target.value)}
                  onBlur={() => {
                    // Si queda vacío al salir del campo, restaurar a 2
                    if (maxStr === "" || maxStr === "0") {
                      setMaxStr("2");
                      update("maxSeleccion", 2);
                    }
                  }}
                />
                {grupo.maxSeleccion > 0 && (
                  <span className="limite-hint">
                    Hasta {grupo.maxSeleccion} opción
                    {grupo.maxSeleccion > 1 ? "es" : ""}, cada una cobra su
                    extra
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Opción B: N incluidas gratis (limite) — puede ser 0 */}
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
                  min="0"
                  value={limStr}
                  onChange={(e) => handleLimChange(e.target.value)}
                  onBlur={() => {
                    // Si queda vacío al salir del campo, restaurar a 0
                    if (limStr === "") {
                      setLimStr("0");
                      update("limite", 0);
                    }
                  }}
                />
                {grupo.limite === 0 ? (
                  <span className="limite-hint">
                    Todas las opciones cobran su precio desde la primera
                  </span>
                ) : grupo.limite > 0 ? (
                  <span className="limite-hint">
                    Las primeras {grupo.limite} son gratis, desde la{" "}
                    {grupo.limite + 1}ª se cobra el extra
                  </span>
                ) : null}
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
};;;
