import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { voidEntry } from "@/lib/account";

const Body = z.object({ reason: z.string().trim().min(3).max(300) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser(["ADMIN"]);
    const { id } = await ctx.params;
    const body = Body.parse(await req.json());
    const contra = await voidEntry(id, { reason: body.reason, createdById: session.id });
    return json({ reversalId: contra.id });
  } catch (error) {
    return fail(error);
  }
}
