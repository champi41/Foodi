// TooltipAyuda.jsx — modal de ayuda inline para grupos de electivos
import React from "react";

const AYUDA = {
  maxSeleccion: {
    titulo: "Límite de cantidad",
    desc: "El cliente puede elegir varias opciones, pero hasta un máximo que tú defines. Cada opción cobra su propio precio extra desde la primera selección o viene incluido (gratris) si el valor adicional es 0.",
    ejemplos: [
      "Roll de sushi: elige hasta 2 proteínas (Salmón +$1.500, Pollo +$1.000). Si elige ambas, se cobran los dos extras.",
      "Combo bebida: elige hasta 1 bebida de las disponibles.",
      "Pizza: elige hasta 3 ingredientes, cada uno con su precio.",
    ],
  },
  limite: {
    titulo: "Incluidas sin costo",
    desc: "El cliente puede elegir varias opciones y las primeras N van incluidas en el precio base. Si pones 0, todas cobran desde la primera. Si elige más de las incluidas, el exceso cobra el precio extra de cada opción.",
    ejemplos: [
      "Empanada: 2 ingredientes incluidos. Si quiere un 3ro, se cobra el extra del ingrediente elegido.",
      "Burrito: 3 salsas incluidas, cada salsa adicional cobra +$300.",
      "Helado: 0 toppings gratis — cada topping cobra su precio desde el primero.",
    ],
  },
};

export const TooltipAyuda = ({ tipo, onClose }) => {
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
