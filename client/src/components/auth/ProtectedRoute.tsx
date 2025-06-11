import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string | string[];
}

/**
 * Component that protects routes requiring authentication
 * This is the legacy pattern-based ProtectedRoute. Use the path-based
 * ProtectedRoute from common/ProtectedRoute.tsx for new routes.
 * 
 * @deprecated Use the path-based ProtectedRoute from common/ProtectedRoute.tsx
 */
export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { data: user, isLoading } = useAuth();
  
  // Show loading state if still checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to auth page if not authenticated - use /auth consistently
  if (!user) {
    console.log('ProtectedRoute: User not authenticated, redirecting to /auth');
    return <Redirect to="/auth" />;
  }
  
  // Role-based access control
  if (requiredRoles) {
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!user.role || !allowedRoles.includes(user.role)) {
      // Redirect to unauthorized page or dashboard
      return <Redirect to="/unauthorized" />;
    }
  }
  
  // Render children if authenticated and authorized
  return <>{children}</>;
}
