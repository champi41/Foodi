import React, { useRef } from "react";
import "./TicketImpresion.css";

const METODO_PAGO_LABEL = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjetaPresencial: "Tarjeta",
};

const formatFecha = (fecha) => {
  if (!fecha) return "—";
  try {
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return d.toLocaleString("es-CL");
  } catch {
    return "—";
  }
};

const truncar = (s, max) =>
  s && s.length > max ? s.slice(0, max) : s;

const formatSelecciones = (selecciones) => {
  if (!selecciones || Object.keys(selecciones).length === 0) return null;
  return Object.entries(selecciones).map(([gi, { grupoNombre, sel }]) => {
    const items = Array.isArray(sel) ? sel : sel ? [sel] : [];
    if (items.length === 0) return null;
    const opciones = items
      .map((o) =>
        o.cantidad > 1 ? `${o.nombre} x${o.cantidad}` : o.nombre,
      )
      .join(", ");
    return { grupoNombre, opciones };
  }).filter(Boolean);
};

export function TicketImpresion({ pedido, negocio, onClose }) {
  const printAreaRef = useRef(null);

  const handleImprimir = () => {
    window.print();
  };

  if (!pedido || !negocio) return null;

  const n = negocio;
  const p = pedido;
  const numPedido = p.id ? `#${p.id.slice(-6).toUpperCase()}` : "#——";
  const tipoEntrega =
    p.tipoEntrega === "delivery" ? "Delivery" : "Retiro en Local";
  const metodoPagoLabel =
    METODO_PAGO_LABEL[p.metodoPago] || p.metodoPago || "—";
  const totalItems = p.items?.reduce((sum, it) => sum + (it.cantidad || 0), 0) ?? 0;

  return (
    <div className="ticket-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ticket-wrapper" onClick={(e) => e.stopPropagation()}>
        <div id="ticket-print-area" className="ticket-print" ref={printAreaRef}>
          {n.logo && (
            <div className="ticket-center" style={{ marginBottom: 6 }}>
              <img
                src={n.logo}
                alt=""
                style={{ maxWidth: 60, maxHeight: 60, objectFit: "contain" }}
              />
            </div>
          )}
          <div className="ticket-negocio-nombre">{n.nombre || "Local"}</div>
          {n.rut?.trim() && <div className="ticket-center">{n.rut}</div>}
          {n.razonSocial?.trim() && (
            <div className="ticket-center">{n.razonSocial}</div>
          )}
          {n.giro?.trim() && <div className="ticket-center">{n.giro}</div>}
          {n.deliveryConfig?.direccionLocal?.trim() && (
            <div className="ticket-center">
              {n.deliveryConfig.direccionLocal}
            </div>
          )}
          {n.whatsapp?.trim() && (
            <div className="ticket-center">{n.whatsapp}</div>
          )}
          {n.datosBancarios?.emailComprobante?.trim() && (
            <div className="ticket-center">
              {n.datosBancarios.emailComprobante}
            </div>
          )}

          <hr className="ticket-sep" />
          <div>Fecha: {formatFecha(p.fecha)}</div>
          <div>N° Pedido: {numPedido}</div>
          <div>Tipo entrega: {tipoEntrega}</div>
          <div>Cliente: {p.cliente?.name || "—"}</div>
          {p.tipoEntrega === "delivery" && p.cliente?.address?.trim() && (
            <div>{p.cliente.address}</div>
          )}

          <hr className="ticket-sep" />
          <div className="ticket-tabla-header">
            Descripción          Cant  Total
          </div>
          <hr className="ticket-sep" />

          {p.items?.map((item, idx) => {
            const nombre = truncar(item.nombre, 24) || "—";
            const cantidad = item.cantidad ?? 0;
            const precioFinal = item.precioFinal ?? 0;
            const precioUnit = cantidad > 0 ? precioFinal / cantidad : 0;
            const selecciones = formatSelecciones(item.selecciones);
            return (
              <div key={idx} className="ticket-item-block">
                <div className="ticket-item-nombre">{nombre}</div>
                {selecciones?.map((s, i) => (
                  <div key={i} className="ticket-item-sel">
                    {"  "}{s.grupoNombre}: {s.opciones}
                  </div>
                ))}
                {item.nota?.trim() && (
                  <div className="ticket-item-sel">  📝 {item.nota}</div>
                )}
                <div className="ticket-item-precio">
                  <span>{cantidad} x ${precioUnit.toLocaleString("es-CL")}</span>
                  <span>${precioFinal.toLocaleString("es-CL")}</span>
                </div>
              </div>
            );
          })}

          <hr className="ticket-sep" />
          <div className="ticket-total-row">
            <span>Cantidad de productos: {totalItems}</span>
          </div>
          <div className="ticket-total-row">
            <span>SUB-TOTAL:</span>
            <span>${(p.subtotal ?? 0).toLocaleString("es-CL")}</span>
          </div>
          {p.tipoEntrega === "delivery" && (p.costoEnvio ?? 0) > 0 && (
            <div className="ticket-total-row">
              <span>ENVÍO:</span>
              <span>${(p.costoEnvio ?? 0).toLocaleString("es-CL")}</span>
            </div>
          )}
          <div className="ticket-total-row ticket-total-final">
            <span>TOTAL:</span>
            <span>${(p.total ?? 0).toLocaleString("es-CL")}</span>
          </div>
          <div className="ticket-total-row">
            <span>Método de pago: {metodoPagoLabel}</span>
          </div>

          <hr className="ticket-sep" />
          <div className="ticket-center ticket-bold">
            ¡Gracias por su preferencia!
          </div>
          <div className="ticket-center ticket-menu-dash">MenuDash</div>
        </div>

        <div className="ticket-acciones">
          <button
            type="button"
            className="ticket-btn-imprimir"
            onClick={handleImprimir}
          >
            🖨️ Imprimir
          </button>
          <button
            type="button"
            className="ticket-btn-cerrar"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
