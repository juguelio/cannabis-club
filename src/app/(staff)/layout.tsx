import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** Revalida usuario y tokenVersion en todas las páginas internas, no sólo en el proxy. */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return children;
}
