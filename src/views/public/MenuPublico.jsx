import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../../api/firebase";
import { CarritoView } from "./CarritoView";
import { ProductModal } from "../../components/ProductModal";
import { ProductCard } from "../../components/ProductCard";
import "./MenuPublico.css";

const checkIsOpen = (business) => {
  if (!business?.horarios) return true;
  const ahora = new Date();
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  const h = business.horarios[dias[ahora.getDay()]];
  if (!h?.abierto) return false;
  const toMin = (t) => {
    if (!t) return 0;
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };
  const now = ahora.getHours() * 60 + ahora.getMinutes();
  if (now < toMin(h.inicio) || now > toMin(h.fin)) return false;
  if (h.descanso && now >= toMin(h.dInicio) && now <= toMin(h.dFin))
    return false;
  return true;
};

// Convierte hex a rgba para generar la versión dim del acento
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const aplicarTema = (tema) => {
  const root = document.documentElement;
  const acento = tema?.acento || "#ffb347";

  // Acento siempre se aplica
  root.style.setProperty("--mp-accent", acento);
  root.style.setProperty("--mp-accent-dim", hexToRgba(acento, 0.15));

  if (tema?.modo === "light") {
    root.style.setProperty("--mp-bg", "#fafaf8");
    root.style.setProperty("--mp-surface", "#f0f0ec");
    root.style.setProperty("--mp-card", "#ffffff");
    root.style.setProperty("--mp-border", "rgba(0,0,0,0.07)");
    root.style.setProperty("--mp-text", "#1a1a18");
    root.style.setProperty("--mp-muted", "#9a9890");
    // El cart bar en light usa el color de texto oscuro sobre fondo claro
    root.style.setProperty("--mp-cart-bg", "#1a1a18");
    root.style.setProperty("--mp-cart-fg", "#fafaf8");
  } else {
    // Restaurar dark (default)
    root.style.setProperty("--mp-bg", "#111110");
    root.style.setProperty("--mp-surface", "#1a1a18");
    root.style.setProperty("--mp-card", "#1e1e1c");
    root.style.setProperty("--mp-border", "rgba(255,255,255,0.07)");
    root.style.setProperty("--mp-text", "#f0ece4");
    root.style.setProperty("--mp-muted", "#6b6860");
    root.style.setProperty("--mp-cart-bg", "#f0ece4");
    root.style.setProperty("--mp-cart-fg", "#111110");
  }
};

