import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { useI18n } from './i18n/index.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { LoadingBlock } from './components/ui/Primitives.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import StockIn from './pages/StockIn.jsx';
import StockOut from './pages/StockOut.jsx';
import StockPositions from './pages/StockPositions.jsx';
import StockLedger from './pages/StockLedger.jsx';
import Sales from './pages/Sales.jsx';
import Purchases from './pages/Purchases.jsx';
import Customers from './pages/Customers.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Expenses from './pages/Expenses.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Branches from './pages/Branches.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';

function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingBlock className="min-h-screen bg-canvas" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <AppShell>{children}</AppShell>;
}

function Guarded({ permission, children }) {
  const { hasPermission } = useAuth();
  const { t } = useI18n();
  if (permission && !hasPermission(permission)) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-base font-semibold text-ink">{t('common.noPermission')}</h2>
        <p className="text-sm text-ink-muted mt-1">{t('common.featureUnavailable')}</p>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/products"
        element={
          <Protected>
            <Products />
          </Protected>
        }
      />
      <Route
        path="/categories"
        element={
          <Protected>
            <Categories />
          </Protected>
        }
      />
      <Route
        path="/stock/in"
        element={
          <Protected>
            <StockIn />
          </Protected>
        }
      />
      <Route
        path="/stock/out"
        element={
          <Protected>
            <StockOut />
          </Protected>
        }
      />
      <Route
        path="/stock/positions"
        element={
          <Protected>
            <StockPositions />
          </Protected>
        }
      />
      <Route
        path="/stock/ledger"
        element={
          <Protected>
            <StockLedger />
          </Protected>
        }
      />
      <Route
        path="/sales"
        element={
          <Protected>
            <Sales />
          </Protected>
        }
      />
      <Route
        path="/purchases"
        element={
          <Protected>
            <Purchases />
          </Protected>
        }
      />
      <Route
        path="/customers"
        element={
          <Protected>
            <Customers />
          </Protected>
        }
      />
      <Route
        path="/suppliers"
        element={
          <Protected>
            <Suppliers />
          </Protected>
        }
      />
      <Route
        path="/expenses"
        element={
          <Protected>
            <Expenses />
          </Protected>
        }
      />
      <Route
        path="/payments"
        element={
          <Protected>
            <Payments />
          </Protected>
        }
      />
      <Route
        path="/reports"
        element={
          <Protected>
            <Guarded permission="reports.view">
              <Reports />
            </Guarded>
          </Protected>
        }
      />
      <Route
        path="/branches"
        element={
          <Protected>
            <Branches />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected>
            <Guarded permission="users.manage">
              <Users />
            </Guarded>
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Guarded permission="settings.view">
              <Settings />
            </Guarded>
          </Protected>
        }
      />
      <Route
        path="/audit"
        element={
          <Protected>
            <Guarded permission="audit.view">
              <Audit />
            </Guarded>
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
