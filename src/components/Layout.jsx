import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User, X } from "lucide-react";
import Icon from "./Icon";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/",              label: "Dashboard",    icon: "dashboard"     },
  { to: "/locales",       label: "Locales",       icon: "locales"       },
  { to: "/contratos",     label: "Contratos",     icon: "contratos"     },
  { to: "/expedientes",   label: "Expedientes",   icon: "expedientes"   },
  { to: "/incrementos",   label: "Incrementos",   icon: "incrementos"   },
  { to: "/financiero",    label: "Financiero",    icon: "financiero"    },
  { to: "/arrendatarios", label: "Arrendatarios", icon: "arrendatarios" },
  { to: "/reportes",      label: "Reportes",      icon: "reportes"      },
  { to: "/configuracion", label: "Configuración", icon: "config"        },
];

const getNavItemsForRole = (role) => {
  if (role === 'admin') return navItems

  if (role === 'gestor') return navItems.filter((item) =>
    !['/configuracion'].includes(item.to)
  )

  // lector: solo dashboard y reportes
  if (role === 'lector') return navItems.filter((item) =>
    ['/', '/reportes'].includes(item.to)
  )

  return [] // si no tiene rol reconocido, no muestra nada
}





export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    // Close sidebar on small screens by default
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 768);
    }
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      {/* Overlay para móvil */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--closed"}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Icon name="locales" />
          </div>
          <span className="logo-text">GestorPro</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
            className="ml-auto md:hidden p-2 rounded hover:bg-gray-100"
          >
            <X />
          </button>
        </div>
        <nav className="sidebar-nav">
          {getNavItemsForRole(user?.role).map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`nav-item ${isActive ? "nav-item--active" : ""}`}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Contenido */}
      <div className="main-wrap">
        <header className="topbar">
          <button className="topbar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Icon name="menu" />
          </button>

          {/* User Menu */}
          <div className="ml-auto flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <User size={20} />
                <span className="text-sm font-medium">{user?.email || 'Usuario'}</span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition"
                  >
                    <LogOut size={18} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}