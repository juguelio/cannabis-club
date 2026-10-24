// Rota la clave del admin demo. Uso: DATABASE_URL=... npx tsx scripts/rotate-admin.ts <password>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 12) throw new Error("password muy corta");
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email: "admin@club.test" },
    data: { passwordHash: hash },
  });
  console.log("clave rotada para", user.email, "rol", user.role);
}

main().finally(() => prisma.$disconnect());