export const MenuPublico = ({ slug }) => {
  const [business, setBusiness] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [activeCat, setActiveCat] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState(null);

  useEffect(() => {
    if (slug) loadBusinessData();
  }, [slug]);

  // Aplicar tema cuando lleguen los datos del negocio
  useEffect(() => {
    if (!business) return;
    aplicarTema(business.tema);
    setIsOpen(checkIsOpen(business));
    const iv = setInterval(() => setIsOpen(checkIsOpen(business)), 60000);
    return () => {
      clearInterval(iv);
      // Al desmontar, restaurar variables por defecto para no afectar otras páginas
      aplicarTema({ modo: "dark", acento: "#ffb347" });
    };
  }, [business]);

  const loadBusinessData = async () => {
    try {
      const q = query(
        collection(db, "negocios"),
        where("slug", "==", slug),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setLoading(false);
        return;
      }
      const bData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setBusiness(bData);
      // Aplicar tema de inmediato, sin esperar el useEffect, para evitar flash
      aplicarTema(bData.tema);
      const [catSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, `negocios/${bData.id}/categorias`)),
        getDocs(collection(db, `negocios/${bData.id}/productos`)),
      ]);
      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setProducts(
        prodSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => p.activo),
      );
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleProductClick = (p) => {
    if (!isOpen) return;
    setSelectedProduct(p);
  };

  const addToCart = (item) => {
    const idx = cart.findIndex((i) => i.uid === item.uid);
    if (idx >= 0) {
      const nc = [...cart];
      nc[idx] = item;
      setCart(nc);
    } else {
      setCart([...cart, item]);
    }
    setSelectedProduct(null);
    setEditingCartItem(null);
    if (editingCartItem) setShowCart(true);
  };

  const handleEditItem = (item) => {
    setEditingCartItem(item);
    setSelectedProduct(item.productoOriginal);
    setShowCart(false);
  };

  const removeFromCart = (uid) => setCart(cart.filter((i) => i.uid !== uid));
  const getCartTotal = () => cart.reduce((t, i) => t + i.precioFinal, 0);
  const getCartCount = () => cart.reduce((t, i) => t + i.cantidad, 0);

  const filteredProducts =
    activeCat === "all"
      ? products
      : products.filter((p) => p.categoria_id === activeCat);

  const promos = products.filter((p) => p.es_promocion);

  if (loading)
    return (
      <div className="mp-loading">
        <span className="mp-loading__dot" />
        <span className="mp-loading__dot" />
        <span className="mp-loading__dot" />
      </div>
    );

  if (!business) return <div className="mp-not-found">Local no encontrado</div>;

  return (
    <div className="mp">
      {/* ── HEADER ── */}
      <header className="mp-header">
        <div className="mp-header__inner">
          <h1 className="mp-header__name">{business.nombre}</h1>
          <div
            className={`mp-status ${isOpen ? "mp-status--open" : "mp-status--closed"}`}
          >
            <span className="mp-status__dot" />
            {isOpen ? "Abierto" : "Cerrado"}
          </div>
        </div>
        {!isOpen && (
          <p className="mp-closed-msg">
            Estamos fuera de horario o en descanso — ¡volvemos pronto!
          </p>
        )}
      </header>

      {/* ── PROMOCIONES ── */}
      {promos.length > 0 && (
        <section className="mp-promos">
          <p className="mp-section-label">Destacados</p>
          <div className="mp-promos__scroll">
            {promos.map((p) => (
              <button
                key={p.id}
                className="mp-promo-card"
                onClick={() => handleProductClick(p)}
                disabled={!isOpen}
              >
                {p.imagen && (
                  <img
                    src={p.imagen}
                    alt={p.nombre}
                    className="mp-promo-card__img"
                  />
                )}
                <div className="mp-promo-card__overlay">
                  <span className="mp-promo-card__name">{p.nombre}</span>
                  <span className="mp-promo-card__price">
                    ${p.precio_base?.toLocaleString("es-CL")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── CATEGORÍAS ── */}
      {categories.length > 0 && (
        <div className="mp-cats">
          <button
            className={`mp-cat-pill ${activeCat === "all" ? "mp-cat-pill--active" : ""}`}
            onClick={() => setActiveCat("all")}
          >
            Todo
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`mp-cat-pill ${activeCat === c.id ? "mp-cat-pill--active" : ""}`}
              onClick={() => setActiveCat(c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* ── LISTA ── */}
      <div className="mp-list">
        {filteredProducts.map((p, i) => (
          <div
            key={p.id}
            className="mp-list__item"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <ProductCard
              product={p}
              onOpen={() => handleProductClick(p)}
              disabled={!isOpen}
            />
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <p className="mp-empty">Sin productos en esta categoría</p>
        )}
      </div>

      {/* ── MODAL PRODUCTO ── */}
      {selectedProduct && isOpen && (
        <ProductModal
          product={selectedProduct}
          editingItem={editingCartItem}
          onClose={() => {
            setSelectedProduct(null);
            setEditingCartItem(null);
            if (editingCartItem) setShowCart(true);
          }}
          onAdd={addToCart}
        />
      )}

      {/* ── STICKY CART ── */}
      {cart.length > 0 && !showCart && isOpen && (
        <div className="mp-cart-bar" onClick={() => setShowCart(true)}>
          <div className="mp-cart-bar__left">
            <span className="mp-cart-bar__count">{getCartCount()}</span>
            <span className="mp-cart-bar__label">Ver pedido</span>
          </div>
          <span className="mp-cart-bar__total">
            ${getCartTotal().toLocaleString("es-CL")}
          </span>
        </div>
      )}

      {/* ── CARRITO ── */}
      {showCart && isOpen && (
        <CarritoView
          cart={cart}
          business={business}
          onClose={() => setShowCart(false)}
          onRemoveItem={removeFromCart}
          onEditItem={handleEditItem}
          clearCart={() => setCart([])}
        />
      )}
    </div>
  );
};
