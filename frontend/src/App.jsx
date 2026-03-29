import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Home from './pages/Home';
import StoreLayout from './pages/StoreLayout';
import Dashboard from './pages/Dashboard';
import MetaPixel from './pages/MetaPixel';
import Cashflow from './pages/Cashflow';
import Costos from './pages/Costos';
import Productos from './pages/Productos';
import Clientes from './pages/Clientes';
import Creativos from './pages/Creativos';
import Competencia from './pages/Competencia';
import DailyTracker from './pages/DailyTracker';
import Settings from './pages/Settings';

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
        <Route path="meta-pixel" element={<MetaPixel />} />
        <Route path="cashflow" element={<Cashflow />} />
        <Route path="costos" element={<Costos />} />
        <Route path="productos" element={<Productos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="creativos" element={<Creativos />} />
        <Route path="competencia" element={<Competencia />} />
        <Route path="daily-tracker" element={<DailyTracker />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
