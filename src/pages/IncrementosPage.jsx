import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

import "../styles/Page.css";

const API_URL_INCREMENTOS   = apiUrl('/api/incrementos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_CONTRATOS     = apiUrl('/api/contratos');

export default function IncrementosPage() {

  const [arrendatarios, setArrendatarios] = useState([]);

  const [contratos, setContratos] = useState([]);

  const [historial, setHistorial] = useState([]);

  const [loadingData, setLoadingData] = useState(true);

  const [aplicando, setAplicando] = useState(false);

  const [error, setError] = useState(null);

  const [exito, setExito] = useState(null);

  const [porcentaje, setPorcentaje] = useState("");

  const [seleccionados, setSeleccionados] = useState([]);

  const [mostrarPreview, setMostrarPreview] = useState(false);

  const getToken = async () => {

    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token;
  };

  const fetchData = async () => {

    setLoadingData(true);
    setError(null);

    try {

      const token = await getToken();

      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const [arrRes, contRes, incRes] = await Promise.all([
        fetch(API_URL_ARRENDATARIOS, { headers }),
        fetch(API_URL_CONTRATOS, { headers }),
        fetch(API_URL_INCREMENTOS, { headers }),
      ]);

      const [arrData, contData, incData] = await Promise.all([
        arrRes.json(),
        contRes.json(),
        incRes.json()
      ]);

      setArrendatarios(arrData.data || []);
      setContratos(contData.data || []);
      setHistorial(incData.data || []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
const contratosMap = new Map(
  contratos.map(c => [c.inquilino_id, c])
);
  const arrendatariosConContrato = arrendatarios.filter(a =>
    contratos.some(
      c =>
        c.inquilino_id === a.id &&
        c.estatus === 'activo'
    )
  );

  const toggleSeleccion = (id) => {

    setSeleccionados(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleTodos = () => {

    if (
      seleccionados.length ===
      arrendatariosConContrato.length
    ) {

      setSeleccionados([]);

    } else {

      setSeleccionados(
        arrendatariosConContrato.map(a => a.id)
      );
    }
  };

  const preview = seleccionados
    .map(id => {

      const arrendatario = arrendatarios.find(
        a => a.id === id
      );

    const contrato = contratosMap.get(a.id);
      if (!arrendatario || !contrato) {
        return null;
      }

      const rentaActual = Number(contrato.renta);

      const rentaNueva =
        Math.round(
          rentaActual *
          (
            1 + Number(porcentaje) / 100
          ) * 100
        ) / 100;

      return {
        arrendatario,
        contrato,
        rentaActual,
        rentaNueva
      };

    })
    .filter(Boolean);

  const puedePreview =
    porcentaje > 0 &&
    seleccionados.length > 0;

  const handleAplicar = async () => {

    setAplicando(true);

    setError(null);

    setExito(null);

    try {

      const token = await getToken();
const porcentajeNumero = Number(porcentaje);

if (
  isNaN(porcentajeNumero) ||
  porcentajeNumero <= 0 ||
  porcentajeNumero > 100
) {
  setError("El porcentaje debe estar entre 1 y 100");
  return;
}
      const response = await fetch(
        API_URL_INCREMENTOS,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },

          body: JSON.stringify({
            porcentaje: Number(porcentaje),
            inquilino_ids: seleccionados
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Error al aplicar incremento"
        );
      }

      setExito(
        `Incremento aplicado: ${result.resumen.contratos_afectados} contrato(s), ${result.resumen.pagos_actualizados} pago(s) actualizados.`
      );

      setPorcentaje("");

      setSeleccionados([]);

      setMostrarPreview(false);

      fetchData();

    } catch (err) {

      setError(err.message);

    } finally {

      setAplicando(false);
    }
  };

  if (loadingData) {

    return (

      <div className="container">

        <div className="state-message">
          <p>Cargando...</p>
        </div>

      </div>
    );
  }

  return (

    <div className="container">

      {/* HEADER */}

      <div className="page-header">

        <div>
          <h1>Incrementos de Renta</h1>

          <p>
            Aplica incrementos a contratos activos
            y actualiza pagos pendientes automáticamente
          </p>
        </div>

      </div>

      {/* ALERTAS */}

      {error && (

        <div
          className="state-message error"
          style={{
            marginBottom: '18px',
            padding: '14px'
          }}
        >
          <p>{error}</p>
        </div>
      )}

      {exito && (

        <div
          className="state-message"
          style={{
            marginBottom: '18px',
            padding: '14px',
            color: '#16a34a'
          }}
        >
          <p>{exito}</p>
        </div>
      )}

      {/* FORMULARIO */}

      <div
        className="table-card"
        style={{
          padding: '24px',
          marginBottom: '28px'
        }}
      >

        <h2
          style={{
            fontSize: '16px',
            marginBottom: '20px',
            color: '#111827'
          }}
        >
          Nuevo Incremento
        </h2>

        {/* PORCENTAJE */}

        <div style={{ marginBottom: '20px' }}>

          <label
            style={{
              display: 'block',
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '8px'
            }}
          >
            Porcentaje de incremento
          </label>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >

            <input
              className="filter-input"
              type="number"
              min="1"
              max="100"
              placeholder="Ej. 10"
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setMostrarPreview(false);
                setExito(null);
              }}
              style={{ width: '140px' }}
            />

            <span style={{ color: '#6b7280' }}>
              %
            </span>

          </div>

        </div>

        {/* LISTA */}

        <div style={{ marginBottom: '20px' }}>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}
          >

            <label
              style={{
                fontSize: '13px',
                color: '#6b7280'
              }}
            >
              Arrendatarios con contrato activo
            </label>

            <button
              className="btn-edit"
              onClick={toggleTodos}
            >
              {
                seleccionados.length ===
                arrendatariosConContrato.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'
              }
            </button>

          </div>

          <div
            className="table-card"
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              borderRadius: '14px'
            }}
          >

            {arrendatariosConContrato.length === 0 ? (

              <div className="state-message">
                <p>
                  No hay arrendatarios con contratos activos.
                </p>
              </div>

            ) : (

              arrendatariosConContrato.map(a => {

                const contrato = contratos.find(
                  c =>
                    c.inquilino_id === a.id &&
                    c.estatus === 'activo'
                );

                return (

                  <label
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background:
                        seleccionados.includes(a.id)
                          ? '#f5f3ff'
                          : 'transparent'
                    }}
                  >

                    <input
                      type="checkbox"
                      checked={seleccionados.includes(a.id)}
                      onChange={() =>
                        toggleSeleccion(a.id)
                      }
                    />

                    <div style={{ flex: 1 }}>

                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#111827'
                        }}
                      >
                        {a.nombre}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginTop: '4px'
                        }}
                      >
                        Local {
                          contrato?.locales?.numero ??
                          contrato?.local_id
                        } — $
                        {Number(
                          contrato?.renta
                        ).toLocaleString()}/mes
                      </div>

                    </div>

                  </label>
                );
              })
            )}

          </div>

        </div>

        {/* BOTONES */}

        <div
          style={{
            display: 'flex',
            gap: '12px'
          }}
        >

          <button
            className="btn-edit"
            onClick={() => setMostrarPreview(true)}
            disabled={!puedePreview}
          >
            Ver preview
          </button>

          <button
            className="btn-primary"
            onClick={handleAplicar}
            disabled={
              !puedePreview ||
              aplicando
            }
          >
            {
              aplicando
                ? 'Aplicando...'
                : 'Aplicar incremento'
            }
          </button>

        </div>

      </div>

      {/* PREVIEW */}

      {
        mostrarPreview &&
        preview.length > 0 && (

          <div
            className="table-card"
            style={{
              marginBottom: '28px',
              padding: '22px',
              background: '#fffbeb',
              border: '1px solid #fde68a'
            }}
          >

            <h2
              style={{
                fontSize: '15px',
                marginBottom: '16px'
              }}
            >
              Preview — incremento de {porcentaje}%
            </h2>

            <table className="data-table">

              <thead>
                <tr>
                  <th>Arrendatario</th>
                  <th>Renta actual</th>
                  <th>Renta nueva</th>
                  <th>Diferencia</th>
                </tr>
              </thead>

              <tbody>

                {preview.map(({
                  arrendatario,
                  rentaActual,
                  rentaNueva
                }) => (

                  <tr key={arrendatario.id}>

                    <td>
                      {arrendatario.nombre}
                    </td>

                    <td>
                      ${rentaActual.toLocaleString()}
                    </td>

                    <td
                      style={{
                        fontWeight: 600
                      }}
                    >
                      ${rentaNueva.toLocaleString()}
                    </td>

                    <td
                      style={{
                        color: '#16a34a',
                        fontWeight: 600
                      }}
                    >
                      +$
                      {
                        (
                          rentaNueva -
                          rentaActual
                        ).toLocaleString()
                      }
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )
      }

      {/* HISTORIAL */}

      <div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px'
          }}
        >

          <h2
            style={{
              fontSize: '16px',
              margin: 0,
              color: '#111827'
            }}
          >
            Historial de Incrementos
          </h2>

          <span
            style={{
              fontSize: '12px',
              color: '#9ca3af'
            }}
          >
            {historial.length} registros
          </span>

        </div>

        <div className="table-card">

          {
            historial.length === 0 ? (

              <div className="state-message">
                <p>
                  Aún no se han aplicado incrementos.
                </p>
              </div>

            ) : (

              <table className="data-table">

                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Porcentaje</th>
                    <th>Arrendatarios</th>
                    <th>Contratos</th>
                    <th>Pagos actualizados</th>
                  </tr>
                </thead>

                <tbody>

                  {historial.map(h => (

                    <tr key={h.id}>

                      <td>
                        {
                          new Date(
                            h.created_at
                          ).toLocaleDateString('es-MX')
                        }
                      </td>

                      <td>
                        {h.porcentaje}%
                      </td>

                      <td>
                        {
                          h.arrendatarios_afectados?.length ?? 0
                        }
                      </td>

                      <td>
                        {
                          h.contratos_afectados?.length ?? 0
                        }
                      </td>

                      <td>
                        {h.pagos_actualizados}
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>
            )
          }

        </div>

      </div>

    </div>
  );
}