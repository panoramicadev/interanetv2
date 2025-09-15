import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Legacy signature for backward compatibility
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response>;
// New signature
export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    data?: unknown;
  }
): Promise<Response>;
// Implementation
export async function apiRequest(
  methodOrUrl: string,
  urlOrOptions?: string | { method?: string; data?: unknown },
  data?: unknown
): Promise<Response> {
  let method: string;
  let url: string;
  let requestData: unknown;

  // Detect signature based on second parameter type
  if (typeof urlOrOptions === 'string') {
    // Legacy signature: (method, url, data?)
    method = methodOrUrl;
    url = urlOrOptions;
    requestData = data;
    console.warn('Using legacy apiRequest signature. Please migrate to new signature: apiRequest(url, {method, data})');
  } else {
    // New signature: (url, {method?, data?}?)
    url = methodOrUrl;
    method = urlOrOptions?.method || 'GET';
    requestData = urlOrOptions?.data;
  }

  const res = await fetch(url, {
    method,
    headers: requestData ? { "Content-Type": "application/json" } : {},
    body: requestData ? JSON.stringify(requestData) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
