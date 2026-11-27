import { route, created } from "@/lib/api";
import { guardarFotoLote } from "@/lib/batch-photo";

export const POST = route<{ id: string }>(async (req, { id }) => created(await guardarFotoLote(req, id)));
