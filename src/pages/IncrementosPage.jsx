import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_INCREMENTOS  = apiUrl('/api/incrementos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_CONTRATOS     = apiUrl('/api/contratos');

export default function IncrementosPage() {
  const [arrendatarios, setArrendatarios] = useState([]);
  const [contratos, setContratos]         = useState([]);
  const [historial, setHistorial]         = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [aplicando, setAplicando]         = useState(false);
  const [error, setError]                 = useState(null);
  const [exito, setExito]                 = useState(null);

  // Formulario
  const [porcentaje, setPorcentaje]           = useState("");
  const [seleccionados, setSeleccionados]     = useState([]); // uuid[]
  const [mostrarPreview, setMostrarPreview]   = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const token = await getToken();
      const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

      const [arrRes, contRes, incRes] = await Promise.all([
        fetch(API_URL_ARRENDATARIOS, { headers }),
        fetch(API_URL_CONTRATOS,     { headers }),
        fetch(API_URL_INCREMENTOS,   { headers }),
      ]);

      const [arrData, contData, incData] = await Promise.all([
        arrRes.json(), contRes.json(), incRes.json()
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

  useEffect(() => { fetchData(); }, []);

  // Solo arrendatarios con contrato activo
  const arrendatariosConContrato = arrendatarios.filter(a =>
    contratos.some(c => c.inquilino_id === a.id && c.estatus === 'activo')
  );

  const toggleSeleccion = (id) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (seleccionados.length === arrendatariosConContrato.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(arrendatariosConContrato.map(a => a.id));
    }
  };

  // Preview: calcula renta actual → renta nueva por arrendatario seleccionado
  const preview = seleccionados
    .map(id => {
      const arrendatario = arrendatarios.find(a => a.id === id);
      const contrato = contratos.find(c => c.inquilino_id === id && c.estatus === 'activo');
      if (!arrendatario || !contrato) return null;
      const rentaActual = Number(contrato.renta);
      const rentaNueva = Math.round(rentaActual * (1 + Number(porcentaje) / 100) * 100) / 100;
      return { arrendatario, contrato, rentaActual, rentaNueva };
    })
    .filter(Boolean);

  const puedePreview = porcentaje > 0 && seleccionados.length > 0;

  const handleAplicar = async () => {
    setAplicando(true);
    setError(null);
    setExito(null);
    try {
      const token = await getToken();

      const response = await fetch(API_URL_INCREMENTOS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ porcentaje: Number(porcentaje), inquilino_ids: seleccionados })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al aplicar incremento");

      setExito(`Incremento aplicado: ${result.resumen.contratos_afectados} contrato(s), ${result.resumen.pagos_actualizados} pago(s) actualizados.`);
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

  if (loadingData) return <div style={{ padding: '20px' }}><p>Cargando...</p></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '860px' }}>
      <h1 style={{ marginBottom: '4px' }}>Incrementos de Renta</h1>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>
        Aplica un porcentaje de incremento a los pagos pendientes de los contratos activos seleccionados.
      </p>

      {error  && <p style={{ color: '#dc2626', marginBottom: '12px' }}>{error}</p>}
      {exito  && <p style={{ color: '#16a34a', marginBottom: '12px' }}>{exito}</p>}

      {/* ── Formulario ── */}
      <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '20px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '15px', marginBottom: '16px' }}>Nuevo Incremento</h2>

        {/* Porcentaje */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
            Porcentaje de incremento
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Ej. 10"
              value={porcentaje}
              onChange={e => { setPorcentaje(e.target.value); setMostrarPreview(false); setExito(null); }}
              style={{ width: '120px' }}
            />
            <span style={{ color: '#888' }}>%</span>
          </div>
        </div>

        {/* Selección de arrendatarios */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '13px', color: '#555' }}>
              Arrendatarios con contrato activo ({arrendatariosConContrato.length})
            </label>
            <button
              onClick={toggleTodos}
              style={{ fontSize: '12px', color: '#555', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {seleccionados.length === arrendatariosConContrato.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div style={{ border: '1px solid #eee', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {arrendatariosConContrato.length === 0 ? (
              <p style={{ padding: '12px', color: '#888', fontSize: '13px', margin: 0 }}>
                No hay arrendatarios con contratos activos.
              </p>
            ) : (
              arrendatariosConContrato.map(a => {
                const contrato = contratos.find(c => c.inquilino_id === a.id && c.estatus === 'activo');
                return (
                  <label
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      background: seleccionados.includes(a.id) ? '#f0fdf4' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={seleccionados.includes(a.id)}
                      onChange={() => toggleSeleccion(a.id)}
                    />
                    <span style={{ flex: 1, fontSize: '14px' }}>{a.nombre}</span>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      Local {contrato?.locales?.numero ?? contrato?.local_id} — ${Number(contrato?.renta).toLocaleString()}/mes
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setMostrarPreview(true)}
            disabled={!puedePreview}
          >
            Ver preview
          </button>
          <button
            className="btn-primary"
            onClick={handleAplicar}
            disabled={!puedePreview || aplicando}
          >
            {aplicando ? 'Aplicando...' : 'Aplicar incremento'}
          </button>
        </div>
      </div>

      {/* ── Preview ── */}
      {mostrarPreview && preview.length > 0 && (
        <div style={{ border: '1px solid #fbbf24', borderRadius: '8px', padding: '20px', marginBottom: '28px', background: '#fffbeb' }}>
          <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>
            Preview — incremento de {porcentaje}%
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #fde68a' }}>
                <th style={{ textAlign: 'left', paddingBottom: '8px' }}>Arrendatario</th>
                <th style={{ textAlign: 'right', paddingBottom: '8px' }}>Renta actual</th>
                <th style={{ textAlign: 'right', paddingBottom: '8px' }}>Renta nueva</th>
                <th style={{ textAlign: 'right', paddingBottom: '8px' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(({ arrendatario, rentaActual, rentaNueva }) => (
                <tr key={arrendatario.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                  <td style={{ padding: '8px 0' }}>{arrendatario.nombre}</td>
                  <td style={{ textAlign: 'right' }}>${rentaActual.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${rentaNueva.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', color: '#16a34a' }}>+${(rentaNueva - rentaActual).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Historial ── */}
      <div>
        <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Historial de Incrementos</h2>
        {historial.length === 0 ? (
          <p style={{ color: '#888', fontSize: '13px' }}>Aún no se han aplicado incrementos.</p>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th>Fecha</th>
                <th>Porcentaje</th>
                <th>Arrendatarios</th>
                <th>Contratos</th>
                <th>Pagos actualizados</th>
              </tr>
            </thead>
            <tbody>
              {historial.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{new Date(h.created_at).toLocaleDateString('es-MX')}</td>
                  <td>{h.porcentaje}%</td>
                  <td>{h.arrendatarios_afectados?.length ?? 0}</td>
                  <td>{h.contratos_afectados?.length ?? 0}</td>
                  <td>{h.pagos_actualizados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}