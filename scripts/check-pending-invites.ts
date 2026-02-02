import { prisma } from "../src/lib/prisma.js";

async function main() {
  const invites = await prisma.invitation.findMany({
    where: { acceptedAt: null },
    select: { id: true, name: true, email: true, role: true, token: true, expiresAt: true, createdAt: true }
  });

  console.log(`Found ${invites.length} pending invitations:\n`);
  invites.forEach(inv => {
    const expired = inv.expiresAt < new Date();
    console.log(`  ${expired ? "⚠️ EXPIRED" : "⏳ PENDING"} ${inv.name} (${inv.email})`);
    console.log(`     Role: ${inv.role}`);
    console.log(`     Token: ${inv.token}`);
    console.log(`     Expires: ${inv.expiresAt.toISOString()}`);
    console.log("");
  });
}

main().finally(() => prisma.$disconnect());
