import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_ACTION        = apiUrl('/api/contratos');
const API_URL_LOCALES       = apiUrl('/api/locales');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');

const BUCKET = "contratos"; // nombre del bucket en Supabase Storage

export default function ContratoDrawer({ open, onClose, onSaved, contrato = null }) {
  const esEdicion = contrato !== null;

  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [locales, setLocales]               = useState([]);
  const [arrendatarios, setArrendatarios]   = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Estado para el archivo PDF seleccionado
  const [archivoPDF, setArchivoPDF]         = useState(null);       // File object
  const [uploadProgress, setUploadProgress] = useState(null);       // null | "uploading" | "done" | "error"
  const [nombreArchivo, setNombreArchivo]   = useState("");          // nombre visible

  const [form, setForm] = useState({
    local_id:          "",
    inquilino_id:      "",
    fecha_inicio:      "",
    fecha_vencimiento: "",
    renta:             "",
    estatus:           "activo",
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
          estatus:           contrato.estatus || "activo",
          contrato_pdf_url:  contrato.contrato_pdf_url || ""
        });
        // Mostrar nombre del archivo existente si hay URL
        if (contrato.contrato_pdf_url) {
          const partes = contrato.contrato_pdf_url.split("/");
          setNombreArchivo(decodeURIComponent(partes[partes.length - 1]));
        }
      } else {
        setForm({
          local_id:          "",
          inquilino_id:      "",
          fecha_inicio:      "",
          fecha_vencimiento: "",
          renta:             "",
          estatus:           "activo",
          contrato_pdf_url:  ""
        });
      }
      setError("");
    }
     console.log("contrato_pdf_url:", contrato.contrato_pdf_url);
  }, [open, contrato]);

  const resetUpload = () => {
    setArchivoPDF(null);
    setUploadProgress(null);
    setNombreArchivo("");
  };

  // ─── Cargar locales y arrendatarios ──────────────────────────────────────
  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const [localesRes, arrendRes] = await Promise.all([
        fetch(API_URL_LOCALES,       { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(API_URL_ARRENDATARIOS, { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      const [localesData, arrendData] = await Promise.all([
        localesRes.json(),
        arrendRes.json()
      ]);

      setLocales(localesData.data || []);
      setArrendatarios(arrendData.data || []);
    } catch (err) {
      setError("Error cargando opciones: " + err.message);
    } finally {
      setLoadingOptions(false);
    }
  };

  // ─── Selección de local → autocompleta renta ─────────────────────────────
  const handleLocalChange = (numeroLocal) => {
    const localSeleccionado = locales.find(l => String(l.numero) === String(numeroLocal));
    setForm(prev => ({
      ...prev,
      local_id: numeroLocal,
      renta: localSeleccionado ? String(localSeleccionado.renta) : prev.renta
    }));
  };

  // ─── Selección de archivo PDF ─────────────────────────────────────────────
  const handleArchivoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea PDF
    if (file.type !== "application/pdf") {
      setError("Solo se permiten archivos PDF.");
      e.target.value = "";
      return;
    }

    // Validar tamaño máximo: 10 MB
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo no debe superar ${MAX_MB} MB.`);
      e.target.value = "";
      return;
    }

    setError("");
    setArchivoPDF(file);
    setNombreArchivo(file.name);
    setUploadProgress(null);
  };

  // ─── Subir PDF a Supabase Storage ─────────────────────────────────────────
  // Retorna la URL pública (o firmada) del archivo subido.
  const subirPDF = async () => {
    if (!archivoPDF) return form.contrato_pdf_url || null;

    setUploadProgress("uploading");

    // Ruta: contratos/{local_id}/{timestamp}_{nombre}.pdf
    const timestamp  = Date.now();
    const nombreLimpio = archivoPDF.name.replace(/\s+/g, "_");
    const filePath   = `${form.local_id || "sin_local"}/${timestamp}_${nombreLimpio}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, archivoPDF, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadError) {
      setUploadProgress("error");
      throw new Error("Error al subir el PDF: " + uploadError.message);
    }

    // Generar URL firmada con validez de 10 años (bucket privado)
    const DIEZ_ANOS_EN_SEGUNDOS = 60 * 60 * 24 * 365 * 10;
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, DIEZ_ANOS_EN_SEGUNDOS);

    if (signedError) {
      setUploadProgress("error");
      throw new Error("Error al generar URL del PDF: " + signedError.message);
    }

    setUploadProgress("done");
    return signedData.signedUrl;
  };

  // ─── Guardar contrato ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Subir PDF primero (si hay archivo nuevo seleccionado)
      const pdfUrl = await subirPDF();

      // 2. Construir payload — renta se ignora en el backend (viene del local)
      const payload = {
        local_id:          Number(form.local_id),
        inquilino_id:      form.inquilino_id,
        fecha_inicio:      form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        estatus:           form.estatus,
        contrato_pdf_url:  pdfUrl || null
      };

      if (esEdicion) payload.id = contrato.id;

      const response = await fetch(API_URL_ACTION, {
        method: esEdicion ? "PUT" : "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="drawer-container">
      <h2>{esEdicion ? "Editar Contrato" : "Nuevo Contrato"}</h2>

      {loadingOptions ? (
        <p>Cargando opciones...</p>
      ) : (
        <>
          {/* Local */}
          <select
            value={form.local_id}
            onChange={e => handleLocalChange(e.target.value)}
          >
            <option value="">Selecciona un Local</option>
            {locales.map(local => (
              <option key={local.id} value={local.numero}>
                Local {local.numero} — ${Number(local.renta).toLocaleString()}/mes
              </option>
            ))}
          </select>

          {/* Arrendatario */}
          <select
            value={form.inquilino_id}
            onChange={e => setForm({ ...form, inquilino_id: e.target.value })}
          >
            <option value="">Selecciona un Arrendatario</option>
            {arrendatarios.map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>

          {/* Fechas */}
          <input
            type="date"
            placeholder="Fecha Inicio"
            value={form.fecha_inicio}
            onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
          />
          <input
            type="date"
            placeholder="Fecha Vencimiento"
            value={form.fecha_vencimiento}
            onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
          />

          {/* Renta — solo lectura, viene del local */}
          <input
            type="number"
            placeholder="Renta (desde el local)"
            value={form.renta}
            disabled
            style={{ opacity: 0.6, cursor: "not-allowed" }}
          />

          {/* Estatus */}
          <select
            value={form.estatus}
            onChange={e => setForm({ ...form, estatus: e.target.value })}
          >
            <option value="activo">Activo</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {/* ── Upload PDF ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontWeight: 500, fontSize: "0.9rem" }}>
              Contrato PDF
            </label>

           {/* Mostrar botón si ya hay un PDF guardado */}
{form.contrato_pdf_url && !archivoPDF && (
  <button
    type="button"
    onClick={() => window.open(form.contrato_pdf_url, "_blank")}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      fontSize: "0.85rem",
      cursor: "pointer",
      background: "transparent",
      border: "1px solid #ccc",
      borderRadius: "6px",
      width: "fit-content"
    }}
  >
    📄 Ver contrato actual
  </button>
)}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleArchivoChange}
            />

            {/* Nombre del archivo seleccionado */}
            {nombreArchivo && (
              <span style={{ fontSize: "0.8rem", color: "#555" }}>
                📎 {nombreArchivo}
              </span>
            )}

            {/* Estado del upload */}
            {uploadProgress === "uploading" && (
              <span style={{ fontSize: "0.8rem", color: "#888" }}>⏳ Subiendo PDF...</span>
            )}
            {uploadProgress === "done" && (
              <span style={{ fontSize: "0.8rem", color: "green" }}>✅ PDF subido correctamente</span>
            )}
            {uploadProgress === "error" && (
              <span style={{ fontSize: "0.8rem", color: "red" }}>❌ Error al subir el PDF</span>
            )}
          </div>
        </>
      )}

      {error && <p style={{ color: "red", fontSize: "0.85rem" }}>{error}</p>}

      <button onClick={onClose}>Cancelar</button>
      <button
        onClick={handleSubmit}
        disabled={loading || loadingOptions || uploadProgress === "uploading"}
      >
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}