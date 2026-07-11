import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getAuthSession } from '../data/auth.js';

export function ProtectedRoute() {
  const location = useLocation();
  if (getAuthSession()) return <Outlet />;
  return <Navigate to="/login" replace state={{ from: location }} />;
}
