import { createClient } from '@supabase/supabase-js';

// Cliente ADMIN (para operaciones de base de datos)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cliente AUTH (para validar tokens de usuario)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Genera un registro de pago por cada mes entre fecha_inicio y fecha_vencimiento.
 */
function generarPagos(contrato_id, local_id, renta, fecha_inicio, fecha_vencimiento) {
  const pagos = [];
  const fin = new Date(fecha_vencimiento);
  const inicio = new Date(fecha_inicio);
  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);

  while (cursor <= fin) {
    const año = cursor.getFullYear();
    const mes = String(cursor.getMonth() + 1).padStart(2, '0');
    pagos.push({
      periodo: `${año}-${mes}`,
      contrato_id,
      local_id,
      monto_esperado: renta,
      monto_pagado: 0
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return pagos;
}

/**
 * Actualiza el estatus del local correspondiente.
 * Nota: local_id en contratos corresponde a locales.numero
 */
async function actualizarEstatusLocal(local_id, estatus) {
  const { error } = await supabaseAdmin
    .from('locales')
    .update({ estatus })
    .eq('numero', local_id);

  if (error) console.error(`Error actualizando estatus local ${local_id}:`, error.message);
}

/**
 * Obtiene la renta actual del local por su numero.
 * La renta siempre viene del local — nunca del payload del contrato.
 */
async function obtenerRentaDesdeLocal(local_id) {
  const { data, error } = await supabaseAdmin
    .from('locales')
    .select('renta')
    .eq('numero', local_id)
    .single();

  if (error) {
    console.error(`Error obteniendo renta del local ${local_id}:`, error.message);
    return null;
  }
  return data?.renta ?? null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // ─── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const { method } = req;

  try {
    switch (method) {

      // ─── GET ───────────────────────────────────────────────────────────────
      case 'GET': {
        const { data, error } = await supabaseAdmin
          .from('contratos')
          .select('*, arrendatarios(nombre), locales(numero, renta)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      // ─── POST ──────────────────────────────────────────────────────────────
      case 'POST': {
        // Borrado alternativo vía POST
        if (req.body.action === 'delete') {
          const { error: delError } = await supabaseAdmin
            .from('contratos')
            .delete()
            .eq('id', req.body.id);

          if (delError) throw delError;
          return res.status(200).json({ success: true, message: 'Contrato eliminado' });
        }

        // Creación normal — renta siempre viene del local, nunca del payload
        const { local_id, inquilino_id, fecha_inicio, fecha_vencimiento, estatus, contrato_pdf_url } = req.body;

        if (!local_id || !inquilino_id || !fecha_inicio || !fecha_vencimiento) {
          return res.status(400).json({ error: 'local_id, inquilino_id, fecha_inicio y fecha_vencimiento son requeridos' });
        }

        // Obtener renta desde el local (fuente de verdad)
        const rentaDelLocal = await obtenerRentaDesdeLocal(local_id);
        if (rentaDelLocal === null) {
          return res.status(400).json({ error: `No se encontró el local con número ${local_id}` });
        }

        const { data: postData, error: postError } = await supabaseAdmin
          .from('contratos')
          .insert([{
            local_id: Number(local_id),
            inquilino_id,
            fecha_inicio,
            fecha_vencimiento,
            renta: rentaDelLocal,           // ← siempre desde locales.renta
            estatus: estatus || 'activo',
            contrato_pdf_url: contrato_pdf_url || null
          }])
          .select()
          .single();

        if (postError) throw postError;

        const { id: contrato_id } = postData;

        // Marcar local como rentado
        await actualizarEstatusLocal(local_id, 'rentado');

        // Generar pagos mensuales automáticamente
        const pagos = generarPagos(contrato_id, local_id, rentaDelLocal, fecha_inicio, fecha_vencimiento);
        const { error: pagosError } = await supabaseAdmin.from('pagos').insert(pagos);
        if (pagosError) console.error('Error generando pagos:', pagosError.message);

        return res.status(201).json({ success: true, data: postData });
      }

      // ─── PUT ───────────────────────────────────────────────────────────────
      case 'PUT': {
        const { id, ...updateData } = req.body;

        if (!id) return res.status(400).json({ error: 'ID es requerido' });

        // Eliminar renta del payload — la renta solo se actualiza desde /api/locales
        delete updateData.renta;

        // Obtener local_id del contrato actual para sincronizar la renta vigente
        const { data: contratoActual, error: contratoError } = await supabaseAdmin
          .from('contratos')
          .select('local_id')
          .eq('id', id)
          .single();

        if (contratoError) throw contratoError;

        // Re-sincronizar renta desde el local al momento de editar el contrato
        const rentaVigente = await obtenerRentaDesdeLocal(contratoActual.local_id);
        if (rentaVigente !== null) {
          updateData.renta = rentaVigente;
        }

        const { data: putData, error: putError } = await supabaseAdmin
          .from('contratos')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (putError) throw putError;

        // Si el contrato pasa a vencido o cancelado → liberar el local
        if (updateData.estatus === 'vencido' || updateData.estatus === 'cancelado') {
          await actualizarEstatusLocal(putData.local_id, 'desocupado');
        }

        // Si el contrato se reactiva → volver a marcar el local como rentado
        if (updateData.estatus === 'activo') {
          await actualizarEstatusLocal(putData.local_id, 'rentado');
        }

        return res.status(200).json({ success: true, data: putData });
      }

      // ─── DELETE ────────────────────────────────────────────────────────────
      case 'DELETE': {
        const id = req.query.id || req.body.id;

        if (!id) return res.status(400).json({ error: 'ID es requerido' });

        const { error } = await supabaseAdmin
          .from('contratos')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Contrato eliminado' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }

  } catch (error) {
    console.error('SERVER ERROR /api/contratos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}