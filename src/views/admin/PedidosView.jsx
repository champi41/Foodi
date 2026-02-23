import React, { useState, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  doc,
  updateDoc,
  collection,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../api/firebase";
import "./PedidosView.css";

const ESTADOS = ["todos", "pendiente", "preparando", "enviado"];
const HISTORIAL_PAGE_SIZE = 10;

const getHoyInicio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const armarMensaje = (pedido, datosBancarios) => {
  const nombre = pedido.cliente?.name?.split(" ")[0] || "cliente";
  const total = pedido.total?.toLocaleString("es-CL");

  switch (pedido.estado) {
    case "preparando": {
      let msg = `Hola ${nombre} 👋 ¡Recibimos tu pedido! Ya lo estamos preparando.`;
      if (pedido.metodoPago === "transferencia" && datosBancarios) {
        msg += `\n\n💳 *Para completar tu pedido, transfiere $${total}:*`;
        if (datosBancarios.banco) msg += `\nBanco: ${datosBancarios.banco}`;
        if (datosBancarios.tipoCuenta)
          msg += `\nTipo: ${datosBancarios.tipoCuenta}`;
        if (datosBancarios.nroCuenta)
          msg += `\nN° cuenta: ${datosBancarios.nroCuenta}`;
        if (datosBancarios.rut) msg += `\nRUT: ${datosBancarios.rut}`;
        if (datosBancarios.nombre) msg += `\nNombre: ${datosBancarios.nombre}`;
        msg += `\n\nUna vez transferido, envíanos el comprobante 🙏`;
      }
      return msg;
    }
    case "enviado":
      return `Hola ${nombre} 🛵 ¡Tu pedido ya está en camino! Pronto llega a tu dirección.`;
    case "entregado":
      return `Hola ${nombre} ✅ Tu pedido fue entregado. ¡Gracias por tu preferencia! 😊`;
    case "cancelado":
      return `Hola ${nombre}, lamentablemente no pudimos procesar tu pedido en este momento. Contáctanos para más información.`;
    default:
      return `Hola ${nombre}, te escribimos de parte del local sobre tu pedido.`;
  }
};

const abrirWhatsApp = (pedido, datosBancarios) => {
  const rawPhone = pedido.cliente?.phone || "";
  let numero = rawPhone.replace(/\D/g, "");
  if (numero.startsWith("0")) numero = numero.slice(1);
  if (!numero.startsWith("56") && numero.length === 9) numero = `56${numero}`;
  const mensaje = armarMensaje(pedido, datosBancarios);
  window.open(
    `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,
    "_blank",
  );
};

export const PedidosView = () => {
  const { businessId, pedidosHoy, datosBancarios } = useOutletContext();

  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [mostrandoHistorial, setMostrandoHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [ultimoDoc, setUltimoDoc] = useState(null);
  const [hayMas, setHayMas] = useState(true);
  const [error, setError] = useState(null);

  const pedidosActivos = useMemo(() => {
    if (!pedidosHoy) return [];
    return pedidosHoy.filter(
      (p) => p.estado !== "entregado" && p.estado !== "cancelado",
    );
  }, [pedidosHoy]);

  const pedidosHoyFinalizados = useMemo(() => {
    if (!pedidosHoy) return [];
    return pedidosHoy.filter(
      (p) => p.estado === "entregado" || p.estado === "cancelado",
    );
  }, [pedidosHoy]);

  const pedidosFiltrados = useMemo(() => {
    if (filtroEstado === "todos") return pedidosActivos;
    return pedidosActivos.filter((p) => p.estado === filtroEstado);
  }, [pedidosActivos, filtroEstado]);

  const cargarHistorial = useCallback(
    async (desde = null) => {
      if (cargandoHistorial) return;
      setCargandoHistorial(true);
      setError(null);
      try {
        let q = query(
          collection(db, `negocios/${businessId}/pedidos`),
          where("fecha", "<", getHoyInicio()),
          orderBy("fecha", "desc"),
          limit(HISTORIAL_PAGE_SIZE),
        );
        if (desde) q = query(q, startAfter(desde));
        const snap = await getDocs(q);
        const nuevos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHistorial((prev) => (desde ? [...prev, ...nuevos] : nuevos));
        setUltimoDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHayMas(snap.docs.length === HISTORIAL_PAGE_SIZE);
      } catch (err) {
        console.error("Error cargando historial:", err);
        setError("Error al cargar el historial");
      }
      setCargandoHistorial(false);
    },
    [businessId, cargandoHistorial],
  );

  const handleVerHistorial = () => {
    setMostrandoHistorial(true);
    setHistorial([]);
    setUltimoDoc(null);
    setHayMas(true);
    cargarHistorial(null);
  };

  const handleVolverHoy = () => {
    setMostrandoHistorial(false);
    setFiltroEstado("todos");
  };

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await updateDoc(doc(db, `negocios/${businessId}/pedidos`, pedidoId), {
        estado: nuevoEstado,
      });
    } catch (err) {
      console.error("Error actualizando estado:", err);
      setError("Error al actualizar el pedido");
    }
  };

  const handleConfirmarPago = async (pedidoId) => {
    try {
      await updateDoc(doc(db, `negocios/${businessId}/pedidos`, pedidoId), {
        pagoConfirmado: true,
      });
    } catch (err) {
      console.error("Error confirmando pago:", err);
    }
  };

  // ── Renderers ──

  const renderSelecciones = (selecciones) => {
    if (!selecciones || Object.keys(selecciones).length === 0) return null;
    return Object.entries(selecciones).map(([gi, { grupoNombre, sel }]) => {
      const items = Array.isArray(sel) ? sel : sel ? [sel] : [];
      if (items.length === 0) return null;
      return (
        <div key={gi} className="detalle-grupo">
          <span className="detalle-grupo-nombre">{grupoNombre}:</span>
          <span className="detalle-grupo-items">
            {items.map((op, idx) => (
              <span key={idx}>
                {op.nombre}
                {op.cantidad > 1 ? ` x${op.cantidad}` : ""}
                {op.extra > 0 ? ` (+$${op.extra.toLocaleString("es-CL")})` : ""}
                {idx < items.length - 1 ? ", " : ""}
              </span>
            ))}
          </span>
        </div>
      );
    });
  };

  const renderOpciones = (titulo, opciones) => {
    if (!opciones || opciones.length === 0) return null;
    return (
      <div className="detalle-grupo">
        <span className="detalle-grupo-nombre">{titulo}:</span>
        <span className="detalle-grupo-items">
          {opciones.map((opc, idx) => (
            <span key={idx}>
              {typeof opc === "string"
                ? opc
                : `${opc.nombre}${opc.extra > 0 || opc.precio > 0 ? ` (+$${opc.extra || opc.precio})` : ""}`}
              {idx < opciones.length - 1 ? ", " : ""}
            </span>
          ))}
        </span>
      </div>
    );
  };

  const getBadgeClass = (estado) => {
    switch (estado?.toLowerCase()) {
      case "pendiente":
        return "badge badge-pendiente";
      case "preparando":
        return "badge badge-preparando";
      case "enviado":
        return "badge badge-enviado";
      case "entregado":
        return "badge badge-entregado";
      case "cancelado":
        return "badge badge-cancelado";
      default:
        return "badge badge-default";
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return (
      d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) +
      " · " +
      d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
    );
  };

  const esTransferenciaPendiente = (pedido) =>
    pedido.metodoPago === "transferencia" &&
    !pedido.pagoConfirmado &&
    pedido.estado !== "cancelado";

  const renderPedidoCard = (pedido, esHistorial = false) => (
    <div
      key={pedido.id}
      className={`pedido-card ${esTransferenciaPendiente(pedido) ? "pedido-card--transferencia" : ""}`}
    >
      <div className="pedido-topbar">
        <div className="pedido-id-fecha">
          <span className="pedido-numero">
            #{pedido.id.slice(-5).toUpperCase()}
          </span>
          <span className="pedido-fecha">{formatFecha(pedido.fecha)}</span>
        </div>
        <div className="pedido-topbar-right">
          {/* Badge pago pendiente */}
          {esTransferenciaPendiente(pedido) && (
            <span className="badge-transferencia-pendiente">
              💸 Pago pendiente
            </span>
          )}
          {/* Badge pago confirmado */}
          {pedido.metodoPago === "transferencia" && pedido.pagoConfirmado && (
            <span className="badge-transferencia-ok">✓ Pago ok</span>
          )}
          <span className={getBadgeClass(pedido.estado)}>
            {pedido.estado || "Pendiente"}
          </span>
        </div>
      </div>

      <div className="pedido-body">
        <div className="pedido-cliente-col">
          <div className="pedido-cliente">
            <span className="cliente-avatar">👤</span>
            <div>
              <p className="cliente-nombre">{pedido.cliente?.name}</p>
              <p className="cliente-telefono">{pedido.cliente?.phone}</p>
            </div>
          </div>
          <div className="pedido-entrega">
            <span className="entrega-icon">
              {pedido.tipoEntrega === "delivery" ? "🛵" : "🏪"}
            </span>
            <div>
              <p className="entrega-tipo">{pedido.tipoEntrega}</p>
              <p className="entrega-detalle">
                {pedido.tipoEntrega === "delivery" ? (
                  <>
                    {pedido.cliente?.address}
                    {pedido.cliente?.zona && (
                      <span className="entrega-zona">
                        {" "}
                        · {pedido.cliente.zona}
                      </span>
                    )}
                  </>
                ) : (
                  "en Local"
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="pedido-items-col">
          <p className="items-titulo">Artículos</p>
          {pedido.items?.map((item, index) => (
            <div key={index} className="pedido-item">
              <div className="item-header">
                <span className="item-cantidad">{item.cantidad}x</span>
                <span className="item-nombre">{item.nombre}</span>
                <span className="item-precio">
                  ${item.precioFinal?.toLocaleString("es-CL")}
                </span>
              </div>
              <div className="item-detalles">
                {renderSelecciones(item.selecciones)}
                {renderOpciones("Extras", item.extras)}
                {renderOpciones("Sin", item.sinIngredientes)}
                {/* Nota del cliente */}
                {item.nota && (
                  <div className="item-nota">
                    <span className="item-nota-icon">📝</span>
                    <span className="item-nota-texto">{item.nota}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pedido-footer">
        <div className="pedido-footer-info">
          <div className="pedido-total">
            <span className="total-label">Total</span>
            <span className="total-valor">
              ${pedido.total?.toLocaleString("es-CL")}
            </span>
          </div>
          <div className="pedido-metodo-pago">
            <span className="pago-label">Pago</span>
            <span className="pago-valor">{pedido.metodoPago}</span>
          </div>
          {pedido.costoEnvio > 0 && (
            <div className="pedido-envio">
              <span className="pago-label">Envío</span>
              <span className="pago-valor">
                ${pedido.costoEnvio?.toLocaleString("es-CL")}
              </span>
            </div>
          )}
        </div>

        <div className="pedido-acciones">
          {/* Confirmar pago — solo transferencias no confirmadas y no canceladas */}
          {pedido.metodoPago === "transferencia" &&
            !pedido.pagoConfirmado &&
            !esHistorial &&
            pedido.estado !== "cancelado" && (
              <button
                className="btn-accion btn-confirmar-pago"
                onClick={() => handleConfirmarPago(pedido.id)}
                title="Marcar transferencia como recibida"
              >
                💸 Confirmar pago
              </button>
            )}

          {/* Avisar al cliente */}
          {pedido.cliente?.phone && (
            <button
              className="btn-accion btn-avisar"
              onClick={() => abrirWhatsApp(pedido, datosBancarios)}
              title="Abrir WhatsApp con mensaje pre-armado"
            >
              📲 Avisar
            </button>
          )}

          {/* Acciones de estado */}
          {!esHistorial && (
            <>
              {pedido.estado === "pendiente" && (
                <>
                  <button
                    className="btn-accion btn-aceptar"
                    onClick={() => handleCambiarEstado(pedido.id, "preparando")}
                  >
                    ✅ Aceptar
                  </button>
                  <button
                    className="btn-accion btn-rechazar"
                    onClick={() => handleCambiarEstado(pedido.id, "cancelado")}
                  >
                    Rechazar
                  </button>
                </>
              )}
              {pedido.estado === "preparando" && (
                <button
                  className="btn-accion btn-enviar"
                  onClick={() =>
                    handleCambiarEstado(
                      pedido.id,
                      pedido.tipoEntrega === "delivery"
                        ? "enviado"
                        : "entregado",
                    )
                  }
                >
                  {pedido.tipoEntrega === "delivery"
                    ? "🛵 Enviar"
                    : "✅ Entregar"}
                </button>
              )}
              {pedido.estado === "enviado" && (
                <button
                  className="btn-accion btn-entregar"
                  onClick={() => handleCambiarEstado(pedido.id, "entregado")}
                >
                  📦 Confirmar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!pedidosHoy)
    return (
      <div className="pedidos-loading">
        <span>⏳</span>
        <p>Sincronizando pedidos...</p>
      </div>
    );

  // ── VISTA HISTORIAL ──
  if (mostrandoHistorial) {
    const todosHistorial = [...pedidosHoyFinalizados, ...historial];
    return (
      <div className="pedidos-view">
        <div className="pedidos-header">
          <div>
            <h2 className="pedidos-title">Historial de Pedidos</h2>
            <p className="pedidos-subtitle">
              Pedidos finalizados · Días anteriores
            </p>
          </div>
          <button
            className="btn-finalizados btn-finalizados-active"
            onClick={handleVolverHoy}
          >
            ← Volver a Hoy
          </button>
        </div>

        {error && <div className="pedidos-error">{error}</div>}

        <div className="pedidos-lista">
          {pedidosHoyFinalizados.length > 0 && (
            <div className="historial-seccion-label">Hoy — Finalizados</div>
          )}
          {pedidosHoyFinalizados.map((p) => renderPedidoCard(p, true))}
          {historial.length > 0 && (
            <div className="historial-seccion-label">Días anteriores</div>
          )}
          {historial.map((p) => renderPedidoCard(p, true))}
        </div>

        {cargandoHistorial && (
          <div className="historial-loading">Cargando más pedidos...</div>
        )}
        {!cargandoHistorial && hayMas && (
          <button
            className="btn-cargar-mas"
            onClick={() => cargarHistorial(ultimoDoc)}
          >
            Cargar 10 más
          </button>
        )}
        {!cargandoHistorial && !hayMas && historial.length > 0 && (
          <p className="historial-fin">No hay más pedidos anteriores</p>
        )}
        {todosHistorial.length === 0 && !cargandoHistorial && (
          <div className="pedidos-empty">
            <span>📦</span>
            <p>No hay pedidos finalizados aún</p>
          </div>
        )}
      </div>
    );
  }

  // ── VISTA ACTIVOS ──
  const contarEstado = (estado) =>
    pedidosActivos.filter((p) => p.estado === estado).length;

  return (
    <div className="pedidos-view">
      <div className="pedidos-header">
        <div>
          <h2 className="pedidos-title">Pedidos de Hoy</h2>
          <p className="pedidos-subtitle">{pedidosActivos.length} activos</p>
        </div>
        <div className="pedidos-header-right">
          <div className="live-badge">
            <span className="live-dot" />
            En Vivo
          </div>
          <button className="btn-finalizados" onClick={handleVerHistorial}>
            Historial{" "}
            {pedidosHoyFinalizados.length > 0 &&
              `(+${pedidosHoyFinalizados.length} hoy)`}
          </button>
        </div>
      </div>

      <div className="pedidos-filtros">
        {ESTADOS.map((e) => {
          const count = e === "todos" ? pedidosActivos.length : contarEstado(e);
          return (
            <button
              key={e}
              className={`filtro-btn filtro-${e} ${filtroEstado === e ? "filtro-active" : ""}`}
              onClick={() => setFiltroEstado(e)}
            >
              {e === "todos" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
              <span className="filtro-count">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="pedidos-error">{error}</div>}

      <div className="pedidos-lista">
        {pedidosFiltrados.map((p) => renderPedidoCard(p, false))}
      </div>

      {pedidosFiltrados.length === 0 && (
        <div className="pedidos-empty">
          <span>🏪</span>
          <p>
            {filtroEstado === "todos"
              ? "No hay pedidos activos hoy"
              : `No hay pedidos en estado "${filtroEstado}"`}
          </p>
        </div>
      )}
    </div>
  );
};
