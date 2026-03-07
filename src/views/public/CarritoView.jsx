import React, { useState, useEffect, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../api/firebase";
import {
  geocodificar,
  distanciaLineaRectaKm,
  calcularDistanciaKm,
  encontrarRango,
  calcularPrecioPorKm,
} from "../../utils/delivery";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./CarritoView.css";
import { ChevronLeft } from "lucide-react";

// Iconos Leaflet (Vite)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const STORAGE_KEY = "mp_customer_data";

// Resultado del cálculo de envío solo en memoria (se pierde al recargar la página)
let sessionDeliveryResult = null;

// Lee datos del navegador (cliente + tipo de entrega) y resultado de envío de esta sesión
const loadStored = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    const deliveryResult =
      sessionDeliveryResult &&
      typeof sessionDeliveryResult.address === "string" &&
      typeof sessionDeliveryResult.km === "number" &&
      typeof sessionDeliveryResult.cost === "number"
        ? sessionDeliveryResult
        : null;
    return {
      name: parsed.name ?? "",
      phone: parsed.phone ?? "",
      address: parsed.address ?? "",
      referencia: parsed.referencia ?? "",
      deliveryType: parsed.deliveryType ?? null,
      deliveryResult,
    };
  } catch {
    return {
      name: "",
      phone: "",
      address: "",
      referencia: "",
      deliveryType: null,
      deliveryResult: null,
    };
  }
};

