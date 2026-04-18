import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const { contrato_id, estado, periodo } = req.query;

        let query = supabase
          .from('pagos')
          .select('*, contratos(inquilino_id, arrendatarios(nombre)), locales(numero)')
          .order('periodo', { ascending: true });

        if (contrato_id) query = query.eq('contrato_id', contrato_id);
        if (estado)      query = query.eq('estado', estado);
        if (periodo)     query = query.eq('periodo', periodo);

        const { data: getData, error: getError } = await query;
        if (getError) throw getError;
        return res.status(200).json({ success: true, data: getData });
      }

      case 'POST': {
        // BORRADO
        if (req.body.action === 'delete') {
          const { error: delError } = await supabase
            .from('pagos')
            .delete()
            .eq('id', req.body.id);
          if (delError) throw delError;
          return res.status(200).json({ success: true, message: 'Pago eliminado' });
        }

        // CREACIÓN MANUAL
        const { diferencia, estado, ...datosParaInsertar } = req.body;
        const { data: postData, error: postError } = await supabase
          .from('pagos')
          .insert([datosParaInsertar])
          .select();
        if (postError) throw postError;
        return res.status(201).json({ success: true, data: postData });
      }

      case 'PUT': {
        const { id, ...updateData } = req.body;

        // Quitamos columnas generadas por la BD
        delete updateData.diferencia;
        delete updateData.estado;

        const { data: putData, error: putError } = await supabase
          .from('pagos')
          .update(updateData)
          .eq('id', id)
          .select();
        if (putError) throw putError;
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