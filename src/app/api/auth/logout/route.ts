import { endSession, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, json } from "@/lib/http";

export async function POST() {
  try {
    const session = await getSession();
    await endSession();
    if (session) await audit({ actorId: session.id, action: "LOGOUT", entity: "User", entityId: session.id });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