// Guarda cliente y tipo de entrega en localStorage; resultado de envío solo en memoria (null = limpiar)
const saveStored = (customerData, deliveryType, deliveryResult = null) => {
  sessionDeliveryResult = deliveryResult;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...customerData,
        deliveryType,
      }),
    );
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
  const modoDelivery = deliveryConfig?.modo || "rangos";

  const defaultEntrega = tiposEntrega.retiro ? "retiro" : "delivery";

  // Precarga con datos guardados (cliente + tipo de entrega)
  const stored = loadStored();
  const [customer, setCustomer] = useState({
    name: stored.name,
    phone: stored.phone,
    address: stored.address,
    referencia: stored.referencia ?? "",
  });
  const deliveryTypeInitial = (() => {
    const saved = stored.deliveryType;
    if (saved === "delivery" && tiposEntrega.delivery) return "delivery";
    if (saved === "retiro" && tiposEntrega.retiro) return "retiro";
    return defaultEntrega;
  })();

  const [deliveryType, setDeliveryType] = useState(deliveryTypeInitial);

  const hasValidStoredResult =
    deliveryTypeInitial === "delivery" &&
    stored.deliveryResult &&
    stored.deliveryResult.address !== undefined &&
    (stored.address || "").trim().toLowerCase() ===
      (stored.deliveryResult.address || "").trim().toLowerCase();

  const [paymentMethod, setPayment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedPayment, setSavedPayment] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState(
    hasValidStoredResult ? "success" : "idle",
  );
  const [deliveryKm, setDeliveryKm] = useState(
    hasValidStoredResult ? stored.deliveryResult.km : null,
  );
  const [deliveryRango, setDeliveryRango] = useState(
    hasValidStoredResult && stored.deliveryResult.label
      ? {
          label: stored.deliveryResult.label,
          precio: stored.deliveryResult.cost,
        }
      : null,
  );
  const [deliveryCost, setDeliveryCost] = useState(
    hasValidStoredResult ? stored.deliveryResult.cost : 0,
  );
  // Dirección con la que se calculó (o restauró) el envío; si el usuario la cambia, se resetea
  const lastCalculatedAddressRef = useRef(null);
  const [deliveryErrorMsg, setDeliveryErrorMsg] = useState(null);
  const [lastGeocodedAddress, setLastGeocodedAddress] = useState("");
  const [cachedCoords, setCachedCoords] = useState(null);
  const [geocodingIntentos, setGeocodingIntentos] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapSelectedCoords, setMapSelectedCoords] = useState(null);

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

  // Actualiza el estado y persiste en localStorage (mantiene resultado de envío si sigue siendo válido)
  const handleCustomerChange = (field, value) => {
    const updated = { ...customer, [field]: value };
    setCustomer(updated);
    const result =
      field !== "address" &&
      deliveryStatus === "success" &&
      deliveryKm != null
        ? {
            address: customer.address.trim(),
            km: deliveryKm,
            cost: deliveryCost,
            label: deliveryRango?.label ?? undefined,
          }
        : null;
    saveStored(updated, deliveryType, result);
  };

  // Marcar la dirección con la que se restauró el resultado (solo al montar)
  useEffect(() => {
    if (hasValidStoredResult && stored.deliveryResult?.address) {
      lastCalculatedAddressRef.current = (stored.deliveryResult.address || "")
        .trim()
        .toLowerCase();
    }
  }, []);

  // Resetear cálculo de envío solo si el cliente cambia la dirección respecto a la del último cálculo
  useEffect(() => {
    if (deliveryType !== "delivery" || !deliveryConfig) return;
    const currentAddr = (customer.address || "").trim().toLowerCase();
    if (!currentAddr) return;
    const lastAddr = lastCalculatedAddressRef.current;
    if (
      deliveryStatus !== "idle" &&
      deliveryStatus !== "loading" &&
      lastAddr != null &&
      currentAddr !== lastAddr
    ) {
      setDeliveryStatus("idle");
      setDeliveryKm(null);
      setDeliveryRango(null);
      setDeliveryCost(0);
      setDeliveryErrorMsg(null);
      lastCalculatedAddressRef.current = null;
      saveStored(customer, deliveryType, null);
    }
  }, [customer.address, deliveryStatus, deliveryType, deliveryConfig]);

  const handleCalcularCostoEnvio = async () => {
    const coordsLocal =
      deliveryConfig?.coordenadasLocal || config.privado?.coordenadasLocal;
    if (!coordsLocal || !customer.address?.trim()) return;
    setDeliveryStatus("loading");
    setDeliveryKm(null);
    setDeliveryRango(null);
    setDeliveryCost(0);
    setDeliveryErrorMsg(null);
    try {
      const addressTrim = customer.address.trim();
      const addressKey = addressTrim.toLowerCase();

      let coordsCliente = null;
      if (
        cachedCoords &&
        addressKey === lastGeocodedAddress.trim().toLowerCase()
      ) {
        coordsCliente = cachedCoords;
      } else {
        coordsCliente = await geocodificar(addressTrim);
        if (!coordsCliente) {
          setGeocodingIntentos((prev) => prev + 1);
          setDeliveryStatus("error");
          return;
        }
        setCachedCoords(coordsCliente);
        setLastGeocodedAddress(addressTrim);
      }

      if (modoDelivery === "porKm") {
        const { kmMaximo, precioBaseDelivery, precioPorKm } =
          deliveryConfig;

        const km = await calcularDistanciaKm(
          { lat: coordsLocal.lat, lng: coordsLocal.lng },
          { lat: coordsCliente.lat, lng: coordsCliente.lng },
        );

        if (km == null) {
          setDeliveryErrorMsg(
            "No pudimos calcular la distancia. Verifica tu dirección e intenta de nuevo.",
          );
          setDeliveryStatus("error");
          return;
        }

        setDeliveryKm(km);

        if (km > (Number(kmMaximo) ?? 0)) {
          setGeocodingIntentos((prev) => prev + 1);
          setDeliveryStatus("out_of_range");
          return;
        }

        const precio = calcularPrecioPorKm(
          km,
          precioBaseDelivery,
          precioPorKm,
        );
        setDeliveryCost(precio);
        setDeliveryRango(null);
        setDeliveryStatus("success");
        saveStored(customer, deliveryType, {
          address: addressTrim,
          km,
          cost: precio,
          label: undefined,
        });
        lastCalculatedAddressRef.current = addressTrim.trim().toLowerCase();
        setGeocodingIntentos(0);
      } else {
        const km = distanciaLineaRectaKm(coordsLocal, coordsCliente);
        setDeliveryKm(km);

        const rango = encontrarRango(
          km,
          deliveryConfig.rangos || [],
          deliveryConfig.kmMaximo ?? 0,
        );
        if (rango) {
          setDeliveryStatus("success");
          setDeliveryRango(rango);
          setDeliveryCost(rango.precio);
          saveStored(customer, deliveryType, {
            address: addressTrim,
            km,
            cost: rango.precio,
            label: rango.label,
          });
          lastCalculatedAddressRef.current = addressTrim.trim().toLowerCase();
          setGeocodingIntentos(0);
        } else {
          setDeliveryStatus("out_of_range");
          setDeliveryRango(null);
        }
      }
    } catch {
      setDeliveryStatus("error");
    }
  };

  // Aplica coordenadas elegidas en el mapa para calcular envío (tras 2 intentos fallidos)
  const aplicarCoordsDelMapa = async (coordsCliente) => {
    const coordsLocal =
      deliveryConfig?.coordenadasLocal || config.privado?.coordenadasLocal;
    if (!coordsLocal || !coordsCliente) return;
    const addressTrim = (customer.address || "").trim() || "Ubicación en mapa";
    setDeliveryStatus("loading");
    setDeliveryKm(null);
    setDeliveryRango(null);
    setDeliveryCost(0);
    setDeliveryErrorMsg(null);
    setShowMapPicker(false);
    setMapSelectedCoords(null);
    try {
      if (modoDelivery === "porKm") {
        const { kmMaximo, precioBaseDelivery, precioPorKm } = deliveryConfig;
        const km = await calcularDistanciaKm(coordsLocal, coordsCliente);
        if (km == null) {
          setDeliveryErrorMsg("No se pudo calcular la distancia.");
          setDeliveryStatus("error");
          return;
        }
        setDeliveryKm(km);
        if (km > (Number(kmMaximo) ?? 0)) {
          setDeliveryStatus("out_of_range");
          return;
        }
        const precio = calcularPrecioPorKm(km, precioBaseDelivery, precioPorKm);
        setDeliveryCost(precio);
        setDeliveryRango(null);
        setDeliveryStatus("success");
        saveStored(customer, deliveryType, { address: addressTrim, km, cost: precio, label: undefined });
        lastCalculatedAddressRef.current = addressTrim.toLowerCase();
        setGeocodingIntentos(0);
      } else {
        const km = distanciaLineaRectaKm(coordsLocal, coordsCliente);
        setDeliveryKm(km);
        const rango = encontrarRango(
          km,
          deliveryConfig.rangos || [],
          deliveryConfig.kmMaximo ?? 0,
        );
        if (rango) {
          setDeliveryStatus("success");
          setDeliveryRango(rango);
          setDeliveryCost(rango.precio);
          saveStored(customer, deliveryType, { address: addressTrim, km, cost: rango.precio, label: rango.label });
          lastCalculatedAddressRef.current = addressTrim.toLowerCase();
          setGeocodingIntentos(0);
        } else {
          setGeocodingIntentos((prev) => prev + 1);
          setDeliveryStatus("out_of_range");
          setDeliveryRango(null);
        }
      }
    } catch {
      setDeliveryStatus("error");
    }
  };

  const costoEnvio =
    deliveryType === "delivery" && deliveryConfig && deliveryStatus === "success"
      ? deliveryCost
      : 0;
  const subtotal = cart.reduce((acc, item) => acc + item.precioFinal, 0);
  const total = subtotal + costoEnvio;

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
    saveStored(customer, tipo, null);
    setPayment("");
    setDeliveryStatus("idle");
    setDeliveryKm(null);
    setDeliveryRango(null);
    setDeliveryCost(0);
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
        deliveryCosto: deliveryType === "delivery" ? costoEnvio : null,
        ...(deliveryRango && { deliveryLabel: deliveryRango.label }),
      },
      tipoEntrega: deliveryType,
      metodoPago: paymentMethod,
      items: itemsLimpios,
      subtotal,
      costoEnvio: costoEnvio,
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
                      placeholder="Dirección de envío (calle, número, ciudad…)"
                      value={customer.address}
                      onChange={(e) => {
                        handleCustomerChange("address", e.target.value);
                        if (deliveryStatus === "success") {
                          setDeliveryStatus("idle");
                        }
                        if (deliveryStatus === "out_of_range" || deliveryStatus === "error") {
                          setDeliveryStatus("idle");
                          setDeliveryKm(null);
                          setDeliveryRango(null);
                          setDeliveryCost(0);
                          setDeliveryErrorMsg(null);
                          lastCalculatedAddressRef.current = null;
                        }
                        // No reseteamos geocodingIntentos aquí: así tras 2 fallos aparece la opción del mapa
                      }}
                    />
                    <input
                      className="cv-input"
                      placeholder="Referencia (opcional): ej. casa azul, techo negro"
                      value={customer.referencia ?? ""}
                      onChange={(e) =>
                        handleCustomerChange("referencia", e.target.value)
                      }
                    />
                    {deliveryConfig && (
                      <div className="cv-delivery-calc">
                        {geocodingIntentos >= 2 && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--error delivery-error">
                            No pudimos encontrar tu dirección. Intenta escribirla
                            de otra forma — incluye calle, número y ciudad. O elige tu ubicación en el mapa.
                          </p>
                        )}
                        {geocodingIntentos >= 2 && (
                          <button
                            type="button"
                            className="cv-delivery-map-btn"
                            onClick={() => setShowMapPicker(true)}
                          >
                            📍 Elegir ubicación en el mapa
                          </button>
                        )}
                        <button
                          type="button"
                          className="cv-delivery-calc-btn"
                          onClick={handleCalcularCostoEnvio}
                          disabled={
                            !customer.address?.trim() ||
                            deliveryStatus !== "idle" ||
                            geocodingIntentos >= 3
                          }
                        >
                          {deliveryStatus === "loading"
                            ? "Calculando distancia…"
                            : "Calcular costo de envío"}
                        </button>
                        {deliveryStatus === "success" && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--success">
                            {modoDelivery === "porKm"
                              ? `✓ ${deliveryKm != null ? (Math.round(deliveryKm * 10) / 10).toFixed(1) : ""} km — Envío: $${deliveryCost.toLocaleString("es-CL")}`
                              : `✓ ${deliveryKm != null ? (Math.round(deliveryKm * 10) / 10).toFixed(1) : ""} km — ${deliveryRango?.label ?? ""} — $${deliveryCost.toLocaleString("es-CL")}`}
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
                            <span className="cv-delivery-feedback__hint">
                              Prueba agregar la ciudad después de la dirección (ej.: Frutillar, Puerto Varas).
                            </span>
                          </p>
                        )}
                        {deliveryStatus === "error" && (
                          <p className="cv-delivery-feedback cv-delivery-feedback--error">
                            {deliveryErrorMsg ||
                              "No pudimos calcular el costo. Verifica tu dirección e intenta nuevamente."}
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
                    {deliveryConfig && deliveryKm != null && deliveryStatus === "success"
                      ? modoDelivery === "porKm"
                        ? ` (${(Math.round(deliveryKm * 10) / 10).toFixed(1)} km)`
                        : ` (${(Math.round(deliveryKm * 10) / 10).toFixed(1)} km — ${deliveryRango?.label ?? ""})`
                      : ""}
                  </span>
                  <span>
                    {deliveryStatus === "success"
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

      {/* Modal: elegir ubicación en el mapa (tras 2 intentos fallidos) */}
      {showMapPicker && deliveryConfig && (() => {
        const coordsLocal =
          deliveryConfig?.coordenadasLocal || config.privado?.coordenadasLocal;
        if (coordsLocal?.lat == null || coordsLocal?.lng == null) return null;
        const center = [coordsLocal.lat, coordsLocal.lng];
        return (
          <div
            className="cv-map-overlay"
            onClick={(e) => e.target === e.currentTarget && setShowMapPicker(false)}
          >
            <div className="cv-map-modal" onClick={(e) => e.stopPropagation()}>
              <p className="cv-map-modal__title">
                Toca en el mapa donde está tu casa o negocio
              </p>
              <div className="cv-map-wrap">
                <MapContainer
                  center={center}
                  zoom={13}
                  style={{ height: 280, width: "100%" }}
                  scrollWheelZoom
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap"
                  />
                  <MapClickHandler
                    onSelect={(lat, lng) =>
                      setMapSelectedCoords({ lat, lng })
                    }
                  />
                  {mapSelectedCoords && (
                    <Marker position={[mapSelectedCoords.lat, mapSelectedCoords.lng]} />
                  )}
                </MapContainer>
              </div>
              <div className="cv-map-actions">
                <button
                  type="button"
                  className="cv-map-use-btn"
                  disabled={!mapSelectedCoords}
                  onClick={() => aplicarCoordsDelMapa(mapSelectedCoords)}
                >
                  Usar esta ubicación
                </button>
                <button
                  type="button"
                  className="cv-map-cancel-btn"
                  onClick={() => {
                    setShowMapPicker(false);
                    setMapSelectedCoords(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
