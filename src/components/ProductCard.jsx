import { useState } from "react";
import "./ProductCard.css";
import { ChevronDown, ChevronUp } from "lucide-react";
export const ProductCard = ({ product, onOpen, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  const getMinPrice = () => {
    let min = product.precio_base;
    if (product.grupos?.length > 0) {
      product.grupos.forEach((g) => {
        if (g.requerido && g.tipo === "single" && g.opciones?.length > 0) {
          const extras = g.opciones
            .filter((op) => op.nombre.trim() !== "")
            .map((op) => op.extra || 0);
          if (extras.length > 0) min += Math.min(...extras);
        }
      });
    }
    return min;
  };

  const hasOptions = product.grupos?.length > 0 || product.personalizable;
  const minPrice = getMinPrice();

  return (
    <article
      className={`pcard ${expanded ? "pcard--expanded" : ""} ${product.imagen ? "pcard--has-img" : ""} ${disabled ? "pcard--disabled" : ""}`}
      onClick={() => product.descripcion && setExpanded(!expanded)}
    >
      {product.imagen && (
        <div className="pcard__img-wrap">
          <img
            src={product.imagen}
            alt={product.nombre}
            className="pcard__img"
          />
          {product.es_promocion && (
            <span className="pcard__promo-tag">Promo</span>
          )}
        </div>
      )}

      <div className="pcard__body">
        <div className="pcard__top">
          <div className="pcard__text">
            <h3 className="pcard__name">{product.nombre}</h3>
            {product.descripcion && (
              <div
                className={`pcard__desc ${expanded ? "pcard__desc--open" : ""}`}
              >
                <p>{product.descripcion}</p>
              </div>
            )}
          </div>
        </div>
        <div className="btnPrecio">
          <div className="pcard__right">
            <span className="pcard__price">
              {hasOptions && <span className="pcard__desde">desde </span>}$
              {minPrice.toLocaleString("es-CL")}
            </span>
          </div>
          {product.descripcion && (
            <span className="pcard__expand-hint">{expanded ? <ChevronUp/> : <ChevronDown/>}</span>
          )}
          <button
            className={`pcard__btn ${hasOptions ? "pcard__btn--options" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onOpen();
            }}
            disabled={disabled}
          >
            {hasOptions ? "Personalizar" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
};
