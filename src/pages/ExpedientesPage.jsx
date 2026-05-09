import { useState, useEffect, Fragment } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

import "../styles/Page.css";

const API_URL_CONTRATOS = apiUrl('/api/contratos');
const API_URL_PAGOS     = apiUrl('/api/pagos');

const ESTADO_COLORS = {
  al_dia: {
    color: '#16a34a',
    bg: '#f0fdf4'
  },

  parcial: {
    color: '#d97706',
    bg: '#fffbeb'
  },

  pendiente: {
    color: '#dc2626',
    bg: '#fef2f2'
  },
};

export default function ExpedientesPage() {

  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [restaurando, setRestaurando] = useState(null);

  const [expandido, setExpandido] = useState(null);

  const [pagosMap, setPagosMap] = useState({});

  const [loadingPagos, setLoadingPagos] = useState(null);

  const getToken = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token;
  };

  const fetchExpedientes = async () => {
    setLoading(true);
    setError(null);

    try {

      const token = await getToken();

      const response = await fetch(API_URL_CONTRATOS, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("El servidor no respondió con JSON.");
      }

      const result = await response.json();

      const soloVencidos = (result.data || []).filter(
        c => c.estatus === 'vencido' || c.estatus === 'cancelado'
      );

      setExpedientes(soloVencidos);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);
    }
  };

  const fetchPagos = async (contrato_id) => {

    if (pagosMap[contrato_id]) return;

    setLoadingPagos(contrato_id);

    try {

      const token = await getToken();

      const response = await fetch(
        `${API_URL_PAGOS}?contrato_id=${contrato_id}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const result = await response.json();

      setPagosMap(prev => ({
        ...prev,
        [contrato_id]: result.data || []
      }));

    } catch (err) {

      console.error('Error cargando pagos:', err.message);

    } finally {

      setLoadingPagos(null);
    }
  };

  const toggleExpansion = (contrato_id) => {

    if (expandido === contrato_id) {
      setExpandido(null);

    } else {
      setExpandido(contrato_id);
      fetchPagos(contrato_id);
    }
  };

  const restaurarContrato = async (contrato) => {

    if (
      !window.confirm(
        `¿Restaurar el contrato del local ${
          contrato.locales?.numero ?? contrato.local_id
        } a Activo?`
      )
    ) return;

    setRestaurando(contrato.id);

    try {

      const token = await getToken();

      const response = await fetch(API_URL_CONTRATOS, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify({
          id: contrato.id,
          estatus: "activo"
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al restaurar");
      }

      fetchExpedientes();

    } catch (err) {

      alert("Error: " + err.message);

    } finally {

      setRestaurando(null);
    }
  };

  useEffect(() => {
    fetchExpedientes();
  }, []);

  return (
    <div className="container">

      <div className="page-header">
        <div>
          <h1>Expedientes</h1>

          <p>
            Contratos vencidos y cancelados
          </p>
        </div>
      </div>

      <div className="table-card">

        {loading ? (

          <div className="state-message">
            <p>Cargando expedientes...</p>
          </div>

        ) : error ? (

          <div className="state-message error">
            <p>{error}</p>
          </div>

        ) : expedientes.length === 0 ? (

          <div className="state-message">
            <p>No hay expedientes por el momento.</p>
          </div>

        ) : (

          <table className="data-table">

            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Local</th>
                <th>Arrendatario</th>
                <th>Fecha Inicio</th>
                <th>Fecha Vencimiento</th>
                <th>Renta</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>

              {expedientes.map((c) => (

                <Fragment key={c.id}>

                  {/* FILA PRINCIPAL */}

                  <tr
                    className={`expandable-row ${
                      expandido === c.id ? 'expanded' : ''
                    }`}
                    onClick={() => toggleExpansion(c.id)}
                  >

                    <td className="expand-icon">
                      {expandido === c.id ? '▼' : '▶'}
                    </td>

                    <td>
                      {c.locales?.numero ?? c.local_id}
                    </td>

                    <td>
                      {c.arrendatarios?.nombre ?? c.inquilino_id}
                    </td>

                    <td>{c.fecha_inicio}</td>

                    <td>{c.fecha_vencimiento}</td>

                    <td>
                      ${Number(c.renta).toLocaleString()}
                    </td>

                    <td>
                      <span className={`status ${c.estatus?.toLowerCase()}`}>
                        {c.estatus}
                      </span>
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>

                      <button
                        className="btn-expediente"
                        onClick={() => restaurarContrato(c)}
                        disabled={restaurando === c.id}
                      >
                        {restaurando === c.id
                          ? "Restaurando..."
                          : "← Restaurar"}
                      </button>

                    </td>

                  </tr>

                  {/* PAGOS */}

                  {expandido === c.id && (

                    <tr className="expanded-content-row">

                      <td colSpan={8}>

                        <div className="expanded-content">

                          <h4>Historial de Pagos</h4>

                          {loadingPagos === c.id ? (

                            <p className="small-message">
                              Cargando pagos...
                            </p>

                          ) : !pagosMap[c.id] || pagosMap[c.id].length === 0 ? (

                            <p className="small-message">
                              Sin registros de pagos.
                            </p>

                          ) : (

                            <table className="payments-table">

                              <thead>
                                <tr>
                                  <th>Periodo</th>
                                  <th>Esperado</th>
                                  <th>Pagado</th>
                                  <th>Diferencia</th>
                                  <th>Estado</th>
                                  <th>Fecha pago</th>
                                  <th>Método</th>
                                </tr>
                              </thead>

                              <tbody>

                                {pagosMap[c.id].map((p) => {

                                  const estilo =
                                    ESTADO_COLORS[p.estado] || {
                                      color: '#888',
                                      bg: '#f3f4f6'
                                    };

                                  return (

                                    <tr key={p.id}>

                                      <td>{p.periodo}</td>

                                      <td>
                                        ${Number(
                                          p.monto_esperado
                                        ).toLocaleString()}
                                      </td>

                                      <td>
                                        ${Number(
                                          p.monto_pagado || 0
                                        ).toLocaleString()}
                                      </td>

                                      <td
                                        style={{
                                          color:
                                            p.diferencia < 0
                                              ? '#dc2626'
                                              : '#16a34a'
                                        }}
                                      >
                                        ${Number(
                                          p.diferencia || 0
                                        ).toLocaleString()}
                                      </td>

                                      <td>

                                        <span
                                          className="payment-status"
                                          style={{
                                            color: estilo.color,
                                            background: estilo.bg
                                          }}
                                        >
                                          {p.estado}
                                        </span>

                                      </td>

                                      <td>
                                        {p.fecha_pago || '—'}
                                      </td>

                                      <td>
                                        {p.metodo_pago || '—'}
                                      </td>

                                    </tr>
                                  );
                                })}

                              </tbody>

                            </table>
                          )}

                        </div>

                      </td>

                    </tr>
                  )}

                </Fragment>
              ))}

            </tbody>

          </table>
        )}

      </div>

    </div>
  );
}