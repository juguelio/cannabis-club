import { requireMember } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { portalOverview } from "@/lib/pickups";

export async function GET() {
  try {
    const member = await requireMember();
    return json(await portalOverview(member.memberId));
  } catch (error) {
    return fail(error);
  }
}
