import { ReactNode } from 'react';
import { Route, Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
  requiredRoles?: string | string[];
}

/**
 * Path-based ProtectedRoute component that handles both authentication
 * and optional role-based authorization.
 */
export function ProtectedRoute({ 
  path, 
  component: Component, 
  requiredRoles 
}: ProtectedRouteProps) {
  const { data: user, isLoading } = useAuth();

  // Add minimal debugging logs in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(`ProtectedRoute for ${path}: isLoading=${isLoading}, user=${user?.username}`);
  }

  // Show a loading state while checking authentication
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-neutral-50">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-neutral-600">Loading...</p>
          </div>
        </div>
      </Route>
    );
  }

  // If not authenticated, redirect to auth page
  if (!user) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`ProtectedRoute ${path}: User not authenticated, redirecting to /auth`);
    }
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }
  
  // Role-based access control (if roles are specified)
  if (requiredRoles) {
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!user.role || !allowedRoles.includes(user.role)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`ProtectedRoute ${path}: User ${user.username} lacks required role (has: ${user.role}, required: ${allowedRoles.join(',')})`);
      }
      // Redirect to unauthorized page or dashboard
      return (
        <Route path={path}>
          <Redirect to="/unauthorized" />
        </Route>
      );
    }
  }

  // User is authenticated and authorized, render the component
  if (process.env.NODE_ENV !== 'production') {
    console.log(`ProtectedRoute ${path}: Rendering component for user ${user.username}`);
  }
  return <Route path={path}>
    <Component />
  </Route>;
}
