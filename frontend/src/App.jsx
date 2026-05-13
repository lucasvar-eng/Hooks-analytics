import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Home from './pages/Home';
import StoreLayout from './pages/StoreLayout';
import Dashboard from './pages/Dashboard';
import Tienda from './pages/Tienda';
import MetaAds from './pages/MetaAds';
import Cashflow from './pages/Cashflow';
import Costos from './pages/Costos';
import Productos from './pages/Productos';
import Clientes from './pages/Clientes';
import Creativos from './pages/Creativos';
import Competencia from './pages/Competencia';
import Simulador from './pages/Simulador';
import Reportes from './pages/Reportes';
import ReportBuilder from './pages/ReportBuilder';
import Alertas from './pages/Alertas';
import Automatizaciones from './pages/Automatizaciones';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import UserManagement from './pages/UserManagement';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/store/:storeId"
        element={
          <ProtectedRoute>
            <StoreLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tienda" element={<Tienda />} />
        <Route path="meta-ads" element={<MetaAds />} />
        {/* Backwards compat for old bookmarks */}
        <Route path="meta-pixel" element={<Navigate to="../meta-ads" replace />} />
        <Route path="cashflow" element={<Cashflow />} />
        <Route path="costos" element={<Costos />} />
        <Route path="productos" element={<Productos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="creativos" element={<Creativos />} />
        {/* Backwards compat: TopicMap y LanguageBank ahora viven como bloques dentro de Creativos */}
        <Route path="topic-map" element={<Navigate to="../creativos" replace />} />
        <Route path="language-bank" element={<Navigate to="../creativos" replace />} />
        <Route path="competencia" element={<Competencia />} />
        <Route path="simulador" element={<Simulador />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="report-builder" element={<ReportBuilder />} />
        <Route path="alertas" element={<Alertas />} />
        <Route path="automatizaciones" element={<Automatizaciones />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
