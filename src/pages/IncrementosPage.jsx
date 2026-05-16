import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import "../styles/Page.css";
import "../styles/IncrementosPage.css";

const API_URL_INCREMENTOS   = apiUrl('/api/incrementos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_CONTRATOS     = apiUrl('/api/contratos');

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX")}`;

const fmtFecha = (f) =>
  new Date(f).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric"
  });

export default function IncrementosPage() {
  const [arrendatarios, setArrendatarios] = useState([]);
  const [contratos, setContratos]         = useState([]);
  const [historial, setHistorial]         = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [aplicando, setAplicando]         = useState(false);
  const [error, setError]                 = useState(null);
  const [exito, setExito]                 = useState(null);
  const [porcentaje, setPorcentaje]       = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);

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

  const contratosMap = new Map(contratos.map(c => [c.inquilino_id, c]));

  const arrendatariosConContrato = arrendatarios.filter(a =>
    contratos.some(c => c.inquilino_id === a.id && c.estatus === "activo")
  );

  const toggleSeleccion = (id) =>
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );

  const toggleTodos = () =>
    setSeleccionados(
      seleccionados.length === arrendatariosConContrato.length
        ? []
        : arrendatariosConContrato.map(a => a.id)
    );

  const preview = seleccionados
    .map(id => {
      const arrendatario = arrendatarios.find(a => a.id === id);
      const contrato = contratosMap.get(id);
      if (!arrendatario || !contrato) return null;
      const rentaActual = Number(contrato.renta);
      const rentaNueva  = Math.round(rentaActual * (1 + Number(porcentaje) / 100) * 100) / 100;
      return { arrendatario, contrato, rentaActual, rentaNueva };
    })
    .filter(Boolean);

  const puedePreview = porcentaje > 0 && seleccionados.length > 0;

  const handleAplicar = async () => {
    const porcentajeNumero = Number(porcentaje);
    if (isNaN(porcentajeNumero) || porcentajeNumero <= 0 || porcentajeNumero > 100) {
      setError("El porcentaje debe estar entre 1 y 100");
      return;
    }
    setAplicando(true);
    setError(null);
    setExito(null);
    try {
      const token = await getToken();
      const response = await fetch(API_URL_INCREMENTOS, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ porcentaje: porcentajeNumero, inquilino_ids: seleccionados })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al aplicar incremento");

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "aplicar_incremento",
        entidad: "incrementos",
        entidad_id: result.data?.id || "",
        descripcion: `Incremento ${porcentajeNumero}% aplicado a ${seleccionados.length} contrato(s), ${result.resumen?.pagos_actualizados ?? 0} pago(s) actualizados.`
      });

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

  if (loadingData) {
    return <div className="container"><div className="state-message"><p>Cargando…</p></div></div>;
  }

  return (
    <div className="container">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Incrementos de Renta</h1>
          <p>Aplica incrementos a contratos activos y actualiza pagos pendientes automáticamente</p>
        </div>
      </div>

      {/* ── Alertas ── */}
      {error && <div className="inc-alert error">{error}</div>}
      {exito && <div className="inc-alert success">{exito}</div>}

      {/* ── Formulario ── */}
      <div className="inc-section">
        <h2 className="inc-section-title">Nuevo Incremento</h2>

        {/* Porcentaje */}
        <div className="inc-field">
          <label>Porcentaje de incremento</label>
          <div className="inc-porcentaje-row">
            <input
              className="filter-input"
              type="number"
              min="1"
              max="100"
              placeholder="Ej. 10"
              value={porcentaje}
              onChange={e => {
                setPorcentaje(e.target.value);
                setMostrarPreview(false);
                setExito(null);
              }}
            />
            <span className="inc-porcentaje-symbol">%</span>
          </div>
        </div>

        {/* Lista de arrendatarios */}
        <div>
          <div className="inc-list-header">
            <span className="inc-list-label">Arrendatarios con contrato activo</span>
            <button className="btn-edit" onClick={toggleTodos}>
              {seleccionados.length === arrendatariosConContrato.length ? "Quitar" : "Todos"}
            </button>
          </div>

          <div className="inc-list">
            {arrendatariosConContrato.length === 0 ? (
              <div className="state-message">
                <p>No hay arrendatarios con contratos activos.</p>
              </div>
            ) : (
              arrendatariosConContrato.map(a => {
                const contrato = contratos.find(c => c.inquilino_id === a.id && c.estatus === "activo");
                const selec = seleccionados.includes(a.id);
                return (
                  <label key={a.id} className={`inc-list-item ${selec ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selec}
                      onChange={() => toggleSeleccion(a.id)}
                    />
                    <div>
                      <div className="inc-list-name">{a.nombre}</div>
                      <div className="inc-list-sub">
                        Local {contrato?.locales?.numero ?? contrato?.local_id} — {fmt(contrato?.renta)}/mes
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="inc-actions">
          <button className="btn-edit" onClick={() => setMostrarPreview(true)} disabled={!puedePreview}>
            Ver preview
          </button>
          <button className="btn-primary" onClick={handleAplicar} disabled={!puedePreview || aplicando}>
            {aplicando ? "Aplicando…" : "Aplicar incremento"}
          </button>
        </div>
      </div>

      {/* ── Preview ── */}
      {mostrarPreview && preview.length > 0 && (
        <div className="inc-preview">
          <p className="inc-preview-title">Preview — incremento de {porcentaje}%</p>

          {/* Desktop: tabla */}
          <div className="inc-preview-table table-scroll">
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
                {preview.map(({ arrendatario, rentaActual, rentaNueva }) => (
                  <tr key={arrendatario.id}>
                    <td>{arrendatario.nombre}</td>
                    <td className="col-money">{fmt(rentaActual)}</td>
                    <td className="col-money col-total">{fmt(rentaNueva)}</td>
                    <td className="col-money diff-positive">+{fmt(rentaNueva - rentaActual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: cards */}
          <div className="inc-preview-cards">
            {preview.map(({ arrendatario, rentaActual, rentaNueva }) => (
              <div className="inc-preview-card" key={arrendatario.id}>
                <span className="inc-preview-card-name">{arrendatario.nombre}</span>
                <div className="inc-preview-card-montos">
                  <span className="inc-preview-card-nueva">{fmt(rentaNueva)}</span>
                  <span className="inc-preview-card-diff">+{fmt(rentaNueva - rentaActual)}</span>
                  <span className="inc-preview-card-actual">antes: {fmt(rentaActual)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      <div>
        <div className="inc-historial-header">
          <h2 className="inc-historial-title">Historial de Incrementos</h2>
          <span className="inc-historial-count">{historial.length} registros</span>
        </div>

        <div className="table-card">
          {historial.length === 0 ? (
            <div className="state-message"><p>Aún no se han aplicado incrementos.</p></div>
          ) : (
            <>
              {/* Desktop */}
              <div className="inc-desktop table-scroll">
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
                        <td>{fmtFecha(h.created_at)}</td>
                        <td><strong>{h.porcentaje}%</strong></td>
                        <td>{h.arrendatarios_afectados?.length ?? 0}</td>
                        <td>{h.contratos_afectados?.length ?? 0}</td>
                        <td>{h.pagos_actualizados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Móvil */}
              <div className="inc-mobile">
                {historial.map(h => (
                  <div className="inc-card" key={h.id}>
                    <div className="inc-card-left">
                      <div className="inc-card-fecha">{fmtFecha(h.created_at)}</div>
                      <div className="inc-card-pct">+{h.porcentaje}%</div>
                    </div>
                    <div className="inc-card-right">
                      <div className="inc-card-stat">
                        <span className="inc-card-stat-label">Arrendatarios</span>
                        <span className="inc-card-stat-value">{h.arrendatarios_afectados?.length ?? 0}</span>
                      </div>
                      <div className="inc-card-stat">
                        <span className="inc-card-stat-label">Contratos</span>
                        <span className="inc-card-stat-value">{h.contratos_afectados?.length ?? 0}</span>
                      </div>
                      <div className="inc-card-stat">
                        <span className="inc-card-stat-label">Pagos</span>
                        <span className="inc-card-stat-value">{h.pagos_actualizados}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}