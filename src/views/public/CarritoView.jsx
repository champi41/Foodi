import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../api/firebase";
import "./CarritoView.css";

export const CarritoView = ({
  cart,
  business,
  onClose,
  onRemoveItem,
  onEditItem,
  clearCart,
}) => {
  const config = business || {};
  const tiposEntrega = config.tiposEntrega || { retiro: true, delivery: false };
  const zonasDelivery = config.zonasDelivery || [];

  const defaultEntrega = tiposEntrega.retiro ? "retiro" : "delivery";

  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [deliveryType, setDeliveryType] = useState(defaultEntrega);
  const [zonaSeleccionada, setZona] = useState(null);
  const [paymentMethod, setPayment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedPayment, setSavedPayment] = useState("");

  const deliveryCost =
    deliveryType === "delivery" && zonaSeleccionada
      ? zonaSeleccionada.precio
      : 0;
  const subtotal = cart.reduce((acc, item) => acc + item.precioFinal, 0);
  const total = subtotal + deliveryCost;

  const metodosPagoDisponibles = Object.entries(config.metodosPago || {})
    .filter(([, m]) => {
      if (!m?.activo) return false;
      if (deliveryType === "retiro") return m.retiro !== false;
      if (deliveryType === "delivery") return m.delivery !== false;
      return true;
    })
    .map(([key]) => key);

  const labelPago = {
    efectivo: { emoji: "💵", label: "Efectivo" },
    transferencia: { emoji: "🏦", label: "Transferencia" },
    tarjetaPresencial: { emoji: "💳", label: "Tarjeta" },
  };

  const getResumenSelecciones = (item) => {
    const partes = [];
    if (item.selecciones) {
      Object.entries(item.selecciones).forEach(([, { grupoNombre, sel }]) => {
        const items = Array.isArray(sel) ? sel : sel ? [sel] : [];
        if (items.length > 0) {
          const texto = items
            .map((s) =>
              s.cantidad > 1 ? `${s.nombre} x${s.cantidad}` : s.nombre,
            )
            .join(", ");
          partes.push(`${grupoNombre}: ${texto}`);
        }
      });
    }
    if (item.sinIngredientes?.length > 0)
      partes.push(`Sin: ${item.sinIngredientes.join(", ")}`);
    if (item.extras?.length > 0)
      partes.push(`Extras: ${item.extras.map((e) => e.nombre).join(", ")}`);
    if (item.nota) partes.push(`📝 ${item.nota}`);
    return partes;
  };

  const handleChangeEntrega = (tipo) => {
    setDeliveryType(tipo);
    setPayment("");
    setZona(null);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!paymentMethod) return alert("Selecciona un método de pago");
    if (cart.length === 0) return alert("Tu carrito está vacío");
    if (
      deliveryType === "delivery" &&
      zonasDelivery.length > 0 &&
      !zonaSeleccionada
    )
      return alert("Selecciona tu zona de envío");

    setIsSubmitting(true);

    const itemsLimpios = cart.map(({ productoOriginal, ...item }) => {
      const seleccionesEnriquecidas = {};
      Object.entries(item.selecciones || {}).forEach(([gi, sel]) => {
        const grupo = productoOriginal?.grupos?.[Number(gi)];
        seleccionesEnriquecidas[gi] = {
          grupoNombre: grupo?.grupo ?? `Opción ${Number(gi) + 1}`,
          sel,
        };
      });
      return { ...item, selecciones: seleccionesEnriquecidas };
    });

    const newOrder = {
      cliente: { ...customer, zona: zonaSeleccionada?.nombre || null },
      tipoEntrega: deliveryType,
      metodoPago: paymentMethod,
      items: itemsLimpios,
      subtotal,
      costoEnvio: deliveryCost,
      total,
      estado: "pendiente",
      fecha: serverTimestamp(),
      viewed: false,
    };

    try {
      const docRef = await addDoc(
        collection(db, `negocios/${business.id}/pedidos`),
        newOrder,
      );
      setSavedTotal(total);
      setSavedPayment(paymentMethod);
      setOrderId(docRef.id);
      clearCart();
    } catch (error) {
      console.error("Error creando pedido:", error);
      alert("Hubo un error al enviar el pedido. Intenta nuevamente.");
      setIsSubmitting(false);
    }
  };

  // ── PANTALLA DE ÉXITO ──
  if (orderId) {
    const db = config.datosBancarios || {};
    const whatsappMsg = `Hola! Hice el pedido *#${orderId.slice(-4)}*. ¿Me lo confirman?`;
    const whatsappLink = `https://wa.me/${config.whatsapp?.replace("+", "")}?text=${encodeURIComponent(whatsappMsg)}`;

    return (
      <div className="cv-overlay">
        <div className="cv-success">
          <div className="cv-success__icon">✓</div>
          <h2 className="cv-success__title">¡Pedido enviado!</h2>
          <p className="cv-success__sub">
            Tu pedido <strong>#{orderId.slice(-4)}</strong> fue recibido
            correctamente.
          </p>

          {savedPayment === "transferencia" && (
            <div className="cv-bank-box">
              <p className="cv-bank-box__label">Datos para transferir</p>
              <p className="cv-bank-box__total">
                ${savedTotal.toLocaleString("es-CL")}
              </p>
              <div className="cv-bank-box__rows">
                {db.nombre && (
                  <div className="cv-bank-row">
                    <span>Nombre</span>
                    <strong>{db.nombre}</strong>
                  </div>
                )}
                {db.rut && (
                  <div className="cv-bank-row">
                    <span>RUT</span>
                    <strong>{db.rut}</strong>
                  </div>
                )}
                {db.banco && (
                  <div className="cv-bank-row">
                    <span>Banco</span>
                    <strong>{db.banco}</strong>
                  </div>
                )}
                {db.tipoCuenta && (
                  <div className="cv-bank-row">
                    <span>Tipo</span>
                    <strong>{db.tipoCuenta}</strong>
                  </div>
                )}
                {db.nroCuenta && (
                  <div className="cv-bank-row">
                    <span>N° cuenta</span>
                    <strong>{db.nroCuenta}</strong>
                  </div>
                )}
                {db.emailComprobante && (
                  <div className="cv-bank-row">
                    <span>Email</span>
                    <strong>{db.emailComprobante}</strong>
                  </div>
                )}
              </div>
              <p className="cv-bank-box__hint">
                Envía el comprobante por WhatsApp
              </p>
            </div>
          )}

          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="cv-btn-whatsapp"
          >
            <span>Avisar por WhatsApp</span>
            <span className="cv-btn-whatsapp__arrow">→</span>
          </a>
          <button className="cv-btn-back" onClick={onClose}>
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  // ── VISTA CARRITO ──
  return (
    <div className="cv-overlay">
      <div className="cv-sheet">
        {/* Header */}
        <div className="cv-header">
          <button className="cv-back" onClick={onClose}>
            <span className="cv-back__arrow">←</span>
            <span>Volver</span>
          </button>
          <h2 className="cv-title">Tu pedido</h2>
          <span className="cv-item-count">
            {cart.length} ítem{cart.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="cv-body">
          {/* ── 1. ITEMS ── */}
          <div className="cv-items">
            {cart.map((item) => {
              const resumen = getResumenSelecciones(item);
              return (
                <div key={item.uid} className="cv-item">
                  <div className="cv-item__top">
                    <div className="cv-item__qty">{item.cantidad}×</div>
                    <div className="cv-item__info">
                      <span className="cv-item__name">{item.nombre}</span>
                      {resumen.map((linea, i) => (
                        <span key={i} className="cv-item__detail">
                          {linea}
                        </span>
                      ))}
                    </div>
                    <span className="cv-item__price">
                      ${item.precioFinal.toLocaleString("es-CL")}
                    </span>
                  </div>
                  <div className="cv-item__actions">
                    <button
                      className="cv-item__edit"
                      onClick={() => onEditItem(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="cv-item__remove"
                      onClick={() => onRemoveItem(item.uid)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 2. TIPO ENTREGA ── */}
          <section className="cv-section">
            <h3 className="cv-section__title">Tipo de entrega</h3>
            <div className="cv-entrega-toggle">
              {tiposEntrega.retiro && (
                <button
                  type="button"
                  className={`cv-entrega-btn ${deliveryType === "retiro" ? "cv-entrega-btn--active" : ""}`}
                  onClick={() => handleChangeEntrega("retiro")}
                >
                  <span className="cv-entrega-btn__icon">🏪</span>
                  <span>Retiro en local</span>
                </button>
              )}
              {tiposEntrega.delivery && (
                <button
                  type="button"
                  className={`cv-entrega-btn ${deliveryType === "delivery" ? "cv-entrega-btn--active" : ""}`}
                  onClick={() => handleChangeEntrega("delivery")}
                >
                  <span className="cv-entrega-btn__icon">🛵</span>
                  <span>Delivery</span>
                </button>
              )}
            </div>
          </section>

          {/* ── 3. ZONAS ── */}
          {deliveryType === "delivery" && zonasDelivery.length > 0 && (
            <section className="cv-section">
              <h3 className="cv-section__title">Zona de envío</h3>
              <p className="cv-section__hint">
                Selecciona el sector más cercano a tu dirección
              </p>
              <div className="cv-zonas">
                {zonasDelivery.map((z, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`cv-zona-btn ${zonaSeleccionada?.nombre === z.nombre ? "cv-zona-btn--active" : ""}`}
                    onClick={() => setZona(z)}
                  >
                    <span>{z.nombre}</span>
                    <span className="cv-zona-btn__precio">
                      ${z.precio.toLocaleString("es-CL")}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <form onSubmit={handleSubmitOrder}>
            {/* ── 4. DATOS CLIENTE ── */}
            <section className="cv-section">
              <h3 className="cv-section__title">Tus datos</h3>
              <div className="cv-fields">
                <input
                  className="cv-input"
                  required
                  placeholder="Tu nombre"
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                />
                <input
                  className="cv-input"
                  required
                  type="tel"
                  placeholder="WhatsApp / Teléfono"
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
                {deliveryType === "delivery" && (
                  <input
                    className="cv-input"
                    required
                    placeholder="Dirección de envío (calle, número…)"
                    value={customer.address}
                    onChange={(e) =>
                      setCustomer({ ...customer, address: e.target.value })
                    }
                  />
                )}
              </div>
            </section>

            {/* ── 5. MÉTODO DE PAGO ── */}
            <section className="cv-section">
              <h3 className="cv-section__title">Método de pago</h3>
              {metodosPagoDisponibles.length === 0 ? (
                <p className="cv-error-text">
                  No hay métodos de pago disponibles para este tipo de entrega.
                </p>
              ) : (
                <div className="cv-pagos">
                  {metodosPagoDisponibles.map((key) => {
                    const { emoji, label } = labelPago[key] || {
                      emoji: "",
                      label: key,
                    };
                    const isSelected = paymentMethod === key;
                    return (
                      <label
                        key={key}
                        className={`cv-pago-opt ${isSelected ? "cv-pago-opt--active" : ""}`}
                      >
                        <div className="cv-pago-opt__left">
                          <span
                            className={`cv-radio ${isSelected ? "cv-radio--on" : ""}`}
                          />
                          <span className="cv-pago-opt__emoji">{emoji}</span>
                          <span className="cv-pago-opt__label">{label}</span>
                        </div>
                        <input
                          type="radio"
                          name="pago"
                          value={key}
                          style={{ display: "none" }}
                          checked={isSelected}
                          onChange={(e) => setPayment(e.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── 6. RESUMEN Y CONFIRMAR ── */}
            <div className="cv-summary">
              <div className="cv-summary__row">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString("es-CL")}</span>
              </div>
              {deliveryType === "delivery" && (
                <div className="cv-summary__row">
                  <span>
                    Envío{" "}
                    {zonaSeleccionada ? `(${zonaSeleccionada.nombre})` : ""}
                  </span>
                  <span>
                    {zonaSeleccionada
                      ? `$${deliveryCost.toLocaleString("es-CL")}`
                      : "—"}
                  </span>
                </div>
              )}
              <div className="cv-summary__row cv-summary__row--total">
                <span>Total</span>
                <span>${total.toLocaleString("es-CL")}</span>
              </div>

              <button
                type="submit"
                className="cv-confirm-btn"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? "Enviando…" : "Confirmar pedido"}</span>
                {!isSubmitting && (
                  <span className="cv-confirm-btn__price">
                    ${total.toLocaleString("es-CL")}
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
