// Rota la clave de un usuario. Uso: npx tsx scripts/rotate-user.ts <email> <password>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) throw new Error("uso: <email> <password 12+>");
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { email }, data: { passwordHash: hash } });
  console.log("clave rotada:", user.email, user.role);
}

main().finally(() => prisma.$disconnect());
