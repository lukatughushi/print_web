import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AuthProvider from './context/AuthProvider';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';

// Heavy or rarely used pages load on demand, so the storefront doesn't
// download the 3D/editor libraries (three.js, Konva) or the admin panel.
const loadDesignPage = () => import('./pages/DesignPage');
const DesignPage = lazy(loadDesignPage);
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const AdminOrders = lazy(() => import('./pages/admin/OrdersPage'));
const AdminProducts = lazy(() => import('./pages/admin/ProductsPage'));
const AdminUsers = lazy(() => import('./pages/admin/UsersPage'));
const BannersPage = lazy(() => import('./pages/admin/BannersPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));

// Fetch the constructor code once the current page is idle, so opening it
// later is instant without slowing down the first page load.
function usePrefetchDesignPage() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2500));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => { loadDesignPage().catch(() => {}); });
    return () => cancel(handle);
  }, []);
}

function PageLoading() {
  return <div style={{ minHeight: '60vh' }} aria-busy="true" />;
}

function AppContent() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  usePrefetchDesignPage();

  return (
    <>
      {!isAdmin && <Navbar />}
      <Toast />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        {/* Design editor — existing Fabric.js page, do not replace */}
        <Route path="/design/:productId" element={<DesignPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />

        {/* Customer auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<AccountPage />} />
        </Route>

        {/* Public admin login */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Protected admin panel */}
        <Route element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
