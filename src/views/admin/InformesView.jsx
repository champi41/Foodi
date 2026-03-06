import React, { useState, useEffect, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../api/firebase";
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "./InformesView.css";

const formatMesLabel = (mesStr) => {
  const [anio, mes] = mesStr.split("-").map(Number);
  const d = new Date(anio, mes - 1, 1);
  const str = d.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const mejorDiaSemana = (pedidosPorDia, mesSeleccionado) => {
  if (!pedidosPorDia) return null;

  const [anio, mes] = mesSeleccionado.split("-").map(Number);
  const conteo = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  // 0=domingo, 1=lunes ... 6=sábado

  Object.entries(pedidosPorDia).forEach(([dia, cantidad]) => {
    const fecha = new Date(anio, mes - 1, parseInt(dia, 10));
    const diaSemana = fecha.getDay();
    conteo[diaSemana].push(cantidad);
  });

  const diasConDatos = Object.entries(conteo)
    .filter(([, vals]) => vals.length > 0)
    .map(([dia, vals]) => ({
      dia: parseInt(dia, 10),
      promedio: Math.round(
        vals.reduce((a, b) => a + b, 0) / vals.length,
      ),
    }));

  if (diasConDatos.length < 3) return null;

  diasConDatos.sort((a, b) => b.promedio - a.promedio);
  const mejor = diasConDatos[0];
  const nombres = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  return {
    nombre: nombres[mejor.dia],
    promedio: mejor.promedio,
  };
};

export const InformesView = ({ businessId }) => {
  const tenantId = businessId;

  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  });
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const resumenRef = doc(
      db,
      `negocios/${tenantId}/resumenes/${mesSeleccionado}`,
    );
    getDoc(resumenRef).then((snap) => {
      setResumen(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
  }, [tenantId, mesSeleccionado]);

  const hoy = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const mesAnterior = () => {
    const [anio, mes] = mesSeleccionado.split("-").map(Number);
    const d = new Date(anio, mes - 2, 1);
    const now = new Date();
    const limite = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    if (d < limite) return;
    setMesSeleccionado(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const mesSiguiente = () => {
    if (mesSeleccionado >= hoy) return;
    const [anio, mes] = mesSeleccionado.split("-").map(Number);
    const d = new Date(anio, mes, 1);
    setMesSeleccionado(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  const diasDelMes = useMemo(() => {
    const [anio, mes] = mesSeleccionado.split("-").map(Number);
    const totalDias = new Date(anio, mes, 0).getDate();
    return Array.from({ length: totalDias }, (_, i) => {
      const dia = String(i + 1).padStart(2, "0");
      return {
        dia: String(i + 1),
        pedidos: resumen?.pedidosPorDia?.[dia] || 0,
        ingresos: resumen?.ingresosPorDia?.[dia] || 0,
      };
    });
  }, [mesSeleccionado, resumen]);

  const totalPedidos = resumen?.totalPedidos ?? 0;
  const totalIngresos = resumen?.totalIngresos ?? 0;
  const totalEnvio = resumen?.totalEnvio ?? 0;
  const ingresosProductos = totalIngresos - totalEnvio;
  const ticketPromedio =
    totalPedidos > 0 ? Math.round(totalIngresos / totalPedidos) : 0;
  const delivery =
    resumen?.porTipoEntrega?.delivery ?? 0;
  const retiro = resumen?.porTipoEntrega?.retiro ?? 0;
  const totalEntrega = delivery + retiro;
  const pctDelivery = totalEntrega > 0 ? Math.round((delivery / totalEntrega) * 100) : 0;
  const pctRetiro = totalEntrega > 0 ? Math.round((retiro / totalEntrega) * 100) : 0;

  const maxIngresos = Math.max(...diasDelMes.map((d) => d.ingresos), 1);

  const exportarExcel = () => {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const tituloMes = formatMesLabel(mesSeleccionado);
      const fmtPeso = (n) => `$${(n ?? 0).toLocaleString("es-CL")}`;

      // Hoja 1: Resumen
      const resumenData = [
        ["Informe mensual", tituloMes],
        [],
        ["Total pedidos", resumen.totalPedidos ?? 0],
        ["Ingresos totales", fmtPeso(resumen.totalIngresos)],
        ["  Productos", fmtPeso(ingresosProductos)],
        ["  Envíos", fmtPeso(totalEnvio)],
        [
          "Ticket promedio",
          totalPedidos > 0
            ? fmtPeso(Math.round((resumen.totalIngresos ?? 0) / (resumen.totalPedidos ?? 1)))
            : fmtPeso(0),
        ],
        [],
        ["Método de pago", "Ingresos"],
        ["Efectivo", fmtPeso(resumen.porMetodoPago?.efectivo)],
        ["Transferencia", fmtPeso(resumen.porMetodoPago?.transferencia)],
        ["Tarjeta", fmtPeso(resumen.porMetodoPago?.tarjetaPresencial)],
        [],
        ["Tipo de entrega", "Pedidos"],
        ["Retiro", resumen.porTipoEntrega?.retiro ?? 0],
        ["Delivery", resumen.porTipoEntrega?.delivery ?? 0],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(resumenData);
      ws1["!cols"] = [{ wch: 22 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

      // Hoja 2: Por día
      const diasData = [
        ["Día", "Pedidos", "Ingresos ($)"],
        ...diasDelMes.map((d) => [d.dia, d.pedidos, d.ingresos]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(diasData);
      ws2["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Por Día");

      // Hoja 3: Productos
      const productosData = [
        ["#", "Producto", "Cantidad", "Ingresos"],
        ...(resumen.productosMasVendidos || [])
          .sort((a, b) => b.cantidad - a.cantidad)
          .map((p, i) => [
            i + 1,
            p.nombre,
            p.cantidad,
            fmtPeso(p.ingresos),
          ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(productosData);
      ws3["!cols"] = [{ wch: 4 }, { wch: 38 }, { wch: 10 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Productos");

      XLSX.writeFile(wb, `informe-${mesSeleccionado}.xlsx`);
    });
  };

  if (loading) {
    return (
      <div className="informes-view">
        <div className="informes-loading">
          <span>⏳</span>
          <p>Cargando informe...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="informes-print-area" className="informes-view">
      <div className="informes-header">
        <div className="informes-mes-selector">
          <button
            type="button"
            className="informes-mes-btn"
            onClick={mesAnterior}
            title="Mes anterior"
          >
            ←
          </button>
          <span className="informes-mes-label">
            {formatMesLabel(mesSeleccionado)}
          </span>
          <button
            type="button"
            className="informes-mes-btn"
            onClick={mesSiguiente}
            disabled={mesSeleccionado >= hoy}
            title="Mes siguiente"
          >
            →
          </button>
        </div>
        {resumen !== null && (
          <div className="informes-acciones">
            <button
              type="button"
              className="informes-btn informes-btn-excel"
              onClick={exportarExcel}
            >
              📊 Excel
            </button>
            <button
              type="button"
              className="informes-btn informes-btn-pdf"
              onClick={() => window.print()}
            >
              📄 PDF
            </button>
          </div>
        )}
      </div>

      {resumen === null ? (
        <div className="informes-empty">
          <p>Sin pedidos completados en este período</p>
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <ShoppingBag size={20} className="kpi-icon" />
              <span className="kpi-valor">{totalPedidos}</span>
              <span className="kpi-label">Total Pedidos</span>
            </div>
            <div className="kpi-card kpi-card--ingresos">
              <DollarSign size={20} className="kpi-icon" />
              <span className="kpi-valor">
                ${totalIngresos.toLocaleString("es-CL")}
              </span>
              <span className="kpi-label">Ingresos totales</span>
              {(ingresosProductos > 0 || totalEnvio > 0) && (
                <span className="kpi-desglose">
                  Productos: ${ingresosProductos.toLocaleString("es-CL")}
                  {totalEnvio > 0 && (
                    <> · Envíos: ${totalEnvio.toLocaleString("es-CL")}</>
                  )}
                </span>
              )}
            </div>
            <div className="kpi-card">
              <TrendingUp size={20} className="kpi-icon" />
              <span className="kpi-valor">
                ${ticketPromedio.toLocaleString("es-CL")}
              </span>
              <span className="kpi-label">Ticket Promedio</span>
            </div>
            <div className="kpi-card">
              <Truck size={20} className="kpi-icon" />
              <span className="kpi-valor">
                {delivery} delivery / {retiro} retiro
              </span>
              <span className="kpi-label">Delivery vs Retiro</span>
            </div>
          </div>

          <section className="informes-seccion">
            <h3 className="informes-seccion-titulo">Actividad del mes</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={diasDelMes} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "ingresos"
                      ? [`$${Number(value).toLocaleString("es-CL")}`, "Ingresos"]
                      : [value, name === "pedidos" ? "Pedidos" : name]
                  }
                  labelFormatter={(label) => `Día ${label}`}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="pedidos"
                  name="Pedidos"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="ingresos"
                  name="Ingresos"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {(() => {
              const mejor = mejorDiaSemana(
                resumen?.pedidosPorDia,
                mesSeleccionado,
              );
              return (
                <p className="mejor-dia-texto">
                  {mejor
                    ? `📅 Tu mejor día: ${mejor.nombre} — promedio de ${mejor.promedio} pedido${mejor.promedio !== 1 ? "s" : ""}`
                    : "📅 Aún no hay suficientes datos para determinar tu mejor día"}
                </p>
              );
            })()}
          </section>

          <div className="informes-row">
            <div className="informes-card">
              <h3 className="informes-card-titulo">
                Ingresos por método de pago
              </h3>
              <div className="informes-metodos">
                {[
                  {
                    key: "efectivo",
                    label: "Efectivo",
                    emoji: "💵",
                    valor: resumen.porMetodoPago?.efectivo || 0,
                  },
                  {
                    key: "transferencia",
                    label: "Transferencia",
                    emoji: "🏦",
                    valor: resumen.porMetodoPago?.transferencia || 0,
                  },
                  {
                    key: "tarjetaPresencial",
                    label: "Tarjeta",
                    emoji: "💳",
                    valor: resumen.porMetodoPago?.tarjetaPresencial || 0,
                  },
                ].map((m) => (
                  <div key={m.key} className="informes-metodo-fila">
                    <span className="informes-metodo-label">
                      {m.emoji} {m.label}
                    </span>
                    <div className="informes-metodo-barra-wrap">
                      <div
                        className="informes-metodo-barra"
                        style={{
                          width: `${totalIngresos > 0 ? (m.valor / totalIngresos) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="informes-metodo-valor">
                      ${m.valor.toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="informes-card">
              <h3 className="informes-card-titulo">
                Pedidos por tipo de entrega
              </h3>
              <div className="informes-entrega-stats">
                <div className="informes-entrega-item">
                  <span className="informes-entrega-icon">🏪</span>
                  <span className="informes-entrega-texto">
                    Retiro: {retiro} pedidos ({pctRetiro}%)
                  </span>
                </div>
                <div className="informes-entrega-item">
                  <span className="informes-entrega-icon">🛵</span>
                  <span className="informes-entrega-texto">
                    Delivery: {delivery} pedidos ({pctDelivery}%)
                  </span>
                </div>
              </div>
              <div className="informes-entrega-barra">
                <div
                  className="informes-entrega-barra-retiro"
                  style={{ width: `${pctRetiro}%` }}
                />
                <div
                  className="informes-entrega-barra-delivery"
                  style={{ width: `${pctDelivery}%` }}
                />
              </div>
            </div>
          </div>

          <section className="informes-seccion">
            <h3 className="informes-seccion-titulo">
              Productos más vendidos
            </h3>
            {!(resumen.productosMasVendidos || []).length ? (
              <p className="informes-sin-productos">
                Sin datos de productos este mes
              </p>
            ) : (
              <div className="informes-tabla-wrap">
                <table className="informes-tabla">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(resumen.productosMasVendidos || [])
                      .sort((a, b) => b.cantidad - a.cantidad)
                      .slice(0, 10)
                      .map((p, idx) => (
                        <tr key={idx}>
                          <td className="rank">{idx + 1}</td>
                          <td>{p.nombre}</td>
                          <td>{p.cantidad}</td>
                          <td>
                            ${(p.ingresos ?? 0).toLocaleString("es-CL")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
