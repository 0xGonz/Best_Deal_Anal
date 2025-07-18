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

    const res = await fetch(url, options);

    // Create a clone of response before reading its body
    // This allows us to both log the error response and return the original response
    if (!res.ok) {
      const errorClone = res.clone();
      try {
        const errorData = await errorClone.json();

      } catch (jsonError) {
        try {
          const errorText = await errorClone.text();

        } catch (textError) {

        }
      }
    }
    
    // We're not consuming the body here anymore, so the caller can do it
    // Don't use throwIfResNotOk which consumes the body
    return res;
  } catch (error) {

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

    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {

        return null;
      }
      
      if (!res.ok) {
        try {
          const errorText = await res.text();

          throw new Error(`${res.status}: ${errorText}`);
        } catch (readError) {

          throw new Error(`${res.status}: ${res.statusText}`);
        }
      }
      
      const data = await res.json();

      return data;
    } catch (error) {

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
        return failureCount < 3; // Increased retry count for better reliability
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff with cap
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
      onError: (error, variables, context) => {

      },
    },
  },
});

// Add global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {

  event.preventDefault(); // Prevent the default browser error handling
});

window.addEventListener('error', (event) => {

});
