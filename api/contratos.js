import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function generarPagos(contrato_id, local_id, renta, fecha_inicio, fecha_vencimiento) {
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
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return pagos;
}

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const { data: getData, error: getError } = await supabase
          .from('contratos')
          .select('*, arrendatarios(nombre), locales(numero)');
        if (getError) throw getError;
        return res.status(200).json({ success: true, data: getData });
      }

      case 'POST': {
        if (req.body.action === 'delete') {
          const { error: delError } = await supabase
            .from('contratos')
            .delete()
            .eq('id', req.body.id);
          if (delError) throw delError;
          return res.status(200).json({ success: true, message: 'Contrato eliminado' });
        }

        const { data: postData, error: postError } = await supabase
          .from('contratos')
          .insert([req.body])
          .select()
          .single();
        if (postError) throw postError;

        const { id: contrato_id, local_id, renta, fecha_inicio, fecha_vencimiento } = postData;
        const pagos = generarPagos(contrato_id, local_id, renta, fecha_inicio, fecha_vencimiento);

        const { error: pagosError } = await supabase.from('pagos').insert(pagos);
        if (pagosError) console.error('Error generando pagos:', pagosError.message);

        return res.status(201).json({ success: true, data: postData });
      }

      case 'PUT': {
        const { id, ...updateData } = req.body;

        const { data: putData, error: putError } = await supabase
          .from('contratos')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (putError) throw putError;

        // Si cambia la renta, actualizar pagos futuros pendientes
        // Solo monto_esperado — la BD recalcula estado y diferencia automáticamente
        if (updateData.renta) {
          const hoy = new Date().toISOString().slice(0, 7);
          const { error: updatePagosError } = await supabase
            .from('pagos')
            .update({ monto_esperado: updateData.renta })
            .eq('contrato_id', id)
            .eq('estado', 'pendiente')
            .gte('periodo', hoy);

          if (updatePagosError) console.error('Error actualizando pagos futuros:', updatePagosError.message);
        }

        return res.status(200).json({ success: true, data: putData });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}