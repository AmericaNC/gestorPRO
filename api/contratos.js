import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ────────────────────────────────────────────────────────────── */
/* HELPERS */
/* ────────────────────────────────────────────────────────────── */

const ESTATUS_VALIDOS = ['activo', 'vencido', 'cancelado'];

function validarFecha(fecha) {
  return !isNaN(new Date(fecha).getTime());
}

function generarPagos(
  contrato_id,
  local_id,
  renta,
  fecha_inicio,
  fecha_vencimiento
) {
  const pagos = [];

  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_vencimiento);

  let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);

  while (cursor <= fin) {
    const año = cursor.getFullYear();
    const mes = String(cursor.getMonth() + 1).padStart(2, '0');

    pagos.push({
      periodo: `${año}-${mes}`,
      contrato_id,
      local_id,
      monto_esperado: renta,
      monto_pagado: 0,
      estado: 'pendiente'
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return pagos;
}

async function obtenerLocal(numeroLocal) {
  const { data, error } = await supabaseAdmin
    .from('locales')
    .select('*')
    .eq('numero', Number(numeroLocal))
    .single();

  if (error) throw new Error('Local no encontrado');

  return data;
}

async function actualizarEstatusLocal(localNumero, estatus) {
  const { error } = await supabaseAdmin
    .from('locales')
    .update({ estatus })
    .eq('numero', Number(localNumero));

  if (error) {
    console.error('Error actualizando local:', error.message);
  }
}

async function actualizarArrendatarioLocal(inquilino_id, local_id) {
  const { error } = await supabaseAdmin
    .from('arrendatarios')
    .update({
      local_id: local_id ? Number(local_id) : null
    })
    .eq('id', inquilino_id);

  if (error) {
    console.error('Error actualizando arrendatario:', error.message);
  }
}

async function sincronizarArrendatarioConContratoActivo(inquilino_id) {
  const { data, error } = await supabaseAdmin
    .from('contratos')
    .select('local_id')
    .eq('inquilino_id', inquilino_id)
    .eq('estatus', 'activo')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return;

  const localActivo = data?.[0]?.local_id || null;

  await actualizarArrendatarioLocal(inquilino_id, localActivo);
}

async function existeContratoActivoEnLocal(local_id, excluirId = null) {
  let query = supabaseAdmin
    .from('contratos')
    .select('id', { count: 'exact', head: true })
    .eq('local_id', Number(local_id))
    .eq('estatus', 'activo');

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { count, error } = await query;

  if (error) throw error;

  return count > 0;
}

/* ────────────────────────────────────────────────────────────── */
/* HANDLER */
/* ────────────────────────────────────────────────────────────── */

export default async function handler(req, res) {

  /* ─── CORS ───────────────────────────────────────────── */

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  /* ─── AUTH ───────────────────────────────────────────── */

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'No auth header'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  const {
    data: authData,
    error: authError
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !authData?.user) {
    return res.status(401).json({
      error: 'Token inválido'
    });
  }

  const { method } = req;

  try {

    /* ───────────────── GET ───────────────── */

    if (method === 'GET') {

      const { data, error } = await supabaseAdmin
        .from('contratos')
        .select(`
          *,
          arrendatarios(nombre),
          locales(numero, renta)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    /* ───────────────── POST ───────────────── */

    if (method === 'POST') {

      const {
        local_id,
        inquilino_id,
        fecha_inicio,
        fecha_vencimiento,
        estatus,
        contrato_pdf_url
      } = req.body;

      /* VALIDACIONES */

      if (
        !local_id ||
        !inquilino_id ||
        !fecha_inicio ||
        !fecha_vencimiento
      ) {
        return res.status(400).json({
          error: 'Campos obligatorios faltantes'
        });
      }

      if (
        !validarFecha(fecha_inicio) ||
        !validarFecha(fecha_vencimiento)
      ) {
        return res.status(400).json({
          error: 'Fechas inválidas'
        });
      }

      if (
        new Date(fecha_inicio) >
        new Date(fecha_vencimiento)
      ) {
        return res.status(400).json({
          error: 'La fecha inicio no puede ser mayor'
        });
      }

      if (
        estatus &&
        !ESTATUS_VALIDOS.includes(estatus)
      ) {
        return res.status(400).json({
          error: 'Estatus inválido'
        });
      }

      /* VALIDAR LOCAL */

      const local = await obtenerLocal(local_id);

      /* EVITAR DUPLICADOS */

      const ocupado = await existeContratoActivoEnLocal(local_id);

      if (ocupado) {
        return res.status(400).json({
          error: 'El local ya tiene un contrato activo'
        });
      }

      /* CREAR CONTRATO */

      const { data, error } = await supabaseAdmin
        .from('contratos')
        .insert([{
          local_id: Number(local_id),
          inquilino_id: Number(inquilino_id),
          fecha_inicio,
          fecha_vencimiento,
          renta: local.renta,
          estatus: estatus || 'activo',
          contrato_pdf_url: contrato_pdf_url || null
        }])
        .select()
        .single();

      if (error) throw error;

      /* ACTUALIZACIONES RELACIONADAS */

      await actualizarEstatusLocal(local_id, 'rentado');

      await actualizarArrendatarioLocal(
        inquilino_id,
        local_id
      );

      /* GENERAR PAGOS */

      const pagos = generarPagos(
        data.id,
        local_id,
        local.renta,
        fecha_inicio,
        fecha_vencimiento
      );

      const { error: pagosError } =
        await supabaseAdmin
          .from('pagos')
          .insert(pagos);

      if (pagosError) {
        console.error(
          'Error generando pagos:',
          pagosError.message
        );
      }

      return res.status(201).json({
        success: true,
        data
      });
    }

    /* ───────────────── PUT ───────────────── */

    if (method === 'PUT') {

      const {
        id,
        local_id,
        inquilino_id,
        fecha_inicio,
        fecha_vencimiento,
        estatus,
        contrato_pdf_url
      } = req.body;

      if (!id) {
        return res.status(400).json({
          error: 'ID requerido'
        });
      }

      const {
        data: contratoActual,
        error: contratoError
      } = await supabaseAdmin
        .from('contratos')
        .select('*')
        .eq('id', id)
        .single();

      if (contratoError) throw contratoError;

      /* VALIDAR CAMBIO DE LOCAL */

      if (
        local_id &&
        Number(local_id) !== Number(contratoActual.local_id)
      ) {

        const ocupado = await existeContratoActivoEnLocal(
          local_id,
          id
        );

        if (ocupado) {
          return res.status(400).json({
            error: 'El nuevo local ya está ocupado'
          });
        }
      }

      const local = await obtenerLocal(
        local_id || contratoActual.local_id
      );

      const updateData = {
        local_id: Number(local_id || contratoActual.local_id),
        inquilino_id: Number(
          inquilino_id || contratoActual.inquilino_id
        ),
        fecha_inicio:
          fecha_inicio || contratoActual.fecha_inicio,
        fecha_vencimiento:
          fecha_vencimiento ||
          contratoActual.fecha_vencimiento,
        estatus:
          estatus || contratoActual.estatus,
        contrato_pdf_url:
          contrato_pdf_url ||
          contratoActual.contrato_pdf_url,
        renta: local.renta
      };

      const { data, error } = await supabaseAdmin
        .from('contratos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      /* SINCRONIZAR LOCALES */

      if (
        Number(contratoActual.local_id) !==
        Number(updateData.local_id)
      ) {

        await actualizarEstatusLocal(
          contratoActual.local_id,
          'desocupado'
        );

        if (updateData.estatus === 'activo') {
          await actualizarEstatusLocal(
            updateData.local_id,
            'rentado'
          );
        }
      }

      /* SINCRONIZAR ESTATUS */

      if (
        updateData.estatus === 'vencido' ||
        updateData.estatus === 'cancelado'
      ) {

        await actualizarEstatusLocal(
          updateData.local_id,
          'desocupado'
        );

        await sincronizarArrendatarioConContratoActivo(
          updateData.inquilino_id
        );
      }

      if (updateData.estatus === 'activo') {

        await actualizarEstatusLocal(
          updateData.local_id,
          'rentado'
        );

        await actualizarArrendatarioLocal(
          updateData.inquilino_id,
          updateData.local_id
        );
      }

      return res.status(200).json({
        success: true,
        data
      });
    }

    /* ───────────────── DELETE ───────────────── */

    if (method === 'DELETE') {

      const id = req.query.id || req.body.id;

      if (!id) {
        return res.status(400).json({
          error: 'ID requerido'
        });
      }

      /* OBTENER CONTRATO */

      const {
        data: contrato,
        error: contratoError
      } = await supabaseAdmin
        .from('contratos')
        .select('*')
        .eq('id', id)
        .single();

      if (contratoError) throw contratoError;

      /* BORRAR PAGOS */

      const { error: pagosError } = await supabaseAdmin
        .from('pagos')
        .delete()
        .eq('contrato_id', id);

      if (pagosError) {
        console.error(
          'Error eliminando pagos:',
          pagosError.message
        );
      }

      /* BORRAR CONTRATO */

      const { error } = await supabaseAdmin
        .from('contratos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      /* LIBERAR LOCAL */

      await actualizarEstatusLocal(
        contrato.local_id,
        'desocupado'
      );

      await sincronizarArrendatarioConContratoActivo(
        contrato.inquilino_id
      );

      return res.status(200).json({
        success: true,
        message: 'Contrato eliminado'
      });
    }

    /* ───────────────── 405 ───────────────── */

    res.setHeader(
      'Allow',
      ['GET', 'POST', 'PUT', 'DELETE']
    );

    return res.status(405).end(
      `Method ${method} Not Allowed`
    );

  } catch (error) {

    console.error(
      'SERVER ERROR /api/contratos:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}