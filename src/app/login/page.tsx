import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/forms";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <LoginForm />
    </div>
  );
}
