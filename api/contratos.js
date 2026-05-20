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

const ESTATUS_VALIDOS = [
  'activo',
  'vencido',
  'cancelado'
];

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

  // Parsear manualmente para evitar shift de UTC → timezone local
  const [inicioY, inicioM] = fecha_inicio.split("-").map(Number);
  const [finY, finM, finD] = fecha_vencimiento.split("-").map(Number);

  let cursorY = inicioY;
  let cursorM = inicioM; // 1-indexed (febrero = 2)

  // Límite: mes/año del vencimiento
  while (
    cursorY < finY ||
    (cursorY === finY && cursorM <= finM)
  ) {
    const mes = String(cursorM).padStart(2, "0");
    pagos.push({
      periodo: `${cursorY}-${mes}`,
      contrato_id,
      local_id,
      monto_esperado: renta,
      monto_pagado: 0
    });

    cursorM++;
    if (cursorM > 12) {
      cursorM = 1;
      cursorY++;
    }
  }

  return pagos;
}
async function obtenerLocal(numeroLocal) {

  const { data, error } =
    await supabaseAdmin
      .from('locales')
      .select('*')
      .eq('numero', Number(numeroLocal))
      .single();

  if (error || !data) {
    throw new Error('Local no encontrado');
  }

  return data;
}

async function obtenerArrendatario(inquilino_id) {

  const { data, error } =
    await supabaseAdmin
      .from('arrendatarios')
      .select('*')
      .eq('id', inquilino_id)
      .single();

  if (error || !data) {
    throw new Error(
      'Arrendatario no encontrado'
    );
  }

  return data;
}

async function actualizarEstatusLocal(
  localNumero,
  estatus
) {

  const { error } =
    await supabaseAdmin
      .from('locales')
      .update({ estatus })
      .eq('numero', Number(localNumero));

  if (error) {
    console.error(
      'Error actualizando local:',
      error.message
    );
  }
}

async function actualizarArrendatarioLocal(
  inquilino_id,
  local_id
) {

  const { error } =
    await supabaseAdmin
      .from('arrendatarios')
      .update({
        local_id:
          local_id
            ? Number(local_id)
            : null
      })
      .eq('id', inquilino_id);

  if (error) {
    console.error(
      'Error actualizando arrendatario:',
      error.message
    );
  }
}

async function sincronizarArrendatarioConContratoActivo(
  inquilino_id
) {

  const { data, error } =
    await supabaseAdmin
      .from('contratos')
      .select('local_id')
      .eq('inquilino_id', inquilino_id)
      .eq('estatus', 'activo')
      .order('created_at', {
        ascending: false
      })
      .limit(1);

  if (error) return;

  const localActivo =
    data?.[0]?.local_id || null;

  await actualizarArrendatarioLocal(
    inquilino_id,
    localActivo
  );
}

async function existeContratoActivoEnLocal(
  local_id,
  excluirId = null
) {

  let query = supabaseAdmin
    .from('contratos')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('local_id', Number(local_id))
    .eq('estatus', 'activo');

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { count, error } =
    await query;

  if (error) throw error;

  return count > 0;
}

async function existeContratoActivoParaArrendatario(
  inquilino_id,
  excluirId = null
) {

  let query = supabaseAdmin
    .from('contratos')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('inquilino_id', inquilino_id)
    .eq('estatus', 'activo');

  if (excluirId) {
    query = query.neq('id', excluirId);
  }

  const { count, error } =
    await query;

  if (error) throw error;

  return count > 0;
}

/* ────────────────────────────────────────────────────────────── */
/* HANDLER */
/* ────────────────────────────────────────────────────────────── */

