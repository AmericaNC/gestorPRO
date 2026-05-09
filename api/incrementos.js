import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const validarPorcentaje = (valor) => {
  const numero = Number(valor);

  if (isNaN(numero)) return null;
  if (numero <= 0) return null;
  if (numero > 100) return null;

  return numero;
};

const limpiarIds = (ids) => {
  if (!Array.isArray(ids)) return [];

  return [...new Set(
    ids
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  )];
};

const redondear2 = (numero) =>
  Math.round(numero * 100) / 100;

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

async function obtenerUsuario(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error('No auth header');
  }

  const token = authHeader.replace('Bearer ', '');

  const {
    data: { user },
    error
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    throw new Error('Token inválido');
  }

  return user;
}

// ─────────────────────────────────────────────────────────────
// Garantizar usuario interno
// ─────────────────────────────────────────────────────────────

async function asegurarUsuarioInterno(user) {

  const { data: existe } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existe) return;

  const { error } = await supabaseAdmin
    .from('usuarios')
    .insert({
      id: user.id,
      email: user.email,
      rol: 'gestor'
    });

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {

    const user = await obtenerUsuario(req);

    // ─────────────────────────────────────────────────────────
    // GET
    // ─────────────────────────────────────────────────────────

    if (req.method === 'GET') {

      const { data, error } = await supabaseAdmin
        .from('incrementos')
        .select(`
          *,
          usuarios (
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    // ─────────────────────────────────────────────────────────
    // POST
    // ─────────────────────────────────────────────────────────

    if (req.method === 'POST') {

      await asegurarUsuarioInterno(user);

      // ───────────────────────────────────────────────────────
      // Validaciones
      // ───────────────────────────────────────────────────────

      const porcentaje = validarPorcentaje(req.body.porcentaje);

      const inquilino_ids = limpiarIds(
        req.body.inquilino_ids
      );

      if (!porcentaje) {
        return res.status(400).json({
          error: 'Porcentaje inválido'
        });
      }

      if (inquilino_ids.length === 0) {
        return res.status(400).json({
          error: 'No se enviaron arrendatarios válidos'
        });
      }

      // ───────────────────────────────────────────────────────
      // Buscar contratos activos
      // ───────────────────────────────────────────────────────

      const { data: contratos, error: contratosError } =
        await supabaseAdmin
          .from('contratos')
          .select(`
            id,
            local_id,
            renta,
            inquilino_id,
            estatus
          `)
          .eq('estatus', 'activo')
          .in('inquilino_id', inquilino_ids);

      if (contratosError) throw contratosError;

      if (!contratos?.length) {
        return res.status(400).json({
          error: 'No se encontraron contratos activos'
        });
      }

      const hoy = new Date().toISOString().slice(0, 7);

      let pagosActualizados = 0;

      const resumenContratos = [];

      // ───────────────────────────────────────────────────────
      // Procesar contratos
      // ───────────────────────────────────────────────────────

      for (const contrato of contratos) {

        const rentaActual = Number(contrato.renta);

        if (isNaN(rentaActual) || rentaActual <= 0) {
          continue;
        }

        const nuevaRenta = redondear2(
          rentaActual * (1 + porcentaje / 100)
        );

        // ───────────────────────────────────────────────────
        // Actualizar contrato
        // ───────────────────────────────────────────────────

        const { error: contratoUpdateError } =
          await supabaseAdmin
            .from('contratos')
            .update({
              renta: nuevaRenta
            })
            .eq('id', contrato.id);

        if (contratoUpdateError) {
          throw contratoUpdateError;
        }

        // ───────────────────────────────────────────────────
        // Actualizar local
        // ───────────────────────────────────────────────────

        if (contrato.local_id != null) {

          const { error: localError } =
            await supabaseAdmin
              .from('locales')
              .update({
                renta: nuevaRenta
              })
              .eq('numero', Number(contrato.local_id));

          if (localError) {
            throw localError;
          }
        }

        // ───────────────────────────────────────────────────
        // Actualizar pagos pendientes futuros
        // ───────────────────────────────────────────────────

        const {
          data: pagosData,
          error: pagosError
        } = await supabaseAdmin
          .from('pagos')
          .update({
            monto_esperado: nuevaRenta
          })
          .eq('contrato_id', contrato.id)
          .eq('estado', 'pendiente')
          .gte('periodo', hoy)
          .select('id');

        if (pagosError) {
          throw pagosError;
        }

        pagosActualizados += pagosData?.length || 0;

        resumenContratos.push({
          contrato_id: contrato.id,
          renta_anterior: rentaActual,
          renta_nueva: nuevaRenta
        });
      }

      // ───────────────────────────────────────────────────────
      // Historial
      // ───────────────────────────────────────────────────────

      const contrato_ids = contratos.map(c => c.id);

      const { data: historial, error: historialError } =
        await supabaseAdmin
          .from('incrementos')
          .insert([{
            porcentaje,
            arrendatarios_afectados: inquilino_ids,
            contratos_afectados: contrato_ids,
            pagos_actualizados: pagosActualizados,
            aplicado_por: user.id
          }])
          .select()
          .single();

      if (historialError) {
        throw historialError;
      }

      return res.status(200).json({
        success: true,

        data: historial,

        resumen: {
          porcentaje,
          contratos_afectados: contratos.length,
          pagos_actualizados: pagosActualizados,
          contratos: resumenContratos
        }
      });
    }

    // ─────────────────────────────────────────────────────────
    // METHOD NOT ALLOWED
    // ─────────────────────────────────────────────────────────

    res.setHeader('Allow', ['GET', 'POST']);

    return res
      .status(405)
      .end(`Method ${req.method} Not Allowed`);

  } catch (error) {

    console.error(
      'SERVER ERROR /api/incrementos:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}