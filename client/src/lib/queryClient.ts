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
  console.log(`API Request: ${method} ${url}`, data ? { data: isFormData ? 'FormData' : data } : 'No data');
  
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
    console.log(`Sending fetch request to ${url} with options:`, { ...options, body: options.body ? 'BODY_DATA' : undefined });
    const res = await fetch(url, options);
    console.log(`API Response from ${url}:`, { status: res.status, statusText: res.statusText, ok: res.ok });
    
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
    console.log(`Query fetch request: ${url}`, { queryKey, unauthorizedBehavior });
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });
      
      console.log(`Query Response from ${url}:`, { status: res.status, statusText: res.statusText, ok: res.ok });
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`Returning null for 401 response from ${url} as configured`);
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
      console.log(`Query data received from ${url}:`, data);
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
      staleTime: 10 * 60 * 1000, // 10 minutes for better caching
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection time (React Query v5)
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
