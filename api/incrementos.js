import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Replica la lógica del CASE de la BD para recalcular estado
function calcularEstado(monto_pagado, monto_esperado) {
  if (monto_pagado >= monto_esperado) return 'al_dia';
  if (monto_pagado > 0)              return 'parcial';
  return 'pendiente';
}

function normalizarPeriodo(periodo) {
  if (!periodo) return null;
  const match = periodo.toString().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const año = match[1];
  const mes = String(Number(match[2])).padStart(2, '0');
  return `${año}-${mes}`;
}

export default async function handler(req, res) {
  const { method } = req;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth header' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

    if (method === 'GET') {
      const { data, error } = await supabase
        .from('incrementos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    if (method === 'POST') {
      const { porcentaje, inquilino_ids } = req.body;

      if (!porcentaje || !inquilino_ids || inquilino_ids.length === 0) {
        return res.status(400).json({ error: 'Porcentaje e inquilinos son requeridos' });
      }

      const factor = 1 + Number(porcentaje) / 100;

      // 1. Buscar contratos activos de los arrendatarios seleccionados
      const { data: contratos, error: contratosError } = await supabase
        .from('contratos')
        .select('id, local_id, renta, inquilino_id')
        .eq('estatus', 'activo')
        .in('inquilino_id', inquilino_ids);

      if (contratosError) throw contratosError;
      if (!contratos || contratos.length === 0) {
        return res.status(400).json({ error: 'No se encontraron contratos activos para los arrendatarios seleccionados' });
      }

      const contrato_ids = contratos.map(c => c.id);
      const hoy = new Date().toISOString().slice(0, 7);
      let pagosActualizados = 0;

      // 2. Por cada contrato, traer pagos pendientes y actualizarlos uno a uno
      for (const contrato of contratos) {
        const nuevaRenta = Math.round(contrato.renta * factor * 100) / 100;

        // Traer pagos pendientes o parciales desde hoy en adelante
        const { data: pagosActuales, error: fetchError } = await supabase
          .from('pagos')
          .select('id, monto_pagado, periodo')
          .eq('contrato_id', contrato.id)
          .in('estado', ['pendiente', 'parcial']);

        if (fetchError) throw fetchError;

        const pagosFiltrados = (pagosActuales || [])
          .map(pago => ({ ...pago, periodo: normalizarPeriodo(pago.periodo) }))
          .filter(pago => pago.periodo && pago.periodo >= hoy);

        if (pagosFiltrados.length === 0) continue;

        // Actualizar cada pago con nuevo monto_esperado y estado recalculado
        for (const pago of pagosFiltrados) {
          const montoPagado = Number(pago.monto_pagado || 0);
          const nuevoEstado = calcularEstado(montoPagado, nuevaRenta);

          const { error: pagoError } = await supabase
            .from('pagos')
            .update({ monto_esperado: nuevaRenta, estado: nuevoEstado })
            .eq('id', pago.id);

          if (pagoError) throw pagoError;
          pagosActualizados++;
        }

        // 3. Actualizar renta del contrato
        const { error: contratoError } = await supabase
          .from('contratos')
          .update({ renta: nuevaRenta })
          .eq('id', contrato.id);

        if (contratoError) throw contratoError;
      }

      // 4. Guardar historial
      const { data: historial, error: historialError } = await supabase
        .from('incrementos')
        .insert([{
          porcentaje: Number(porcentaje),
          arrendatarios_afectados: inquilino_ids,
          contratos_afectados: contrato_ids,
          pagos_actualizados: pagosActualizados,
          aplicado_por: user.id
        }])
        .select()
        .single();

      if (historialError) throw historialError;

      return res.status(200).json({
        success: true,
        data: historial,
        resumen: {
          contratos_afectados: contratos.length,
          pagos_actualizados: pagosActualizados
        }
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}