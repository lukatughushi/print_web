import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';

/**
 * Guards a route (as a layout route with <Outlet/>, or by wrapping children).
 *   <Route element={<ProtectedRoute />}>…</Route>
 *   <Route element={<ProtectedRoute roles={['admin']} redirectTo="/admin/login" />}>…</Route>
 * Unauthenticated users, or users without a required role, are sent to `redirectTo`
 * with the original location in `state.from` so the login page can send them back.
 */
export default function ProtectedRoute({ roles, redirectTo = '/login', children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center py-24" role="status" aria-label="Loading">
        <span className="size-8 animate-spin rounded-full border-4 border-navy/20 border-t-coral" />
      </div>
    );
  }

  if (!user || (roles && !roles.includes(user.role))) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}
