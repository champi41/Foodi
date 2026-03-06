// CatIngredienteModal.jsx — modal para crear categoría de ingredientes
import React, { useState } from "react";

export const CatIngredienteModal = ({ onSave, onClose }) => {
  const [nombre, setNombre] = useState("");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
        <h3>Nueva categoría de ingredientes</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim()) onSave(nombre.trim());
          }}
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proteína, Salsas, Vegetales"
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
