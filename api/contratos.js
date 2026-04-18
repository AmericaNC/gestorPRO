import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { data: getData, error: getError } = await supabase
          .from('contratos')
          .select('*, arrendatarios(nombre), locales(numero)');
        if (getError) throw getError;
        return res.status(200).json({ success: true, data: getData });

      case 'POST':
        // Si el cuerpo trae una propiedad "action: delete", lo borramos (como en tus locales)
        if (req.body.action === 'delete') {
          const { error: delError } = await supabase
            .from('contratos')
            .delete()
            .eq('id', req.body.id);
          if (delError) throw delError;
          return res.status(200).json({ success: true, message: "Contrato eliminado" });
        }
        
        // Si no es delete, es una creación normal
        const { data: postData, error: postError } = await supabase
          .from('contratos')
          .insert([req.body])
          .select();
        if (postError) throw postError;
        return res.status(201).json({ success: true, data: postData });

      case 'PUT':
        // Actualización (usamos PUT para ser consistentes con tus otros comandos)
        const { id, ...updateData } = req.body;
        const { data: putData, error: putError } = await supabase
          .from('contratos')
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