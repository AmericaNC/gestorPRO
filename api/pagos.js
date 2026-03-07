import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        // Consultar pagos con información relacionada de contratos y locales
        const { data: getData, error: getError } = await supabase
          .from('pagos')
          .select('*, contratos(inquilino_id), locales(numero)');
        if (getError) throw getError;
        return res.status(200).json({ success: true, data: getData });

      case 'POST':
        // Lógica para eliminar si se recibe la acción correspondiente
        if (req.body.action === 'delete') {
          const { error: delError } = await supabase
            .from('pagos')
            .delete()
            .eq('id', req.body.id);
          if (delError) throw delError;
          return res.status(200).json({ success: true, message: "Pago eliminado" });
        }
        
        // Creación: Se envía el body tal cual. 
        // La columna "diferencia" la calcula la base de datos automáticamente.
        const { data: postData, error: postError } = await supabase
          .from('pagos')
          .insert([req.body])
          .select();
        
        if (postError) throw postError;
        return res.status(201).json({ success: true, data: postData });

      case 'PUT':
        // Actualización: Se extrae el ID y se actualizan los campos restantes.
        // No enviamos "diferencia" para evitar errores de restricción.
        const { id, ...updateData } = req.body;
        
        // Si por error viene 'diferencia' en el body, la eliminamos antes de enviar a Supabase
        delete updateData.diferencia;

        const { data: putData, error: putError } = await supabase
          .from('pagos')
          .update(updateData)
          .eq('id', id)
          .select();
        
        if (putError) throw putError;
        return res.status(200).json({ success: true, data: putData });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}