export default async function handler(
  req,
  res
) {

  /* ─── CORS ───────────────────────────── */

  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

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

  /* ─── AUTH ───────────────────────────── */

  const authHeader =
    req.headers.authorization;

  if (!authHeader) {

    return res.status(401).json({
      error: 'No auth header'
    });
  }

  const token =
    authHeader.replace(
      'Bearer ',
      ''
    );

  const {
    data: authData,
    error: authError
  } = await supabaseAuth.auth.getUser(
    token
  );

  if (
    authError ||
    !authData?.user
  ) {

    return res.status(401).json({
      error: 'Token inválido'
    });
  }

  const { method } = req;

  try {

    /* ───────────────── GET ───────────────── */

    if (method === 'GET') {

      const { data, error } =
        await supabaseAdmin
          .from('contratos')
          .select(`
            *,
            arrendatarios(nombre),
            locales(numero, renta, mantenimiento_mensual)
          `)
          .order('created_at', {
            ascending: false
          });

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
          error:
            'Campos obligatorios faltantes'
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
          error:
            'La fecha inicio no puede ser mayor'
        });
      }

      if (
        estatus &&
        !ESTATUS_VALIDOS.includes(
          estatus
        )
      ) {

        return res.status(400).json({
          error: 'Estatus inválido'
        });
      }

      /* VALIDAR ENTIDADES */

      const local =
        await obtenerLocal(local_id);

      await obtenerArrendatario(
        inquilino_id
      );

      /* VALIDAR ESTATUS LOCAL */

      if (
        local.estatus &&
        ![
          'disponible',
          'desocupado',
          'rentado'
        ].includes(local.estatus)
      ) {

        return res.status(400).json({
          error:
            'El local no está disponible para renta'
        });
      }

      /* VALIDAR DUPLICADOS */

      const ocupado =
        await existeContratoActivoEnLocal(
          local_id
        );

      if (ocupado) {

        return res.status(400).json({
          error:
            'El local ya tiene un contrato activo'
        });
      }

      const arrendatarioOcupado =
        await existeContratoActivoParaArrendatario(
          inquilino_id
        );

      if (arrendatarioOcupado) {

        return res.status(400).json({
          error:
            'El arrendatario ya tiene un contrato activo'
        });
      }

      /* CREAR CONTRATO */

      const {
        data,
        error
      } = await supabaseAdmin
        .from('contratos')
        .insert([{
          local_id:
            Number(local_id),

          inquilino_id,

          fecha_inicio,

          fecha_vencimiento,

          renta: local.renta,

          estatus:
            estatus || 'activo',

          contrato_pdf_url:
            contrato_pdf_url || null
        }])
        .select()
        .single();

      if (error) throw error;

      /* ACTUALIZACIONES */

      await actualizarEstatusLocal(
        local_id,
        'rentado'
      );

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

      if (pagos.length > 0) {

        const {
          error: pagosError
        } = await supabaseAdmin
          .from('pagos')
          .insert(pagos);

        if (pagosError) {

          /* ROLLBACK */

          await supabaseAdmin
            .from('contratos')
            .delete()
            .eq('id', data.id);

          await actualizarEstatusLocal(
            local_id,
            'desocupado'
          );

          await actualizarArrendatarioLocal(
            inquilino_id,
            null
          );

          throw new Error(
            'Error generando pagos: ' +
            pagosError.message
          );
        }
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

      if (contratoError) {
        throw contratoError;
      }

      const nuevoLocal =
        local_id ||
        contratoActual.local_id;

      const nuevoInquilino =
        inquilino_id ||
        contratoActual.inquilino_id;

      const nuevoEstatus =
        estatus ||
        contratoActual.estatus;

      const fechaInicioFinal =
        fecha_inicio ||
        contratoActual.fecha_inicio;

      const fechaFinFinal =
        fecha_vencimiento ||
        contratoActual.fecha_vencimiento;

      /* VALIDAR FECHAS */

      if (
        !validarFecha(fechaInicioFinal) ||
        !validarFecha(fechaFinFinal)
      ) {

        return res.status(400).json({
          error: 'Fechas inválidas'
        });
      }

      if (
        new Date(fechaInicioFinal) >
        new Date(fechaFinFinal)
      ) {

        return res.status(400).json({
          error:
            'La fecha inicio no puede ser mayor'
        });
      }

      /* VALIDAR ESTATUS */

      if (
        nuevoEstatus &&
        !ESTATUS_VALIDOS.includes(
          nuevoEstatus
        )
      ) {

        return res.status(400).json({
          error: 'Estatus inválido'
        });
      }

      /* VALIDAR LOCAL */

      const local =
        await obtenerLocal(nuevoLocal);

      /* VALIDAR ARRENDATARIO */

      await obtenerArrendatario(
        nuevoInquilino
      );

      /* VALIDAR OCUPACIÓN */

      if (nuevoEstatus === 'activo') {

        const ocupado =
          await existeContratoActivoEnLocal(
            nuevoLocal,
            id
          );

        if (ocupado) {

          return res.status(400).json({
            error:
              'Ya existe un contrato activo en ese local'
          });
        }

        const arrendatarioOcupado =
          await existeContratoActivoParaArrendatario(
            nuevoInquilino,
            id
          );

        if (arrendatarioOcupado) {

          return res.status(400).json({
            error:
              'El arrendatario ya tiene otro contrato activo'
          });
        }
      }

      /* UPDATE */

      const updateData = {

        local_id:
          Number(nuevoLocal),

        inquilino_id:
          nuevoInquilino,

        fecha_inicio:
          fechaInicioFinal,

        fecha_vencimiento:
          fechaFinFinal,

        estatus:
          nuevoEstatus,

        contrato_pdf_url:
          contrato_pdf_url ||
          contratoActual.contrato_pdf_url,

        renta:
          local.renta
      };

      const {
        data,
        error
      } = await supabaseAdmin
        .from('contratos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      /* CAMBIO DE LOCAL */

      if (
        Number(
          contratoActual.local_id
        ) !==
        Number(updateData.local_id)
      ) {

        const sigueOcupado =
          await existeContratoActivoEnLocal(
            contratoActual.local_id
          );

        if (!sigueOcupado) {

          await actualizarEstatusLocal(
            contratoActual.local_id,
            'desocupado'
          );
        }

        if (
          updateData.estatus === 'activo'
        ) {

          await actualizarEstatusLocal(
            updateData.local_id,
            'rentado'
          );
        }

        /* ACTUALIZAR PAGOS */

        await supabaseAdmin
          .from('pagos')
          .update({
            local_id:
              updateData.local_id
          })
          .eq('contrato_id', id)
          .eq('estado', 'pendiente');
      }

      /* ESTATUS */

      if (
        updateData.estatus ===
          'vencido' ||
        updateData.estatus ===
          'cancelado'
      ) {

        const sigueOcupado =
          await existeContratoActivoEnLocal(
            updateData.local_id,
            id
          );

        if (!sigueOcupado) {

          await actualizarEstatusLocal(
            updateData.local_id,
            'desocupado'
          );
        }

        await sincronizarArrendatarioConContratoActivo(
          updateData.inquilino_id
        );
      }

      if (
        updateData.estatus ===
        'activo'
      ) {

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

      const id =
        req.query.id ||
        req.body.id;

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

      if (contratoError) {
        throw contratoError;
      }

      /* BORRAR PAGOS */

      const {
        error: pagosError
      } = await supabaseAdmin
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

      const { error } =
        await supabaseAdmin
          .from('contratos')
          .delete()
          .eq('id', id);

      if (error) throw error;

      /* LIBERAR LOCAL */

      const sigueOcupado =
        await existeContratoActivoEnLocal(
          contrato.local_id
        );

      if (!sigueOcupado) {

        await actualizarEstatusLocal(
          contrato.local_id,
          'desocupado'
        );
      }

      /* SINCRONIZAR */

      await sincronizarArrendatarioConContratoActivo(
        contrato.inquilino_id
      );

      return res.status(200).json({
        success: true,
        message:
          'Contrato eliminado'
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

  /* UNIQUE */
  if (
    error.message?.includes('unique') ||
    error.code === '23505'
  ) {

    return res.status(400).json({
      success: false,
      error:
        'Ya existe un registro duplicado'
    });
  }

  /* CHECK CONSTRAINT */
  if (
    error.message?.includes('check constraint') ||
    error.code === '23514'
  ) {

    return res.status(400).json({
      success: false,
      error:
        'Los datos no cumplen las reglas de validación'
    });
  }

  /* FOREIGN KEY */
  if (
    error.message?.includes('foreign key') ||
    error.code === '23503'
  ) {

    return res.status(400).json({
      success: false,
      error:
        'Referencia inválida'
    });
  }

  return res.status(500).json({
    success: false,
    error:
      error.message || 'Error interno'
  });
}
}