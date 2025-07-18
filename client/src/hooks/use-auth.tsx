import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient
} from "@tanstack/react-query";
import { User } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  data: User | null;
  isLoading: boolean;
  error: Error | null;
  login: UseMutationResult<User, Error, LoginData>;
  logout: UseMutationResult<any, Error, void>; // Using 'any' for the return type to be more flexible
  register: UseMutationResult<User, Error, RegisterData>;
  refreshAuth: () => Promise<User | null>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  passwordConfirm: string; // Add the passwordConfirm field
  role?: string;
  initials?: string;
  avatarColor?: string;
};

async function fetchCurrentUser(): Promise<User | null> {
  try {
    console.log('Fetching current user data');
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status === 401) {
      console.log('User is not authenticated (401 response)');
      return null;
    }
    
    if (!response.ok) {
      console.error('Error fetching user:', response.status, response.statusText);
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    
    const userData = await response.json();
    if (!userData || !userData.id) {
      console.error('Invalid user data received:', userData);
      throw new Error('Invalid user data received from server');
    }
    
    console.log('Current user data fetched successfully:', userData);
    return userData;
  } catch (error) {
    console.error('Exception in fetchCurrentUser:', error);
    return null;
  }
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const localQueryClient = useQueryClient();
  
  const {
    data,
    error,
    isLoading,
    refetch,
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 1000,
  });

  // Refresh auth method that can be called manually
  const refreshAuth = async (): Promise<User | null> => {
    console.log('Manual auth refresh requested');
    const result = await refetch();
    return result.data ?? null;
  };

  const login = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('Auth login mutation starting with credentials:', { username: credentials.username, password: '******' });
      try {
        const res = await apiRequest("POST", "/api/auth/login", credentials);
        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error');
          console.error('Login API error response:', res.status, errorText);
          throw new Error(errorText || `Login failed with status ${res.status}`);
        }
        
        const userData = await res.json();
        if (!userData || !userData.id) {
          console.error('Invalid user data received from login:', userData);
          throw new Error('Invalid user data received from server');
        }
        
        console.log('Login API response successful:', userData);
        return userData;
      } catch (error) {
        console.error('Login API request failed:', error);
        throw error;
      }
    },
    onSuccess: async (user: User) => {
      console.log('Login mutation onSuccess handler, setting user data:', user);
      // Immediately update the local query cache
      localQueryClient.setQueryData(["/api/auth/me"], user);
      
      // Invalidate all queries to ensure fresh data after login
      localQueryClient.invalidateQueries();
      
      // For extra safety, explicitly refresh auth
      await refreshAuth();
    },
    onError: (error: Error) => {
      console.error('Login mutation onError handler:', error);
      toast({
        title: "Login failed",
        description: error.message || "Unable to login. Please try again.",
        variant: "destructive",
      });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      try {
        const response = await apiRequest("POST", "/api/auth/logout");
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(errorText || `Logout failed with status ${response.status}`);
        }
        return response; // Return the response
      } catch (error) {
        console.error('Logout API request failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Clear the auth data in the cache
      console.log('Logout successful, clearing auth data');
      localQueryClient.setQueryData(["/api/auth/me"], null);
      
      // Invalidate all queries that depend on authentication
      localQueryClient.invalidateQueries({queryKey: ["/api/auth/me"]});
      
      // Use window.location for a clean redirect that resets all state
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      console.error('Logout mutation error handler:', error);
      toast({
        title: "Logout failed",
        description: error.message || "Unable to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const register = useMutation({
    mutationFn: async (userData: RegisterData) => {
      try {
        console.log('Starting registration with data:', { 
          ...userData, 
          password: '******', 
          passwordConfirm: '******' 
        });
        
        // Validate passwords match client-side as well
        if (userData.password !== userData.passwordConfirm) {
          console.error('Client-side password validation failed: passwords do not match');
          throw new Error('Passwords do not match');
        }
        
        // Make the API request
        console.log('Sending registration API request');
        const res = await apiRequest("POST", "/api/auth/register", userData);
        
        // Handle non-2xx responses
        if (!res.ok) {
          let errorText;
          try {
            // Try to get structured error JSON first
            const errorData = await res.json();
            console.error('Registration API error JSON response:', res.status, errorData);
            errorText = errorData.message || JSON.stringify(errorData);
          } catch {
            // Fall back to plain text
            errorText = await res.text().catch(() => 'Unknown error');
            console.error('Registration API error text response:', res.status, errorText);
          }
          throw new Error(errorText || `Registration failed with status ${res.status}`);
        }
        
        // Parse successful response
        const userResponse = await res.json();
        if (!userResponse || !userResponse.id) {
          console.error('Invalid user data received from registration:', userResponse);
          throw new Error('Invalid user data received from server');
        }
        
        console.log('Registration API response successful:', userResponse);
        return userResponse;
      } catch (error) {
        console.error('Registration API request failed:', error);
        throw error;
      }
    },
    onSuccess: async (user: User) => {
      console.log('Registration mutation onSuccess handler, setting user data:', user);
      // Immediately update the local query cache
      localQueryClient.setQueryData(["/api/auth/me"], user);
      
      // Invalidate all queries to ensure fresh data after login
      localQueryClient.invalidateQueries();
      
      // For extra safety, explicitly refresh auth
      await refreshAuth();
    },
    onError: (error: Error) => {
      console.error('Registration mutation onError handler:', error);
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check for session on page load
  useEffect(() => {
    console.log('Auth provider mounted - checking authentication status');
    refreshAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        data: data ?? null,
        isLoading,
        error,
        login,
        logout,
        register,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
