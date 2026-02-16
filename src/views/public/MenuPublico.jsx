import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../../api/firebase";
import "./MenuPublico.css";

export const MenuPublico = ({ slug }) => {
  
  const [business, setBusiness] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros y Modal
  const [activeCat, setActiveCat] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null); // Para el modal

  // Carrito (Array de pedidos)
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (slug) loadBusinessData();
  }, [slug]);

  const loadBusinessData = async () => {
    try {
      // 1. Buscar el negocio por el SLUG (subdominio)
      const q = query(
        collection(db, "negocios"),
        where("slug", "==", slug),
        limit(1),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoading(false);
        return; // Negocio no existe
      }

      const businessDoc = querySnapshot.docs[0];
      const businessId = businessDoc.id;
      setBusiness({ id: businessId, ...businessDoc.data() });

      // 2. Cargar Categorías y Productos de ese negocio
      const catSnap = await getDocs(
        collection(db, `negocios/${businessId}/categorias`),
      );
      const prodSnap = await getDocs(
        collection(db, `negocios/${businessId}/productos`),
      );

      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const allProducts = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(allProducts.filter((p) => p.activo)); // Solo mostrar activos
    } catch (err) {
      console.error("Error cargando menú:", err);
    }
    setLoading(false);
  };

  // --- LÓGICA DEL CARRITO ---
  const addToCart = (item) => {
    setCart([...cart, item]);
    setSelectedProduct(null); // Cerrar modal
  };

  const getCartTotal = () => {
    return cart.reduce(
      (total, item) => total + item.precioFinal * item.cantidad,
      0,
    );
  };

  const getCartCount = () => {
    return cart.reduce((acc, item) => acc + item.cantidad, 0);
  };

  // --- FILTRADO ---
  const filteredProducts =
    activeCat === "all"
      ? products
      : products.filter((p) => p.categoria_id === activeCat);

  const promos = products.filter((p) => p.es_promocion);

  if (loading) return <div className="loading-spin">Cargando delicias...</div>;
  if (!business)
    return <div className="error-screen">Este local no existe :(</div>;

  return (
    <div className="menu-container">
      {/* 1. HEADER */}
      <header className="menu-header">
        <h1>{business.nombre}</h1>
        <p className="status-badge">Abierto</p>{" "}
        {/* Esto lo conectaremos con Config después */}
      </header>

      {/* 2. CARRUSEL PROMOCIONES */}
      {promos.length > 0 && (
        <section className="carousel-section">
          <h3>🔥 Promociones</h3>
          <div className="carousel promo-carousel">
            {promos.map((p) => (
              <div
                key={p.id}
                className="promo-card"
                onClick={() => setSelectedProduct(p)}
              >
                <div className="promo-info">
                  <h4>{p.nombre}</h4>
                  <span className="price">${p.precio_base}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. CARRUSEL CATEGORÍAS */}
      <section className="categories-sticky">
        <div className="carousel cat-carousel">
          <button
            className={`cat-pill ${activeCat === "all" ? "active" : ""}`}
            onClick={() => setActiveCat("all")}
          >
            Todo
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`cat-pill ${activeCat === c.id ? "active" : ""}`}
              onClick={() => setActiveCat(c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </section>

      {/* 4. LISTA DE PRODUCTOS */}
      <div className="menu-list">
        {filteredProducts.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onOpen={() => setSelectedProduct(p)}
          />
        ))}
      </div>

      {/* 5. MODAL DE PRODUCTO (Personalización) */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
        />
      )}

      {/* 6. NOTIFICACIÓN FLOTANTE (CARRITO) */}
      {cart.length > 0 && (
        <div className="sticky-cart">
          <div className="cart-info">
            <span className="badge-count">{getCartCount()}</span>
            <div className="cart-text">
              <small>Total estimado</small>
              <strong>${getCartTotal()}</strong>
            </div>
          </div>
          <button className="btn-go-cart">Ver Carrito &rarr;</button>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTES HIJOS (Para mantener limpio el código) ---

const ProductCard = ({ product, onOpen }) => {
  // Lógica "Desde"
  const getMinPrice = () => {
    let min = product.precio_base;
    if (product.electivos?.length > 0) {
      const minExtra = Math.min(...product.electivos.map((e) => e.extra));
      min += minExtra;
    }
    return min;
  };

  const hasOptions = product.electivos?.length > 0 || product.personalizable;

  return (
    <div className="menu-item">
      <div className="item-info">
        <h4>{product.nombre}</h4>
        <p className="desc">{product.descripcion}</p>
        <span className="item-price">
          {hasOptions ? "Desde " : ""}${getMinPrice()}
        </span>
      </div>
      <div className="item-action">
        <button className="btn-add-item" onClick={onOpen}>
          {hasOptions ? "Personalizar" : "Agregar"}
        </button>
      </div>
    </div>
  );
};

// --- EL CEREBRO: MODAL DE PERSONALIZACIÓN ---
const ProductModal = ({ product, onClose, onAdd }) => {
  const [cantidad, setCantidad] = useState(1);
  // Estado para Electivos (Radio buttons) - Guardamos el objeto completo
  const [seleccionElectivos, setSeleccionElectivos] = useState({});

  // Estado para Ingredientes Base (Checks para quitar)
  const [removedBase, setRemovedBase] = useState([]);

  // Estado para Extras (Checks para sumar)
  const [extras, setExtras] = useState([]);

  // Calcular precio dinámico
  const calculateTotal = () => {
    let total = product.precio_base;

    // Sumar electivos seleccionados
    Object.values(seleccionElectivos).forEach((el) => (total += el.extra));

    // Sumar extras
    extras.forEach((ex) => (total += ex.precio));

    return total * cantidad;
  };

  const handleAddToCart = () => {
    // Validar electivos obligatorios
    // Aquí asumimos que todos los grupos de electivos son requeridos (lógica simple por ahora)
    if (
      product.electivos?.length > 0 &&
      Object.keys(seleccionElectivos).length === 0
    ) {
      alert("Por favor selecciona una opción obligatoria");
      return;
    }

    const itemPedido = {
      uid: Date.now(), // ID único temporal para el array
      productoOriginal: product,
      nombre: product.nombre,
      electivos: Object.values(seleccionElectivos),
      sinIngredientes: removedBase,
      extras: extras,
      cantidad: cantidad,
      precioUnitario: calculateTotal() / cantidad,
      precioFinal: calculateTotal(),
    };

    onAdd(itemPedido);
  };

  const toggleExtra = (ing) => {
    if (extras.some((e) => e.nombre === ing.nombre)) {
      setExtras(extras.filter((e) => e.nombre !== ing.nombre));
    } else {
      setExtras([...extras, ing]);
    }
  };

  const toggleBase = (nombreIng) => {
    if (removedBase.includes(nombreIng)) {
      setRemovedBase(removedBase.filter((n) => n !== nombreIng));
    } else {
      setRemovedBase([...removedBase, nombreIng]);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="sheet-modal">
        <div className="sheet-header">
          <h3>{product.nombre}</h3>
          <button onClick={onClose} className="close-x">
            ×
          </button>
        </div>

        <div className="sheet-content">
          <p className="sheet-desc">{product.descripcion}</p>

          {/* 1. ELECTIVOS (Radio Buttons) */}
          {product.electivos?.length > 0 && (
            <div className="sheet-section">
              <h4>Elige una opción (Obligatorio)</h4>
              {product.electivos.map((el, idx) => (
                <label key={idx} className="radio-row">
                  <div className="radio-label">
                    <input
                      type="radio"
                      name={`electivo_group`}
                      onChange={() =>
                        setSeleccionElectivos({
                          ...seleccionElectivos,
                          [idx]: el,
                        })
                      }
                      checked={seleccionElectivos[idx]?.nombre === el.nombre}
                    />
                    {el.nombre}
                  </div>
                  <span>{el.extra > 0 ? `+ $${el.extra}` : "Incluido"}</span>
                </label>
              ))}
            </div>
          )}

          {/* 2. INGREDIENTES BASE (Quitar) */}
          {product.personalizable && product.ingBase?.length > 0 && (
            <div className="sheet-section">
              <h4>¿Deseas quitar algo?</h4>
              {product.ingBase.map((ing, idx) => (
                <label key={idx} className="check-row">
                  <div className="check-label">
                    <input
                      type="checkbox"
                      checked={!removedBase.includes(ing)} // Checkeado significa "Lo quiero"
                      onChange={() => toggleBase(ing)}
                    />
                    <span>{ing}</span>
                  </div>
                  <span className="info-text">
                    {removedBase.includes(ing) ? "Sin" : ""}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* 3. EXTRAS / INTERCAMBIOS */}
          {product.personalizable && product.ingInter?.length > 0 && (
            <div className="sheet-section">
              <h4>Extras o Cambios</h4>
              {product.ingInter.map((ing, idx) => (
                <label key={idx} className="check-row">
                  <div className="check-label">
                    <input
                      type="checkbox"
                      checked={extras.some((e) => e.nombre === ing.nombre)}
                      onChange={() => toggleExtra(ing)}
                    />
                    <span>{ing.nombre}</span>
                  </div>
                  <span>+${ing.precio}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER DEL MODAL */}
        <div className="sheet-footer">
          <div className="qty-control">
            <button onClick={() => setCantidad(Math.max(1, cantidad - 1))}>
              -
            </button>
            <span>{cantidad}</span>
            <button onClick={() => setCantidad(cantidad + 1)}>+</button>
          </div>
          <button className="btn-add-cart" onClick={handleAddToCart}>
            Agregar ${calculateTotal()}
          </button>
        </div>
      </div>
    </div>
  );
};
