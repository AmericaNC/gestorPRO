import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import LocalesPage from "./pages/LocalesPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import "./App.css";

const Placeholder = ({ titulo }) => (
  <div>
    <h1 className="page-title">{titulo}</h1>
    <p className="page-subtitle">Sección en construcción...</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Placeholder titulo="Dashboard" />} />
            <Route path="/locales" element={<LocalesPage />} />
            <Route path="/contratos" element={<Placeholder titulo="Contratos" />} />
            <Route path="/expedientes" element={<Placeholder titulo="Expedientes" />} />
            <Route path="/incrementos" element={<Placeholder titulo="Incrementos" />} />
            <Route path="/financiero" element={<Placeholder titulo="Financiero" />} />
            <Route path="/arrendatarios" element={<Placeholder titulo="Arrendatarios" />} />
            <Route path="/reportes" element={<Placeholder titulo="Reportes" />} />
            <Route path="/configuracion" element={
              <RoleRoute allowedRoles={["admin"]}>
                <UsersPage />
              </RoleRoute>
            } />
            <Route path="/configuracion/usuarios" element={
              <RoleRoute allowedRoles={["admin"]}>
                <UsersPage />
              </RoleRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}