// CatModal.jsx — modal para crear una nueva categoría
import React, { useState } from "react";

export const CatModal = ({ onSave, onClose }) => {
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
