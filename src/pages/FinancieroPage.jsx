import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import PagoDrawer from "../components/PagoDrawer";

const API_URL_GET = apiUrl('/api/pagos');

const ESTADO_LABELS = {
  al_dia: "Al día",
  parcial: "Parcial",
  pendiente: "Pendiente"
};

export default function FinancieroPage() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPago, setSelectedPago] = useState(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");

  const fetchPagos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = new URLSearchParams();
      if (filtroEstado)  params.append('estado', filtroEstado);
      if (filtroPeriodo) params.append('periodo', filtroPeriodo);

      const url = `${API_URL_GET}${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Respuesta no válida del servidor:", text);
        throw new Error("El servidor no respondió con JSON. Revisa la URL en Vercel.");
      }

      const result = await response.json();
      setPagos(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos();
  }, [filtroEstado, filtroPeriodo]);

  // Resumen rápido
  const totalEsperado = pagos.reduce((sum, p) => sum + Number(p.monto_esperado || 0), 0);
  const totalPagado   = pagos.reduce((sum, p) => sum + Number(p.monto_pagado || 0), 0);
  const totalPendiente = pagos.filter(p => p.estado === 'pendiente').length;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Financiero</h1>
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total esperado</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>${totalEsperado.toLocaleString()}</p>
        </div>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total cobrado</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#16a34a' }}>${totalPagado.toLocaleString()}</p>
        </div>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Pagos pendientes</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#dc2626' }}>{totalPendiente}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="al_dia">Al día</option>
        </select>

        <input
          type="month"
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
          placeholder="Filtrar por periodo"
        />

        {(filtroEstado || filtroPeriodo) && (
          <button onClick={() => { setFiltroEstado(""); setFiltroPeriodo(""); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th>Periodo</th>
              <th>Local</th>
              <th>Arrendatario</th>
              <th>Esperado</th>
              <th>Pagado</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Fecha Pago</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{p.periodo}</td>
                <td>{p.local_id ?? '—'}</td>
                <td>{p.contratos?.arrendatarios?.nombre || '—'}</td>
                <td>${Number(p.monto_esperado).toLocaleString()}</td>
                <td>${Number(p.monto_pagado || 0).toLocaleString()}</td>
                <td style={{ color: p.diferencia < 0 ? '#dc2626' : '#16a34a' }}>
                  ${Number(p.diferencia || 0).toLocaleString()}
                </td>
                <td>{ESTADO_LABELS[p.estado] || p.estado}</td>
                <td>{p.fecha_pago || '—'}</td>
                <td>
                  <button onClick={() => { setSelectedPago(p); setDrawerOpen(true); }}>
                    Registrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PagoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pago={selectedPago}
        onSaved={fetchPagos}
      />
    </div>
  );
}