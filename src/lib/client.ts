/** Cliente de la API para componentes: errores con código y mensaje legible. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("NETWORK", "Sin conexión con el servidor. Revisá internet y volvé a intentar.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "ERROR", data.message ?? `Error ${res.status}`, res.status, data.details);
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Algo salió mal");
