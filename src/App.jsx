import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import LocalesPage from "./pages/LocalesPage";
import ContratosPage from "./pages/ContratosPage";
import UsersPage from "./pages/UsersPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import ArrendatariosPage from "./pages/ArrendatarioPage";
import "./App.css";

const Placeholder = ({ titulo }) => (
  <div>
    <h1 className="page-title">{titulo}</h1>
    <p className="page-subtitle">Sección en construcción...</p>
  </div>
);
const SinPermisos = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-red-500">Sin permisos</h1>
      <p className="text-gray-600 mt-2">No tienes acceso a esta sección.</p>
    </div>
  </div>
)
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
            <Route path="/locales" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
                <LocalesPage />
              </RoleRoute>
            } />
            <Route path="/contratos" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
                <ContratosPage />
              </RoleRoute>
            } />
            <Route path="/expedientes" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
                <Placeholder titulo="Expedientes" />
              </RoleRoute>
            } />
            <Route path="/incrementos" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
                <Placeholder titulo="Incrementos" />
              </RoleRoute>
            } />
            <Route path="/financiero" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
                <Placeholder titulo="Financiero" />
              </RoleRoute>
            } />
            <Route path="/arrendatarios" element={
              <RoleRoute allowedRoles={["admin", "gestor"]}>
    <ArrendatariosPage /> 
              </RoleRoute>
            } />
            <Route path="/reportes" element={
              <RoleRoute allowedRoles={["admin", "lector", "gestor"]}>
                <Placeholder titulo="Reportes" />
              </RoleRoute>
            } />
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
          <Route path="/sin-permisos" element={<SinPermisos />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}