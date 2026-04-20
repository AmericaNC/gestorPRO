import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // AUTH
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const { method } = req;

  try {
    // GET
    if (method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('locales')
        .select('*')
        .order('numero');

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // POST
    if (method === 'POST') {
      const { id, action, numero, metros_cuadrados, estatus, renta, mantenimiento_mensual } = req.body;

      if (action === 'delete' && id) {
        const { error: deleteError } = await supabaseAdmin
          .from('locales')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;
        return res.status(200).json({ success: true, message: 'Local eliminado correctamente' });
      }

      if (!numero || !metros_cuadrados) {
        return res.status(400).json({ error: 'Número y metros cuadrados son requeridos' });
      }

      const { data, error } = await supabaseAdmin
        .from('locales')
        .insert([{
          numero: Number(numero),
          metros_cuadrados: Number(metros_cuadrados),
          estatus: estatus || 'desocupado',
          renta: Number(renta) || 0,
          mantenimiento_mensual: Number(mantenimiento_mensual) || 0
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // PUT
    if (method === 'PUT') {
      const { id, numero, metros_cuadrados, estatus, renta, mantenimiento_mensual } = req.body;

      if (!id || !numero || !metros_cuadrados) {
        return res.status(400).json({ error: 'ID, número y metros cuadrados son requeridos' });
      }

      const { data, error } = await supabaseAdmin
        .from('locales')
        .update({
          numero: Number(numero),
          metros_cuadrados: Number(metros_cuadrados),
          estatus,
          renta: Number(renta) || 0,
          mantenimiento_mensual: Number(mantenimiento_mensual) || 0
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (renta !== undefined) {
        const nuevaRenta = Number(renta);

        const { data: contratosActivos, error: contratosError } = await supabaseAdmin
          .from('contratos')
          .select('id')
          .eq('local_id', Number(numero))
          .eq('estatus', 'activo');

        if (contratosError) {
          console.error('Error buscando contratos activos:', contratosError.message);
        } else if (contratosActivos?.length) {
          const { error: updateContratosError } = await supabaseAdmin
            .from('contratos')
            .update({ renta: nuevaRenta })
            .eq('local_id', Number(numero))
            .eq('estatus', 'activo');

          if (updateContratosError) {
            console.error('Error actualizando renta en contratos:', updateContratosError.message);
          }

          const hoy = new Date().toISOString().slice(0, 7); 
          const contratoIds = contratosActivos.map(c => c.id);

          const { error: updatePagosError } = await supabaseAdmin
            .from('pagos')
            .update({ monto_esperado: nuevaRenta })
            .in('contrato_id', contratoIds)
            .eq('estado', 'pendiente')
            .gte('periodo', hoy);

          if (updatePagosError) {
            console.error('Error actualizando pagos futuros:', updatePagosError.message);
          }
        }
      }

      return res.status(200).json({ success: true, data });
    }

    // DELETE
    if (method === 'DELETE') {
      const id = req.query.id || req.body.id;

      if (!id) return res.status(400).json({ error: 'ID es requerido' });

      const { error } = await supabaseAdmin
        .from('locales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Local eliminado' });
    }

    
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);

  } catch (error) {
    console.error('SERVER ERROR /api/locales:', error);
    return res.status(500).json({ error: error.message });
  }
}