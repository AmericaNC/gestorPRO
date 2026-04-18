import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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

      for (const contrato of contratos) {
        const nuevaRenta = Math.round(contrato.renta * factor * 100) / 100;

        // Solo actualizar monto_esperado — la BD recalcula estado automáticamente
        const { data: pagosData, error: pagosError } = await supabase
          .from('pagos')
          .update({ monto_esperado: nuevaRenta })
          .eq('contrato_id', contrato.id)
          .eq('estado', 'pendiente')
          .gte('periodo', hoy)
          .select('id');

        if (pagosError) throw pagosError;
        pagosActualizados += pagosData?.length || 0;

        // Actualizar renta del contrato
        const { error: contratoError } = await supabase
          .from('contratos')
          .update({ renta: nuevaRenta })
          .eq('id', contrato.id);

        if (contratoError) throw contratoError;
      }

      // Guardar historial
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