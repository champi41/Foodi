import React, { useState, useEffect } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../api/firebase";
import {
  geocodificar,
  distanciaLineaRectaKm,
  encontrarRango,
} from "../../utils/delivery";
import "./CarritoView.css";
import { ChevronLeft } from "lucide-react";

const STORAGE_KEY = "mp_customer_data";

// Lee los datos guardados del navegador, o devuelve vacío
const loadCustomer = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { name: "", phone: "", address: "" };
  } catch {
    return { name: "", phone: "", address: "" };
  }
};

// Guarda los datos del cliente en el navegador
const saveCustomer = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage puede estar bloqueado en modo privado — no es crítico
  }
};

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
  const deliveryConfig = config.deliveryConfig || null;

  const defaultEntrega = tiposEntrega.retiro ? "retiro" : "delivery";

  // Precarga con datos guardados si existen
  const [customer, setCustomer] = useState(loadCustomer);
  const [deliveryType, setDeliveryType] = useState(defaultEntrega);
  const [paymentMethod, setPayment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedPayment, setSavedPayment] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("idle");
  const [deliveryKm, setDeliveryKm] = useState(null);
  const [deliveryRango, setDeliveryRango] = useState(null);

  // ── Cierre con animación ──
  const [closing, setClosing] = useState(false);
  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 400);
  };

  const handleEdit = (item) => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onEditItem(item), 400);
  };

  // Actualiza el estado y persiste en localStorage al mismo tiempo
  const handleCustomerChange = (field, value) => {
    const updated = { ...customer, [field]: value };
    setCustomer(updated);
    saveCustomer(updated);
  };

  // Resetear cálculo de envío si el cliente cambia la dirección después de calcular
  useEffect(() => {
    if (deliveryType !== "delivery" || !deliveryConfig) return;
    if (
      deliveryStatus !== "idle" &&
      deliveryStatus !== "loading" &&
      customer.address
    ) {
      setDeliveryStatus("idle");
      setDeliveryKm(null);
      setDeliveryRango(null);
    }
  }, [customer.address]);

  const handleCalcularCostoEnvio = async () => {
    if (!deliveryConfig?.coordenadasLocal || !customer.address?.trim()) return;
    setDeliveryStatus("loading");
    setDeliveryKm(null);
    setDeliveryRango(null);
    try {
      const coordsCliente = await geocodificar(customer.address.trim());
      if (!coordsCliente) {
        setDeliveryStatus("error");
        return;
      }
      // Distancia en línea recta para que coincida con los círculos del mapa (Haversine)
      const km = distanciaLineaRectaKm(
        deliveryConfig.coordenadasLocal,
        coordsCliente,
      );
      const rango = encontrarRango(
        km,
        deliveryConfig.rangos || [],
        deliveryConfig.kmMaximo ?? 0,
      );
      if (rango) {
        setDeliveryStatus("success");
        setDeliveryKm(km);
        setDeliveryRango(rango);
      } else {
        setDeliveryStatus("out_of_range");
        setDeliveryKm(km);
        setDeliveryRango(null);
      }
    } catch {
      setDeliveryStatus("error");
    }
  };

  const deliveryCost =
    deliveryType === "delivery" && deliveryConfig && deliveryRango
      ? deliveryRango.precio
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
    setDeliveryStatus("idle");
    setDeliveryKm(null);
    setDeliveryRango(null);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!paymentMethod) return alert("Selecciona un método de pago");
    if (cart.length === 0) return alert("Tu carrito está vacío");
    if (deliveryType === "delivery" && deliveryConfig && deliveryStatus !== "success")
      return alert("Por favor calcula el costo de envío antes de confirmar");

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
      cliente: {
        ...customer,
        deliveryKm:
          deliveryConfig && deliveryKm != null
            ? Math.round(deliveryKm * 10) / 10
            : null,
        deliveryLabel: deliveryRango?.label ?? null,
      },
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
    const bancarios = config.datosTransferencia || config.datosBancarios || {};
    const whatsappMsg = `Hola! Hice el pedido *#${orderId.slice(-4)}*. ¿Me lo confirman?`;
    const whatsappLink = `https://wa.me/${config.whatsapp?.replace("+", "")}?text=${encodeURIComponent(whatsappMsg)}`;

    return (
      <div className={`cv-overlay ${closing ? "cv-overlay--closing" : ""}`}>
        <div className={`cv-success ${closing ? "cv-sheet--closing" : ""}`}>
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
                {bancarios.nombre && (
                  <div className="cv-bank-row">
                    <span>Nombre</span>
                    <strong>{bancarios.nombre}</strong>
                  </div>
                )}
                {bancarios.rut && (
                  <div className="cv-bank-row">
                    <span>RUT</span>
                    <strong>{bancarios.rut}</strong>
                  </div>
                )}
                {bancarios.banco && (
                  <div className="cv-bank-row">
                    <span>Banco</span>
                    <strong>{bancarios.banco}</strong>
                  </div>
                )}
                {bancarios.tipoCuenta && (
                  <div className="cv-bank-row">
                    <span>Tipo</span>
                    <strong>{bancarios.tipoCuenta}</strong>
                  </div>
                )}
                {bancarios.nroCuenta && (
                  <div className="cv-bank-row">
                    <span>N° cuenta</span>
                    <strong>{bancarios.nroCuenta}</strong>
                  </div>
                )}
                {bancarios.emailComprobante && (
                  <div className="cv-bank-row">
                    <span>Email</span>
                    <strong>{bancarios.emailComprobante}</strong>
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
          <button className="cv-btn-back" onClick={handleClose}>
            Volver al menú
          </button>
        </div>
      </div>
    );
  }

  // ── VISTA CARRITO ──
  const hasStoredData = !!(customer.name || customer.phone);

  return (
    <div
      className={`cv-overlay ${closing ? "cv-overlay--closing" : ""}`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`cv-sheet ${closing ? "cv-sheet--closing" : ""}`}>
        {/* Header */}
        <div className="cv-header">
          <button className="cv-back" onClick={handleClose}>
            <ChevronLeft />
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
                      onClick={() => handleEdit(item)}
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

          <form onSubmit={handleSubmitOrder}>
            {/* ── 4. DATOS CLIENTE ── */}
            <section className="cv-section">
              <div className="cv-section-title-row">
                <h3 className="cv-section__title">Tus datos</h3>
              </div>
              <div className="cv-fields"> 
                <input
                  className="cv-input"
                  required
                  placeholder="Tu nombre"
                  value={customer.name}
                  onChange={(e) => handleCustomerChange("name", e.target.value)}
                />
                <input
                  className="cv-input"
                  required
                  type="tel"
                  placeholder="WhatsApp / Teléfono"
                  value={customer.phone}
                  onChange={(e) =>
                    handleCustomerChange("phone", e.target.value)
                  }
                />
                {deliveryType === "delivery" && (
                  <>
                    <input
                      className="cv-input"
                      required
                      placeholder="Dirección de envío (calle, número…)"
                      value={customer.address}
                      onChange={(e) =>
                        handleCustomerChange("address", e.target.value)
                      }
                    />
                    {deliveryConfig && (
                      <div className="cv-delivery-calc">
                        <button
                          type="button"
                          className="cv-delivery-calc-btn"
                          onClick={handleCalcularCostoEnvio}
                          disabled={
                            !customer.address?.trim() ||
                            deliveryStatus !== "idle"
                          }
                        >
                          {deliveryStatus === "loading"
                            ? "Calculando distancia…"
                            : "Calcular costo de envío"}
                        </button>
                        {deliveryStatus === "success" && deliveryRango && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--success">
                            ✓ {deliveryKm != null
                              ? `${(Math.round(deliveryKm * 10) / 10).toFixed(1)} km`
                              : ""} — {deliveryRango.label} — $
                            {deliveryRango.precio.toLocaleString("es-CL")}
                          </p>
                        )}
                        {deliveryStatus === "out_of_range" && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--out">
                            {deliveryKm != null && (
                              <>Tu dirección está a {Number(deliveryKm).toFixed(1)} km. </>
                            )}
                            {deliveryKm != null &&
                            deliveryConfig.kmMaximo != null &&
                            Number(deliveryKm) <= Number(deliveryConfig.kmMaximo) ? (
                              <>No tenemos un rango de precio configurado para esa distancia (cobertura máxima {deliveryConfig.kmMaximo} km).</>
                            ) : (
                              <>Lo sentimos, está fuera de nuestra zona de cobertura ({deliveryConfig.kmMaximo ?? 0} km máximo).</>
                            )}
                          </p>
                        )}
                        {deliveryStatus === "error" && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--error">
                            No pudimos calcular el costo. Verifica tu dirección
                            e intenta nuevamente.
                          </p>
                        )}
                      </div>
                    )}
                  </>
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
                    Envío
                    {deliveryConfig && deliveryRango && deliveryKm != null
                      ? ` (${(Math.round(deliveryKm * 10) / 10).toFixed(1)} km — ${deliveryRango.label})`
                      : ""}
                  </span>
                  <span>
                    {deliveryRango
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
                disabled={
                  isSubmitting ||
                  (deliveryType === "delivery" &&
                    deliveryConfig &&
                    deliveryStatus !== "success")
                }
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
