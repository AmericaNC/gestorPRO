import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_ACTION = apiUrl('/api/contratos');
const API_URL_LOCALES = apiUrl('/api/locales');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');

export default function ContratoDrawer({ open, onClose, onSaved, contrato = null }) {
  const esEdicion = contrato !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locales, setLocales] = useState([]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [form, setForm] = useState({
    local_id: "",
    inquilino_id: "",
    fecha_inicio: "",
    fecha_vencimiento: "",
    renta: "",
    estatus: "activo",
    contrato_pdf_url: ""
  });

  // Cargar locales y arrendatarios cuando se abre el drawer
  useEffect(() => {
    if (open) {
      fetchOptions();
      if (contrato) {
        setForm({
          local_id: String(contrato.local_id || ""),
          inquilino_id: String(contrato.inquilino_id || ""),
          fecha_inicio: contrato.fecha_inicio || "",
          fecha_vencimiento: contrato.fecha_vencimiento || "",
          renta: contrato.renta || "",
          estatus: contrato.estatus || "activo",
          contrato_pdf_url: contrato.contrato_pdf_url || ""
        });
      } else {
        setForm({
          local_id: "",
          inquilino_id: "",
          fecha_inicio: "",
          fecha_vencimiento: "",
          renta: "",
          estatus: "activo",
          contrato_pdf_url: ""
        });
      }
      setError("");
    }
  }, [open, contrato]);

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Fetch locales
      const localesResponse = await fetch(API_URL_LOCALES, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const localesData = await localesResponse.json();
      setLocales(localesData.data || []);

      // Fetch arrendatarios
      const arrendResponse = await fetch(API_URL_ARRENDATARIOS, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const arrendData = await arrendResponse.json();
      setArrendatarios(arrendData.data || []);
    } catch (err) {
      setError("Error cargando opciones: " + err.message);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        local_id: Number(form.local_id),
        inquilino_id: form.inquilino_id,
        fecha_inicio: form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        renta: Number(form.renta),
        estatus: form.estatus,
        contrato_pdf_url: form.contrato_pdf_url || null
      };

      // Si es edición, agregar el id
      if (esEdicion) {
        payload.id = contrato.id;
      }

      const response = await fetch(API_URL_ACTION, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en la operación");

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="drawer-container">
      <h2>{esEdicion ? "Editar Contrato" : "Nuevo Contrato"}</h2>

      {loadingOptions ? (
        <p>Cargando opciones...</p>
      ) : (
        <>
          <select value={form.local_id} onChange={e => setForm({...form, local_id: e.target.value})}>
            <option value="">Selecciona un Local</option>
            {locales.map(local => (
              <option key={local.id} value={local.numero}>{local.numero}</option>
            ))}
          </select>

          <select value={form.inquilino_id} onChange={e => setForm({...form, inquilino_id: e.target.value})}>
            <option value="">Selecciona un Arrendatario</option>
            {arrendatarios.map(arrendatario => (
              <option key={arrendatario.id} value={arrendatario.id}>{arrendatario.nombre}</option>
            ))}
          </select>

          <input 
            type="date" 
            placeholder="Fecha Inicio" 
            value={form.fecha_inicio} 
            onChange={e => setForm({...form, fecha_inicio: e.target.value})} 
          />

          <input 
            type="date" 
            placeholder="Fecha Vencimiento" 
            value={form.fecha_vencimiento} 
            onChange={e => setForm({...form, fecha_vencimiento: e.target.value})} 
          />

          <input 
            type="number" 
            placeholder="Renta" 
            value={form.renta} 
            onChange={e => setForm({...form, renta: e.target.value})} 
          />

          <select value={form.estatus} onChange={e => setForm({...form, estatus: e.target.value})}>
            <option value="activo">Activo</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <input 
            type="text" 
            placeholder="URL PDF del Contrato (opcional)" 
            value={form.contrato_pdf_url} 
            onChange={e => setForm({...form, contrato_pdf_url: e.target.value})} 
          />
        </>
      )}

      {error && <p style={{color: 'red'}}>{error}</p>}

      <button onClick={onClose}>Cancelar</button>
      <button onClick={handleSubmit} disabled={loading || loadingOptions}>{loading ? "Guardando..." : "Guardar"}</button>
    </div>
  );
}
