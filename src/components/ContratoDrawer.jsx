import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import "../styles/LocalDrawer.css";
import "../styles/ContratoDrawer.css";

const API_URL_ACTION        = apiUrl('/api/contratos');
const API_URL_LOCALES       = apiUrl('/api/locales');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const BUCKET = "contratos";

export default function ContratoDrawer({ open, onClose, onSaved, contrato = null }) {
  const esEdicion = contrato !== null;

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [locales, setLocales]             = useState([]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [contratosExistentes, setContratosExistentes] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [archivoPDF, setArchivoPDF]       = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState("");

  const [form, setForm] = useState({
    local_id:          "",
    inquilino_id:      "",
    fecha_inicio:      "",
    fecha_vencimiento: "",
    renta:             "",
    contrato_pdf_url:  ""
  });

  // ─── Cargar datos al abrir ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      fetchOptions();
      resetUpload();

      if (contrato) {
        setForm({
          local_id:          String(contrato.local_id || ""),
          inquilino_id:      String(contrato.inquilino_id || ""),
          fecha_inicio:      contrato.fecha_inicio || "",
          fecha_vencimiento: contrato.fecha_vencimiento || "",
          renta:             contrato.renta || "",
          contrato_pdf_url:  contrato.contrato_pdf_url || ""
        });
        if (contrato.contrato_pdf_url) {
          const partes = contrato.contrato_pdf_url.split("/");
          setNombreArchivo(decodeURIComponent(partes[partes.length - 1]));
        }
      } else {
        setForm({ local_id: "", inquilino_id: "", fecha_inicio: "", fecha_vencimiento: "", renta: "", contrato_pdf_url: "" });
      }
      setError("");
    }
  }, [open, contrato]);

  const resetUpload = () => { setArchivoPDF(null); setUploadProgress(null); setNombreArchivo(""); };

  // ─── Fetch opciones ───────────────────────────────────────────────────────
  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [localesRes, arrendRes, contratosRes] = await Promise.all([
        fetch(API_URL_LOCALES,       { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(API_URL_ARRENDATARIOS, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(API_URL_ACTION,        { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      const [localesData, arrendData, contratosData] = await Promise.all([
        localesRes.json(), arrendRes.json(), contratosRes.json()
      ]);

      const disponibles = (localesData.data || []).filter(local => {
        if (esEdicion && Number(local.numero) === Number(contrato?.local_id)) return true;
        return local.estatus !== "rentado";
      });

      const contratosActivos = (contratosData.data || []).filter(c => c.estatus === "activo");
      const arrendatariosOcupados = contratosActivos.map(c => c.inquilino_id);
      const arrendatariosDisponibles = (arrendData.data || []).filter(a => {
        if (esEdicion && a.id === contrato?.inquilino_id) return true;
        return !arrendatariosOcupados.includes(a.id);
      });

      setLocales(disponibles);
      setArrendatarios(arrendatariosDisponibles);
      setContratosExistentes(contratosData.data || []);
    } catch (err) {
      setError("Error cargando opciones: " + err.message);
    } finally {
      setLoadingOptions(false);
    }
  };

  // ─── Autocompletar renta al seleccionar local ─────────────────────────────
  const handleLocalChange = (numeroLocal) => {
    const localSeleccionado = locales.find(l => String(l.numero) === String(numeroLocal));
    setForm(prev => ({
      ...prev,
      local_id: numeroLocal,
      renta: localSeleccionado ? String(localSeleccionado.renta) : prev.renta
    }));
  };

  // ─── Selección de PDF ─────────────────────────────────────────────────────
  const handleArchivoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo no debe superar 10 MB.");
      e.target.value = "";
      return;
    }
    setError("");
    setArchivoPDF(file);
    setNombreArchivo(file.name);
    setUploadProgress(null);
  };

  // ─── Subir PDF ────────────────────────────────────────────────────────────
  const subirPDF = async () => {
    if (!archivoPDF) return form.contrato_pdf_url || null;
    setUploadProgress("uploading");

    const timestamp    = Date.now();
    const nombreLimpio = archivoPDF.name.replace(/\s+/g, "_");
    const filePath     = `${form.local_id || "sin_local"}/${timestamp}_${nombreLimpio}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, archivoPDF, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      setUploadProgress("error");
      throw new Error("Error al subir el PDF: " + uploadError.message);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

    if (signedError) {
      setUploadProgress("error");
      throw new Error("Error al generar URL del PDF: " + signedError.message);
    }

    setUploadProgress("done");
    return signedData.signedUrl;
  };

  // ─── Guardar ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (form.fecha_inicio > form.fecha_vencimiento)
        throw new Error("La fecha de inicio no puede ser mayor a la de vencimiento");

      const tieneSolapamiento = contratosExistentes.some(c => {
        if (esEdicion && c.id === contrato?.id) return false;
        if (String(c.local_id) !== String(form.local_id)) return false;
        if (!["activo", "vencido"].includes(c.estatus)) return false;
        const ini = new Date(c.fecha_inicio), fin = new Date(c.fecha_vencimiento);
        const ini2 = new Date(form.fecha_inicio), fin2 = new Date(form.fecha_vencimiento);
        return ini2 <= fin && fin2 >= ini;
      });
      if (tieneSolapamiento)
        throw new Error("Ya existe un contrato activo o vencido para ese local en esas fechas.");

      const pdfUrl = await subirPDF();

      const payload = {
        local_id:          Number(form.local_id),
        inquilino_id:      form.inquilino_id,
        fecha_inicio:      form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        contrato_pdf_url:  pdfUrl || null
      };
      if (esEdicion) payload.id = contrato.id;

      const response = await fetch(API_URL_ACTION, {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en la operación");

      // Obtener información del usuario autenticado para el log
      const { data: { user } } = await supabase.auth.getUser();

      // Obtener nombres del local y arrendatario para la descripción
      const localSeleccionado = locales.find(l => String(l.numero) === String(form.local_id));
      const arrendatarioSeleccionado = arrendatarios.find(a => a.id === form.inquilino_id);

      // Registrar la acción en los logs
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: esEdicion ? "editar" : "crear",
        entidad: "contratos",
        entidad_id: esEdicion ? contrato.id : (result.data?.id || ""),
        descripcion: `Contrato Local #${localSeleccionado?.numero || form.local_id} - ${arrendatarioSeleccionado?.nombre || form.inquilino_id} ${esEdicion ? "modificado" : "creado"}`
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={handleOverlayClick}>
      <div className="drawer-panel" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="drawer-header">
          <div className="drawer-header-text">
            <h2>{esEdicion ? "Editar Contrato" : "Nuevo Contrato"}</h2>
            <p>
              {esEdicion
                ? `Local #${contrato.local_id} · modificando vigencia`
                : "Completa los datos del nuevo contrato"}
            </p>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {loadingOptions ? (
          <div className="drawer-loading">
            <span className="drawer-loading-dot" />
            <span className="drawer-loading-dot" />
            <span className="drawer-loading-dot" />
            <span>Cargando opciones…</span>
          </div>
        ) : (
          <div className="drawer-fields">

            {/* ── Sección: Asignación ── */}
            <p className="drawer-section-title">Asignación</p>

            {/* Local */}
            <div className="drawer-field">
              <label htmlFor="local">Local</label>
              <select
                id="local"
                value={form.local_id}
                onChange={e => handleLocalChange(e.target.value)}
              >
                <option value="">Selecciona un local</option>
                {locales.map(local => (
                  <option key={local.id} value={local.numero}>
                    Local {local.numero} — ${Number(local.renta).toLocaleString()}/mes
                  </option>
                ))}
              </select>
            </div>

            {/* Arrendatario */}
            <div className="drawer-field">
              <label htmlFor="inquilino">Arrendatario</label>
              <select
                id="inquilino"
                value={form.inquilino_id}
                onChange={e => setForm({ ...form, inquilino_id: e.target.value })}
              >
                <option value="">Selecciona un arrendatario</option>
                {arrendatarios.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>

            {/* ── Sección: Vigencia ── */}
            <p className="drawer-section-title">Vigencia</p>

            <div className="drawer-fields-grid">
              <div className="drawer-field">
                <label htmlFor="fecha_inicio">Fecha inicio</label>
                <input
                  id="fecha_inicio"
                  type="date"
                  value={form.fecha_inicio}
                  disabled={esEdicion}
                  onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="drawer-field">
                <label htmlFor="fecha_vencimiento">Fecha vencimiento</label>
                <input
                  id="fecha_vencimiento"
                  type="date"
                  value={form.fecha_vencimiento}
                  disabled={esEdicion}
                  onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                />
              </div>
            </div>

            {/* ── Sección: Financiero ── */}
            <p className="drawer-section-title">Financiero</p>

            {/* Renta — solo lectura */}
            <div className="drawer-field drawer-field-readonly">
              <label htmlFor="renta">Renta mensual</label>
              <input
                id="renta"
                type="text"
                value={form.renta ? `$${Number(form.renta).toLocaleString("es-MX")}` : ""}
                disabled
                placeholder="Se carga al seleccionar un local"
              />
            </div>

            {/* ── Sección: Documento ── */}
            <p className="drawer-section-title">Documento</p>

            <div className="drawer-upload">
              <span className="drawer-upload-label">Contrato PDF</span>

              {/* Ver contrato existente */}
              {form.contrato_pdf_url && !archivoPDF && (
                <a
                  href={form.contrato_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="drawer-upload-view"
                >
                  📄 Ver contrato actual
                </a>
              )}

              {/* Zona de upload */}
              <div className="drawer-upload-zone">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleArchivoChange}
                />
                <span className="drawer-upload-zone-text">
                  <strong>Selecciona un PDF</strong> o arrástralo aquí
                  <br />
                  <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>Máximo 10 MB</span>
                </span>
              </div>

              {/* Nombre archivo
              {nombreArchivo && uploadProgress == null && (
                <span className="drawer-upload-filename">📎 {nombreArchivo}</span>
              )}
 */}
              {/* Estados */}
              {uploadProgress === "uploading" && (
                <span className="drawer-upload-status uploading">⏳ Subiendo PDF…</span>
              )}
              {uploadProgress === "done" && (
                <span className="drawer-upload-status done">✅ PDF subido correctamente</span>
              )}
              {uploadProgress === "error" && (
                <span className="drawer-upload-status error">❌ Error al subir el PDF</span>
              )}
            </div>

          </div>
        )}

        {/* ── Hint ── */}
        <div className="drawer-hint">
          <span className="drawer-hint-icon">ℹ</span>
          <span>El estatus del contrato se actualiza automáticamente según las fechas y los pagos registrados.</span>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="drawer-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Acciones ── */}
        <div className="drawer-actions">
          <button className="drawer-btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="drawer-btn-save"
            onClick={handleSubmit}
            disabled={loading || loadingOptions || uploadProgress === "uploading"}
          >
            {loading ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear contrato"}
          </button>
        </div>

      </div>
    </div>
  );
}