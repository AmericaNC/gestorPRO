import { createClient } from '@supabase/supabase-js';

const supabase     = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { method } = req;

  try {
    // VALIDAR TOKEN Y ROL ADMIN
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth header' });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

    // Verificar que sea admin
    const { data: usuarioAdmin, error: rolError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();
    if (rolError || usuarioAdmin?.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden gestionar usuarios' });
    }

    // ==========================================
    // GET - Listar usuarios
    // ==========================================
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, email, rol, created_at')
        .order('email', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // ==========================================
    // POST - Crear usuario
    // ==========================================
    if (method === 'POST') {
      const { email, password, rol } = req.body;
      if (!email || !password || !rol) {
        return res.status(400).json({ error: 'Email, password y rol son requeridos' });
      }

      // Crear en Auth con service role
      const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true // confirmar email automáticamente
      });
      if (authCreateError) throw authCreateError;

      // Insertar en tabla usuarios
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert({ id: authData.user.id, email, rol });
      if (insertError) throw insertError;

      return res.status(201).json({ success: true, data: authData.user });
    }

    // ==========================================
    // PUT - Cambiar rol
    // ==========================================
    if (method === 'PUT') {
      const { id, rol } = req.body;
      if (!id || !rol) return res.status(400).json({ error: 'ID y rol son requeridos' });

      // No permitir que el admin se cambie su propio rol
      if (id === user.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
      }

      const { error } = await supabase
        .from('usuarios')
        .update({ rol })
        .eq('id', id);
      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    // ==========================================
    // DELETE - Borrar usuario
    // ==========================================
    if (method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      // No permitir que el admin se borre a sí mismo
      if (id === user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
      }

      // Borrar de Auth (service role requerido)
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);
      if (authDeleteError) throw authDeleteError;

      // Borrar de tabla usuarios
      const { error: dbDeleteError } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
      if (dbDeleteError) throw dbDeleteError;

      return res.status(200).json({ success: true, message: 'Usuario eliminado' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}