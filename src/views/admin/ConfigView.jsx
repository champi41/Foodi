import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import { geocodificar } from "../../utils/delivery";
import { DeliveryMapPreview } from "../../components/admin/DeliveryMapPreview";
import "./ConfigView.css";

const DIAS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

const CONFIG_INICIAL = {
  nombre: "",
  whatsapp: "",
  rut: "",
  razonSocial: "",
  giro: "",
  tiposEntrega: { retiro: true, delivery: false },
  metodosPago: {
    efectivo: { activo: true, retiro: true, delivery: true },
    transferencia: { activo: true, retiro: true, delivery: true },
    tarjetaPresencial: { activo: false, retiro: true, delivery: false },
  },
  deliveryConfig: null,
  datosBancarios: {
    nombre: "",
    banco: "",
    tipoCuenta: "",
    nroCuenta: "",
    rut: "",
    emailComprobante: "",
  },
  horarios: {
    lunes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    martes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    miercoles: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    jueves: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    viernes: {
      abierto: true,
      inicio: "10:00",
      fin: "22:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    sabado: {
      abierto: true,
      inicio: "11:00",
      fin: "23:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
    domingo: {
      abierto: false,
      inicio: "11:00",
      fin: "21:00",
      descanso: false,
      dInicio: "",
      dFin: "",
    },
  },
};

export const ConfigView = ({ businessId }) => {
  const tenantId = businessId || auth.currentUser?.uid;

  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [direccionVerificada, setDireccionVerificada] = useState(null);
  const inicialDireccionFromDb = React.useRef(false);

  useEffect(() => {
    if (tenantId) fetchConfig();
  }, [tenantId]);

  // Sincronizar dirección ya verificada al cargar desde la base de datos (solo una vez)
  useEffect(() => {
    if (
      !loading &&
      config.deliveryConfig?.coordenadasLocal &&
      config.deliveryConfig?.direccionLocal?.trim() &&
      !inicialDireccionFromDb.current
    ) {
      setDireccionVerificada(config.deliveryConfig.direccionLocal.trim());
      inicialDireccionFromDb.current = true;
    }
  }, [loading, config.deliveryConfig?.coordenadasLocal, config.deliveryConfig?.direccionLocal]);

  const fetchConfig = async () => {
    try {
      const [snapPublico, snapPrivado] = await Promise.all([
        getDoc(doc(db, "negocios", tenantId)),
        getDoc(doc(db, "negocios", tenantId, "privado", "config")),
      ]);
      const publico = snapPublico.exists() ? snapPublico.data() : {};
      const privado = snapPrivado.exists() ? snapPrivado.data() : {};

      const deliveryConfigPublico = publico.deliveryConfig || null;
      const coordenadasLocal =
        privado.coordenadasLocal ?? deliveryConfigPublico?.coordenadasLocal ?? null;
      const deliveryConfig = deliveryConfigPublico
        ? {
            ...deliveryConfigPublico,
            coordenadasLocal,
            modo: deliveryConfigPublico.modo || "rangos",
            precioBaseDelivery: deliveryConfigPublico.precioBaseDelivery ?? 0,
            precioPorKm: deliveryConfigPublico.precioPorKm ?? 0,
          }
        : null;

      setConfig({
        ...CONFIG_INICIAL,
        nombre: publico.nombre || "",
        whatsapp: publico.whatsapp || "",
        slug: publico.slug || "",
        tiposEntrega: {
          ...CONFIG_INICIAL.tiposEntrega,
          ...publico.tiposEntrega,
        },
        horarios: { ...CONFIG_INICIAL.horarios, ...publico.horarios },
        deliveryConfig,
        metodosPago: {
          efectivo: {
            ...CONFIG_INICIAL.metodosPago.efectivo,
            ...publico.metodosPago?.efectivo,
          },
          transferencia: {
            ...CONFIG_INICIAL.metodosPago.transferencia,
            ...publico.metodosPago?.transferencia,
          },
          tarjetaPresencial: {
            ...CONFIG_INICIAL.metodosPago.tarjetaPresencial,
            ...publico.metodosPago?.tarjetaPresencial,
          },
        },
        rut: privado.rut || "",
        razonSocial: privado.razonSocial || "",
        giro: privado.giro || "",
        datosBancarios: {
          ...CONFIG_INICIAL.datosBancarios,
          ...privado.datosBancarios,
        },
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (config.deliveryConfig && config.deliveryConfig.modo !== "porKm") {
        const rangos = [...(config.deliveryConfig.rangos || [])]
          .filter(
            (r) =>
              r.kmDesde != null &&
              r.kmHasta != null &&
              r.label?.trim() &&
              r.precio != null,
          )
          .sort((a, b) => a.kmDesde - b.kmDesde);
        let solapan = false;
        for (let i = 0; i < rangos.length - 1; i++) {
          if (rangos[i].kmHasta > rangos[i + 1].kmDesde) {
            solapan = true;
            break;
          }
        }
        if (solapan) {
          alert("Los rangos de km no pueden solaparse. Ajusta Desde/Hasta.");
          setSaving(false);
          return;
        }
      }

      const payloadPublico = {
        nombre: config.nombre,
        whatsapp: config.whatsapp,
        tiposEntrega: config.tiposEntrega,
        horarios: config.horarios,
        metodosPago: config.metodosPago,
      };
      if (config.deliveryConfig) {
        if (config.deliveryConfig.modo === "porKm") {
          const { coordenadasLocal, rangos, ...rest } =
            config.deliveryConfig;
          payloadPublico.deliveryConfig = {
            ...rest,
            modo: "porKm",
            kmMaximo: Number(config.deliveryConfig.kmMaximo) || 0,
            precioBaseDelivery: Number(config.deliveryConfig.precioBaseDelivery) || 0,
            precioPorKm: Number(config.deliveryConfig.precioPorKm) || 0,
            direccionLocal: config.deliveryConfig.direccionLocal || "",
            direccionVerificada: config.deliveryConfig.direccionVerificada || "",
          };
        } else {
          const { coordenadasLocal, ...resto } = config.deliveryConfig;
          payloadPublico.deliveryConfig = {
            direccionLocal: config.deliveryConfig.direccionLocal || "",
            rangos: config.deliveryConfig.rangos || [],
            kmMaximo: Number(config.deliveryConfig.kmMaximo) || 0,
            modo: "rangos",
            ...resto,
          };
          delete payloadPublico.deliveryConfig.coordenadasLocal;
        }
      }
      payloadPublico.datosTransferencia = {
        nombre: config.datosBancarios.nombre || "",
        banco: config.datosBancarios.banco || "",
        tipoCuenta: config.datosBancarios.tipoCuenta || "",
        nroCuenta: config.datosBancarios.nroCuenta || "",
        emailComprobante: config.datosBancarios.emailComprobante || "",
      };

      const payloadPrivado = {
        rut: config.rut,
        razonSocial: config.razonSocial,
        giro: config.giro,
        datosBancarios: config.datosBancarios,
      };
      if (config.deliveryConfig?.coordenadasLocal) {
        payloadPrivado.coordenadasLocal = config.deliveryConfig.coordenadasLocal;
      }

      await Promise.all([
        setDoc(doc(db, "negocios", tenantId), payloadPublico, { merge: true }),
        setDoc(
          doc(db, "negocios", tenantId, "privado", "config"),
          payloadPrivado,
          { merge: true },
        ),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setSaving(false);
  };

  // ── Helpers ──
  const setEntrega = (tipo, valor) =>
    setConfig((p) => ({
      ...p,
      tiposEntrega: { ...p.tiposEntrega, [tipo]: valor },
    }));

  const setPago = (metodo, campo, valor) =>
    setConfig((p) => ({
      ...p,
      metodosPago: {
        ...p.metodosPago,
        [metodo]: { ...p.metodosPago[metodo], [campo]: valor },
      },
    }));

  const setHorario = (dia, campo, valor) =>
    setConfig((p) => ({
      ...p,
      horarios: {
        ...p.horarios,
        [dia]: { ...p.horarios[dia], [campo]: valor },
      },
    }));

  const setBancario = (campo, valor) =>
    setConfig((p) => ({
      ...p,
      datosBancarios: { ...p.datosBancarios, [campo]: valor },
    }));

  const deliveryConfig = config.deliveryConfig || {
    direccionLocal: "",
    coordenadasLocal: null,
    rangos: [],
    kmMaximo: 10,
    modo: "rangos",
    precioBaseDelivery: 0,
    precioPorKm: 0,
  };

  const setDeliveryConfig = (field, value) =>
    setConfig((p) => ({
      ...p,
      deliveryConfig: {
        ...(p.deliveryConfig || {
          direccionLocal: "",
          coordenadasLocal: null,
          rangos: [],
          kmMaximo: 10,
        }),
        [field]: value,
      },
    }));

  const setDeliveryRango = (idx, field, value) =>
    setConfig((p) => {
      const rangos = [...(p.deliveryConfig?.rangos || [])];
      if (!rangos[idx]) return p;
      rangos[idx] = { ...rangos[idx], [field]: value };
      return {
        ...p,
        deliveryConfig: {
          ...(p.deliveryConfig || {}),
          rangos,
        },
      };
    });

  const agregarRangoDelivery = () =>
    setConfig((p) => {
      const rangos = p.deliveryConfig?.rangos || [];
      const last = rangos[rangos.length - 1];
      const kmDesde = last ? last.kmHasta : 0;
      return {
        ...p,
        deliveryConfig: {
          ...(p.deliveryConfig || { direccionLocal: "", coordenadasLocal: null, kmMaximo: 10 }),
          rangos: [
            ...rangos,
            { kmDesde, kmHasta: kmDesde + 2, precio: 0, label: "" },
          ],
        },
      };
    });

  const eliminarRangoDelivery = (idx) =>
    setConfig((p) => ({
      ...p,
      deliveryConfig: {
        ...p.deliveryConfig,
        rangos: (p.deliveryConfig?.rangos || []).filter((_, i) => i !== idx),
      },
    }));

  const handleVerificarUbicacion = async () => {
    const dir = deliveryConfig.direccionLocal?.trim();
    if (!dir) return;
    setGeocodeLoading(true);
    setGeocodeStatus(null);
    try {
      const result = await geocodificar(dir);
      if (result) {
        setGeocodeStatus({ ok: true, formatted: result.formatted });
        setDeliveryConfig("coordenadasLocal", { lat: result.lat, lng: result.lng });
        setDireccionVerificada(dir);
      } else {
        setGeocodeStatus({ ok: false });
      }
    } catch (e) {
      setGeocodeStatus({ ok: false });
    }
    setGeocodeLoading(false);
  };

  if (loading) return <div className="loading">Cargando configuración...</div>;

  const deliveryActivo = config.tiposEntrega.delivery;
  const retiroActivo = config.tiposEntrega.retiro;

  return (
    <div className="config-view">
      <h1>Configuración del Local</h1>

      <form onSubmit={handleSave}>
        {/* ── INFO GENERAL ── */}
        <section className="config-section">
          <h2>Información General</h2>
          <div className="config-row">
            <label>Nombre del local</label>
            <input
              value={config.nombre}
              onChange={(e) =>
                setConfig((p) => ({ ...p, nombre: e.target.value }))
              }
              type="text"
              placeholder="Ej: Sushi Frutillar"
            />
          </div>
          <div className="config-row">
            <label>WhatsApp (con código país)</label>
            <input
              value={config.whatsapp}
              onChange={(e) =>
                setConfig((p) => ({ ...p, whatsapp: e.target.value }))
              }
              placeholder="+56912345678"
              type="tel"
            />
          </div>
          <div className="config-row">
            <label>RUT</label>
            <input
              value={config.rut}
              onChange={(e) =>
                setConfig((p) => ({ ...p, rut: e.target.value }))
              }
              placeholder="77.614.693-5"
              type="text"
            />
          </div>
          <div className="config-row">
            <label>Razón Social</label>
            <input
              value={config.razonSocial}
              onChange={(e) =>
                setConfig((p) => ({ ...p, razonSocial: e.target.value }))
              }
              placeholder="Kyomu Sushi E.I.R.L."
              type="text"
            />
          </div>
          <div className="config-row">
            <label>Giro / Actividad</label>
            <input
              value={config.giro}
              onChange={(e) =>
                setConfig((p) => ({ ...p, giro: e.target.value }))
              }
              placeholder="Venta de comida preparada SUSHI"
              type="text"
            />
          </div>
        </section>

        {/* ── TIPOS DE ENTREGA ── */}
        <section className="config-section">
          <h2>Tipos de Entrega</h2>
          <p className="config-hint">
            Activa los tipos de entrega que ofrece tu local.
          </p>
          <div className="entrega-toggle-group">
            {[
              {
                tipo: "retiro",
                activo: retiroActivo,
                icon: "🏪",
                label: "Retiro en Local",
              },
              {
                tipo: "delivery",
                activo: deliveryActivo,
                icon: "🛵",
                label: "Delivery",
              },
            ].map(({ tipo, activo, icon, label }) => (
              <div
                key={tipo}
                className={`entrega-card ${activo ? "active" : ""}`}
                onClick={() => setEntrega(tipo, !activo)}
              >
                <span className="entrega-icon">{icon}</span>
                <span className="entrega-label">{label}</span>
                <span className={`entrega-badge ${activo ? "on" : "off"}`}>
                  {activo ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── DELIVERY POR DISTANCIA (Google Maps) ── */}
        {deliveryActivo && (
          <section className="config-section">
            <h2>Delivery por distancia</h2>

            <div className="delivery-modo-selector">
              <button
                type="button"
                className={`delivery-modo-btn ${(deliveryConfig?.modo || "rangos") === "rangos" ? "activo" : ""}`}
                onClick={() => setDeliveryConfig("modo", "rangos")}
              >
                <span className="modo-icon">📍</span>
                <span className="modo-titulo">Por Zonas</span>
                <span className="modo-desc">Define rangos con mapa visual</span>
              </button>
              <button
                type="button"
                className={`delivery-modo-btn ${deliveryConfig?.modo === "porKm" ? "activo" : ""}`}
                onClick={() => setDeliveryConfig("modo", "porKm")}
              >
                <span className="modo-icon">📏</span>
                <span className="modo-titulo">Por Kilómetro</span>
                <span className="modo-desc">Precio automático según distancia</span>
              </button>
            </div>

            {(deliveryConfig?.modo || "rangos") === "rangos" ? (
              <>
            <p className="config-hint">
              Configura la dirección del local y rangos de km con su precio. El
              costo se calcula según la distancia al cliente (Google Maps).
            </p>

            <div className="config-row">
              <label>Dirección del local</label>
              <div className="delivery-dir-row">
                <input
                  type="text"
                  placeholder="Ej: Emilio Luppi 435, Frutillar, Chile"
                  value={deliveryConfig.direccionLocal}
                  onChange={(e) => {
                    setDeliveryConfig("direccionLocal", e.target.value);
                    setGeocodeStatus(null);
                  }}
                />
                <button
                  type="button"
                  className="btn-verificar-ubicacion"
                  onClick={handleVerificarUbicacion}
                  disabled={
                    geocodeLoading ||
                    !deliveryConfig.direccionLocal?.trim() ||
                    (deliveryConfig.coordenadasLocal &&
                      deliveryConfig.direccionLocal?.trim() ===
                        direccionVerificada?.trim())
                  }
                >
                  {geocodeLoading ? "Verificando…" : "Verificar ubicación"}
                </button>
              </div>
              {geocodeStatus?.ok && (
                <p className="delivery-geocode-ok">
                  ✓ Ubicación verificada: {geocodeStatus.formatted}
                </p>
              )}
              {geocodeStatus && !geocodeStatus.ok && !geocodeLoading && (
                <p className="delivery-geocode-error">
                  No se encontró la dirección. Intenta con más detalle.
                </p>
              )}
            </div>

            <div className="config-row">
              <label>Distancia máxima de cobertura (km)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={deliveryConfig.kmMaximo}
                onChange={(e) => {
                  const raw = String(e.target.value).replace(",", ".");
                  const num = raw === "" ? 0 : Number(raw);
                  setDeliveryConfig("kmMaximo", Number.isFinite(num) ? num : 0);
                }}
              />
              <p className="config-hint">
                Pedidos fuera de este rango serán rechazados automáticamente.
              </p>
            </div>

            <div className="config-row">
              <label>Rangos de precio por distancia</label>
              <div className="delivery-rangos-table-wrap">
                <table className="delivery-rangos-table">
                  <thead>
                    <tr>
                      <th>Desde (km)</th>
                      <th>Hasta (km)</th>
                      <th>Nombre / label</th>
                      <th>Precio ($)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deliveryConfig.rangos || []).map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={r.kmDesde}
                            onChange={(e) =>
                              setDeliveryRango(
                                idx,
                                "kmDesde",
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={r.kmHasta}
                            onChange={(e) =>
                              setDeliveryRango(
                                idx,
                                "kmHasta",
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Zona Centro"
                            value={r.label}
                            onChange={(e) =>
                              setDeliveryRango(idx, "label", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={r.precio}
                            onChange={(e) =>
                              setDeliveryRango(
                                idx,
                                "precio",
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-delete-zona"
                            onClick={() => eliminarRangoDelivery(idx)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className="btn-add-zona"
                  onClick={agregarRangoDelivery}
                >
                  + Agregar rango
                </button>
                {deliveryConfig.coordenadasLocal?.lat != null &&
                  deliveryConfig.coordenadasLocal?.lng != null && (
                    <DeliveryMapPreview
                      coordenadas={deliveryConfig.coordenadasLocal}
                      rangos={deliveryConfig.rangos || []}
                      nombreLocal={config.nombre}
                    />
                  )}
              </div>
            </div>
              </>
            ) : (
              <div className="delivery-porkm-form">
                <div className="config-row">
                  <label>Dirección del local</label>
                  <div className="delivery-dir-row">
                    <input
                      type="text"
                      placeholder="Ej: Emilio Luppi 435, Frutillar, Chile"
                      value={deliveryConfig.direccionLocal}
                      onChange={(e) => {
                        setDeliveryConfig("direccionLocal", e.target.value);
                        setGeocodeStatus(null);
                      }}
                    />
                    <button
                      type="button"
                      className="btn-verificar-ubicacion"
                      onClick={handleVerificarUbicacion}
                      disabled={
                        geocodeLoading ||
                        !deliveryConfig.direccionLocal?.trim() ||
                        (deliveryConfig.coordenadasLocal &&
                          deliveryConfig.direccionLocal?.trim() === direccionVerificada?.trim())
                      }
                    >
                      {geocodeLoading ? "Verificando…" : "Verificar ubicación"}
                    </button>
                  </div>
                  {geocodeStatus?.ok && (
                    <p className="delivery-geocode-ok">
                      ✓ {geocodeStatus.formatted}
                    </p>
                  )}
                  {geocodeStatus && !geocodeStatus.ok && !geocodeLoading && (
                    <p className="delivery-geocode-error">
                      No se encontró la dirección. Intenta con más detalle.
                    </p>
                  )}
                </div>

                <div className="config-row">
                  <label>Distancia máxima de cobertura (km)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={deliveryConfig.kmMaximo}
                    onChange={(e) => {
                      const raw = String(e.target.value).replace(",", ".");
                      const num = raw === "" ? 0 : Number(raw);
                      setDeliveryConfig("kmMaximo", Number.isFinite(num) ? num : 0);
                    }}
                  />
                  <p className="config-hint">
                    Pedidos fuera de este rango serán rechazados automáticamente.
                  </p>
                </div>

                <div className="config-row">
                  <label>Precio base de envío ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={deliveryConfig.precioBaseDelivery ?? ""}
                    onChange={(e) =>
                      setDeliveryConfig(
                        "precioBaseDelivery",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    placeholder="0 si no hay cargo fijo"
                  />
                  <p className="config-hint">
                    Monto fijo que se cobra independiente de la distancia. Puede ser $0.
                  </p>
                </div>

                <div className="config-row">
                  <label>Precio por kilómetro ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={deliveryConfig.precioPorKm ?? ""}
                    onChange={(e) =>
                      setDeliveryConfig(
                        "precioPorKm",
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    placeholder="ej: 400"
                  />
                </div>

                {Number(deliveryConfig.precioPorKm) > 0 && (
                  <div className="delivery-porkm-preview">
                    <p className="preview-titulo">Vista previa de precios</p>
                    {[1, 2, 3, 5, 8]
                      .filter((km) => km <= (Number(deliveryConfig.kmMaximo) || 99))
                      .map((km) => (
                        <div key={km} className="preview-row">
                          <span>{km} km</span>
                          <span>
                            $
                            {(
                              (Number(deliveryConfig.precioBaseDelivery) || 0) +
                              km * (Number(deliveryConfig.precioPorKm) || 0)
                            ).toLocaleString("es-CL")}
                          </span>
                        </div>
                      ))}
                    <p className="preview-formula">
                      Fórmula: ${Number(deliveryConfig.precioBaseDelivery) || 0} base + km × $
                      {Number(deliveryConfig.precioPorKm) || 0}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── MÉTODOS DE PAGO ── */}
        <section className="config-section">
          <h2>Métodos de Pago</h2>
          <p className="config-hint">
            Activa cada método y elige en qué tipo de entrega se acepta.
          </p>
          {[
            { key: "efectivo", label: "Efectivo", icon: "💵" },
            { key: "transferencia", label: "Transferencia", icon: "🏦" },
            { key: "tarjetaPresencial", label: "Tarjeta", icon: "💳" },
          ].map(({ key, label, icon }) => {
            const metodo = config.metodosPago[key];
            return (
              <div
                key={key}
                className={`pago-card ${metodo.activo ? "active" : ""}`}
              >
                <div className="pago-header">
                  <label className="pago-toggle">
                    <input
                      type="checkbox"
                      checked={metodo.activo}
                      onChange={(e) => setPago(key, "activo", e.target.checked)}
                    />
                    <span>
                      {icon} {label}
                    </span>
                  </label>
                </div>
                {metodo.activo && (
                  <div className="pago-entrega-opts">
                    <span className="pago-entrega-label">Disponible en:</span>
                    {retiroActivo && (
                      <label className="pago-check">
                        <input
                          type="checkbox"
                          checked={metodo.retiro}
                          onChange={(e) =>
                            setPago(key, "retiro", e.target.checked)
                          }
                        />
                        🏪 Retiro
                      </label>
                    )}
                    {deliveryActivo && (
                      <label className="pago-check">
                        <input
                          type="checkbox"
                          checked={metodo.delivery}
                          onChange={(e) =>
                            setPago(key, "delivery", e.target.checked)
                          }
                        />
                        🛵 Delivery
                      </label>
                    )}
                    {!retiroActivo && !deliveryActivo && (
                      <span style={{ fontSize: 12, color: "#999" }}>
                        Activa al menos un tipo de entrega
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── DATOS BANCARIOS ── */}
        {config.metodosPago.transferencia.activo && (
          <section className="config-section">
            <h2>Datos Bancarios</h2>
            <p className="config-hint">
              Se muestran al cliente cuando elige pagar por transferencia.
            </p>
            {[
              {
                campo: "nombre",
                placeholder: "Nombre del titular",
                type: "text",
              },
              {
                campo: "rut",
                placeholder: "RUT (ej: 12.345.678-9)",
                type: "text",
              },
              {
                campo: "banco",
                placeholder: "Banco (ej: BancoEstado)",
                type: "text",
              },
              {
                campo: "tipoCuenta",
                placeholder: "Tipo de cuenta (ej: Cuenta Vista)",
                type: "text",
              },
              {
                campo: "nroCuenta",
                placeholder: "Número de cuenta",
                type: "text",
              },
              {
                campo: "emailComprobante",
                placeholder: "Email para comprobantes",
                type: "email",
              },
            ].map(({ campo, placeholder, type }) => (
              <div className="config-row" key={campo}>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={config.datosBancarios[campo]}
                  onChange={(e) => setBancario(campo, e.target.value)}
                />
              </div>
            ))}
          </section>
        )}

        {/* ── HORARIOS ── */}
        <section className="config-section">
          <h2>Horarios de Atención</h2>
          <div className="horarios-grid">
            {DIAS.map((dia) => {
              const h = config.horarios[dia];
              return (
                <div
                  key={dia}
                  className={`horario-row ${!h.abierto ? "cerrado" : ""}`}
                >
                  <div className="horario-dia">
                    <label className="toggle-dia">
                      <input
                        type="checkbox"
                        checked={h.abierto}
                        onChange={(e) =>
                          setHorario(dia, "abierto", e.target.checked)
                        }
                      />
                      <span>{dia.charAt(0).toUpperCase() + dia.slice(1)}</span>
                    </label>
                  </div>
                  {h.abierto ? (
                    <div className="horario-times">
                      <input
                        type="time"
                        value={h.inicio}
                        onChange={(e) =>
                          setHorario(dia, "inicio", e.target.value)
                        }
                      />
                      <span>→</span>
                      <input
                        type="time"
                        value={h.fin}
                        onChange={(e) => setHorario(dia, "fin", e.target.value)}
                      />
                      <label className="descanso-toggle">
                        <input
                          type="checkbox"
                          checked={h.descanso}
                          onChange={(e) =>
                            setHorario(dia, "descanso", e.target.checked)
                          }
                        />
                        Descanso
                      </label>
                      {h.descanso && (
                        <>
                          <input
                            type="time"
                            value={h.dInicio}
                            onChange={(e) =>
                              setHorario(dia, "dInicio", e.target.value)
                            }
                          />
                          <span>→</span>
                          <input
                            type="time"
                            value={h.dFin}
                            onChange={(e) =>
                              setHorario(dia, "dFin", e.target.value)
                            }
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="cerrado-label">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button type="submit" className="btn-save-config" disabled={saving}>
          {saving
            ? "Guardando..."
            : saved
              ? "✓ Guardado"
              : "Guardar Configuración"}
        </button>
      </form>
    </div>
  );
};
