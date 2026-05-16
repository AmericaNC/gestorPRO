import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiUrl } from '../lib/apiClient';
import { logAction } from '../lib/logAction';

const API_URL = apiUrl('/api/usuarios');
import "../styles/UsersPage.css";
import LogsPanel from '../components/LogsPanel';

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
  const [currentUser, setCurrentUser] = useState(null);

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

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (err) {
      console.warn('No se pudo obtener el usuario actual:', err.message);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchCurrentUser();
  }, []);

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

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: 'crear',
        entidad: 'usuarios',
        entidad_id: data.data?.id || form.email,
        descripcion: `Usuario ${form.email} creado con rol ${form.rol}`
      });

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
    if (currentUser?.id === id) {
      setStatus({ type: 'error', message: 'No puedes cambiar el rol de tu propio usuario.' });
      return;
    }

    try {
      const token = await getToken();
      const res = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rol: nuevoRol })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar rol');

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: 'editar',
        entidad: 'usuarios',
        entidad_id: id,
        descripcion: `Rol cambiado a ${nuevoRol}`
      });

      setEditandoRol(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchUsuarios();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleEliminar = async (usuario) => {
    if (currentUser?.id === usuario.id) {
      setStatus({ type: 'error', message: 'No puedes eliminar tu propio usuario.' });
      return;
    }
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

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: 'eliminar',
        entidad: 'usuarios',
        entidad_id: usuario.id,
        descripcion: `Usuario ${usuario.email} eliminado`
      });

      setStatus({ type: 'success', message: `Usuario ${usuario.email} eliminado.` });
      fetchUsuarios();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setEliminando(null);
    }
  };
