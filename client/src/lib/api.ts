export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

/**
 * Fetch wrapper for the EduGap API. Sends the session cookie and the custom
 * header the server requires on state-changing requests (CSRF defence).
 */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "edugap",
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("edugap:unauthorized"));
    throw new ApiError(res.status, d.error ?? (res.status >= 500 ? "The server had a problem. Please try again." : `Request failed (${res.status})`), d.fields ?? {});
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
