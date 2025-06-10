import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  isFormData: boolean = false,
): Promise<Response> {
  // Debug logging removed for production performance
  
  const options: RequestInit = {
    method,
    credentials: "include",
  };

  if (data) {
    if (isFormData) {
      // Don't set Content-Type for FormData; let the browser set it with boundary
      options.body = data as FormData;
    } else {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(data);
    }
  }

  try {
    // Request logging removed for performance
    const res = await fetch(url, options);
    // Response logging removed for performance
    
    // Create a clone of response before reading its body
    // This allows us to both log the error response and return the original response
    if (!res.ok) {
      const errorClone = res.clone();
      try {
        const errorData = await errorClone.json();
        console.error(`Error response from ${url}:`, { status: res.status, data: errorData });
      } catch (jsonError) {
        try {
          const errorText = await errorClone.text();
          console.error(`Error response from ${url}:`, { status: res.status, text: errorText });
        } catch (textError) {
          console.error(`Failed to read error response from ${url}:`, textError);
        }
      }
    }
    
    // We're not consuming the body here anymore, so the caller can do it
    // Don't use throwIfResNotOk which consumes the body
    return res;
  } catch (error) {
    console.error(`Exception during fetch to ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Debug logging removed for production performance
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });
      
      // Response logging removed for performance
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        // 401 handling - logging removed
        return null;
      }
      
      if (!res.ok) {
        try {
          const errorText = await res.text();
          console.error(`Error response from ${url}:`, { status: res.status, text: errorText });
        } catch (readError) {
          console.error(`Failed to read error response from ${url}:`, readError);
        }
      }
      
      await throwIfResNotOk(res);
      const data = await res.json();
      // Data logging removed for performance
      return data;
    } catch (error) {
      console.error(`Exception during query fetch to ${url}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Disable to prevent excessive refetching
      staleTime: 5 * 60 * 1000, // 5 minutes - optimized for memory management
      gcTime: 8 * 60 * 1000, // 8 minutes - reduced to prevent memory leaks
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors except 401
        if (error && typeof error === 'object' && 'message' in error) {
          const status = parseInt(error.message.split(':')[0]);
          if (status >= 400 && status < 500 && status !== 401) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: 1000,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});