return (
  <div className="users-page">

    <h1 className="users-page-title">
      Administración de Usuarios
    </h1>

    <p className="users-page-subtitle">
      Crea, edita roles y elimina usuarios del sistema.
    </p>

    {status && (
      <div className={`users-alert ${status.type}`}>
        {status.message}
      </div>
    )}

    {/* ── Formulario nuevo usuario ───────────────── */}

    <div className="users-section">

      <h2 className="users-section-title">
        Nuevo Usuario
      </h2>

      <form
        onSubmit={handleCrear}
        className="users-form"
      >

        <input
          className="users-input"
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={e =>
            setForm({
              ...form,
              email: e.target.value
            })
          }
        />

        <input
          className="users-input"
          type="password"
          placeholder="Contraseña"
          required
          value={form.password}
          onChange={e =>
            setForm({
              ...form,
              password: e.target.value
            })
          }
        />

        <select
          className="users-select"
          value={form.rol}
          onChange={e =>
            setForm({
              ...form,
              rol: e.target.value
            })
          }
        >
          <option value="admin">
            Admin
          </option>

          <option value="gestor">
            Gestor
          </option>

          <option value="lector">
            Lector
          </option>

        </select>

        <div>

          <button
            type="submit"
            className="btn-primary"
            disabled={creando}
          >
            {creando
              ? 'Creando...'
              : '+ Crear usuario'}
          </button>

        </div>

      </form>

    </div>

    {/* ── Tabla usuarios ─────────────────────────── */}

    <div className="users-section">

      <h2 className="users-section-title">
        Usuarios registrados
      </h2>

      {loading ? (

        <p className="users-empty">
          Cargando...
        </p>

      ) : usuarios.length === 0 ? (

        <p className="users-empty">
          No hay usuarios registrados.
        </p>

      ) : (

        <div className="users-table-wrapper">

          <table className="users-table">

            <thead>

              <tr>

                <th className="users-th">
                  Email
                </th>

                <th className="users-th">
                  Rol
                </th>

                <th className="users-th">
                  Acciones
                </th>

              </tr>

            </thead>

            <tbody>

              {usuarios.map(u => {

                const rolEditado =
                  editandoRol[u.id];
                const esUsuarioActual = currentUser?.id === u.id;

                return (

                  <tr key={u.id}>

                    <td className="users-td">
                      {u.email}
                    </td>

                    <td className="users-td">

                      {rolEditado !== undefined ? (

                        <div className="users-inline-edit">

                          <select
                            className="users-select"
                            value={rolEditado}
                            onChange={e =>
                              setEditandoRol(prev => ({
                                ...prev,
                                [u.id]: e.target.value
                              }))
                            }
                          >

                            <option value="admin">
                              Admin
                            </option>

                            <option value="gestor">
                              Gestor
                            </option>

                            <option value="lector">
                              Lector
                            </option>

                          </select>

                          <button
                            className="users-btn-secondary"
                            onClick={() =>
                              handleCambiarRol(
                                u.id,
                                rolEditado
                              )
                            }
                          >
                            Guardar
                          </button>

                          <button
                            className="users-btn-secondary"
                            onClick={() =>
                              setEditandoRol(prev => {

                                const n = {
                                  ...prev
                                };

                                delete n[u.id];

                                return n;
                              })
                            }
                          >
                            Cancelar
                          </button>

                        </div>

                      ) : (

                        <span
                          className={`users-role ${u.rol}`}
                        >
                          {u.rol}
                        </span>

                      )}

                    </td>

                    <td className="users-td">

                      <div className="users-actions">

                        {rolEditado === undefined && (

                          <button
                            className="users-btn-secondary"
                            onClick={() =>
                              setEditandoRol(prev => ({
                                ...prev,
                                [u.id]: u.rol
                              }))
                            }
                            disabled={esUsuarioActual}
                          >
                            Cambiar rol
                          </button>

                        )}

                        <button
                          className="users-btn-danger"
                          onClick={() =>
                            handleEliminar(u)
                          }
                          disabled={
                            eliminando === u.id || esUsuarioActual
                          }
                        >
                          {eliminando === u.id
                            ? 'Eliminando...'
                            : 'Eliminar'}
                        </button>

                      </div>

                    </td>

                  </tr>

                );
              })}

            </tbody>

          </table>
<div className="users-mobile-list">

  {usuarios.map(u => {

    const rolEditado = editandoRol[u.id];
    const esUsuarioActual = currentUser?.id === u.id;
    return (
      <div
        key={u.id}
        className="users-mobile-card"
      >

        <div className="users-mobile-header">

          <div className="users-mobile-email">
            {u.email}
          </div>

          {rolEditado === undefined && (
            <span className={`users-role ${u.rol}`}>
              {u.rol}
            </span>
          )}

        </div>

        <div className="users-mobile-body">

          <div className="users-mobile-field">

            <span className="users-mobile-label">
              Rol
            </span>

            {rolEditado !== undefined ? (

              <div className="users-inline-edit">

                <select
                  className="users-select"
                  value={rolEditado}
                  onChange={e =>
                    setEditandoRol(prev => ({
                      ...prev,
                      [u.id]: e.target.value
                    }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="gestor">Gestor</option>
                  <option value="lector">Lector</option>
                </select>

                <button
                  className="users-btn-secondary"
                  onClick={() =>
                    handleCambiarRol(
                      u.id,
                      rolEditado
                    )
                  }
                >
                  Guardar
                </button>

                <button
                  className="users-btn-secondary"
                  onClick={() =>
                    setEditandoRol(prev => {

                      const n = { ...prev };

                      delete n[u.id];

                      return n;
                    })
                  }
                >
                  Cancelar
                </button>

              </div>

            ) : (

              <span className="users-mobile-role-text">
                {u.rol}
              </span>

            )}

          </div>

        </div>

        <div className="users-actions">

          {rolEditado === undefined && (

            <button
              className="users-btn-secondary"
              onClick={() =>
                setEditandoRol(prev => ({
                  ...prev,
                  [u.id]: u.rol
                }))
              }
              disabled={esUsuarioActual}
            >
              Cambiar rol
            </button>

          )}

          <button
            className="users-btn-danger"
            onClick={() => handleEliminar(u)}
            disabled={eliminando === u.id || esUsuarioActual}
          >
            {eliminando === u.id
              ? 'Eliminando...'
              : 'Eliminar'}
          </button>

        </div>

      </div>

    );
  })}

</div>
        </div>

      )}
<LogsPanel/>
    </div>

  </div>
);
}