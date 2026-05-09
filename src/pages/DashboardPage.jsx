import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

import "../styles/Page.css";

const API_URL_LOCALES       = apiUrl('/api/locales');
const API_URL_CONTRATOS     = apiUrl('/api/contratos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_PAGOS         = apiUrl('/api/pagos');
const API_URL_INCREMENTOS   = apiUrl('/api/incrementos');

export default function DashboardPage() {

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const fetchAll = async () => {

    setLoading(true);

    setError(null);

    try {

      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const [
        locRes,
        contRes,
        arrRes,
        pagRes,
        incRes
      ] = await Promise.all([

        fetch(API_URL_LOCALES, { headers }),

        fetch(API_URL_CONTRATOS, { headers }),

        fetch(API_URL_ARRENDATARIOS, { headers }),

        fetch(API_URL_PAGOS, { headers }),

        fetch(API_URL_INCREMENTOS, { headers }),
      ]);

      const [
        locData,
        contData,
        arrData,
        pagData,
        incData
      ] = await Promise.all([

        locRes.json(),

        contRes.json(),

        arrRes.json(),

        pagRes.json(),

        incRes.json()
      ]);

      setData({

        locales: locData.data || [],

        contratos: contData.data || [],

        arrendatarios: arrData.data || [],

        pagos: pagData.data || [],

        incrementos: incData.data || [],
      });

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {

    return (

      <div className="container">

        <div className="state-message">
          <p>Cargando dashboard...</p>
        </div>

      </div>
    );
  }

  if (error) {

    return (

      <div className="container">

        <div className="state-message error">
          <p>{error}</p>
        </div>

      </div>
    );
  }

  const {
    locales,
    contratos,
    arrendatarios,
    pagos,
    incrementos
  } = data;

  // ─────────────────────
  // LOCALES
  // ─────────────────────

  const localesRentados = locales.filter(
    l => l.estatus === 'rentado'
  );

  const localesDesocupados = locales.filter(
    l => l.estatus === 'desocupado'
  );

  const rentaTotalEsperada = localesRentados.reduce(
    (s, l) => s + Number(l.renta || 0),
    0
  );

  // ─────────────────────
  // CONTRATOS
  // ─────────────────────

  const contratosActivos = contratos.filter(
    c => c.estatus === 'activo'
  );

  const contratosVencidos = contratos.filter(
    c => c.estatus === 'vencido'
  );

  const contratosCancelados = contratos.filter(
    c => c.estatus === 'cancelado'
  );

  const hoy = new Date();

  const en90 = new Date();

  en90.setDate(hoy.getDate() + 90);

  const proximosAVencer = contratosActivos
    .filter(c => {

      const vence = new Date(
        c.fecha_vencimiento
      );

      return (
        vence >= hoy &&
        vence <= en90
      );
    })
    .sort(
      (a, b) =>
        new Date(a.fecha_vencimiento) -
        new Date(b.fecha_vencimiento)
    );

  const vencidosSinExpedir =
    contratosVencidos;

  // ─────────────────────
  // ARRENDATARIOS
  // ─────────────────────

  const arrAlDia = arrendatarios.filter(
    a => a.estado === 'al_dia'
  );

  const arrAtrasado = arrendatarios.filter(
    a => a.estado === 'atrasado'
  );

  const arrPendiente = arrendatarios.filter(
    a => a.estado === 'pendiente'
  );

  // ─────────────────────
  // PAGOS
  // ─────────────────────

  const periodoActual =
    `${hoy.getFullYear()}-${
      String(hoy.getMonth() + 1)
      .padStart(2, '0')
    }`;

  const pagosMesActual = pagos.filter(
    p => p.periodo === periodoActual
  );

  const pagosMesAlDia = pagosMesActual.filter(
    p => p.estado === 'al_dia'
  );

  const pagosMesParcial = pagosMesActual.filter(
    p => p.estado === 'parcial'
  );

  const pagosMesPendiente = pagosMesActual.filter(
    p => p.estado === 'pendiente'
  );

  const totalCobradoMes = pagosMesActual.reduce(
    (s, p) =>
      s + Number(p.monto_pagado || 0),
    0
  );

  const totalEsperadoMes = pagosMesActual.reduce(
    (s, p) =>
      s + Number(p.monto_esperado || 0),
    0
  );

  const pagosConDiferenciaNegativa = pagos.filter(
    p => Number(p.diferencia || 0) < 0
  );

  // ─────────────────────
  // INCREMENTOS
  // ─────────────────────

  const ultimoIncremento =
    incrementos[0] || null;

  const diasParaVencer = (fecha) => {

    const diff =
      new Date(fecha) - hoy;

    return Math.ceil(
      diff / (1000 * 60 * 60 * 24)
    );
  };

  const SummaryCard = ({
    label,
    value,
    color
  }) => (

    <div
      className="table-card"
      style={{ padding: '20px' }}
    >

      <p className="summary-label">
        {label}
      </p>

      <p
        className="summary-value"
        style={color ? { color } : {}}
      >
        {value}
      </p>

    </div>
  );

  return (

    <div className="container">

      {/* HEADER */}

      <div className="page-header">

        <div>

          <h1>Dashboard</h1>

          <p>
            Resumen general del sistema inmobiliario
          </p>

        </div>

      </div>

      {/* ───────────────────── */}
      {/* LOCALES */}
      {/* ───────────────────── */}

      <section style={{ marginBottom: '38px' }}>

        <h2 className="section-title">
          Locales
        </h2>

        <div className="dashboard-grid">

          <SummaryCard
            label="Total"
            value={locales.length}
          />

          <SummaryCard
            label="Rentados"
            value={localesRentados.length}
            color="#16a34a"
          />

          <SummaryCard
            label="Desocupados"
            value={localesDesocupados.length}
            color="#dc2626"
          />

          <SummaryCard
            label="Renta mensual"
            value={`$${rentaTotalEsperada.toLocaleString()}`}
          />

        </div>

      </section>

      {/* ───────────────────── */}
      {/* CONTRATOS */}
      {/* ───────────────────── */}

      <section style={{ marginBottom: '38px' }}>

        <h2 className="section-title">
          Contratos
        </h2>

        <div className="dashboard-grid">

          <SummaryCard
            label="Activos"
            value={contratosActivos.length}
            color="#16a34a"
          />

          <SummaryCard
            label="Vencidos"
            value={contratosVencidos.length}
            color="#dc2626"
          />

          <SummaryCard
            label="Cancelados"
            value={contratosCancelados.length}
            color="#6b7280"
          />

        </div>

        {proximosAVencer.length > 0 && (

          <div
            className="table-card"
            style={{ marginTop: '20px' }}
          >

            <div
              style={{
                padding: '18px 18px 0'
              }}
            >

              <h3
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  margin: 0
                }}
              >
                Próximos a vencer
              </h3>

            </div>

            <table className="data-table">

              <thead>

                <tr>
                  <th>Arrendatario</th>
                  <th>Local</th>
                  <th>Vence</th>
                  <th>Días restantes</th>
                </tr>

              </thead>

              <tbody>

                {proximosAVencer.map(c => {

                  const dias =
                    diasParaVencer(
                      c.fecha_vencimiento
                    );

                  const color =
                    dias <= 30
                      ? '#dc2626'
                      : dias <= 60
                      ? '#d97706'
                      : '#6b7280';

                  return (

                    <tr key={c.id}>

                      <td>
                        {
                          c.arrendatarios?.nombre ??
                          '—'
                        }
                      </td>

                      <td>
                        {
                          c.locales?.numero ??
                          c.local_id
                        }
                      </td>

                      <td>
                        {c.fecha_vencimiento}
                      </td>

                      <td
                        style={{
                          color,
                          fontWeight: 600
                        }}
                      >
                        {dias} días
                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>
        )}

        {vencidosSinExpedir.length > 0 && (

          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              borderRadius: '14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px'
            }}
          >

            ⚠ {vencidosSinExpedir.length} contrato(s)
            vencido(s): {

              vencidosSinExpedir
                .map(
                  c =>
                    c.arrendatarios?.nombre ??
                    c.inquilino_id
                )
                .join(', ')
            }

          </div>
        )}

      </section>

      {/* ───────────────────── */}
      {/* ARRENDATARIOS */}
      {/* ───────────────────── */}

      <section style={{ marginBottom: '38px' }}>

        <h2 className="section-title">
          Arrendatarios
        </h2>

        <div className="dashboard-grid">

          <SummaryCard
            label="Total"
            value={arrendatarios.length}
          />

          <SummaryCard
            label="Al día"
            value={arrAlDia.length}
            color="#16a34a"
          />

          <SummaryCard
            label="Atrasados"
            value={arrAtrasado.length}
            color="#dc2626"
          />

          <SummaryCard
            label="Pendientes"
            value={arrPendiente.length}
            color="#d97706"
          />

        </div>

      </section>

      {/* ───────────────────── */}
      {/* PAGOS */}
      {/* ───────────────────── */}

      <section style={{ marginBottom: '38px' }}>

        <h2 className="section-title">
          Pagos — {periodoActual}
        </h2>

        <div className="dashboard-grid">

          <SummaryCard
            label="Esperado"
            value={`$${totalEsperadoMes.toLocaleString()}`}
          />

          <SummaryCard
            label="Cobrado"
            value={`$${totalCobradoMes.toLocaleString()}`}
            color="#16a34a"
          />

          <SummaryCard
            label="Al día"
            value={pagosMesAlDia.length}
            color="#16a34a"
          />

          <SummaryCard
            label="Parciales"
            value={pagosMesParcial.length}
            color="#d97706"
          />

          <SummaryCard
            label="Pendientes"
            value={pagosMesPendiente.length}
            color="#dc2626"
          />

        </div>

        {pagosConDiferenciaNegativa.length > 0 && (

          <div
            className="table-card"
            style={{ marginTop: '20px' }}
          >

            <div
              style={{
                padding: '18px 18px 0'
              }}
            >

              <h3
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  margin: 0
                }}
              >
                Pagos con saldo pendiente
              </h3>

            </div>

            <table className="data-table">

              <thead>

                <tr>
                  <th>Arrendatario</th>
                  <th>Periodo</th>
                  <th>Esperado</th>
                  <th>Pagado</th>
                  <th>Diferencia</th>
                </tr>

              </thead>

              <tbody>

                {pagosConDiferenciaNegativa.map(p => (

                  <tr key={p.id}>

                    <td>
                      {
                        p.contratos?.arrendatarios?.nombre ??
                        '—'
                      }
                    </td>

                    <td>
                      {p.periodo}
                    </td>

                    <td>
                      $
                      {
                        Number(
                          p.monto_esperado
                        ).toLocaleString()
                      }
                    </td>

                    <td>
                      $
                      {
                        Number(
                          p.monto_pagado || 0
                        ).toLocaleString()
                      }
                    </td>

                    <td
                      style={{
                        color: '#dc2626',
                        fontWeight: 600
                      }}
                    >
                      $
                      {
                        Number(
                          p.diferencia
                        ).toLocaleString()
                      }
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* ───────────────────── */}
      {/* INCREMENTOS */}
      {/* ───────────────────── */}

      <section>

        <h2 className="section-title">
          Incrementos
        </h2>

        <div className="dashboard-grid">

          <SummaryCard
            label="Total aplicados"
            value={incrementos.length}
          />

          {
            ultimoIncremento && (

              <div
                className="table-card"
                style={{ padding: '20px' }}
              >

                <p className="summary-label">
                  Último incremento
                </p>

                <p className="summary-value">
                  {ultimoIncremento.porcentaje}%
                </p>

                <p
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}
                >

                  {
                    new Date(
                      ultimoIncremento.created_at
                    ).toLocaleDateString('es-MX')
                  }

                  {' • '}

                  {
                    ultimoIncremento
                      .arrendatarios_afectados
                      ?.length ?? 0
                  } arrendatarios

                </p>

              </div>
            )
          }

        </div>

      </section>

    </div>
  );
}