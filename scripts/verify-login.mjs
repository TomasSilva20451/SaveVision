import "dotenv/config";
import { verifyPassword } from "../src/lib/auth/password.ts";
import { db } from "../src/lib/db.ts";

const email = process.argv[2] ?? "tomas@fintwin.local";
const password = process.argv[3] ?? "";
const user = await db.user.findUnique({
  where: { email: email.toLowerCase() },
  select: { email: true, passwordHash: true, emailVerifiedAt: true, disabledAt: true },
});
console.log("DATABASE", new URL(process.env.DATABASE_URL).pathname.slice(1));
console.log("USER", user?.email ?? "missing", "verified", Boolean(user?.emailVerifiedAt), "disabled", Boolean(user?.disabledAt));
if (user && password) {
  console.log("PASSWORD_OK", await verifyPassword(user.passwordHash, password));
}
await db.$disconnect();
