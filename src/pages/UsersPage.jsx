import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/apiClient';

const API_URL = apiUrl('/api/usuarios');

const ROL_COLORS = {
  admin:  { color: '#7c3aed', bg: '#f5f3ff' },
  gestor: { color: '#0369a1', bg: '#f0f9ff' },
  lector: { color: '#555',    bg: '#f5f5f5' },
};

export default function UsersPage() {
  const [usuarios, setUsuarios]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [editandoRol, setEditandoRol] = useState({}); // { [id]: nuevoRol }

  // Formulario nuevo usuario
  const [form, setForm] = useState({ email: '', password: '', rol: 'lector' });
  const [creando, setCreando] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsuarios(data.data || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCreando(true);
    setStatus(null);
    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      setStatus({ type: 'success', message: `Usuario ${form.email} creado correctamente.` });
      setForm({ email: '', password: '', rol: 'lector' });
      fetchUsuarios();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setCreando(false);
    }
  };

  const handleCambiarRol = async (id, nuevoRol) => {
    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rol: nuevoRol })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar rol');
      setEditandoRol(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchUsuarios();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleEliminar = async (usuario) => {
    if (!window.confirm(`¿Eliminar a ${usuario.email}? Esta acción no se puede deshacer.`)) return;
    setEliminando(usuario.id);
    setStatus(null);
    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usuario.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setStatus({ type: 'success', message: `Usuario ${usuario.email} eliminado.` });
      fetchUsuarios();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '720px' }}>
      <h1 style={{ marginBottom: '4px' }}>Administración de Usuarios</h1>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>
        Crea, edita roles y elimina usuarios del sistema.
      </p>

      {status && (
        <p style={{
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '13px',
          color:      status.type === 'error'   ? '#dc2626' : '#16a34a',
          background: status.type === 'error'   ? '#fef2f2' : '#f0fdf4',
          border:     `1px solid ${status.type === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {status.message}
        </p>
      )}

      {/* ── Formulario nuevo usuario ── */}
      <div style={{ border: '1px solid #eee', borderRadius: '8px', padding: '20px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', marginBottom: '16px' }}>Nuevo Usuario</h2>
        <form onSubmit={handleCrear}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <select
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="gestor">Gestor</option>
              <option value="lector">Lector</option>
            </select>
            <div>
              <button type="submit" className="btn-primary" disabled={creando}>
                {creando ? 'Creando...' : '+ Crear usuario'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Tabla de usuarios ── */}
      <h2 style={{ fontSize: '15px', marginBottom: '12px' }}>Usuarios registrados</h2>
      {loading ? (
        <p>Cargando...</p>
      ) : usuarios.length === 0 ? (
        <p style={{ color: '#888', fontSize: '13px' }}>No hay usuarios registrados.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Email</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Rol</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const rolStyle = ROL_COLORS[u.rol] || ROL_COLORS.lector;
              const rolEditado = editandoRol[u.id];
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 8px' }}>{u.email}</td>
                  <td style={{ padding: '10px 8px' }}>
                    {rolEditado !== undefined ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={rolEditado}
                          onChange={e => setEditandoRol(prev => ({ ...prev, [u.id]: e.target.value }))}
                          style={{ fontSize: '12px' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="gestor">Gestor</option>
                          <option value="lector">Lector</option>
                        </select>
                        <button
                          onClick={() => handleCambiarRol(u.id, rolEditado)}
                          style={{ fontSize: '12px' }}
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoRol(prev => { const n = { ...prev }; delete n[u.id]; return n; })}
                          style={{ fontSize: '12px' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: rolStyle.color,
                        background: rolStyle.bg,
                        fontWeight: 500
                      }}>
                        {u.rol}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {rolEditado === undefined && (
                        <button
                          onClick={() => setEditandoRol(prev => ({ ...prev, [u.id]: u.rol }))}
                          style={{ fontSize: '12px' }}
                        >
                          Cambiar rol
                        </button>
                      )}
                      <button
                        onClick={() => handleEliminar(u)}
                        disabled={eliminando === u.id}
                        style={{ fontSize: '12px', color: '#dc2626' }}
                      >
                        {eliminando === u.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}