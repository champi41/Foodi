import React, { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../api/firebase";
import "./ConfigView.css"
export const ConfigView = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantId = auth.currentUser?.uid;

  const [config, setConfig] = useState({
    whatsapp: "",
    metodosPago: {
      tarjetaPresencial: false,
      transferencia: false,
      efectivo: false,
    },
    datosBancarios: {
      banco: "",
      tipoCuenta: "",
      nroCuenta: "",
      rut: "",
      email: "",
    },
    horarios: {
      lunes: {
        abierto: true,
        inicio: "09:00",
        fin: "22:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      martes: {
        abierto: true,
        inicio: "09:00",
        fin: "22:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      miercoles: {
        abierto: true,
        inicio: "09:00",
        fin: "22:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      jueves: {
        abierto: true,
        inicio: "09:00",
        fin: "22:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      viernes: {
        abierto: true,
        inicio: "09:00",
        fin: "22:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      sabado: {
        abierto: false,
        inicio: "10:00",
        fin: "20:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
      domingo: {
        abierto: false,
        inicio: "10:00",
        fin: "20:00",
        descanso: false,
        dInicio: "",
        dFin: "",
      },
    },
  });

  useEffect(() => {
    if (tenantId) {
      getDoc(doc(db, "negocios", tenantId)).then((snap) => {
        if (snap.exists() && snap.data().config) setConfig(snap.data().config);
        setLoading(false);
      });
    }
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "negocios", tenantId), { config });
      alert("Configuración guardada");
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const updateHorario = (dia, campo, valor) => {
    setConfig({
      ...config,
      horarios: {
        ...config.horarios,
        [dia]: { ...config.horarios[dia], [campo]: valor },
      },
    });
  };

  if (loading) return <div>Cargando configuración...</div>;

  return (
    <div className="config-view">
      <h1>Configuración del Negocio</h1>

      {/* WHATSAPP */}
      <section className="config-section">
        <h2>Contacto Principal</h2>
        <label>Número de WhatsApp (con código de país, ej: 56912345678)</label>
        <input
          type="text"
          value={config.whatsapp}
          onChange={(e) => setConfig({ ...config, whatsapp: e.target.value })}
          placeholder="569..."
        />
      </section>

      {/* MÉTODOS DE PAGO */}
      <section className="config-section">
        <h2>Métodos de Pago</h2>
        <label>
          <input
            type="checkbox"
            checked={config.metodosPago.efectivo}
            onChange={(e) =>
              setConfig({
                ...config,
                metodosPago: {
                  ...config.metodosPago,
                  efectivo: e.target.checked,
                },
              })
            }
          />{" "}
          Efectivo
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.metodosPago.tarjetaPresencial}
            onChange={(e) =>
              setConfig({
                ...config,
                metodosPago: {
                  ...config.metodosPago,
                  tarjetaPresencial: e.target.checked,
                },
              })
            }
          />{" "}
          Tarjeta (Solo Presencial/Retiro)
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.metodosPago.transferencia}
            onChange={(e) =>
              setConfig({
                ...config,
                metodosPago: {
                  ...config.metodosPago,
                  transferencia: e.target.checked,
                },
              })
            }
          />{" "}
          Transferencia Bancaria
        </label>

        {config.metodosPago.transferencia && (
          <div className="banco-details">
            <input
              placeholder="Banco"
              value={config.datosBancarios.banco}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datosBancarios: {
                    ...config.datosBancarios,
                    banco: e.target.value,
                  },
                })
              }
            />
            <input
              placeholder="Tipo de Cuenta"
              value={config.datosBancarios.tipoCuenta}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datosBancarios: {
                    ...config.datosBancarios,
                    tipoCuenta: e.target.value,
                  },
                })
              }
            />
            <input
              placeholder="N° de Cuenta"
              value={config.datosBancarios.nroCuenta}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datosBancarios: {
                    ...config.datosBancarios,
                    nroCuenta: e.target.value,
                  },
                })
              }
            />
            <input
              placeholder="RUT"
              value={config.datosBancarios.rut}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datosBancarios: {
                    ...config.datosBancarios,
                    rut: e.target.value,
                  },
                })
              }
            />
            <input
              placeholder="Email para comprobante"
              value={config.datosBancarios.email}
              onChange={(e) =>
                setConfig({
                  ...config,
                  datosBancarios: {
                    ...config.datosBancarios,
                    email: e.target.value,
                  },
                })
              }
            />
          </div>
        )}
      </section>

      {/* HORARIOS */}
      <section className="config-section">
        <h2>Horarios de Atención</h2>
        {Object.keys(config.horarios).map((dia) => (
          <div key={dia} className="dia-row">
            <span className="dia-name">
              {dia.charAt(0).toUpperCase() + dia.slice(1)}
            </span>
            <input
              type="checkbox"
              checked={config.horarios[dia].abierto}
              onChange={(e) => updateHorario(dia, "abierto", e.target.checked)}
            />
            {config.horarios[dia].abierto ? (
              <div className="horas-inputs">
                <input
                  type="time"
                  value={config.horarios[dia].inicio}
                  onChange={(e) => updateHorario(dia, "inicio", e.target.value)}
                />
                <span>a</span>
                <input
                  type="time"
                  value={config.horarios[dia].fin}
                  onChange={(e) => updateHorario(dia, "fin", e.target.value)}
                />

                <label className="descanso-label">
                  <input
                    type="checkbox"
                    checked={config.horarios[dia].descanso}
                    onChange={(e) =>
                      updateHorario(dia, "descanso", e.target.checked)
                    }
                  />{" "}
                  Descanso
                </label>

                {config.horarios[dia].descanso && (
                  <div className="descanso-inputs">
                    <input
                      type="time"
                      value={config.horarios[dia].dInicio}
                      onChange={(e) =>
                        updateHorario(dia, "dInicio", e.target.value)
                      }
                    />
                    <span>a</span>
                    <input
                      type="time"
                      value={config.horarios[dia].dFin}
                      onChange={(e) =>
                        updateHorario(dia, "dFin", e.target.value)
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <span className="cerrado-text">Cerrado</span>
            )}
          </div>
        ))}
      </section>

      <button className="btn-save-main" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "Guardar Cambios"}
      </button>
    </div>
  );
};
