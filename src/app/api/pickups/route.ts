import { requireUser } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { listPickups } from "@/lib/pickups";

export async function GET() {
  try {
    await requireUser(["ADMIN", "OPERADOR"]);
    return json({ pickups: await listPickups() });
  } catch (error) {
    return fail(error);
  }
}
