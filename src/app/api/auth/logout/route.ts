import { NextResponse } from "next/server";
import { endSession, getAnySession } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Cierra la sesión y vuelve al ingreso (sirve tanto para un <form> como para fetch). */
export async function POST(req: Request) {
  const session = await getAnySession().catch(() => null);
  await endSession();
  if (session) await audit({ actorId: session.id, action: "LOGOUT", entity: "User", entityId: session.id });
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
