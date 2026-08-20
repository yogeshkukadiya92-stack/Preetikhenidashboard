import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { canAccessPath, getAuthSession, getLandingPath, rememberLastProtectedPath } from '../data/auth.js';

export function ProtectedRoute() {
  const location = useLocation();
  const session = getAuthSession();
  if (session && canAccessPath(session, location.pathname)) {
    rememberLastProtectedPath(`${location.pathname}${location.search ?? ''}`);
    return <Outlet />;
  }
  if (session) return <Navigate to={getLandingPath(session)} replace />;
  return <Navigate to="/login" replace state={{ from: location }} />;
}
