import type { ZodType } from "zod";
import { fail, json } from "./http";

/**
 * Envoltorio común de las rutas: un solo lugar para el manejo de errores.
 * La ruta devuelve un objeto (se serializa como JSON 200), una Response propia,
 * o `created(...)` para responder 201.
 */
type Ctx<P> = { params: Promise<P> };
type Result = Response | Created | Record<string, unknown> | unknown[];

class Created {
  constructor(public body: unknown) {}
}
export const created = (body: unknown) => new Created(body);

export function route<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Result>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      if (out instanceof Created) return json(out.body, 201);
      return json(out);
    } catch (error) {
      return fail(error);
    }
  };
}

/** Lee y valida el cuerpo JSON. Un cuerpo roto cae como INVALID_JSON (400). */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.text();
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  return schema.parse(parsed);
}

export const searchParams = (req: Request) => new URL(req.url).searchParams;
