import { z } from "zod";
import { authenticate, startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, fail, json } from "@/lib/http";

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const user = await authenticate(body.email, body.password, clientIp(req));
    await startSession(user, user.tokenVersion);
    await audit({ actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip: clientIp(req) });
    return json({ user });
  } catch (error) {
    return fail(error);
  }
}
